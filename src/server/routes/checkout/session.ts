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
    grantDays = 365,
    // Kredit ditambahkan ke ledger lisensi saat webhook pembayaran terkonfirmasi.
    grantCredits = 0,
    redirectUrl,
    couponCode,
    paymentRail,
  } = body;

  // Pilihan kanal pembayaran di UI checkout diteruskan ke gateway (bukan dekoratif).
  const RAIL_PAYMENT_METHODS: Record<string, string[]> = {
    qris: ["QRIS"],
    va: ["BCA", "BNI", "BRI", "MANDIRI", "PERMATA", "CIMB"],
    ewallet: ["OVO", "DANA", "SHOPEEPAY", "LINKAJA"],
  };
  const paymentMethods = paymentRail
    ? RAIL_PAYMENT_METHODS[String(paymentRail).toLowerCase()]
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

  const email = (buyerEmail || customerEmail || "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    set.status = 400;
    return { error: "Email pembeli tidak valid" };
  }

  // Harga adalah otoritas server, bukan klien. Pembeli hanya boleh membayar
  // sesuai harga resmi aplikasi atau lebih (mis. donasi/upgrade) — tidak pernah kurang.
  const appPrice = app.targetPrice ?? 0;
  const requestedAmount = customAmount ?? amount ?? null;

  if (appPrice > 0 && requestedAmount !== null && requestedAmount < appPrice) {
    set.status = 400;
    return {
      error: `Nominal pembayaran tidak valid. Harga resmi "${app.name}" adalah ${formatIdr(appPrice)}.`,
    };
  }

  const txAmount =
    appPrice > 0
      ? Math.max(requestedAmount ?? appPrice, appPrice)
      : (requestedAmount ?? DEFAULT_PRICE);

  // Harga list yang jadi basis diskon (sebelum kupon).
  const listPrice = txAmount;

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
