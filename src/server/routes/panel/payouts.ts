import { db } from "../../db";
import { transactions, builders, apps } from "../../db/schema";
import { eq, and, inArray, desc, sql } from "drizzle-orm";
import { DanaService } from "../../services/dana";
import { config } from "../../config";

/**
 * Eksekusi Batch Payout Massal ke Seluruh Builder
 */
export async function handleBatchPayout() {
  // Hanya transaksi dari aplikasi mode LIVE yang boleh dicairkan.
  // Transaksi sandbox adalah simulasi dan tidak pernah dikirim ke Xendit.
  const liveAppRows = await db.select({ id: apps.id }).from(apps).where(eq(apps.mode, "live"));
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

    const bankInfo = DanaService.resolveDisbursementAccount(builder);
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

    // Atomic lock using conditional UPDATE to prevent double disbursement race conditions
    const txIds = txs.map((t) => t.id);
    const lockedRows = await db
      .update(transactions)
      .set({
        disbursementStatus: "PROCESSING",
        updatedAt: new Date(),
      })
      .where(
        and(
          inArray(transactions.id, txIds),
          eq(transactions.paymentStatus, "PAID"),
          eq(transactions.disbursementStatus, "PENDING")
        )
      )
      .returning();

    if (lockedRows.length === 0) {
      // Already locked or processed by another concurrent request
      continue;
    }

    const lockedNet = lockedRows.reduce((sum, t) => sum + t.netAmount, 0);
    const externalId = `batch_disb_${builderId.substring(0, 8)}_${Date.now()}`;
    try {
      const disb = await DanaService.createDisbursement({
        externalId,
        amount: lockedNet,
        ...bankInfo,
        description: `Batch Payout tertaut.com MoR (${lockedRows.length} txs via DANA)`,
      });

      const finalStatus =
        disb.status === "FAILED"
          ? "FAILED"
          : disb.status === "PENDING"
            ? "PROCESSING"
            : "COMPLETED";

      await db
        .update(transactions)
        .set({
          disbursementStatus: finalStatus,
          disbursementId: disb.external_id || disb.id,
          updatedAt: new Date(),
        })
        .where(
          inArray(
            transactions.id,
            lockedRows.map((r) => r.id)
          )
        );

      totalDisbursedAmount += lockedNet;
      results.push({
        builderId,
        builderName: builder?.name,
        amount: lockedNet,
        disbursementId: disb.id,
        status: finalStatus === "FAILED" ? "FAILED" : "SUCCESS",
      });
    } catch (err: any) {
      // Rollback status to PENDING on unhandled error so it can be retried
      await db
        .update(transactions)
        .set({
          disbursementStatus: "PENDING",
          updatedAt: new Date(),
        })
        .where(
          inArray(
            transactions.id,
            lockedRows.map((r) => r.id)
          )
        );

      results.push({
        builderId,
        builderName: builder?.name,
        amount: lockedNet,
        error: err.message,
        status: "FAILED",
      });
    }
  }

  const successfulCount = results.filter((r) => r.status === "SUCCESS").length;
  if (totalDisbursedAmount > 0) {
    const { NotifierService } = await import("../../services/notifier");
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
