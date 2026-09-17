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
  privateNote?: {
    enabled: boolean;
    title?: string;
    note?: string;
  };
}

export interface MeteringConfig {
  enabled: boolean;
  template: "llm_tokens" | "api_calls" | "compute_minutes" | "storage" | "active_seats" | "custom";
  name: string;
  aggregation: string;
  unitPrice?: number;
  metricUnit?: string;
}

export interface AppItem {
  id: string;
  builderId: string;
  name: string;
  slug: string;
  mode: AppMode;
  targetPrice: number;
  pricingType?: "one_time" | "subscription" | "free";
  billingPeriod?: "monthly" | "yearly" | null;
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
