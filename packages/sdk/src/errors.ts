/**
 * @tertaut/sdk Custom Error Classes
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
  constructor(message = "Lease floating license tidak valid atau telah hangus.", code = "LEASE_EXPIRED") {
    super(message, { code, status: code === "LEASE_INVALID" ? 403 : 409 });
    this.name = "HeartbeatLeaseError";
  }
}

export class InsufficientCreditsError extends TertautError {
  constructor(message = "Saldo kredit lisensi tidak mencukupi.", details?: any) {
    super(message, { code: "INSUFFICIENT_CREDITS", status: 409, details });
    this.name = "InsufficientCreditsError";
  }
}

export class VersionFloorError extends TertautError {
  constructor(message = "Versi aplikasi terlalu lama untuk lisensi ini.", minVersion?: string) {
    super(message, { code: "APP_VERSION_TOO_OLD", status: 403, details: { minVersion } });
    this.name = "VersionFloorError";
  }
}
