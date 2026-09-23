import { config } from "../config";

interface PaymentNotificationParams {
  transactionId: string;
  appName: string;
  grossAmount: number;
  customerEmail: string;
  paymentChannel?: string | null;
}

interface RefundNotificationParams {
  transactionId: string;
  appName: string;
  amount: number;
  reason?: string;
  revokedLicenseKey?: string;
}

interface BatchPayoutNotificationParams {
  builderCount: number;
  transactionCount: number;
  totalAmount: number;
}

/**
 * Service Notifikasi Operasional Real-time untuk Founder / Super Admin
 * Mendukung Telegram Bot API dan Generic Webhook URL.
 */
export class NotifierService {
  private static get telegramToken(): string | undefined {
    return process.env.TELEGRAM_BOT_TOKEN;
  }

  private static get telegramChatId(): string | undefined {
    return process.env.TELEGRAM_CHAT_ID;
  }

  private static get webhookUrl(): string | undefined {
    return process.env.ADMIN_ALERT_WEBHOOK_URL;
  }

  private static async sendTelegramMessage(text: string): Promise<boolean> {
    if (!this.telegramToken || !this.telegramChatId) return false;
    try {
      const url = `https://api.telegram.org/bot${this.telegramToken}/sendMessage`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: this.telegramChatId,
          text,
          parse_mode: "Markdown",
          disable_web_page_preview: true,
        }),
      });
      return res.ok;
    } catch (err: any) {
      console.warn("[Notifier] Gagal mengirim pesan Telegram:", err?.message || err);
      return false;
    }
  }

  private static async sendWebhookAlert(payload: Record<string, any>): Promise<boolean> {
    if (!this.webhookUrl) return false;
    try {
      const res = await fetch(this.webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "tertaut.com Engine",
          timestamp: new Date().toISOString(),
          ...payload,
        }),
      });
      return res.ok;
    } catch (err: any) {
      console.warn("[Notifier] Gagal mengirim Webhook alert:", err?.message || err);
      return false;
    }
  }

  /**
   * Kirim notifikasi saat transaksi berhasil dibayar (PAID)
   */
  public static async notifyPaymentSuccess(params: PaymentNotificationParams): Promise<void> {
    const formatted = `Rp ${params.grossAmount.toLocaleString("id-ID")}`;
    const text =
      `💰 *Pembayaran Baru Diterima!*\n\n` +
      `• *Aplikasi:* ${params.appName}\n` +
      `• *Nominal:* \`${formatted}\`\n` +
      `• *Metode:* ${params.paymentChannel || "DANA SNAP BI"}\n` +
      `• *Pembeli:* \`${params.customerEmail}\`\n` +
      `• *TX ID:* \`${params.transactionId}\`\n` +
      `• *Waktu:* ${new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })} WIB`;

    Promise.allSettled([
      this.sendTelegramMessage(text),
      this.sendWebhookAlert({ event: "payment.success", data: params }),
    ]).catch(() => null);
  }

  /**
   * Kirim notifikasi saat pengembalian dana (REFUND) diproses
   */
  public static async notifyRefund(params: RefundNotificationParams): Promise<void> {
    const formatted = `Rp ${params.amount.toLocaleString("id-ID")}`;
    const text =
      `↩️ *Transaksi Di-refund & Lisensi Dicabut!*\n\n` +
      `• *Aplikasi:* ${params.appName}\n` +
      `• *Nominal:* \`${formatted}\`\n` +
      `• *TX ID:* \`${params.transactionId}\`\n` +
      `• *Alasan:* ${params.reason || "Permintaan pembeli / garansi"}\n` +
      `• *Lisensi Dicabut:* \`${params.revokedLicenseKey || "N/A"}\`\n` +
      `• *Waktu:* ${new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })} WIB`;

    Promise.allSettled([
      this.sendTelegramMessage(text),
      this.sendWebhookAlert({ event: "transaction.refunded", data: params }),
    ]).catch(() => null);
  }

  /**
   * Kirim notifikasi saat batch payout massal berhasil dieksekusi
   */
  public static async notifyBatchPayout(params: BatchPayoutNotificationParams): Promise<void> {
    const formatted = `Rp ${params.totalAmount.toLocaleString("id-ID")}`;
    const text =
      `💸 *Batch Payout Sukses Dieksekusi!*\n\n` +
      `• *Total Transfer:* \`${formatted}\`\n` +
      `• *Builder Penerima:* ${params.builderCount} builder\n` +
      `• *Transaksi Dicairkan:* ${params.transactionCount} transaksi\n` +
      `• *Waktu:* ${new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })} WIB`;

    Promise.allSettled([
      this.sendTelegramMessage(text),
      this.sendWebhookAlert({ event: "payout.batch_completed", data: params }),
    ]).catch(() => null);
  }
}
