import { db } from "../../db";
import { transactions } from "../../db/schema";
import { eq, and, or, inArray } from "drizzle-orm";
import { DanaService } from "../../services/dana";
import { config } from "../../config";
import { enforceRateLimit } from "../../services/rateLimiter";
import { fulfillPaymentTransaction } from "./fulfill";

/**
 * Handler untuk DANA Finish Notify API (Finish Payment URL)
 */
export async function handleDanaFinishPaymentWebhook({ request, headers, body, set }: any) {
  const rl = enforceRateLimit(request, "webhook:dana:finish", 120, 60_000);
  if (!rl.allowed) {
    set.status = 429;
    return { responseCode: "4295600", responseMessage: "Too many requests" };
  }

  // DANA sandbox sometimes sends body as a JSON string (double-encoded).
  // Parse it to an object if that's the case.
  let raw = body || {};
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      console.warn("[DanaWebhook] Failed to parse string body:", raw.substring(0, 200));
      raw = {};
    }
  }

  // Legacy DANA Enterprise format wraps everything under request.body
  // Flatten so we can access fields uniformly.
  const data = (raw?.request?.body ? { ...raw.request.body, _legacy: true } : raw) as any;

  // *** Verifikasi signature WAJIB dilakukan SEBELUM memproses skenario apa pun ***
  // (termasuk branch UAT) supaya webhook palsu tidak bisa mengeksploitasi jalur
  // pengujian sandbox — BUG-3.
  const webhookMethod = request?.method || "POST";
  const webhookPath = request?.url ? new URL(request.url).pathname : "/v1.0/debit/notify";
  if (!DanaService.verifyWebhook(headers, body, { method: webhookMethod, path: webhookPath })) {
    set.status = 401;
    return {
      responseCode: "4015600",
      responseMessage: "Unauthorized",
    };
  }

  if (config.isSandbox) {
    console.log(`[DanaWebhook] Incoming /v1.0/debit/notify (sandbox)`);
  }

  // --- DANA UAT Scenarios (HANYA AKTIF DI SANDBOX) ---
  // Skenario pengujian UAT tidak boleh menginterupsi transaksi riil di production.
  if (config.isSandbox) {
    const rawAmtVal =
      data?.amount?.value || data?.transAmount?.value || data?.orderAmount?.value || "0";
    const amountVal = Math.round(parseFloat(rawAmtVal));
    if (amountVal === 11012) {
      set.status = 500;
      return {
        responseCode: "5005601",
        responseMessage: "Internal Server Error",
      };
    }

    if (amountVal === 11011) {
      set.status = 200;
      return {
        responseCode: "2005600",
        responseMessage: "Successful",
      };
    }
  }

  // Deteksi format notifikasi: SNAP BI (punya latestTransactionStatus) atau legacy DANA Enterprise
  const isSnapBi = data?.latestTransactionStatus !== undefined;

  // Ekstrak identifier order (mendukung standar DANA Enterprise & SNAP BI)
  const externalId =
    data?.partnerReferenceNo ||
    data?.merchantTransId ||
    data?.order?.merchantTransId ||
    data?.originalPartnerReferenceNo ||
    data?.externalId ||
    data?.external_id;

  const orderId =
    data?.acquirementId || data?.order?.acquirementId || data?.orderId || data?.originalReferenceNo;

  // SNAP BI memakai kode status: "00" = sukses, "05"/"06" = kedaluwarsa/gagal.
  // Legacy memakai label teks (SUCCESS, EXPIRED, dst).
  const snapStatus = isSnapBi ? String(data?.latestTransactionStatus) : "";
  const rawStatus = (
    data?.orderStatus ||
    data?.status ||
    data?.order?.orderStatus ||
    ""
  ).toUpperCase();

  const isSuccess = isSnapBi
    ? snapStatus === "00"
    : rawStatus === "SUCCESS" || rawStatus === "FINISHED" || rawStatus === "PAID";

  const isExpired = isSnapBi
    ? snapStatus === "05" || snapStatus === "06"
    : rawStatus === "EXPIRED" ||
      rawStatus === "CLOSED" ||
      rawStatus === "FAILED" ||
      rawStatus === "CANCELLED";

  // Ack standar yang diharapkan DANA untuk finish notify
  const snapBiAck = {
    responseCode: "2005600",
    responseMessage: "Successful",
  };

  if (!externalId && !orderId) {
    if (!config.isProd)
      console.warn(`[DanaWebhook] No transaction identifier found, acknowledging`);
    return snapBiAck;
  }

  // Cari transaksi
  let tx = externalId
    ? await db.query.transactions.findFirst({
        where: or(
          eq(transactions.xenditExternalId, externalId),
          eq(transactions.providerReferenceId, externalId)
        ),
      })
    : null;

  if (!tx && orderId) {
    tx = await db.query.transactions.findFirst({
      where: or(
        eq(transactions.providerReferenceId, orderId),
        eq(transactions.xenditInvoiceId, orderId)
      ),
    });
  }

  if (!tx) {
    if (!config.isProd)
      console.warn(
        `[DanaWebhook] Transaction ${externalId || orderId} not found in DB. Acknowledging.`
      );
    return snapBiAck;
  }

  const paymentChannel =
    data?.payOptionInfos?.[0]?.payMethod ||
    data?.paymentMethod ||
    data?.paymentChannel ||
    "DANA_WALLET";

  if (isSuccess) {
    // Rekonsiliasi nominal (BUG-2): webhook tidak boleh mem-fully pay transaksi dengan
    // nominal yang tidak cocok (atau tanpa info nominal). DANA selalu menyertakan
    // amount pada finish notify; forged webhook tanpa verifikasi ini dulu bisa
    // mengubah transaksi 50rb menjadi PAID hanya dengan status "00".
    const amountPresent =
      data?.amount?.value !== undefined ||
      data?.transAmount?.value !== undefined ||
      data?.orderAmount?.value !== undefined ||
      data?.amount !== undefined;

    const rawAmountValue =
      data?.amount?.value ?? data?.transAmount?.value ?? data?.orderAmount?.value ?? data?.amount;
    const paidAmount = Number.isFinite(Number(rawAmountValue))
      ? Math.round(Number(rawAmountValue))
      : NaN;

    // Transaksi yang masih PENDING: nominal Wajib cocok dengan grossAmount.
    if (
      tx.paymentStatus === "PENDING" &&
      (!amountPresent || !Number.isFinite(paidAmount) || paidAmount !== tx.grossAmount)
    ) {
      if (!config.isProd) {
        console.warn(
          `[DanaWebhook] Amount mismatch: paid=${String(rawAmountValue)} (${paidAmount}) vs expected=${tx.grossAmount} (${externalId || orderId}) — tidak mem-fulfill.`
        );
      }
      return isSnapBi
        ? snapBiAck
        : { status: "error", message: "AMOUNT_MISMATCH", transactionId: tx.id };
    }

    const result = await fulfillPaymentTransaction(tx, paymentChannel);
    // SNAP BI hanya menerima field ack; legacy mempertahankan payload kaya (status & licenseKey).
    return isSnapBi ? snapBiAck : result;
  }

  if (isExpired) {
    const nextStatus = isSnapBi
      ? snapStatus === "05"
        ? "EXPIRED"
        : "FAILED"
      : rawStatus === "EXPIRED"
        ? "EXPIRED"
        : "FAILED";

    // Jangan menurunkan transaksi yang sudah PAID (webhook telat/duplikat).
    await db
      .update(transactions)
      .set({ paymentStatus: nextStatus, updatedAt: new Date() })
      .where(and(eq(transactions.id, tx.id), eq(transactions.paymentStatus, "PENDING")));
  }

  return snapBiAck;
}

/**
 * Handler untuk DANA Disburse to Bank Notify API
 */
export async function handleDanaDisburseNotifyWebhook({ request, headers, body, set }: any) {
  const rl = enforceRateLimit(request, "webhook:dana:disburse", 120, 60_000);
  if (!rl.allowed) {
    set.status = 429;
    return { error: "Too many requests" };
  }

  const webhookMethod = request?.method || "POST";
  const webhookPath = request?.url
    ? new URL(request.url).pathname
    : "/v1.0/emoney/transfer-bank-notify.htm";
  if (!DanaService.verifyWebhook(headers, body, { method: webhookMethod, path: webhookPath })) {
    set.status = 401;
    return { error: "Invalid Webhook Signature" };
  }

  const data = (body || {}) as any;
  const partnerReferenceNo = data?.partnerReferenceNo || data?.externalId || data?.merchantTransId;

  const rawStatus = (
    data?.status ||
    data?.transactionStatus ||
    data?.latestTransactionStatus ||
    ""
  ).toUpperCase();

  const isCompleted = rawStatus === "SUCCESS" || rawStatus === "COMPLETED" || rawStatus === "00";

  const isPending =
    rawStatus === "PENDING" || rawStatus === "PROCESSING" || rawStatus === "IN_PROGRESS";

  // Hanya status terminal yang mengubah ledger; status pending diabaikan.
  if (partnerReferenceNo && !isPending) {
    await db
      .update(transactions)
      .set({
        disbursementStatus: isCompleted ? "COMPLETED" : "FAILED",
        updatedAt: new Date(),
      })
      .where(
        and(
          or(
            eq(transactions.xenditExternalId, partnerReferenceNo),
            eq(transactions.providerReferenceId, partnerReferenceNo)
          ),
          inArray(transactions.disbursementStatus, ["PROCESSING", "PENDING"])
        )
      );
  }

  return {
    responseCode: "2002900",
    responseMessage: "Successful",
    status: isCompleted ? "COMPLETED" : "PROCESSED",
  };
}
