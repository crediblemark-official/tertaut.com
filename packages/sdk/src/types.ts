/**
 * @tertaut/sdk Types & Interfaces
 */

/** Diturunkan dari prefiks `apiKey`: `tt_live_` → production, `tt_test_` → sandbox, `tt_secret_` → server. */
export type TertautEnvironment = "production" | "sandbox" | "server";

export interface TertautConfig {
  /** Publishable API key (`tt_live_...` / `tt_test_...`) atau Secret key (`tt_secret_...`). */
  apiKey: string;
  /** Base URL server tertaut, mis. `https://tertaut.com` atau `http://localhost:8081`. Wajib diisi. */
  baseUrl: string;
  /** ID aplikasi tertaut. Wajib diisi untuk operasi client/licensing; opsional untuk S2S. */
  appId?: string;
  /** Timeout request HTTP dalam milidetik (default: 15_000ms). */
  timeoutMs?: number;
}

/**
 * Kontrak internal yang dipakai seluruh modul SDK.
 * - `request` mengembalikan `Response` mentah (dipakai SSE streaming).
 * - `requestJson` mem-parse body dan melempar `TertautError` bertipe saat HTTP error.
 */
export interface TertautExecutor {
  request: (path: string, init?: RequestInit) => Promise<Response>;
  requestJson: <T = any>(path: string, init?: RequestInit) => Promise<T>;
  appId: string;
  baseUrl: string;
  apiKey: string;
}

export interface CheckoutOptions {
  /** Nominal dalam rupiah. Opsional — server memakai harga produk sebagai nilai otoritatif. */
  amount?: number;
  customerEmail: string;
  redirectUrl?: string;
  couponCode?: string;
  /** Alias dari `customerEmail`; dipakai bila `customerEmail` tidak diisi. */
  buyerEmail?: string;
  grantDays?: number;
  /** Referensi produk via slug, sebagai alternatif dari `appId` yang diambil dari konstruktor. */
  appSlug?: string;
  slug?: string;
  /** Paksa payment rail tertentu, mis. meniru perilaku tombol pembayaran di dashboard. */
  paymentGateway?: string;
  /**
   * Rail pembayaran. Ketersediaan bergantung gateway aktif:
   * - `qris` | `va` | `ewallet` → semua gateway
   * - `card` | `retail`           → Xendit & XenithPay saja
   * - `balance`                   → DANA saja
   *
   * Mengirim rail yang tidak didukung gateway aktif akan ditolak gateway itu.
   * Bila dikosongkan, server memakai rail default dari produk.
   */
  paymentRail?: "qris" | "va" | "ewallet" | "card" | "retail";
  /** Alias dari `paymentRail`; dipakai bila `paymentRail` tidak diisi. */
  preferredPaymentChannel?: string;
  vaBank?: string;
  bank?: string;
  ewalletChannel?: string;
  retailOutlet?: string;
  /** Nominal kustom (hanya untuk produk yang mengizinkan harga bebas). */
  customAmount?: number;
  /** Aktifkan free trial bila produk punya `trialPeriodDays > 0`. */
  startTrial?: boolean;
  isTrial?: boolean;
}

/** Hasil `POST /api/v1/checkout/session`. Pada cabang free trial, lisensi terbit langsung. */
export interface CheckoutResult {
  checkoutUrl: string;
  transactionId: string;
  success?: boolean;
  message?: string;
  /** Ticket HMAC berumur 45 menit — wajib disimpan untuk polling status & invoice. */
  ticket?: string;
  hostedPayUrl?: string;
  paymentGateway?: string;
  paymentRail?: string;
  paymentCode?: string;
  qrDataUrl?: string;
  vaBank?: string;
  scenario?: string;
  amount?: number;
  listPrice?: number;
  discountAmount?: number;
  discountPercent?: number;
  grantDays?: number;
  couponCode?: string;
  platformFee?: number;
  netDisbursementAmount?: number;
  expiresAt?: string;
  // Cabang free trial
  isTrial?: boolean;
  trialPeriodDays?: number;
  licenseKey?: string;
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
  /** Callback saat lease telah hangus atau kedaluwarsa (dilempar sebagai `HeartbeatLeaseError`). */
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
  reason?: string;
  message?: string;
  /** Helper untuk mengecek apakah suatu feature flag aktif. */
  hasFeature: (featureName: string) => boolean;
  /** Helper untuk mengambil nilai konfigurasi feature flag dengan fallback default. */
  getFeature: <T = any>(featureName: string, defaultValue?: T) => T;
}

/**
 * Respons `POST /api/v1/licensing/validate`.
 * Catatan: endpoint ini tidak mengembalikan `seatsUsed`/`maxSeats`/`credits`;
 * token offline untuk verifikasi lokal ada di `offlineGraceToken`.
 */
export interface LicenseValidateResult {
  valid: boolean;
  licenseKey?: string;
  status: string;
  expiresAt: string | null;
  /** Token offline Ed25519 hasil rotasi. Simpan token ini; token sebelumnya masuk JTI denylist. */
  offlineGraceToken?: string;
  entitlements?: Record<string, any>;
  licenseVersion?: number;
  reason?: string;
  message?: string;
  error?: string;
  minVersion?: string;
  currentVersion?: string;
}

/**
 * Respons `POST /api/v1/licensing/verify`.
 * `credits` adalah angka biasa (saldo), bukan objek.
 * Endpoint ini tidak mengembalikan seatsUsed/maxSeats.
 */
export interface LicenseVerifyResult {
  valid: boolean;
  status: string;
  gracePeriodRemainingDays: number | null;
  credits?: number;
  entitlements?: Record<string, any>;
  licenseVersion?: number;
  message?: string;
}

export interface LicenseActivateResult {
  success: boolean;
  message: string;
  data?: {
    licenseToken: string;
    status: string;
    expiresAt: string | null;
    seatsUsed: number;
    maxSeats: number;
    floating?: boolean;
    entitlements: Record<string, any>;
    licenseVersion: number;
    /** Hanya ada untuk lisensi floating. */
    leaseKey?: string;
    /** Hanya ada untuk lisensi floating: masa berlaku lease dalam detik. */
    leaseTtlSeconds?: number;
    /** Hanya ada untuk lisensi floating: interval heartbeat yang direkomendasikan. */
    heartbeatIntervalSeconds?: number;
  };
  activated?: boolean;
  error?: string;
  errorCode?: string;
}

export interface LicenseDeactivateResult {
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * Respons `POST /api/v1/licensing/heartbeat`.
 * Server mengirim `leaseExpiresAt`; SDK menormalisasi ulang ke `expiresAt`
 * demi kompatibilitas konsumen lama.
 */
export interface LicenseHeartbeatResult {
  success: boolean;
  status?: string;
  expiresAt?: string;
  leaseExpiresAt?: string;
  leaseKey?: string;
  lastHeartbeatAt?: string;
  seatsUsed?: number;
  floating?: boolean;
  message?: string;
  reason?: string;
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
  /**
   * Alias model yang dikonfigurasi builder di dashboard. Default-nya `"default"`,
   * yang wajib sama persis dengan nilai yang dipakai server agar guardrail
   * (rate limit per menit & kuota token harian) ikut diterapkan.
   */
  modelAlias?: string;
  provider?: "openai" | "anthropic" | "gemini" | "deepseek" | "custom";
  model?: string;
  temperature?: number;
}

export interface AiStreamChunk {
  text: string;
}

/** Hasil verifikasi offline token secara lokal (tanpa request ke server). */
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

/**
 * Hasil verifikasi offline token secara online. Berbeda dari verifikasi lokal:
 * endpoint ini mengecek JTI denylist dan status lisensi terkini di server.
 */
export interface OnlineOfflineTokenVerifyResult {
  valid: boolean;
  licenseKey?: string;
  appId?: string;
  hardwareHash?: string;
  seats?: number;
  expiresAt?: string | null;
  mode?: string;
  reason?: string;
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
  platform?: "web" | "desktop" | "chrome_extension" | "android" | "general";
  grantCredits?: number;
  features?: Record<string, any>;
  licenseVersion?: number;
}

export interface S2SIssueBatchOptions {
  appId?: string;
  items: Array<{
    customerEmail: string;
    grantDays?: number;
    maxSeats?: number;
    platform?: "web" | "desktop" | "chrome_extension" | "android" | "general";
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
