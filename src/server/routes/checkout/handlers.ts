import { db } from "../../db";
import { apps, transactions, licenses } from "../../db/schema";
import { eq, inArray, or, and, sql } from "drizzle-orm";
import { LicenseService } from "../../services/license";
import { CreditService } from "../../services/credits";
import { CouponService } from "../../services/coupon";
import { config as checkoutConfig, resolveRequestOrigin } from "../../config";
import QRCode from "qrcode";
import { randomBytes } from "crypto";
import { resolveCurrentBuilder } from "../apps/builder";
import { handleDisburse } from "../apps/disburse";

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

  // Jika simulasi mock (?mock=true) dan transaksi masih PENDING, tandai lunas otomatis & terbitkan lisensi
  if (mock === "true" && tx.paymentStatus === "PENDING") {
    const { fulfillPaymentTransaction } = await import("../webhook/fulfill");
    await fulfillPaymentTransaction(tx, tx.paymentChannel || "DANA");
    const updated = await db.query.transactions.findFirst({
      where: eq(transactions.id, tx.id),
    });
    if (updated) tx = updated;
  }

  // Ambil lisensi yang diterbitkan
  const lic = await db.query.licenses.findFirst({
    where: eq(licenses.transactionId, tx.id),
  });

  const requestOrigin = resolveRequestOrigin(request);
  const targetSlug = app?.slug || tx.appId;
  const targetRedirect = app?.redirectUrl
    ? (app.redirectUrl.includes("?")
        ? `${app.redirectUrl}&status=success&externalId=${externalId}&licenseKey=${lic?.licenseKey || ""}`
        : `${app.redirectUrl}?status=success&externalId=${externalId}&licenseKey=${lic?.licenseKey || ""}`)
    : `${requestOrigin}/pay/${targetSlug}?paid=1&externalId=${externalId}`;

  // Jika diakses langsung via browser (Accept: text/html), arahkan pembeli ke UI
  const acceptHeader = request?.headers?.get?.("accept") || "";
  const isBrowserRequest = acceptHeader.includes("text/html");

  if (isBrowserRequest) {
    set.redirect = targetRedirect;
    return;
  }

  return {
    success: true,
    message: "Pembayaran DANA berhasil diverifikasi",
    transactionId: tx.id,
    paymentStatus: tx.paymentStatus === "PENDING" && mock === "true" ? "PAID" : tx.paymentStatus,
    licenseKey: lic?.licenseKey || null,
    redirectUrl: targetRedirect,
  };
}

/**
 * Polling status pembayaran untuk Gapura Custom Checkout
 */
export async function handleGetPaymentStatus({ params, set }: any) {
  const { txId } = params as { txId: string };
  if (!txId) {
    set.status = 400;
    return { error: "txId parameter wajib disertakan" };
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

  // Sinkronisasi status aktif ke gateway DANA jika masih PENDING
  if (tx.paymentStatus === "PENDING" && tx.paymentProvider === "dana") {
    try {
      const { DanaService } = await import("../../services/dana");
      const queryRes = await DanaService.queryOrderStatus({
        externalId: tx.xenditExternalId,
        referenceNo: tx.providerReferenceId || undefined,
      });

      if (queryRes) {
        if (queryRes.paymentCode) {
          paymentCode = queryRes.paymentCode;
        }

        // 00 = Success / Paid di DANA SNAP BI
        if (queryRes.latestTransactionStatus === "00") {
          const { fulfillPaymentTransaction } = await import("../webhook/fulfill");
          await fulfillPaymentTransaction(tx, tx.paymentChannel || "VA");
          const refreshed = await db.query.transactions.findFirst({
            where: eq(transactions.id, tx.id),
          });
          if (refreshed) {
            tx = refreshed;
          }
        } else if (queryRes.latestTransactionStatus === "05") {
          await db
            .update(transactions)
            .set({ paymentStatus: "EXPIRED", updatedAt: new Date() })
            .where(eq(transactions.id, tx.id));
          tx = { ...tx, paymentStatus: "EXPIRED" as any };
        }
      }
    } catch (e: any) {
      // Abaikan jika network error atau test mock
    }
  }

  let licenseKey: string | null = null;
  if (tx.paymentStatus === "PAID") {
    const lic = await db.query.licenses.findFirst({
      where: eq(licenses.transactionId, tx.id),
    });
    licenseKey = lic?.licenseKey || null;
  }

  if (tx.paymentStatus === "PENDING") {
    if (channel.includes("QRIS")) {
      paymentCode = paymentCode || `00020101021226540014ID.DANA.WWW011893600911000000000002152026092100000000303UMI51440014ID.DANA.WWW0215202609210000000520457325303360540${Number(tx.grossAmount).toFixed(2)}5802ID5911Tertaut MoR6007Jakarta61051234062330114${tx.xenditExternalId}6304ABCD`;
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

  return {
    success: true,
    transactionId: tx.id,
    externalId: tx.xenditExternalId,
    paymentStatus: tx.paymentStatus,
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
export async function handleConsultPay({ query }: any) {
  const { DanaService } = await import("../../services/dana");
  const amount = Number(query?.amount) || 10000;
  const result = await DanaService.consultPay(amount);
  return {
    success: true,
    data: result,
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
    const appRows = await db
      .select({ id: apps.id })
      .from(apps)
      .where(eq(apps.mode, mode));
    if (appRows.length === 0) {
      return { success: true, transactions: [], total: 0, hasMore: false };
    }
    conditions.push(inArray(transactions.appId, appRows.map((a) => a.id)));
  }

  const parsedLimit = Math.max(1, Math.min(Number(limit) || 200, 500));
  const parsedOffset = page ? (Math.max(1, Number(page)) - 1) * parsedLimit : Math.max(0, Number(offset) || 0);

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [totalRes] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(transactions)
    .where(whereClause);

  const total = totalRes?.count || 0;

  const txs = await db.query.transactions.findMany({
    where: whereClause,
    orderBy: (tx, { desc }) => [desc(tx.createdAt)],
    limit: parsedLimit,
    offset: parsedOffset,
  });

  return {
    success: true,
    transactions: txs,
    total,
    limit: parsedLimit,
    offset: parsedOffset,
    hasMore: parsedOffset + txs.length < total,
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
 * One-Click Local Payment Simulator for Developers (Hanya Sandbox)
 */
export async function handleSimulatePaid({ params: { txId }, set }: any) {
  const tx = await db.query.transactions.findFirst({
    where: eq(transactions.id, txId),
  });

  if (!tx) {
    set.status = 404;
    return { error: "Transaksi tidak ditemukan" };
  }

  // Simulasi pembayaran hanya boleh untuk aplikasi yang sedang dalam mode sandbox.
  const txApp = await db.query.apps.findFirst({ where: eq(apps.id, tx.appId) });
  if (txApp?.mode !== "sandbox") {
    set.status = 403;
    return { error: "Simulate paid hanya tersedia untuk aplikasi dalam mode sandbox." };
  }

  if (tx.paymentStatus === "PAID") {
    const existingLic = await db.query.licenses.findFirst({
      where: eq(licenses.transactionId, tx.id),
    });
    return {
      success: true,
      message: "Transaksi sudah berstatus PAID sebelumnya.",
      licenseKey: existingLic?.licenseKey,
    };
  }

  // Fix: simulator kini mengikuti jalur fulfillment webhook yang sesungguhnya
  // (config produk, offline token, apiAccess, grantCredits) supaya pengujian
  // sandbox merepresentasikan perilaku production — sebelumnya lisensi yang
  // diterbitkan tidak punya offline token dan tidak pernah meng-grant kredit.
  const app = txApp;
  const now = new Date();
  const productGrantDays = app?.deliveryConfig?.licenseKey?.expiresInDays;
  const grantDays =
    typeof productGrantDays === "number" && productGrantDays > 0
      ? productGrantDays
      : (tx.grantDays || 365);
  const expiresAt = new Date(now.getTime() + grantDays * 24 * 60 * 60 * 1000);
  const maxSeats = app?.deliveryConfig?.licenseKey?.maxSeats ?? 3;
  const features = app?.deliveryConfig?.licenseKey?.defaultFeatures || {};

  const licenseKey = LicenseService.generateLicenseKey();
  const offlineToken = LicenseService.createOfflineGraceToken(
    licenseKey,
    tx.appId,
    null,
    tx.customerEmail,
    maxSeats,
    features
  );
  const generatedApiKey = app?.deliveryConfig?.apiAccess?.enabled
    ? `tt_cust_${randomBytes(16).toString("hex")}`
    : undefined;

  const licId = `lic_${randomBytes(8).toString("hex")}`;
  const [newLic] = await db
    .insert(licenses)
    .values({
      id: licId,
      appId: tx.appId,
      transactionId: tx.id,
      licenseKey,
      customerEmail: tx.customerEmail,
      status: "ACTIVE",
      licenseVersion: 1,
      features,
      maxSeats,
      platform: "general",
      expiresAt,
      offlineJwtGraceToken: offlineToken,
      apiKey: generatedApiKey,
    })
    .returning();

  const grantedCredits = tx.grantCredits || 0;
  let creditBalance = 0;
  if (grantedCredits > 0) {
    creditBalance = await CreditService.grant(
      { licenseId: licId, appId: tx.appId, customerEmail: tx.customerEmail },
      grantedCredits,
      {
        reference: tx.id,
        description: `Simulasi pembayaran (${tx.id})`,
      }
    );
  }

  await db
    .update(transactions)
    .set({
      paymentStatus: "PAID",
      paymentChannel: "SIMULATOR_QRIS",
      paidAt: now,
      updatedAt: now,
    })
    .where(eq(transactions.id, tx.id));

  return {
    success: true,
    message: "Simulasi pembayaran sukses! Lisensi diterbitkan.",
    transactionId: tx.id,
    licenseKey: newLic.licenseKey,
    grantedCredits,
    creditBalance,
  };
}
