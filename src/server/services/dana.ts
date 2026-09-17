import { config } from "../config";
import crypto from "crypto";

export interface CreateDanaOrderParams {
  externalId: string;
  amount: number;
  payerEmail: string;
  description: string;
  returnUrl?: string;
  finishRedirectUrl?: string;
  forceMock?: boolean;
}

export interface DanaOrderResponse {
  orderId: string;
  externalId: string;
  status: string;
  merchantName: string;
  amount: number;
  payerEmail: string;
  description: string;
  checkoutUrl: string;
  expiryDate: string;
}

export class DanaService {
  /**
   * Hitung kalkulasi Merchant of Record (MoR) fee 5% platform fee & 95% net
   */
  static calculateMorBreakdown(amount: number) {
    const feeRate = config.dana.platformFeePercent / 100;
    const platformFee = Math.round(amount * feeRate);
    const netAmount = amount - platformFee;

    return {
      grossAmount: amount,
      platformFee,
      netAmount,
    };
  }

  /**
   * Buat Order / Checkout Payment DANA (E-Wallet, QRIS, Direct Debit)
   */
  static async createOrder(params: CreateDanaOrderParams): Promise<DanaOrderResponse> {
    const mockEnabled =
      params.forceMock ||
      (config.isSandbox && (!config.dana.clientId || !config.dana.clientSecret));

    const defaultRedirect =
      params.returnUrl ||
      params.finishRedirectUrl ||
      `${config.publicAppUrl}/checkout/dana/finish?orderId=${params.externalId}`;

    if (mockEnabled) {
      console.warn(
        "[DanaService] Using mock order response (sandbox mode / DANA credentials not configured yet)"
      );
      const mockOrderId = `dana_order_${Date.now()}`;
      return {
        orderId: mockOrderId,
        externalId: params.externalId,
        status: "INIT",
        merchantName: "tertaut.com MoR (DANA)",
        amount: params.amount,
        payerEmail: params.payerEmail,
        description: params.description,
        checkoutUrl: `${config.publicAppUrl}/checkout/dana/finish?orderId=${params.externalId}&mock=true`,
        expiryDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      };
    }

    if (!config.dana.clientId || !config.dana.privateKey) {
      throw new Error("DANA Order Creation Failed: DANA_CLIENT_ID / DANA_PRIVATE_KEY tidak dikonfigurasi.");
    }

    // Pemanggilan DANA Enterprise Host-to-Host Create Order API (SNAP BI Standard)
    const endpointPath = "/payment-gateway/v1.0/debit/payment-host-to-host.htm";
    const endpoint = `${config.dana.baseUrl}${endpointPath}`;

    const d = new Date(Date.now() + 7 * 3600 * 1000);
    const pad = (n: number) => String(n).padStart(2, "0");
    const ts = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}+07:00`;

    const validUpDate = new Date(Date.now() + 7 * 3600 * 1000 + 30 * 60 * 1000); // 30 mins
    const validUpTo = `${validUpDate.getUTCFullYear()}-${pad(validUpDate.getUTCMonth() + 1)}-${pad(validUpDate.getUTCDate())}T${pad(validUpDate.getUTCHours())}:${pad(validUpDate.getUTCMinutes())}:${pad(validUpDate.getUTCSeconds())}+07:00`;

    const payload = {
      partnerReferenceNo: params.externalId,
      merchantId: config.dana.merchantId || config.dana.clientId,
      subMerchantId: "",
      amount: {
        value: `${params.amount.toFixed(2)}`,
        currency: "IDR",
      },
      externalStoreId: "",
      urlParams: [
        {
          url: defaultRedirect,
          type: "PAY_RETURN",
          isDeeplink: "Y",
        },
        {
          url: `${config.publicAppUrl}/webhook/dana/notify`,
          type: "NOTIFICATION",
          isDeeplink: "Y",
        },
      ],
      validUpTo: validUpTo,
      additionalInfo: {
        order: {
          orderTitle: params.description || "Payment Order",
          scenario: "REDIRECT",
          merchantTransType: "SPECIAL_MOVIE",
          buyer: {},
        },
        mcc: "5732",
        envInfo: {
          sourcePlatform: "IPG",
          terminalType: "SYSTEM",
          orderTerminalType: "WEB",
        },
        extendInfo: JSON.stringify({ key: "value" }),
      },
    };

    const minified = JSON.stringify(payload);
    const rawKey = config.dana.privateKey;
    const pem = `-----BEGIN PRIVATE KEY-----\n${rawKey.match(/.{1,64}/g)?.join("\n")}\n-----END PRIVATE KEY-----`;
    const hash = crypto.createHash("sha256").update(minified).digest("hex");
    const stringToSign = `POST:${endpointPath}:${hash}:${ts}`;
    const sig = crypto.sign("sha256", Buffer.from(stringToSign), pem).toString("base64");

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-TIMESTAMP": ts,
          "X-SIGNATURE": sig,
          "ORIGIN": config.publicAppUrl || "https://tertaut.com",
          "X-PARTNER-ID": config.dana.clientId,
          "X-EXTERNAL-ID": "sdk" + crypto.randomUUID().substring(3),
          "CHANNEL-ID": `${config.dana.clientId}-SERVER`,
        },
        body: minified,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`DANA Create Order Failed: ${response.status} - ${errorText}`);
      }

      const resData = (await response.json()) as any;
      const orderId =
        resData?.referenceNo ||
        resData?.partnerReferenceNo ||
        params.externalId;
      const checkoutUrl =
        resData?.webRedirectUrl ||
        `${config.publicAppUrl}/checkout/dana/finish?orderId=${params.externalId}`;

      return {
        orderId,
        externalId: params.externalId,
        status: "INIT",
        merchantName: "tertaut.com MoR (DANA)",
        amount: params.amount,
        payerEmail: params.payerEmail,
        description: params.description,
        checkoutUrl,
        expiryDate: validUpTo,
      };
    } catch (err: any) {
      console.error("[DanaService] API Call Error:", err.message);
      throw err;
    }
  }

  /**
   * Verifikasi Webhook DANA Finish Payment & Disburse Notify
   */
  static verifyWebhook(headers: Record<string, string | undefined>, body: any): boolean {
    if (config.isSandbox && (!config.dana.publicKey || !config.dana.clientSecret)) {
      return true; // Bypass verifikasi di sandbox saat credential belum diset
    }

    const signature = headers["signature"] || headers["x-signature"];
    if (!signature) {
      if (config.isSandbox) return true;
      console.warn("[DanaService] Missing signature header in DANA webhook.");
      return false;
    }

    // Jika public key RSA tersedia, verifikasi SHA256withRSA
    if (config.dana.publicKey) {
      try {
        const verifier = crypto.createVerify("SHA256");
        verifier.update(typeof body === "string" ? body : JSON.stringify(body));
        return verifier.verify(config.dana.publicKey, signature, "base64");
      } catch (err: any) {
        console.warn("[DanaService] Signature verification exception:", err.message);
        return false;
      }
    }

    return true;
  }

  /**
   * Cairkan dana bersih builder via DANA Disburse to Bank / Payout
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
      config.isSandbox && (!config.dana.clientId || !config.dana.clientSecret);

    if (mockEnabled) {
      return {
        id: `dana_disb_mock_${Date.now()}`,
        external_id: params.externalId,
        amount: params.amount,
        bank_code: params.bankCode,
        account_holder_name: params.accountHolderName,
        status: "COMPLETED",
      };
    }

    if (!config.dana.clientId || !config.dana.clientSecret) {
      throw new Error("DANA Disbursement Failed: Kredensial DANA tidak dikonfigurasi.");
    }

    const response = await fetch(`${config.dana.baseUrl}/dana/v1/disbursement/transferToBank`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CLIENT-ID": config.dana.clientId,
        "X-TIMESTAMP": new Date().toISOString(),
      },
      body: JSON.stringify({
        partnerReferenceNo: params.externalId,
        amount: {
          currency: "IDR",
          value: params.amount.toString(),
        },
        beneficiaryAccountNo: params.accountNumber,
        beneficiaryBankCode: params.bankCode,
        beneficiaryName: params.accountHolderName,
        remark: params.description,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`DANA Disbursement Failed: ${response.status} - ${errorText}`);
    }

    const resData = (await response.json()) as any;
    return {
      id: resData?.acquirementId || `dana_disb_${Date.now()}`,
      external_id: params.externalId,
      amount: params.amount,
      bank_code: params.bankCode,
      account_holder_name: params.accountHolderName,
      status: "COMPLETED",
    };
  }
}
