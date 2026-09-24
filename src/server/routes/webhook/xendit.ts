import { db } from "../../db";
import { transactions, licenses } from "../../db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { XenditService } from "../../services/xendit";
import { enforceRateLimit } from "../../services/rateLimiter";
import { fulfillPaymentTransaction } from "./fulfill";

/**
 * Handler untuk Xendit Invoice webhook (Idempotent & Secured via x-callback-token)
 */
export async function handleXenditInvoiceWebhook({ request, headers, body, set }: any) {
  const rl = enforceRateLimit(request, "webhook:xendit", 120, 60_000);
  if (!rl.allowed) {
    set.status = 429;
    return { error: "Too many webhook requests" };
  }

  const callbackToken =
    headers["x-callback-token"] ||
    headers["X-CALLBACK-TOKEN"] ||
    headers["x-callback-token-header"];

  const isValidToken = await XenditService.verifyWebhook(callbackToken);
  if (!isValidToken) {
    set.status = 401;
    return { error: "Invalid callback verification token" };
  }

  const {
    id: xenditInvoiceId,
    external_id: externalId,
    status,
    payment_channel,
    payment_method,
  } = (body || {}) as {
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

  const normalizedStatus = String(status || "").toUpperCase();

  if (normalizedStatus === "PAID" || normalizedStatus === "SETTLED") {
    const channel = payment_method || payment_channel || "XENDIT";
    const result = await fulfillPaymentTransaction(tx, channel);
    return { success: result.status === "success", ...result };
  }

  // EXPIRED/FAILED adalah status terminal
  if (normalizedStatus === "EXPIRED" || normalizedStatus === "FAILED") {
    await db
      .update(licenses)
      .set({ status: "REVOKED", updatedAt: new Date() })
      .where(and(eq(licenses.transactionId, tx.id), eq(licenses.status, "ACTIVE")));

    await db
      .update(transactions)
      .set({
        paymentStatus: normalizedStatus as any,
        updatedAt: new Date(),
      })
      .where(and(eq(transactions.id, tx.id), eq(transactions.paymentStatus, "PENDING")));
  }

  return { received: true, status: normalizedStatus };
}

/**
 * Handler untuk Xendit Disbursement / Payout callback
 */
export async function handleXenditDisbursementWebhook({ headers, body, set }: any) {
  const callbackToken =
    headers["x-callback-token"] ||
    headers["X-CALLBACK-TOKEN"] ||
    headers["x-callback-token-header"];

  const isValidToken = await XenditService.verifyWebhook(callbackToken);
  if (!isValidToken) {
    set.status = 401;
    return { error: "Invalid callback verification token" };
  }

  const {
    id,
    external_id: externalId,
    status,
  } = (body || {}) as {
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

  if (nextStatus) {
    await db
      .update(transactions)
      .set({ disbursementStatus: nextStatus as any, updatedAt: new Date() })
      .where(
        and(
          eq(transactions.id, target.id),
          inArray(transactions.disbursementStatus, ["PROCESSING", "PENDING"])
        )
      );
  }

  return { received: true, status: normalized };
}
