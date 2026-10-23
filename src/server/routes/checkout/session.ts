import { db } from "../../db";
import { apps, transactions, licenses, builders, licenseActivations } from "../../db/schema";
import { platformSettings } from "../../db/schema/settings";
import { eq, and, inArray } from "drizzle-orm";
import { getClientIp } from "../../lib/ip";
import { logger } from "../../lib/logger";
import { XenditService } from "../../services/payments/xendit";
import { getActivePaymentGateway } from "../../services/payments/paymentGateway";
import { getPaymentGateway as getGatewayAdapter } from "../../services/payments/gateways";
import {
  gatewaySupportsRail,
  getGatewayDescriptor as gatewayDescriptor,
  normalizeGatewayId,
  resolveGatewayForRail,
  type GatewayId,
} from "../../services/payments/gateways/registry";
import { CouponService } from "../../services/monetization/coupon";
import { LicenseService } from "../../services/licensing/license";
import { EmailService } from "../../services/notifications/email";
import { config as checkoutConfig, resolveRequestOrigin } from "../../config";
import { enforceRateLimitAsync } from "../../services/security/rateLimiter";
import { handleFreeTrialCheckout } from "./freeTrial";
import { createPollTicket } from "../../utils/pollTicket";
import { randomBytes } from "crypto";
import QRCode from "qrcode";

const DEFAULT_PRICE = checkoutConfig.defaultPrice;

const formatIdr = (value: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR" }).format(value);

export interface CreateSessionBody {
  appId?: string;
  appSlug?: string;
  slug?: string;
  paymentGateway?: string;
  demoMode?: boolean;
  scenario?: "API" | "REDIRECT";
  paymentRail?: "qris" | "va" | "ewallet" | "card" | "retail" | "";
  preferredPaymentChannel?: string;
  vaBank?: string;
  bank?: string;
  ewalletChannel?: string;
  retailOutlet?: string;
  amount?: number;
  customAmount?: number;
  customerEmail?: string;
  buyerEmail?: string;
  grantDays?: number;
  redirectUrl?: string;
  couponCode?: string;
  startTrial?: boolean;
  isTrial?: boolean;
  hwid?: string;
  hardwareId?: string;
  deviceFingerprint?: string;
  deviceId?: string;
  customerName?: string;
  paymentChannel?: string;
  name?: string;
  deviceName?: string;
  metadata?: Record<string, any>;
}

export interface CreateSessionContext {
  request?: Request | any;
  body: CreateSessionBody;
  set?: { status?: number | string; headers?: any; [key: string]: any };
  [key: string]: any;
}

/**
 * Pemicu Dynamic & Headless Checkout Link
 */
export async function handleCreateSession({ request, body, set = {} }: CreateSessionContext) {
  try {
    // BUG-6: batasi pembuatan sesi per IP agar endpoint publik ini tidak bisa
    // dipakai untuk brute-force / spam invoice.
    const rl = await enforceRateLimitAsync(request, "checkout:session", 60, 60_000);
    if (!rl.allowed) {
      set.status = 429;
      return { success: false, error: "Terlalu banyak permintaan. Coba lagi sebentar lagi." };
    }

    const requestOrigin = resolveRequestOrigin(request);
    const {
      appId,
      appSlug,
      slug,
      amount,
      customAmount,
      customerEmail,
      buyerEmail,
      grantDays: clientGrantDays,
      redirectUrl,
      couponCode,
      paymentRail,
      preferredPaymentChannel,
      scenario,
      demoMode,
      vaBank,
      bank,
      ewalletChannel,
      retailOutlet,
      customerName,
      metadata,
      paymentChannel: rawPaymentChannel,
    } = body;

    // Normalisasi paymentChannel ke uppercase untuk konsistensi dengan index parsial DB
    const paymentChannel = String(rawPaymentChannel || "")
      .trim()
      .toUpperCase();

    // B8: Dukung preferredPaymentChannel (dari PayView) maupun paymentRail secara konsisten
    const selectedRail = (paymentRail || preferredPaymentChannel || "") as
      "qris" | "va" | "ewallet" | "card" | "retail" | "";
    const selectedBank = (vaBank || bank || "BCA").toUpperCase();

    // Baca preferensi mode checkout dari platformSettings (Super Admin Panel)
    const checkoutModeRow = await db.query.platformSettings.findFirst({
      where: eq(platformSettings.key, "checkout_mode"),
    });
    const isHostedMode = checkoutModeRow?.value === "hosted";

    const targetIdentifier = appId || appSlug || slug;
    if (!targetIdentifier) {
      set.status = 400;
      return { error: "appId atau appSlug wajib disertakan" };
    }

    // Cari aplikasi berdasarkan ID atau Slug
    let app = await db.query.apps.findFirst({
      where: eq(apps.id, targetIdentifier),
    });

    if (!app) {
      app = await db.query.apps.findFirst({
        where: eq(apps.slug, targetIdentifier),
      });
    }

    if (!app) {
      try {
        const { DEMO_APPS, ensureDemoData } = await import("../../db/ensureDemo");
        const isDemo = DEMO_APPS.some(
          (d) => d.id === targetIdentifier || d.slug === targetIdentifier
        );
        if (isDemo) {
          await ensureDemoData();
          app = await db.query.apps.findFirst({
            where: eq(apps.id, targetIdentifier),
          });
          if (!app) {
            app = await db.query.apps.findFirst({
              where: eq(apps.slug, targetIdentifier),
            });
          }
        }
      } catch {}
    }

    if (!app) {
      set.status = 404;
      return { error: `Produk / Aplikasi "${targetIdentifier}" tidak ditemukan` };
    }

    if (app.isSuspended) {
      set.status = 403;
      return {
        success: false,
        error:
          "Aplikasi ini sedang dinonaktifkan sementara oleh platform. Transaksi tidak dapat diproses.",
        errorCode: "APP_SUSPENDED",
      };
    }

    const builder = await db.query.builders.findFirst({
      where: eq(builders.id, app.builderId),
    });
    if (builder?.isSuspended) {
      set.status = 403;
      return {
        success: false,
        error: "Akun builder aplikasi ini sedang dibekukan sementara oleh platform.",
        errorCode: "BUILDER_SUSPENDED",
      };
    }

    const isSandboxApp = app.mode === "sandbox";
    const email = (buyerEmail || customerEmail || "").trim().toLowerCase();
    if (!email || !email.includes("@")) {
      set.status = 400;
      return { error: "Email pembeli tidak valid" };
    }

    const rawHwid = String(
      body.hwid ||
        body.hardwareId ||
        body.deviceFingerprint ||
        body.deviceId ||
        (typeof body.metadata === "object" && body.metadata !== null
          ? body.metadata.hwid || body.metadata.hardwareId || body.metadata.deviceFingerprint
          : "") ||
        ""
    ).trim();

    const clientIp = getClientIp(request) || "127.0.0.1";

    // P1 & P2: Eksekusi Free Trial jika diminta dan produk memiliki trialPeriodDays > 0 (tidak butuh gateway pembayaran)
    const isTrialRequested = Boolean(
      body.startTrial ||
      body.isTrial ||
      String(body.paymentChannel || "")
        .trim()
        .toUpperCase() === "FREE_TRIAL"
    );
    if (isTrialRequested && (app.trialPeriodDays ?? 0) > 0) {
      return await handleFreeTrialCheckout({
        app,
        builder,
        email,
        rawHwid,
        clientIp,
        body,
        set,
        requestOrigin,
        redirectUrl,
        metadata,
      });
    }

    // B2: grantDays sepenuhnya ditentukan oleh otoritas konfigurasi produk (deliveryConfig), bukan input klien.
    const productGrantDays = app.deliveryConfig?.licenseKey?.expiresInDays;
    const grantDays =
      typeof productGrantDays === "number" && productGrantDays > 0 ? productGrantDays : 365;

    // B1: Harga resmi aplikasi atau nominal dinamis dari backend S2S
    const appPrice = app.targetPrice ?? 0;
    const requestedAmount = customAmount ?? amount ?? null;

    // Cek otentikasi S2S via Secret API Key builder
    const reqHeaders: any = request?.headers;
    const authHeader =
      (typeof reqHeaders?.get === "function"
        ? reqHeaders.get("authorization") || reqHeaders.get("x-api-key")
        : reqHeaders?.authorization || reqHeaders?.["x-api-key"]) || "";
    const bearerKey = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : authHeader.trim();
    const isS2SAuth = Boolean(builder?.secretApiKey && bearerKey === builder.secretApiKey);

    if (!isS2SAuth && app.appType === "saas_web" && appPrice <= 0) {
      set.status = 401;
      return {
        success: false,
        error: "Checkout dengan nominal dinamis memerlukan secret API key builder",
        errorCode: "S2S_REQUIRED",
      };
    }

    // List price sebelum diskon:
    let listPrice: number;
    if (isS2SAuth) {
      // Hanya backend builder terautentikasi yang berwenang menentukan nominal dinamis.
      listPrice =
        typeof requestedAmount === "number" && requestedAmount > 0
          ? requestedAmount
          : appPrice > 0
            ? appPrice
            : DEFAULT_PRICE;
    } else {
      listPrice =
        appPrice > 0
          ? Math.max(
              requestedAmount && requestedAmount >= appPrice ? requestedAmount : appPrice,
              appPrice
            )
          : (requestedAmount ?? DEFAULT_PRICE);
    }

    // 1. Validasi & hitung diskon kupon (jika ada)
    let coupon: Awaited<ReturnType<typeof CouponService.validate>>["coupon"] = undefined;
    let discountAmount = 0;
    let discountPercent = 0;
    if (couponCode) {
      const couponResult = await CouponService.validate(couponCode, app.id, listPrice);
      if (!couponResult.valid) {
        set.status = 400;
        return {
          error: couponResult.message || "Kupon tidak valid.",
          errorCode: couponResult.errorCode,
        };
      }
      coupon = couponResult.coupon;
      discountAmount = couponResult.discountAmount || 0;
      discountPercent = couponResult.discountPercent || 0;
    }

    // Public checkout cannot underpay the product price without a valid coupon.
    if (!isS2SAuth && appPrice > 0 && requestedAmount !== null && requestedAmount < appPrice) {
      const expectedPayable = Math.max(0, listPrice - discountAmount);
      // Jika requestedAmount tidak cocok dengan harga diskon kupon yang sah
      if (!coupon || requestedAmount !== expectedPayable) {
        set.status = 400;
        return {
          error: `Nominal pembayaran tidak valid. Harga resmi "${app.name}" adalah ${formatIdr(appPrice)}.`,
        };
      }
    }

    // 2. Nominal yang benar-benar dibayar setelah diskon
    const payableAmount = Math.max(0, listPrice - discountAmount);
    if (payableAmount <= 0) {
      set.status = 400;
      return {
        error: `Diskon kupon ${discountPercent}% membuat total pembayaran menjadi nol. Gunakan kupon dengan diskon lebih rendah atau hubungi developer aplikasi.`,
      };
    }

    // Resolve payment gateway: request body -> setting platform -> gateway default.
    // Semua normalisasi nama (alias, allowlist)diurus registry.
    const activePlatformPg = await getActivePaymentGateway();
    if (body.paymentGateway && !normalizeGatewayId(body.paymentGateway)) {
      set.status = 400;
      return { success: false, error: "Gateway pembayaran tidak didukung. Gunakan Xendit." };
    }
    let selectedGateway: GatewayId = demoMode
      ? "sandbox"
      : (normalizeGatewayId(body.paymentGateway) ?? (activePlatformPg as GatewayId));

    if (!isSandboxApp && (demoMode || selectedGateway === "sandbox")) {
      set.status = 403;
      return {
        success: false,
        error: "Simulasi hanya tersedia untuk aplikasi sandbox",
        errorCode: "SANDBOX_NOT_ALLOWED",
      };
    }

    // Rail yang tidak didukung gateway terpilih dialihkan ke gateway TERDAFTAR
    // lain yang mendukungnya.
    //
    // Sebelumnya logikanya ditulis sebagai daftar "Xendit-exclusive rail"
    // hardcode per metode pembayaran.
    // Sekarang pertanyaannya generik: "gateway mana yang bisa lays down rail ini?"
    const railCtx = {
      rail: selectedRail,
      ewalletChannel: ewalletChannel ?? undefined,
      bankCode: vaBank || bank || undefined,
    };
    if (!gatewaySupportsRail(selectedGateway, railCtx)) {
      const alternative = resolveGatewayForRail(railCtx);
      if (alternative && alternative !== selectedGateway) {
        selectedGateway = alternative;
      }
    }

    const defaultScenario = isHostedMode ? "REDIRECT" : selectedRail ? "API" : "REDIRECT";
    const selectedScenario =
      demoMode || selectedGateway === "sandbox" || isSandboxApp
        ? "API"
        : isHostedMode
          ? "REDIRECT"
          : scenario || defaultScenario;

    // Pilihan Adapter:
    // Gunakan gateway adapter terpilih. Jika gateway adalah "sandbox", transaksi 100%
    // terisolasi secara internal dan tidak menembak vendor PG produksi riil.
    const effectiveGatewayId = selectedGateway;
    const gatewayAdapter = getGatewayAdapter(effectiveGatewayId);

    // Hitung Merchant of Record 5% platform fee & 95% net atas nominal yang dibayar
    const { grossAmount, platformFee, netAmount } = gatewayAdapter.calculateMor(payableAmount);

    const txId = `tx_${randomBytes(8).toString("hex")}`;
    const externalId = `tt_${randomBytes(8).toString("hex")}`;

    // Path finish diambil dari registry
    const finishPath = gatewayDescriptor(effectiveGatewayId)?.finishPath ?? "/checkout/success";
    const pollTicket = createPollTicket(txId);
    const finishRedirectUrl = `${requestOrigin}${finishPath}?externalId=${externalId}&ticket=${encodeURIComponent(pollTicket)}`;

    const resolvedBank = (
      vaBank ||
      bank ||
      gatewayDescriptor(effectiveGatewayId)?.defaultVaBank ||
      "BCA"
    ).toUpperCase();

    // 3. Klaim kuota kupon ATOMIK SEBELUM membuat order di payment gateway (P0 Race Condition Fix).
    // Ini menutup race window: jika 2 buyer paralel memperebutkan 1 sisa kuota,
    // buyer kedua langsung ditolak tanpa sempat membuat invoice terdiskon liar di payment gateway.
    let couponClaimed = false;
    if (coupon) {
      couponClaimed = await CouponService.redeem(coupon.id);
      if (!couponClaimed) {
        set.status = 400;
        return {
          success: false,
          error: "Kuota penebusan kupon telah habis. Transaksi tidak dibuat.",
          errorCode: "COUPON_EXHAUSTED",
        };
      }
    }

    const gatewayDescriptorForTx = gatewayDescriptor(effectiveGatewayId);
    const hostedPayUrl = `${requestOrigin}/pay/${app.slug || targetIdentifier}?externalId=${externalId}`;

    let orderResult: Awaited<ReturnType<typeof gatewayAdapter.createOrder>>;
    let newTx: typeof transactions.$inferSelect;
    let invoiceUrl: string;
    let expiryDate: string | undefined;

    try {
      orderResult = await gatewayAdapter.createOrder({
        externalId,
        amount: grossAmount,
        payerEmail: email,
        description: `Lisensi ${app.name} (${grantDays} hari)`,
        returnUrl: redirectUrl || app.redirectUrl || undefined,
        finishRedirectUrl,
        demoMode,
        scenario: selectedScenario,
        paymentRail:
          selectedScenario === "API"
            ? selectedRail || undefined
            : isHostedMode
              ? undefined
              : selectedRail || undefined,
        vaBank: resolvedBank,
        ewalletChannel,
        retailOutlet,
      });

      invoiceUrl = effectiveGatewayId === "sandbox" ? hostedPayUrl : orderResult.checkoutUrl;
      const invoiceId = orderResult.orderId;
      expiryDate = orderResult.expiryDate;

      // Label paymentChannel disusun dari nama gateway di registry
      const gatewaySlug = effectiveGatewayId.replace(/[^a-z0-9]/gi, "").toUpperCase();
      const savedChannel =
        orderResult.paymentRail === "va"
          ? `VA_${orderResult.vaBank || selectedBank}`
          : orderResult.paymentRail === "qris"
            ? (gatewayDescriptorForTx?.qrChannelLabel ?? "QRIS")
            : orderResult.paymentRail === "card"
              ? "CARD"
              : orderResult.paymentRail === "retail"
                ? "RETAIL"
                : gatewaySlug;

      // Simpan transaksi di database
      [newTx] = await db
        .insert(transactions)
        .values({
          id: txId,
          appId: app.id,
          builderId: app.builderId,
          mode: app.mode,
          paymentCode: orderResult.paymentCode || null,
          qrDataUrl: orderResult.qrDataUrl || null,
          paymentExpiresAt: expiryDate ? new Date(expiryDate) : null,
          paymentProvider: effectiveGatewayId,
          providerReferenceId: invoiceId,
          xenditInvoiceId: invoiceId,
          xenditExternalId: externalId,
          xenditInvoiceUrl: invoiceUrl,
          customerEmail: email,
          customerName: customerName || body.name || null,
          metadata: metadata || null,
          grossAmount,
          platformFee,
          netAmount,
          paymentChannel: savedChannel,
          couponCode: coupon?.code || null,
          discountAmount,
          paymentStatus: "PENDING",
          disbursementStatus: "PENDING",
          grantDays,
        })
        .returning();
    } catch (err) {
      if (coupon && couponClaimed) {
        await CouponService.rollback(coupon.id).catch(() => {});
      }
      throw err;
    }

    const gatewayLabel = gatewayDescriptorForTx?.displayName ?? selectedGateway;

    return {
      success: true,
      data: {
        sessionId: newTx.id,
        snapToken: newTx.id,
        ticket: pollTicket,
        paymentGateway: selectedGateway,
        checkoutUrl: invoiceUrl,
        xenditInvoiceUrl: invoiceUrl,
        expiresAt: expiryDate || new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        isSandbox: isSandboxApp,
        scenario: orderResult.scenario,
        paymentRail: orderResult.paymentRail,
        paymentCode: orderResult.paymentCode,
        qrDataUrl: orderResult.qrDataUrl,
        vaBank: orderResult.vaBank,
        hostedPayUrl,
      },
      transactionId: newTx.id,
      snapToken: newTx.id,
      ticket: pollTicket,
      checkoutUrl: invoiceUrl,
      hostedPayUrl,
      scenario: orderResult.scenario,
      paymentRail: orderResult.paymentRail,
      paymentCode: orderResult.paymentCode,
      qrDataUrl: orderResult.qrDataUrl,
      vaBank: orderResult.vaBank,
      paymentGateway: selectedGateway,
      amount: grossAmount,
      listPrice,
      discountAmount,
      discountPercent,
      grantDays,
      couponCode: coupon?.code,
      message: `Sesi pembayaran ${gatewayLabel} berhasil disiapkan`,
      platformFee,
      netDisbursementAmount: netAmount,
    };
  } catch (err: any) {
    logger.error("[handleCreateSession Error]", err);
    const msg = err?.message || "";
    set.status = 400;
    let errorMsg = "Terjadi kesalahan internal saat membuat sesi checkout. Silakan coba lagi.";
    if (
      err?.errorCode === "UNAUTHORIZED_SENDER_IP" ||
      err?.errorMessage?.includes("IP Allowlist") ||
      msg.includes("IP Allowlist") ||
      msg.includes("UNAUTHORIZED_SENDER_IP")
    ) {
      const rejectedIp =
        err?.errorMessage?.match(/IP\s+([\d.]+)/)?.[1] ||
        msg.match(/IP\s+([\d.]+)/)?.[1] ||
        "server";
      errorMsg =
        `IP ${rejectedIp} belum didaftarkan di IP Whitelist Xendit. ` +
        `Buka Dashboard Xendit (Settings > Developers > IP Whitelist) di https://dashboard.xendit.co/settings/developers#ip-allowlist ` +
        `lalu tambahkan IP ${rejectedIp} atau nonaktifkan pembatasan IP Allowlist.`;
      set.status = 400;
    } else if (
      msg.includes("XENDIT_SECRET_KEY") ||
      (msg.includes("Xendit") && msg.includes("belum dikonfigurasi"))
    ) {
      errorMsg =
        "Gateway pembayaran Xendit belum dikonfigurasi dengan benar di server atau Super Admin Panel.";
      set.status = 400;
    } else if (msg.toLowerCase().includes("timeout")) {
      errorMsg = "Gateway pembayaran tidak merespons tepat waktu. Silakan coba lagi beberapa saat.";
      set.status = 400;
    }
    return {
      success: false,
      error: errorMsg,
    };
  }
}
