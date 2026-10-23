import { db } from "../../db";
import { transactions, builders, apps, licenses } from "../../db/schema";
import { eq, sql, count } from "drizzle-orm";

/**
 * Macro Platform Overview Stats (Pendapatan Fee 5% & GMV Platform tertaut.com)
 */
export async function handlePanelStats() {
  // Agregasi di database:
  // - Metrik Finansial Riil (GMV, Fee 5%, Porsi Builder) HANYA menghitung transaksi mode LIVE
  // - Transaksi mode SANDBOX dihitung terpisah sebagai metrik simulasi (tidak mencemari omset riil)
  const [totals] = await db
    .select({
      totalGMV:
        sql<number>`coalesce(sum(case when ${transactions.mode} = 'live' then ${transactions.grossAmount} else 0 end), 0)`.mapWith(
          Number
        ),
      totalFee:
        sql<number>`coalesce(sum(case when ${transactions.mode} = 'live' then ${transactions.platformFee} else 0 end), 0)`.mapWith(
          Number
        ),
      totalNet:
        sql<number>`coalesce(sum(case when ${transactions.mode} = 'live' then ${transactions.netAmount} else 0 end), 0)`.mapWith(
          Number
        ),
      totalTx: sql<number>`count(*) filter (where ${transactions.mode} = 'live')`.mapWith(Number),
      sandboxGMV:
        sql<number>`coalesce(sum(case when ${transactions.mode} = 'sandbox' then ${transactions.grossAmount} else 0 end), 0)`.mapWith(
          Number
        ),
      sandboxTx: sql<number>`count(*) filter (where ${transactions.mode} = 'sandbox')`.mapWith(
        Number
      ),
      pendingAmount:
        sql<number>`coalesce(sum(case when ${transactions.mode} = 'live' AND ${transactions.disbursementStatus} = 'PENDING' AND ${transactions.refundStatus} IN ('NONE', 'FAILED') then ${transactions.netAmount} else 0 end), 0)`.mapWith(
          Number
        ),
      pendingCount:
        sql<number>`count(*) filter (where ${transactions.mode} = 'live' AND ${transactions.disbursementStatus} = 'PENDING' AND ${transactions.refundStatus} IN ('NONE', 'FAILED'))`.mapWith(
          Number
        ),
      completedAmount:
        sql<number>`coalesce(sum(case when ${transactions.mode} = 'live' AND ${transactions.disbursementStatus} = 'COMPLETED' then ${transactions.netAmount} else 0 end), 0)`.mapWith(
          Number
        ),
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
  const sandboxGMV = totals?.sandboxGMV ?? 0;
  const sandboxTxCount = totals?.sandboxTx ?? 0;
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
    sandboxGMV,
    sandboxTransactions: sandboxTxCount,
    pendingDisbursementsAmount: totalPendingDisbursement,
    pendingDisbursementsCount: pendingCount,
    totalApps,
    totalBuilders,
    totalLicensesIssued: totalActiveLicenses,
    system: {
      nodeEnv: process.env.NODE_ENV || "development",
      bunVersion: typeof Bun !== "undefined" ? Bun.version : process.version,
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
}
