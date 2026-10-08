import { db } from "../../../db";
import { licenses, licenseActivations, licenseLeases, apps } from "../../../db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { LicenseService } from "../../../services/licensing/license";
import { LicenseTokenService } from "../../../services/licensing/licenseToken";
import { CreditService } from "../../../services/monetization/credits";
import { resolveFloatingConfig } from "../../../services/licensing/licenseLease";
import { enforceRateLimit } from "../../../services/security/rateLimiter";
import { isVersionOlder } from "../../../lib/semver";
import type { DeviceVerifyContext } from "./types";

export async function handleVerifyLicense({ body, set, request }: DeviceVerifyContext) {
  const { licenseKey, hwid, appVersion } = body;

  const rl = enforceRateLimit(request, "licensing:verify", 120, 60_000);
  if (!rl.allowed) {
    set.status = 429;
    return {
      valid: false,
      status: "RATE_LIMITED",
      message: `Terlalu banyak permintaan. Coba lagi dalam ${rl.retryAfter} detik.`,
    };
  }

  const lic = await db.query.licenses.findFirst({
    where: eq(licenses.licenseKey, licenseKey.trim()),
  });

  if (!lic) {
    set.status = 404;
    return { valid: false, status: "NOT_FOUND", message: "License key not found" };
  }

  if (lic.status !== "ACTIVE") {
    return { valid: false, status: lic.status, message: `License is ${lic.status}` };
  }

  const now = new Date();
  if (await LicenseService.checkAndMarkExpired(lic)) {
    return { valid: false, status: "EXPIRED", message: "License has expired" };
  }

  // Enforce version floor (Fase 1: min_version)
  if (lic.features && typeof lic.features.min_version === "string" && appVersion) {
    if (isVersionOlder(appVersion, lic.features.min_version)) {
      set.status = 403;
      return {
        valid: false,
        status: "APP_VERSION_TOO_OLD",
        reason: "APP_VERSION_TOO_OLD",
        message: `Versi aplikasi (${appVersion}) terlalu lama. Minimal versi yang didukung adalah ${lic.features.min_version}.`,
        minVersion: lic.features.min_version,
        currentVersion: appVersion,
        entitlements: lic.features || {},
      };
    }
  }

  if (hwid) {
    const lookupHashes = LicenseService.hwidLookupHashes(hwid);
    const activation = await db.query.licenseActivations.findFirst({
      where: and(
        eq(licenseActivations.licenseId, lic.id),
        inArray(licenseActivations.hwidHash, lookupHashes)
      ),
    });

    const mainBound = lic.hardwareId ? lookupHashes.includes(lic.hardwareId) : false;
    if (!activation && !mainBound) {
      return {
        valid: false,
        status: "DEVICE_NOT_ACTIVATED",
        message:
          "Perangkat ini belum teraktivasi untuk lisensi ini. Silakan aktivasi terlebih dahulu.",
      };
    }

    // Floating: perangkat harus memiliki lease yang masih hidup (rolling seat).
    const appRow = await db.query.apps.findFirst({ where: eq(apps.id, lic.appId) });
    if (resolveFloatingConfig(appRow).enabled) {
      const lease = await db.query.licenseLeases.findFirst({
        where: and(
          eq(licenseLeases.licenseId, lic.id),
          inArray(licenseLeases.hwidHash, lookupHashes)
        ),
      });
      if (!lease || lease.expiresAt < now) {
        return {
          valid: false,
          status: "LEASE_STALE",
          message:
            "Lease perangkat sudah lepas karena tidak mengirim heartbeat. Silakan aktivasi ulang.",
        };
      }
    }

    if (activation) {
      await db
        .update(licenseActivations)
        .set({ lastValidatedAt: now })
        .where(eq(licenseActivations.id, activation.id));
    }
  }

  await db.update(licenses).set({ lastValidatedAt: now }).where(eq(licenses.id, lic.id));

  // Hitung sisa hari offline grace dari token tertanda (jika tersedia)
  let gracePeriodRemainingDays: number | null = null;
  if (lic.offlineJwtGraceToken) {
    const decoded = LicenseTokenService.verify(lic.offlineJwtGraceToken);
    if (decoded.valid && decoded.claims?.exp) {
      gracePeriodRemainingDays = Math.max(
        0,
        Math.ceil((decoded.claims.exp * 1000 - now.getTime()) / 86_400_000)
      );
    }
  }

  const credits = await CreditService.getBalance(lic.id);

  return {
    valid: true,
    status: "ACTIVE",
    gracePeriodRemainingDays,
    credits,
    entitlements: lic.features || {},
    licenseVersion: lic.licenseVersion || 1,
  };
}
