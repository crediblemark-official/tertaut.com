import { db } from "../../db";
import {
  licenses,
  apps,
  builders,
  licenseActivations,
  revokedTokens,
  licenseEvents,
} from "../../db/schema";
import { eq, desc, and, ilike, or, count, inArray } from "drizzle-orm";
import { LicenseService } from "../../services/licensing/license";

/**
 * Daftar Seluruh Lisensi Software (Super Admin)
 */
export async function handlePanelLicenses({ query }: any) {
  const limit = Math.min(Number(query?.limit) || 100, 500);
  const statusFilter = query?.status;
  const modeFilter = query?.mode;
  const search = (query?.search || "").trim();

  const conditions: any[] = [];
  if (statusFilter) {
    conditions.push(eq(licenses.status, statusFilter as any));
  }
  if (modeFilter === "sandbox" || modeFilter === "live") {
    conditions.push(eq(licenses.mode, modeFilter));
  }
  if (search) {
    const pattern = `%${search}%`;
    const matchedApps = await db
      .select({ id: apps.id })
      .from(apps)
      .where(or(ilike(apps.name, pattern), ilike(apps.slug, pattern)));
    const matchedAppIds = matchedApps.map((a) => a.id);
    const searchFilters = [
      ilike(licenses.licenseKey, pattern),
      ilike(licenses.customerEmail, pattern),
    ];
    if (matchedAppIds.length > 0) {
      searchFilters.push(inArray(licenses.appId, matchedAppIds));
    }
    conditions.push(or(...searchFilters));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [[totalRes], allLicenses] = await Promise.all([
    db.select({ count: count() }).from(licenses).where(whereClause),
    db.query.licenses.findMany({
      where: whereClause,
      orderBy: [desc(licenses.createdAt)],
      limit,
    }),
  ]);

  const appIds = [...new Set(allLicenses.map((l) => l.appId))];
  const appRows = appIds.length
    ? await db.query.apps.findMany({
        where: (a, { inArray }) => inArray(a.id, appIds),
      })
    : [];

  const builderIds = [...new Set(appRows.map((a) => a.builderId))];
  const builderRows = builderIds.length
    ? await db.query.builders.findMany({
        where: (b, { inArray }) => inArray(b.id, builderIds),
      })
    : [];

  const appMap = new Map(appRows.map((a) => [a.id, a]));
  const builderMap = new Map(builderRows.map((b) => [b.id, b]));

  // Hitung jumlah aktivasi hardware per lisensi
  const activationCounts = await db
    .select({
      licenseId: licenseActivations.licenseId,
      total: count(),
    })
    .from(licenseActivations)
    .groupBy(licenseActivations.licenseId);

  const activationMap = new Map(activationCounts.map((a) => [a.licenseId, Number(a.total)]));

  let items = allLicenses.map((lic) => {
    const app = appMap.get(lic.appId);
    const builder = app ? builderMap.get(app.builderId) : null;
    return {
      id: lic.id,
      licenseKey: lic.licenseKey,
      appId: lic.appId,
      appName: app?.name || lic.appId,
      appSlug: app?.slug || "",
      mode: app?.mode || "live",
      builderName: builder?.name || "Builder",
      builderEmail: builder?.email || "-",
      customerEmail: lic.customerEmail,
      status: lic.status,
      maxSeats: lic.maxSeats,
      usedSeats: activationMap.get(lic.id) || (lic.hardwareId ? 1 : 0),
      platform: lic.platform,
      hardwareId: lic.hardwareId || null,
      hasOfflineToken: Boolean(lic.offlineJwtGraceToken),
      expiresAt: lic.expiresAt,
      lastValidatedAt: lic.lastValidatedAt,
      createdAt: lic.createdAt,
    };
  });

  return {
    success: true,
    total: Number(totalRes?.count ?? items.length),
    licenses: items,
  };
}

/**
 * Cabut Lisensi Secara Manual oleh Super Admin
 */
export async function handleRevokeLicense({ params, body, set }: any) {
  const licenseId = params.id;
  const reason = body?.reason || "Dicabut oleh Super Admin";

  const lic = await db.query.licenses.findFirst({
    where: eq(licenses.id, licenseId),
  });

  if (!lic) {
    set.status = 404;
    return { success: false, error: "Lisensi tidak ditemukan." };
  }

  if (lic.status === "REVOKED") {
    return {
      success: true,
      message: "Lisensi sudah berstatus REVOKED.",
      licenseId: lic.id,
    };
  }

  const result = await LicenseService.revoke({
    licenseId: lic.id,
    actor: { type: "ADMIN", id: "platform-admin" },
    reason,
  });

  if (result.notFound) {
    set.status = 404;
    return { success: false, error: "Lisensi tidak ditemukan." };
  }

  return {
    success: true,
    licenseId: lic.id,
    status: "REVOKED",
    tokenDenylisted: result.tokenDenylisted,
    message: `Lisensi ${lic.licenseKey} berhasil dicabut (REVOKED).`,
  };
}

/**
 * Aktifkan Kembali Lisensi yang Dicabut (Super Admin)
 */
export async function handleReactivateLicense({ params, set }: any) {
  const licenseId = params.id;

  const lic = await db.query.licenses.findFirst({
    where: eq(licenses.id, licenseId),
  });

  if (!lic) {
    set.status = 404;
    return { success: false, error: "Lisensi tidak ditemukan." };
  }

  const result = await LicenseService.reactivate({
    licenseKey: lic.licenseKey,
    actor: { type: "ADMIN", id: "platform-admin" },
  });

  if (result.notFound || !result.success) {
    set.status = result.notFound ? 404 : 400;
    return { success: false, error: result.error || "Gagal mengaktifkan kembali lisensi." };
  }

  return {
    success: true,
    licenseId: lic.id,
    status: "ACTIVE",
    message: `Lisensi ${lic.licenseKey} berhasil diaktifkan kembali (ACTIVE).`,
  };
}
