import { db } from "../../db";
import { transactions, apps, licenses } from "../../db/schema";
import { eq, or } from "drizzle-orm";
import { enforceRateLimitAsync } from "../../services/security/rateLimiter";
import { verifyPollTicket } from "../../utils/pollTicket";
import { fulfillPaymentTransaction } from "../webhook/fulfill";

export interface SimulateSandboxContext {
  body?: {
    transactionId?: string;
    txId?: string;
    ticket?: string;
    scenario?: string;
    failureReason?: string;
    [key: string]: any;
  };
  request?: Request | any;
  set?: { status?: number | string; [key: string]: any };
  [key: string]: any;
}

/**
 * Handler Simulasi Pembayaran Sandbox Tertaut (Testing & UAT).
 *
 * GUARD KEAMANAN KETAT:
 * 1. Menolak jika rate limit terlampaui.
 * 2. Menolak jika tiket otentikasi checkout tidak valid.
 * 3. MENOLAK KERAS jika transaksi atau aplikasi bukan ber-mode "sandbox".
 *    Transaksi LIVE tidak akan pernah bisa dilunasi melalui handler ini.
 */
export async function handleSimulateSandboxPayment({
  body,
  request,
  set = {},
}: SimulateSandboxContext) {
  const rl = await enforceRateLimitAsync(request, "checkout:simulate", 30, 60_000);
  if (!rl.allowed) {
    set.status = 429;
    return { error: "Terlalu banyak permintaan simulasi. Coba lagi sebentar lagi." };
  }

  const { transactionId, ticket } = body || {};
  if (!transactionId) {
    set.status = 400;
    return { error: "transactionId wajib disertakan" };
  }

  const tx = await db.query.transactions.findFirst({
    where: or(eq(transactions.id, transactionId), eq(transactions.xenditExternalId, transactionId)),
  });

  if (!tx) {
    set.status = 404;
    return { error: "Transaksi tidak ditemukan" };
  }

  if (!ticket || !verifyPollTicket(tx.id, ticket)) {
    set.status = 403;
    return { error: "Ticket autentikasi checkout tidak valid" };
  }

  const app = await db.query.apps.findFirst({
    where: eq(apps.id, tx.appId),
  });

  const isSandbox = app?.mode === "sandbox" && tx.mode === "sandbox";

  // HARD GUARD: Dilarang keras mensimulasikan transaksi LIVE
  if (!isSandbox) {
    set.status = 400;
    return {
      error: "Simulasi pembayaran hanya diizinkan untuk produk dalam mode Sandbox (Non-Live).",
      errorCode: "SANDBOX_ONLY_OPERATION",
    };
  }

  if (tx.paymentStatus === "PAID") {
    const lic = await db.query.licenses.findFirst({
      where: eq(licenses.transactionId, tx.id),
    });
    return {
      success: true,
      paymentStatus: "PAID",
      licenseKey: lic?.licenseKey || null,
      message: "Transaksi sudah lunas sebelumnya",
    };
  }

  await fulfillPaymentTransaction(tx, tx.paymentChannel || "VA_BCA");

  const lic = await db.query.licenses.findFirst({
    where: eq(licenses.transactionId, tx.id),
  });

  return {
    success: true,
    paymentStatus: "PAID",
    licenseKey: lic?.licenseKey || null,
    message: "Pembayaran sandbox berhasil diselesaikan (Simulasi Lunas)",
  };
}
