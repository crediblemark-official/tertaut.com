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
