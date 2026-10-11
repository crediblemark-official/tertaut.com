import { db } from "../../db";
import { apps, transactions, licenses, builders, licenseActivations } from "../../db/schema";
import { platformSettings } from "../../db/schema/settings";
import { eq, and, inArray } from "drizzle-orm";
import { getClientIp } from "../../lib/ip";
import { logger } from "../../lib/logger";
import { DanaService } from "../../services/payments/dana/dana";
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
import { CreditService } from "../../services/monetization/credits";
import { EmailService } from "../../services/notifications/email";
import { config as checkoutConfig, resolveRequestOrigin } from "../../config";
import { enforceRateLimit } from "../../services/security/rateLimiter";
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
  grantCredits?: number;
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
    const rl = enforceRateLimit(request, "checkout:session", 60, 60_000);
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
    } = body;

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

    const isSandboxApp = app.mode === "sandbox" || app.slug === "fastmail-ai";
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
      // Pre-check cepat 1 (UX): 409 bila email sudah pernah trial
      const existingTrial = await db.query.transactions.findFirst({
        where: and(
          eq(transactions.appId, app.id),
          eq(transactions.customerEmail, email),
          eq(transactions.paymentChannel, "FREE_TRIAL")
        ),
      });

      if (existingTrial) {
        set.status = 409;
        return {
          success: false,
          error: "Email ini sudah pernah mengaktifkan masa uji coba untuk produk ini.",
          errorCode: "TRIAL_EMAIL_ALREADY_USED",
        };
      }

      // Pre-check 2 (1.6 Device Fingerprinting Anti-Abuse):
      // Jika HWID/Device Fingerprint disertakan, tolak bila perangkat sudah pernah klaim trial app ini
      let lookupHashes: string[] = [];
      if (rawHwid) {
        lookupHashes = LicenseService.hwidLookupHashes(rawHwid);

        // Pre-check 2a: Lisensi trial yang sudah mengikat hardwareId ini
        const [existingHwidLic] = await db
          .select({ id: licenses.id })
          .from(licenses)
          .innerJoin(transactions, eq(licenses.transactionId, transactions.id))
          .where(
            and(
              eq(licenses.appId, app.id),
              eq(transactions.paymentChannel, "FREE_TRIAL"),
              inArray(licenses.hardwareId, lookupHashes)
            )
          )
          .limit(1);

        if (existingHwidLic) {
          set.status = 409;
          return {
            success: false,
            error: "Perangkat ini sudah pernah mengaktifkan masa uji coba untuk produk ini.",
            errorCode: "TRIAL_DEVICE_ALREADY_USED",
          };
        }

        // Pre-check 2b: Aktivasi perangkat pada lisensi trial
        const [existingActivation] = await db
          .select({ id: licenseActivations.id })
          .from(licenseActivations)
          .innerJoin(licenses, eq(licenseActivations.licenseId, licenses.id))
          .innerJoin(transactions, eq(licenses.transactionId, transactions.id))
          .where(
            and(
              eq(licenses.appId, app.id),
              eq(transactions.paymentChannel, "FREE_TRIAL"),
              inArray(licenseActivations.hwidHash, lookupHashes)
            )
          )
          .limit(1);

        if (existingActivation) {
          set.status = 409;
          return {
            success: false,
            error: "Perangkat ini sudah pernah mengaktifkan masa uji coba untuk produk ini.",
            errorCode: "TRIAL_DEVICE_ALREADY_USED",
          };
        }
      }

      const trialDays = app.trialPeriodDays!;
      const trialGrantCredits = Math.max(
        0,
        Math.floor(Number(app.meteringConfig?.freeAllowance) || 0)
      );
      const trialApiKey = app.deliveryConfig?.apiAccess?.enabled
        ? `tt_cust_${randomBytes(16).toString("hex")}`
        : undefined;
      const licenseKey = LicenseService.generateLicenseKey();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + trialDays);

      const txId = `tx_trial_${randomBytes(8).toString("hex")}`;
      const licId = `lic_${randomBytes(8).toString("hex")}`;

      let issued:
        | { duplicate: true; reason: "email" | "device" }
        | { trialTx: typeof transactions.$inferSelect; newLic: typeof licenses.$inferSelect };
      try {
        issued = await db.transaction(async (trx) => {
          // Cek ulang DI DALAM transaksi: anti-race (TOCTOU)
          const dupCheck = await trx.query.transactions.findFirst({
            where: and(
              eq(transactions.appId, app.id),
              eq(transactions.customerEmail, email),
              eq(transactions.paymentChannel, "FREE_TRIAL")
            ),
          });
          if (dupCheck) return { duplicate: true, reason: "email" };

          // Cek ulang HWID DI DALAM transaksi
          if (lookupHashes.length > 0) {
            const [hwidDup] = await trx
              .select({ id: licenses.id })
              .from(licenses)
              .innerJoin(transactions, eq(licenses.transactionId, transactions.id))
              .where(
                and(
                  eq(licenses.appId, app.id),
                  eq(transactions.paymentChannel, "FREE_TRIAL"),
                  inArray(licenses.hardwareId, lookupHashes)
                )
              )
              .limit(1);
            if (hwidDup) return { duplicate: true, reason: "device" };

            const [actDup] = await trx
              .select({ id: licenseActivations.id })
              .from(licenseActivations)
              .innerJoin(licenses, eq(licenseActivations.licenseId, licenses.id))
              .innerJoin(transactions, eq(licenses.transactionId, transactions.id))
              .where(
                and(
                  eq(licenses.appId, app.id),
                  eq(transactions.paymentChannel, "FREE_TRIAL"),
                  inArray(licenseActivations.hwidHash, lookupHashes)
                )
              )
              .limit(1);
            if (actDup) return { duplicate: true, reason: "device" };
          }

          const primaryHwidHash = rawHwid ? LicenseService.hashHardwareIdSecure(rawHwid) : null;

          const [tTx] = await trx
            .insert(transactions)
            .values({
              id: txId,
              appId: app.id,
              builderId: app.builderId,
              paymentProvider: "xendit",
              paymentChannel: "FREE_TRIAL",
              xenditExternalId: txId,
              customerEmail: email,
              grossAmount: 0,
              platformFee: 0,
              netAmount: 0,
              paymentStatus: "PAID",
              disbursementStatus: "COMPLETED",
              grantDays: trialDays,
              grantCredits: trialGrantCredits,
              metadata: {
                ...(typeof metadata === "object" && metadata !== null ? metadata : {}),
                hwidHash: primaryHwidHash,
                clientIp,
                deviceFingerprint: rawHwid || undefined,
              },
            })
            .returning();

          const [nLic] = await trx
            .insert(licenses)
            .values({
              id: licId,
              appId: app.id,
              transactionId: tTx.id,
              customerEmail: email,
              licenseKey,
              hardwareId: primaryHwidHash,
              status: "ACTIVE",
              expiresAt,
              maxSeats: app.deliveryConfig?.licenseKey?.maxSeats ?? 3,
              apiKey: trialApiKey,
            })
            .returning();

          if (primaryHwidHash) {
            await trx.insert(licenseActivations).values({
              id: `act_${randomBytes(8).toString("hex")}`,
              licenseId: licId,
              hwidHash: primaryHwidHash,
              deviceName: body.deviceName || "Primary Trial Device",
              ipAddress: clientIp,
            });
          }

          return { trialTx: tTx, newLic: nLic };
        });
      } catch (err: any) {
        // Backstop unik DB (uniq_transactions_trial_per_app_email): bila dua request
        // paralel menang balapan, salah satunya gagal di sini → balas 409, bukan 500.
        if (err?.code === "23505") {
          set.status = 409;
          return {
            success: false,
            error:
              "Email ini sudah pernah mengaktifkan masa uji coba untuk produk ini (permintaan bersamaan).",
            errorCode: "TRIAL_EMAIL_ALREADY_USED",
          };
        }
        throw err;
      }

      if ("duplicate" in issued) {
        set.status = 409;
        const isDevice = issued.reason === "device";
        return {
          success: false,
          error: isDevice
            ? "Perangkat ini sudah pernah mengaktifkan masa uji coba untuk produk ini."
            : "Email ini sudah pernah mengaktifkan masa uji coba untuk produk ini.",
          errorCode: isDevice ? "TRIAL_DEVICE_ALREADY_USED" : "TRIAL_EMAIL_ALREADY_USED",
        };
      }

      const { trialTx, newLic } = issued;

      if (trialGrantCredits > 0) {
        try {
          await CreditService.grant(
            {
              licenseId: newLic.id,
              appId: app.id,
              customerEmail: email,
            },
            trialGrantCredits,
            {
              reference: trialTx.id,
              description: `Trial initial credits: ${trialGrantCredits}`,
            }
          );
        } catch (creditErr: any) {
          logger.error(
            `[Checkout Trial] Gagal grant credits untuk lisensi ${newLic.id}`,
            creditErr
          );
        }
      }

      await EmailService.sendLicenseIssued({
        to: email,
        appName: app.name,
        licenseKey,
        expiresAt,
        deliveryDetails: {
          fileDownload: app.deliveryConfig?.fileDownload,
          privateNote: app.deliveryConfig?.privateNote,
          apiAccess: app.deliveryConfig?.apiAccess
            ? { ...app.deliveryConfig.apiAccess, apiKey: trialApiKey }
            : undefined,
        },
      }).catch(() => null);

      return {
        success: true,
        isTrial: true,
        trialPeriodDays: trialDays,
        transactionId: trialTx.id,
        licenseKey,
        expiresAt: expiresAt.toISOString(),
        message: `Masa uji coba gratis ${trialDays} hari berhasil diaktifkan!`,
        redirectUrl:
          redirectUrl ||
          app.redirectUrl ||
          `${requestOrigin}/checkout/success?licenseKey=${licenseKey}`,
      };
    }

    // B2: grantDays sepenuhnya ditentukan oleh otoritas konfigurasi produk (deliveryConfig), bukan input klien.
    const productGrantDays = app.deliveryConfig?.licenseKey?.expiresInDays;
    const grantDays =
      typeof productGrantDays === "number" && productGrantDays > 0 ? productGrantDays : 365;

    // Security fix: grantCredits adalah keputusan otoritatif produk (meteringConfig),
    // BUKAN input klien. Sebelumnya nilai ini dibaca dari body publik sehingga pembeli
    // anonim bisa mencetak kredit tak terbatas dengan sekali bayar.
    const grantCredits = Math.max(0, Math.floor(Number(app.meteringConfig?.freeAllowance) || 0));

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

    // List price sebelum diskon:
    let listPrice: number;
    if (isS2SAuth || app.appType === "saas_web") {
      // Otoritas Server-to-Server (S2S) atau SaaS Web: nominal dinamis penuh dari kodingan backend
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

    // Validasi jika pembeli sengaja mengirim nominal di bawah listPrice tanpa kupon yang sah (hanya berlaku untuk retail fixed DRM bukan S2S/SaaS Web)
    if (
      !isS2SAuth &&
      app.appType !== "saas_web" &&
      appPrice > 0 &&
      requestedAmount !== null &&
      requestedAmount < appPrice
    ) {
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
    let selectedGateway: GatewayId = demoMode
      ? "sandbox"
      : (normalizeGatewayId(body.paymentGateway) ?? activePlatformPg);

    // Rail yang tidak didukung gateway terpilih dialihkan ke gateway TERDAFTAR
    // lain yang mendukungnya.
    //
    // Sebelumnya logikanya ditulis sebagai daftar "Xendit-exclusive rail"
    // hardcode (card/retail/e-wallet non-DANA/bank tertentu → paksa Xendit).
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
    const finishRedirectUrl = `${requestOrigin}${finishPath}?externalId=${externalId}`;

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
        paymentRail: isHostedMode ? undefined : selectedRail || undefined,
        vaBank: resolvedBank,
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
          grantCredits,
        })
        .returning();
    } catch (err) {
      if (coupon && couponClaimed) {
        await CouponService.rollback(coupon.id).catch(() => {});
      }
      throw err;
    }

    // Ticket polling status: bukti kepemilikan transaksi (BUG-5) supaya licenseKey
    // tidak bisa diambil oleh siapa pun yang hanya mengetahui txId.
    const pollTicket = createPollTicket(newTx.id);

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
      msg.includes("Invalid Merchant") ||
      msg.includes("externalStoreId") ||
      msg.includes("submerchant")
    ) {
      errorMsg =
        "Gateway DANA menolak transaksi: merchant/submerchant (externalStoreId) untuk " +
        "metode pembayaran ini belum terdaftar di dashboard DANA. Daftarkan di " +
        "https://dashboard.dana.id/sandbox/submerchants, atau gunakan aplikasi mode Sandbox untuk pengujian.";
      set.status = 400;
    } else if (
      msg.includes("DANA_CLIENT_ID") ||
      msg.includes("DANA_PRIVATE_KEY") ||
      (msg.includes("DANA") && msg.includes("tidak dikonfigurasi"))
    ) {
      errorMsg = "Gateway pembayaran DANA belum dikonfigurasi dengan benar di server.";
      set.status = 400;
    } else if (
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
    } else if (msg.includes("XenithPay") && msg.includes("belum dikonfigurasi")) {
      errorMsg =
        "Gateway pembayaran XenithPay belum dikonfigurasi di panel atau environment server.";
      set.status = 400;
    } else if (
      msg.includes("XenithPay API error") &&
      msg.toLowerCase().includes("ip address") &&
      msg.toLowerCase().includes("unauthorized")
    ) {
      errorMsg =
        "XenithPay menolak server ini: IP publik server belum diizinkan. " +
        "Tambahkan IP publik server ke allowlist akun XenithPay lalu coba lagi.";
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
