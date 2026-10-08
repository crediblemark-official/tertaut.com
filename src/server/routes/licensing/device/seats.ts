import { db } from "../../../db";
import { licenses, licenseActivations, licenseLeases, apps } from "../../../db/schema";
import { eq } from "drizzle-orm";
import { resolveFloatingConfig } from "../../../services/licensing/licenseLease";
import { resolveCurrentBuilder } from "../../apps/builder";
import { verifyOwnedLicense } from "../../../lib/ownership";
import type { DeviceListSeatsContext } from "./types";

export async function handleListSeats({ query, request, set }: DeviceListSeatsContext) {
  const { licenseKey } = query || {};
  if (!licenseKey || typeof licenseKey !== "string") {
    set.status = 400;
    return { success: false, error: "licenseKey wajib disertakan" };
  }

  const { builder, isAdmin } = request?.headers
    ? await resolveCurrentBuilder(request.headers)
    : !request
      ? { builder: null, isAdmin: true }
      : { builder: null, isAdmin: false };

  if (!isAdmin && !builder) {
    set.status = 401;
    return { success: false, error: "Unauthorized" };
  }

  // IDOR-3: Pastikan lisensi dimiliki oleh builder
  if (!isAdmin && builder) {
    const owned = await verifyOwnedLicense(builder.id, licenseKey, isAdmin);
    if ("error" in owned) {
      set.status = owned.status;
      return { success: false, error: owned.error };
    }
  }

  const lic = await db.query.licenses.findFirst({
    where: eq(licenses.licenseKey, licenseKey.trim()),
  });

  if (!lic) {
    set.status = 404;
    return { success: false, error: "License not found" };
  }

  const appRow = await db.query.apps.findFirst({ where: eq(apps.id, lic.appId) });
  const floating = resolveFloatingConfig(appRow);

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
  const liveLeaseCount = leases.filter((l) => l.expiresAt > now).length;

  const seats = activations.map((act) => {
    const lease = leases.find((l) => l.hwidHash === act.hwidHash);
    const alive = Boolean(lease && lease.expiresAt > now);
    return {
      hwidHash: act.hwidHash,
      deviceName: act.deviceName,
      ipAddress: act.ipAddress,
      lastValidatedAt: act.lastValidatedAt,
      createdAt: act.createdAt,
      leaseActive: floating.enabled ? alive : null,
      leaseExpiresAt: lease?.expiresAt || null,
      lastHeartbeatAt: lease?.lastHeartbeatAt || null,
    };
  });

  return {
    success: true,
    licenseKey: lic.licenseKey,
    appId: lic.appId,
    customerEmail: lic.customerEmail,
    status: lic.status,
    floating: floating.enabled,
    maxSeats: lic.maxSeats || 3,
    seatsUsed: floating.enabled ? liveLeaseCount : activations.length,
    leaseTtlSeconds: floating.enabled ? floating.leaseTtlSeconds : null,
    seats,
  };
}
