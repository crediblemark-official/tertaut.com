import { db } from "../../../db";
import { licenses, licenseLeases, apps } from "../../../db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { LicenseService } from "../../../services/licensing/license";
import { resolveFloatingConfig } from "../../../services/licensing/licenseLease";
import { enforceRateLimit } from "../../../services/security/rateLimiter";
import { isVersionOlder } from "../../../lib/semver";
import type { DeviceValidateContext } from "./types";

export async function handleValidateLicense({ body, set, request }: DeviceValidateContext) {
  const { licenseKey, appId, hardwareId, appVersion, platform = "general" } = body;

  const rl = enforceRateLimit(request, "licensing:validate", 120, 60_000);
  if (!rl.allowed) {
    set.status = 429;
    return { valid: false, reason: "RATE_LIMITED" };
  }

  const lic = await db.query.licenses.findFirst({
    where: eq(licenses.licenseKey, licenseKey.trim()),
  });

  if (!lic) {
    set.status = 404;
    return { valid: false, reason: "LICENSE_NOT_FOUND" };
  }

  if (lic.appId !== appId) {
    set.status = 403;
    return { valid: false, reason: "APP_MISMATCH" };
  }

  if (lic.status !== "ACTIVE") {
    return { valid: false, reason: `LICENSE_${lic.status}` };
  }

  // Enforce platform bila lisensi dikunci ke platform tertentu.
  if (lic.platform && lic.platform !== "general" && platform && platform !== lic.platform) {
    return {
      valid: false,
      reason: "PLATFORM_MISMATCH",
      message: `Lisensi ini hanya berlaku untuk platform ${lic.platform}.`,
    };
  }

  const now = new Date();
  if (await LicenseService.checkAndMarkExpired(lic)) {
    return { valid: false, reason: "LICENSE_EXPIRED" };
  }

  // Enforce version floor (Fase 1: min_version)
  if (lic.features && typeof lic.features.min_version === "string" && appVersion) {
    if (isVersionOlder(appVersion, lic.features.min_version)) {
      set.status = 403;
      return {
        valid: false,
        reason: "APP_VERSION_TOO_OLD",
        message: `Versi aplikasi (${appVersion}) terlalu lama. Minimal versi yang didukung adalah ${lic.features.min_version}.`,
        minVersion: lic.features.min_version,
        currentVersion: appVersion,
        entitlements: lic.features || {},
      };
    }
  }

  // Validasi tidak boleh mengikat hardware secara implisit — binding wajib
  // melalui /activate agar kuota seat (N_active <= N_max) ditegakkan.
  if (lic.hardwareId && !hardwareId) {
    return {
      valid: false,
      reason: "HARDWARE_ID_REQUIRED",
      message:
        "Lisensi ini sudah terikat dengan perangkat hardware. Sertakan hardwareId untuk validasi.",
    };
  }

  if (hardwareId) {
    const lookupHashes = LicenseService.hwidLookupHashes(hardwareId);
    if (lic.hardwareId && !lookupHashes.includes(lic.hardwareId)) {
      return {
        valid: false,
        reason: "HARDWARE_MISMATCH",
        message: "Lisensi ini sudah terikat dengan perangkat hardware lain.",
      };
    }
    if (!lic.hardwareId) {
      return {
        valid: false,
        reason: "DEVICE_NOT_ACTIVATED",
        message: "Perangkat belum diaktivasi. Jalankan /activate terlebih dahulu.",
      };
    }

    const appRowF = await db.query.apps.findFirst({ where: eq(apps.id, lic.appId) });
    if (resolveFloatingConfig(appRowF).enabled) {
      const lease = await db.query.licenseLeases.findFirst({
        where: and(
          eq(licenseLeases.licenseId, lic.id),
          inArray(licenseLeases.hwidHash, lookupHashes)
        ),
      });
      if (!lease || lease.expiresAt < now) {
        return {
          valid: false,
          reason: "LEASE_STALE",
          message:
            "Lease perangkat sudah lepas karena tidak mengirim heartbeat. Silakan aktivasi ulang.",
        };
      }
    }
  }

  await db.update(licenses).set({ lastValidatedAt: now }).where(eq(licenses.id, lic.id));

  // Fase 5: rotate offline token (denylist jti lama, terbitkan yang baru).
  const appRowV = await db.query.apps.findFirst({ where: eq(apps.id, lic.appId) });
  const offlineGraceDays = appRowV?.deliveryConfig?.licenseKey?.offlineGraceDays;
  const offlineToken = await LicenseService.rotateOfflineToken(
    {
      id: lic.id,
      licenseKey: lic.licenseKey,
      appId: lic.appId,
      customerEmail: lic.customerEmail,
      maxSeats: lic.maxSeats || 3,
      features: lic.features || null,
      offlineJwtGraceToken: lic.offlineJwtGraceToken,
      hardwareId: lic.hardwareId || null,
    },
    offlineGraceDays
  );

  return {
    valid: true,
    licenseKey: lic.licenseKey,
    status: "ACTIVE",
    expiresAt: lic.expiresAt?.toISOString() || null,
    offlineGraceToken: offlineToken,
    entitlements: lic.features || {},
    licenseVersion: lic.licenseVersion || 1,
  };
}
