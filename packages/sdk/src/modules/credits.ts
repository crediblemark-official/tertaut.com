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
   */
  public async reportUsage(options: {
    licenseKey: string;
    eventName: string;
    units?: number;
    idempotencyKey?: string;
    metadata?: Record<string, any>;
  }): Promise<any> {
    const res = await this.ctx.request("/api/v1/metering/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
