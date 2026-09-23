import { randomBytes } from "crypto";
import { db } from "../../db";
import { transactions, licenses, revokedTokens, apps, licenseEvents } from "../../db/schema";
import { eq, and, desc } from "drizzle-orm";
import { LicenseService } from "../../services/license";
import { NotifierService } from "../../services/notifier";

/**
 * Endpoint Admin: Memproses Pengembalian Dana (Refund) dan Auto-Revoke Lisensi
 */
export async function handleRefundTransaction({ params, body, set }: any) {
  const txId = params.txId;
  const reason = body?.reason || "Permintaan pengembalian dana (refund) oleh admin";

  const tx = await db.query.transactions.findFirst({
    where: eq(transactions.id, txId),
  });

  if (!tx) {
    set.status = 404;
    return { success: false, error: "Transaksi tidak ditemukan." };
  }

  if (tx.paymentStatus === "REFUNDED") {
    set.status = 400;
    return { success: false, error: "Transaksi ini sudah pernah di-refund sebelumnya." };
  }

  if (tx.paymentStatus !== "PAID") {
    set.status = 400;
    return {
      success: false,
      error: `Hanya transaksi berstatus PAID yang dapat di-refund (status saat ini: ${tx.paymentStatus}).`,
    };
  }

  // Ambil data aplikasi untuk notifikasi
  const app = await db.query.apps.findFirst({
    where: eq(apps.id, tx.appId),
  });

  // Cari lisensi terkait pembeli dan aplikasi ini
  const relatedLicense = await db.query.licenses.findFirst({
    where: and(eq(licenses.appId, tx.appId), eq(licenses.customerEmail, tx.customerEmail)),
    orderBy: [desc(licenses.createdAt)],
  });

  let revokedKey: string | undefined = undefined;

  // Eksekusi transaksi database: update status tx & revoke lisensi
  await db.transaction(async (trx) => {
    // 1. Update status transaksi
    await trx
      .update(transactions)
      .set({
        paymentStatus: "REFUNDED",
        disbursementStatus: "CANCELLED",
        updatedAt: new Date(),
      })
      .where(eq(transactions.id, tx.id));

    // 2. Cabut lisensi dan masukkan ke denylist JTI
    if (relatedLicense && relatedLicense.status !== "REVOKED") {
      revokedKey = relatedLicense.licenseKey;
      await trx
        .update(licenses)
        .set({
          status: "REVOKED",
          updatedAt: new Date(),
        })
        .where(eq(licenses.id, relatedLicense.id));

      // Blacklist JTI offline token
      const token = LicenseService.createOfflineGraceToken(
        relatedLicense.licenseKey,
        relatedLicense.appId
      );
      const jti = token.split(".")[1] || `jti_ref_${relatedLicense.id}`;

      await trx.insert(revokedTokens).values({
        jti,
        licenseId: relatedLicense.id,
        licenseKey: relatedLicense.licenseKey,
        reason: `REFUND: ${reason}`,
        revokedAt: new Date(),
        expiresAt: relatedLicense.expiresAt,
      });

      // Catat event pencabutan
      await trx.insert(licenseEvents).values({
        id: `evt_ref_${randomBytes(8).toString("hex")}`,
        licenseId: relatedLicense.id,
        licenseKey: relatedLicense.licenseKey,
        appId: relatedLicense.appId,
        event: "REVOKED",
        actorType: "ADMIN",
        actorId: "admin",
        payload: {
          reason: `REFUND: ${reason}`,
          transactionId: tx.id,
          refundAmount: tx.grossAmount,
        },
      });
    }
  });

  // Kirim notifikasi realtime (Telegram/Webhook)
  await NotifierService.notifyRefund({
    transactionId: tx.id,
    appName: app?.name || tx.appId,
    amount: tx.grossAmount,
    reason,
    revokedLicenseKey: revokedKey,
  });

  return {
    success: true,
    message: "Transaksi berhasil di-refund dan lisensi terkait telah otomatis dicabut.",
    data: {
      transactionId: tx.id,
      paymentStatus: "REFUNDED",
      disbursementStatus: "CANCELLED",
      refundedAmount: tx.grossAmount,
      revokedLicenseKey: revokedKey || null,
      refundedAt: new Date().toISOString(),
    },
  };
}
