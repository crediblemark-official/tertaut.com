import { Elysia, t } from "elysia";
import { db } from "../db";
import {
  transactions,
  builders,
  apps,
  licenses,
} from "../db/schema";
import { eq, and, sql, desc, inArray, count } from "drizzle-orm";
import { XenditService } from "../services/xendit";
import { authenticate } from "../middleware/auth";

export const panelRoutes = new Elysia({ prefix: "/panel" })
  .onBeforeHandle(async ({ request: { headers }, status }) => {
    const res = await authenticate(headers, true);
    if ("status" in res) return status(res.status, { error: res.error });
  })
  /**
   * Macro Platform Overview Stats (Pendapatan Fee 5% & GMV Platform tertaut.com)
   */
  .get(
    "/stats",
    async () => {
      // Agregasi di database — hindari memuat seluruh ledger PAID ke memori.
      const [totals] = await db
        .select({
          totalGMV: sql<number>`coalesce(sum(${transactions.grossAmount}), 0)`.mapWith(Number),
          totalFee: sql<number>`coalesce(sum(${transactions.platformFee}), 0)`.mapWith(Number),
          totalNet: sql<number>`coalesce(sum(${transactions.netAmount}), 0)`.mapWith(Number),
          totalTx: sql<number>`count(*)`.mapWith(Number),
          pendingAmount: sql<number>`coalesce(sum(case when ${transactions.disbursementStatus} = 'PENDING' then ${transactions.netAmount} else 0 end), 0)`.mapWith(Number),
          pendingCount: sql<number>`count(*) filter (where ${transactions.disbursementStatus} = 'PENDING')`.mapWith(Number),
          completedAmount: sql<number>`coalesce(sum(case when ${transactions.disbursementStatus} = 'COMPLETED' then ${transactions.netAmount} else 0 end), 0)`.mapWith(Number),
        })
        .from(transactions)
        .where(eq(transactions.paymentStatus, "PAID"));

      const [[builderCount], [appCount], [licenseCount]] = await Promise.all([
        db.select({ value: count() }).from(builders),
        db.select({ value: count() }).from(apps),
        db.select({ value: count() }).from(licenses).where(eq(licenses.status, "ACTIVE")),
      ]);

      const totalGMV = totals?.totalGMV ?? 0;
      const totalPlatformFeeCollected = totals?.totalFee ?? 0;
      const totalNetBuilderEarnings = totals?.totalNet ?? 0;
      const totalPaidCount = totals?.totalTx ?? 0;
      const totalPendingDisbursement = totals?.pendingAmount ?? 0;
      const pendingCount = totals?.pendingCount ?? 0;
      const totalCompletedDisbursement = totals?.completedAmount ?? 0;

      const totalBuilders = builderCount?.value ?? 0;
      const totalApps = appCount?.value ?? 0;
      const totalActiveLicenses = licenseCount?.value ?? 0;

      const mem = process.memoryUsage();

      const responseData = {
        totalGMV,
        platformFeeRevenue: totalPlatformFeeCollected,
        netBuilderShare: totalNetBuilderEarnings,
        totalTransactions: totalPaidCount,
        paidTransactions: totalPaidCount,
        pendingDisbursementsAmount: totalPendingDisbursement,
        pendingDisbursementsCount: pendingCount,
        totalApps,
        totalBuilders,
        totalLicensesIssued: totalActiveLicenses,
        system: {
          nodeEnv: process.env.NODE_ENV || "development",
          bunVersion: Bun.version,
          uptimeSeconds: Math.floor(process.uptime()),
          memoryUsageMB: {
            rss: Math.round((mem.rss / 1024 / 1024) * 100) / 100,
            heapTotal: Math.round((mem.heapTotal / 1024 / 1024) * 100) / 100,
            heapUsed: Math.round((mem.heapUsed / 1024 / 1024) * 100) / 100,
          },
          memoryRssMb: Math.round((mem.rss / 1024 / 1024) * 100) / 100,
          memoryHeapUsedMb: Math.round((mem.heapUsed / 1024 / 1024) * 100) / 100,
          timestamp: new Date().toISOString(),
        },
      };

      return {
        success: true,
        data: responseData,
        metrics: {
          totalGMV,
          totalPlatformFeeCollected,
          totalNetBuilderEarnings,
          totalPendingDisbursement,
          totalCompletedDisbursement,
          totalTransactions: totalPaidCount,
          totalBuilders,
          totalApps,
          totalActiveLicenses,
        },
        system: responseData.system,
      };
    },
    {
      detail: {
        tags: ["Admin Panel"],
        summary: "Platform Macro Overview",
        description: "Returns aggregated platform metrics, MoR 5% fee revenue, and system telemetry",
      },
    }
  )

  /**
   * Direktori Builder & Rekening Pencairan
   */
  .get(
    "/builders",
    async () => {
      const allBuilders = await db.query.builders.findMany({
        orderBy: (b, { desc }) => [desc(b.createdAt)],
      });

      // Ambil semua app & transaksi PAID sekali, lalu kelompokkan per builder
      // (menghindari N+1 query per builder).
      const [allApps, paidTxs] = await Promise.all([
        db
          .select({
            id: apps.id,
            name: apps.name,
            slug: apps.slug,
            mode: apps.mode,
            builderId: apps.builderId,
          })
          .from(apps),
        db
          .select({
            builderId: transactions.builderId,
            grossAmount: transactions.grossAmount,
            netAmount: transactions.netAmount,
            disbursementStatus: transactions.disbursementStatus,
          })
          .from(transactions)
          .where(eq(transactions.paymentStatus, "PAID")),
      ]);

      const appsByBuilder = new Map<string, typeof allApps>();
      for (const a of allApps) {
        const list = appsByBuilder.get(a.builderId) || [];
        list.push(a);
        appsByBuilder.set(a.builderId, list);
      }

      const txsByBuilder = new Map<string, typeof paidTxs>();
      for (const tx of paidTxs) {
        const list = txsByBuilder.get(tx.builderId) || [];
        list.push(tx);
        txsByBuilder.set(tx.builderId, list);
      }

      const enriched = allBuilders.map((b) => {
          const builderApps = appsByBuilder.get(b.id) || [];
          const builderTxs = txsByBuilder.get(b.id) || [];

          const gmv = builderTxs.reduce((sum, tx) => sum + tx.grossAmount, 0);
          const net = builderTxs.reduce((sum, tx) => sum + tx.netAmount, 0);
          const pending = builderTxs
            .filter((tx) => tx.disbursementStatus === "PENDING")
            .reduce((sum, tx) => sum + tx.netAmount, 0);

          return {
        id: b.id,
        name: b.name,
        email: b.email,
        disbursementAccount: b.disbursementAccount || null,
        bankAccount: b.disbursementAccount
          ? {
              bankName: b.disbursementAccount.bankCode || null,
              accountNumber: b.disbursementAccount.accountNumber || null,
              accountHolder: b.disbursementAccount.accountHolderName || b.name,
            }
          : null,
            totalApps: builderApps.length,
            appCount: builderApps.length,
            apps: builderApps.map((a) => ({ id: a.id, name: a.name, slug: a.slug, mode: a.mode })),
            totalGMV: gmv,
            totalSales: gmv,
            totalNetEarnings: net,
            builderNetRevenue: net,
            pendingPayout: pending,
            createdAt: b.createdAt,
          };
        });

      return {
        success: true,
        count: enriched.length,
        total: enriched.length,
        builders: enriched,
      };
    },
    {
      detail: {
        tags: ["Admin Panel"],
        summary: "List Builders & Bank Accounts",
        description: "Returns all registered builders, their apps count, bank disbursement accounts, and earnings",
      },
    }
  )

  /**
   * Ledger Transaksi Global (Audit Cross-Builder)
   */
  .get(
    "/transactions",
    async ({ query }) => {
      const limit = Number(query.limit) || 100;
      const statusFilter = query.status;

      const whereClause = statusFilter
        ? eq(transactions.paymentStatus, statusFilter as any)
        : undefined;

      const allTxs = await db.query.transactions.findMany({
        where: whereClause,
        orderBy: (t, { desc }) => [desc(t.createdAt)],
        limit,
      });

      // Batch-lookup app & builder (hindari N+1 per baris ledger).
      const appIds = [...new Set(allTxs.map((tx) => tx.appId))];
      const builderIds = [...new Set(allTxs.map((tx) => tx.builderId))];

      const [appRows, builderRows] = await Promise.all([
        appIds.length
          ? db.query.apps.findMany({ where: inArray(apps.id, appIds) })
          : Promise.resolve([] as (typeof apps.$inferSelect)[]),
        builderIds.length
          ? db.query.builders.findMany({ where: inArray(builders.id, builderIds) })
          : Promise.resolve([] as (typeof builders.$inferSelect)[]),
      ]);

      const appNameById = new Map(appRows.map((a) => [a.id, a.name]));
      const builderEmailById = new Map(builderRows.map((b) => [b.id, b.email]));

      const enriched = allTxs.map((tx) => {
          return {
            id: tx.id,
            appId: tx.appId,
            appName: appNameById.get(tx.appId) || tx.appId,
            builderId: tx.builderId,
            builderEmail: builderEmailById.get(tx.builderId) || "builder@tertaut.com",
            customerEmail: tx.customerEmail,
            grossAmount: tx.grossAmount,
            platformFee: tx.platformFee,
            netAmount: tx.netAmount,
            paymentStatus: tx.paymentStatus,
            disbursementStatus: tx.disbursementStatus,
            paymentChannel: tx.paymentChannel,
            paidAt: tx.paidAt,
            createdAt: tx.createdAt,
          };
        });

      return {
        success: true,
        count: enriched.length,
        total: enriched.length,
        transactions: enriched,
      };
    },
    {
      query: t.Object({
        limit: t.Optional(t.Numeric({ default: 100 })),
        status: t.Optional(t.String()),
      }),
      detail: {
        tags: ["Admin Panel"],
        summary: "Global Transactions Audit Ledger",
      },
    }
  )

  /**
   * Eksekusi Batch Payout Massal ke Seluruh Builder
   */
  .post(
    "/payouts/batch",
    async () => {
      // Hanya transaksi dari aplikasi mode LIVE yang boleh dicairkan.
      // Transaksi sandbox adalah simulasi dan tidak pernah dikirim ke Xendit.
      const liveAppRows = await db
        .select({ id: apps.id })
        .from(apps)
        .where(eq(apps.mode, "live"));
      const liveAppIds = liveAppRows.map((a) => a.id);

      const eligibleTxs = liveAppIds.length
        ? await db.query.transactions.findMany({
            where: and(
              eq(transactions.paymentStatus, "PAID"),
              eq(transactions.disbursementStatus, "PENDING"),
              inArray(transactions.appId, liveAppIds)
            ),
          })
        : [];

      if (eligibleTxs.length === 0) {
        return {
          success: true,
          message: "Tidak ada saldo pending yang memerlukan pencairan.",
          processedCount: 0,
          totalDisbursed: 0,
          disbursedCount: 0,
          totalAmount: 0,
          details: [],
          payouts: [],
        };
      }

      // Kelompokkan per builder
      const builderTxsMap = new Map<string, typeof eligibleTxs>();
      for (const tx of eligibleTxs) {
        const list = builderTxsMap.get(tx.builderId) || [];
        list.push(tx);
        builderTxsMap.set(tx.builderId, list);
      }

      const results = [];
      let totalDisbursedAmount = 0;

      for (const [builderId, txs] of builderTxsMap.entries()) {
        const totalNet = txs.reduce((sum, t) => sum + t.netAmount, 0);
        // Minimum threshold Rp 50.000
        if (totalNet < 50000) continue;

        const builder = await db.query.builders.findFirst({
          where: eq(builders.id, builderId),
        });

        const bankInfo = XenditService.resolveDisbursementAccount(builder);
        // Production TANPA rekening tersimpan → lewati builder ini (jangan pakai data palsu)
        if (!bankInfo) {
          results.push({
            builderId,
            builderName: builder?.name,
            amount: totalNet,
            error: "Builder belum menyimpan rekening penerima disbursement.",
          });
          continue;
        }

        const externalId = `batch_disb_${builderId.substring(0, 8)}_${Date.now()}`;
        try {
          const disb = await XenditService.createDisbursement({
            externalId,
            amount: totalNet,
            ...bankInfo,
            description: `Batch Payout tertaut.com MoR (${txs.length} txs)`,
          });

          for (const tx of txs) {
            await db
              .update(transactions)
              .set({
                disbursementStatus: "COMPLETED",
                disbursementId: disb.id,
                updatedAt: new Date(),
              })
              .where(eq(transactions.id, tx.id));
          }

          totalDisbursedAmount += totalNet;
          results.push({
            builderId,
            builderName: builder?.name,
            amount: totalNet,
            disbursementId: disb.id,
            status: "SUCCESS",
          });
        } catch (err: any) {
          results.push({
            builderId,
            builderName: builder?.name,
            amount: totalNet,
            error: err.message,
            status: "FAILED",
          });
        }
      }

      return {
        success: true,
        message: `Batch payout selesai diproses untuk ${results.filter((r) => r.status === "SUCCESS").length} builder.`,
        processedCount: results.filter((r) => r.status === "SUCCESS").length,
        totalDisbursed: totalDisbursedAmount,
        totalAmount: totalDisbursedAmount,
        details: results,
        payouts: results,
      };
    },
    {
      detail: {
        tags: ["Admin Panel"],
        summary: "Execute Batch Payouts to Builders",
      },
    }
  );
