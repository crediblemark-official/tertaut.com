/**
 * Modul Kredit: saldo, konsumsi idempoten, dan riwayat ledger lisensi.
 */

import type {
  CreditBalanceOptions,
  CreditBalanceResult,
  CreditConsumeOptions,
  CreditConsumeResult,
  CreditHistoryOptions,
  CreditHistoryResult,
} from "../types";

export interface CreditsExecutor {
  request: (path: string, init?: RequestInit) => Promise<Response>;
  apiKey?: string;
}

export class CreditsModule {
  constructor(private ctx: CreditsExecutor) {}

  public async balance(options: CreditBalanceOptions): Promise<CreditBalanceResult> {
    const res = await this.ctx.request("/api/v1/licensing/credits/balance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        licenseKey: options.licenseKey,
        hwid: options.hwid,
      }),
    });
    return res.json();
  }

  public async consume(options: CreditConsumeOptions): Promise<CreditConsumeResult> {
    const res = await this.ctx.request("/api/v1/licensing/credits/consume", {
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
    return res.json();
  }

  public async history(options: CreditHistoryOptions): Promise<CreditHistoryResult> {
    const res = await this.ctx.request("/api/v1/licensing/credits/history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        licenseKey: options.licenseKey,
        hwid: options.hwid,
        limit: options.limit,
      }),
    });
    return res.json();
  }

  /**
   * Kirim event penggunaan kredit terukur (metered usage event).
   * Wajib bukti kepemilikan (BUG A5): SDK mengirim `x-api-key` aplikasi secara
   * otomatis; integrasi manual harus menyertakan hwid perangkat teraktivasi.
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
    if (this.ctx.apiKey) headers["x-api-key"] = this.ctx.apiKey;
    const res = await this.ctx.request("/api/v1/metering/events", {
      method: "POST",
      headers,
      body: JSON.stringify(options),
    });
    return res.json();
  }

  /**
   * Ambil ringkasan penggunaan metered usage untuk lisensi.
   */
  public async getUsage(licenseKey: string): Promise<any> {
    const res = await this.ctx.request(
      `/api/v1/metering/usage/${encodeURIComponent(licenseKey.trim())}`
    );
    return res.json();
  }
}
