import { beforeAll, afterAll, describe, test, expect, spyOn } from "bun:test";
import { eq, and } from "drizzle-orm";
import { db } from "../../db";
import {
  apps,
  builders,
  transactions,
  licenses,
  webhookEndpoints,
  webhookDeliveries,
  licenseLeases,
} from "../../db/schema";
import { WebhookService } from "../../services/notifications/webhooks";
import { LicenseService } from "../../services/licensing/license";
import { handleRefundTransaction } from "../../routes/panel/refund";
import { handleXenditDisbursementWebhook } from "../../routes/webhook/xendit";
import { XenditService } from "../../services/payments/xendit";
import { handleActivateLicense } from "../../routes/licensing/device/activate";
import { handleHeartbeat } from "../../routes/licensing/device/heartbeat";
import { setupTestAuth } from "../setup";
setupTestAuth();

const suffix = crypto.randomUUID();
let owner: typeof builders.$inferSelect;
let other: typeof builders.$inferSelect;
const appId = `audit_app_${suffix}`;
async function transaction(id: string, extra = {}) {
  const [tx] = await db
    .insert(transactions)
    .values({
      id,
      appId,
      builderId: owner.id,
      mode: "live",
      paymentProvider: "xendit",
      xenditExternalId: `ext_${id}`,
      customerEmail: "repeat@example.invalid",
      grossAmount: 100000,
      platformFee: 5000,
      netAmount: 95000,
      paymentStatus: "PAID",
      ...extra,
    })
    .returning();
  return tx!;
}
describe("Audit hardening against PostgreSQL", () => {
  beforeAll(async () => {
    [owner, other] = await db
      .insert(builders)
      .values([
        {
          name: "Audit owner",
          email: `audit-owner-${suffix}@example.invalid`,
          apiKey: `audit-owner-${suffix}`,
        },
        {
          name: "Audit other",
          email: `audit-other-${suffix}@example.invalid`,
          apiKey: `audit-other-${suffix}`,
        },
      ])
      .returning();
    await db.insert(apps).values({
      id: appId,
      slug: appId,
      name: "Audit",
      builderId: owner.id,
      mode: "live",
      targetPrice: 100000,
    });
  });
  afterAll(async () => {
    await db.delete(builders).where(eq(builders.id, owner.id));
    await db.delete(builders).where(eq(builders.id, other.id));
  });
  test("foreign endpoint deletion leaves endpoint and queued deliveries intact", async () => {
    const endpoint = await WebhookService.create(owner.id, {
      url: "https://hooks.example.com/audit",
    });
    const id = `audit_delivery_${suffix}`;
    await db.insert(webhookDeliveries).values({
      id,
      endpointId: endpoint.id,
      event: "license.issued",
      payload: {},
      nextRetryAt: new Date(),
    });
    expect(await WebhookService.delete(other.id, endpoint.id)).toBe(false);
    expect(
      await db.query.webhookDeliveries.findFirst({ where: eq(webhookDeliveries.id, id) })
    ).toBeDefined();
    expect(await WebhookService.delete(owner.id, endpoint.id)).toBe(true);
    expect(
      await db.query.webhookDeliveries.findFirst({ where: eq(webhookDeliveries.id, id) })
    ).toBeUndefined();
  });
  test("refund of an older purchase leaves the newer purchase active", async () => {
    const first = await transaction(`audit_first_${suffix}`, { mode: "sandbox" });
    const second = await transaction(`audit_second_${suffix}`);
    const issued = await Promise.all(
      [first, second].map(async (tx) => {
        const result = await LicenseService.issueDirect({ appId, customerEmail: tx.customerEmail });
        await db
          .update(licenses)
          .set({ transactionId: tx.id })
          .where(eq(licenses.id, result.license.id));
        return result.license;
      })
    );
    const result = await handleRefundTransaction({ params: { txId: first.id }, body: {}, set: {} });
    expect(result.success).toBe(true);
    expect(result.data?.revokedLicenseKey).toBe(issued[0].licenseKey);
    expect(
      (await db.query.licenses.findFirst({ where: eq(licenses.id, issued[0].id) }))?.status
    ).toBe("REVOKED");
    expect(
      (await db.query.licenses.findFirst({ where: eq(licenses.id, issued[1].id) }))?.status
    ).toBe("ACTIVE");
  });
  test("nested Xendit callback completes every batch member and ignores checkout references", async () => {
    const reference = `audit_payout_${suffix}`;
    const first = await transaction(`audit_batch1_${suffix}`, {
      disbursementStatus: "PROCESSING",
      disbursementExternalId: reference,
    });
    const second = await transaction(`audit_batch2_${suffix}`, {
      disbursementStatus: "PROCESSING",
      disbursementExternalId: reference,
    });
    const unrelated = await transaction(`audit_unrelated_${suffix}`, {
      disbursementStatus: "PROCESSING",
      xenditExternalId: reference,
    });
    const verify = spyOn(XenditService, "verifyWebhook").mockResolvedValue(true);
    try {
      await handleXenditDisbursementWebhook({
        headers: {},
        body: { data: { id: "provider-id", reference_id: reference, status: "SUCCEEDED" } },
        set: {},
      });
      for (const tx of [first, second])
        expect(
          (await db.query.transactions.findFirst({ where: eq(transactions.id, tx.id) }))
            ?.disbursementStatus
        ).toBe("COMPLETED");
      expect(
        (await db.query.transactions.findFirst({ where: eq(transactions.id, unrelated.id) }))
          ?.disbursementStatus
      ).toBe("PROCESSING");
    } finally {
      verify.mockRestore();
    }
  });
  test("late heartbeat cannot reclaim an expired seat allocated to another device", async () => {
    await db
      .update(apps)
      .set({
        deliveryConfig: {
          licenseKey: { enabled: true, floating: { enabled: true, leaseTtlSeconds: 300 } },
        },
      })
      .where(eq(apps.id, appId));
    const { license } = await LicenseService.issueDirect({
      appId,
      customerEmail: "floating@example.invalid",
      maxSeats: 1,
    });
    const request = new Request("http://localhost/audit");
    const first: any = await handleActivateLicense({
      body: { licenseKey: license.licenseKey, appId, hwid: "A" },
      request,
      set: {},
    });
    expect(first.success).toBe(true);
    await db
      .update(licenseLeases)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(licenseLeases.licenseId, license.id));
    const second: any = await handleActivateLicense({
      body: { licenseKey: license.licenseKey, appId, hwid: "B" },
      request,
      set: {},
    });
    expect(second.success).toBe(true);
    const set: any = {};
    const late = await handleHeartbeat({
      body: { licenseKey: license.licenseKey, appId, hwid: "A", leaseKey: first.data.leaseKey },
      request,
      set,
    });
    expect(late.success).toBe(false);
    expect(set.status).toBe(409);
    const leases = await db.query.licenseLeases.findMany({
      where: eq(licenseLeases.licenseId, license.id),
    });
    expect(leases.filter((l) => l.expiresAt > new Date())).toHaveLength(1);
  });
});
