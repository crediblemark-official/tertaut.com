import { and, eq, lt } from "drizzle-orm";
import { db } from "../db";
import { licenses } from "../db/schema";
import { AuditService } from "../services/security/audit";
import { WebhookService } from "../services/notifications/webhooks";
import { LicenseLeaseService } from "../services/licensing/licenseLease";

export async function expireLicenses(): Promise<void> {
  try {
    const now = new Date();
    const expired = await db
      .update(licenses)
      .set({ status: "EXPIRED", updatedAt: now })
      .where(and(eq(licenses.status, "ACTIVE"), lt(licenses.expiresAt, now)))
      .returning({
        id: licenses.id,
        licenseKey: licenses.licenseKey,
        appId: licenses.appId,
        customerEmail: licenses.customerEmail,
        status: licenses.status,
      });
    if (expired.length > 0) {
      console.log(`[Expiry] ${expired.length} license(s) marked EXPIRED.`);
    }
    // Audit trail + webhook license.expired (best-effort, di luar transaction).
    for (const lic of expired) {
      await AuditService.record(
        "license.expired",
        { licenseId: lic.id, licenseKey: lic.licenseKey, appId: lic.appId, actorType: "SYSTEM" },
        { expiresAt: now.toISOString() }
      );
      await WebhookService.emit("license.expired", {
        license: lic as any,
        actorType: "SYSTEM",
        payload: { expiresAt: now.toISOString() },
      });
    }
  } catch (err: any) {
    console.error("[Expiry] failed:", err?.message || err);
  }
}

/** Fase 2: lepas lease floating yang tidak pernah heartbeat sampai TTL habis. */
export async function expireLeases(): Promise<void> {
  try {
    const released = await LicenseLeaseService.deleteExpired();
    if (released > 0) {
      console.log(`[Lease] ${released} floating lease(s) expired & released.`);
    }
  } catch (err: any) {
    console.error("[Lease] failed:", err?.message || err);
  }
}

/** Fase 3: deliverer outbox webhook (retry exponential backoff). */
export async function dispatchWebhooks(): Promise<void> {
  try {
    const sent = await WebhookService.dispatchDue();
    if (sent > 0) {
      console.log(`[Webhook] ${sent} delivery(ies) diproses.`);
    }
  } catch (err: any) {
    console.error("[Webhook] dispatcher failed:", err?.message || err);
  }
}

export interface ScheduledTasksController {
  stop: () => void;
}

/** Menjalankan background recurring tasks (expiry lisensi, floating leases, outbox webhook) */
export function startScheduledTasks(): ScheduledTasksController {
  // Pemicu awal saat startup
  expireLicenses();
  const licenseInterval = setInterval(expireLicenses, 10 * 60 * 1000); // 10 menit

  expireLeases();
  const leaseInterval = setInterval(expireLeases, 2 * 60 * 1000); // 2 menit

  dispatchWebhooks();
  const webhookInterval = setInterval(dispatchWebhooks, 60 * 1000); // 1 menit

  return {
    stop: () => {
      clearInterval(licenseInterval);
      clearInterval(leaseInterval);
      clearInterval(webhookInterval);
    },
  };
}
