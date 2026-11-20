import { db } from "../../db";
import { apps, transactions, licenses, builders } from "../../db/schema";
import { eq, inArray, or, and, sql } from "drizzle-orm";
import { CouponService } from "../../services/monetization/coupon";
import { config as checkoutConfig, resolveRequestOrigin } from "../../config";
import { resolveCurrentBuilder } from "../apps/builder";
import { handleDisburse } from "../apps/disburse";
import { enforceRateLimitAsync } from "../../services/security/rateLimiter";
import { createPollTicket, verifyPollTicket } from "../../utils/pollTicket";
import { resolvePublicPaymentRailInfo, buildPublicDeliveryPayload } from "../../utils/payment";
import { parsePagination, paginationEnvelope } from "../../lib/pagination";

// Rate-limit sync gateway remote per transaction agar tidak membebani network / API eksternal
// dan membuat polling frontend setiap 2.5 detik tetap responsif dalam hitungan milidetik.
const gatewaySyncThrottleMap = new Map<string, number>();

export function clearGatewaySyncThrottle(txId?: string) {
  if (txId) gatewaySyncThrottleMap.delete(txId);
  else gatewaySyncThrottleMap.clear();
}

/** Menormalkan label kanal pembayaran agar tidak membocorkan merek vendor eksternal. */
function sanitizePublicPaymentChannel(raw?: string | null): string {
  const val = (raw || "").trim();
  if (!val) return "TERTAUT PAY";
  if (/^XENDIT_QRIS$/i.test(val)) return "QRIS";
  if (/^XENDIT$/i.test(val)) return "TERTAUT PAY";
  return val.replace(/^XENDIT_/i, "");
}

/** Sinkronisasi status transaksi PENDING ke gateway jika perlu. */
async function syncPendingTransactionWithGateway(
  tx: typeof transactions.$inferSelect,
  forceSync: boolean
): Promise<{ tx: typeof transactions.$inferSelect; paymentCode?: string }> {
  let currentTx = tx;
  let paymentCode: string | undefined;

  const nowMs = Date.now();
  const lastSync = gatewaySyncThrottleMap.get(tx.id) || 0;
  const isInternalSandbox =
    tx.paymentProvider === "sandbox" || tx.xenditInvoiceId?.startsWith("inv_sandbox_");
  const shouldSyncRemote =
    !isInternalSandbox && (forceSync || checkoutConfig.isTest || nowMs - lastSync > 15_000);

  if (currentTx.paymentStatus === "PENDING" && shouldSyncRemote) {
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
            sanitizePublicPaymentChannel(queryRes.paymentChannel || tx.paymentChannel)
          );
          const refreshed = await db.query.transactions.findFirst({
            where: eq(transactions.id, tx.id),
          });
          if (refreshed) {
            currentTx = refreshed;
          }
        }
      } else if (queryRes.isExpired || queryRes.isFailed) {
        const targetStatus = queryRes.isFailed ? "FAILED" : "EXPIRED";
        const { markPendingTransactionTerminal } = await import("../webhook/fulfill");
        const transitioned = await markPendingTransactionTerminal(tx.id, targetStatus);
        if (transitioned) {
          currentTx = { ...tx, paymentStatus: targetStatus };
        }
      }
    } catch {
      // Abaikan error jaringan saat polling status
    }
  }

  return { tx: currentTx, paymentCode };
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

  const isExplicitSync = query?.sync === "true" || query?.refresh === "true";
  const synced = await syncPendingTransactionWithGateway(tx, isExplicitSync);
  tx = synced.tx;
  if (synced.paymentCode) {
    paymentCode = synced.paymentCode;
  }

  let licenseKey: string | null = null;
  let delivery: ReturnType<typeof buildPublicDeliveryPayload> | undefined = undefined;

  // P0-AUTH: detail sensitif (QR/payment code, amount, externalId, checkoutUrl,
  // licenseKey, delivery) HANYA dibeberkan ke pemegang poll ticket yang sah atau owner/admin.
  const reqTicket = query?.ticket;
  const isTicketValid = Boolean(reqTicket) && verifyPollTicket(tx.id, reqTicket);
  let isAuthorizedViewer = isTicketValid;
  if (!isAuthorizedViewer && request?.headers) {
    const authBuilder = await resolveCurrentBuilder(request.headers);
    const isOwner = Boolean(authBuilder.builder && authBuilder.builder.id === tx.builderId);
    isAuthorizedViewer = isOwner || authBuilder.isAdmin;
  }

  if (tx.paymentStatus === "PAID" && isAuthorizedViewer) {
    const [lic, app] = await Promise.all([
      db.query.licenses.findFirst({
        where: eq(licenses.transactionId, tx.id),
      }),
      db.query.apps.findFirst({
        where: eq(apps.id, tx.appId),
      }),
    ]);
    licenseKey = lic?.licenseKey || null;
    const provisionedApiKey =
      lic?.apiKey || ((tx.metadata as Record<string, any> | null)?.apiKey as string | undefined);
    delivery = buildPublicDeliveryPayload(app, undefined, provisionedApiKey);
  }

  const base = {
    success: true,
    transactionId: tx.id,
    paymentStatus: tx.paymentStatus,
  };

  if (!isAuthorizedViewer) return base;

  const normalizedChannel = sanitizePublicPaymentChannel(tx.paymentChannel);
  const railInfo = resolvePublicPaymentRailInfo(normalizedChannel, tx.xenditInvoiceUrl);

  return {
    ...base,
    appId: tx.appId,
    externalId: tx.xenditExternalId,
    amount: tx.grossAmount,
    channel: normalizedChannel,
    paymentRail: railInfo.paymentRail,
    vaBank: railInfo.vaBank,
    retailOutlet: railInfo.retailOutlet,
    ewalletChannel: railInfo.ewalletChannel,
    actionUrl: railInfo.actionUrl,
    licenseKey,
    delivery,
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

  const enrichedTxs = txs.map((tx) => ({
    ...tx,
    ticket: createPollTicket(tx.id),
  }));

  return {
    success: true,
    transactions: enrichedTxs,
    ...paginationEnvelope(enrichedTxs, total, pagination),
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

  let tx = await db.query.transactions.findFirst({
    where: or(eq(transactions.id, txId), eq(transactions.xenditExternalId, txId)),
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

  if (tx.paymentStatus === "PENDING") {
    const synced = await syncPendingTransactionWithGateway(tx, false);
    tx = synced.tx;
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

  const normalizedChannel = sanitizePublicPaymentChannel(tx.paymentChannel);
  const isPaidTx = tx.paymentStatus === "PAID";
  const provisionedApiKey =
    license?.apiKey || ((tx.metadata as Record<string, any> | null)?.apiKey as string | undefined);

  return {
    success: true,
    invoice: {
      invoiceNumber,
      transactionId: tx.id,
      platform: {
        name: "tertaut.com (PT RETAS LINTAS BATAS)",
        legalEntity: "Penyedia infrastruktur pembayaran & lisensi resmi untuk perangkat lunak",
        website: "https://tertaut.com",
        supportEmail: "platformtertaut@gmail.com",
      },
      merchantOfRecord: {
        name: "tertaut.com (PT RETAS LINTAS BATAS)",
        legalEntity: "Penyedia infrastruktur pembayaran & lisensi resmi untuk perangkat lunak",
        website: "https://tertaut.com",
        supportEmail: "platformtertaut@gmail.com",
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
        channel: normalizedChannel,
        provider: tx.paymentProvider === "sandbox" ? "SANDBOX" : "TERTAUT PAY",
        status: tx.paymentStatus,
        disbursementStatus: tx.disbursementStatus,
        paidAt: tx.paidAt ? tx.paidAt.toISOString() : null,
        createdAt: tx.createdAt.toISOString(),
      },
      licenseKey: license?.licenseKey || null,
      delivery:
        isPaidTx && isTicketValid
          ? buildPublicDeliveryPayload(app, undefined, provisionedApiKey)
          : undefined,
      metadata: (tx.metadata as Record<string, unknown> | null) || null,
      verificationUrl: `${resolveRequestOrigin(request)}/invoice/${tx.id}?ticket=${ticket || ""}`,
    },
  };
}
