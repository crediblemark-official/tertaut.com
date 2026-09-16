import { Elysia, t } from "elysia";
import { db } from "../db";
import {
  transactions,
  builders,
  apps,
  licenses,
} from "../db/schema";
import { eq, and, sql, desc } from "drizzle-orm";
import { XenditService } from "../services/xendit";

export const panelRoutes = new Elysia({ prefix: "/panel" })
  /**
   * Macro Platform Overview Stats (Pendapatan Fee 5% & GMV Platform tertaut.com)
   */
  .get(
    "/stats",
    async () => {
      const allPaidTxs = await db.query.transactions.findMany({
        where: eq(transactions.paymentStatus, "PAID"),
      });

      const totalGMV = allPaidTxs.reduce((sum, tx) => sum + tx.grossAmount, 0);
      const totalPlatformFeeCollected = allPaidTxs.reduce((sum, tx) => sum + tx.platformFee, 0);
      const totalNetBuilderEarnings = allPaidTxs.reduce((sum, tx) => sum + tx.netAmount, 0);

      const pendingTxs = allPaidTxs.filter((tx) => tx.disbursementStatus === "PENDING");
      const totalPendingDisbursement = pendingTxs.reduce((sum, tx) => sum + tx.netAmount, 0);

      const completedTxs = allPaidTxs.filter((tx) => tx.disbursementStatus === "COMPLETED");
      const totalCompletedDisbursement = completedTxs.reduce((sum, tx) => sum + tx.netAmount, 0);

      const [buildersList, appsList, licensesList] = await Promise.all([
        db.query.builders.findMany(),
        db.query.apps.findMany(),
        db.query.licenses.findMany({ where: eq(licenses.status, "ACTIVE") }),
      ]);

      const mem = process.memoryUsage();

      const responseData = {
        totalGMV,
        platformFeeRevenue: totalPlatformFeeCollected,
        netBuilderShare: totalNetBuilderEarnings,
        totalTransactions: allPaidTxs.length,
        paidTransactions: allPaidTxs.length,
        pendingDisbursementsAmount: totalPendingDisbursement,
        pendingDisbursementsCount: pendingTxs.length,
        totalApps: appsList.length,
        totalBuilders: buildersList.length,
        totalLicensesIssued: licensesList.length,
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
          totalTransactions: allPaidTxs.length,
          totalBuilders: buildersList.length,
          totalApps: appsList.length,
          totalActiveLicenses: licensesList.length,
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

      const enriched = await Promise.all(
        allBuilders.map(async (b) => {
          const builderApps = await db.query.apps.findMany({
            where: eq(apps.builderId, b.id),
          });

          const builderTxs = await db.query.transactions.findMany({
            where: and(
              eq(transactions.builderId, b.id),
              eq(transactions.paymentStatus, "PAID")
            ),
          });

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
        })
      );

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

      const enriched = await Promise.all(
        allTxs.map(async (tx) => {
          const app = await db.query.apps.findFirst({
            where: eq(apps.id, tx.appId),
          });
          const builder = await db.query.builders.findFirst({
            where: eq(builders.id, tx.builderId),
          });

          return {
            id: tx.id,
            appId: tx.appId,
            appName: app?.name || tx.appId,
            builderId: tx.builderId,
            builderEmail: builder?.email || "builder@tertaut.com",
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
        })
      );

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
      const eligibleTxs = await db.query.transactions.findMany({
        where: and(
          eq(transactions.paymentStatus, "PAID"),
          eq(transactions.disbursementStatus, "PENDING")
        ),
      });

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
