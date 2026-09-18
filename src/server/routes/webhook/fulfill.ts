import { db } from "../../db";
import { transactions, licenses, apps } from "../../db/schema";
import { eq, and } from "drizzle-orm";
import { LicenseService } from "../../services/license";
import { EmailService } from "../../services/email";
import { CreditService } from "../../services/credits";
import { randomBytes } from "crypto";

async function sendLicenseIssuedEmail(result: any): Promise<void> {
  if (!result?.licenseKey || !result?.appId || !result?.customerEmail) return;
  try {
    const app = await db.query.apps.findFirst({ where: eq(apps.id, result.appId) });
    const delivery = app?.deliveryConfig;
    await EmailService.sendLicenseIssued({
      to: result.customerEmail,
      appName: app?.name || "Lisensi",
      licenseKey: result.licenseKey,
      expiresAt: result.expiresAt,
      deliveryDetails: delivery
        ? {
            fileDownload: delivery.fileDownload?.enabled ? delivery.fileDownload : undefined,
            privateNote: delivery.privateNote?.enabled ? delivery.privateNote : undefined,
            apiAccess: delivery.apiAccess?.enabled ? delivery.apiAccess : undefined,
          }
        : undefined,
    });
  } catch (err: any) {
    // Pengiriman email tidak boleh menggagalkan fulfillment pembayaran.
    console.error("[Webhook] Gagal kirim email lisensi:", err?.message || err);
  }
}

/**
 * Fulfill payment dan terbitkan lisensi secara universal & idempotent
 */
export async function fulfillPaymentTransaction(tx: any, paymentChannel: string = "QRIS") {
  const now = new Date();

  try {
    const result = await db.transaction(async (trx) => {
      // Kunci baris transaksi agar callback paralel tidak diproses ganda.
      const [locked] = await trx
        .select()
        .from(transactions)
        .where(eq(transactions.id, tx.id))
        .for("update");

      if (!locked) {
        return { status: "error", message: "Transaction not found", transactionId: tx.id };
      }

      // NFR: Idempotensi Webhook (Cegah duplikasi saldo & lisensi jika callback dikirim berulang)
      if (locked.paymentStatus === "PAID") {
        return {
          status: "success",
          message: "Transaction already verified and processed (idempotent)",
          transactionId: tx.id,
        };
      }

      await trx
        .update(transactions)
        .set({
          paymentStatus: "PAID",
          paymentChannel,
          paidAt: now,
          updatedAt: now,
        })
        .where(eq(transactions.id, tx.id));

      // Baca konfigurasi delivery produk untuk seat dan durasi
      const app = await trx.query.apps.findFirst({ where: eq(apps.id, tx.appId) });
      const productGrantDays = app?.deliveryConfig?.licenseKey?.expiresInDays;
      const grantDays =
        typeof productGrantDays === "number" && productGrantDays > 0
          ? productGrantDays
          : (tx.grantDays || 365);
      const expiresAt = new Date(now.getTime() + grantDays * 24 * 60 * 60 * 1000);
      const maxSeats = app?.deliveryConfig?.licenseKey?.maxSeats ?? 3;

      // Generate Universal License Key (Modul 3 Integration)
      const licenseKey = LicenseService.generateLicenseKey();
      const offlineToken = LicenseService.createOfflineGraceToken(licenseKey, tx.appId);

      const licId = `lic_${randomBytes(8).toString("hex")}`;
      await trx.insert(licenses).values({
        id: licId,
        appId: tx.appId,
        transactionId: tx.id,
        licenseKey,
        customerEmail: tx.customerEmail,
        status: "ACTIVE",
        maxSeats,
        expiresAt,
        offlineJwtGraceToken: offlineToken,
      });

      // Tambahkan kredit lisensi (jika paket membawa grantCredits) ke ledger.
      const grantedCredits = tx.grantCredits || 0;
      let creditBalance = 0;
      if (grantedCredits > 0) {
        creditBalance = await CreditService.grant(
          { licenseId: licId, appId: tx.appId, customerEmail: tx.customerEmail },
          grantedCredits,
          {
            reference: tx.id,
            description: `Pembelian paket (${tx.id})`,
            executor: trx,
          }
        );
      }

      const maskedKey = licenseKey ? `${licenseKey.slice(0, 4)}****` : "N/A";
      console.log(`[Webhook] Payment confirmed for TX: ${tx.id}, License issued: ${maskedKey}`);

      return {
        status: "success",
        message: "Transaction verified and balance updated",
        transactionId: tx.id,
        licenseKey,
        newlyFulfilled: true,
        appId: tx.appId,
        customerEmail: tx.customerEmail,
        expiresAt,
        grantedCredits,
        creditBalance,
      };
    });

    if (result?.newlyFulfilled) {
      await sendLicenseIssuedEmail(result);
    }

    return result;
  } catch (err: any) {
    // Backstop idempotensi: unique(transaction_id) menangkap balapan insert.
    if (err?.code === "23505") {
      const existing = await db.query.licenses.findFirst({
        where: eq(licenses.transactionId, tx.id),
      });
      return {
        status: "success",
        message: "Transaction already verified and processed (idempotent)",
        transactionId: tx.id,
        licenseKey: existing?.licenseKey,
      };
    }
    throw err;
  }
}
