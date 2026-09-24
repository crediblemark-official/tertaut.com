import { config } from "../config";
import { calculateMor } from "../utils/payment";
import { db } from "../db";
import { platformSettings } from "../db/schema/settings";
import { eq } from "drizzle-orm";
import QRCode from "qrcode";

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
  expiryDate: string;
  scenario?: "API" | "REDIRECT";
  paymentRail?: "qris" | "va" | "ewallet";
  paymentCode?: string;
  qrDataUrl?: string;
  vaBank?: string;
  mock?: boolean;
}

export class XenditService {
  /**
   * Mengambil kredensial Xendit secara dinamis:
   * Prioritas: platform_settings di database -> config/env
   */
  static async getCredentials(): Promise<{ secretKey: string; webhookToken: string }> {
    try {
      const [keyRow, tokenRow] = await Promise.all([
        db.query.platformSettings.findFirst({
          where: eq(platformSettings.key, "xendit_secret_key"),
        }),
        db.query.platformSettings.findFirst({
          where: eq(platformSettings.key, "xendit_webhook_token"),
        }),
      ]);

      const secretKey = keyRow?.value?.trim() || config.xendit.secretKey || "";
      const webhookToken = tokenRow?.value?.trim() || config.xendit.webhookToken || "";

      return { secretKey, webhookToken };
    } catch {
      return {
        secretKey: config.xendit.secretKey || "",
        webhookToken: config.xendit.webhookToken || "",
      };
    }
  }

  private static getHeaders(secretKey: string) {
    const authString = Buffer.from(`${secretKey}:`).toString("base64");
    return {
      "Content-Type": "application/json",
      Authorization: `Basic ${authString}`,
    };
  }

  /**
   * Hitung kalkulasi Merchant of Record (MoR) fee 5% platform fee & 95% net
   */
  static calculateMorBreakdown(amount: number) {
    return calculateMor(amount, config.xendit.platformFeePercent);
  }

  /**
   * Resolve rekening penerima disbursement dari profil builder.
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
   * Buat Sesi Pembayaran / Invoice Xendit
   */
  static async createOrder(params: CreateXenditOrderParams): Promise<XenditOrderResponse> {
    const { secretKey } = await this.getCredentials();

    const buildMockResponse = async (): Promise<XenditOrderResponse> => {
      const rail = params.paymentRail || "qris";
      const bank = (params.vaBank || "BCA").toUpperCase();

      let paymentCode: string | undefined;
      let qrDataUrl: string | undefined;

      if (rail === "va") {
        const bankPrefixMap: Record<string, string> = {
          BCA: "3901",
          MANDIRI: "88908",
          BNI: "8808",
          BRI: "8809",
          CIMB: "2599",
          PERMATA: "8528",
        };
        const prefix = bankPrefixMap[bank] || "3901";
        paymentCode = `${prefix}99${Math.floor(1000000000 + Math.random() * 9000000000)}`;
      } else {
        const qrString = `00020101021226540014ID.XENDIT.WWW011893600911000000000002152026092400000000303UMI51440014ID.XENDIT.WWW0215202609240000000520457325303360540${Number(params.amount).toFixed(2)}5802ID5911Tertaut MoR6007Jakarta61051234062330114${params.externalId}6304ABCD`;
        try {
          qrDataUrl = await QRCode.toDataURL(qrString, { width: 320, margin: 2 });
        } catch {
          qrDataUrl = "";
        }
      }

      return {
        orderId: `xnd_inv_${Date.now()}`,
        checkoutUrl: `https://checkout.xendit.co/web/mock-${params.externalId}`,
        expiryDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        scenario: params.scenario || "API",
        paymentRail: rail,
        paymentCode,
        qrDataUrl,
        vaBank: bank,
        mock: true,
      };
    };

    const isDummyKey =
      !secretKey ||
      secretKey.includes("sample_key") ||
      secretKey.includes("dummy") ||
      secretKey.includes("test_");

    const mockEnabled =
      Boolean(params.forceMock) || (params.allowMock && (isDummyKey || config.isTest));

    if (mockEnabled) {
      return buildMockResponse();
    }

    if (!secretKey) {
      if (params.allowMock) {
        return buildMockResponse();
      }
      throw new Error("Xendit Invoice Creation Failed: XENDIT_SECRET_KEY belum dikonfigurasi.");
    }

    // Bangun payment_methods jika spesifik
    const paymentMethods: string[] = [];
    if (params.paymentRail === "qris") {
      paymentMethods.push("QRIS");
    } else if (params.paymentRail === "va" && params.vaBank) {
      paymentMethods.push(params.vaBank.toUpperCase());
    } else if (params.paymentMethods && params.paymentMethods.length > 0) {
      paymentMethods.push(...params.paymentMethods);
    }

    const payload: any = {
      external_id: params.externalId,
      amount: params.amount,
      payer_email: params.payerEmail,
      description: params.description,
      success_redirect_url: params.finishRedirectUrl || params.returnUrl,
      failure_redirect_url: params.returnUrl,
      invoice_duration: 86400, // 24 jam
    };

    if (paymentMethods.length > 0) {
      payload.payment_methods = paymentMethods;
    }

    let response: Response;
    try {
      response = await fetch("https://api.xendit.co/v2/invoices", {
        method: "POST",
        headers: this.getHeaders(secretKey),
        body: JSON.stringify(payload),
      });
    } catch (networkErr: any) {
      if (params.allowMock) {
        console.warn(
          "[XenditService] Network error to Xendit in sandbox. Fallback to mock:",
          networkErr?.message
        );
        return buildMockResponse();
      }
      throw networkErr;
    }

    if (!response.ok) {
      if (params.allowMock) {
        console.warn(
          `[XenditService] Xendit API returned ${response.status} in sandbox mode. Fallback to mock.`
        );
        return buildMockResponse();
      }
      const errorText = await response.text();
      throw new Error(`Xendit Invoice Creation Failed: ${response.status} - ${errorText}`);
    }

    const resJson = (await response.json()) as any;

    return {
      orderId: resJson.id,
      checkoutUrl: resJson.invoice_url,
      expiryDate: resJson.expiry_date,
      scenario: params.scenario || "REDIRECT",
      paymentRail: params.paymentRail,
      vaBank: params.vaBank,
      mock: false,
    };
  }

  /**
   * Verifikasi callback webhook Xendit menggunakan x-callback-token
   */
  static async verifyWebhook(callbackTokenHeader: string | null | undefined): Promise<boolean> {
    const { webhookToken } = await this.getCredentials();

    if (!webhookToken) {
      if (config.isSandbox) return true; // dev bypass jika belum diisi
      console.warn("[XenditService] XENDIT_WEBHOOK_VERIFICATION_TOKEN belum dikonfigurasi.");
      return false;
    }
    return callbackTokenHeader === webhookToken;
  }

  /**
   * Cairkan dana bersih (95% net) via Xendit Disbursement API
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
    const { secretKey } = await this.getCredentials();

    const mockEnabled =
      config.isSandbox && (!secretKey || secretKey.includes("sample_key") || config.isTest);

    if (mockEnabled) {
      return {
        id: `disb_xnd_mock_${Date.now()}`,
        external_id: params.externalId,
        amount: params.amount,
        bank_code: params.bankCode,
        account_holder_name: params.accountHolderName,
        status: "COMPLETED",
      };
    }

    if (!secretKey) {
      throw new Error("Xendit Disbursement Failed: XENDIT_SECRET_KEY belum dikonfigurasi.");
    }

    const response = await fetch("https://api.xendit.co/disbursements", {
      method: "POST",
      headers: {
        ...this.getHeaders(secretKey),
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
