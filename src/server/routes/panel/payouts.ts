import { submitPayout } from "../../services/payments/payouts";
import { db } from "../../db";
import { transactions, builders, apps } from "../../db/schema";
import { eq, and, inArray, desc, sql, ne } from "drizzle-orm";
import { resolveDisbursementAccount } from "../../services/payments/payoutAccount";
import { getActiveGateway } from "../../services/payments/gateways";
import { config } from "../../config";

/**
 * Eksekusi Batch Payout Massal ke Seluruh Builder
 */
export async function handleBatchPayout() {
  const gateway = await getActiveGateway();
  if (gateway.id === "sandbox")
    return {
      success: false,
      error: "Gateway sandbox tidak dapat mencairkan saldo live",
      processedCount: 0,
      totalDisbursed: 0,
      disbursedCount: 0,
      totalAmount: 0,
      details: [],
      payouts: [],
    };
  // Hanya transaksi dari aplikasi mode LIVE yang boleh dicairkan.
  // Transaksi sandbox adalah simulasi dan tidak pernah dikirim ke Xendit.
  const liveAppRows = await db.select({ id: apps.id }).from(apps).where(eq(apps.mode, "live"));
  const liveAppIds = liveAppRows.map((a) => a.id);

  const eligibleTxs = liveAppIds.length
    ? await db.query.transactions.findMany({
        where: and(
          eq(transactions.paymentStatus, "PAID"),
          inArray(transactions.refundStatus, ["NONE", "FAILED"]),
          eq(transactions.mode, "live"),
          ne(transactions.paymentProvider, "sandbox"),
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

    const bankInfo = resolveDisbursementAccount(builder);
    // Production TANPA rekening tersimpan → lewati builder ini (jangan pakai data palsu)
    if (!bankInfo) {
      results.push({
        builderId,
        builderName: builder?.name,
        amount: totalNet,
        status: "SKIPPED",
        error: "Builder belum menyimpan rekening penerima disbursement.",
      });
      continue;
    }

    try {
      const result = await submitPayout({
        transactionIds: txs.map((t) => t.id),
        builderId,
        gateway,
        recipient: bankInfo,
        description: `Batch Payout tertaut.com (${txs.length} txs)`,
      });
      if (result.status === "COMPLETED") totalDisbursedAmount += result.amount;
      results.push({
        builderId,
        builderName: builder?.name,
        amount: result.amount,
        disbursementId: result.id,
        disbursementExternalId: result.externalId,
        status: result.status === "COMPLETED" ? "SUCCESS" : result.status,
      });
    } catch (error) {
      results.push({
        builderId,
        amount: 0,
        status: "FAILED",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const successfulCount = results.filter((r) => r.status === "SUCCESS").length;
  if (totalDisbursedAmount > 0) {
    const { NotifierService } = await import("../../services/notifications/notifier");
    NotifierService.notifyBatchPayout({
      builderCount: successfulCount,
      transactionCount: results.reduce((acc, r) => acc + (r.status === "SUCCESS" ? 1 : 0), 0),
      totalAmount: totalDisbursedAmount,
    }).catch(() => null);
  }

  return {
    success: true,
    message: `Batch payout selesai diproses untuk ${successfulCount} builder.`,
    processedCount: successfulCount,
    totalDisbursed: totalDisbursedAmount,
    totalAmount: totalDisbursedAmount,
    details: results,
    payouts: results,
  };
}
