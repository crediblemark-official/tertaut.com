import { existsSync, readFileSync } from "fs";

function getEnv(key: string, fallback = ""): string {
  try {
    if (existsSync(".env")) {
      const content = readFileSync(".env", "utf8");
      const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const match = content.match(new RegExp(`^${escapedKey}=(.*)$`, "m"));
      if (match && match[1] !== undefined) {
        return match[1].trim().replace(/^["']|["']$/g, "");
      }
    }
  } catch {}
  return process.env[key] || fallback;
}

const nodeEnv = getEnv("NODE_ENV", "development");
const isProd = nodeEnv === "production";

const DEFAULT_JWT_SECRET = "tertaut_default_jwt_secret_change_me_in_production";
const DEFAULT_VAULT_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

/**
 * Secret kritis hanya boleh berasal dari environment (.env / process.env).
 * Default fallback publik hanya dipakai di development; di production startup
 * GAGAL jika secret kosong, tidak disetel, atau masih memakai nilai default publik.
 */
function resolveSecret(envName: string, devFallback: string): string {
  const value = getEnv(envName);
  if (isProd) {
    if (!value || value === devFallback) {
      throw new Error(
        `[config] ${envName} wajib disetel ke nilai rahasia kustom di production. ` +
          `Nilai default/publik tidak diizinkan.`
      );
    }
  }
  return value || devFallback;
}

export const config = {
  port: Number(getEnv("PORT", "3000")),
  nodeEnv,
  isDev: nodeEnv === "development",
  isProd,
  /**
   * Sandbox mode: mengaktifkan fitur dev (mock payment, simulasi, auto-seed demo).
   * Aktif otomatis di development, atau eksplisit via SANDBOX_MODE=true di production.
   */
  isSandbox: nodeEnv !== "production" || getEnv("SANDBOX_MODE") === "true",
  publicAppUrl: getEnv("PUBLIC_APP_URL", "http://localhost:3000"),
  publicStoreUrl: getEnv("PUBLIC_STORE_URL", "https://situsbisnis.com"),
  /** Harga default (IDR) untuk produk yang belum menetapkan target_price. */
  defaultPrice: Number(getEnv("DEFAULT_PRICE", "0")) || 49000,

  database: {
    url: getEnv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/tertautv2"),
  },

  redis: {
    url: getEnv("REDIS_URL", "redis://localhost:6379"),
  },

  security: {
    jwtSecret: resolveSecret("JWT_SECRET", DEFAULT_JWT_SECRET),
    vaultEncryptionKey: resolveSecret("VAULT_ENCRYPTION_KEY", DEFAULT_VAULT_KEY),
    /** Secret untuk Better Auth (sesi & token). Fallback ke JWT_SECRET bila tidak disetel. */
    betterAuthSecret: getEnv("BETTER_AUTH_SECRET") || resolveSecret("JWT_SECRET", DEFAULT_JWT_SECRET),
    /** Private key Ed25519 (base64/PEM) untuk menandatangani offline license token. */
    licensePrivateKey: getEnv("LICENSE_SIGNING_PRIVATE_KEY"),
    /**
     * Salt untuk hashing hardware ID (HMAC). Fallback ke JWT_SECRET agar konsisten
     * antar-proses. Setel HWID_SALT terpisah untuk rotasi mandiri.
     */
    hwidSalt: getEnv("HWID_SALT") || getEnv("JWT_SECRET") || DEFAULT_JWT_SECRET,
  },

  email: {
    /** API key Resend. Bila kosong, pengiriman email dilewati (skip) dengan peringatan. */
    resendApiKey: getEnv("RESEND_API_KEY"),
    /** Alamat pengirim terverifikasi di Resend, mis. "tertaut.com <noreply@tertaut.com>". */
    from: getEnv("EMAIL_FROM", "tertaut.com <noreply@tertaut.com>"),
    replyTo: getEnv("EMAIL_REPLY_TO"),
  },

  paymentGateway: (getEnv("PAYMENT_GATEWAY", "xendit").toLowerCase() === "dana" ? "dana" : "xendit") as "xendit" | "dana",

  xendit: {
    secretKey: getEnv("XENDIT_SECRET_KEY"),
    publicKey: getEnv("XENDIT_PUBLIC_KEY"),
    webhookToken: getEnv("XENDIT_WEBHOOK_VERIFICATION_TOKEN"),
    platformFeePercent: 5, // 5% Merchant of Record platform fee
  },

  dana: {
    clientId: getEnv("DANA_CLIENT_ID"),
    clientSecret: getEnv("DANA_CLIENT_SECRET"),
    merchantId: getEnv("DANA_MERCHANT_ID"),
    baseUrl: getEnv("DANA_BASE_URL", "https://api-sandbox.dana.id"),
    publicKey: getEnv("DANA_PUBLIC_KEY"),
    privateKey: getEnv("DANA_PRIVATE_KEY"),
    platformFeePercent: 5, // 5% Merchant of Record platform fee
  },
} as const;

