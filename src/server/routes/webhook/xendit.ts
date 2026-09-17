import { db } from "../../db";
import { transactions, licenses } from "../../db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { XenditService } from "../../services/xendit";
import { enforceRateLimit } from "../../services/rateLimiter";
import { fulfillPaymentTransaction } from "./fulfill";

/**
 * Handler untuk Xendit Invoice webhook (Idempotent & Secured)
 */
export async function handleXenditInvoiceWebhook({ request, headers, body, set }: any) {
  const rl = enforceRateLimit(request, "webhook:xendit", 120, 60_000);
  if (!rl.allowed) {
    set.status = 429;
    return { error: "Too many webhook requests" };
  }

  const callbackToken = headers["x-callback-token"];
  if (!XenditService.verifyWebhook(callbackToken)) {
    set.status = 401;
    return { error: "Invalid callback verification token" };
  }

  const {
    id: xenditInvoiceId,
    external_id: externalId,
    status,
    payment_channel,
    payment_method,
  } = body as {
    id?: string;
    external_id?: string;
    status?: string;
    payment_channel?: string;
    payment_method?: string;
  };

  if (!externalId && !xenditInvoiceId) {
    set.status = 400;
    return { error: "Missing external_id or id" };
  }

  // Lookup transaksi via externalId atau invoiceId
  let tx = externalId
    ? await db.query.transactions.findFirst({
        where: eq(transactions.xenditExternalId, externalId),
      })
    : null;

  if (!tx && xenditInvoiceId) {
    tx = await db.query.transactions.findFirst({
      where: eq(transactions.xenditInvoiceId, xenditInvoiceId),
    });
  }

  if (!tx) {
    set.status = 404;
    return { error: "Transaction not found" };
  }

  if (status === "PAID") {
    const channel = payment_method || payment_channel || "QRIS";
    return await fulfillPaymentTransaction(tx, channel);
  }

  // EXPIRED/FAILED adalah status terminal. Jangan turunkan transaksi yang sudah
  // PAID, dan jangan biarkan transaksi gagal tersangkut PENDING selamanya.
  if (status === "EXPIRED" || status === "FAILED") {
    // Cabut lisensi jika ada yang sempat aktif sebelum pembayaran dibatalkan/kedaluwarsa
    await db
      .update(licenses)
      .set({ status: "REVOKED", updatedAt: new Date() })
      .where(and(eq(licenses.transactionId, tx.id), eq(licenses.status, "ACTIVE")));

    await db
      .update(transactions)
      .set({
        paymentStatus: status,
        updatedAt: new Date(),
      })
      .where(and(eq(transactions.id, tx.id), eq(transactions.paymentStatus, "PENDING")));
  }

  return { received: true, status };
}

/**
 * Handler untuk Xendit Disbursement/Payout callback. Menutup payout yang tadinya
 * PROCESSING agar tidak menggantung selamanya bila gateway selesai/gagal asinkron.
 */
export async function handleXenditDisbursementWebhook({ headers, body, set }: any) {
  const callbackToken = headers["x-callback-token"];
  if (!XenditService.verifyWebhook(callbackToken)) {
    set.status = 401;
    return { error: "Invalid callback verification token" };
  }

  const { id, external_id: externalId, status } = (body || {}) as {
    id?: string;
    external_id?: string;
    status?: string;
  };

  if (!id && !externalId) {
    set.status = 400;
    return { error: "Missing disbursement id or external_id" };
  }

  const target =
    (id
      ? await db.query.transactions.findFirst({
          where: eq(transactions.disbursementId, id),
        })
      : null) ||
    (externalId
      ? await db.query.transactions.findFirst({
          where: eq(transactions.xenditExternalId, externalId),
        })
      : null);

  if (!target) {
    set.status = 404;
    return { error: "Disbursement transaction not found" };
  }

  const normalized = String(status || "").toUpperCase();
  const nextStatus =
    normalized === "COMPLETED" || normalized === "SUCCEEDED"
      ? "COMPLETED"
      : normalized === "FAILED" || normalized === "REVERSED" || normalized === "CANCELLED"
        ? "FAILED"
        : null;

  // Hanya finalkan payout yang masih berjalan; jangan timpa status terminal.
  if (nextStatus) {
    await db
      .update(transactions)
      .set({ disbursementStatus: nextStatus, updatedAt: new Date() })
      .where(
        and(
          eq(transactions.id, target.id),
          inArray(transactions.disbursementStatus, ["PROCESSING", "PENDING"])
        )
      );
  }

  return { received: true, status: normalized };
}
