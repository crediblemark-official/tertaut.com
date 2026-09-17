export interface LicenseRecord {
  id: string;
  licenseKey: string;
  appId: string;
  status: string;
  expiresAt: Date | null;
  [key: string]: any;
}

export function isLicenseExpired(license: { expiresAt?: Date | null }): boolean {
  if (!license.expiresAt) return false;
  return new Date(license.expiresAt) < new Date();
}

export function validateLicenseStatus(license: LicenseRecord | null | undefined): {
  valid: boolean;
  reason?: string;
} {
  if (!license) {
    return { valid: false, reason: "LICENSE_NOT_FOUND" };
  }

  if (license.status !== "ACTIVE") {
    return { valid: false, reason: `LICENSE_${license.status}` };
  }

  if (isLicenseExpired(license)) {
    return { valid: false, reason: "LICENSE_EXPIRED" };
  }

  return { valid: true };
}
