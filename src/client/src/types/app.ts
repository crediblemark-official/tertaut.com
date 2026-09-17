export type AppMode = "sandbox" | "live";

export interface AppItem {
  id: string;
  builderId: string;
  name: string;
  slug: string;
  mode: AppMode;
  targetPrice: number;
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
