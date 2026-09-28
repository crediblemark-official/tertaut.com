export interface PanelStats {
  totalGMV: number;
  platformFeeRevenue: number;
  netBuilderShare: number;
  totalTransactions: number;
  paidTransactions: number;
  pendingDisbursementsAmount: number;
  pendingDisbursementsCount: number;
  totalApps: number;
  totalBuilders: number;
  totalLicensesIssued: number;
  system: {
    nodeEnv: string;
    bunVersion: string;
    uptimeSeconds: number;
    memoryUsageMB: {
      rss: number;
      heapTotal: number;
      heapUsed: number;
    };
  };
}

export interface PanelBuilderItem {
  id: string;
  email: string;
  name: string;
  role?: string;
  bankAccount?: {
    bankName: string;
    accountNumber: string;
    accountHolder: string;
  };
  disbursementAccount?: {
    bankCode: string;
    accountNumber: string;
    accountHolderName: string;
  };
  isSuspended?: boolean;
  appCount?: number;
  totalApps?: number;
  apps?: Array<{
    id: string;
    name: string;
    slug: string;
    mode: string;
    isSuspended?: boolean;
  }>;
  totalSales?: number;
  totalGMV?: number;
  builderNetRevenue?: number;
  totalNetEarnings?: number;
  pendingPayout?: number;
  createdAt: string;
}

export interface PanelTransactionItem {
  id: string;
  appId: string;
  appName: string;
  builderEmail: string;
  customerEmail: string;
  grossAmount: number;
  platformFee: number;
  netAmount: number;
  paymentStatus: string;
  disbursementStatus: string;
  disbursementId: string | null;
  createdAt: string;
}

export interface PlatformSettingsFormData {
  platform_fee_percent: string;
  min_payout_threshold: string;
  announcement_banner: string;
  announcement_type: string;
  active_payment_gateway: string;
  xendit_secret_key: string;
  xendit_webhook_token: string;
  xenithpay_sandbox_access_key: string;
  xenithpay_sandbox_secret_key: string;
  xenithpay_sandbox_webhook_secret: string;
  dana_sandbox_client_id: string;
  dana_sandbox_client_secret: string;
  dana_sandbox_merchant_id: string;
  checkout_mode: string;
  sandbox_mode: string;
}

export interface PanelAppItem {
  id: string;
  name: string;
  slug: string;
  builderId: string;
  builderName: string;
  builderEmail: string;
  mode: "sandbox" | "live" | string;
  isSuspended: boolean;
  targetPrice: number;
  pricingType: string;
  licenseCount: number;
  totalGMV: number;
  deliveryType: string;
  createdAt: string;
}

export interface PanelLicenseItem {
  id: string;
  licenseKey: string;
  appId: string;
  appName: string;
  appSlug: string;
  builderName: string;
  builderEmail: string;
  customerEmail: string;
  status: "ACTIVE" | "REVOKED" | "EXPIRED" | string;
  maxSeats: number;
  usedSeats: number;
  platform: string;
  hardwareId: string | null;
  hasOfflineToken: boolean;
  expiresAt: string | null;
  lastValidatedAt: string | null;
  createdAt: string;
}

export interface PanelCouponItem {
  id: string;
  code: string;
  appId: string | null;
  appName: string;
  appSlug: string | null;
  isGlobal: boolean;
  discountPercent: number;
  maxRedemptions: number;
  redemptionCount: number;
  isActive: boolean;
  expiresAt: string | null;
  createdAt: string;
}

export interface PanelAuditLogItem {
  id: string;
  licenseId: string | null;
  licenseKey: string | null;
  appId: string | null;
  event: string;
  actorType: "ADMIN" | "BUILDER" | "S2S" | "SYSTEM" | "CLIENT" | string;
  actorId: string | null;
  payload: Record<string, any>;
  ipAddress: string | null;
  createdAt: string;
}

export interface PanelUserItem {
  id: string;
  name: string;
  email: string;
  role: string;
  emailVerified: boolean;
  banned: boolean;
  banReason: string | null;
  createdAt: string;
}
