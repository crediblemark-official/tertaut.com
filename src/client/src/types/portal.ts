export interface PortalLicenseActivation {
  id: string;
  hwidHash: string;
  deviceName: string | null;
  ipAddress: string | null;
  lastValidatedAt: string;
  createdAt: string;
}

export interface PortalLicenseItem {
  id: string;
  appId: string;
  appName: string;
  appSlug: string;
  licenseKey: string;
  customerEmail: string;
  platform: string;
  status: "ACTIVE" | "REVOKED" | "EXPIRED";
  maxSeats: number;
  seatsUsed: number;
  expiresAt: string | null;
  createdAt: string;
  offlineJwt?: string | null;
  activations: PortalLicenseActivation[];
}

export interface PortalTransactionItem {
  id: string;
  appId: string;
  appName: string;
  customerEmail: string;
  grossAmount: number;
  paymentStatus: "PENDING" | "PAID" | "EXPIRED" | "FAILED";
  grantDays: number;
  xenditInvoiceUrl: string | null;
  createdAt: string;
  licenseKey: string | null;
}
