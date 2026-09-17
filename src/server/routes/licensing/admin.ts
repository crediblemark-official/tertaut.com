import { db } from "../../db";
import { licenses, licenseActivations, apps, revokedTokens } from "../../db/schema";
import { eq, inArray } from "drizzle-orm";
import { LicenseService } from "../../services/license";
import { LicenseTokenService } from "../../services/licenseToken";
import { EmailService } from "../../services/email";
import { CreditService } from "../../services/credits";
import { randomBytes } from "crypto";

export async function handleListLicenses({ query }: any) {
  const { appId, limit = 50, mode } = query;
  let licList;
  if (appId) {
    licList = await db.query.licenses.findMany({
      where: eq(licenses.appId, appId),
      orderBy: (lic, { desc }) => [desc(lic.createdAt)],
      limit: Number(limit),
    });
  } else if (mode) {
    const appRows = await db
      .select({ id: apps.id })
      .from(apps)
      .where(eq(apps.mode, mode));
    licList = appRows.length
      ? await db.query.licenses.findMany({
          where: inArray(licenses.appId, appRows.map((a) => a.id)),
          orderBy: (lic, { desc }) => [desc(lic.createdAt)],
          limit: Number(limit),
        })
      : [];
  } else {
    licList = await db.query.licenses.findMany({
      orderBy: (lic, { desc }) => [desc(lic.createdAt)],
      limit: Number(limit),
    });
  }

  // Batch-fetch seluruh aktivasi device seats (hindari N+1).
  const licenseIds = licList.map((lic) => lic.id);
  const allActivations =
    licenseIds.length > 0
      ? await db.query.licenseActivations.findMany({
          where: inArray(licenseActivations.licenseId, licenseIds),
          orderBy: (act, { desc }) => [desc(act.lastValidatedAt)],
        })
      : [];
  const activationsByLicense = new Map<string, any[]>();
  for (const act of allActivations) {
    const list = activationsByLicense.get(act.licenseId) || [];
    list.push(act);
    activationsByLicense.set(act.licenseId, list);
  }
  const licensesWithActivations = licList.map((lic) => ({
    ...lic,
    seatsUsed: (activationsByLicense.get(lic.id) || []).length,
    activations: activationsByLicense.get(lic.id) || [],
  }));

  return {
    success: true,
    licenses: licensesWithActivations,
  };
}

export async function handleIssueLicense({ body, set }: any) {
  const {
    appId,
    customerEmail,
    grantDays = 30,
    maxSeats = 3,
    platform = "general",
    grantCredits = 0,
  } = body;

  const licenseKey = LicenseService.generateLicenseKey();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + grantDays);

  const licenseId = `lic_${randomBytes(8).toString("hex")}`;
  const offlineToken = LicenseService.createOfflineGraceToken(
    licenseKey,
    appId,
    null,
    customerEmail,
    maxSeats
  );

  const [newLic] = await db
    .insert(licenses)
    .values({
      id: licenseId,
      appId,
      licenseKey,
      customerEmail,
      platform,
      status: "ACTIVE",
      maxSeats,
      offlineJwtGraceToken: offlineToken,
      expiresAt,
    })
    .returning();

  let creditBalance = 0;
  if (grantCredits > 0) {
    creditBalance = await CreditService.grant(
      { licenseId, appId, customerEmail },
      grantCredits,
      { description: "Penerbitan lisensi manual" }
    );
  }

  const app = await db.query.apps.findFirst({ where: eq(apps.id, appId) });
  await EmailService.sendLicenseIssued({
    to: customerEmail,
    appName: app?.name || "Lisensi",
    licenseKey,
    expiresAt,
  });

  return {
    success: true,
    license: newLic,
    creditBalance,
  };
}

export async function handleRevokeLicense({ body, set }: any) {
  const { licenseKey } = body;

  const [updated] = await db
    .update(licenses)
    .set({ status: "REVOKED", updatedAt: new Date() })
    .where(eq(licenses.licenseKey, licenseKey.trim()))
    .returning();

  if (!updated) {
    set.status = 404;
    return { error: "License not found" };
  }

  // Denylist jti token aktif agar token yang sudah beredar ikut tidak valid.
  let denylisted = false;
  if (updated.offlineJwtGraceToken) {
    const decoded = LicenseTokenService.verify(updated.offlineJwtGraceToken);
    if (decoded.valid && decoded.claims) {
      await db
        .insert(revokedTokens)
        .values({
          jti: decoded.claims.jti,
          licenseId: updated.id,
          licenseKey: updated.licenseKey,
          reason: "LICENSE_REVOKED",
          expiresAt: decoded.claims.exp ? new Date(decoded.claims.exp * 1000) : null,
        })
        .onConflictDoNothing();
      denylisted = true;
    }
  }

  return {
    success: true,
    message: `Kunci lisensi ${licenseKey} berhasil dicabut (REVOKED).`,
    tokenDenylisted: denylisted,
    license: updated,
  };
}
