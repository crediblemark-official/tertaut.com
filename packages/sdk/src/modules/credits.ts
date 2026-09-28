/**
 * Modul Kredit: saldo, konsumsi idempoten, riwayat ledger lisensi,
 * serta pelaporan pemakaian terukur (metered usage).
 */

import type {
  TertautExecutor,
  CreditBalanceOptions,
  CreditBalanceResult,
  CreditConsumeOptions,
  CreditConsumeResult,
  CreditHistoryOptions,
  CreditHistoryResult,
} from "../types";

export interface CreditsExecutor extends TertautExecutor {}

export class CreditsModule {
  constructor(private ctx: CreditsExecutor) {}

  public async balance(options: CreditBalanceOptions): Promise<CreditBalanceResult> {
    return this.ctx.requestJson<CreditBalanceResult>("/api/v1/licensing/credits/balance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        licenseKey: options.licenseKey,
        hwid: options.hwid,
      }),
    });
  }

  public async consume(options: CreditConsumeOptions): Promise<CreditConsumeResult> {
    return this.ctx.requestJson<CreditConsumeResult>("/api/v1/licensing/credits/consume", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        licenseKey: options.licenseKey,
        hwid: options.hwid,
        amount: options.amount,
        reason: options.reason,
        reference: options.reference,
      }),
    });
  }

  public async history(options: CreditHistoryOptions): Promise<CreditHistoryResult> {
    return this.ctx.requestJson<CreditHistoryResult>("/api/v1/licensing/credits/history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        licenseKey: options.licenseKey,
        hwid: options.hwid,
        limit: options.limit,
      }),
    });
  }

  /**
   * Kirim event penggunaan kredit terukur (metered usage event).
   * Bukti kepemilikan: SDK mengirim `x-api-key` aplikasi secara otomatis.
   * Endpoint ini juga menerima `hwid` perangkat yang sudah teraktivasi.
   */
  public async reportUsage(options: {
    licenseKey: string;
    eventName: string;
    units?: number;
    idempotencyKey?: string;
    metadata?: Record<string, any>;
    hwid?: string;
  }): Promise<any> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    // Hanya publishable key yang dikenali endpoint ini. `tt_secret_` hanya sah
    // untuk Authorization header pada S2S, jadi jangan dikirim sebagai x-api-key.
    if (this.ctx.apiKey && !this.ctx.apiKey.startsWith("tt_secret_")) {
      headers["x-api-key"] = this.ctx.apiKey;
    }
    return this.ctx.requestJson("/api/v1/metering/events", {
      method: "POST",
      headers,
      body: JSON.stringify(options),
    });
  }

  /**
   * Ambil ringkasan penggunaan metered usage untuk lisensi.
   */
  public async getUsage(licenseKey: string): Promise<any> {
    return this.ctx.requestJson(`/api/v1/metering/usage/${encodeURIComponent(licenseKey.trim())}`);
  }
}
