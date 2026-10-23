import { db } from "../../db";
import {
  transactions,
  licenses,
  licenseActivations,
  type Project,
  type Builder,
} from "../../db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { LicenseService } from "../../services/licensing/license";
import { EmailService } from "../../services/notifications/email";
import { randomBytes } from "crypto";
import type { CreateSessionBody } from "./session";

export interface FreeTrialContext {
  app: Project;
  builder?: Builder | null;
  email: string;
  rawHwid: string;
  clientIp: string;
  body: CreateSessionBody;
  set: { status?: number | string; [key: string]: any };
  requestOrigin: string;
  redirectUrl?: string;
  metadata?: Record<string, any>;
}

export async function handleFreeTrialCheckout({
  app,
  email,
  rawHwid,
  clientIp,
  body,
  set,
  requestOrigin,
  redirectUrl,
  metadata,
}: FreeTrialContext) {
  // Pre-check cepat 1 (UX): 409 bila email sudah pernah trial
  const existingTrial = await db.query.transactions.findFirst({
    where: and(
      eq(transactions.appId, app.id),
      eq(transactions.customerEmail, email),
      eq(transactions.paymentChannel, "FREE_TRIAL")
    ),
  });

  if (existingTrial) {
    set.status = 409;
    return {
      success: false,
      error: "Email ini sudah pernah mengaktifkan masa uji coba untuk produk ini.",
      errorCode: "TRIAL_EMAIL_ALREADY_USED",
    };
  }

  // Pre-check 2 (1.6 Device Fingerprinting Anti-Abuse):
  // Jika HWID/Device Fingerprint disertakan, tolak bila perangkat sudah pernah klaim trial app ini
  let lookupHashes: string[] = [];
  if (rawHwid) {
    lookupHashes = LicenseService.hwidLookupHashes(rawHwid);

    // Pre-check 2a: Lisensi trial yang sudah mengikat hardwareId ini
    const [existingHwidLic] = await db
      .select({ id: licenses.id })
      .from(licenses)
      .innerJoin(transactions, eq(licenses.transactionId, transactions.id))
      .where(
        and(
          eq(licenses.appId, app.id),
          eq(transactions.paymentChannel, "FREE_TRIAL"),
          inArray(licenses.hardwareId, lookupHashes)
        )
      )
      .limit(1);

    if (existingHwidLic) {
      set.status = 409;
      return {
        success: false,
        error: "Perangkat ini sudah pernah mengaktifkan masa uji coba untuk produk ini.",
        errorCode: "TRIAL_DEVICE_ALREADY_USED",
      };
    }

    // Pre-check 2b: Aktivasi perangkat pada lisensi trial
    const [existingActivation] = await db
      .select({ id: licenseActivations.id })
      .from(licenseActivations)
      .innerJoin(licenses, eq(licenseActivations.licenseId, licenses.id))
      .innerJoin(transactions, eq(licenses.transactionId, transactions.id))
      .where(
        and(
          eq(licenses.appId, app.id),
          eq(transactions.paymentChannel, "FREE_TRIAL"),
          inArray(licenseActivations.hwidHash, lookupHashes)
        )
      )
      .limit(1);

    if (existingActivation) {
      set.status = 409;
      return {
        success: false,
        error: "Perangkat ini sudah pernah mengaktifkan masa uji coba untuk produk ini.",
        errorCode: "TRIAL_DEVICE_ALREADY_USED",
      };
    }
  }

  const trialDays = app.trialPeriodDays!;
  const trialApiKey = app.deliveryConfig?.apiAccess?.enabled
    ? `tt_cust_${randomBytes(16).toString("hex")}`
    : undefined;
  const licenseKey = LicenseService.generateLicenseKey();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + trialDays);

  const txId = `tx_trial_${randomBytes(8).toString("hex")}`;
  const licId = `lic_${randomBytes(8).toString("hex")}`;

  let issued:
    | { duplicate: true; reason: "email" | "device" }
    | { trialTx: typeof transactions.$inferSelect; newLic: typeof licenses.$inferSelect };
  try {
    issued = await db.transaction(async (trx) => {
      // Cek ulang DI DALAM transaksi: anti-race (TOCTOU)
      const dupCheck = await trx.query.transactions.findFirst({
        where: and(
          eq(transactions.appId, app.id),
          eq(transactions.customerEmail, email),
          eq(transactions.paymentChannel, "FREE_TRIAL")
        ),
      });
      if (dupCheck) return { duplicate: true, reason: "email" };

      // Cek ulang HWID DI DALAM transaksi
      if (lookupHashes.length > 0) {
        const [hwidDup] = await trx
          .select({ id: licenses.id })
          .from(licenses)
          .innerJoin(transactions, eq(licenses.transactionId, transactions.id))
          .where(
            and(
              eq(licenses.appId, app.id),
              eq(transactions.paymentChannel, "FREE_TRIAL"),
              inArray(licenses.hardwareId, lookupHashes)
            )
          )
          .limit(1);
        if (hwidDup) return { duplicate: true, reason: "device" };

        const [actDup] = await trx
          .select({ id: licenseActivations.id })
          .from(licenseActivations)
          .innerJoin(licenses, eq(licenseActivations.licenseId, licenses.id))
          .innerJoin(transactions, eq(licenses.transactionId, transactions.id))
          .where(
            and(
              eq(licenses.appId, app.id),
              eq(transactions.paymentChannel, "FREE_TRIAL"),
              inArray(licenseActivations.hwidHash, lookupHashes)
            )
          )
          .limit(1);
        if (actDup) return { duplicate: true, reason: "device" };
      }

      const primaryHwidHash = rawHwid ? LicenseService.hashHardwareIdSecure(rawHwid) : null;

      const [tTx] = await trx
        .insert(transactions)
        .values({
          id: txId,
          appId: app.id,
          builderId: app.builderId,
          mode: app.mode,
          paymentProvider: "xendit",
          paymentChannel: "FREE_TRIAL",
          xenditExternalId: txId,
          customerEmail: email,
          grossAmount: 0,
          platformFee: 0,
          netAmount: 0,
          paymentStatus: "PAID",
          disbursementStatus: "COMPLETED",
          grantDays: trialDays,
          metadata: {
            ...(typeof metadata === "object" && metadata !== null ? metadata : {}),
            hwidHash: primaryHwidHash,
            clientIp,
            deviceFingerprint: rawHwid || undefined,
          },
        })
        .returning();

      const [nLic] = await trx
        .insert(licenses)
        .values({
          id: licId,
          appId: app.id,
          transactionId: tTx.id,
          mode: app.mode,
          customerEmail: email,
          licenseKey,
          hardwareId: primaryHwidHash,
          status: "ACTIVE",
          expiresAt,
          maxSeats: app.deliveryConfig?.licenseKey?.maxSeats ?? 3,
          apiKey: trialApiKey,
        })
        .returning();

      if (primaryHwidHash) {
        await trx.insert(licenseActivations).values({
          id: `act_${randomBytes(8).toString("hex")}`,
          licenseId: licId,
          hwidHash: primaryHwidHash,
          deviceName: body.deviceName || "Primary Trial Device",
          ipAddress: clientIp,
        });
      }

      return { trialTx: tTx, newLic: nLic };
    });
  } catch (err: any) {
    // Backstop unik DB (uniq_transactions_trial_per_app_email): bila dua request
    // paralel menang balapan, salah satunya gagal di sini → balas 409, bukan 500.
    if (err?.code === "23505") {
      set.status = 409;
      return {
        success: false,
        error:
          "Email ini sudah pernah mengaktifkan masa uji coba untuk produk ini (permintaan bersamaan).",
        errorCode: "TRIAL_EMAIL_ALREADY_USED",
      };
    }
    throw err;
  }

  if ("duplicate" in issued) {
    set.status = 409;
    const isDevice = issued.reason === "device";
    return {
      success: false,
      error: isDevice
        ? "Perangkat ini sudah pernah mengaktifkan masa uji coba untuk produk ini."
        : "Email ini sudah pernah mengaktifkan masa uji coba untuk produk ini.",
      errorCode: isDevice ? "TRIAL_DEVICE_ALREADY_USED" : "TRIAL_EMAIL_ALREADY_USED",
    };
  }

  const { trialTx } = issued;

  await EmailService.sendLicenseIssued({
    to: email,
    appName: app.name,
    licenseKey,
    expiresAt,
    deliveryDetails: {
      fileDownload: app.deliveryConfig?.fileDownload,
      privateNote: app.deliveryConfig?.privateNote,
      apiAccess: app.deliveryConfig?.apiAccess
        ? { ...app.deliveryConfig.apiAccess, apiKey: trialApiKey }
        : undefined,
    },
  }).catch(() => null);

  return {
    success: true,
    isTrial: true,
    trialPeriodDays: trialDays,
    transactionId: trialTx.id,
    licenseKey,
    expiresAt: expiresAt.toISOString(),
    message: `Masa uji coba gratis ${trialDays} hari berhasil diaktifkan!`,
    redirectUrl:
      redirectUrl ||
      app.redirectUrl ||
      `${requestOrigin}/checkout/success?licenseKey=${licenseKey}`,
  };
}
