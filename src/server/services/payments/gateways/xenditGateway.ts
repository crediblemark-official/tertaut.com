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
  private channelsCache: {
    timestamp: number;
    key: string;
    data: GatewayChannelsResponse;
  } | null = null;

  /**
   * Menghapus cache payment channels agar perubahan segera aktif.
   */
  clearChannelsCache() {
    this.channelsCache = null;
  }

  /**
   * Tes dinamis koneksi API QRIS langsung ke Xendit (Live/Sandbox Probe).
   * Memastikan endpoint POST /qr_codes aktif & siap menerima transaksi.
   */
  async probeQrisLive(): Promise<{ success: boolean; status?: string; message: string }> {
    const { secretKey } = await this.getCredentials();
    if (!secretKey) {
      return { success: false, message: "Secret key Xendit belum disetel." };
    }
    try {
      const resp = await fetch("https://api.xendit.co/qr_codes", {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${secretKey}:`).toString("base64")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          external_id: `probe_check_${Date.now()}`,
          type: "DYNAMIC",
          amount: 10000,
          callback_url: "https://tertaut.com/api/v1/payments/xendit/webhook",
        }),
      });

      if (!resp.ok) {
        const errJson: any = await resp.json().catch(() => ({}));
        return {
          success: false,
          message: errJson.message || `Xendit API mengembalikan HTTP ${resp.status}`,
        };
      }

      const data: any = await resp.json();
      return {
        success: true,
        status: data.status,
        message: `Koneksi QRIS Xendit aktif (${data.type || "DYNAMIC"}).`,
      };
    } catch (err: any) {
      return {
        success: false,
        message: err?.message || "Gagal menghubungi Xendit API.",
      };
    }
  }

  /**
   * Mengambil daftar channel pembayaran yang aktif langsung dari API resmi Xendit
   * dan database platform_settings secara dinamis.
   */
  async getPaymentChannels(forceRefresh = false): Promise<GatewayChannelsResponse> {
    const { secretKey } = await this.getCredentials();
    if (!secretKey || !secretKey.startsWith("xnd_")) {
      return {
        channels: [],
        activeRails: ["va", "qris"],
        activeBanks: ["BCA", "MANDIRI", "BNI", "BRI", "PERMATA", "BSI", "CIMB"],
        activeEwallets: [],
        activeRetails: ["ALFAMART", "INDOMARET"],
        qrisEnabled: true,
        cardEnabled: false,
      };
    }

    const now = Date.now();
    if (
      !forceRefresh &&
      this.channelsCache &&
      this.channelsCache.key === secretKey &&
      now - this.channelsCache.timestamp < 300_000
    ) {
      return this.channelsCache.data;
    }

    // Ambil konfigurasi override dinamis dari database platform_settings
    let qrisSettingVal: string | null = null;
    let vaSettingVal: string | null = null;
    let retailSettingVal: string | null = null;
    try {
      const [qrisSettingRow, vaSettingRow, retailSettingRow] = await Promise.all([
        db.query.platformSettings.findFirst({
          where: eq(platformSettings.key, "xendit_qris_enabled"),
        }),
        db.query.platformSettings.findFirst({
          where: eq(platformSettings.key, "xendit_va_enabled"),
        }),
        db.query.platformSettings.findFirst({
          where: eq(platformSettings.key, "xendit_retail_enabled"),
        }),
      ]);
      qrisSettingVal = qrisSettingRow?.value ?? null;
      vaSettingVal = vaSettingRow?.value ?? null;
      retailSettingVal = retailSettingRow?.value ?? null;
    } catch (dbErr) {
      console.warn("[XenditGateway] Gagal membaca platform_settings channel override:", dbErr);
    }

    let channels: any[] = [];
    try {
      const resp = await fetch("https://api.xendit.co/payment_channels", {
        headers: {
          Authorization: `Basic ${Buffer.from(`${secretKey}:`).toString("base64")}`,
        },
      });

      if (resp.ok) {
        const rawList: any[] = await resp.json();
        if (Array.isArray(rawList)) {
          channels = rawList.map((c) => ({
            channelCode: String(c.channel_code || "").toUpperCase(),
            channelCategory: String(c.channel_category || "").toUpperCase(),
            isEnabled: Boolean(c.is_enabled),
            name: String(c.name || ""),
          }));
        }
      } else {
        console.warn(`[XenditGateway] Gagal mengambil payment channels: HTTP ${resp.status}`);
      }
    } catch (err) {
      console.warn("[XenditGateway] Error fetching payment channels:", err);
    }

    // 1. Evaluasi QRIS secara dinamis:
    // - Jika disetel manual di platform_settings ("true" atau "false"), patuhi setting admin.
    // - Jika "auto" atau belum disetel:
    //   Periksa apakah endpoint legacy menyatakan true. JIKA endpoint legacy mengembalikan false
    //   (karena endpoint legacy hanya melacak invoice lama, bukan API QR modern),
    //   kita aktifkan secara otomatis untuk akun produksi terverifikasi (xnd_production_*)
    //   atau akun development yang aktif.
    let qrisEnabled: boolean;
    if (qrisSettingVal === "true") {
      qrisEnabled = true;
    } else if (qrisSettingVal === "false") {
      qrisEnabled = false;
    } else {
      const legacyQrisEnabled = channels.some((c) => c.channelCategory === "QRIS" && c.isEnabled);
      qrisEnabled =
        legacyQrisEnabled ||
        secretKey.startsWith("xnd_production_") ||
        secretKey.startsWith("xnd_development_");
    }

    // 2. Evaluasi Virtual Account:
    let activeBanks: string[] = channels
      .filter((c) => c.channelCategory === "VIRTUAL_ACCOUNT" && c.isEnabled)
      .map((c) => c.channelCode);
    if (activeBanks.length === 0 && vaSettingVal !== "false") {
      // Pada Xendit Indonesia: Mandiri, BNI, BRI, Permata, BSI, dan CIMB aktif langsung.
      // BCA membutuhkan perjanjian & aktivasi merchant BCA khusus ke Xendit (BANK_NOT_ACTIVATED_ERROR).
      // Nasabah BCA dapat membayar secara instan dan bebas biaya admin melalui QRIS Instan (BCA Mobile/myBCA/Blu).
      const isProd = secretKey.startsWith("xnd_production_");
      activeBanks = isProd
        ? ["MANDIRI", "BNI", "BRI", "PERMATA", "BSI", "CIMB"]
        : ["BCA", "MANDIRI", "BNI", "BRI", "PERMATA", "BSI", "CIMB"];
    }

    // 3. Evaluasi Retail Outlet:
    let activeRetails: string[] = channels
      .filter((c) => c.channelCategory === "RETAIL_OUTLET" && c.isEnabled)
      .map((c) => c.channelCode);
    if (activeRetails.length === 0 && retailSettingVal === "true") {
      activeRetails = ["ALFAMART", "INDOMARET"];
    }

    // 4. Evaluasi E-Wallets:
    const activeEwallets = channels
      .filter((c) => c.channelCategory === "EWALLET" && c.isEnabled)
      .map((c) => c.channelCode);

    // 5. Evaluasi Kartu Kredit:
    const cardEnabled = channels.some(
      (c) =>
        (c.channelCategory === "CREDIT_CARD" ||
          c.channelCategory === "CARDS" ||
          c.channelCategory === "CARD") &&
        c.isEnabled
    );

    const activeRails: Array<"qris" | "va" | "ewallet" | "card" | "retail"> = [];
    if (qrisEnabled) activeRails.push("qris");
    if (cardEnabled) activeRails.push("card");
    if (activeBanks.length > 0) activeRails.push("va");
    if (activeEwallets.length > 0) activeRails.push("ewallet");
    if (activeRetails.length > 0) activeRails.push("retail");

    const result: GatewayChannelsResponse = {
      channels,
      activeRails,
      activeBanks,
      activeEwallets,
      activeRetails,
      qrisEnabled,
      cardEnabled,
    };

    this.channelsCache = {
      timestamp: now,
      key: secretKey,
      data: result,
    };

    return result;
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
