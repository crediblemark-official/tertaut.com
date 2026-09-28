/**
 * @tertaut/sdk Custom Error Classes
 *
 * Semua modul melempar subclass `TertautError` saat server merespons HTTP error,
 * sehingga consumer bisa melakukan branching via `instanceof` alih-alih
 * memeriksa bentuk payload secara manual.
 */

export class TertautError extends Error {
  public code?: string;
  public status?: number;
  public details?: any;

  constructor(message: string, options?: { code?: string; status?: number; details?: any }) {
    super(message);
    this.name = "TertautError";
    this.code = options?.code;
    this.status = options?.status;
    this.details = options?.details;
  }
}

export class LicenseExpiredError extends TertautError {
  constructor(message = "Lisensi telah kedaluwarsa.", details?: any) {
    super(message, { code: "TOKEN_EXPIRED", status: 403, details });
    this.name = "LicenseExpiredError";
  }
}

export class LicenseRevokedError extends TertautError {
  constructor(message = "Lisensi telah dicabut (REVOKED).", details?: any) {
    super(message, { code: "TOKEN_REVOKED", status: 403, details });
    this.name = "LicenseRevokedError";
  }
}

export class SeatLimitExceededError extends TertautError {
  constructor(message = "Batas maksimum seat perangkat telah tercapai.", details?: any) {
    super(message, { code: "SEAT_FULL", status: 403, details });
    this.name = "SeatLimitExceededError";
  }
}

export class HeartbeatLeaseError extends TertautError {
  constructor(
    message = "Lease floating license tidak valid atau telah hangus.",
    code = "LEASE_EXPIRED",
    details?: any
  ) {
    super(message, { code, status: code === "LEASE_INVALID" ? 403 : 409, details });
    this.name = "HeartbeatLeaseError";
  }
}

export class InsufficientCreditsError extends TertautError {
  constructor(message = "Saldo kredit lisensi tidak mencukupi.", details?: any) {
    super(message, { code: "INSUFFICIENT_CREDITS", status: 402, details });
    this.name = "InsufficientCreditsError";
  }
}

export class VersionFloorError extends TertautError {
  constructor(message = "Versi aplikasi terlalu lama untuk lisensi ini.", minVersion?: string) {
    super(message, { code: "APP_VERSION_TOO_OLD", status: 403, details: { minVersion } });
    this.name = "VersionFloorError";
  }
}

export class TertautRateLimitError extends TertautError {
  /** Sisa detik yang disarankan server menunggu sebelum mencoba lagi. */
  public retryAfter?: number;

  constructor(message = "Terlalu banyak permintaan. Coba lagi sebentar lagi.", details?: any) {
    super(message, { code: "RATE_LIMITED", status: 429, details });
    this.name = "TertautRateLimitError";
    this.retryAfter = typeof details?.retryAfter === "number" ? details.retryAfter : undefined;
  }
}

const CODE_PATTERN = /^[A-Z][A-Z0-9_]*$/;

function isCodeLike(value: unknown): value is string {
  return typeof value === "string" && CODE_PATTERN.test(value);
}

/**
 * Server memakai lebih dari satu bentuk envelope, jadi normalisasi dulu:
 * - `{ success:false, error:"pesan" }`            → pesan di `error`
 * - `{ valid:false, reason:"KODE", message:"…" }`  → kode di `reason`
 * - `{ success:false, error:"KODE", message:"…" }` → AI proxy, kode di `error`
 * - `{ error:{ code, message } }`                  → envelope global Elysia
 */
export function parseErrorPayload(payload: any): { code?: string; message?: string } {
  if (payload == null) return {};
  if (typeof payload === "string") return { message: payload };
  if (typeof payload !== "object") return {};

  const env = payload.error && typeof payload.error === "object" ? payload.error : undefined;

  const code =
    (isCodeLike(payload.reason) && payload.reason) ||
    (isCodeLike(payload.errorCode) && payload.errorCode) ||
    (isCodeLike(payload.error) && payload.error) ||
    (isCodeLike(env?.code) ? env.code : undefined);

  const message =
    (typeof payload.message === "string" && payload.message) ||
    (typeof payload.error === "string" && !isCodeLike(payload.error) ? payload.error : undefined) ||
    (typeof env?.message === "string" ? env.message : undefined);

  return { code, message };
}

/**
 * Bangun error bertipe dari respons HTTP gagal. Prioritas: kode eksplisit,
 * lalu status HTTP sebagai fallback.
 */
export function createTertautError(
  status: number,
  payload: any,
  options?: { path?: string; statusText?: string }
): TertautError {
  const { code, message } = parseErrorPayload(payload);
  const details: any = payload && typeof payload === "object" ? { ...payload } : {};
  if (options?.path) details.path = options.path;
  if (code) details.code = code;

  const msg =
    message || options?.statusText || `Permintaan ke ${options?.path || "API"} gagal (${status}).`;

  switch (code) {
    case "TOKEN_EXPIRED":
    case "LICENSE_EXPIRED":
    case "EXPIRED":
      return new LicenseExpiredError(msg, details);
    case "TOKEN_REVOKED":
    case "LICENSE_REVOKED":
    case "REVOKED":
      return new LicenseRevokedError(msg, details);
    case "SEAT_FULL":
      return new SeatLimitExceededError(msg, details);
    // `LEASE_MISMATCH` dan `LEASE_STALE` adalah kode yang benar-benar dikirim
    // server; `LEASE_EXPIRED`/`LEASE_INVALID` dipertahankan untuk kompatibilitas.
    case "LEASE_MISMATCH":
    case "LEASE_STALE":
    case "LEASE_EXPIRED":
    case "LEASE_INVALID":
      return new HeartbeatLeaseError(msg, code, details);
    case "INSUFFICIENT_CREDITS":
      return new InsufficientCreditsError(msg, details);
    case "APP_VERSION_TOO_OLD":
      return new VersionFloorError(msg, payload?.minVersion);
    case "RATE_LIMITED":
    case "RATE_LIMIT_EXCEEDED":
    case "DAILY_TOKEN_LIMIT_EXCEEDED":
      return new TertautRateLimitError(msg, details);
  }

  if (status === 429) return new TertautRateLimitError(msg, details);
  if (status === 402) return new InsufficientCreditsError(msg, details);

  return new TertautError(msg, { code, status, details });
}
