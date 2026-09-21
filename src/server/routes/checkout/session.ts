import { db } from "../../db";
import { apps, transactions, licenses } from "../../db/schema";
import { eq, and } from "drizzle-orm";
import { DanaService } from "../../services/dana";
import { CouponService } from "../../services/coupon";
import { LicenseService } from "../../services/license";
import { CreditService } from "../../services/credits";
import { EmailService } from "../../services/email";
import { config as checkoutConfig, resolveRequestOrigin } from "../../config";
import { randomBytes } from "crypto";

const DEFAULT_PRICE = checkoutConfig.defaultPrice;

const formatIdr = (value: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR" }).format(value);

/**
 * Pemicu Dynamic & Headless Checkout Link
 */
export async function handleCreateSession({ request, body, set }: any) {
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
    // Kredit ditambahkan ke ledger lisensi saat webhook pembayaran terkonfirmasi.
    grantCredits = 0,
    redirectUrl,
    couponCode,
    paymentRail,
    preferredPaymentChannel,
    scenario,
    vaBank,
    bank,
  } = body;

  // B8: Dukung preferredPaymentChannel (dari PayView) maupun paymentRail secara konsisten
  const selectedRail = (paymentRail || preferredPaymentChannel || "qris") as "qris" | "va" | "ewallet";
  const selectedBank = (vaBank || bank || "BCA").toUpperCase();
  const selectedScenario = scenario || (selectedRail === "qris" || selectedRail === "va" ? "API" : "REDIRECT");

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
    set.status = 404;
    return { error: `Produk / Aplikasi "${targetIdentifier}" tidak ditemukan` };
  }

  const isSandboxApp = app.mode === "sandbox";

  // B6: Guard produksi — aplikasi sandbox tidak boleh diperjualbelikan kepada publik di production
  if (isSandboxApp && !checkoutConfig.isSandbox) {
    set.status = 400;
    return {
      error:
        "Aplikasi ini masih dalam mode Sandbox dan belum dipublikasikan untuk transaksi publik. Pengembang perlu mengubah status aplikasi menjadi Live di Dashboard.",
    };
  }

  const email = (buyerEmail || customerEmail || "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    set.status = 400;
    return { error: "Email pembeli tidak valid" };
  }

  // P1 & P2: Eksekusi Free Trial jika diminta dan produk memiliki trialPeriodDays > 0
  const isTrialRequested = Boolean(body.startTrial || body.isTrial);
  if (isTrialRequested && (app.trialPeriodDays ?? 0) > 0) {
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
      };
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

    const [trialTx] = await db
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
      })
      .returning();

    const [newLic] = await db
      .insert(licenses)
      .values({
        id: licId,
        appId: app.id,
        transactionId: trialTx.id,
        customerEmail: email,
        licenseKey,
        status: "ACTIVE",
        expiresAt,
        maxSeats: app.deliveryConfig?.licenseKey?.maxSeats ?? 3,
        apiKey: trialApiKey,
      })
      .returning();

    if (trialGrantCredits > 0) {
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
      ).catch(() => null);
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
      redirectUrl: redirectUrl || app.redirectUrl || `${requestOrigin}/checkout/success?licenseKey=${licenseKey}`,
    };
  }

  // B2: grantDays sepenuhnya ditentukan oleh otoritas konfigurasi produk (deliveryConfig), bukan input klien.
  const productGrantDays = app.deliveryConfig?.licenseKey?.expiresInDays;
  const grantDays =
    typeof productGrantDays === "number" && productGrantDays > 0
      ? productGrantDays
      : 365;

  // B1: Harga resmi aplikasi adalah basis otoritas list price.
  const appPrice = app.targetPrice ?? 0;
  const requestedAmount = customAmount ?? amount ?? null;

  // List price sebelum diskon: gunakan appPrice (atau requestedAmount jika custom donation > appPrice)
  const listPrice =
    appPrice > 0
      ? Math.max(requestedAmount && requestedAmount >= appPrice ? requestedAmount : appPrice, appPrice)
      : (requestedAmount ?? DEFAULT_PRICE);

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

  // Validasi jika pembeli sengaja mengirim nominal di bawah listPrice tanpa kupon yang sah
  if (appPrice > 0 && requestedAmount !== null && requestedAmount < appPrice) {
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

  // Payment gateway tunggal resmi: DANA Enterprise
  const selectedGateway = "dana" as const;

  // Hitung Merchant of Record 5% platform fee & 95% net atas nominal yang dibayar
  const { grossAmount, platformFee, netAmount } =
    DanaService.calculateMorBreakdown(payableAmount);

  const txId = `tx_${randomBytes(8).toString("hex")}`;
  const externalId = `tt_${randomBytes(8).toString("hex")}`;

  const danaOrder = await DanaService.createOrder({
    externalId,
    amount: grossAmount,
    payerEmail: email,
    description: `Lisensi ${app.name} (${grantDays} hari)`,
    returnUrl: redirectUrl || app.redirectUrl || undefined,
    finishRedirectUrl: `${requestOrigin}/checkout/dana/finish?externalId=${externalId}`,
    forceMock: checkoutConfig.isTest ? isSandboxApp : false,
    scenario: selectedScenario,
    paymentRail: selectedRail,
    vaBank: selectedBank,
  });

  const invoiceUrl = danaOrder.checkoutUrl;
  const invoiceId = danaOrder.orderId;
  const expiryDate = danaOrder.expiryDate;

  // Tentukan label paymentChannel yang disimpan
  const savedChannel = danaOrder.paymentRail === "va"
    ? `VA_${danaOrder.vaBank || selectedBank}`
    : (danaOrder.paymentRail === "qris" ? "QRIS" : "DANA");

  // Simpan transaksi di database
  const [newTx] = await db
    .insert(transactions)
    .values({
      id: txId,
      appId: app.id,
      builderId: app.builderId,
      paymentProvider: selectedGateway,
      providerReferenceId: invoiceId,
      xenditInvoiceId: invoiceId,
      xenditExternalId: externalId,
      xenditInvoiceUrl: invoiceUrl,
      customerEmail: email,
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

  // 3. Klaim kuota kupon ATOMIK hanya setelah transaksi tercatat.
  // Jika kehabisan kuota di sini (race), hapus transaksi tadi dan gagalkan
  // checkout — jangan sampai invoice terdiskon beredar tanpa kuota kupon.
  if (coupon) {
    const redeemed = await CouponService.redeem(coupon.id);
    if (!redeemed) {
      await db.delete(transactions).where(eq(transactions.id, newTx.id));
      set.status = 409;
      return {
        success: false,
        error: "Kuota kupon baru saja habis. Transaksi tidak dibuat.",
        errorCode: "COUPON_EXHAUSTED",
      };
    }
  }

  return {
    success: true,
    data: {
      sessionId: newTx.id,
      paymentGateway: selectedGateway,
      checkoutUrl: invoiceUrl,
      xenditInvoiceUrl: invoiceUrl,
      expiresAt: expiryDate || new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      isSandbox: isSandboxApp,
      scenario: danaOrder.scenario,
      paymentRail: danaOrder.paymentRail,
      paymentCode: danaOrder.paymentCode,
      qrDataUrl: danaOrder.qrDataUrl,
      vaBank: danaOrder.vaBank,
    },
    transactionId: newTx.id,
    checkoutUrl: invoiceUrl,
    scenario: danaOrder.scenario,
    paymentRail: danaOrder.paymentRail,
    paymentCode: danaOrder.paymentCode,
    qrDataUrl: danaOrder.qrDataUrl,
    vaBank: danaOrder.vaBank,
    paymentGateway: selectedGateway,
    amount: grossAmount,
    listPrice,
    discountAmount,
    discountPercent,
    grantDays,
    couponCode: coupon?.code,
    message: "Sesi pembayaran DANA berhasil disiapkan",
    platformFee,
    netDisbursementAmount: netAmount,
  };
}
