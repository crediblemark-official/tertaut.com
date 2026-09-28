/**
 * Webhook handler XenithPay.
 *
 * Dipisah dari `xendit.ts` karena kedua gateway ini tidak ada hubungannya.
 * Sebelumnya `handleXenithPayWebhook` hidup di dalam file Xendit, sehingga
 * menghapus satu gateway berarti harus mengurai file milik gateway lain.
 *
 * Isi handler dipindahkan apa adanya dari `xendit.ts` — tanpa perubahan
 * perilaku, hanya import yang disesuaikan ke file ini.
 */
import { db } from "../../db";
import { transactions } from "../../db/schema";
import { eq } from "drizzle-orm";
import { enforceRateLimit } from "../../services/rateLimiter";
import { fulfillPaymentTransaction } from "./fulfill";

/**
 * Handler untuk XenithPay Payment & Payout callback.
 *
 * Verifikasi signature HMAC dilakukan oleh adapter gateway
 * (`xenithpayGateway.verifyWebhook`); path ikut menjadi bagian dari signature,
 * jadi callback payout dibedakan dari payment callback lewat `isPayout`.
 */
export async function handleXenithPayWebhook({ request, headers, body, set }: any) {
  const rl = enforceRateLimit(request, "webhook:xenithpay", 120, 60_000);
  if (!rl.allowed) {
    set.status = 429;
    return { error: "Too many webhook requests" };
  }

  const reqBody = body && typeof body === "string" ? JSON.parse(body) : body || {};
  const isPayout = new URL(request.url).pathname.endsWith("/xenithpay/payout");
  const timestamp = headers["x-xenith-timestamp"] || headers["X-XENITH-TIMESTAMP"];
  const signature = headers["x-xenith-signature"] || headers["X-XENITH-SIGNATURE"];

  const gateway = await import("../../services/gateways").then((m) => m.xenithpayGateway);
  const isValid = await gateway.verifyWebhook(
    { "x-xenith-timestamp": timestamp, "x-xenith-signature": signature },
    reqBody,
    isPayout ? "/api/v1/webhook/xenithpay/payout" : "/api/v1/webhook/xenithpay"
  );

  if (!isValid) {
    set.status = 401;
    return { error: "Invalid XenithPay webhook signature" };
  }

  const referenceCode =
    reqBody?.referenceCode ||
    reqBody?.reference_code ||
    reqBody?.data?.referenceCode ||
    reqBody?.data?.reference_code ||
    reqBody?.merchantRef ||
    reqBody?.customerReference;

  const status = String(reqBody?.status || reqBody?.data?.status || "").toUpperCase();
  const isPaid = ["PAID", "SUCCESS", "SETTLED", "COMPLETED"].includes(status);

  if (isPayout) {
    const payoutId = reqBody?.id || reqBody?.data?.id;
    const payoutTxId = referenceCode?.match(/^disb_(tx_[^_]+)_\d+$/)?.[1];
    const tx = payoutId
      ? await db.query.transactions.findFirst({ where: eq(transactions.disbursementId, payoutId) })
      : payoutTxId
        ? await db.query.transactions.findFirst({ where: eq(transactions.id, payoutTxId) })
        : undefined;

    if (tx) {
      const disbursementStatus = ["SUCCESS", "COMPLETED"].includes(status)
        ? "COMPLETED"
        : ["FAILED", "CANCELLED", "REFUNDED"].includes(status)
          ? "FAILED"
          : "PROCESSING";
      await db
        .update(transactions)
        .set({
          disbursementStatus,
          ...(payoutId ? { disbursementId: payoutId } : {}),
          updatedAt: new Date(),
        })
        .where(eq(transactions.id, tx.id));
    }
  } else if (referenceCode) {
    const tx = await db.query.transactions.findFirst({
      where: eq(transactions.xenditExternalId, referenceCode),
    });

    if (tx && isPaid) {
      await fulfillPaymentTransaction(tx, "XENITHPAY");
    }
  }

  return { received: true, acknowledged: true, status, referenceCode };
}
