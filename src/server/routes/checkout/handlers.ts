import { db } from "../../db";
import { apps, transactions, licenses } from "../../db/schema";
import { eq, inArray, or } from "drizzle-orm";
import { XenditService } from "../../services/xendit";
import { LicenseService } from "../../services/license";
import { CouponService } from "../../services/coupon";
import { config as checkoutConfig } from "../../config";
import { randomBytes } from "crypto";
import { fulfillPaymentTransaction } from "../webhook/fulfill";

/**
 * Endpoint Redirect pembeli setelah menyelesaikan pembayaran DANA (Finish Redirect URL)
 */
export async function handleDanaFinish({ query, set }: any) {
  const { orderId, externalId, mock } = query as {
    orderId?: string;
    externalId?: string;
    mock?: string;
  };

  const identifier = externalId || orderId;
  if (!identifier) {
    return { message: "Pembayaran DANA selesai. Silakan cek email Anda untuk kunci lisensi." };
  }

  const tx = await db.query.transactions.findFirst({
    where: or(
      eq(transactions.xenditExternalId, identifier),
      eq(transactions.providerReferenceId, identifier),
      eq(transactions.id, identifier)
    ),
  });

  if (!tx) {
    return { message: "Transaksi tidak ditemukan." };
  }

  const app = await db.query.apps.findFirst({
    where: eq(apps.id, tx.appId),
  });

  // Jika mock mode pada sandbox browser test, simulasi auto-paid
  // Kritis: Di-gate checkoutConfig.isSandbox agar pembayaran tidak bisa di-bypass di production
  if (checkoutConfig.isSandbox && mock === "true" && tx.paymentStatus === "PENDING") {
    await fulfillPaymentTransaction(tx, "DANA_MOCK");
  }

  const targetUrl =
    app?.redirectUrl ||
    `${checkoutConfig.publicAppUrl}/pay/${app?.slug || ''}?status=success`;

  set.redirect = targetUrl;
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
 * Daftar riwayat transaksi MoR
 */
export async function handleListTransactions({ query }: any) {
  const { appId, limit = 50, mode } = query;
  let txs;
  if (appId) {
    txs = await db.query.transactions.findMany({
      where: eq(transactions.appId, appId),
      orderBy: (tx, { desc }) => [desc(tx.createdAt)],
      limit: Number(limit),
    });
  } else if (mode) {
    const appRows = await db
      .select({ id: apps.id })
      .from(apps)
      .where(eq(apps.mode, mode));
    txs = appRows.length
      ? await db.query.transactions.findMany({
          where: inArray(transactions.appId, appRows.map((a) => a.id)),
          orderBy: (tx, { desc }) => [desc(tx.createdAt)],
          limit: Number(limit),
        })
      : [];
  } else {
    txs = await db.query.transactions.findMany({
      orderBy: (tx, { desc }) => [desc(tx.createdAt)],
      limit: Number(limit),
    });
  }

  return {
    success: true,
    transactions: txs,
  };
}

/**
 * Trigger pencairan saldo (Xendit Disbursement) manual / instant payout
 */
export async function handleDisburseTx({ params: { txId }, set }: any) {
  const tx = await db.query.transactions.findFirst({
    where: eq(transactions.id, txId),
  });

  if (!tx) {
    set.status = 404;
    return { error: "Transaction not found" };
  }

  if (tx.paymentStatus !== "PAID") {
    set.status = 400;
    return { error: "Hanya transaksi yang sudah lunas (PAID) yang dapat dicairkan." };
  }

  if (tx.disbursementStatus === "COMPLETED") {
    return { success: true, message: "Pencairan dana sudah pernah diproses.", disbursementId: tx.disbursementId };
  }

  // Transaksi dari aplikasi sandbox hanyalah simulasi — tidak boleh dicairkan ke rekening asli.
  const disbApp = await db.query.apps.findFirst({ where: eq(apps.id, tx.appId) });
  if (disbApp?.mode === "sandbox") {
    set.status = 400;
    return { error: "Transaksi sandbox (simulasi) tidak dapat dicairkan. Cairkan hanya transaksi live." };
  }

  const externalDisbId = `disb_${tx.id}_${Date.now()}`;
  try {
    const builder = await db.query.transactions.findFirst({
      where: eq(transactions.id, txId),
    });

    const { builders } = await import("../../db/schema");
    const { db: database } = await import("../../db");
    const builderRow = await database.query.builders.findFirst({
      where: eq(builders.id, tx.builderId),
    });

    const recipient = XenditService.resolveDisbursementAccount(builderRow);

    // Production TANPA rekening tersimpan → tolak pencairan (jangan pakai data palsu)
    if (!recipient) {
      set.status = 400;
      return {
        error:
          "Builder belum menyimpan rekening penerima disbursement. Lengkapi profil bank/e-wallet terlebih dahulu.",
      };
    }

    const disbRes = await XenditService.createDisbursement({
      externalId: externalDisbId,
      amount: tx.netAmount,
      ...recipient,
      description: `Pencairan Saldo Bersih 95% tertaut.com ${tx.id}`,
    });

    // Kejujuran status: COMPLETED hanya kalau Xendit benar-benar menyelesaikannya.
    const finalStatus =
      disbRes.status === "COMPLETED"
        ? "COMPLETED"
        : disbRes.status === "FAILED"
          ? "FAILED"
          : "PROCESSING";

    await db
      .update(transactions)
      .set({
        disbursementStatus: finalStatus,
        disbursementId: disbRes.id,
        updatedAt: new Date(),
      })
      .where(eq(transactions.id, tx.id));

    return {
      success: true,
      message:
        finalStatus === "COMPLETED"
          ? "Pencairan berhasil dipicu ke rekening builder via Xendit API."
          : "Pencairan terkirim ke Xendit dan masih berstatus PROCESSING.",
      disbursement: { ...disbRes, status: finalStatus },
    };
  } catch (err: any) {
    set.status = 500;
    return { error: err.message || "Gagal memproses pencairan Xendit." };
  }
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
  if (txApp?.mode !== "sandbox" && !checkoutConfig.isSandbox) {
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

  // Generate and provision universal license
  const licenseKey = LicenseService.generateLicenseKey();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + (tx.grantDays || 365));

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
      maxSeats: 3,
      platform: "general",
      expiresAt,
    })
    .returning();

  await db
    .update(transactions)
    .set({
      paymentStatus: "PAID",
      paymentChannel: "SIMULATOR_QRIS",
      paidAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(transactions.id, tx.id));

  return {
    success: true,
    message: "Simulasi pembayaran sukses! Lisensi diterbitkan.",
    transactionId: tx.id,
    licenseKey: newLic.licenseKey,
  };
}
