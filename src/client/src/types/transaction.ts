export type PaymentStatus = "PENDING" | "PAID" | "EXPIRED" | "FAILED";
export type DisbursementStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";

export interface TransactionItem {
  id: string;
  appId: string;
  customerEmail: string;
  grossAmount: number;
  platformFee: number;
  netAmount: number;
  paymentStatus: PaymentStatus;
  disbursementStatus: DisbursementStatus;
  disbursementId: string | null;
  grantDays: number;
  xenditInvoiceUrl: string | null;
  createdAt: string;
}

export interface CreateCheckoutPayload {
  appId: string;
  amount: number;
  customerEmail: string;
  grantDays?: number;
  redirectUrl?: string;
}
