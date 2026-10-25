import { db } from "../../db";
import { apps, transactions, licenses, builders } from "../../db/schema";
import { eq, inArray, or, and, sql } from "drizzle-orm";
import { CouponService } from "../../services/monetization/coupon";
import { config as checkoutConfig, resolveRequestOrigin } from "../../config";
import { resolveCurrentBuilder } from "../apps/builder";
import { handleDisburse } from "../apps/disburse";
import { enforceRateLimitAsync } from "../../services/security/rateLimiter";
import { verifyPollTicket } from "../../utils/pollTicket";
import { parsePagination, paginationEnvelope } from "../../lib/pagination";

// Rate-limit sync gateway remote per transaction agar tidak membebani network / API eksternal
// dan membuat polling frontend setiap 2.5 detik tetap responsif dalam hitungan milidetik.
const gatewaySyncThrottleMap = new Map<string, number>();

export function clearGatewaySyncThrottle(txId?: string) {
  if (txId) gatewaySyncThrottleMap.delete(txId);
  else gatewaySyncThrottleMap.clear();
}

export interface CheckoutHandlerSet {
  status?: number | string;
  headers?: any;
  redirect?: string;
  [key: string]: any;
}

export interface PaymentStatusContext {
  params?: { txId?: string; [key: string]: any };
  query?: { ticket?: string; sync?: string; refresh?: string; [key: string]: any };
  request?: Request | any;
  set?: CheckoutHandlerSet;
  [key: string]: any;
}

/**
 * Polling status pembayaran untuk Gapura Custom Checkout
 */
export async function handleGetPaymentStatus({
  params = {},
  query,
  request,
  set = {},
}: PaymentStatusContext) {
  const txId = params.txId;
  if (!txId) {
    set.status = 400;
    return { error: "txId parameter wajib disertakan" };
  }

  // BUG-6: batasi polling status per IP (endpoint publik yang rawan di-scan).
  const rl = await enforceRateLimitAsync(request, "checkout:status", 120, 60_000);
  if (!rl.allowed) {
    set.status = 429;
    return { error: "Terlalu banyak permintaan. Coba lagi sebentar lagi." };
  }

  let tx = await db.query.transactions.findFirst({
    where: or(
      eq(transactions.id, txId),
      eq(transactions.xenditExternalId, txId),
      eq(transactions.providerReferenceId, txId)
    ),
  });

  if (!tx) {
    set.status = 404;
    return { error: "Transaksi tidak ditemukan" };
  }

  let qrDataUrl: string | undefined = tx.qrDataUrl || undefined;
  let paymentCode: string | undefined = tx.paymentCode || undefined;

  // Sinkronisasi status aktif ke gateway jika masih PENDING (lewati jika transaksi mock)
  // Polling default membaca langsung dari DB lokal (<2ms). Query ke remote gateway
  // di-throttle maksimal 1x per 15 detik atau bila diminta eksplisit (?sync=true) agar tidak lemot.
  const nowMs = Date.now();
  const lastSync = gatewaySyncThrottleMap.get(tx.id) || 0;
  const isExplicitSync = query?.sync === "true" || query?.refresh === "true";
  const isInternalSandbox =
    tx.paymentProvider === "sandbox" || tx.xenditInvoiceId?.startsWith("inv_sandbox_");
  const shouldSyncRemote =
    !isInternalSandbox && (isExplicitSync || checkoutConfig.isTest || nowMs - lastSync > 15_000);

  if (tx.paymentStatus === "PENDING" && shouldSyncRemote) {
    gatewaySyncThrottleMap.set(tx.id, nowMs);
    try {
      const { getPaymentGateway } = await import("../../services/payments/gateways");
      const gateway = getPaymentGateway(tx.paymentProvider);
      const queryRes = await gateway.queryOrderStatus({
        externalId: tx.xenditExternalId,
        referenceNo: tx.providerReferenceId || tx.xenditInvoiceId || undefined,
      });

      if (queryRes.paymentCode) {
        paymentCode = queryRes.paymentCode;
      }

      if (queryRes.isPaid) {
        const paidAmount = queryRes.paidAmount;
        if (typeof paidAmount === "number" && paidAmount > 0 && paidAmount !== tx.grossAmount) {
          console.warn(
            `[Checkout Polling] Amount mismatch: paid=${paidAmount} vs expected=${tx.grossAmount} (TX ${tx.id}) — tidak mem-fulfill.`
          );
        } else {
          const { fulfillPaymentTransaction } = await import("../webhook/fulfill");
          await fulfillPaymentTransaction(
            tx,
            queryRes.paymentChannel ||
              tx.paymentChannel ||
              (tx.paymentProvider || "XENDIT").replace(/[^a-z0-9]/gi, "").toUpperCase()
          );
          const refreshed = await db.query.transactions.findFirst({
            where: eq(transactions.id, tx.id),
          });
          if (refreshed) {
            tx = refreshed;
          }
        }
      } else if (queryRes.isExpired) {
        await db
          .update(transactions)
          .set({ paymentStatus: "EXPIRED", updatedAt: new Date() })
          .where(eq(transactions.id, tx.id));
        tx = { ...tx, paymentStatus: "EXPIRED" };
      }
    } catch {
      // Abaikan error jaringan saat polling status
    }
  }

  let licenseKey: string | null = null;
  if (tx.paymentStatus === "PAID") {
    // BUG-5: licenseKey hanya dibeberkan ke pemanggil yang memiliki poll ticket valid
    // (dikembalikan oleh create-session / disematkan di redirect finish). Mengetahui
    // txId saja tidak lagi cukup untuk mencuri lisensi.
    const ticket = query?.ticket;
    if (verifyPollTicket(tx.id, ticket)) {
      const lic = await db.query.licenses.findFirst({
        where: eq(licenses.transactionId, tx.id),
      });
      licenseKey = lic?.licenseKey || null;
    }
  }

  // P0-AUTH: detail sensitif (QR/payment code, amount, externalId, checkoutUrl,
  // licenseKey) HANYA dibeberkan ke pemegang poll ticket yang sah (hasil
  // create-session / redirect finish). Pemegang txId saja hanya menerima status —
  // cukup untuk polling UX, tanpa membocorkan data pembayaran pengguna lain.
  const reqTicket = query?.ticket;
  const isTicketValid = Boolean(reqTicket) && verifyPollTicket(tx.id, reqTicket);

  const base = {
    success: true,
    transactionId: tx.id,
    paymentStatus: tx.paymentStatus,
  };

  if (!isTicketValid) return base;

  return {
    ...base,
    externalId: tx.xenditExternalId,
    amount: tx.grossAmount,
    channel: tx.paymentChannel,
    licenseKey,
    paidAt: tx.paidAt,
    qrDataUrl,
    paymentCode,
    checkoutUrl: tx.xenditInvoiceUrl,
  };
}

export interface ConsultPayContext {
  query?: { amount?: string | number; [key: string]: any };
  request?: Request | any;
  set?: CheckoutHandlerSet;
  [key: string]: any;
}

/**
 * Konsultasi kanal pembayaran Xendit
 */
export async function handleConsultPay({ query, request, set = {} }: ConsultPayContext) {
  return handleGetPaymentChannels({ request, set });
}

export interface PaymentChannelsContext {
  request?: Request | any;
  set?: CheckoutHandlerSet;
  [key: string]: any;
}

/**
 * Mengambil daftar channel pembayaran yang aktif secara dinamis dari gateway yang aktif
 */
export async function handleGetPaymentChannels({ request, set = {} }: PaymentChannelsContext) {
  const rl = await enforceRateLimitAsync(request, "checkout:channels", 60, 60_000);
  if (!rl.allowed) {
    set.status = 429;
    return { error: "Terlalu banyak permintaan. Coba lagi sebentar lagi." };
  }

  try {
    const { getActivePaymentGateway } = await import("../../services/payments/paymentGateway");
    const { getPaymentGateway } = await import("../../services/payments/gateways");
    const activeGatewayId = await getActivePaymentGateway();
    const gateway = getPaymentGateway(activeGatewayId);

    if (gateway.getPaymentChannels) {
      const channelsData = await gateway.getPaymentChannels();
      return {
        success: true,
        gateway: activeGatewayId,
        data: channelsData,
      };
    }

    return {
      success: true,
      gateway: activeGatewayId,
      data: {
        activeRails: ["qris", "va"],
        activeBanks: ["BCA", "MANDIRI", "BNI", "BRI", "PERMATA"],
        activeEwallets: [],
        activeRetails: ["ALFAMART", "INDOMARET"],
        qrisEnabled: true,
      },
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Gagal mengambil channel pembayaran",
    };
  }
}

export interface PreviewCouponContext {
  body?: { appId?: string; couponCode?: string; amount?: number; [key: string]: any };
  set?: CheckoutHandlerSet;
  [key: string]: any;
}

/**
 * Preview kupon tanpa membuat transaksi (dipakai halaman /pay/:slug)
 */
export async function handlePreviewCoupon({ body = {}, set = {} }: PreviewCouponContext) {
  const { appId, couponCode, amount } = body;
  if (!appId || !couponCode) {
    set.status = 400;
    return { valid: false, message: "appId dan couponCode wajib disertakan" };
  }

  const app = await db.query.apps.findFirst({ where: eq(apps.id, appId) });
  if (!app) {
    set.status = 404;
    return { valid: false, message: "Produk tidak ditemukan" };
  }

  const listPrice = amount ?? app.targetPrice ?? 0;
  const result = await CouponService.validate(couponCode, app.id, listPrice);
  if (!result.valid) {
    set.status = 400;
    return { valid: false, message: result.message, errorCode: result.errorCode };
  }

  return {
    valid: true,
    coupon: { code: result.coupon!.code, discountPercent: result.discountPercent },
    discountPercent: result.discountPercent,
    discountAmount: result.discountAmount,
    payableAmount: Math.max(0, listPrice - (result.discountAmount || 0)),
    finalAmount: Math.max(0, listPrice - (result.discountAmount || 0)),
  };
}

export interface ListTransactionsContext {
  query?: {
    appId?: string;
    customerEmail?: string;
    limit?: string | number;
    offset?: string | number;
    page?: string | number;
    mode?: string;
    [key: string]: any;
  };
  request?: Request | any;
  [key: string]: any;
}

/**
 * Daftar riwayat transaksi MoR (scoped ke builder kecuali admin, dengan pagination & total count)
 */
export async function handleListTransactions({ query, request }: ListTransactionsContext) {
  const { appId, customerEmail, limit = 200, offset = 0, page, mode } = query || {};
  const headers = request?.headers;
  const { builder, isAdmin } = headers
    ? await resolveCurrentBuilder(headers)
    : { builder: null, isAdmin: true };

  const conditions: any[] = [];

  // Scoping data ke builder login (kecuali admin)
  if (!isAdmin && builder) {
    conditions.push(eq(transactions.builderId, builder.id));
  } else if (!isAdmin && !builder) {
    return { success: true, transactions: [], total: 0, hasMore: false };
  }

  if (appId) {
    conditions.push(eq(transactions.appId, appId));
  } else if (mode) {
    const appRows = await db
      .select({ id: apps.id })
      .from(apps)
      .where(eq(apps.mode, mode as "live" | "sandbox"));
    if (appRows.length === 0) {
      return { success: true, transactions: [], total: 0, hasMore: false };
    }
    conditions.push(
      inArray(
        transactions.appId,
        appRows.map((a) => a.id)
      )
    );
  }

  if (customerEmail)
    conditions.push(sql`lower(${transactions.customerEmail}) = ${customerEmail.toLowerCase()}`);
  const pagination = parsePagination({ limit, offset, page });

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [totalRes] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(transactions)
    .where(whereClause);

  const total = totalRes?.count || 0;

  const txs = await db.query.transactions.findMany({
    where: whereClause,
    orderBy: (tx, { desc }) => [desc(tx.createdAt)],
    limit: pagination.limit,
    offset: pagination.offset,
  });

  return {
    success: true,
    transactions: txs,
    ...paginationEnvelope(txs, total, pagination),
  };
}

export interface DisburseTxContext {
  params?: { txId?: string; [key: string]: any };
  request?: Request | any;
  set?: CheckoutHandlerSet;
  [key: string]: any;
}

/**
 * Eksekusi pencairan saldo dari transaksi tunggal (DRY: delegasikan ke handleDisburse)
 */
export async function handleDisburseTx(ctx: DisburseTxContext) {
  return handleDisburse({
    params: { transactionId: ctx.params?.txId },
    set: ctx.set,
    request: ctx.request,
  });
}

export interface InvoiceDataContext {
  params?: { txId?: string; [key: string]: any };
  query?: { ticket?: string; [key: string]: any };
  request?: Request | any;
  set?: CheckoutHandlerSet;
  [key: string]: any;
}

/**
 * Ambil data invoice resmi / E-Receipt untuk cetak dan unduh PDF
 */
export async function handleGetInvoiceData({
  params = {},
  query,
  request,
  set = {},
}: InvoiceDataContext) {
  const txId = params?.txId;
  if (!txId) {
    set.status = 400;
    return { success: false, error: "txId parameter wajib disertakan" };
  }

  const ticket = query?.ticket;

  const tx = await db.query.transactions.findFirst({
    where: eq(transactions.id, txId),
  });

  if (!tx) {
    set.status = 404;
    return { success: false, error: "Faktur transaksi tidak ditemukan." };
  }

  // Verifikasi otorisasi: jika ada ticket, verifikasi HMAC pollTicket
  // Jika tidak ada ticket, periksa apakah pemanggil adalah user terautentikasi (admin/builder)
  const isTicketValid = ticket ? verifyPollTicket(tx.id, ticket) : false;
  if (!isTicketValid) {
    const authBuilder = await resolveCurrentBuilder(request.headers);
    const isOwner = authBuilder.builder && authBuilder.builder.id === tx.builderId;
    const isAdmin = authBuilder.isAdmin;
    if (!isOwner && !isAdmin) {
      set.status = 403;
      return {
        success: false,
        error:
          "Akses invoice ditolak. Sertakan ticket polling yang valid atau login sebagai admin.",
      };
    }
  }

  const [app, builder, license] = await Promise.all([
    db.query.apps.findFirst({ where: eq(apps.id, tx.appId) }),
    db.query.builders.findFirst({ where: eq(builders.id, tx.builderId) }),
    db.query.licenses.findFirst({ where: eq(licenses.transactionId, tx.id) }),
  ]);

  const gross = tx.grossAmount;
  const dpp = Math.round(gross / 1.11);
  const ppn = gross - dpp;
  const invoiceNumber = `INV-${tx.createdAt.toISOString().slice(0, 10).replace(/-/g, "")}-${tx.id.slice(-6).toUpperCase()}`;

  return {
    success: true,
    invoice: {
      invoiceNumber,
      transactionId: tx.id,
      platform: {
        name: "tertaut.com (PT RETAS LINTAS BATAS)",
        legalEntity: "Penyedia infrastruktur pembayaran & lisensi resmi untuk perangkat lunak",
        website: "https://tertaut.com",
        supportEmail: "support@tertaut.com",
      },
      merchantOfRecord: {
        name: "tertaut.com (PT RETAS LINTAS BATAS)",
        legalEntity: "Penyedia infrastruktur pembayaran & lisensi resmi untuk perangkat lunak",
        website: "https://tertaut.com",
        supportEmail: "support@tertaut.com",
      },
      seller: {
        name: builder?.name || "Independent Software Builder",
        email: builder?.email || "",
      },
      buyer: {
        email: tx.customerEmail,
        name: tx.customerName || undefined,
      },
      item: {
        name: app?.name || tx.appId,
        description:
          app?.description || `Lisensi Penggunaan Perangkat Lunak (${tx.grantDays || 30} Hari)`,
        pricingType: app?.pricingType || "one_time",
        grantDays: tx.grantDays || 30,
      },
      financials: {
        grossAmount: gross,
        dpp,
        ppn11: ppn,
        discountAmount: tx.discountAmount || 0,
        couponCode: tx.couponCode || null,
        currency: "IDR",
      },
      payment: {
        channel:
          tx.paymentChannel || (tx.paymentProvider ? tx.paymentProvider.toUpperCase() : "XENDIT"),
        provider: tx.paymentProvider ? tx.paymentProvider.toUpperCase() : "XENDIT",
        status: tx.paymentStatus,
        disbursementStatus: tx.disbursementStatus,
        paidAt: tx.paidAt ? tx.paidAt.toISOString() : null,
        createdAt: tx.createdAt.toISOString(),
      },
      licenseKey: license?.licenseKey || null,
      metadata: (tx.metadata as Record<string, unknown> | null) || null,
      verificationUrl: `${resolveRequestOrigin(request)}/invoice/${tx.id}?ticket=${ticket || ""}`,
    },
  };
}
