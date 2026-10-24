import { existsSync, readFileSync } from "fs";

export function getEnv(key: string, fallback = ""): string {
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
const isTest = nodeEnv === "test" || process.env.NODE_ENV === "test";

const DEFAULT_JWT_SECRET = "tertaut_default_jwt_secret_change_me_in_production";

/** Persentase fee potongan Merchant of Record resmi (5% platform, 95% net builder). */
export const PLATFORM_FEE_PERCENT = 5;

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
    const isStrict = getEnv("STRICT_SECRETS", isProd ? "true" : "false") === "true";
    if (isProd && isStrict) {
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
    return "http://localhost:5173";
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
    /**
     * Satu sumber koneksi: connection string PostgreSQL dari environment (DATABASE_URL).
     * Saat pengujian otomatis (isTest / bun test), otomatis dialihkan ke database '[dbname]_test'
     * jika belum menggunakan suffix _test, agar tidak pernah mengotori database utama.
     */
    url: (() => {
      const mainUrl = requireEnv("DATABASE_URL");
      if (isTest) {
        return mainUrl.replace(/\/([^/?]+)(\?.*)?$/, (_match, dbName, query = "") => {
          if (dbName.endsWith("_test")) return `/${dbName}${query}`;
          return `/${dbName}_test${query}`;
        });
      }
      return mainUrl;
    })(),
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

  paymentGateway: "xendit" as const,

  xendit: {
    secretKey: getEnv("XENDIT_SECRET_KEY"),
    webhookToken: getEnv("XENDIT_WEBHOOK_VERIFICATION_TOKEN") || getEnv("XENDIT_WEBHOOK_TOKEN"),
    platformFeePercent: PLATFORM_FEE_PERCENT,
  },

  admin: {
    email: (getEnv("ADMIN_EMAIL") || "platformtertaut@gmail.com").toLowerCase(),
    password: getEnv("ADMIN_PASSWORD") || getEnv("ADMIN_DEFAULT_PASSWORD") || "",
  },
};
