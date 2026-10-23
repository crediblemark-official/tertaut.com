import { db } from "../../db";
import { transactions, apps } from "../../db/schema";
import { eq, or } from "drizzle-orm";
import { fulfillPaymentTransaction } from "../webhook/fulfill";
import type { WebhookSimpleContext } from "../webhook/types";

/**
 * Webhook callback handler khusus simulasi pembayaran internal Tertaut Sandbox.
 * Endpoint ini memungkinkan sistem pengujian memicu pelunasan transaksi sandbox tanpa uang riil.
 *
 * GUARD KEAMANAN:
 * - Menolak keras (403) jika transaksi atau aplikasi ber-mode LIVE.
 */
export async function handleSandboxPaymentWebhook({ body, set }: WebhookSimpleContext) {
  try {
    const transactionId = body?.transactionId || body?.id || body?.externalId;
    if (!transactionId) {
      set.status = 400;
      return { success: false, error: "transactionId wajib disertakan" };
    }

    const tx = await db.query.transactions.findFirst({
      where: or(
        eq(transactions.id, transactionId),
        eq(transactions.xenditExternalId, transactionId)
      ),
    });

    if (!tx) {
      set.status = 404;
      return { success: false, error: "Transaksi sandbox tidak ditemukan" };
    }

    // PROTEKSI KEAMANAN:
    // Pastikan transaksi BENAR-BENAR ber-mode sandbox.
    // Transaksi riil (live) mutlak dilarang dilunasi melalui webhook simulasi sandbox!
    const app = await db.query.apps.findFirst({ where: eq(apps.id, tx.appId) });
    const isSandboxTx =
      tx.mode === "sandbox" && app?.mode === "sandbox" && tx.paymentProvider === "sandbox";

    if (!isSandboxTx) {
      set.status = 403;
      return {
        success: false,
        error:
          "Operasi ditolak: Transaksi ini adalah transaksi LIVE dan tidak dapat disimulasikan.",
      };
    }

    if (tx.paymentStatus === "PAID") {
      return { success: true, message: "Transaksi sudah lunas sebelumnya" };
    }

    await fulfillPaymentTransaction(tx, tx.paymentChannel || "SANDBOX_SIMULATOR");

    return {
      success: true,
      message: "Webhook simulasi sandbox berhasil diproses",
      transactionId: tx.id,
      status: "PAID",
    };
  } catch (err: any) {
    console.error("[SandboxWebhook Error]:", err);
    set.status = 500;
    return { success: false, error: err?.message || "Internal server error" };
  }
}
