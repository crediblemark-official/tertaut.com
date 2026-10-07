import { db } from "../../db";
import { apps, transactions, licenses, builders } from "../../db/schema";
import { eq, inArray, or, and, sql } from "drizzle-orm";
import { LicenseService } from "../../services/licensing/license";
import { CreditService } from "../../services/monetization/credits";
import { CouponService } from "../../services/monetization/coupon";
import { config as checkoutConfig, resolveRequestOrigin } from "../../config";
import QRCode from "qrcode";
import { randomBytes } from "crypto";
import { resolveCurrentBuilder } from "../apps/builder";
import { handleDisburse } from "../apps/disburse";
import { enforceRateLimit } from "../../services/security/rateLimiter";
import { createPollTicket, verifyPollTicket } from "../../utils/pollTicket";
import { parsePagination, paginationEnvelope } from "../../lib/pagination";

// Rate-limit sync gateway remote per transaction agar tidak membebani network / API eksternal
// dan membuat polling frontend setiap 2.5 detik tetap responsif dalam hitungan milidetik.
const gatewaySyncThrottleMap = new Map<string, number>();

export function clearGatewaySyncThrottle(txId?: string) {
  if (txId) gatewaySyncThrottleMap.delete(txId);
  else gatewaySyncThrottleMap.clear();
}

/**
 * Endpoint Redirect pembeli setelah menyelesaikan pembayaran DANA (Finish Redirect URL)
 */
export async function handleDanaFinish({ query, request, set }: any) {
  const { orderId, externalId, mock } = query as {
    orderId?: string;
    externalId?: string;
    mock?: string;
  };

  if (!externalId) {
    set.status = 400;
    return { error: "externalId parameter wajib disertakan" };
  }

  let tx = await db.query.transactions.findFirst({
    where: or(
      eq(transactions.xenditExternalId, externalId),
      eq(transactions.providerReferenceId, externalId),
      eq(transactions.id, externalId)
    ),
  });

  if (!tx) {
    set.status = 404;
    return { error: "Transaksi tidak ditemukan" };
  }

  const app = await db.query.apps.findFirst({
    where: eq(apps.id, tx.appId),
  });

  // Ambil lisensi yang diterbitkan
  const lic = await db.query.licenses.findFirst({
    where: eq(licenses.transactionId, tx.id),
  });

  const ticket = createPollTicket(tx.id);
  const requestOrigin = resolveRequestOrigin(request);
  const targetSlug = app?.slug || tx.appId;
  const targetRedirect = app?.redirectUrl
    ? app.redirectUrl.includes("?")
      ? `${app.redirectUrl}&status=success&externalId=${externalId}&ticket=${ticket}`
      : `${app.redirectUrl}?status=success&externalId=${externalId}&ticket=${ticket}`
    : `${requestOrigin}/pay/${targetSlug}?paid=1&externalId=${externalId}&ticket=${ticket}`;

  if (set?.headers) {
    set.headers["referrer-policy"] = "no-referrer";
  }

  // Jika diakses langsung via browser (Accept: text/html), arahkan pembeli ke UI
  const acceptHeader = request?.headers?.get?.("accept") || "";
  const isBrowserRequest = acceptHeader.includes("text/html");

  if (isBrowserRequest) {
    set.redirect = targetRedirect;
    return;
  }

  // BUG-5 & P0.3: licenseKey hanya diungkapkan bila pemanggil memiliki poll ticket yang sah
  const reqTicket = (query as any)?.ticket;
  const isTicketValid = reqTicket && verifyPollTicket(tx.id, reqTicket);

  return {
    success: true,
    message: "Pembayaran DANA berhasil diverifikasi",
    transactionId: tx.id,
    paymentStatus: tx.paymentStatus,
    ticket,
    licenseKey: isTicketValid ? lic?.licenseKey || null : null,
    redirectUrl: targetRedirect,
  };
}

/**
 * Polling status pembayaran untuk Gapura Custom Checkout
 */
export async function handleGetPaymentStatus({ params, query, request, set }: any) {
  const { txId } = params as { txId: string };
  if (!txId) {
    set.status = 400;
    return { error: "txId parameter wajib disertakan" };
  }

  // BUG-6: batasi polling status per IP (endpoint publik yang rawan di-scan).
  const rl = enforceRateLimit(request, "checkout:status", 120, 60_000);
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

  let qrDataUrl: string | undefined;
  let paymentCode: string | undefined;
  const channel = (tx.paymentChannel || "").toUpperCase();

  // Sinkronisasi status aktif ke gateway jika masih PENDING (lewati jika transaksi mock)
  // Polling default membaca langsung dari DB lokal (<2ms). Query ke remote gateway
  // di-throttle maksimal 1x per 15 detik atau bila diminta eksplisit (?sync=true) agar tidak lemot.
  const nowMs = Date.now();
  const lastSync = gatewaySyncThrottleMap.get(tx.id) || 0;
  const isExplicitSync = (query as any)?.sync === "true" || (query as any)?.refresh === "true";
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
              (tx.paymentProvider || "DANA").replace(/[^a-z0-9]/gi, "").toUpperCase()
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
        tx = { ...tx, paymentStatus: "EXPIRED" as any };
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
    const ticket = (query as any)?.ticket;
    if (verifyPollTicket(tx.id, ticket)) {
      const lic = await db.query.licenses.findFirst({
        where: eq(licenses.transactionId, tx.id),
      });
      licenseKey = lic?.licenseKey || null;
    }
  }

  if (tx.paymentStatus === "PENDING") {
    if (channel.includes("QRIS")) {
      paymentCode =
        paymentCode ||
        `00020101021226540014ID.DANA.WWW011893600911000000000002152026092100000000303UMI51440014ID.DANA.WWW0215202609210000000520457325303360540${Number(tx.grossAmount).toFixed(2)}5802ID5911Tertaut MoR6007Jakarta61051234062330114${tx.xenditExternalId}6304ABCD`;
      try {
        qrDataUrl = await QRCode.toDataURL(paymentCode, { width: 320, margin: 2 });
      } catch {}
    } else if (channel.includes("VA")) {
      if (!paymentCode) {
        const bankPrefixMap: Record<string, string> = {
          BCA: "3901",
          MANDIRI: "88908",
          BNI: "8808",
          BRI: "8809",
          CIMB: "2599",
          PERMATA: "8528",
        };
        const bankName = channel.replace("VA_", "").toUpperCase() || "BCA";
        const prefix = bankPrefixMap[bankName] || "3901";
        paymentCode = `${prefix}08${Math.floor(1000000000 + Math.random() * 9000000000)}`;
      }
    }
  }

  // P0-AUTH: detail sensitif (QR/payment code, amount, externalId, checkoutUrl,
  // licenseKey) HANYA dibeberkan ke pemegang poll ticket yang sah (hasil
  // create-session / redirect finish). Pemegang txId saja hanya menerima status —
  // cukup untuk polling UX, tanpa membocorkan data pembayaran pengguna lain.
  const reqTicket = (query as any)?.ticket;
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

/**
 * Konsultasi opsi pembayaran DANA aktif
 */
export async function handleConsultPay({ query, request, set }: any) {
  // BUG-6: endpoint publik tanpa rate limit sebelumnya bisa menembak gateway DANA
  // (setiap panggilan memicu HTTP ke DANA consultPay).
  const rl = enforceRateLimit(request, "checkout:consult-pay", 60, 60_000);
  if (!rl.allowed) {
    set.status = 429;
    return { error: "Terlalu banyak permintaan. Coba lagi sebentar lagi." };
  }

  const { DanaService } = await import("../../services/payments/dana/dana");
  const amount = Number(query?.amount) || 10000;
  const result = await DanaService.consultPay(amount);
  return {
    success: true,
    data: result,
  };
}

/**
 * Mengambil daftar channel pembayaran yang aktif secara dinamis dari gateway yang aktif
 */
export async function handleGetPaymentChannels({ request, set }: any) {
  const rl = enforceRateLimit(request, "checkout:channels", 60, 60_000);
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

/**
 * Simulasi pelunasan instan untuk transaksi Sandbox Tertaut (Testing & UAT)
 */
export async function handleSimulateSandboxPayment({ body, request, set }: any) {
  const rl = enforceRateLimit(request, "checkout:simulate", 30, 60_000);
  if (!rl.allowed) {
    set.status = 429;
    return { error: "Terlalu banyak permintaan simulasi. Coba lagi sebentar lagi." };
  }

  const { transactionId, ticket } = body || {};
  if (!transactionId) {
    set.status = 400;
    return { error: "transactionId wajib disertakan" };
  }

  let tx = await db.query.transactions.findFirst({
    where: or(eq(transactions.id, transactionId), eq(transactions.xenditExternalId, transactionId)),
  });

  if (!tx) {
    set.status = 404;
    return { error: "Transaksi tidak ditemukan" };
  }

  if (!ticket || !verifyPollTicket(tx.id, ticket)) {
    set.status = 403;
    return { error: "Ticket autentikasi checkout tidak valid" };
  }

  const app = await db.query.apps.findFirst({
    where: eq(apps.id, tx.appId),
  });

  const isSandbox =
    app?.mode === "sandbox" ||
    tx.paymentProvider === "sandbox" ||
    tx.xenditInvoiceId?.startsWith("inv_sandbox_");

  if (!isSandbox) {
    set.status = 400;
    return { error: "Simulasi pembayaran hanya diizinkan untuk produk dalam mode Sandbox" };
  }

  if (tx.paymentStatus === "PAID") {
    const lic = await db.query.licenses.findFirst({
      where: eq(licenses.transactionId, tx.id),
    });
    return {
      success: true,
      paymentStatus: "PAID",
      licenseKey: lic?.licenseKey || null,
      message: "Transaksi sudah lunas sebelumnya",
    };
  }

  const { fulfillPaymentTransaction } = await import("../webhook/fulfill");
  await fulfillPaymentTransaction(tx, tx.paymentChannel || "VA_BCA");

  const lic = await db.query.licenses.findFirst({
    where: eq(licenses.transactionId, tx.id),
  });

  return {
    success: true,
    paymentStatus: "PAID",
    licenseKey: lic?.licenseKey || null,
    message: "Pembayaran sandbox berhasil diselesaikan (Simulasi Lunas)",
  };
}

/**
 * Preview kupon tanpa membuat transaksi (dipakai halaman /pay/:slug)
 */
export async function handlePreviewCoupon({ body, set }: any) {
  const { appId, couponCode, amount } = body;

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

/**
 * Daftar riwayat transaksi MoR (scoped ke builder kecuali admin, dengan pagination & total count)
 */
export async function handleListTransactions({ query, request }: any) {
  const { appId, limit = 200, offset = 0, page, mode } = query || {};
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
    const appRows = await db.select({ id: apps.id }).from(apps).where(eq(apps.mode, mode));
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

/**
 * Eksekusi pencairan saldo dari transaksi tunggal (DRY: delegasikan ke handleDisburse)
 */
export async function handleDisburseTx(ctx: any) {
  return handleDisburse({
    params: { transactionId: ctx.params?.txId },
    set: ctx.set,
    request: ctx.request,
  });
}

/**
 * Ambil data invoice resmi / E-Receipt untuk cetak dan unduh PDF
 */
export async function handleGetInvoiceData({ params, query, request, set }: any) {
  const txId = params.txId;
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
      merchantOfRecord: {
        name: "tertaut.com (PT Tertaut Digital)",
        legalEntity: "Merchant of Record resmi untuk lisensi perangkat lunak",
        website: "https://tertaut.com",
        supportEmail: "support@tertaut.com",
      },
      seller: {
        name: builder?.name || "Independent Software Builder",
        email: builder?.email || "",
      },
      buyer: {
        email: tx.customerEmail,
      },
      item: {
        name: app?.name || tx.appId,
        description:
          app?.description || `Lisensi Penggunaan Perangkat Lunak (${tx.grantDays || 30} Hari)`,
        pricingType: app?.pricingType || "one_time",
        grantDays: tx.grantDays || 30,
        grantCredits: tx.grantCredits || 0,
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
        channel: tx.paymentChannel || "DANA",
        status: tx.paymentStatus,
        disbursementStatus: tx.disbursementStatus,
        paidAt: tx.paidAt ? tx.paidAt.toISOString() : null,
        createdAt: tx.createdAt.toISOString(),
      },
      licenseKey: license?.licenseKey || null,
      verificationUrl: `${resolveRequestOrigin(request)}/invoice/${tx.id}?ticket=${ticket || ""}`,
    },
  };
}
