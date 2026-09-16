export type LicensePlatform =
  | "web"
  | "desktop"
  | "chrome_extension"
  | "android"
  | "general";

export type LicenseStatus = "ACTIVE" | "REVOKED" | "EXPIRED";

export interface LicenseActivationItem {
  id: string;
  licenseId: string;
  hwidHash: string;
  deviceName?: string | null;
  ipAddress?: string | null;
  lastValidatedAt: string;
  createdAt: string;
}

export interface LicenseItem {
  id: string;
  appId: string;
  licenseKey: string;
  customerEmail: string;
  hardwareId: string | null;
  platform: LicensePlatform;
  status: LicenseStatus;
  maxSeats: number;
  seatsUsed?: number;
  activations?: LicenseActivationItem[];
  expiresAt: string | null;
  createdAt: string;
}

export interface IssueLicensePayload {
  appId: string;
  customerEmail: string;
  grantDays?: number;
  maxSeats?: number;
  platform?: LicensePlatform;
}
