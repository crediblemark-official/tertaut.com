import { xenditGateway } from "./gateways/xenditGateway";
import { config } from "../config";

export interface CreateXenditOrderParams {
  externalId: string;
  amount: number;
  payerEmail: string;
  description: string;
  returnUrl?: string;
  finishRedirectUrl?: string;
  forceMock?: boolean;
  allowMock?: boolean;
  scenario?: "API" | "REDIRECT";
  paymentRail?: "qris" | "va" | "ewallet";
  vaBank?: string;
  paymentMethods?: string[];
}

export interface XenditOrderResponse {
  orderId: string;
  checkoutUrl: string;
  expiryDate?: string;
  scenario?: "API" | "REDIRECT";
  paymentRail?: string;
  paymentCode?: string;
  qrDataUrl?: string;
  vaBank?: string;
  mock?: boolean;
}

/**
 * XenditService Facade
 * Mempertahankan backward compatibility untuk callers yang mengimpor XenditService langsung,
 * dengan mendelegasikan eksekusi ke modular XenditGatewayAdapter yang ditenagai official `xendit-node` SDK.
 */
export class XenditService {
  /**
   * Mengambil kredensial Xendit secara dinamis
   */
  static async getCredentials() {
    return xenditGateway.getCredentials();
  }

  /**
   * Hitung kalkulasi Merchant of Record (MoR) fee 5% platform fee & 95% net
   */
  static calculateMorBreakdown(amount: number) {
    return xenditGateway.calculateMor(amount);
  }

  /**
   * Resolve rekening penerima disbursement dari profil builder
   */
  static resolveDisbursementAccount(
    builder:
      | {
          name?: string | null;
          disbursementAccount?: {
            bankCode?: string;
            accountNumber?: string;
            accountHolderName?: string;
            eWalletType?: string;
            phoneNumber?: string;
          } | null;
        }
      | null
      | undefined
  ): {
    bankCode: string;
    accountNumber: string;
    accountHolderName: string;
  } | null {
    const acc = builder?.disbursementAccount;

    if (acc?.accountNumber && acc?.bankCode) {
      return {
        bankCode: acc.bankCode,
        accountNumber: acc.accountNumber,
        accountHolderName: acc.accountHolderName || builder?.name || "Builder",
      };
    }

    if (config.isSandbox) {
      return {
        bankCode: "BCA",
        accountNumber: "1234567890000",
        accountHolderName: builder?.name || "Sandbox Builder",
      };
    }

    return null;
  }

  /**
   * Buat Sesi Pembayaran / Invoice Xendit via official xendit-node SDK
   */
  static async createOrder(params: CreateXenditOrderParams): Promise<XenditOrderResponse> {
    return xenditGateway.createOrder(params);
  }

  /**
   * Mengambil status invoice Xendit secara langsung (untuk polling sinkronisasi)
   */
  static async getInvoice(invoiceId: string) {
    const res = await xenditGateway.queryOrderStatus({ externalId: "", referenceNo: invoiceId });
    return res.raw;
  }

  /**
   * Verifikasi callback webhook Xendit menggunakan x-callback-token
   */
  static async verifyWebhook(callbackTokenHeader: string | null | undefined): Promise<boolean> {
    return xenditGateway.verifyWebhook({ "x-callback-token": callbackTokenHeader || undefined });
  }

  /**
   * Cairkan dana bersih (95% net) via official xendit-node Payout SDK
   */
  static async createDisbursement(params: {
    externalId: string;
    amount: number;
    bankCode: string;
    accountHolderName: string;
    accountNumber: string;
    description: string;
  }) {
    const res = await xenditGateway.createDisbursement(params);
    return {
      id: res.id,
      external_id: res.externalId,
      amount: res.amount,
      bank_code: res.bankCode,
      account_holder_name: res.accountHolderName,
      status: res.status,
    };
  }
}
