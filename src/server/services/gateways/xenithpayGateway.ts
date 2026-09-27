import { createHmac, timingSafeEqual } from "crypto";
import QRCode from "qrcode";
import { eq } from "drizzle-orm";
import { db } from "../../db";
import { platformSettings } from "../../db/schema/settings";
import { config } from "../../config";
import { calculateMor } from "../../utils/payment";
import type {
  CreateGatewayOrderParams,
  GatewayDisbursementParams,
  GatewayDisbursementResponse,
  GatewayOrderResponse,
  GatewayStatusResponse,
  MorBreakdown,
  PaymentGatewayAdapter,
} from "./types";

interface XenithCredentials {
  accessKey: string;
  secretKey: string;
  webhookSecret: string;
  baseUrl: string;
  sandbox: boolean;
}

const PAYOUT_CHANNELS: Record<string, string> = {
  BCA: "CENAIDJA",
  BRI: "BRINIDJA",
  BNI: "BNINIDJA",
  MANDIRI: "BMRIIDJA",
  CIMB: "BNIAIDJA",
  CIMB_NIAGA: "BNIAIDJA",
  PERMATA: "BBBAIDJA",
  BSI: "BSMDIDJA",
  SAHABAT_SAMPOERNA: "SAHMIDJA",
  DANA: "DANA",
  GOPAY: "GOPAY",
  OVO: "OVO",
  LINKAJA: "LINKAJA",
  SHOPEEPAY: "SHOPEEPAY",
};

const E_WALLET_CHANNELS = new Set(["DANA", "GOPAY", "OVO", "LINKAJA", "SHOPEEPAY"]);

export class XenithPayGatewayAdapter implements PaymentGatewayAdapter {
  readonly id = "xenithpay" as const;
  readonly displayName = "XenithPay";

  private async getCredentials(): Promise<XenithCredentials> {
    const [sandboxRow, accessKeyRow, secretKeyRow, webhookSecretRow] = await Promise.all([
      db.query.platformSettings.findFirst({
        where: eq(platformSettings.key, "sandbox_mode"),
      }),
      db.query.platformSettings.findFirst({
        where: eq(platformSettings.key, "xenithpay_sandbox_access_key"),
      }),
      db.query.platformSettings.findFirst({
        where: eq(platformSettings.key, "xenithpay_sandbox_secret_key"),
      }),
      db.query.platformSettings.findFirst({
        where: eq(platformSettings.key, "xenithpay_sandbox_webhook_secret"),
      }),
    ]).catch(() => [undefined, undefined, undefined, undefined]);

    const sandbox = sandboxRow ? sandboxRow.value !== "false" : config.xenithpay.sandboxMode;
    return sandbox
      ? {
          accessKey:
            (config.isTest ? config.xenithpay.sandboxAccessKey : accessKeyRow?.value)?.trim() ||
            config.xenithpay.sandboxAccessKey.trim(),
          secretKey:
            (config.isTest ? config.xenithpay.sandboxSecretKey : secretKeyRow?.value)?.trim() ||
            config.xenithpay.sandboxSecretKey.trim(),
          webhookSecret:
            (config.isTest
              ? config.xenithpay.sandboxWebhookSecret
              : webhookSecretRow?.value
            )?.trim() || config.xenithpay.sandboxWebhookSecret.trim(),
          baseUrl: "https://openapi.sandbox.xenithpay.com",
          sandbox,
        }
      : {
          accessKey: config.xenithpay.accessKey.trim(),
          secretKey: config.xenithpay.secretKey.trim(),
          webhookSecret: config.xenithpay.webhookSecret.trim(),
          baseUrl: "https://openapi.xenithpay.com",
          sandbox,
        };
  }

  private sign(method: string, path: string, timestamp: string, body: string, secret: string) {
    const payload = `${method}\n${path}\n${timestamp}\n${body}`;
    return createHmac("sha256", secret).update(payload).digest("base64");
  }

  private async request<T>(
    credentials: XenithCredentials,
    method: "GET" | "POST",
    path: string,
    payload?: Record<string, unknown>
  ): Promise<T> {
    if (!credentials.accessKey || !credentials.secretKey) {
      throw new Error("Kredensial API XenithPay belum dikonfigurasi.");
    }

    const body = payload ? JSON.stringify(payload) : "";
    const timestamp = new Date().toISOString();
    const signature = this.sign(method, path, timestamp, body, credentials.secretKey);
    const response = await fetch(`${credentials.baseUrl}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        "Xenith-Api-Key": credentials.accessKey,
        "Xenith-Request-Timestamp": timestamp,
        "Xenith-Request-Signature": signature,
        ...(method === "POST" ? { "X-Idempotency-Key": payload?.referenceCode as string } : {}),
      },
      ...(payload ? { body } : {}),
    });

    const responseText = await response.text();
    let data: any;
    try {
      data = responseText ? JSON.parse(responseText) : {};
    } catch {
      data = { message: responseText };
    }

    if (!response.ok) {
      const message = data?.message || data?.error || `HTTP ${response.status}`;
      throw new Error(`XenithPay API error: ${message}`);
    }
    return data as T;
  }

  calculateMor(amount: number): MorBreakdown {
    return calculateMor(amount, config.xenithpay.platformFeePercent);
  }

  async createOrder(params: CreateGatewayOrderParams): Promise<GatewayOrderResponse> {
    const credentials = await this.getCredentials();
    const returnUrl =
      params.finishRedirectUrl ||
      params.returnUrl ||
      `${config.publicAppUrl}/checkout/success?externalId=${encodeURIComponent(params.externalId)}`;

    if (
      params.forceMock ||
      (params.allowMock && (!credentials.accessKey || !credentials.secretKey))
    ) {
      if (params.paymentRail === "va") {
        const paymentCode = `8808${Math.floor(10000000 + Math.random() * 90000000)}`;
        return {
          orderId: `xenith_mock_${Date.now()}`,
          checkoutUrl: "",
          expiryDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          scenario: "API",
          paymentRail: "va",
          paymentCode,
          vaBank: params.vaBank || "BCA",
          mock: true,
        };
      }
      if (params.paymentRail === "qris") {
        const paymentCode = `xenith_demo_${params.externalId}`;
        return {
          orderId: `xenith_mock_${Date.now()}`,
          checkoutUrl: "",
          expiryDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          scenario: "API",
          paymentRail: "qris",
          paymentCode,
          qrDataUrl: await QRCode.toDataURL(paymentCode),
          mock: true,
        };
      }
      if (params.paymentRail === "ewallet") {
        return {
          orderId: `xenith_mock_${Date.now()}`,
          checkoutUrl: "",
          expiryDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          scenario: "API",
          paymentRail: "ewallet",
          mock: true,
        };
      }
      if (params.paymentRail === "retail") {
        return {
          orderId: `xenith_mock_${Date.now()}`,
          checkoutUrl: "",
          expiryDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          scenario: "API",
          paymentRail: "retail",
          paymentCode: `9908${Math.floor(10000000 + Math.random() * 90000000)}`,
          mock: true,
        };
      }
      if (params.paymentRail === "card") {
        return {
          orderId: `xenith_mock_${Date.now()}`,
          checkoutUrl: "",
          expiryDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          scenario: "API",
          paymentRail: "card",
          mock: true,
        };
      }

      const mockCheckoutUrl = returnUrl.includes("?")
        ? `${returnUrl}&mock_xenith_gateway=true`
        : `${returnUrl}?mock_xenith_gateway=true`;
      return {
        orderId: `xenith_mock_${Date.now()}`,
        checkoutUrl: mockCheckoutUrl,
        expiryDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        scenario: "REDIRECT",
        mock: true,
      };
    }

    const callbackUrl = `${config.publicAppUrl.replace(/\/$/, "")}/api/v1/webhook/xenithpay`;
    const payinChannel = this.resolvePayinChannel(params);

    if (payinChannel) {
      const result = await this.request<any>(credentials, "POST", "/v1/payins", {
        initiatedAmount: params.amount,
        currency: "IDR",
        paymentMethod: payinChannel.method,
        paymentChannel: payinChannel.channel,
        redirectUrl: returnUrl,
        callbackUrl,
        customerReference: params.externalId,
        customerName: "Tertaut Customer",
        referenceCode: params.externalId,
        description: params.description,
        metadata: { payerEmail: params.payerEmail },
      });
      let paymentCode = String(result?.paymentCode || "");
      let paymentCodeType = String(result?.paymentCodeType || "");
      const checkoutUrl =
        result?.paymentCodeType === "PAYMENT_LINK" ? String(result.paymentCode) : "";

      if (!result?.id || !paymentCode) {
        throw new Error("Respons Pay In XenithPay tidak memiliki payment code.");
      }

      // Ambil detail instan untuk mendapatkan nomor VA riil atau raw QRIS payload (Full Custom UI)
      if (params.scenario === "API" || result.paymentCodeType === "PAYMENT_LINK") {
        try {
          const detail = await this.request<any>(
            credentials,
            "GET",
            `/v1/payins/${encodeURIComponent(result.id)}`
          );
          if (detail?.paymentCode && detail.paymentCodeType !== "PAYMENT_LINK") {
            paymentCode = String(detail.paymentCode);
            paymentCodeType = String(detail.paymentCodeType);
          }
        } catch {}
      }

      return {
        orderId: result.id,
        checkoutUrl,
        expiryDate: result.expirationTime,
        scenario: "API",
        paymentRail: params.paymentRail,
        paymentCode,
        qrDataUrl:
          paymentCodeType === "QR_TEXT" || payinChannel.method === "QR_CODE"
            ? await QRCode.toDataURL(paymentCode)
            : undefined,
        vaBank: params.paymentRail === "va" ? params.vaBank : undefined,
      };
    }

    const result = await this.request<any>(credentials, "POST", "/v1/payment-links", {
      amount: params.amount,
      currency: "IDR",
      redirectUrl: returnUrl,
      paymentLinkCallbackUrl: callbackUrl,
      payinCallbackUrl: callbackUrl,
      customerReference: params.externalId,
      customerName: "Tertaut Customer",
      referenceCode: params.externalId,
      description: params.description,
      metadata: { payerEmail: params.payerEmail },
    });

    if (!result?.id || !result?.paymentLinkUrl) {
      throw new Error("Respons pembuatan Payment Link XenithPay tidak lengkap.");
    }

    return {
      orderId: result.id,
      checkoutUrl: result.paymentLinkUrl,
      expiryDate: result.expiredTime,
      scenario: "REDIRECT",
      paymentRail: params.paymentRail,
    };
  }

  private resolvePayinChannel(params: CreateGatewayOrderParams) {
    if (params.paymentRail === "qris") return { method: "QR_CODE", channel: "QRIS" };
    if (params.paymentRail === "va") {
      const bank = (params.vaBank || "BNI").toUpperCase();
      const channelMap: Record<string, string> = {
        BNI: "BNI.VA",
        BRI: "BRI.VA",
        MANDIRI: "MDR.VA",
        MDR: "MDR.VA",
        PERMATA: "PTB.VA",
        PTB: "PTB.VA",
        CIMB: "CIMBN.VA",
        CIMBN: "CIMBN.VA",
        CIMB_NIAGA: "CIMBN.VA",
        DANAMON: "BDMN.VA",
        BDMN: "BDMN.VA",
        BSS: "BSS.VA",
        SAHABAT_SAMPOERNA: "BSS.VA",
        SAMPOERNA: "BSS.VA",
        MAYBANK: "BMI.VA",
        BMI: "BMI.VA",
        BCA: "BCA.VA",
        BAG: "BAG.VA",
        INA: "INA.VA",
      };
      const channel = channelMap[bank] || `${bank}.VA`;
      return { method: "VIRTUAL_ACCOUNT", channel };
    }
    if (params.paymentRail === "ewallet") {
      const ewallet = (params as any).ewalletChannel?.toUpperCase() || "DANA";
      return { method: "EWALLET", channel: ewallet };
    }
    return undefined;
  }

  async queryOrderStatus(params: {
    externalId: string;
    referenceNo?: string;
  }): Promise<GatewayStatusResponse> {
    if (!params.referenceNo) {
      return { isPaid: false, isExpired: false, isFailed: false };
    }
    try {
      const credentials = await this.getCredentials();
      const resource = params.referenceNo.startsWith("payin-") ? "payins" : "payment-links";
      const path = `/v1/${resource}/${encodeURIComponent(params.referenceNo)}`;
      const result = await this.request<any>(credentials, "GET", path);
      const status = String(result?.status || result?.data?.status || "").toUpperCase();
      const paymentAmount = result?.paymentAmount ?? result?.data?.paymentAmount;
      const paymentChannel = result?.paymentChannel ?? result?.data?.paymentChannel;
      const paymentCode = result?.paymentCode ?? result?.data?.paymentCode;
      return {
        isPaid: status === "COMPLETED",
        isExpired: status === "EXPIRED",
        isFailed: false,
        paidAmount: Number(paymentAmount) || undefined,
        paymentChannel,
        paymentCode,
        raw: result,
      };
    } catch {
      return { isPaid: false, isExpired: false, isFailed: false };
    }
  }

  async verifyWebhook(
    headers: Record<string, string | undefined>,
    body?: any,
    requestPath = "/api/v1/webhook/xenithpay"
  ): Promise<boolean> {
    const credentials = await this.getCredentials();
    const timestamp = headers["x-xenith-timestamp"];
    const receivedSignature = headers["x-xenith-signature"];
    if (!credentials.webhookSecret || !timestamp || !receivedSignature) return false;

    const timestampMs = Date.parse(timestamp);
    if (!Number.isFinite(timestampMs) || Math.abs(Date.now() - timestampMs) > 5 * 60 * 1000) {
      return false;
    }

    const expected = createHmac("sha256", credentials.webhookSecret)
      .update(`POST\n${requestPath}\n${JSON.stringify(body)}\n${timestamp}`)
      .digest();
    let received: Buffer;
    try {
      received = Buffer.from(receivedSignature, "base64");
    } catch {
      return false;
    }
    return received.length === expected.length && timingSafeEqual(received, expected);
  }

  async createDisbursement(
    params: GatewayDisbursementParams
  ): Promise<GatewayDisbursementResponse> {
    const credentials = await this.getCredentials();
    const bank = params.bankCode.toUpperCase();
    const destinationPayoutChannel = PAYOUT_CHANNELS[bank];
    if (!destinationPayoutChannel) {
      throw new Error(`Kode bank ${bank} belum dipetakan ke channel payout XenithPay.`);
    }

    const payoutMethod = E_WALLET_CHANNELS.has(bank) ? "EWALLET" : "BANK_TRANSFER";
    const callbackUrl = `${config.publicAppUrl.replace(/\/$/, "")}/api/v1/webhook/xenithpay/payout`;
    const result = await this.request<any>(credentials, "POST", "/v1/payouts", {
      initiatedAmount: params.amount,
      currency: "IDR",
      destinationPayoutMethod: payoutMethod,
      destinationPayoutChannel,
      destinationPayoutAccount: params.accountNumber,
      destinationPayoutAccountName: params.accountHolderName,
      referenceCode: params.externalId,
      customerReference: params.externalId,
      description: params.description,
      callbackUrl,
    });

    return {
      id: result.id,
      externalId: result.referenceCode || params.externalId,
      amount: Number(result.initiatedAmount) || params.amount,
      bankCode: params.bankCode,
      accountHolderName: params.accountHolderName,
      status:
        String(result.status || "PENDING").toUpperCase() === "SUCCESS" ? "COMPLETED" : "PROCESSING",
    };
  }
}

export const xenithpayGateway = new XenithPayGatewayAdapter();
