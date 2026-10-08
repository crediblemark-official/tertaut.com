import { db } from "../../../db";
import { licenses, apps } from "../../../db/schema";
import { eq } from "drizzle-orm";
import { LicenseService } from "../../../services/licensing/license";
import {
  LicenseLeaseService,
  resolveFloatingConfig,
} from "../../../services/licensing/licenseLease";
import { enforceRateLimit } from "../../../services/security/rateLimiter";
import { getClientIp } from "../../../lib/ip";
import type { DeviceHeartbeatContext } from "./types";

export async function handleHeartbeat(ctx: DeviceHeartbeatContext) {
  const { body, set, request } = ctx;
  const { appId, licenseKey, hwid, leaseKey, deviceName } = body;

  const rl = enforceRateLimit(request, "licensing:heartbeat", 120, 60_000);
  if (!rl.allowed) {
    set.status = 429;
    return {
      success: false,
      error: `Terlalu banyak permintaan heartbeat. Coba lagi dalam ${rl.retryAfter} detik.`,
    };
  }

  if (!licenseKey || typeof licenseKey !== "string") {
    set.status = 400;
    return { success: false, error: "licenseKey wajib disertakan" };
  }

  const lic = await db.query.licenses.findFirst({
    where: eq(licenses.licenseKey, licenseKey.trim()),
  });

  if (!lic) {
    set.status = 404;
    return { success: false, error: "License key not found" };
  }

  if (appId && lic.appId !== appId) {
    set.status = 403;
    return { success: false, error: "App mismatch for this license key" };
  }

  if (lic.status !== "ACTIVE") {
    set.status = 403;
    return { success: false, error: `License is ${lic.status}` };
  }

  const now = new Date();
  if (await LicenseService.checkAndMarkExpired(lic)) {
    set.status = 403;
    return { success: false, error: "License has expired" };
  }

  const appRow = await db.query.apps.findFirst({ where: eq(apps.id, lic.appId) });
  const floating = resolveFloatingConfig(appRow);
  const ipAddress = getClientIp(request);

  if (floating.enabled) {
    const lease = await LicenseLeaseService.heartbeat(lic.id, hwid, leaseKey, {
      ipAddress,
      deviceName,
      ttlSeconds: floating.leaseTtlSeconds,
    });

    if (!lease) {
      set.status = 409;
      return {
        success: false,
        error:
          "Lease tidak ditemukan atau leaseKey tidak valid untuk perangkat ini. Jalankan aktivasi ulang.",
        reason: "LEASE_MISMATCH",
      };
    }

    await db.update(licenses).set({ lastValidatedAt: now }).where(eq(licenses.id, lic.id));

    const liveSeats = await LicenseLeaseService.countLive(lic.id);
    return {
      success: true,
      floating: true,
      leaseKey,
      leaseExpiresAt: lease.expiresAt.toISOString(),
      lastHeartbeatAt: lease.lastHeartbeatAt.toISOString(),
      seatsUsed: liveSeats,
      status: "ACTIVE",
    };
  }

  // Mode non-floating: heartbeat diterima sebagai keep-alive (tidak mengelola lease).
  await db.update(licenses).set({ lastValidatedAt: now }).where(eq(licenses.id, lic.id));

  return {
    success: true,
    floating: false,
    message: "Heartbeat diterima (lisensi non-floating, tidak ada lease yang dikelola).",
    status: "ACTIVE",
  };
}
