import { existsSync, readFileSync } from "fs";

function getEnv(key: string, fallback = ""): string {
  // Environment proses (Docker/systemd/shell) selalu menang atas file .env,
  // agar override runtime tidak diabaikan.
  if (process.env[key] !== undefined) {
    return process.env[key] as string;
  }
  try {
    if (existsSync(".env")) {
      const content = readFileSync(".env", "utf8");
      const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const match = content.match(new RegExp(`^${escapedKey}=(.*)$`, "m"));
      if (match && match[1] !== undefined) {
        return match[1].trim().replace(/^["']|["']$/g, "");
      }
    }
  } catch (err: any) {
    // Abaikan jika .env tidak ada atau permission ditolak saat runtime
  }
  return fallback;
}

const nodeEnv = getEnv("NODE_ENV", "development");
const isProd = nodeEnv === "production";
const isTest = nodeEnv === "test";

const DEFAULT_JWT_SECRET = "tertaut_default_jwt_secret_change_me_in_production";

/**
 * Secret kritis hanya boleh berasal dari environment (.env / process.env).
 * Default fallback publik hanya dipakai di development; di production startup
 * GAGAL jika secret kosong, tidak disetel, atau masih memakai nilai default publik.
 */
function resolveSecret(envName: string, devFallback = ""): string {
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

/**
 * Secret turunan (vault, better-auth, HWID salt): boleh mewarisi JWT_SECRET hanya
 * untuk menjaga kompatibilitas, TAPI selalu diperingatkan. Dengan STRICT_SECRETS=true
 * di production, startup GAGAL jika secret terpisah tidak disetel — mencegah satu
 * secret publik dipakai ulang untuk enkripsi vault & tanda tangan sesi sekaligus.
 */
function resolveDerivedSecret(envName: string, parent: string, label: string): string {
  const value = getEnv(envName);
  if (value) return value;
  if (parent) {
    const message =
      `[config] ${envName} tidak disetel — mewarisi JWT_SECRET untuk ${label}. ` +
      `Tetapkan secret acak terpisah (lihat .env.example) agar satu kebocoran tidak memengaruhi semua domain.`;
    if (isProd && getEnv("STRICT_SECRETS") === "true") {
      throw new Error(message);
    }
    console.warn(message);
  }
  return parent;
}

/**
 * Nilai yang wajib berasal dari environment di semua mode (tanpa fallback hardcode).
 * Dipakai untuk koneksi database agar kredensial tidak pernah tertanam di kode.
 */
function requireEnv(envName: string): string {
  const value = getEnv(envName);
  if (!value) {
    throw new Error(`[config] ${envName} wajib disetel (lihat .env.example).`);
  }
  return value;
}

function looksLikeFilePath(val: string): boolean {
  if (!val || typeof val !== "string") return false;
  const trimmed = val.trim();
  return (
    trimmed.startsWith("/") ||
    trimmed.startsWith("./") ||
    trimmed.startsWith("../") ||
    trimmed.startsWith("keys/") ||
    trimmed.endsWith(".pem") ||
    trimmed.endsWith(".key") ||
    trimmed.endsWith(".pub")
  );
}

/**
 * Membersihkan format string kunci PEM (menghilangkan quotes pembungkus,
 * menormalkan literal \n, mendeteksi string base64 PEM, dan menyusun ulang baris base64 64-karakter).
 */
export function cleanPemKey(raw: string): string {
  if (!raw || typeof raw !== "string") return "";
  let val = raw.trim();
  // Strip quotes pembungkus (mis. dari Dokploy env input "...")
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    val = val.slice(1, -1).trim();
  }
  // Normalkan newline literal \n dan Windows linebreaks CRLF/CR
  val = val.replace(/\\n/g, "\n").replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  // Jika input berupa single-line base64 yang membungkus PEM (mis. tanpa header BEGIN di string luar)
  if (!val.includes("-----BEGIN")) {
    try {
      const decoded = Buffer.from(val, "base64").toString("utf8");
      if (decoded.includes("-----BEGIN")) {
        val = decoded.trim().replace(/\\n/g, "\n").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
      }
    } catch {
      // Nilai bukan base64, gunakan string aslinya
    }
  }

  // Re-format PEM jika memiliki header BEGIN dan footer END
  const beginMatch = val.match(/-----BEGIN [^-]+-----/);
  const endMatch = val.match(/-----END [^-]+-----/);
  if (beginMatch && endMatch) {
    const header = beginMatch[0];
    const footer = endMatch[0];
    const headerIdx = val.indexOf(header);
    const footerIdx = val.indexOf(footer);
    const body = val.slice(headerIdx + header.length, footerIdx).replace(/\s+/g, "");
    const formattedBody = body.match(/.{1,64}/g)?.join("\n") || body;
    return `${header}\n${formattedBody}\n${footer}`;
  }

  return val;
}

/**
 * Membaca nilai kunci/sertifikat dengan urutan prioritas 12-Factor Cloud-Native:
 * 1. Environment variable [ENV_NAME]_BASE64 (Best practice untuk Dokploy/Docker - single line tanpa problem newline)
 * 2. Environment variable [ENV_NAME] (Bisa berupa single-line base64, raw PEM inline, atau path file mounted)
 * 3. File path lokal default (mis. keys/*.pem untuk kenyamanan local development)
 */
export function resolveKeyOrFile(envName: string, defaultFilePath?: string): string {
  // 1. Cek [ENV_NAME]_BASE64 terlebih dahulu (Dokploy / 12-factor cloud standard)
  const base64Env = getEnv(`${envName}_BASE64`);
  if (base64Env) {
    try {
      const decoded = Buffer.from(base64Env.trim(), "base64").toString("utf8");
      if (decoded) {
        return cleanPemKey(decoded);
      }
    } catch (err: any) {
      if (!isTest)
        console.warn(`[config] Gagal decode base64 ${envName}_BASE64:`, err?.message || err);
    }
  }

  // 2. Cek envName standar
  const value = getEnv(envName);
  if (value) {
    if (looksLikeFilePath(value)) {
      if (existsSync(value)) {
        try {
          return cleanPemKey(readFileSync(value, "utf8"));
        } catch (err: any) {
          if (!isTest)
            console.warn(
              `[config] Gagal membaca isi file kunci ${value} (${envName}):`,
              err?.message || err
            );
        }
      } else {
        // PERINGATAN: Path file dikonfigurasi di env tapi tidak ada di filesystem (misal di Docker container)
        // Jangan kembalikan nama file sebagai isi kunci!
        if (!isTest) {
          console.warn(
            `[config] Path file kunci "${value}" untuk ${envName} tidak ditemukan di filesystem. ` +
              `Gunakan ${envName}_BASE64 untuk container Dokploy/Docker.`
          );
        }
        return "";
      }
    }
    // Jika value adalah string kunci langsung (inline PEM atau base64)
    return cleanPemKey(value);
  }

  // 3. Fallback ke file path default (hanya jika ada di filesystem dev lokal)
  if (defaultFilePath && existsSync(defaultFilePath)) {
    try {
      return cleanPemKey(readFileSync(defaultFilePath, "utf8"));
    } catch (err: any) {
      if (!isTest)
        console.warn(
          `[config] Gagal membaca defaultFilePath ${defaultFilePath}:`,
          err?.message || err
        );
    }
  }

  return "";
}

const resolvedPort = Number(getEnv("PORT", "8081"));

let dynamicAppUrl = "";

/**
 * Update domain terdeteksi dari request aktif secara otomatis.
 */
export function setDetectedAppUrl(url: string) {
  if (url && typeof url === "string" && url.startsWith("http")) {
    dynamicAppUrl = url.replace(/\/+$/, "");
  }
}

/**
 * Deteksi otomatis domain publik dari HTTP request aktif (Host / X-Forwarded-Host).
 */
export function resolveRequestOrigin(request?: Request | { headers?: any; url?: string }): string {
  if (!request) return config.publicAppUrl;
  try {
    const headers = "headers" in request ? request.headers : undefined;
    const getHeader = (name: string): string | null => {
      if (!headers) return null;
      if (typeof headers.get === "function") return headers.get(name);
      return headers[name] || headers[name.toLowerCase()] || null;
    };

    const host = getHeader("x-forwarded-host") || getHeader("host");
    if (host) {
      const proto =
        getHeader("x-forwarded-proto") ||
        (host.includes("localhost") || host.includes("127.0.0.1") ? "http" : "https");
      const origin = `${proto}://${host}`.replace(/\/+$/, "");
      setDetectedAppUrl(origin);
      return origin;
    }

    if ("url" in request && typeof request.url === "string") {
      const parsed = new URL(request.url);
      const origin = `${parsed.protocol}//${parsed.host}`.replace(/\/+$/, "");
      setDetectedAppUrl(origin);
      return origin;
    }
  } catch {
    // Abaikan kegagalan parsing URL/header origin yang tidak valid
  }
  return config.publicAppUrl;
}

// Default test RSA 2048-bit key pair for CI / test runners when keys/ or .env is not mounted
const DEFAULT_TEST_SANDBOX_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAu0Hc4ZivslhsSQ0AhStB
b0x4DTrgYeq4fJOzZHiDAUghN/g+CG5EVRh0vnalPmV4cO5XBiRvAoe1X/t61jeB
TGov/Dv+Iz0O0qfClM8l3Qui0eseiQsFXySrukdl1U+mXpR5WfuFUp5zaje+USqj
MQ5xM4W1GS9wK+KWXshNwQMl7zS21Yi+x+96eut8nAvo+z3QVH2jncgNb3ymVm2u
8I37VPZ0/e9UMW3xcQxlE1WbI1YrIL5Nr03GZZP1qkKrEJGt5zI2cP3JBSY0DnQy
xSX/yrvTSWQJCx9vRpIIQVnv4d9D6Uo9OAzSn8UdKuO609qcYLpJoqt9V52vShVV
VwIDAQAB
-----END PUBLIC KEY-----`;

export const DEFAULT_TEST_SANDBOX_PRIVATE_KEY = `-----BEGIN RSA PRIVATE KEY-----
MIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQC7QdzhmK+yWGxJ
DQCFK0FvTHgNOuBh6rh8k7NkeIMBSCE3+D4IbkRVGHS+dqU+ZXhw7lcGJG8Ch7Vf
+3rWN4FMai/8O/4jPQ7Sp8KUzyXdC6LR6x6JCwVfJKu6R2XVT6ZelHlZ+4VSnnNq
N75RKqMxDnEzhbUZL3Ar4pZeyE3BAyXvNLbViL7H73p663ycC+j7PdBUfaOdyA1v
fKZWba7wjftU9nT971QxbfFxDGUTVZsjVisgvk2vTcZlk/WqQqsQka3nMjZw/ckF
JjQOdDLFJf/Ku9NJZAkLH29GkghBWe/h30PpSj04DNKfxR0q47rT2pxgukmiq31X
na9KFVVXAgMBAAECggEARVbEnybGPGCArGYroKQdRUTIGYIJL0jWio64uUXkoLdg
UZTTB5UpKWd2Z0aQtrOlLxAaWlRoZMPytfltiWAhOTYC0cA3QT4tPHTRWQABkcHq
xxdshat2kD4IduBURXIKdXA+JUM9IZQ5wYWlq/GBXzttUHo8zngh7aYoLy21mPfa
scEMSpNLooWc3j5rSvWHbvBz/ur/R3KfggyfSUEEzmyM6hw3uEl2BX4Mfeikncgk
8ItStytjQw7yKZL+lUMuY1iyn9S/UK9ojUGFRBSgUbLgMI1bLVG7uG5s/xOsuddm
3OyH02l3fHXlsaWcQWQdHhTy3nj+y6Qyckdgs7O1KQKBgQDjiMKvQ3aHsD4wXf59
Kyg1nvl+IVFxo831aKrhHJ61nekTWXUacDJ+vQJEjjls/EY+CN8+DEHZFNPwA+PN
EmdQVqKJ/STyPJ70uy77/HYxs6oTlTRU7rmpSL6EUIjVzPdfyQ0pdkkj5ThMYiCh
bZS0bWdtvMgA9MFR9MgawMjTPwKBgQDSrycHxQx4EPm1zLJpvtP3wXndGeGbFpI+
axDnNgSlpI3XoTFyOHJDqrdNSmd35fpGEp5YZV7FZOkmKgTYUTOYjzsD0YALUxj5
2OOmdcxbH1fw4LmD0m9/yjRX6XsPjYRRW6vhnzUIfOwZlwmc/CPz9q6ADyHB2vRC
Pa1PLNuv6QKBgFPPcEa2htZ8KKwQM0lPuEPoBuZax3EgcSDQKQE6VYt4Wv3xmZzf
bvoYDNnLuYNXeVgoVHK6eRbJATgLdsF24e9Juh0xzYYcpkBnImtXFwI/t4n3D4up
U2HzlZmPQJfgI854dAytsUszh4U7L+HGR1weYFafjtwrS3owu/R+xnppAoGAYwh+
GkLfx5iDKJfdzaMr1CwX8nx19ga4G6sMOQLFUG93VUKqEXzDCVe37hbpaAyshj++
OuL7l2IFzjC2MlCJJk89eGAEBk67UMZIzDhXJQYoukuIKJTEYJdV33UaqYbmCbBD
rTy/GwxNlwHOPQKwi78K65sxTQR1CKYhTzRQ1/ECgYBG+BL8k0Q6R2QtMfSaSXBO
a7LFweHA/+92G9CS6Zaern/lZ5xgLqNMgWvlp9143KNGWW6Wv23VtzPxnSbxpFFX
AsyQpuFl62KL+rmGwBph6ZSs2diZeDf9xmFve67kFQ8Ze7W4fzy5o7urfD+Le8JD
oybGWOHNqCIm10Ryqke/nw==
-----END RSA PRIVATE KEY-----`;

export const config = {
  port: resolvedPort,
  nodeEnv,
  isDev: nodeEnv === "development",
  isTest: nodeEnv === "test",
  isProd,
  /**
   * Sandbox mode: mengaktifkan fitur dev (mock payment, simulasi, auto-seed demo).
   * Hanya aktif di non-production. Di production (NODE_ENV === "production"),
   * sandbox dilarang keras aktif demi mencegah bypass pembayaran riil.
   */
  isSandbox: !isProd,
  /**
   * Apakah request berjalan di belakang reverse-proxy tepercaya (Dokploy/Traefik,
   * nginx, Cloudflare). Jika true (default untuk deploy self-hosted ini), header
   * x-forwarded-for/x-real-ip/cf-connecting-ip dipercaya untuk rate limiting —
   * namun hanya entry paling kanan (yang ditambahkan proxy) yang dipakai.
   * Set false jika aplikasi terekspos langsung ke internet tanpa proxy.
   */
  trustProxy: getEnv("TRUST_PROXY", "true") !== "false",
  /**
   * Apakah cookie sesi memakai atribut Secure. Default: production. Bisa di-override
   * via USE_SECURE_COOKIES=true untuk staging yang disajikan via HTTPS.
   */
  get useSecureCookies(): boolean {
    const override = getEnv("USE_SECURE_COOKIES");
    return override !== "" ? override === "true" : isProd;
  },
  get publicAppUrl(): string {
    const envUrl = getEnv("PUBLIC_APP_URL");
    if (envUrl) return envUrl;
    if (dynamicAppUrl) return dynamicAppUrl;
    if (isProd) return "https://tertaut.com";
    return `http://localhost:${resolvedPort}`;
  },
  set publicAppUrl(url: string) {
    dynamicAppUrl = url.replace(/\/+$/, "");
  },
  get publicStoreUrl(): string {
    const envUrl = getEnv("PUBLIC_STORE_URL");
    if (envUrl) return envUrl;
    return config.publicAppUrl;
  },
  /** Harga default (IDR) untuk produk yang belum menetapkan target_price. */
  defaultPrice: Number(getEnv("DEFAULT_PRICE", "0")),

  database: {
    /** Satu sumber koneksi: connection string PostgreSQL dari environment. */
    url: requireEnv("DATABASE_URL"),
  },

  security: (() => {
    const jwtSecret = resolveSecret("JWT_SECRET", DEFAULT_JWT_SECRET);
    return {
      jwtSecret,
      /** Kunci enkripsi AES-256-GCM Vault; wajib disetel terpisah di production. */
      vaultEncryptionKey: resolveDerivedSecret(
        "VAULT_ENCRYPTION_KEY",
        jwtSecret,
        "enkripsi Vault kredensial AI"
      ),
      /** Secret untuk Better Auth (sesi & token); wajib disetel terpisah di production. */
      betterAuthSecret: resolveDerivedSecret(
        "BETTER_AUTH_SECRET",
        jwtSecret,
        "tanda tangan sesi Better Auth"
      ),
      /** Private key Ed25519 (base64/PEM atau path ke keys/license_signing_private.pem). */
      licensePrivateKey: resolveKeyOrFile(
        "LICENSE_SIGNING_PRIVATE_KEY",
        "keys/license_signing_private.pem"
      ),
      /** Salt untuk hashing hardware ID (HMAC); wajib disetel terpisah di production. */
      hwidSalt: isProd
        ? resolveDerivedSecret("HWID_SALT", jwtSecret, "hash hardware ID (HWID)")
        : getEnv("HWID_SALT") || "dev-hwid-salt-unique-seed-67890",
    };
  })(),

  email: {
    /** API key Resend. Bila kosong, pengiriman email dilewati (skip) dengan peringatan. */
    resendApiKey: getEnv("RESEND_API_KEY"),
    /** Alamat pengirim terverifikasi di Resend, mis. "Tertaut <no-reply@mail.tertaut.com>". */
    from: getEnv("MAIL_FROM") || "Tertaut <no-reply@mail.tertaut.com>",
    replyTo: getEnv("EMAIL_REPLY_TO"),
  },

  paymentGateway: "dana" as const,

  dana: (() => {
    const env =
      (getEnv("DANA_ENV") as "production" | "sandbox") || (isProd ? "production" : "sandbox");
    const isSandbox = env === "sandbox";

    return {
      env,
      get origin(): string {
        return getEnv("DANA_ORIGIN") || config.publicAppUrl;
      },
      set origin(val: string) {
        if (val) dynamicAppUrl = val.replace(/\/+$/, "");
      },
      clientId: isSandbox
        ? getEnv("DANA_SANDBOX_CLIENT_ID") ||
          getEnv("DANA_CLIENT_ID") ||
          (isTest ? "2026092111025202221544" : "")
        : getEnv("DANA_CLIENT_ID"),
      clientSecret: isSandbox
        ? getEnv("DANA_SANDBOX_CLIENT_SECRET") ||
          getEnv("DANA_CLIENT_SECRET") ||
          (isTest ? "00b18d19398bcd9ddad4b0792a0bdeaf5f2d70ee65c8359d4066a933515a5" : "")
        : getEnv("DANA_CLIENT_SECRET"),
      merchantId: isSandbox
        ? getEnv("DANA_SANDBOX_MERCHANT_ID") ||
          getEnv("DANA_MERCHANT_ID") ||
          (isTest ? "216620090021032077318" : "")
        : getEnv("DANA_MERCHANT_ID"),
      /** Akun deposit DANA merchant (format 628xxx) untuk transferToBank. Wajib di prod. */
      customerNumber: getEnv("DANA_CUSTOMER_NUMBER"),
      baseUrl: isSandbox
        ? getEnv("DANA_SANDBOX_BASE_URL") || getEnv("DANA_BASE_URL", "https://api.sandbox.dana.id")
        : getEnv("DANA_BASE_URL", "https://api.saas.dana.id"),
      publicKey: isSandbox
        ? resolveKeyOrFile("DANA_SANDBOX_PUBLIC_KEY", "keys/dana_sandbox_public.pem") ||
          resolveKeyOrFile("DANA_PUBLIC_KEY", "keys/dana_production_public.pem") ||
          (isTest ? cleanPemKey(DEFAULT_TEST_SANDBOX_PUBLIC_KEY) : "")
        : resolveKeyOrFile("DANA_PUBLIC_KEY", "keys/dana_production_public.pem"),
      privateKey: isSandbox
        ? resolveKeyOrFile("DANA_SANDBOX_PRIVATE_KEY", "keys/dana_sandbox_private.pem") ||
          resolveKeyOrFile("DANA_PRIVATE_KEY", "keys/dana_production_private.pem") ||
          (isTest ? cleanPemKey(DEFAULT_TEST_SANDBOX_PRIVATE_KEY) : "")
        : resolveKeyOrFile("DANA_PRIVATE_KEY", "keys/dana_production_private.pem"),
      platformFeePercent: 5, // 5% Merchant of Record platform fee
    };
  })(),

  xendit: {
    secretKey: getEnv("XENDIT_SECRET_KEY"),
    webhookToken: getEnv("XENDIT_WEBHOOK_VERIFICATION_TOKEN") || getEnv("XENDIT_WEBHOOK_TOKEN"),
    platformFeePercent: 5,
  },

  admin: {
    email: (getEnv("ADMIN_EMAIL") || "platformtertaut@gmail.com").toLowerCase(),
    password: getEnv("ADMIN_PASSWORD") || getEnv("ADMIN_DEFAULT_PASSWORD") || "",
  },
};
