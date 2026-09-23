export type LicensePlatform = "web" | "desktop" | "chrome_extension" | "android" | "general";

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

/** Satu seat perangkat dari /licensing/seats (aktivasi + lease floating). */
export interface LicenseSeatItem {
  hwidHash: string;
  deviceName?: string | null;
  ipAddress?: string | null;
  lastValidatedAt: string | null;
  createdAt: string;
  leaseActive: boolean | null;
  leaseExpiresAt: string | null;
  lastHeartbeatAt: string | null;
}

export interface SeatsResponse {
  success: boolean;
  licenseKey: string;
  appId?: string;
  customerEmail?: string;
  status?: string;
  floating: boolean;
  maxSeats: number;
  seatsUsed: number;
  leaseTtlSeconds: number | null;
  seats: LicenseSeatItem[];
}

/** Baris audit event-sourced dari /licensing/events (Fase 4). */
export interface LicenseEventItem {
  id: string;
  licenseId: string | null;
  licenseKey: string | null;
  appId: string | null;
  event: string;
  actorType: "ADMIN" | "BUILDER" | "S2S" | "SYSTEM" | "CLIENT";
  actorId?: string | null;
  payload?: Record<string, any> | null;
  ipAddress?: string | null;
  createdAt: string;
}

export interface EventsResponse {
  success: boolean;
  events: LicenseEventItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface WebhookEndpointItem {
  id: string;
  builderId: string;
  url: string;
  secret: string;
  events: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
