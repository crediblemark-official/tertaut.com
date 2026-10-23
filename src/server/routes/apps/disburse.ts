import { submitPayout, PayoutConflictError } from "../../services/payments/payouts";
import { db } from "../../db";
import { apps, transactions, builders } from "../../db/schema";
import { eq, and, ne } from "drizzle-orm";
import { resolveCurrentBuilder } from "./builder";
import { getActiveGateway } from "../../services/payments/gateways";
import { resolveDisbursementAccount } from "../../services/payments/payoutAccount";

/**
 * Eksekusi Pencairan Otomatis (Disbursement 95% net) via gateway aktif
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

  const gateway = await getActiveGateway();
  if (gateway.id === "sandbox") {
    set.status = 400;
    return { error: "Gateway sandbox tidak dapat mencairkan saldo live" };
  }

  const txApp = await db.query.apps.findFirst({ where: eq(apps.id, tx.appId) });
  if (tx.mode !== "live" || tx.paymentProvider === "sandbox" || txApp?.mode !== "live") {
    set.status = 400;
    return {
      error: "Transaksi sandbox (simulasi) tidak dapat dicairkan. Cairkan hanya transaksi live.",
    };
  }

  const builder = await db.query.builders.findFirst({
    where: eq(builders.id, tx.builderId),
  });

  const recipient = resolveDisbursementAccount(builder);

  // Production TANPA rekening tersimpan → tolak pencairan (jangan pakai data palsu)
  if (!recipient) {
    set.status = 400;
    return {
      error:
        "Builder belum menyimpan rekening penerima disbursement. Lengkapi profil bank/e-wallet terlebih dahulu.",
    };
  }

  try {
    const result = await submitPayout({
      transactionIds: [tx.id],
      builderId: tx.builderId,
      gateway,
      recipient,
      description: `Pencairan Net Transaksi ${tx.id} (${gateway.displayName})`,
    });
    set.status = result.status === "FAILED" ? 502 : result.status === "COMPLETED" ? 200 : 202;
    return {
      success: result.status !== "FAILED",
      transactionId: tx.id,
      disbursedAmount: result.amount,
      message:
        result.status === "COMPLETED"
          ? "Pencairan selesai"
          : "Pencairan menunggu konfirmasi provider; jangan mengirim ulang",
      payoutDetails: result,
    };
  } catch (error) {
    set.status = error instanceof PayoutConflictError ? 409 : 500;
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}
