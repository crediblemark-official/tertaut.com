import { db } from "../../../db";
import { licenses, licenseActivations, licenseLeases, apps } from "../../../db/schema";
import { eq } from "drizzle-orm";
import { LicenseService } from "../../../services/licensing/license";
import { AuditService } from "../../../services/security/audit";
import { WebhookService } from "../../../services/notifications/webhooks";
import { resolveCurrentBuilder } from "../../apps/builder";
import { verifyOwnedLicense } from "../../../lib/ownership";
import { getClientIp } from "../../../lib/ip";
import type { DeviceUnbindContext } from "./types";

export async function handleUnbindHardware({ body, set, request }: DeviceUnbindContext) {
  const { licenseKey } = body;

  if (!licenseKey || typeof licenseKey !== "string") {
    set.status = 400;
    return { error: "licenseKey wajib disertakan" };
  }

  const { builder, isAdmin } = request?.headers
    ? await resolveCurrentBuilder(request.headers)
    : !request
      ? { builder: null, isAdmin: true }
      : { builder: null, isAdmin: false };

  if (!isAdmin && !builder) {
    set.status = 401;
    return { error: "Unauthorized" };
  }

  // IDOR-3: Pastikan lisensi dimiliki oleh builder
  if (!isAdmin && builder) {
    const owned = await verifyOwnedLicense(builder.id, licenseKey, isAdmin);
    if ("error" in owned) {
      set.status = owned.status;
      return { error: owned.error };
    }
  }

  const lic = await db.query.licenses.findFirst({
    where: eq(licenses.licenseKey, licenseKey.trim()),
  });

  if (!lic) {
    set.status = 404;
    return { error: "License not found" };
  }

  // Hapus seluruh aktivasi perangkat + lease floating
  await db.delete(licenseActivations).where(eq(licenseActivations.licenseId, lic.id));
  await db.delete(licenseLeases).where(eq(licenseLeases.licenseId, lic.id));

  const [updated] = await db
    .update(licenses)
    .set({ hardwareId: null, updatedAt: new Date() })
    .where(eq(licenses.id, lic.id))
    .returning();

  const appRow = await db.query.apps.findFirst({ where: eq(apps.id, lic.appId) });
  const offlineGraceDays = appRow?.deliveryConfig?.licenseKey?.offlineGraceDays;
  await LicenseService.rotateOfflineToken(
    {
      id: lic.id,
      licenseKey: lic.licenseKey,
      appId: lic.appId,
      customerEmail: lic.customerEmail,
      maxSeats: lic.maxSeats || 3,
      features: lic.features || null,
      offlineJwtGraceToken: lic.offlineJwtGraceToken,
      hardwareId: null,
    },
    offlineGraceDays
  );

  const ipAddress = getClientIp(request);
  await AuditService.record("license.unbound", {
    licenseId: lic.id,
    licenseKey: lic.licenseKey,
    appId: lic.appId,
    actorType: "ADMIN",
    ipAddress,
  });
  await WebhookService.emit("license.unbound", {
    license: lic,
    actorType: "ADMIN",
    ipAddress,
    payload: { seatsReleased: true },
  });

  return {
    success: true,
    message: `Hardware binding & seluruh seat perangkat untuk ${licenseKey} berhasil di-reset.`,
    license: updated,
  };
}
