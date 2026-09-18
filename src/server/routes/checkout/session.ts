import { db } from "../../db";
import { apps, transactions } from "../../db/schema";
import { eq } from "drizzle-orm";
import { XenditService } from "../../services/xendit";
import { DanaService } from "../../services/dana";
import { CouponService } from "../../services/coupon";
import { config as checkoutConfig } from "../../config";
import { randomBytes } from "crypto";

const DEFAULT_PRICE = checkoutConfig.defaultPrice;

const formatIdr = (value: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR" }).format(value);

/**
 * Pemicu Dynamic & Headless Checkout Link
 */
export async function handleCreateSession({ body, set }: any) {
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
  } = body;

  // B8: Dukung preferredPaymentChannel (dari PayView) maupun paymentRail secara konsisten
  const selectedRail = paymentRail || preferredPaymentChannel;
  const RAIL_PAYMENT_METHODS: Record<string, string[]> = {
    qris: ["QRIS"],
    va: ["BCA", "BNI", "BRI", "MANDIRI", "PERMATA", "CIMB"],
    ewallet: ["OVO", "DANA", "SHOPEEPAY", "LINKAJA"],
  };
  const paymentMethods = selectedRail
    ? RAIL_PAYMENT_METHODS[String(selectedRail).toLowerCase()]
    : undefined;

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

  // Tentukan payment gateway yang aktif (override per request > default config)
  const selectedGateway: "xendit" | "dana" =
    (body.paymentGateway?.toLowerCase() === "dana" ||
      (!body.paymentGateway && checkoutConfig.paymentGateway === "dana"))
      ? "dana"
      : "xendit";

  // Hitung Merchant of Record 5% platform fee & 95% net atas nominal yang dibayar
  const { grossAmount, platformFee, netAmount } =
    selectedGateway === "dana"
      ? DanaService.calculateMorBreakdown(payableAmount)
      : XenditService.calculateMorBreakdown(payableAmount);

  const txId = `tx_${randomBytes(8).toString("hex")}`;
  const externalId = `tt_${app.id}_${Date.now()}`;

  let invoiceUrl = "";
  let invoiceId = "";
  let expiryDate = "";

  if (selectedGateway === "dana") {
    const danaOrder = await DanaService.createOrder({
      externalId,
      amount: grossAmount,
      payerEmail: email,
      description: `Lisensi ${app.name} (${grantDays} hari)`,
      returnUrl: redirectUrl || app.redirectUrl || undefined,
      finishRedirectUrl: `${checkoutConfig.publicAppUrl}/checkout/dana/finish?externalId=${externalId}`,
      forceMock: isSandboxApp,
    });
    invoiceUrl = danaOrder.checkoutUrl;
    invoiceId = danaOrder.orderId;
    expiryDate = danaOrder.expiryDate;
  } else {
    const xenditInvoice = await XenditService.createInvoice({
      externalId,
      amount: grossAmount,
      payerEmail: email,
      description: `Lisensi ${app.name} (${grantDays} hari)`,
      successRedirectUrl: redirectUrl || app.redirectUrl || undefined,
      failureRedirectUrl: redirectUrl || app.redirectUrl || undefined,
      paymentMethods,
      forceMock: isSandboxApp,
    });
    invoiceUrl = xenditInvoice.invoice_url;
    invoiceId = xenditInvoice.id;
    expiryDate = xenditInvoice.expiry_date;
  }

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
    },
    transactionId: newTx.id,
    checkoutUrl: invoiceUrl,
    paymentGateway: selectedGateway,
    amount: grossAmount,
    listPrice,
    discountAmount,
    discountPercent,
    couponCode: coupon?.code || null,
    platformFee,
    netDisbursementAmount: netAmount,
  };
}
