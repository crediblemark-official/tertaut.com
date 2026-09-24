/**
 * Client API Client untuk tertaut.com Engine
 */

import type { AppItem, DashboardStats, CatalogKPIStats } from "../types/app";
import type { TransactionItem } from "../types/transaction";
import type {
  LicenseItem,
  SeatsResponse,
  EventsResponse,
  WebhookEndpointItem,
} from "../types/licensing";
import type { VaultCredentialItem, AiProxyLogItem, AiQuotaStatus } from "../types/aiproxy";
import type { PanelStats, PanelBuilderItem, PanelTransactionItem } from "../types/panel";
import type { CouponItem } from "../types/coupon";
export type {
  AppItem,
  DashboardStats,
  CatalogKPIStats,
  TransactionItem,
  LicenseItem,
  VaultCredentialItem,
  AiProxyLogItem,
  AiQuotaStatus,
  PanelStats,
  PanelBuilderItem,
  PanelTransactionItem,
  CouponItem,
};
import { dashboardEnv } from "./environment";

/** Sisipkan filter environment dashboard (mode) ke URL endpoint data. */
function withMode(path: string): string {
  const mode = dashboardEnv.value === "sandbox" ? "sandbox" : "live";
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}mode=${mode}`;
}

const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) || "";

export async function apiFetch(
  input: string,
  init?: RequestInit & { timeoutMs?: number }
): Promise<Response> {
  const url = input.startsWith("http") ? input : `${API_BASE}${input}`;
  const timeoutMs = init?.timeoutMs ?? 15000;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  if (init?.signal) {
    init.signal.addEventListener("abort", () => controller.abort());
  }

  try {
    const res = await fetch(url, {
      ...init,
      signal: controller.signal,
    });

    if (res.status === 401 && typeof window !== "undefined") {
      const currentPath = window.location.pathname;
      if (!currentPath.startsWith("/login") && !currentPath.startsWith("/pay/")) {
        window.location.href = `/login?redirect=${encodeURIComponent(currentPath)}`;
      }
    }

    return res;
  } catch (err: any) {
    if (err.name === "AbortError") {
      throw new ApiError(408, `Permintaan waktu habis (${timeoutMs / 1000}s)`);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

let appsCache: Record<string, { data: { apps: AppItem[] }; timestamp: number }> = {};

export function clearAppsCache() {
  appsCache = {};
}

export class ApiError extends Error {
  status: number;
  data?: any;

  constructor(status: number, message: string, data?: any) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

/**
 * Parse respons JSON dengan tipe terdefinisi.
 * Melempar ApiError jika res.ok === false agar try/catch menangkap error HTTP.
 */
async function parseJson<T = any>(res: Response): Promise<T> {
  const text = await res.text();
  let data: any = {};
  if (text.trim()) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: `HTTP ${res.status}: respons bukan format JSON valid` };
    }
  }

  if (!res.ok) {
    const errorMsg =
      (typeof data === "object" && (data?.error || data?.message)) ||
      `Permintaan gagal dengan status HTTP ${res.status}`;
    throw new ApiError(res.status, errorMsg, data);
  }

  return data as T;
}

export const api = {
  async getHealth() {
    const res = await apiFetch("/api/v1/health");
    return parseJson(res);
  },

  async getApps(
    mode?: "sandbox" | "live" | "all",
    forceRefresh = false
  ): Promise<{ apps: AppItem[] }> {
    const url =
      mode === "all"
        ? "/api/v1/apps"
        : mode
          ? `/api/v1/apps?mode=${mode}`
          : withMode("/api/v1/apps");
    const now = Date.now();
    if (!forceRefresh && appsCache[url] && now - appsCache[url].timestamp < 30000) {
      return appsCache[url].data;
    }
    const res = await apiFetch(url);
    const data = await parseJson<{ apps: AppItem[] }>(res);
    appsCache[url] = { data, timestamp: now };
    return data;
  },

  async getStats(): Promise<DashboardStats> {
    const res = await apiFetch(withMode("/api/v1/apps/stats/overview"));
    return parseJson(res);
  },

  async getCatalogStats(mode?: "sandbox" | "live" | "all"): Promise<CatalogKPIStats> {
    const url =
      mode === "all"
        ? "/api/v1/apps/stats/catalog"
        : mode
          ? `/api/v1/apps/stats/catalog?mode=${mode}`
          : withMode("/api/v1/apps/stats/catalog");
    const res = await apiFetch(url);
    return parseJson<CatalogKPIStats>(res);
  },

  async checkSlugAvailability(slug: string): Promise<{ slug: string; available: boolean }> {
    const res = await apiFetch(`/api/v1/apps/check-slug/${slug}`);
    return parseJson(res);
  },

  async createCampaign(
    data: Partial<AppItem>
  ): Promise<{ success: boolean; app: AppItem; error?: string }> {
    clearAppsCache();
    const res = await apiFetch("/api/v1/apps", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return parseJson(res);
  },

  async updateCampaign(
    appId: string,
    data: Partial<AppItem>
  ): Promise<{ success: boolean; app: AppItem; error?: string }> {
    clearAppsCache();
    const res = await apiFetch(`/api/v1/apps/${appId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return parseJson(res);
  },

  async deleteCampaign(appId: string): Promise<{ success: boolean; message?: string }> {
    clearAppsCache();
    const res = await apiFetch(`/api/v1/apps/${appId}`, {
      method: "DELETE",
    });
    return parseJson(res);
  },

  async rotateApiKey(appId: string): Promise<{ success: boolean; app: AppItem; error?: string }> {
    clearAppsCache();
    const res = await apiFetch(`/api/v1/apps/${appId}/rotate-api-key`, {
      method: "POST",
    });
    return parseJson(res);
  },

  async updateAppMode(
    appId: string,
    mode: "sandbox" | "live"
  ): Promise<{ success: boolean; app: AppItem; error?: string }> {
    clearAppsCache();
    const res = await apiFetch(`/api/v1/apps/${appId}/mode`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode }),
    });
    return parseJson(res);
  },

  async getBuilderMyself(): Promise<{
    success: boolean;
    builder: { id: string; email: string; name: string; secretApiKey: string };
    error?: string;
  }> {
    const res = await apiFetch("/api/v1/apps/me");
    return parseJson(res);
  },

  async rotateBuilderSecret(): Promise<{
    success: boolean;
    secretApiKey: string;
    builderId?: string;
    error?: string;
  }> {
    const res = await apiFetch("/api/v1/apps/rotate-secret-api-key", {
      method: "POST",
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
    const res = await apiFetch(`/api/v1/apps/by-slug/${slug}`);
    return parseJson<AppItem>(res);
  },

  async previewCoupon(data: { appId: string; couponCode: string; amount: number }): Promise<{
    valid: boolean;
    coupon?: CouponItem;
    discountPercent?: number;
    discountAmount?: number;
    finalAmount?: number;
    message?: string;
    error?: string;
  }> {
    const res = await apiFetch("/api/v1/checkout/preview-coupon", {
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
    paymentRail?: "qris" | "va" | "ewallet" | "card" | "retail";
    scenario?: "API" | "REDIRECT";
    vaBank?: string;
    ewalletChannel?: string;
    retailOutlet?: string;
    redirectUrl?: string;
    couponCode?: string;
  }): Promise<{
    success: boolean;
    transactionId?: string;
    ticket?: string;
    checkoutUrl?: string;
    scenario?: "API" | "REDIRECT";
    paymentRail?: "qris" | "va" | "ewallet" | "card" | "retail";
    paymentCode?: string;
    qrDataUrl?: string;
    vaBank?: string;
    amount?: number;
    error?: string;
  }> {
    const res = await apiFetch("/api/v1/checkout/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return parseJson(res);
  },

  async getPaymentStatus(
    txId: string,
    ticket?: string
  ): Promise<{
    success: boolean;
    transactionId: string;
    paymentStatus: "PENDING" | "PAID" | "EXPIRED" | "FAILED";
    amount: number;
    channel?: string;
    licenseKey?: string | null;
    paidAt?: string | null;
    qrDataUrl?: string;
    paymentCode?: string;
    checkoutUrl?: string;
    error?: string;
  }> {
    const sep = ticket ? (txId.includes("?") ? "&" : "?") : "";
    const qs = ticket ? `${sep}ticket=${encodeURIComponent(ticket)}` : "";
    const res = await apiFetch(`/api/v1/checkout/status/${txId}${qs}`);
    return parseJson(res);
  },

  async simulatePaid(
    txId: string,
    ticket?: string
  ): Promise<{
    success: boolean;
    message?: string;
    licenseKey?: string;
    error?: string;
  }> {
    const sep = ticket ? (txId.includes("?") ? "&" : "?") : "";
    const qs = ticket ? `${sep}ticket=${encodeURIComponent(ticket)}` : "";
    const res = await apiFetch(`/api/v1/checkout/simulate-paid/${txId}${qs}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticket }),
    });
    return parseJson(res);
  },

  async getConsultPay(amount: number): Promise<{
    success: boolean;
    data: any;
    error?: string;
  }> {
    const res = await apiFetch(`/api/v1/checkout/consult-pay?amount=${amount}`);
    return parseJson(res);
  },

  async getTransactions(
    options?: { appId?: string; page?: number; limit?: number } | string
  ): Promise<{
    success: boolean;
    transactions: TransactionItem[];
    total?: number;
    limit?: number;
    offset?: number;
    hasMore?: boolean;
  }> {
    const opts = typeof options === "string" ? { appId: options } : options || {};
    const params = new URLSearchParams();
    if (opts.appId) params.append("appId", opts.appId);
    if (opts.page) params.append("page", opts.page.toString());
    if (opts.limit) params.append("limit", opts.limit.toString());

    const base = withMode("/api/v1/checkout/transactions");
    const sep = base.includes("?") ? "&" : "?";
    const queryString = params.toString();
    const url = queryString ? `${base}${sep}${queryString}` : base;

    const res = await apiFetch(url);
    return parseJson(res);
  },

  async disburseTransaction(txId: string) {
    const res = await apiFetch(`/api/v1/checkout/disburse/${txId}`, {
      method: "POST",
    });
    return parseJson(res);
  },

  async simulatePayment(
    txId: string
  ): Promise<{ success: boolean; message: string; licenseKey?: string }> {
    const res = await apiFetch(`/api/v1/checkout/simulate-paid/${txId}`, {
      method: "POST",
    });
    return parseJson(res);
  },

  async triggerPayout(amount?: number) {
    const res = await apiFetch("/api/v1/payouts/trigger", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount, mode: dashboardEnv.value }),
    });
    return parseJson(res);
  },

  async getPayoutAccount(): Promise<{
    success: boolean;
    disbursementAccount: {
      bankCode?: string;
      accountNumber?: string;
      accountHolderName?: string;
      eWalletType?: string;
      phoneNumber?: string;
    } | null;
    builderName?: string;
  }> {
    const res = await apiFetch("/api/v1/payouts/account");
    return parseJson(res);
  },

  async updatePayoutAccount(data: {
    bankCode?: string;
    accountNumber?: string;
    accountHolderName?: string;
    eWalletType?: string;
    phoneNumber?: string;
  }): Promise<{ success: boolean; message: string; disbursementAccount?: any; error?: string }> {
    const res = await apiFetch("/api/v1/payouts/account", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return parseJson(res);
  },

  async getLicenses(options?: { appId?: string; page?: number; limit?: number } | string): Promise<{
    success: boolean;
    licenses: LicenseItem[];
    total?: number;
    limit?: number;
    offset?: number;
    hasMore?: boolean;
  }> {
    const opts = typeof options === "string" ? { appId: options } : options || {};
    const params = new URLSearchParams();
    if (opts.appId) params.append("appId", opts.appId);
    if (opts.page) params.append("page", opts.page.toString());
    if (opts.limit) params.append("limit", opts.limit.toString());

    const base = withMode("/api/v1/license/list");
    const sep = base.includes("?") ? "&" : "?";
    const queryString = params.toString();
    const url = queryString ? `${base}${sep}${queryString}` : base;

    const res = await apiFetch(url);
    return parseJson(res);
  },

  async issueLicense(data: {
    appId: string;
    customerEmail: string;
    grantDays?: number;
    maxSeats?: number;
    platform?: string;
  }) {
    const res = await apiFetch("/api/v1/license/issue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return parseJson(res);
  },

  async revokeLicense(licenseKey: string) {
    const res = await apiFetch("/api/v1/license/revoke", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ licenseKey }),
    });
    return parseJson(res);
  },

  async unbindHardware(licenseKey: string) {
    const res = await apiFetch("/api/v1/license/unbind-hardware", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ licenseKey }),
    });
    return parseJson(res);
  },

  async validateLicense(data: { licenseKey: string; appId: string; hardwareId?: string }) {
    const res = await apiFetch("/api/v1/license/validate", {
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
    const res = await apiFetch("/api/v1/licensing/activate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return parseJson(res);
  },

  async verifyLicense(data: { licenseKey: string; hwid?: string }) {
    const res = await apiFetch("/api/v1/licensing/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return parseJson(res);
  },

  async deactivateLicense(data: { licenseKey: string; hwid: string }) {
    const res = await apiFetch("/api/v1/licensing/deactivate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return parseJson(res);
  },

  // ---------- Fase 2/6: Seat management dashboard ----------
  async getLicenseSeats(licenseKey: string): Promise<SeatsResponse> {
    const res = await apiFetch(
      withMode(`/api/v1/licensing/seats?licenseKey=${encodeURIComponent(licenseKey)}`)
    );
    return parseJson<SeatsResponse>(res);
  },

  // ---------- Fase 4: Audit trail dashboard ----------
  async getLicenseEvents(options?: {
    licenseKey?: string;
    appId?: string;
    event?: string;
    actorType?: string;
    limit?: number;
  }): Promise<EventsResponse> {
    const params = new URLSearchParams();
    if (options?.licenseKey) params.append("licenseKey", options.licenseKey);
    if (options?.appId) params.append("appId", options.appId);
    if (options?.event) params.append("event", options.event);
    if (options?.actorType) params.append("actorType", options.actorType);
    if (options?.limit) params.append("limit", options.limit.toString());
    const qs = params.toString();
    const base = withMode("/api/v1/licensing/events");
    const sep = base.includes("?") ? "&" : "?";
    const res = await apiFetch(qs ? `${base}${sep}${qs}` : base);
    return parseJson<EventsResponse>(res);
  },

  // ---------- Fase 3: Webhook lifecycle management ----------
  async getWebhooks(): Promise<{
    success: boolean;
    events: string[];
    webhooks: WebhookEndpointItem[];
  }> {
    const res = await apiFetch(withMode("/api/v1/licensing/webhooks"));
    return parseJson(res);
  },

  async createWebhook(data: {
    url: string;
    events: string[];
    secret?: string;
    isActive?: boolean;
  }): Promise<{ success: boolean; webhook: WebhookEndpointItem; error?: string }> {
    const res = await apiFetch("/api/v1/licensing/webhooks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return parseJson(res);
  },

  async updateWebhook(
    id: string,
    data: { url?: string; events?: string[]; isActive?: boolean }
  ): Promise<{ success: boolean; webhook: WebhookEndpointItem; error?: string }> {
    const res = await apiFetch(`/api/v1/licensing/webhooks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return parseJson(res);
  },

  async deleteWebhook(id: string): Promise<{ success: boolean; message?: string; error?: string }> {
    const res = await apiFetch(`/api/v1/licensing/webhooks/${id}`, {
      method: "DELETE",
    });
    return parseJson(res);
  },

  async rotateWebhookSecret(
    id: string
  ): Promise<{ success: boolean; webhook?: WebhookEndpointItem; error?: string }> {
    const res = await apiFetch(`/api/v1/licensing/webhooks/${id}/rotate-secret`, {
      method: "POST",
    });
    return parseJson(res);
  },

  async testWebhook(
    id: string
  ): Promise<{ success: boolean; deliveryId?: string; attempted?: number; error?: string }> {
    const res = await apiFetch(`/api/v1/licensing/webhooks/${id}/test`, {
      method: "POST",
    });
    return parseJson(res);
  },

  async getAiVault(
    appId: string
  ): Promise<{ success: boolean; credentials: VaultCredentialItem[] }> {
    const res = await apiFetch(`/api/v1/ai-proxy/vault/${appId}`);
    return parseJson(res);
  },

  async saveAiVault(data: {
    appId: string;
    provider: "openai" | "anthropic" | "gemini";
    rawApiKey: string;
    monthlyBudgetLimit?: number;
  }) {
    const res = await apiFetch("/api/v1/ai-proxy/vault", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return parseJson(res);
  },

  async toggleAiKillSwitch(data: { appId: string; provider: "openai" | "anthropic" | "gemini" }) {
    const res = await apiFetch("/api/v1/ai-proxy/vault/toggle-kill-switch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return parseJson(res);
  },

  async getAiProxyLogs(appId: string): Promise<{ success: boolean; logs: AiProxyLogItem[] }> {
    const res = await apiFetch(`/api/v1/ai-proxy/logs/${appId}`);
    return parseJson(res);
  },

  async testAiProxy(data: {
    licenseKey: string;
    appId: string;
    prompt: string;
    provider?: string;
    modelAlias?: string;
    stream?: boolean;
  }) {
    const res = await apiFetch("/api/v1/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return parseJson(res);
  },

  async getAiQuotaStatus(
    licenseKey: string,
    modelAlias = "default"
  ): Promise<{ success: boolean; data: AiQuotaStatus; error?: string; message?: string }> {
    const res = await apiFetch(
      `/api/v1/ai/quota-status?licenseKey=${encodeURIComponent(licenseKey)}&modelAlias=${encodeURIComponent(modelAlias)}`
    );
    return parseJson(res);
  },

  async streamAiChat(
    data: { licenseKey: string; appId?: string; modelAlias?: string; prompt: string },
    onChunk: (text: string) => void
  ): Promise<void> {
    const res = await apiFetch("/api/v1/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data, stream: true }),
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}) as any);
      throw new Error(
        errJson.message || errJson.error || `Gagal streaming AI (HTTP ${res.status}).`
      );
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
    const res = await apiFetch("/api/v1/launch/convert-to-live", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return parseJson(res);
  },

  async getWidgetBadge(appSlug: string) {
    const res = await apiFetch(`/api/v1/widgets/badge/${appSlug}`);
    return parseJson(res);
  },

  // Coupons (Modul 1: Monetization)
  async getCoupons(
    appId?: string
  ): Promise<{ success: boolean; count: number; coupons: CouponItem[]; error?: string }> {
    const url = appId
      ? `/api/v1/coupons?appId=${encodeURIComponent(appId)}`
      : withMode("/api/v1/coupons");
    const res = await apiFetch(url);
    return parseJson(res);
  },

  async createCoupon(data: {
    appId: string;
    code: string;
    discountPercent: number;
    maxRedemptions?: number;
    expiresAt?: string;
  }): Promise<{ success: boolean; coupon?: CouponItem; error?: string }> {
    const res = await apiFetch("/api/v1/coupons", {
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
    const res = await apiFetch(`/api/v1/coupons/${couponId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return parseJson(res);
  },

  async deleteCoupon(
    couponId: string
  ): Promise<{ success: boolean; message?: string; error?: string }> {
    const res = await apiFetch(`/api/v1/coupons/${couponId}`, {
      method: "DELETE",
    });
    return parseJson(res);
  },

  async getCouponStats(
    days = 7,
    appId?: string
  ): Promise<{
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
    const res = await apiFetch(`/api/v1/coupons/stats?${params.toString()}`);
    return parseJson(res);
  },

  // Super Admin Panel
  async getPanelStats(): Promise<{ success: boolean; data: PanelStats; error?: string }> {
    const res = await apiFetch("/api/v1/panel/stats");
    return parseJson(res);
  },

  async getPanelBuilders(): Promise<{
    success: boolean;
    count: number;
    builders: PanelBuilderItem[];
    error?: string;
  }> {
    const res = await apiFetch("/api/v1/panel/builders");
    return parseJson(res);
  },

  async getPanelTransactions(
    limit = 100,
    status?: string
  ): Promise<{
    success: boolean;
    count: number;
    transactions: PanelTransactionItem[];
    error?: string;
  }> {
    const query = new URLSearchParams();
    if (limit) query.append("limit", limit.toString());
    if (status) query.append("status", status);
    const res = await apiFetch(`/api/v1/panel/transactions?${query.toString()}`);
    return parseJson(res);
  },

  async triggerBatchPayout(): Promise<{
    success: boolean;
    message: string;
    processedCount: number;
    totalDisbursed: number;
    details: any[];
    error?: string;
  }> {
    const res = await apiFetch("/api/v1/panel/payouts/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    return parseJson(res);
  },

  async refundTransaction(
    txId: string,
    reason?: string
  ): Promise<{
    success: boolean;
    message: string;
    data?: any;
    error?: string;
  }> {
    const res = await apiFetch(`/api/v1/panel/transactions/${txId}/refund`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    return parseJson(res);
  },

  async toggleBuilderSuspend(builderId: string): Promise<{
    success: boolean;
    builderId: string;
    isSuspended: boolean;
    message: string;
    error?: string;
  }> {
    const res = await apiFetch(`/api/v1/panel/builders/${builderId}/toggle-suspend`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    return parseJson(res);
  },

  async toggleAppSuspend(appId: string): Promise<{
    success: boolean;
    appId: string;
    isSuspended: boolean;
    message: string;
    error?: string;
  }> {
    const res = await apiFetch(`/api/v1/panel/apps/${appId}/toggle-suspend`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    return parseJson(res);
  },

  async getPlatformSettings(): Promise<{
    success: boolean;
    settings: Record<string, string>;
    items?: any[];
    error?: string;
  }> {
    const res = await apiFetch("/api/v1/panel/settings");
    return parseJson(res);
  },

  async updatePlatformSettings(settings: Record<string, string>): Promise<{
    success: boolean;
    settings: Record<string, string>;
    items?: any[];
    error?: string;
  }> {
    const res = await apiFetch("/api/v1/panel/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ settings }),
    });
    return parseJson(res);
  },

  async getPublicAnnouncement(): Promise<{
    success: boolean;
    hasAnnouncement: boolean;
    announcement: { message: string; type: "info" | "warning" | "alert" } | null;
  }> {
    const res = await apiFetch("/api/v1/announcement");
    return parseJson(res);
  },

  async getInvoiceData(
    txId: string,
    ticket?: string
  ): Promise<{
    success: boolean;
    invoice: any;
    error?: string;
  }> {
    const q = ticket ? `?ticket=${encodeURIComponent(ticket)}` : "";
    const res = await apiFetch(`/api/v1/checkout/invoice/${txId}${q}`);
    return parseJson(res);
  },
};
