import { db } from "../../db";
import { licenses, licenseActivations, apps, revokedTokens } from "../../db/schema";
import { eq, inArray, and, sql } from "drizzle-orm";
import { LicenseService } from "../../services/license";
import { LicenseTokenService } from "../../services/licenseToken";
import { EmailService } from "../../services/email";
import { CreditService } from "../../services/credits";
import { randomBytes } from "crypto";
import { resolveCurrentBuilder } from "../apps/builder";

export async function handleListLicenses({ query, request }: any) {
  const { appId, limit = 200, offset = 0, page, mode } = query || {};
  const headers = request?.headers;
  const { builder, isAdmin } = headers
    ? await resolveCurrentBuilder(headers)
    : { builder: null, isAdmin: true };

  const conditions: any[] = [];

  // Scoping data ke builder login (kecuali admin)
  if (!isAdmin && builder) {
    const builderApps = await db
      .select({ id: apps.id })
      .from(apps)
      .where(eq(apps.builderId, builder.id));
    if (builderApps.length === 0) {
      return { success: true, licenses: [], total: 0, hasMore: false };
    }
    conditions.push(inArray(licenses.appId, builderApps.map((a) => a.id)));
  } else if (!isAdmin && !builder) {
    return { success: true, licenses: [], total: 0, hasMore: false };
  }

  if (appId) {
    conditions.push(eq(licenses.appId, appId));
  } else if (mode) {
    const appRows = await db
      .select({ id: apps.id })
      .from(apps)
      .where(eq(apps.mode, mode));
    if (appRows.length === 0) {
      return { success: true, licenses: [], total: 0, hasMore: false };
    }
    conditions.push(inArray(licenses.appId, appRows.map((a) => a.id)));
  }

  const parsedLimit = Math.max(1, Math.min(Number(limit) || 200, 500));
  const parsedOffset = page ? (Math.max(1, Number(page)) - 1) * parsedLimit : Math.max(0, Number(offset) || 0);

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [totalRes] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(licenses)
    .where(whereClause);

  const total = totalRes?.count || 0;

  const licList = await db.query.licenses.findMany({
    where: whereClause,
    orderBy: (lic, { desc }) => [desc(lic.createdAt)],
    limit: parsedLimit,
    offset: parsedOffset,
  });

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
    total,
    limit: parsedLimit,
    offset: parsedOffset,
    hasMore: parsedOffset + licList.length < total,
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

export async function handleRenewLicense({ body, set }: any) {
  const { licenseKey, additionalDays, days } = body;

  if (!licenseKey || typeof licenseKey !== "string") {
    set.status = 400;
    return { success: false, error: "licenseKey wajib disertakan" };
  }

  const lic = await db.query.licenses.findFirst({
    where: eq(licenses.licenseKey, licenseKey.trim()),
  });

  if (!lic) {
    set.status = 404;
    return { success: false, error: "Lisensi tidak ditemukan" };
  }

  const app = await db.query.apps.findFirst({
    where: eq(apps.id, lic.appId),
  });

  let daysToAdd = Number(additionalDays || days);
  if (!daysToAdd || daysToAdd <= 0) {
    switch (app?.billingPeriod) {
      case "daily": daysToAdd = 1; break;
      case "weekly": daysToAdd = 7; break;
      case "monthly": daysToAdd = 30; break;
      case "every_3_months": daysToAdd = 90; break;
      case "every_6_months": daysToAdd = 180; break;
      case "yearly": daysToAdd = 365; break;
      default: daysToAdd = app?.deliveryConfig?.licenseKey?.expiresInDays || 30;
    }
  }

  const currentExpiry = lic.expiresAt ? new Date(lic.expiresAt) : new Date();
  const baseDate = currentExpiry.getTime() > Date.now() ? currentExpiry : new Date();
  baseDate.setDate(baseDate.getDate() + daysToAdd);

  const [updated] = await db
    .update(licenses)
    .set({
      status: "ACTIVE",
      expiresAt: baseDate,
      updatedAt: new Date(),
    })
    .where(eq(licenses.id, lic.id))
    .returning();

  return {
    success: true,
    message: `Lisensi ${licenseKey} berhasil diperpanjang +${daysToAdd} hari.`,
    newExpiry: baseDate.toISOString(),
    extendedDays: daysToAdd,
    additionalDays: daysToAdd,
    license: updated,
  };
}
