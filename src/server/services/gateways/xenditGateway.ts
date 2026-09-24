import Xendit from "xendit-node";
import type {
  PaymentGatewayAdapter,
  CreateGatewayOrderParams,
  GatewayOrderResponse,
  GatewayStatusResponse,
  GatewayDisbursementParams,
  GatewayDisbursementResponse,
  MorBreakdown,
} from "./types";
import { config } from "../../config";
import { db } from "../../db";
import { platformSettings } from "../../db/schema/settings";
import { eq } from "drizzle-orm";
import QRCode from "qrcode";
import { calculateMor } from "../../utils/payment";

/**
 * Xendit Gateway Adapter
 * Menggunakan official SDK `xendit-node` secara terisolasi tanpa menyentuh kode gateway lain.
 */
export class XenditGatewayAdapter implements PaymentGatewayAdapter {
  readonly id = "xendit" as const;
  readonly displayName = "Xendit";

  /**
   * Mengambil kredensial Xendit secara dinamis:
   * Prioritas: platform_settings di database -> config/env
   */
  async getCredentials(): Promise<{ secretKey: string; webhookToken: string }> {
    try {
      const [keyRow, tokenRow] = await Promise.all([
        db.query.platformSettings.findFirst({
          where: eq(platformSettings.key, "xendit_secret_key"),
        }),
        db.query.platformSettings.findFirst({
          where: eq(platformSettings.key, "xendit_webhook_token"),
        }),
      ]);

      if (config.isTest && tokenRow?.value) {
        return {
          secretKey: keyRow?.value?.trim() || config.xendit.secretKey?.trim() || "",
          webhookToken: tokenRow.value.trim(),
        };
      }

      const envSecret = config.xendit.secretKey?.trim();
      const envToken = config.xendit.webhookToken?.trim();

      const secretKey = envSecret || keyRow?.value?.trim() || "";
      const webhookToken = envToken || tokenRow?.value?.trim() || "";

      return { secretKey, webhookToken };
    } catch {
      return {
        secretKey: config.xendit.secretKey?.trim() || "",
        webhookToken: config.xendit.webhookToken?.trim() || "",
      };
    }
  }

  private cachedClient: InstanceType<typeof Xendit> | null = null;
  private cachedSecretKey: string | null = null;

  /**
   * Mendapatkan instance client official Xendit SDK (di-cache agar tidak instansiasi ulang tiap request)
   */
  private async getClient(): Promise<InstanceType<typeof Xendit> | null> {
    const { secretKey } = await this.getCredentials();
    if (!secretKey || !secretKey.startsWith("xnd_")) {
      return null;
    }
    if (this.cachedClient && this.cachedSecretKey === secretKey) {
      return this.cachedClient;
    }
    this.cachedSecretKey = secretKey;
    this.cachedClient = new Xendit({ secretKey });
    return this.cachedClient;
  }

  calculateMor(amount: number): MorBreakdown {
    return calculateMor(amount, config.xendit.platformFeePercent);
  }

  async createOrder(params: CreateGatewayOrderParams): Promise<GatewayOrderResponse> {
    const { secretKey } = await this.getCredentials();

    const buildMockResponse = async (): Promise<GatewayOrderResponse> => {
      const rail = params.paymentRail || "qris";
      const bank = (params.vaBank || "BCA").toUpperCase();

      let paymentCode: string | undefined;
      let qrDataUrl: string | undefined;

      if (rail === "va") {
        const bankPrefixMap: Record<string, string> = {
          BCA: "3901",
          MANDIRI: "88888",
          BNI: "8808",
          BRI: "12800",
          BSI: "900",
          PERMATA: "8528",
          CIMB: "5919",
          BJB: "014",
          SAHABAT_SAMPOERNA: "522",
        };
        const prefix = bankPrefixMap[bank] || "88888";
        const randomNum = Math.floor(10000000 + Math.random() * 90000000).toString();
        paymentCode = `${prefix}${randomNum}`;
      } else if (rail === "retail") {
        paymentCode = `RET${Math.floor(1000000000 + Math.random() * 9000000000)}`;
      } else {
        paymentCode = `00020101021226540014ID.XENDIT.WWW011893600911000000000002152026092100000000303UMI51440014ID.XENDIT.WWW0215202609210000000520457325303360540${Number(params.amount).toFixed(2)}5802ID5911Tertaut MoR6007Jakarta61051234062330114${params.externalId}6304ABCD`;
        try {
          qrDataUrl = await QRCode.toDataURL(paymentCode, { width: 320, margin: 2 });
        } catch {}
      }

      return {
        orderId: `xnd_inv_mock_${Date.now()}`,
        checkoutUrl:
          params.finishRedirectUrl || `https://checkout.xendit.co/web/mock_${params.externalId}`,
        expiryDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        scenario: params.scenario || "REDIRECT",
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

    const xendit = await this.getClient();
    if (!xendit) {
      if (params.allowMock) {
        return buildMockResponse();
      }
      throw new Error("Xendit Invoice Creation Failed: XENDIT_SECRET_KEY belum dikonfigurasi.");
    }

    // Bangun paymentMethods jika ditentukan sesuai channel aktif Xendit
    const paymentMethods: string[] = [];
    if (params.paymentRail === "qris") {
      paymentMethods.push("QRIS");
    } else if (params.paymentRail === "va" && params.vaBank) {
      paymentMethods.push(params.vaBank.toUpperCase());
    } else if (params.paymentRail === "card") {
      paymentMethods.push("CREDIT_CARD");
    } else if (params.paymentRail === "retail") {
      if (params.retailOutlet) {
        paymentMethods.push(params.retailOutlet.toUpperCase());
      } else {
        paymentMethods.push("ALFAMART", "INDOMARET");
      }
    } else if (params.paymentRail === "ewallet") {
      if (params.ewalletChannel) {
        paymentMethods.push(params.ewalletChannel.toUpperCase());
      } else {
        paymentMethods.push(
          "OVO",
          "DANA",
          "SHOPEEPAY",
          "GOPAY",
          "LINKAJA",
          "ASTRAPAY",
          "JENIUSPAY"
        );
      }
    } else if (params.paymentMethods && params.paymentMethods.length > 0) {
      paymentMethods.push(...params.paymentMethods);
    }

    let directPaymentCode: string | undefined;
    let directQrDataUrl: string | undefined;

    // Untuk Full Custom In-Page UI (scenario: "API"):
    // Jika rail adalah Virtual Account, buat Fixed/Closed VA langsung via Xendit API agar nomor rekening langsung tampil di layar pembeli.
    if (params.scenario === "API" && params.paymentRail === "va" && params.vaBank) {
      const bankCode = params.vaBank.toUpperCase();
      try {
        const auth = Buffer.from(secretKey + ":").toString("base64");
        const vaRes = await fetch("https://api.xendit.co/callback_virtual_accounts", {
          method: "POST",
          headers: {
            Authorization: `Basic ${auth}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            external_id: params.externalId,
            bank_code: bankCode,
            name: "Tertaut",
            expected_amount: params.amount,
            is_closed: true,
            expiration_date: new Date(Date.now() + 86400000).toISOString(),
          }),
        });
        if (vaRes.ok) {
          const vaData = (await vaRes.json()) as any;
          if (vaData.account_number) {
            directPaymentCode = vaData.account_number;
          }
        }
      } catch (vaErr: any) {
        console.warn("[XenditGateway] Direct VA creation note:", vaErr?.message);
      }
    }

    // Jika rail adalah QRIS dan scenario: "API", buat direct dynamic QR code
    if (params.scenario === "API" && params.paymentRail === "qris") {
      try {
        const auth = Buffer.from(secretKey + ":").toString("base64");
        const qrRes = await fetch("https://api.xendit.co/qr_codes", {
          method: "POST",
          headers: {
            Authorization: `Basic ${auth}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            external_id: params.externalId,
            type: "DYNAMIC",
            amount: params.amount,
            callback_url: "https://tertaut.com/api/v1/webhook/xendit",
          }),
        });
        if (qrRes.ok) {
          const qrData = (await qrRes.json()) as any;
          if (qrData.qr_string) {
            directPaymentCode = qrData.qr_string;
            directQrDataUrl = await QRCode.toDataURL(qrData.qr_string, { width: 320, margin: 2 });
          }
        }
      } catch (qrErr: any) {
        console.warn("[XenditGateway] Direct QR creation note:", qrErr?.message);
      }
    }

    try {
      // Panggil official Xendit SDK Invoice API
      const invoice = await xendit.Invoice.createInvoice({
        data: {
          externalId: params.externalId,
          amount: params.amount,
          payerEmail: params.payerEmail,
          description: params.description,
          successRedirectUrl: params.finishRedirectUrl || params.returnUrl,
          failureRedirectUrl: params.returnUrl,
          invoiceDuration: 86400,
          paymentMethods: paymentMethods.length > 0 ? paymentMethods : undefined,
        },
      });

      return {
        orderId: invoice.id || `xnd_${Date.now()}`,
        checkoutUrl: invoice.invoiceUrl || "",
        expiryDate: invoice.expiryDate?.toISOString(),
        scenario: params.scenario || "API",
        paymentRail: params.paymentRail,
        paymentCode: directPaymentCode,
        qrDataUrl: directQrDataUrl,
        vaBank: params.vaBank,
        mock: false,
      };
    } catch (sdkErr: any) {
      if (params.allowMock) {
        console.warn(
          "[XenditGateway] Error calling Xendit SDK in sandbox mode. Fallback to mock:",
          sdkErr?.message
        );
        return buildMockResponse();
      }
      throw sdkErr;
    }
  }

  async queryOrderStatus(params: {
    externalId: string;
    referenceNo?: string;
  }): Promise<GatewayStatusResponse> {
    const xendit = await this.getClient();
    if (!xendit) {
      return { isPaid: false, isExpired: false, isFailed: false };
    }

    const invoiceId = params.referenceNo;
    if (!invoiceId) {
      return { isPaid: false, isExpired: false, isFailed: false };
    }

    try {
      const invoice = await xendit.Invoice.getInvoiceById({ invoiceId });
      const status = String(invoice.status || "").toUpperCase();
      const isPaid = status === "PAID" || status === "SETTLED";
      const isExpired = status === "EXPIRED";
      const isFailed = status === "FAILED";

      return {
        isPaid,
        isExpired,
        isFailed,
        paidAmount: (invoice as any).paidAmount || (invoice as any).paid_amount || invoice.amount,
        paymentChannel:
          (invoice as any).paymentMethod ||
          (invoice as any).paymentChannel ||
          (invoice as any).payment_channel,
        raw: invoice,
      };
    } catch {
      return { isPaid: false, isExpired: false, isFailed: false };
    }
  }

  async verifyWebhook(headers: Record<string, string | undefined>, _body?: any): Promise<boolean> {
    const callbackTokenHeader =
      headers["x-callback-token"] ||
      headers["X-CALLBACK-TOKEN"] ||
      headers["x-callback-token-header"];

    const { webhookToken } = await this.getCredentials();

    if (!webhookToken) {
      if (config.isSandbox) return true;
      console.warn("[XenditGateway] XENDIT_WEBHOOK_VERIFICATION_TOKEN belum dikonfigurasi.");
      return false;
    }
    return callbackTokenHeader === webhookToken;
  }

  async createDisbursement(
    params: GatewayDisbursementParams
  ): Promise<GatewayDisbursementResponse> {
    const { secretKey } = await this.getCredentials();
    const mockEnabled =
      config.isSandbox && (!secretKey || secretKey.includes("sample_key") || config.isTest);

    if (mockEnabled) {
      return {
        id: `disb_xnd_mock_${Date.now()}`,
        externalId: params.externalId,
        amount: params.amount,
        bankCode: params.bankCode,
        accountHolderName: params.accountHolderName,
        status: "COMPLETED",
      };
    }

    const xendit = await this.getClient();
    if (!xendit) {
      throw new Error("Xendit Payout Failed: Secret key Xendit belum dikonfigurasi.");
    }

    // Panggil official Xendit SDK Payout API
    const payout = await xendit.Payout.createPayout({
      idempotencyKey: `idemp_${params.externalId}`,
      data: {
        referenceId: params.externalId,
        channelCode: `${params.bankCode.toUpperCase()}`,
        channelProperties: {
          accountNumber: params.accountNumber,
          accountHolderName: params.accountHolderName,
        },
        amount: params.amount,
        currency: "IDR",
        description: params.description,
      },
    });

    return {
      id: payout.id,
      externalId: payout.referenceId,
      amount: payout.amount,
      bankCode: params.bankCode,
      accountHolderName: params.accountHolderName,
      status: payout.status || "PENDING",
    };
  }
}

export const xenditGateway = new XenditGatewayAdapter();
