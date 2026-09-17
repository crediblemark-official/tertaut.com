/**
 * Client API Client untuk tertaut.com Engine
 */

import type { AppItem, DashboardStats } from '../types/app'
import type { TransactionItem } from '../types/transaction'
import type { LicenseItem } from '../types/licensing'
import type { VaultCredentialItem, AiProxyLogItem, AiQuotaStatus } from '../types/aiproxy'
import type { PanelStats, PanelBuilderItem, PanelTransactionItem } from '../types/panel'
import type { CouponItem } from '../types/coupon'
export type {
  AppItem,
  DashboardStats,
  TransactionItem,
  LicenseItem,
  VaultCredentialItem,
  AiProxyLogItem,
  AiQuotaStatus,
  PanelStats,
  PanelBuilderItem,
  PanelTransactionItem,
  CouponItem
}
import { dashboardEnv } from './environment'

/** Sisipkan filter environment dashboard (mode) ke URL endpoint data. */
function withMode(path: string): string {
  const separator = path.includes('?') ? '&' : '?'
  return `${path}${separator}mode=${dashboardEnv.value}`
}

export class ApiError extends Error {
  status: number
  data?: any

  constructor(status: number, message: string, data?: any) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.data = data
  }
}

/**
 * Parse respons JSON dengan tipe terdefinisi.
 * Melempar ApiError jika res.ok === false agar try/catch menangkap error HTTP.
 */
async function parseJson<T = any>(res: Response): Promise<T> {
  const text = await res.text()
  let data: any = {}
  if (text.trim()) {
    try {
      data = JSON.parse(text)
    } catch {
      data = { error: `HTTP ${res.status}: respons bukan format JSON valid` }
    }
  }

  if (!res.ok) {
    const errorMsg =
      (typeof data === 'object' && (data?.error || data?.message)) ||
      `Permintaan gagal dengan status HTTP ${res.status}`
    throw new ApiError(res.status, errorMsg, data)
  }

  return data as T
}

export const api = {
  async getHealth() {
    const res = await fetch("/api/v1/health");
    return parseJson(res);
  },

  async getApps(): Promise<{ apps: AppItem[] }> {
    const res = await fetch(withMode("/api/v1/apps"));
    return parseJson(res);
  },

  async getStats(): Promise<DashboardStats> {
    const res = await fetch(withMode("/api/v1/apps/stats/overview"));
    return parseJson(res);
  },

  async checkSlugAvailability(slug: string): Promise<{ slug: string; available: boolean }> {
    const res = await fetch(`/api/v1/apps/check-slug/${slug}`);
    return parseJson(res);
  },

  async createCampaign(data: Partial<AppItem>): Promise<{ success: boolean; app: AppItem; error?: string }> {
    const res = await fetch("/api/v1/apps", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return parseJson(res);
  },

  async updateCampaign(appId: string, data: Partial<AppItem>): Promise<{ success: boolean; app: AppItem; error?: string }> {
    const res = await fetch(`/api/v1/apps/${appId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return parseJson(res);
  },

  async deleteCampaign(appId: string): Promise<{ success: boolean; message?: string }> {
    const res = await fetch(`/api/v1/apps/${appId}`, {
      method: "DELETE",
    });
    return parseJson(res);
  },

  // Aliases for convenience
  async createApp(data: Partial<AppItem>) {
    return this.createCampaign(data);
  },

  async updateApp(appId: string, data: Partial<AppItem>) {
    return this.updateCampaign(appId, data);
  },

  async checkSlug(slug: string) {
    return this.checkSlugAvailability(slug);
  },

  async getAppBySlug(slug: string): Promise<AppItem> {
    const res = await fetch(`/api/v1/apps/by-slug/${slug}`);
    return parseJson<AppItem>(res);
  },

  async previewCoupon(data: {
    appId: string;
    couponCode: string;
    amount: number;
  }): Promise<{
    valid: boolean;
    coupon?: CouponItem;
    discountPercent?: number;
    discountAmount?: number;
    finalAmount?: number;
    message?: string;
    error?: string;
  }> {
    const res = await fetch("/api/v1/checkout/preview-coupon", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return parseJson(res);
  },

  async createCheckoutSession(data: {
    appId: string;
    amount: number;
    customerEmail: string;
    grantDays?: number;
    preferredPaymentChannel?: string;
    redirectUrl?: string;
    couponCode?: string;
  }): Promise<{
    success: boolean;
    transactionId?: string;
    checkoutUrl?: string;
    error?: string;
  }> {
    const res = await fetch("/api/v1/checkout/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return parseJson(res);
  },

  async getTransactions(appId?: string): Promise<{ success: boolean; transactions: TransactionItem[] }> {
    const url = appId ? `/api/v1/checkout/transactions?appId=${appId}` : withMode("/api/v1/checkout/transactions");
    const res = await fetch(url);
    return parseJson(res);
  },

  async disburseTransaction(txId: string) {
    const res = await fetch(`/api/v1/checkout/disburse/${txId}`, {
      method: "POST",
    });
    return parseJson(res);
  },

  async simulatePayment(txId: string): Promise<{ success: boolean; message: string; licenseKey?: string }> {
    const res = await fetch(`/api/v1/checkout/simulate-paid/${txId}`, {
      method: "POST",
    });
    return parseJson(res);
  },

  async triggerPayout(amount?: number) {
    const res = await fetch("/api/v1/payouts/trigger", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount, mode: dashboardEnv.value }),
    });
    return parseJson(res);
  },

  async getLicenses(appId?: string): Promise<{ success: boolean; licenses: LicenseItem[] }> {
    const url = appId ? `/api/v1/license/list?appId=${appId}` : withMode("/api/v1/license/list");
    const res = await fetch(url);
    return parseJson(res);
  },

  async issueLicense(data: {
    appId: string;
    customerEmail: string;
    grantDays?: number;
    maxSeats?: number;
    platform?: string;
  }) {
    const res = await fetch("/api/v1/license/issue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return parseJson(res);
  },

  async revokeLicense(licenseKey: string) {
    const res = await fetch("/api/v1/license/revoke", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ licenseKey }),
    });
    return parseJson(res);
  },

  async unbindHardware(licenseKey: string) {
    const res = await fetch("/api/v1/license/unbind-hardware", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ licenseKey }),
    });
    return parseJson(res);
  },

  async validateLicense(data: { licenseKey: string; appId: string; hardwareId?: string }) {
    const res = await fetch("/api/v1/license/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return parseJson(res);
  },

  async activateLicense(data: {
    licenseKey: string;
    appId: string;
    hwid: string;
    deviceName?: string;
  }) {
    const res = await fetch("/api/v1/licensing/activate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return parseJson(res);
  },

  async verifyLicense(data: { licenseKey: string; hwid?: string }) {
    const res = await fetch("/api/v1/licensing/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return parseJson(res);
  },

  async deactivateLicense(data: { licenseKey: string; hwid: string }) {
    const res = await fetch("/api/v1/licensing/deactivate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return parseJson(res);
  },

  async getAiVault(appId: string): Promise<{ success: boolean; credentials: VaultCredentialItem[] }> {
    const res = await fetch(`/api/v1/ai-proxy/vault/${appId}`);
    return parseJson(res);
  },

  async saveAiVault(data: {
    appId: string;
    provider: "openai" | "anthropic" | "gemini";
    rawApiKey: string;
    monthlyBudgetLimit?: number;
  }) {
    const res = await fetch("/api/v1/ai-proxy/vault", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return parseJson(res);
  },

  async toggleAiKillSwitch(data: { appId: string; provider: "openai" | "anthropic" | "gemini" }) {
    const res = await fetch("/api/v1/ai-proxy/vault/toggle-kill-switch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return parseJson(res);
  },

  async getAiProxyLogs(appId: string): Promise<{ success: boolean; logs: AiProxyLogItem[] }> {
    const res = await fetch(`/api/v1/ai-proxy/logs/${appId}`);
    return parseJson(res);
  },

  async testAiProxy(data: { licenseKey: string; appId: string; prompt: string; provider?: string; modelAlias?: string; stream?: boolean }) {
    const res = await fetch("/api/v1/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return parseJson(res);
  },

  async getAiQuotaStatus(licenseKey: string, modelAlias = "default"): Promise<{ success: boolean; data: AiQuotaStatus; error?: string; message?: string }> {
    const res = await fetch(`/api/v1/ai/quota-status?licenseKey=${encodeURIComponent(licenseKey)}&modelAlias=${encodeURIComponent(modelAlias)}`);
    return parseJson(res);
  },

  async streamAiChat(
    data: { licenseKey: string; appId?: string; modelAlias?: string; prompt: string },
    onChunk: (text: string) => void
  ): Promise<void> {
    const res = await fetch("/api/v1/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data, stream: true }),
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({} as any));
      throw new Error(errJson.message || errJson.error || `Gagal streaming AI (HTTP ${res.status}).`);
    }

    if (!res.body) return;
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let done = false;

    while (!done) {
      const { value, done: readerDone } = await reader.read();
      done = readerDone;
      if (value) {
        const text = decoder.decode(value);
        const lines = text.split("\n");
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const rawData = line.slice(6).trim();
            if (rawData === "[DONE]") return;
            try {
              const parsed = JSON.parse(rawData);
              const deltaContent = parsed.choices?.[0]?.delta?.content;
              if (deltaContent) {
                onChunk(deltaContent);
              }
            } catch {
              // Non-json or raw text chunk
            }
          }
        }
      }
    }
  },

  async convertToLiveLaunch(data: {
    campaignId: string;
    discountPercent?: number;
    couponCode?: string;
  }) {
    const res = await fetch("/api/v1/launch/convert-to-live", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return parseJson(res);
  },

  async getWidgetBadge(appSlug: string) {
    const res = await fetch(`/api/v1/widgets/badge/${appSlug}`);
    return parseJson(res);
  },

  // Coupons (Modul 1: Monetization)
  async getCoupons(appId?: string): Promise<{ success: boolean; count: number; coupons: CouponItem[]; error?: string }> {
    const url = appId ? `/api/v1/coupons?appId=${encodeURIComponent(appId)}` : withMode("/api/v1/coupons");
    const res = await fetch(url);
    return parseJson(res);
  },

  async createCoupon(data: {
    appId: string;
    code: string;
    discountPercent: number;
    maxRedemptions?: number;
    expiresAt?: string;
  }): Promise<{ success: boolean; coupon?: CouponItem; error?: string }> {
    const res = await fetch("/api/v1/coupons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return parseJson(res);
  },

  async updateCoupon(
    couponId: string,
    data: { isActive?: boolean; maxRedemptions?: number }
  ): Promise<{ success: boolean; coupon?: CouponItem; error?: string }> {
    const res = await fetch(`/api/v1/coupons/${couponId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return parseJson(res);
  },

  async deleteCoupon(couponId: string): Promise<{ success: boolean; message?: string; error?: string }> {
    const res = await fetch(`/api/v1/coupons/${couponId}`, {
      method: "DELETE",
    });
    return parseJson(res);
  },

  async getCouponStats(days = 7, appId?: string): Promise<{
    success: boolean;
    days: number;
    totalRedemptions: number;
    totalDiscountIdr: number;
    daily: { day: string; redemptions: number; totalDiscount: number; totalGross: number }[];
    topCoupons: { code: string | null; redemptions: number; totalDiscount: number }[];
    error?: string;
  }> {
    const params = new URLSearchParams({ days: String(days) });
    if (appId) params.append("appId", appId);
    else params.append("mode", dashboardEnv.value);
    const res = await fetch(`/api/v1/coupons/stats?${params.toString()}`);
    return parseJson(res);
  },

  // Super Admin Panel
  async getPanelStats(): Promise<{ success: boolean; data: PanelStats; error?: string }> {
    const res = await fetch("/api/v1/panel/stats");
    return parseJson(res);
  },

  async getPanelBuilders(): Promise<{ success: boolean; count: number; builders: PanelBuilderItem[]; error?: string }> {
    const res = await fetch("/api/v1/panel/builders");
    return parseJson(res);
  },

  async getPanelTransactions(limit = 100, status?: string): Promise<{ success: boolean; count: number; transactions: PanelTransactionItem[]; error?: string }> {
    const query = new URLSearchParams();
    if (limit) query.append("limit", limit.toString());
    if (status) query.append("status", status);
    const res = await fetch(`/api/v1/panel/transactions?${query.toString()}`);
    return parseJson(res);
  },

  async triggerBatchPayout(): Promise<{ success: boolean; message: string; processedCount: number; totalDisbursed: number; details: any[]; error?: string }> {
    const res = await fetch("/api/v1/panel/payouts/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    return parseJson(res);
  },
};

