import Xendit from "xendit-node";
import type {
  PaymentGatewayAdapter,
  CreateGatewayOrderParams,
  GatewayOrderResponse,
  GatewayStatusResponse,
  GatewayDisbursementParams,
  GatewayDisbursementResponse,
  MorBreakdown,
  GatewayChannelsResponse,
} from "./types";
import { config } from "../../../config";
import { db } from "../../../db";
import { platformSettings } from "../../../db/schema/settings";
import { eq } from "drizzle-orm";

/**
 * Channel code untuk payout Xendit di Indonesia SELALU berawalan `ID_`
 * (mis. `ID_BCA`, `ID_MANDIRI`). Mengirim kode bank telanjang seperti `BCA`
 * ditolak Xendit dengan `CHANNEL_CODE_NOT_SUPPORTED`, sehingga pencairan ke bank
 * Indonesia tidak pernah berhasil. Daftar di bawah diverifikasi langsung
 * terhadap `GET /payouts/channels` Xendit sandbox.
 */
const ID_PAYOUT_CHANNELS = new Set([
  "BCA",
  "BNI",
  "BRI",
  "MANDIRI",
  "PERMATA",
  "BSI",
  "CIMB",
  "BNC",
  "MEGA",
  "BJB",
  "BTPN",
  "BTPN_SYARIAH",
  "MANDIRI_SYR",
  "MANDIRI_TASPEN",
  "SAHABAT_SAMPOERNA",
  "ARTAJASA",
  "PV",
  "CCB",
  "CITIBANK",
  "DANA",
  "GOPAY",
  "OVO",
  "LINKAJA",
  "SHOPEEPAY",
]);

const ID_PAYOUT_PREFIX = "ID_";

/** E-wallet memakai kategori EWALLET, bukan BANK, tapi nama channel-nya sama. */
const ID_EWALLETS = new Set(["DANA", "GOPAY", "OVO", "LINKAJA", "SHOPEEPAY"]);

/**
 * Terjemahkan kode bank Indonesia ke `channel_code` Xendit.
 * Menerima `BCA`, `bca`, `ID_BCA`, atau `BCA_UUS` (rekening giro).
 */
function toXenditPayoutChannel(bankCode: string): { code: string; isEWallet: boolean } {
  const raw = (bankCode || "").trim().toUpperCase();
  if (!raw) {
    throw new Error("Xendit Payout Failed: kode bank wajib diisi.");
  }
  const bare = raw.startsWith(ID_PAYOUT_PREFIX)
    ? raw.slice(ID_PAYOUT_PREFIX.length)
    : raw.replace(/_UUS$/, "");

  if (!ID_PAYOUT_CHANNELS.has(bare)) {
    throw new Error(
      `Xendit Payout Failed: bank "${bankCode}" tidak didukung untuk payout Xendit Indonesia. ` +
        `Yang didukung: ${[...ID_PAYOUT_CHANNELS].join(", ")}.`
    );
  }
  return { code: ID_PAYOUT_PREFIX + bare, isEWallet: ID_EWALLETS.has(bare) };
}
import QRCode from "qrcode";
import { calculateMor } from "../../../utils/payment";

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
      const [keyRow, tokenRow, sandboxRow] = await Promise.all([
        db.query.platformSettings.findFirst({
          where: eq(platformSettings.key, "xendit_secret_key"),
        }),
        db.query.platformSettings.findFirst({
          where: eq(platformSettings.key, "xendit_webhook_token"),
        }),
        db.query.platformSettings.findFirst({
          where: eq(platformSettings.key, "sandbox_mode"),
        }),
      ]);

      const isSandbox = sandboxRow?.value !== "false";

      if (config.isTest && tokenRow?.value) {
        return {
          secretKey: keyRow?.value?.trim() || config.xendit.secretKey?.trim() || "",
          webhookToken: tokenRow.value.trim(),
        };
      }

      if (isSandbox) {
        // Mode Sandbox: HANYA izinkan secret key sandbox (xnd_development_*)
        const sandboxSecret =
          process.env.XENDIT_SANDBOX_SECRET_KEY?.trim() ||
          (keyRow?.value?.trim().startsWith("xnd_development_") ? keyRow.value.trim() : "") ||
          (config.xendit.secretKey?.trim().startsWith("xnd_development_")
            ? config.xendit.secretKey.trim()
            : "");

        const sandboxToken =
          process.env.XENDIT_SANDBOX_WEBHOOK_VERIFICATION_TOKEN?.trim() ||
          tokenRow?.value?.trim() ||
          process.env.XENDIT_WEBHOOK_VERIFICATION_TOKEN?.trim() ||
          config.xendit.webhookToken?.trim() ||
          "";

        return { secretKey: sandboxSecret, webhookToken: sandboxToken };
      }

      // Mode Production (Live): Gunakan secret key produksi (xnd_production_*)
      const prodSecret =
        process.env.XENDIT_PRODUCTION_SECRET_KEY?.trim() ||
        process.env.XENDIT_SECRET_KEY_PRODUCTION?.trim() ||
        (keyRow?.value?.trim().startsWith("xnd_production_") ? keyRow.value.trim() : "") ||
        process.env.XENDIT_SECRET_KEY?.trim() ||
        config.xendit.secretKey?.trim() ||
        "";

      const prodToken =
        process.env.XENDIT_PRODUCTION_WEBHOOK_VERIFICATION_TOKEN?.trim() ||
        process.env.XENDIT_WEBHOOK_VERIFICATION_TOKEN_PRODUCTION?.trim() ||
        tokenRow?.value?.trim() ||
        process.env.XENDIT_WEBHOOK_VERIFICATION_TOKEN?.trim() ||
        process.env.XENDIT_WEBHOOK_TOKEN?.trim() ||
        config.xendit.webhookToken?.trim() ||
        "";

      return { secretKey: prodSecret, webhookToken: prodToken };
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
   * Menghapus cache payment channels (no-op untuk konfigurasi statis).
   */
  clearChannelsCache() {}

  /**
   * Mengambil daftar channel pembayaran resmi yang aktif sesuai dashboard Xendit Live:
   * - QRIS: Activated (Mendukung semua m-Banking termasuk BCA Mobile/myBCA & E-Wallet)
   * - Virtual Account: Mandiri, BNI, BRI, Permata, BSI, CIMB, dan Bank Sahabat Sampoerna (BSS)
   * - Retail Outlet: Indomaret
   */
  async getPaymentChannels(_forceRefresh = false): Promise<GatewayChannelsResponse> {
    return {
      channels: [
        { channelCode: "QRIS", channelCategory: "QRIS", isEnabled: true, name: "QRIS Instan" },
        {
          channelCode: "MANDIRI",
          channelCategory: "VIRTUAL_ACCOUNT",
          isEnabled: true,
          name: "Mandiri Virtual Account",
        },
        {
          channelCode: "BNI",
          channelCategory: "VIRTUAL_ACCOUNT",
          isEnabled: true,
          name: "BNI Virtual Account",
        },
        {
          channelCode: "BRI",
          channelCategory: "VIRTUAL_ACCOUNT",
          isEnabled: true,
          name: "BRI Virtual Account",
        },
        {
          channelCode: "PERMATA",
          channelCategory: "VIRTUAL_ACCOUNT",
          isEnabled: true,
          name: "Permata Virtual Account",
        },
        {
          channelCode: "BSI",
          channelCategory: "VIRTUAL_ACCOUNT",
          isEnabled: true,
          name: "BSI Virtual Account",
        },
        {
          channelCode: "CIMB",
          channelCategory: "VIRTUAL_ACCOUNT",
          isEnabled: true,
          name: "CIMB Virtual Account",
        },
        {
          channelCode: "BSS",
          channelCategory: "VIRTUAL_ACCOUNT",
          isEnabled: true,
          name: "Bank Sahabat Sampoerna",
        },
        {
          channelCode: "INDOMARET",
          channelCategory: "RETAIL_OUTLET",
          isEnabled: true,
          name: "Indomaret",
        },
      ],
      activeRails: ["qris", "va", "retail"],
      activeBanks: ["MANDIRI", "BNI", "BRI", "PERMATA", "BSI", "CIMB", "BSS"],
      activeEwallets: [],
      activeRetails: ["INDOMARET"],
      qrisEnabled: true,
      cardEnabled: false,
    };
  }

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

    const xendit = await this.getClient();
    if (!xendit) {
      throw new Error("Xendit Invoice Creation Failed: XENDIT_SECRET_KEY belum dikonfigurasi.");
    }

    // Bangun paymentMethods jika ditentukan sesuai channel aktif Xendit.
    // Jika scenario adalah REDIRECT (Hosted Checkout), jangan persempit hanya ke 1 rail (seperti QRIS saja),
    // biarkan paymentMethods kosong agar pembeli di halaman resmi Xendit bebas memilih QRIS, VA, E-Wallet, Card, atau Retail.
    const paymentMethods: string[] = [];
    if (params.scenario !== "REDIRECT" && params.paymentRail) {
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
            callback_url: `${(config.publicAppUrl || "https://tertaut.com").replace(/\/$/, "")}/api/v1/webhook/xendit`,
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
      };
    } catch (sdkErr: any) {
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
    const xendit = await this.getClient();
    if (!xendit) {
      if (config.isTest) {
        return {
          id: `xnd_disb_mock_${Date.now()}`,
          externalId: params.externalId,
          amount: params.amount,
          bankCode: params.bankCode,
          accountHolderName: params.accountHolderName,
          status: "COMPLETED",
        };
      }
      throw new Error("Xendit Payout Failed: Secret key Xendit belum dikonfigurasi.");
    }

    const channel = toXenditPayoutChannel(params.bankCode);

    // E-wallet menerima nomor HP, bukan nomor rekening. Menangkapnya di sini
    // memberi pesan jelas, bukan `RECIPIENT_ACCOUNT_NUMBER_ERROR` dari Xendit.
    const accountDigits = (params.accountNumber || "").replace(/[^0-9]/g, "");
    if (channel.isEWallet && !/^62\d{8,13}$/.test(accountDigits)) {
      throw new Error(
        `Xendit Payout Failed: channel e-wallet ${channel.code} memerlukan nomor HP ` +
          `berformat 62xxx (mis. 6281234567890), bukan nomor rekening.`
      );
    }

    // Panggil official Xendit SDK Payout API
    const payout = await xendit.Payout.createPayout({
      idempotencyKey: `idemp_${params.externalId}`,
      data: {
        referenceId: params.externalId,
        channelCode: channel.code,
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
