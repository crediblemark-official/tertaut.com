import { db } from "../../db";
import { transactions, licenses, apps } from "../../db/schema";
import { eq, and } from "drizzle-orm";
import { LicenseService } from "../../services/licensing/license";
import { EmailService } from "../../services/notifications/email";
import { WebhookService } from "../../services/notifications/webhooks";
import { AuditService } from "../../services/security/audit";
import { randomBytes } from "crypto";

async function sendLicenseIssuedEmail(result: any): Promise<void> {
  if (!result?.licenseKey || !result?.appId || !result?.customerEmail) return;
  try {
    const app = await db.query.apps.findFirst({ where: eq(apps.id, result.appId) });
    const delivery = app?.deliveryConfig;
    const apiAccessConfig = delivery?.apiAccess?.enabled
      ? {
          ...delivery.apiAccess,
          apiKey: result.apiKey,
        }
      : undefined;

    const isLicenseKeyEnabled = delivery?.licenseKey?.enabled !== false;

    await EmailService.sendLicenseIssued({
      to: result.customerEmail,
      appName: app?.name || "Produk Digital",
      licenseKey: result.licenseKey,
      expiresAt: result.expiresAt,
      deliveryDetails: delivery
        ? {
            licenseKeyEnabled: isLicenseKeyEnabled,
            fileDownload: delivery.fileDownload?.enabled ? delivery.fileDownload : undefined,
            privateNote: delivery.privateNote?.enabled ? delivery.privateNote : undefined,
            apiAccess: apiAccessConfig,
          }
        : { licenseKeyEnabled: true },
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

      // Refunded transactions are terminal; delayed callbacks must not resurrect them.
      if (locked.paymentStatus === "REFUNDED") {
        throw new Error("Transaksi yang telah di-refund tidak dapat diproses kembali");
      }
      // Baca konfigurasi delivery produk untuk seat dan durasi
      const app = await trx.query.apps.findFirst({ where: eq(apps.id, tx.appId) });
      if (locked.mode === "sandbox" && app?.mode !== "sandbox") {
        throw new Error("Transaksi sandbox tidak dapat menerbitkan lisensi produk live");
      }
      if (locked.paymentProvider === "sandbox" && locked.mode !== "sandbox") {
        throw new Error("Provider simulasi tidak diizinkan untuk transaksi live");
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

      const isSaasWeb = app?.appType === "saas_web";
      const shouldIssueLicense = !(isSaasWeb && app?.deliveryConfig?.licenseKey?.enabled === false);

      const productGrantDays = app?.deliveryConfig?.licenseKey?.expiresInDays;
      const grantDays =
        typeof productGrantDays === "number" && productGrantDays > 0
          ? productGrantDays
          : tx.grantDays || 365;
      let licenseKey: string | null = null;
      let licId: string | null = null;
      let generatedApiKey: string | undefined = undefined;
      let expiresAt = new Date(now.getTime() + grantDays * 24 * 60 * 60 * 1000);

      if (shouldIssueLicense) {
        const provisioned = await LicenseService.provisionForPayment({
          transactionId: tx.id,
          appId: tx.appId,
          customerEmail: tx.customerEmail,
          mode: locked.mode,
          app,
          grantDays,
          now,
          trx,
        });

        licenseKey = provisioned.licenseKey;
        licId = provisioned.licenseId;
        expiresAt = provisioned.expiresAt;
        generatedApiKey = provisioned.apiKey;
      }

      const paymentData = { ...locked, paymentChannel, paymentStatus: "PAID", paidAt: now };
      await WebhookService.emitPayment(
        "payment.success",
        { transaction: paymentData, app, eventId: `payment.success:${locked.id}` },
        trx
      );
      if (licId) {
        const issued = await trx.query.licenses.findFirst({ where: eq(licenses.id, licId) });
        if (issued)
          await WebhookService.emit(
            "license.issued",
            {
              license: issued,
              app,
              actorType: "SYSTEM",
              eventId: `license.issued:${issued.id}`,
              payload: { transactionId: locked.id },
            },
            trx
          );
      }
      const maskedKey = licenseKey ? `${licenseKey.slice(0, 4)}****` : "N/A (SaaS Web)";
      console.log(`[Webhook] Payment confirmed for TX: ${tx.id}, License issued: ${maskedKey}`);

      return {
        status: "success",
        message: "Transaction verified and license issued",
        transactionId: tx.id,
        licenseKey,
        expiresAt: expiresAt.toISOString(),
        customerEmail: tx.customerEmail,
        appId: tx.appId,
        apiKey: generatedApiKey,
        newlyFulfilled: true,
      };
    });

    if (result?.newlyFulfilled) {
      await sendLicenseIssuedEmail(result);
      const app = await db.query.apps.findFirst({ where: eq(apps.id, tx.appId) });
      const { NotifierService } = await import("../../services/notifications/notifier");
      NotifierService.notifyPaymentSuccess({
        transactionId: tx.id,
        appName: app?.name || tx.appId,
        grossAmount: tx.grossAmount,
        customerEmail: tx.customerEmail,
        paymentChannel,
      }).catch(() => null);

      // BUG B1: lisensi hasil pembayaran (jalur revenue utama) harus memicu
      // webhook license.issued + audit — konsisten dengan LicenseService.issueDirect.
      const issuedLic = await db.query.licenses.findFirst({
        where: eq(licenses.transactionId, tx.id),
      });
      if (issuedLic) {
        await AuditService.record(
          "license.issued",
          {
            licenseId: issuedLic.id,
            licenseKey: issuedLic.licenseKey,
            appId: issuedLic.appId,
            actorType: "SYSTEM",
          },
          {
            customerEmail: issuedLic.customerEmail,
            paymentChannel,
            transactionId: tx.id,
            expiresAt: result.expiresAt,
          }
        );
      }
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
