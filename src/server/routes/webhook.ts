import { Elysia, t } from "elysia";
import { db } from "../db";
import { transactions, licenses, apps } from "../db/schema";
import { eq } from "drizzle-orm";
import { XenditService } from "../services/xendit";
import { LicenseService } from "../services/license";
import { randomBytes } from "crypto";

export const webhookSchema = {
  detail: {
    tags: ["Webhook"],
    summary: "Xendit Invoice Webhook Handler",
    description: "Receives payment callbacks from Xendit and automatically provisions licenses (Idempotent)",
  },
};

export const webhookRoutes = new Elysia({ prefix: "/webhook" })
  /**
   * Webhook callback handler dari Xendit Invoice (Idempotent & Secured)
   */
  .post(
    "/xendit",
    handleXenditInvoiceWebhook,
    webhookSchema
  )
  .post(
    "/xendit/invoice",
    handleXenditInvoiceWebhook,
    webhookSchema
  );

export const webhooksPluralRoutes = new Elysia({ prefix: "/webhooks" })
  .post(
    "/xendit/invoice",
    handleXenditInvoiceWebhook,
    webhookSchema
  );

export async function handleXenditInvoiceWebhook({ headers, body, set }: any) {
  const callbackToken = headers["x-callback-token"];
  if (!XenditService.verifyWebhook(callbackToken)) {
    set.status = 401;
    return { error: "Invalid callback verification token" };
  }

  const {
    id: xenditInvoiceId,
    external_id: externalId,
    status,
    payment_channel,
    payment_method,
  } = body as {
    id?: string;
    external_id?: string;
    status?: string;
    payment_channel?: string;
    payment_method?: string;
  };

  if (!externalId && !xenditInvoiceId) {
    set.status = 400;
    return { error: "Missing external_id or id" };
  }

  // Lookup transaksi via externalId atau invoiceId
  let tx = externalId
    ? await db.query.transactions.findFirst({
        where: eq(transactions.xenditExternalId, externalId),
      })
    : null;

  if (!tx && xenditInvoiceId) {
    tx = await db.query.transactions.findFirst({
      where: eq(transactions.xenditInvoiceId, xenditInvoiceId),
    });
  }

  if (!tx) {
    set.status = 404;
    return { error: "Transaction not found" };
  }

  // NFR: Idempotensi Webhook (Cegah duplikasi saldo & lisensi jika callback dikirim berulang)
  if (tx.paymentStatus === "PAID") {
    return {
      status: "success",
      message: "Transaction already verified and processed (idempotent)",
      transactionId: tx.id,
    };
  }

  if (status === "PAID") {
    const now = new Date();
    const grantDays = tx.grantDays || 365;
    const expiresAt = new Date(now.getTime() + grantDays * 24 * 60 * 60 * 1000);

    // Update status transaksi menjadi PAID
    await db
      .update(transactions)
      .set({
        paymentStatus: "PAID",
        paymentChannel: payment_method || payment_channel || "QRIS",
        paidAt: now,
        updatedAt: now,
      })
      .where(eq(transactions.id, tx.id));

    // Generate Universal License Key (Modul 3 Integration)
    const licenseKey = LicenseService.generateLicenseKey();
    const offlineToken = LicenseService.createOfflineGraceToken(licenseKey, tx.appId);

    const licId = `lic_${randomBytes(8).toString("hex")}`;
    await db.insert(licenses).values({
      id: licId,
      appId: tx.appId,
      transactionId: tx.id,
      licenseKey,
      customerEmail: tx.customerEmail,
      status: "ACTIVE",
      expiresAt,
      offlineJwtGraceToken: offlineToken,
    });

    console.log(`[Webhook] Payment confirmed for TX: ${tx.id}, License issued: ${licenseKey}`);

    return {
      status: "success",
      message: "Transaction verified and balance updated",
      transactionId: tx.id,
      licenseKey,
    };
  } else if (status === "EXPIRED") {
    await db
      .update(transactions)
      .set({
        paymentStatus: "EXPIRED",
        updatedAt: new Date(),
      })
      .where(eq(transactions.id, tx.id));
  }

  return { received: true, status };
}
