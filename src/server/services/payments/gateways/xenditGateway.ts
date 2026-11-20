import { normalizeMoneyStatus } from "../moneyStatus";
import type { GatewayRefundParams, GatewayMoneyStatus } from "./types";
import Xendit from "xendit-node";
import { timingSafeEqual } from "crypto";
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

      const isSandbox =
        !config.isProd && process.env.ALLOW_PROD_KEYS_IN_DEV !== "true"
          ? true
          : sandboxRow?.value !== "false";

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
   * - E-Wallet: OVO dan AstraPay (ShopeePay masih In Progress, DANA Unavailable)
   * - Retail Outlet: Alfamart dan Indomaret
   * - Kartu (Visa, Mastercard, JCB, Amex): Masih In Progress (`cardEnabled: false`)
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
          channelCode: "OVO",
          channelCategory: "EWALLET",
          isEnabled: true,
          name: "OVO",
        },
        {
          channelCode: "ASTRAPAY",
          channelCategory: "EWALLET",
          isEnabled: true,
          name: "AstraPay",
        },
        {
          channelCode: "ALFAMART",
          channelCategory: "RETAIL_OUTLET",
          isEnabled: true,
          name: "Alfamart",
        },
        {
          channelCode: "INDOMARET",
          channelCategory: "RETAIL_OUTLET",
          isEnabled: true,
          name: "Indomaret",
        },
      ],
      activeRails: ["qris", "va", "ewallet", "retail"],
      activeBanks: ["MANDIRI", "BNI", "BRI", "PERMATA", "BSI", "CIMB", "BSS"],
      activeEwallets: ["OVO", "ASTRAPAY"],
      activeRetails: ["ALFAMART", "INDOMARET"],
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
    const xendit = await this.getClient();
    if (!xendit) {
      throw new Error("Xendit Invoice Creation Failed: XENDIT_SECRET_KEY belum dikonfigurasi.");
    }

    const useDirectPaymentRequest = params.scenario !== "REDIRECT" && Boolean(params.paymentRail);

    if (useDirectPaymentRequest) {
      return this.createDirectPaymentRequest(xendit, params);
    }

    // Mode REDIRECT (Hosted Fallback): biarkan paymentMethods kosong jika tidak dibatasi.
    const paymentMethods: string[] = [];
    if (params.paymentMethods && params.paymentMethods.length > 0) {
      paymentMethods.push(...params.paymentMethods);
    }

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
      scenario: params.scenario || "REDIRECT",
      paymentRail: params.paymentRail,
      vaBank: params.vaBank,
      retailOutlet: params.retailOutlet,
    };
  }

  private normalizeDirectVaChannel(bankCode: string): string {
    const upper = bankCode.trim().toUpperCase();
    if (upper === "BSS") return "SAHABAT_SAMPOERNA";
    return upper;
  }

  private normalizeIndonesiaMobile(rawPhone?: string): string | null {
    const cleaned = String(rawPhone || "").replace(/[^0-9+]/g, "");
    if (!cleaned) return null;
    if (cleaned.startsWith("+62") && /^\+628\d{7,12}$/.test(cleaned)) return cleaned;
    if (cleaned.startsWith("628") && /^628\d{7,12}$/.test(cleaned)) return `+${cleaned}`;
    if (cleaned.startsWith("08") && /^08\d{7,12}$/.test(cleaned)) return `+62${cleaned.slice(1)}`;
    return null;
  }

  private async createDirectPaymentRequest(
    xendit: InstanceType<typeof Xendit>,
    params: CreateGatewayOrderParams
  ): Promise<GatewayOrderResponse> {
    const rail = String(params.paymentRail || "").toLowerCase();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const customerName =
      params.payerEmail
        .split("@")[0]
        ?.replace(/[^a-zA-Z0-9 ]/g, " ")
        .trim()
        .slice(0, 50) || "Pembeli Tertaut";
    const successUrl =
      params.finishRedirectUrl || params.returnUrl || "https://tertaut.com/checkout/success";
    const failureUrl = params.returnUrl || successUrl;

    if (rail === "card") {
      throw new Error("Pembayaran kartu kredit/debit belum tersedia pada mode checkout ini.");
    }

    let paymentMethod: Record<string, any>;
    let resolvedVaBank: string | undefined;
    let resolvedRetailOutlet: string | undefined;

    if (rail === "qris") {
      paymentMethod = {
        type: "QR_CODE",
        reusability: "ONE_TIME_USE",
        qrCode: {
          channelCode: "QRIS",
          channelProperties: {},
        },
      };
    } else if (rail === "va") {
      const requestedBank = (params.vaBank || "MANDIRI").toUpperCase();
      resolvedVaBank = requestedBank;
      paymentMethod = {
        type: "VIRTUAL_ACCOUNT",
        reusability: "ONE_TIME_USE",
        virtualAccount: {
          channelCode: this.normalizeDirectVaChannel(requestedBank),
          channelProperties: {
            customerName,
            expiresAt,
          },
        },
      };
    } else if (rail === "retail") {
      const outlet = (params.retailOutlet || "ALFAMART").toUpperCase();
      resolvedRetailOutlet = outlet;
      paymentMethod = {
        type: "OVER_THE_COUNTER",
        reusability: "ONE_TIME_USE",
        overTheCounter: {
          channelCode: outlet,
          channelProperties: {
            customerName,
            expiresAt,
          },
        },
      };
    } else if (rail === "ewallet") {
      const channelCode = (params.ewalletChannel || "OVO").toUpperCase();
      const channelProperties: Record<string, any> = {
        successReturnUrl: successUrl,
        failureReturnUrl: failureUrl,
        cancelReturnUrl: failureUrl,
      };
      if (channelCode === "OVO") {
        const mobileNumber = this.normalizeIndonesiaMobile(params.ewalletPhone);
        if (!mobileNumber) {
          throw new Error(
            "Nomor HP OVO wajib diisi dengan format yang valid (contoh: 081234567890)."
          );
        }
        channelProperties.mobileNumber = mobileNumber;
      }
      paymentMethod = {
        type: "EWALLET",
        reusability: "ONE_TIME_USE",
        ewallet: {
          channelCode,
          channelProperties,
        },
      };
    } else {
      throw new Error(`Jalur pembayaran "${rail}" tidak didukung.`);
    }

    const pr = await xendit.PaymentRequest.createPaymentRequest({
      idempotencyKey: `pr_${params.externalId}`,
      data: {
        referenceId: params.externalId,
        amount: params.amount,
        currency: "IDR",
        description: params.description,
        paymentMethod: paymentMethod as any,
      },
    });

    let paymentCode: string | undefined;
    let qrDataUrl: string | undefined;

    const qrString = pr.paymentMethod?.qrCode?.channelProperties?.qrString;
    if (qrString) {
      paymentCode = qrString;
      qrDataUrl = await QRCode.toDataURL(qrString, { width: 320, margin: 2 });
    }

    const vaNumber = pr.paymentMethod?.virtualAccount?.channelProperties?.virtualAccountNumber;
    if (vaNumber) {
      paymentCode = vaNumber;
    }

    const otcCode = pr.paymentMethod?.overTheCounter?.channelProperties?.paymentCode;
    if (otcCode) {
      paymentCode = otcCode;
    }

    const preferredAction =
      pr.actions?.find((a) => a.url && a.urlType === "WEB") ||
      pr.actions?.find((a) => a.url && (a.urlType === "MOBILE" || a.urlType === "DEEPLINK")) ||
      pr.actions?.find((a) => a.url);
    const actionUrl = preferredAction?.url || undefined;

    return {
      orderId: pr.id,
      checkoutUrl: actionUrl || "",
      expiryDate: expiresAt.toISOString(),
      scenario: "API",
      paymentRail: rail,
      paymentCode,
      qrDataUrl,
      actionUrl,
      vaBank: resolvedVaBank,
      retailOutlet: resolvedRetailOutlet,
    };
  }

  async queryOrderStatus(params: {
    externalId: string;
    referenceNo?: string;
  }): Promise<GatewayStatusResponse> {
    const xendit = await this.getClient();
    if (!xendit) {
      return { isPaid: false, isExpired: false, isFailed: false };
    }

    const referenceId = params.referenceNo;
    if (!referenceId) {
      return { isPaid: false, isExpired: false, isFailed: false };
    }

    try {
      if (referenceId.startsWith("pr-")) {
        const pr = await xendit.PaymentRequest.getPaymentRequestByID({
          paymentRequestId: referenceId,
        });
        const status = String(pr.status || "").toUpperCase();
        const isPaid = status === "SUCCEEDED";
        const isExpired = status === "EXPIRED";
        const isFailed = status === "FAILED" || status === "CANCELED" || status === "VOIDED";
        const channel =
          pr.paymentMethod?.virtualAccount?.channelCode ||
          pr.paymentMethod?.overTheCounter?.channelCode ||
          pr.paymentMethod?.ewallet?.channelCode ||
          pr.paymentMethod?.qrCode?.channelCode ||
          pr.paymentMethod?.type;
        return {
          isPaid,
          isExpired,
          isFailed,
          paidAmount: typeof pr.amount === "number" ? pr.amount : undefined,
          paymentChannel: channel ? String(channel).toUpperCase() : undefined,
          raw: pr,
        };
      }

      const invoice = await xendit.Invoice.getInvoiceById({ invoiceId: referenceId });
      const status = String(invoice.status || "").toUpperCase();
      const isPaid = status === "PAID" || status === "SETTLED";
      const isExpired = status === "EXPIRED";
      const isFailed = status === "FAILED";

      const invRecord = invoice as unknown as Record<string, unknown>;
      return {
        isPaid,
        isExpired,
        isFailed,
        paidAmount: Number(invRecord.paidAmount || invRecord.paid_amount || invoice.amount),
        paymentChannel: (invRecord.paymentMethod ||
          invRecord.paymentChannel ||
          invRecord.payment_channel) as string | undefined,
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
    if (!callbackTokenHeader) return false;
    const received = Buffer.from(callbackTokenHeader);
    const expected = Buffer.from(webhookToken);
    return received.length === expected.length && timingSafeEqual(received, expected);
  }

  async createRefund(params: GatewayRefundParams): Promise<GatewayMoneyStatus> {
    const { secretKey } = await this.getCredentials();
    if (!secretKey) throw new Error("Xendit refund belum dikonfigurasi");
    // Raw response retains refund status (the installed SDK's Refund model drops it).
    const response = await fetch("https://api.xendit.co/refunds", {
      method: "POST",
      signal: AbortSignal.timeout(15000),
      headers: {
        Authorization: `Basic ${Buffer.from(`${secretKey}:`).toString("base64")}`,
        "Content-Type": "application/json",
        "idempotency-key": params.externalId,
      },
      body: JSON.stringify({
        reference_id: params.externalId,
        ...(params.referenceNo.startsWith("pr-")
          ? { payment_request_id: params.referenceNo }
          : { invoice_id: params.referenceNo }),
        amount: params.amount,
        currency: "IDR",
        reason: "REQUESTED_BY_CUSTOMER",
        metadata: { reason: params.reason.slice(0, 500) },
      }),
    });
    if (!response.ok) throw new Error(`Xendit refund HTTP ${response.status}`);
    const result = (await response.json()) as { id?: string; status?: string; amount?: number };
    return { id: result.id, amount: result.amount, status: normalizeMoneyStatus(result.status) };
  }

  async queryRefund(params: {
    id?: string;
    externalId: string;
    referenceNo: string;
  }): Promise<GatewayMoneyStatus> {
    const { secretKey } = await this.getCredentials();
    if (!secretKey) throw new Error("Xendit refund belum dikonfigurasi");
    const lookupUrl = params.id
      ? `https://api.xendit.co/refunds/${encodeURIComponent(params.id)}`
      : `https://api.xendit.co/refunds?${params.referenceNo.startsWith("pr-") ? "payment_request_id" : "invoice_id"}=${encodeURIComponent(params.referenceNo)}`;
    const response = await fetch(lookupUrl, {
      headers: { Authorization: `Basic ${Buffer.from(`${secretKey}:`).toString("base64")}` },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error(`Xendit refund inquiry HTTP ${response.status}`);
    interface XenditRefundItem {
      id?: string;
      amount?: number;
      status?: string;
      reference_id?: string;
    }
    const body = (await response.json()) as XenditRefundItem & { data?: XenditRefundItem[] };
    const result = params.id
      ? body
      : (body.data || []).find((item) => item.reference_id === params.externalId);
    return result
      ? { id: result.id, amount: result.amount, status: normalizeMoneyStatus(result.status) }
      : { status: "UNKNOWN" };
  }

  async queryDisbursement(params: {
    id?: string;
    externalId: string;
  }): Promise<GatewayMoneyStatus> {
    const client = await this.getClient();
    if (!client) throw new Error("Xendit payout belum dikonfigurasi");
    const payout = params.id
      ? await client.Payout.getPayoutById({ id: params.id })
      : (await client.Payout.getPayouts({ referenceId: params.externalId })).data?.[0];
    return payout
      ? { id: payout.id, amount: payout.amount, status: normalizeMoneyStatus(payout.status) }
      : { status: "UNKNOWN" };
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
