import { db } from "../../db";
import { apps, transactions, builders } from "../../db/schema";
import { eq, and } from "drizzle-orm";
import { resolveCurrentBuilder } from "./builder";

/**
 * Eksekusi Pencairan Otomatis (Disbursement 95% net) via Xendit
 */
export async function handleDisburse({
  params: { transactionId },
  set,
  request: { headers },
}: any) {
  const { builder: authBuilder, isAdmin } = await resolveCurrentBuilder(headers);
  const tx = await db.query.transactions.findFirst({
    where: eq(transactions.id, transactionId),
  });

  if (!tx) {
    set.status = 404;
    return { error: "Transaction not found" };
  }

  // Fix: tanpa profil builder (dan bukan admin) pemanggil tidak boleh mencairkan
  // transaksi siapa pun — sebelumnya guard loncat total saat authBuilder null.
  if (!isAdmin && !authBuilder) {
    set.status = 403;
    return { error: "Forbidden: Profil builder tidak ditemukan untuk akun Anda." };
  }

  if (authBuilder && tx.builderId !== authBuilder.id && !isAdmin) {
    set.status = 403;
    return { error: "Forbidden: Anda tidak memiliki hak akses mencairkan transaksi ini" };
  }

  if (tx.paymentStatus !== "PAID") {
    set.status = 400;
    return { error: "Cannot disburse unpaid transaction" };
  }

  if (tx.disbursementStatus === "COMPLETED" || tx.disbursementStatus === "PROCESSING") {
    set.status = 400;
    return { error: "Pencairan sudah selesai atau sedang dalam proses" };
  }

  // Transaksi dari aplikasi sandbox hanyalah simulasi — tidak boleh dicairkan ke rekening asli.
  const txApp = await db.query.apps.findFirst({ where: eq(apps.id, tx.appId) });
  if (txApp?.mode === "sandbox") {
    set.status = 400;
    return {
      error: "Transaksi sandbox (simulasi) tidak dapat dicairkan. Cairkan hanya transaksi live.",
    };
  }

  // Atomic lock using conditional UPDATE to prevent double disbursement race condition
  const locked = await db
    .update(transactions)
    .set({
      disbursementStatus: "PROCESSING",
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(transactions.id, tx.id),
        eq(transactions.paymentStatus, "PAID"),
        eq(transactions.disbursementStatus, "PENDING")
      )
    )
    .returning();

  if (!locked.length) {
    set.status = 409;
    return { error: "Pencairan sedang diproses oleh permintaan lain" };
  }

  const builder = await db.query.builders.findFirst({
    where: eq(builders.id, tx.builderId),
  });

  const { DanaService } = await import("../../services/dana");
  const recipient = DanaService.resolveDisbursementAccount(builder);

  // Production TANPA rekening tersimpan → tolak pencairan (jangan pakai data palsu)
  if (!recipient) {
    set.status = 400;
    return {
      error:
        "Builder belum menyimpan rekening penerima disbursement. Lengkapi profil bank/e-wallet terlebih dahulu.",
    };
  }

  try {
    const payoutResult = await DanaService.createDisbursement({
      externalId: `disb_${tx.id}_${Date.now()}`,
      amount: tx.netAmount,
      ...recipient,
      description: `Pencairan 95% Net Transaksi ${tx.id} (DANA)`,
    });

    const finalStatus =
      payoutResult.status === "FAILED"
        ? "FAILED"
        : payoutResult.status === "PENDING"
          ? "PROCESSING"
          : "COMPLETED";

    await db
      .update(transactions)
      .set({
        disbursementStatus: finalStatus,
        disbursementId: payoutResult.id,
        updatedAt: new Date(),
      })
      .where(eq(transactions.id, tx.id));

    return {
      success: true,
      transactionId: tx.id,
      disbursedAmount: tx.netAmount,
      payoutDetails: payoutResult,
    };
  } catch (err: any) {
    // Rollback status to PENDING on unhandled exception so builder can retry
    await db
      .update(transactions)
      .set({
        disbursementStatus: "PENDING",
        updatedAt: new Date(),
      })
      .where(eq(transactions.id, tx.id));

    set.status = 500;
    return { error: err.message || "Gagal memproses pencairan dana" };
  }
}
