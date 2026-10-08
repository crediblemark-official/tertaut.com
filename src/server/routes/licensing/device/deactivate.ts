import { db } from "../../../db";
import { licenses, licenseActivations } from "../../../db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { LicenseService } from "../../../services/licensing/license";
import { LicenseLeaseService } from "../../../services/licensing/licenseLease";
import { AuditService } from "../../../services/security/audit";
import { WebhookService } from "../../../services/notifications/webhooks";
import { enforceRateLimit } from "../../../services/security/rateLimiter";
import { getClientIp } from "../../../lib/ip";
import type { DeviceDeactivateContext } from "./types";

export async function handleDeactivateLicense({ body, set, request }: DeviceDeactivateContext) {
  const { licenseKey, hwid } = body;

  const rl = enforceRateLimit(request, "licensing:deactivate", 30, 60_000);
  if (!rl.allowed) {
    set.status = 429;
    return {
      success: false,
      error: `Terlalu banyak permintaan. Coba lagi dalam ${rl.retryAfter} detik.`,
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

  const lookupHashes = LicenseService.hwidLookupHashes(hwid);

  // Hapus seat aktivasi perangkat (mendukung hash salted maupun legacy)
  await db
    .delete(licenseActivations)
    .where(
      and(
        eq(licenseActivations.licenseId, lic.id),
        inArray(licenseActivations.hwidHash, lookupHashes)
      )
    );

  // Floating: lepaskan lease seat (rolling seat).
  await LicenseLeaseService.releaseSeat(lic.id, hwid);

  // Jika hardwareId utama sama dengan hwidHash yang di-deactivate, bersihkan
  if (lic.hardwareId && lookupHashes.includes(lic.hardwareId)) {
    const remainingAct = await db.query.licenseActivations.findFirst({
      where: eq(licenseActivations.licenseId, lic.id),
    });

    await db
      .update(licenses)
      .set({
        hardwareId: remainingAct ? remainingAct.hwidHash : null,
        updatedAt: new Date(),
      })
      .where(eq(licenses.id, lic.id));
  }

  const ipAddress = getClientIp(request);
  await AuditService.record("license.deactivated", {
    licenseId: lic.id,
    licenseKey: lic.licenseKey,
    appId: lic.appId,
    actorType: "CLIENT",
    actorId: hwid,
    ipAddress,
  });
  await WebhookService.emit("license.deactivated", {
    license: lic,
    actorType: "CLIENT",
    actorId: hwid,
    ipAddress,
    payload: { hwid },
  });

  return {
    success: true,
    message: "Device seat released successfully",
  };
}
