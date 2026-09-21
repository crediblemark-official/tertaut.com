/**
 * @tertaut/sdk Types & Interfaces
 */

export interface TertautConfig {
  /** Publishable API key (`tt_live_...` / `tt_test_...`) atau Secret key (`tt_secret_...`). */
  apiKey: string;
  /** Base URL server tertaut, mis. `https://tertaut.com` atau `http://localhost:3001`. Wajib diisi. */
  baseUrl: string;
  /** ID aplikasi tertaut. Wajib diisi untuk operasi client/licensing; opsional untuk S2S. */
  appId?: string;
  /** Timeout request HTTP dalam milidetik (default: 15_000ms). */
  timeoutMs?: number;
}

export interface CheckoutOptions {
  amount: number;
  grantDays?: number;
  grantCredits?: number;
  customerEmail?: string;
  redirectUrl?: string;
}

export interface LicenseValidateOptions {
  licenseKey: string;
  hardwareId?: string;
  appVersion?: string;
  platform?: "web" | "desktop" | "chrome_extension" | "android" | "general";
}

export interface LicenseVerifyOptions {
  licenseKey: string;
  hwid?: string;
  appVersion?: string;
}

export interface LicenseActivateOptions {
  licenseKey: string;
  hwid: string;
  deviceName?: string;
}

export interface LicenseDeactivateOptions {
  licenseKey: string;
  hwid: string;
}

export interface LicenseHeartbeatOptions {
  licenseKey: string;
  hwid: string;
  leaseKey: string;
  deviceName?: string;
}

export interface HeartbeatSessionOptions {
  licenseKey: string;
  hwid: string;
  leaseKey: string;
  deviceName?: string;
  /** Interval pengiriman heartbeat dalam detik (default: 60 detik). */
  intervalSeconds?: number;
  /** Callback saat heartbeat berhasil diperpanjang. */
  onSuccess?: (res: LicenseHeartbeatResult) => void;
  /** Callback saat lease telah hangus atau kedaluwarsa (403/409). */
  onLeaseExpired?: (err: Error) => void;
  /** Callback saat terjadi error jaringan atau HTTP error lainnya. */
  onError?: (err: Error) => void;
}

export interface HeartbeatSession {
  stop: () => void;
  getLeaseKey: () => string;
  isActive: () => boolean;
  beatNow: () => Promise<LicenseHeartbeatResult>;
}

export interface LicenseCheckOptions {
  licenseKey: string;
  hwid?: string;
  appVersion?: string;
  platform?: "web" | "desktop" | "chrome_extension" | "android" | "general";
  /** Token offline Ed25519 untuk verifikasi lokal jika server tidak dapat dihubungi. */
  offlineToken?: string;
  /** Izinkan verifikasi lokal offline jika panggilan online mengalami kegagalan jaringan (default: true). */
  allowOfflineFallback?: boolean;
  /** Public key Ed25519 kustom (opsional). */
  publicKeyJwk?: JsonWebKey;
}

export interface LicenseCheckResult {
  valid: boolean;
  source: "online" | "offline";
  status: string;
  expiresAt: string | null;
  entitlements: Record<string, any>;
  licenseVersion: number;
  seatsUsed?: number;
  maxSeats?: number;
  token?: string;
  reason?: string;
  message?: string;
  /** Helper untuk mengecek apakah suatu feature flag aktif. */
  hasFeature: (featureName: string) => boolean;
  /** Helper untuk mengambil nilai konfigurasi feature flag dengan fallback default. */
  getFeature: <T = any>(featureName: string, defaultValue?: T) => T;
}

export interface LicenseValidateResult {
  valid: boolean;
  status: string;
  expiresAt: string | null;
  seatsUsed: number;
  maxSeats: number;
  entitlements?: Record<string, any>;
  licenseVersion?: number;
  licenseToken?: string;
  gracePeriodRemainingDays?: number;
  credits?: { balance: number };
  reason?: string;
  message?: string;
  error?: string;
}

export type LicenseVerifyResult = LicenseValidateResult;

export interface LicenseActivateResult {
  success: boolean;
  message: string;
  data?: {
    licenseToken: string;
    status: string;
    expiresAt: string | null;
    seatsUsed: number;
    maxSeats: number;
    entitlements: Record<string, any>;
    licenseVersion: number;
    leaseKey?: string;
    leaseExpiresAt?: string;
    leaseTtlSeconds?: number;
    heartbeatIntervalSeconds?: number;
  };
  activated?: boolean;
  error?: string;
  errorCode?: string;
}

export interface LicenseHeartbeatResult {
  success: boolean;
  status?: string;
  expiresAt?: string;
  leaseTtlSeconds?: number;
  heartbeatIntervalSeconds?: number;
  gracePeriodRemainingDays?: number;
  error?: string;
  errorCode?: string;
}

export interface LicenseEntitlementsResult {
  valid: boolean;
  entitlements: Record<string, any>;
  licenseVersion: number;
  status?: string;
  reason?: string;
  message?: string;
  hasFeature: (featureName: string) => boolean;
  getFeature: <T = any>(featureName: string, defaultValue?: T) => T;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AiChatOptions {
  licenseKey?: string;
  licenseToken?: string;
  prompt?: string;
  messages?: ChatMessage[];
  modelAlias?: string;
  provider?: "openai" | "anthropic" | "gemini" | "deepseek" | "custom";
  model?: string;
  temperature?: number;
}

export interface AiStreamChunk {
  text: string;
}

export interface OfflineTokenVerifyResult {
  valid: boolean;
  reason?: string;
  claims?: {
    typ?: string;
    lic?: string;
    app?: string;
    hw?: string | null;
    eml?: string | null;
    seats?: number;
    feat?: Record<string, any> | null;
    vfl?: string | null;
    jti?: string;
    iat?: number;
    exp?: number;
  };
}

export interface CreditBalanceOptions {
  licenseKey: string;
  hwid?: string;
}

export interface CreditBalanceResult {
  success: boolean;
  balance: number;
  licenseKey?: string;
  reason?: string;
  message?: string;
}

export interface CreditConsumeOptions {
  licenseKey: string;
  hwid: string;
  amount: number;
  reason?: string;
  reference?: string;
}

export interface CreditConsumeResult {
  success: boolean;
  balance: number;
  consumed?: number;
  reason?: string;
  message?: string;
}

export interface CreditHistoryOptions {
  licenseKey: string;
  hwid?: string;
  limit?: number;
}

export interface CreditHistoryEntry {
  id: string;
  type: "GRANT" | "DEBIT" | "REFUND" | "ADJUSTMENT";
  delta: number;
  balanceAfter: number;
  reference: string | null;
  description: string | null;
  createdAt: string;
}

export interface CreditHistoryResult {
  success: boolean;
  balance: number;
  entries: CreditHistoryEntry[];
  reason?: string;
  message?: string;
}

// S2S Types
export interface S2SIssueOptions {
  appId?: string;
  customerEmail: string;
  grantDays?: number;
  maxSeats?: number;
  platform?: string;
  grantCredits?: number;
  features?: Record<string, any>;
}

export interface S2SIssueBatchOptions {
  appId?: string;
  items: Array<{
    customerEmail: string;
    grantDays?: number;
    maxSeats?: number;
    platform?: string;
    grantCredits?: number;
    features?: Record<string, any>;
  }>;
}

export interface S2SRevokeOptions {
  licenseKey: string;
}

export interface S2SRevokeBatchOptions {
  licenseKeys: string[];
}

export interface S2STransferOptions {
  licenseKey: string;
  newCustomerEmail: string;
}

export interface S2SWebhookCreateOptions {
  url: string;
  events?: string[];
  secret?: string;
  isActive?: boolean;
}
