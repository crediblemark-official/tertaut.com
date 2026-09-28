import { db } from "../../db";
import {
  licenses,
  apps,
  builders,
  licenseActivations,
  revokedTokens,
  licenseEvents,
} from "../../db/schema";
import { eq, desc, and, ilike, or, count } from "drizzle-orm";
import { LicenseService } from "../../services/licensing/license";

/**
 * Daftar Seluruh Lisensi Software (Super Admin)
 */
export async function handlePanelLicenses({ query }: any) {
  const limit = Math.min(Number(query?.limit) || 100, 500);
  const statusFilter = query?.status;
  const search = (query?.search || "").trim().toLowerCase();

  const allLicenses = await db.query.licenses.findMany({
    where: statusFilter ? eq(licenses.status, statusFilter as any) : undefined,
    orderBy: [desc(licenses.createdAt)],
    limit,
  });

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

  if (search) {
    items = items.filter(
      (l) =>
        l.licenseKey.toLowerCase().includes(search) ||
        l.customerEmail.toLowerCase().includes(search) ||
        l.appName.toLowerCase().includes(search) ||
        l.builderEmail.toLowerCase().includes(search)
    );
  }

  return {
    success: true,
    total: items.length,
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

  await db.transaction(async (trx) => {
    // 1. Update status lisensi
    await trx
      .update(licenses)
      .set({ status: "REVOKED", updatedAt: new Date() })
      .where(eq(licenses.id, lic.id));

    // 2. Tambah token jti ke revokedTokens denylist
    const token = LicenseService.createOfflineGraceToken(lic.licenseKey, lic.appId);
    const jti = token.split(".")[1] || `jti_rev_${lic.id}_${Date.now()}`;

    await trx
      .insert(revokedTokens)
      .values({
        jti,
        licenseId: lic.id,
        licenseKey: lic.licenseKey,
        reason: `ADMIN_REVOKE: ${reason}`,
        expiresAt: lic.expiresAt,
      })
      .onConflictDoNothing();

    // 3. Masukkan ke audit trail licenseEvents
    await trx.insert(licenseEvents).values({
      id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      licenseId: lic.id,
      licenseKey: lic.licenseKey,
      appId: lic.appId,
      event: "revoked",
      actorType: "ADMIN",
      payload: { reason, revokedBy: "Super Admin" },
    });
  });

  return {
    success: true,
    licenseId: lic.id,
    status: "REVOKED",
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

  await db.transaction(async (trx) => {
    await trx
      .update(licenses)
      .set({ status: "ACTIVE", updatedAt: new Date() })
      .where(eq(licenses.id, lic.id));

    // Hapus dari revokedTokens denylist jika ada
    await trx.delete(revokedTokens).where(eq(revokedTokens.licenseId, lic.id));

    // Audit trail
    await trx.insert(licenseEvents).values({
      id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      licenseId: lic.id,
      licenseKey: lic.licenseKey,
      appId: lic.appId,
      event: "reactivated",
      actorType: "ADMIN",
      payload: { reactivatedBy: "Super Admin" },
    });
  });

  return {
    success: true,
    licenseId: lic.id,
    status: "ACTIVE",
    message: `Lisensi ${lic.licenseKey} berhasil diaktifkan kembali (ACTIVE).`,
  };
}
