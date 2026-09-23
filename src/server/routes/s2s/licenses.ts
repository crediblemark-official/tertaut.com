import { db } from "../../db";
import { apps, licenses, licenseActivations, licenseLeases } from "../../db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { LicenseService } from "../../services/license";
import { LicenseLeaseService, resolveFloatingConfig } from "../../services/licenseLease";
import { AuditService } from "../../services/audit";
import { ownedLicense, ownedApp } from "./helpers";

/**
 * Daftar lisensi (filter appId/status/limit) — scoped ke aplikasi milik builder
 */
export async function handleS2SListLicenses({ builder, query, set }: any) {
  let scope: any[] = [eq(licenses.appId, apps.id), eq(apps.builderId, builder.id)];
  if (query.appId) {
    const app = await ownedApp(builder, query.appId);
    if (!app) {
      set.status = 404;
      return { error: "App tidak ditemukan atau bukan milik builder" };
    }
    scope.push(eq(licenses.appId, query.appId));
  }
  if (query.status) scope.push(eq(licenses.status, query.status));

  const rows = await db
    .select({
      id: licenses.id,
      appId: licenses.appId,
      licenseKey: licenses.licenseKey,
      customerEmail: licenses.customerEmail,
      platform: licenses.platform,
      status: licenses.status,
      maxSeats: licenses.maxSeats,
      expiresAt: licenses.expiresAt,
      lastValidatedAt: licenses.lastValidatedAt,
      createdAt: licenses.createdAt,
      updatedAt: licenses.updatedAt,
    })
    .from(licenses)
    .innerJoin(apps, eq(licenses.appId, apps.id))
    .where(and(...scope))
    .limit(Math.min(query.limit ?? 50, 200));

  return { licenses: rows };
}

/**
 * Terbitkan lisensi secara programatik (tanpa pembayaran) untuk app milik builder
 */
export async function handleS2SIssueLicense({ builder, body, set }: any) {
  const app = await ownedApp(builder, body.appId);
  if (!app) {
    set.status = 404;
    return { error: "App tidak ditemukan atau bukan milik builder" };
  }

  const result = await LicenseService.issueDirect({
    appId: app.id,
    customerEmail: body.customerEmail,
    grantDays: body.grantDays,
    maxSeats: body.maxSeats,
    platform: body.platform,
    grantCredits: body.grantCredits,
    features: body.features,
    licenseVersion: body.licenseVersion,
    creditDescription: "Penerbitan lisensi via S2S",
    actor: { type: "S2S", id: builder.id },
  });

  return { success: true, license: result.license, creditBalance: result.creditBalance };
}

/**
 * Cabut lisensi milik builder (termasuk denylist token offline)
 */
export async function handleS2SRevokeLicense({ builder, body, set }: any) {
  const owned = await ownedLicense(builder, body.licenseKey);
  if (!owned) {
    set.status = 404;
    return { error: "Licensi tidak ditemukan atau bukan milik builder" };
  }

  const result = await LicenseService.revoke({
    licenseId: owned.lic.id,
    actor: { type: "S2S", id: builder.id },
  });
  if (result.notFound) {
    set.status = 404;
    return { error: "Licensi tidak ditemukan atau bukan milik builder" };
  }

  return {
    success: true,
    message: result.message,
    tokenDenylisted: result.tokenDenylisted,
    license: result.license,
  };
}

/**
 * Fase 2/6 — Daftar seat (aktivasi + lease floating) lisensi milik builder.
 */
export async function handleS2SListSeats({ builder, query, set }: any) {
  const owned = await ownedLicense(builder, query.licenseKey);
  if (!owned) {
    set.status = 404;
    return { error: "Lisensi tidak ditemukan atau bukan milik builder" };
  }
  const { lic, app } = owned;
  const floating = resolveFloatingConfig(app);

  const [activations, leases] = await Promise.all([
    db.query.licenseActivations.findMany({
      where: eq(licenseActivations.licenseId, lic.id),
      orderBy: (a, { desc }) => [desc(a.lastValidatedAt)],
    }),
    db.query.licenseLeases.findMany({
      where: eq(licenseLeases.licenseId, lic.id),
      orderBy: (l, { desc }) => [desc(l.lastHeartbeatAt)],
    }),
  ]);

  const now = new Date();
  const seats = activations.map((act) => {
    const lease = leases.find((l) => l.hwidHash === act.hwidHash);
    return {
      hwidHash: act.hwidHash,
      deviceName: act.deviceName,
      ipAddress: act.ipAddress,
      lastValidatedAt: act.lastValidatedAt,
      createdAt: act.createdAt,
      leaseActive: floating.enabled ? Boolean(lease && lease.expiresAt > now) : null,
      lastHeartbeatAt: lease?.lastHeartbeatAt || null,
      leaseExpiresAt: lease?.expiresAt || null,
    };
  });

  return {
    success: true,
    licenseKey: lic.licenseKey,
    status: lic.status,
    floating: floating.enabled,
    maxSeats: lic.maxSeats || 3,
    seatsUsed: floating.enabled ? seats.filter((s) => s.leaseActive === true).length : seats.length,
    leaseTtlSeconds: floating.enabled ? floating.leaseTtlSeconds : null,
    seats,
  };
}

/**
 * Fase 6 — Paksa lepas satu seat (force-release) milik builder.
 */
export async function handleS2SReleaseSeat({ builder, body, set }: any) {
  const owned = await ownedLicense(builder, body.licenseKey);
  if (!owned) {
    set.status = 404;
    return { error: "Lisensi tidak ditemukan atau bukan milik builder" };
  }
  const { lic } = owned;

  const lookupHashes = LicenseService.hwidLookupHashes(body.hwid);

  await db
    .delete(licenseActivations)
    .where(
      and(
        eq(licenseActivations.licenseId, lic.id),
        inArray(licenseActivations.hwidHash, lookupHashes)
      )
    );
  const leasesReleased = await LicenseLeaseService.releaseSeat(lic.id, body.hwid);

  await AuditService.record(
    "license.seat_released",
    {
      licenseId: lic.id,
      licenseKey: lic.licenseKey,
      appId: lic.appId,
      actorType: "S2S",
      actorId: builder.id,
    },
    { hwid: body.hwid, leasesReleased }
  );

  return { success: true, leasesReleased, message: "Seat perangkat berhasil dilepas." };
}

/**
 * Fase 6 — Pulihkan lisensi dari device hilang (recover): reset seluruh seat device.
 */
export async function handleS2SRecoverLicense({ builder, body, set }: any) {
  const owned = await ownedLicense(builder, body.licenseKey);
  if (!owned) {
    set.status = 404;
    return { error: "Lisensi tidak ditemukan atau bukan milik builder" };
  }
  const { lic, app } = owned;

  await db.delete(licenseActivations).where(eq(licenseActivations.licenseId, lic.id));
  await db.delete(licenseLeases).where(eq(licenseLeases.licenseId, lic.id));
  await db
    .update(licenses)
    .set({ hardwareId: null, updatedAt: new Date() })
    .where(eq(licenses.id, lic.id));

  await LicenseService.rotateOfflineToken(
    { ...lic, features: lic.features || null },
    app?.deliveryConfig?.licenseKey?.offlineGraceDays
  );

  await AuditService.record(
    "license.recovered",
    {
      licenseId: lic.id,
      licenseKey: lic.licenseKey,
      appId: lic.appId,
      actorType: "S2S",
      actorId: builder.id,
    },
    { seatsReleased: true }
  );

  return {
    success: true,
    message: "Lisensi dipulihkan. Seluruh seat device dilepas.",
    licenseKey: lic.licenseKey,
  };
}

/**
 * Fase 6 — Transfer kepemilikan lisensi ke customer lain.
 */
export async function handleS2STransferLicense({ builder, body, set }: any) {
  const owned = await ownedLicense(builder, body.licenseKey);
  if (!owned) {
    set.status = 404;
    return { error: "Lisensi tidak ditemukan atau bukan milik builder" };
  }
  const { lic } = owned;
  if (!body.newCustomerEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.newCustomerEmail)) {
    set.status = 400;
    return { success: false, error: "newCustomerEmail tidak valid" };
  }

  const [updated] = await db
    .update(licenses)
    .set({ customerEmail: body.newCustomerEmail.trim().toLowerCase(), updatedAt: new Date() })
    .where(eq(licenses.id, lic.id))
    .returning();

  await AuditService.record(
    "license.transferred",
    {
      licenseId: lic.id,
      licenseKey: lic.licenseKey,
      appId: lic.appId,
      actorType: "S2S",
      actorId: builder.id,
    },
    { from: lic.customerEmail, to: updated.customerEmail }
  );

  return { success: true, license: updated };
}

/**
 * Fase 4 — Audit trail lifecycle lisensi milik builder.
 */
export async function handleS2SLicenseEvents({ builder, query, set }: any) {
  const owned = query.appId
    ? null
    : query.licenseKey
      ? await ownedLicense(builder, query.licenseKey)
      : null;
  if (!owned && !query.appId) {
    set.status = 404;
    return { error: "Lisensi tidak ditemukan atau bukan milik builder" };
  }
  if (owned) {
    const events = await AuditService.query({
      licenseKey: query.licenseKey,
      event: query.event,
      actorType: query.actorType,
      limit: query.limit,
    });
    return events;
  }
  const app = await ownedApp(builder, query.appId!);
  if (!app) {
    set.status = 404;
    return { error: "App tidak ditemukan atau bukan milik builder" };
  }
  return AuditService.query({ appId: query.appId, event: query.event, limit: query.limit });
}

/**
 * Fase 2/6 — Terbitkan batch lisensi sekaligus.
 */
export async function handleS2SIssueBatch({ builder, body, set }: any) {
  const app = await ownedApp(builder, body.appId);
  if (!app) {
    set.status = 404;
    return { error: "App tidak ditemukan atau bukan milik builder" };
  }
  if (!Array.isArray(body.items) || body.items.length === 0) {
    set.status = 400;
    return { error: "items wajib berupa array non-kosong" };
  }
  if (body.items.length > 200) {
    set.status = 400;
    return { error: "Batch maksimal 200 lisensi per request" };
  }

  const results: any[] = [];
  const errors: any[] = [];
  for (const item of body.items) {
    try {
      const r = await LicenseService.issueDirect({
        appId: app.id,
        customerEmail: item.customerEmail,
        grantDays: item.grantDays,
        maxSeats: item.maxSeats,
        platform: item.platform,
        grantCredits: item.grantCredits,
        features: item.features,
        creditDescription: "Penerbitan batch via S2S",
        actor: { type: "S2S", id: builder.id },
      });
      results.push({
        customerEmail: item.customerEmail,
        licenseKey: r.license.licenseKey,
        id: r.license.id,
      });
    } catch (err: any) {
      errors.push({ customerEmail: item.customerEmail, error: err?.message || "ISSUE_FAILED" });
    }
  }

  return {
    success: true,
    issued: results.length,
    failed: errors.length,
    licenses: results,
    errors,
  };
}

/**
 * Fase 6 — Cabut batch lisensi sekaligus.
 */
export async function handleS2SRevokeBatch({ builder, body }: any) {
  if (!Array.isArray(body.licenseKeys) || body.licenseKeys.length === 0) {
    return { success: false, error: "licenseKeys wajib berupa array non-kosong" };
  }
  const results: any[] = [];
  for (const licenseKey of body.licenseKeys.slice(0, 200)) {
    const owned = await ownedLicense(builder, licenseKey);
    if (!owned) {
      results.push({ licenseKey, revoked: false, error: "NOT_FOUND_OR_UNOWNED" });
      continue;
    }
    const r = await LicenseService.revoke({
      licenseId: owned.lic.id,
      actor: { type: "S2S", id: builder.id },
    });
    results.push({ licenseKey, revoked: !r.notFound, message: r.message });
  }
  return { success: true, revoked: results.filter((r) => r.revoked).length, results };
}
