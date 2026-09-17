/**
 * Client API Client untuk tertaut.com Engine
 */

export * from '../types'
import type {
  AppItem,
  DashboardStats,
  TransactionItem,
  LicenseItem,
  VaultCredentialItem,
  AiProxyLogItem,
  AiQuotaStatus,
  PortalLicenseItem,
  PortalTransactionItem,
  PanelStats,
  PanelBuilderItem,
  PanelTransactionItem,
  CouponItem
} from '../types'
import { dashboardEnv } from './environment'

/** Sisipkan filter environment dashboard (mode) ke URL endpoint data. */
function withMode(path: string): string {
  const separator = path.includes('?') ? '&' : '?'
  return `${path}${separator}mode=${dashboardEnv.value}`
}

export const api = {
  async getHealth() {
    const res = await fetch("/api/v1/health");
    return res.json();
  },

  async getApps(): Promise<{ apps: AppItem[] }> {
    const res = await fetch(withMode("/api/v1/apps"));
    return res.json();
  },

  async getStats(): Promise<DashboardStats> {
    const res = await fetch(withMode("/api/v1/apps/stats/overview"));
    return res.json();
  },

  async checkSlugAvailability(slug: string): Promise<{ slug: string; available: boolean }> {
    const res = await fetch(`/api/v1/apps/check-slug/${slug}`);
    return res.json();
  },

  async createCampaign(data: Partial<AppItem>): Promise<{ success: boolean; app: AppItem; error?: string }> {
    const res = await fetch("/api/v1/apps", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async updateCampaign(appId: string, data: Partial<AppItem>): Promise<{ success: boolean; app: AppItem; error?: string }> {
    const res = await fetch(`/api/v1/apps/${appId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async deleteCampaign(appId: string): Promise<{ success: boolean; message?: string }> {
    const res = await fetch(`/api/v1/apps/${appId}`, {
      method: "DELETE",
    });
    return res.json();
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

  async createCheckoutSession(data: {
    appId: string;
    amount: number;
    customerEmail: string;
    grantDays?: number;
    redirectUrl?: string;
  }) {
    const res = await fetch("/api/v1/checkout/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async getTransactions(appId?: string): Promise<{ success: boolean; transactions: TransactionItem[] }> {
    const url = appId ? `/api/v1/checkout/transactions?appId=${appId}` : withMode("/api/v1/checkout/transactions");
    const res = await fetch(url);
    return res.json();
  },

  async disburseTransaction(txId: string) {
    const res = await fetch(`/api/v1/checkout/disburse/${txId}`, {
      method: "POST",
    });
    return res.json();
  },

  async simulatePayment(txId: string): Promise<{ success: boolean; message: string; licenseKey?: string }> {
    const res = await fetch(`/api/v1/checkout/simulate-paid/${txId}`, {
      method: "POST",
    });
    return res.json();
  },

  async triggerPayout(amount?: number) {
    const res = await fetch("/api/v1/payouts/trigger", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount, mode: dashboardEnv.value }),
    });
    return res.json();
  },

  async getLicenses(appId?: string): Promise<{ success: boolean; licenses: LicenseItem[] }> {
    const url = appId ? `/api/v1/license/list?appId=${appId}` : withMode("/api/v1/license/list");
    const res = await fetch(url);
    return res.json();
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
    return res.json();
  },

  async revokeLicense(licenseKey: string) {
    const res = await fetch("/api/v1/license/revoke", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ licenseKey }),
    });
    return res.json();
  },

  async unbindHardware(licenseKey: string) {
    const res = await fetch("/api/v1/license/unbind-hardware", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ licenseKey }),
    });
    return res.json();
  },

  async validateLicense(data: { licenseKey: string; appId: string; hardwareId?: string }) {
    const res = await fetch("/api/v1/license/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return res.json();
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
    return res.json();
  },

  async verifyLicense(data: { licenseKey: string; hwid?: string }) {
    const res = await fetch("/api/v1/licensing/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async deactivateLicense(data: { licenseKey: string; hwid: string }) {
    const res = await fetch("/api/v1/licensing/deactivate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async getAiVault(appId: string): Promise<{ success: boolean; credentials: VaultCredentialItem[] }> {
    const res = await fetch(`/api/v1/ai-proxy/vault/${appId}`);
    return res.json();
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
    return res.json();
  },

  async toggleAiKillSwitch(data: { appId: string; provider: "openai" | "anthropic" | "gemini" }) {
    const res = await fetch("/api/v1/ai-proxy/vault/toggle-kill-switch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async getAiProxyLogs(appId: string): Promise<{ success: boolean; logs: AiProxyLogItem[] }> {
    const res = await fetch(`/api/v1/ai-proxy/logs/${appId}`);
    return res.json();
  },

  async testAiProxy(data: { licenseKey: string; appId: string; prompt: string; provider?: string; modelAlias?: string; stream?: boolean }) {
    const res = await fetch("/api/v1/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async getAiQuotaStatus(licenseKey: string, modelAlias = "default"): Promise<{ success: boolean; data: AiQuotaStatus; error?: string; message?: string }> {
    const res = await fetch(`/api/v1/ai/quota-status?licenseKey=${encodeURIComponent(licenseKey)}&modelAlias=${encodeURIComponent(modelAlias)}`);
    return res.json();
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
      const errJson = await res.json();
      throw new Error(errJson.message || errJson.error || "Gagal streaming AI.");
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
    return res.json();
  },

  async getWidgetBadge(appSlug: string) {
    const res = await fetch(`/api/v1/widgets/badge/${appSlug}`);
    return res.json();
  },

  // Customer Portal
  async portalAccess(email: string, licenseKey: string): Promise<{ success: boolean; token?: string; expiresInSeconds?: number; error?: string }> {
    const res = await fetch("/api/v1/portal/access", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, licenseKey }),
    });
    return res.json();
  },

  async getPortalLicenses(token: string): Promise<{ success: boolean; count: number; licenses: PortalLicenseItem[]; error?: string }> {
    const res = await fetch(`/api/v1/portal/licenses?token=${encodeURIComponent(token)}`);
    return res.json();
  },

  async deactivatePortalDevice(data: { licenseKey: string; hwidHash: string; customerEmail: string }): Promise<{ success: boolean; message: string; remainingSeats: number; error?: string }> {
    const res = await fetch("/api/v1/portal/deactivate-device", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async getPortalTransactions(token: string): Promise<{ success: boolean; count: number; transactions: PortalTransactionItem[]; error?: string }> {
    const res = await fetch(`/api/v1/portal/transactions?token=${encodeURIComponent(token)}`);
    return res.json();
  },

  // Coupons (Modul 1: Monetization)
  async getCoupons(appId?: string): Promise<{ success: boolean; count: number; coupons: CouponItem[]; error?: string }> {
    const url = appId ? `/api/v1/coupons?appId=${encodeURIComponent(appId)}` : withMode("/api/v1/coupons");
    const res = await fetch(url);
    return res.json();
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
    return res.json();
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
    return res.json();
  },

  async deleteCoupon(couponId: string): Promise<{ success: boolean; message?: string; error?: string }> {
    const res = await fetch(`/api/v1/coupons/${couponId}`, {
      method: "DELETE",
    });
    return res.json();
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
    return res.json();
  },

  // Super Admin Panel
  async getPanelStats(): Promise<{ success: boolean; data: PanelStats; error?: string }> {
    const res = await fetch("/api/v1/panel/stats");
    return res.json();
  },

  async getPanelBuilders(): Promise<{ success: boolean; count: number; builders: PanelBuilderItem[]; error?: string }> {
    const res = await fetch("/api/v1/panel/builders");
    return res.json();
  },

  async getPanelTransactions(limit = 100, status?: string): Promise<{ success: boolean; count: number; transactions: PanelTransactionItem[]; error?: string }> {
    const query = new URLSearchParams();
    if (limit) query.append("limit", limit.toString());
    if (status) query.append("status", status);
    const res = await fetch(`/api/v1/panel/transactions?${query.toString()}`);
    return res.json();
  },

  async triggerBatchPayout(): Promise<{ success: boolean; message: string; processedCount: number; totalDisbursed: number; details: any[]; error?: string }> {
    const res = await fetch("/api/v1/panel/payouts/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    return res.json();
  },


};

