/**
 * Unified Payment Gateway Interface
 * Mendefinisikan kontrak seragam untuk seluruh payment gateway (DANA, Xendit, dll.)
 * agar kode checkout, status polling, dan disbursement terisolasi 100% tanpa bentrok.
 */

export interface CreateGatewayOrderParams {
  externalId: string;
  amount: number;
  payerEmail: string;
  description: string;
  returnUrl?: string;
  finishRedirectUrl?: string;
  paymentRail?: "qris" | "va" | "ewallet" | "card" | "retail" | string;
  vaBank?: string;
  ewalletChannel?: string;
  retailOutlet?: "ALFAMART" | "INDOMARET" | string;
  scenario?: "API" | "REDIRECT";
  paymentMethods?: string[];
  forceMock?: boolean;
  allowMock?: boolean;
}

export interface GatewayOrderResponse {
  orderId: string;
  checkoutUrl: string;
  expiryDate?: string;
  scenario?: "API" | "REDIRECT";
  paymentRail?: string;
  paymentCode?: string;
  qrDataUrl?: string;
  vaBank?: string;
  retailOutlet?: string;
  mock?: boolean;
}

export interface GatewayStatusResponse {
  isPaid: boolean;
  isExpired: boolean;
  isFailed: boolean;
  paidAmount?: number;
  paymentCode?: string;
  paymentChannel?: string;
  raw?: any;
}

export interface GatewayDisbursementParams {
  externalId: string;
  amount: number;
  bankCode: string;
  accountHolderName: string;
  accountNumber: string;
  description: string;
}

export interface GatewayDisbursementResponse {
  id: string;
  externalId: string;
  amount: number;
  bankCode: string;
  accountHolderName: string;
  status: string;
}

export interface MorBreakdown {
  grossAmount: number;
  platformFee: number;
  netAmount: number;
}

export interface PaymentGatewayAdapter {
  readonly id: "dana" | "xendit";
  readonly displayName: string;

  /**
   * Hitung pemotongan Merchant of Record (5% platform, 95% net builder)
   */
  calculateMor(amount: number): MorBreakdown;

  /**
   * Buat sesi order pembayaran
   */
  createOrder(params: CreateGatewayOrderParams): Promise<GatewayOrderResponse>;

  /**
   * Cek / query status transaksi langsung ke server gateway (sinkronisasi polling)
   */
  queryOrderStatus(params: {
    externalId: string;
    referenceNo?: string;
  }): Promise<GatewayStatusResponse>;

  /**
   * Verifikasi keamanan webhook callback
   */
  verifyWebhook(headers: Record<string, string | undefined>, body?: any): Promise<boolean>;

  /**
   * Eksekusi pencairan dana ke rekening bank builder
   */
  createDisbursement(params: GatewayDisbursementParams): Promise<GatewayDisbursementResponse>;
}
