export type AppMode = "sandbox" | "live";

export interface DeliveryConfig {
  licenseKey?: {
    enabled: boolean;
    description?: string;
    expiresInDays?: number;
    maxSeats?: number;
  };
  fileDownload?: {
    enabled: boolean;
    title?: string;
    fileUrl?: string;
    fileName?: string;
  };
  apiAccess?: {
    enabled: boolean;
    scope?: string;
    endpointUrl?: string;
    instruction?: string;
  };
  privateNote?: {
    enabled: boolean;
    title?: string;
    note?: string;
  };
}

export interface MeteringConfig {
  enabled: boolean;
  template: "llm_tokens" | "api_calls" | "compute_minutes" | "storage" | "active_seats" | "custom" | string;
  name: string;
  aggregation: string;
  eventName?: string;
  calculationType?: string;
  unitLabel?: string;
  filters?: Array<{ property: string; value: string }>;
  unitPrice?: number;
  metricUnit?: string;
  freeAllowance?: number;
}

export type BillingPeriodType = "weekly" | "daily" | "monthly" | "every_3_months" | "every_6_months" | "yearly" | "custom";

export interface AppItem {
  id: string;
  builderId: string;
  name: string;
  slug: string;
  mode: AppMode;
  targetPrice: number;
  pricingType?: "one_time" | "subscription" | "free";
  billingPeriod?: "daily" | "weekly" | "monthly" | "every_3_months" | "every_6_months" | "yearly" | "custom" | string | null;
  trialPeriodDays?: number | null;
  deliveryConfig?: DeliveryConfig | null;
  meteringConfig?: MeteringConfig | null;
  description: string | null;
  headline?: string | null;
  subheadline?: string | null;
  mediaUrl?: string | null;
  valueProps?: string[] | null;
  ctaText?: string | null;
  customIntentMessage?: string | null;
  customHtml?: string | null;
  pageBlocks?: any[] | null;
  captureConfig?: Record<string, any> | null;
  redirectUrl: string | null;
  createdAt: string;
}


export interface DashboardStats {
  totalGMV: number;
  netEarnings: number;
  platformFeeCollected: number;
  activeLicenses: number;
  totalTransactions: number;
}

export interface CatalogKPIStats {
  activeProducts: number;
  archivedProducts: number;
  sales30d: number;
  activeSubscriptions: number;
  acrossProducts: number;
  customers30d: number;
}
