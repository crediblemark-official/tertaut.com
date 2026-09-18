import { config } from "../config";
import { calculateMor } from "../utils/payment";

export interface CreateInvoiceParams {
  externalId: string;
  amount: number;
  payerEmail: string;
  description: string;
  successRedirectUrl?: string;
  failureRedirectUrl?: string;
  /** Batasi kanal pembayaran invoice (mis. ["QRIS"], ["BCA"], ["OVO"]). */
  paymentMethods?: string[];
  /** Paksa respons invoice mock untuk aplikasi yang berjalan dalam mode sandbox. */
  forceMock?: boolean;
}

export interface XenditInvoiceResponse {
  id: string;
  external_id: string;
  status: string;
  merchant_name: string;
  amount: number;
  payer_email: string;
  description: string;
  invoice_url: string;
  expiry_date: string;
}

export class XenditService {
  private static getHeaders() {
    const authString = Buffer.from(`${config.xendit.secretKey}:`).toString("base64");
    return {
      "Content-Type": "application/json",
      Authorization: `Basic ${authString}`,
    };
  }

  /**
   * Resolve rekening penerima disbursement dari profil builder.
   * Di production TIDAK PERNAH memakai rekening dummy — jika builder belum
   * menyimpan rekening, return null dan pencairan harus ditolak.
   * Rekening dummy hanya diizinkan di sandbox/development.
   */
  static resolveDisbursementAccount(
    builder: {
      name?: string | null;
      disbursementAccount?: {
        bankCode?: string;
        accountNumber?: string;
        accountHolderName?: string;
        eWalletType?: string;
        phoneNumber?: string;
      } | null;
    } | null | undefined
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

    // Hanya di sandbox/development: fallback eksplisit untuk pengujian lokal
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
   * Hitung kalkulasi Merchant of Record (MoR) fee 5%
   */
  static calculateMorBreakdown(amount: number) {
    return calculateMor(amount, config.xendit.platformFeePercent);
  }

  /**
   * Buat Invoice Pembayaran Xendit (QRIS, VA, E-Wallet, CC)
   */
  static async createInvoice(params: CreateInvoiceParams): Promise<XenditInvoiceResponse> {
    const mockEnabled =
      params.forceMock ||
      (config.isSandbox && (!config.xendit.secretKey || config.xendit.secretKey.includes("sample_key")));

    if (mockEnabled) {
      // Mock mode: development/sandbox lokal (XENDIT_SECRET_KEY belum diisi) atau
      // aplikasi yang sedang dalam mode sandbox (simulasi pembayaran tanpa charge nyata).
      console.warn("[XenditService] Using mock invoice response (sandbox mode / XENDIT_SECRET_KEY not configured)");
      return {
        id: `inv_mock_${Date.now()}`,
        external_id: params.externalId,
        status: "PENDING",
        merchant_name: "tertaut.com MoR",
        amount: params.amount,
        payer_email: params.payerEmail,
        description: params.description,
        invoice_url: `https://checkout.xendit.co/web/mock-${params.externalId}`,
        expiry_date: new Date(Date.now() + 86400000).toISOString(),
      };
    }

    if (!config.xendit.secretKey) {
      throw new Error("Xendit Invoice Creation Failed: XENDIT_SECRET_KEY tidak dikonfigurasi.");
    }

    const response = await fetch("https://api.xendit.co/v2/invoices", {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify({
        external_id: params.externalId,
        amount: params.amount,
        payer_email: params.payerEmail,
        description: params.description,
        success_redirect_url: params.successRedirectUrl,
        failure_redirect_url: params.failureRedirectUrl,
        ...(params.paymentMethods && params.paymentMethods.length > 0
          ? { payment_methods: params.paymentMethods }
          : {}),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Xendit Invoice Creation Failed: ${response.status} - ${errorText}`);
    }

    return (await response.json()) as XenditInvoiceResponse;
  }

  /**
   * Verifikasi callback webhook Xendit menggunakan x-callback-token
   */
  static verifyWebhook(callbackTokenHeader: string | null | undefined): boolean {
    if (!config.xendit.webhookToken) {
      if (config.isSandbox) return true; // dev bypass jika belum diisi
      console.warn("[XenditService] XENDIT_WEBHOOK_VERIFICATION_TOKEN belum dikonfigurasi. Menolak callback.");
      return false;
    }
    return callbackTokenHeader === config.xendit.webhookToken;
  }

  /**
   * Cairkan dana bersih (95% net) ke rekening bank atau e-wallet builder via Xendit Disbursement API
   */
  static async createDisbursement(params: {
    externalId: string;
    amount: number;
    bankCode: string;
    accountHolderName: string;
    accountNumber: string;
    description: string;
  }): Promise<{
    id: string;
    external_id: string;
    amount: number;
    bank_code: string;
    account_holder_name: string;
    status: string;
  }> {
    const mockEnabled =
      config.isSandbox && (!config.xendit.secretKey || config.xendit.secretKey.includes("sample_key"));

    if (mockEnabled) {
      return {
        id: `disb_mock_${Date.now()}`,
        external_id: params.externalId,
        amount: params.amount,
        bank_code: params.bankCode,
        account_holder_name: params.accountHolderName,
        status: "COMPLETED",
      };
    }

    if (!config.xendit.secretKey) {
      throw new Error("Xendit Disbursement Failed: XENDIT_SECRET_KEY tidak dikonfigurasi.");
    }

    const response = await fetch("https://api.xendit.co/disbursements", {
      method: "POST",
      headers: {
        ...this.getHeaders(),
        "X-IDEMPOTENCY-KEY": params.externalId,
      },
      body: JSON.stringify({
        external_id: params.externalId,
        amount: params.amount,
        bank_code: params.bankCode,
        account_holder_name: params.accountHolderName,
        account_number: params.accountNumber,
        description: params.description,
      }),
    });

    // Kegagalan gateway HARUS dilempar. Mengembalikan id rekaan akan membuat
    // ledger menyimpan disbursement_id yang tidak ada di Xendit dan transaksi
    // terlihat tercairkan padahal tidak.
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Xendit Disbursement Failed: ${response.status} - ${errorText}`);
    }

    return (await response.json()) as {
      id: string;
      external_id: string;
      amount: number;
      bank_code: string;
      account_holder_name: string;
      status: string;
    };
  }
}
