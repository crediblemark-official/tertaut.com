import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { createHmac } from "crypto";
import { setupTestAuth } from "../setup";
import { db } from "../../db";
import { apps, builders, webhookDeliveries, webhookEndpoints } from "../../db/schema";
import { eq, and } from "drizzle-orm";
import { LicenseService } from "../../services/license";
import { WebhookService } from "../../services/webhooks";
import { generateAppApiKey } from "../../routes/apps/api-key";

setupTestAuth();

const BASE = "http://localhost:3000";
const suffix = () => `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

type Captured = { event: string; signature: string; body: string };
let receiver: any = null;
const captured: Captured[] = [];
let failNext = 0;

function verifySignature(secret: string, signatureHeader: string, rawBody: string): boolean {
  const expected = `hmac-sha256=${createHmac("sha256", secret).update(rawBody).digest("hex")}`;
  return signatureHeader === expected;
}

describe("Fase 3: Webhook lifecycle (outbox, HMAC signing, retry backoff)", () => {
  beforeAll(async () => {
    receiver = Bun.serve({
      port: 0,
      async fetch(req: Request) {
        const event = req.headers.get("x-tertaut-event") || "";
        const signature = req.headers.get("x-tertaut-signature") || "";
        const body = await req.text();
        captured.push({ event, signature, body });
        if (failNext > 0) {
          failNext--;
          return new Response("fail", { status: 503 });
        }
        return new Response("ok", { status: 200 });
      },
    });
  });

  afterAll(async () => {
    if (receiver?.port) {
      const portStr = `:${receiver.port}/`;
      const allEndpoints = await db.query.webhookEndpoints.findMany();
      for (const ep of allEndpoints) {
        if (ep.url.includes(portStr)) {
          await db.delete(webhookDeliveries).where(eq(webhookDeliveries.endpointId, ep.id));
          await db.delete(webhookEndpoints).where(eq(webhookEndpoints.id, ep.id));
        }
      }
    }
    receiver?.stop(true);
  });

  it("issue license memicu delivery webhook ber-tanda tangan HMAC yang valid", async () => {
    const email = `wh_${suffix()}@test.tertaut.com`;
    const [b] = await db.insert(builders).values({ name: "Webhook Builder", email, apiKey: generateAppApiKey("live") }).returning();
    const appId = `app_wh_${suffix()}`;
    await db.insert(apps).values({
      id: appId,
      builderId: b.id,
      name: "Webhook App",
      slug: `wh-${suffix()}`,
      mode: "sandbox",
      apiKey: generateAppApiKey("sandbox"),
      targetPrice: 0,
    });

    const secret = `whsec_${suffix()}`;
    const endpoint = await WebhookService.create(b.id, {
      url: `http://127.0.0.1:${receiver.port}/hooks/h1`,
      events: ["license.issued"],
      secret,
    });

    const before = captured.length;
    await LicenseService.issueDirect({ appId, customerEmail: `wh_cust_${suffix()}@test.com`, grantDays: 30, maxSeats: 3 });
    const sent = await WebhookService.dispatchDue();
    expect(sent).toBeGreaterThan(0);

    await new Promise((r) => setTimeout(r, 200));
    const got = captured.slice(before).find((c) => c.event === "license.issued");
    expect(got).toBeDefined();
    expect(got!.signature.startsWith("hmac-sha256=")).toBe(true);
    expect(verifySignature(secret, got!.signature, got!.body)).toBe(true);
    const payload = JSON.parse(got!.body);
    expect(payload.event).toBe("license.issued");
    expect(payload.data.licenseKey).toBeDefined();

    // Delivery tercatat SENT
    const delivery = await db.query.webhookDeliveries.findFirst({
      where: eq(webhookDeliveries.endpointId, endpoint.id),
      orderBy: (d, { desc }) => [desc(d.createdAt)],
    });
    expect(delivery?.status).toBe("SENT");

    // Rotasi secret: signature lama tidak boleh diverifikasi lagi
    const rotated = await WebhookService.rotateSecret(b.id, endpoint.id);
    expect(rotated?.secret).not.toBe(secret);
  });

  it("delivery gagal di-retry exponential backoff lalu sukses setelah endpoint pulih", async () => {
    const email = `whr_${suffix()}@test.tertaut.com`;
    const [b] = await db.insert(builders).values({ name: "Retry Builder", email, apiKey: generateAppApiKey("live") }).returning();
    const appId = `app_whr_${suffix()}`;
    await db.insert(apps).values({
      id: appId,
      builderId: b.id,
      name: "Retry App",
      slug: `whr-${suffix()}`,
      mode: "sandbox",
      apiKey: generateAppApiKey("sandbox"),
      targetPrice: 0,
    });

    failNext = 2; // dua delivery pertama gagal
    const endpoint = await WebhookService.create(b.id, {
      url: `http://127.0.0.1:${receiver.port}/hooks/retry`,
      events: ["license.revoked"],
      secret: "retry-secret",
    });

    const issued = await LicenseService.issueDirect({ appId, customerEmail: `whr_cust_${suffix()}@test.com`, grantDays: 30, maxSeats: 1 });
    await LicenseService.revoke({ licenseId: issued.license.id, actor: { type: "ADMIN" } });

    await WebhookService.dispatchDue();
    let delivery = await db.query.webhookDeliveries.findFirst({
      where: and(eq(webhookDeliveries.endpointId, endpoint.id), eq(webhookDeliveries.event, "license.revoked")),
    });
    expect(delivery).toBeDefined();
    expect(delivery!.status).toBe("PENDING");
    expect(delivery!.attempts).toBe(1);
    const nextRetry = delivery!.nextRetryAt;

    // Simulasikan jendela backoff lewat (nextRetryAt dimajukan ke masa lalu)
    await db
      .update(webhookDeliveries)
      .set({ nextRetryAt: new Date(Date.now() - 1000) })
      .where(eq(webhookDeliveries.id, delivery!.id));

    await WebhookService.dispatchDue();
    delivery = await db.query.webhookDeliveries.findFirst({ where: eq(webhookDeliveries.id, delivery!.id) });
    expect(delivery!.status).toBe("PENDING");
    expect(delivery!.attempts).toBe(2);
    expect(delivery!.nextRetryAt.getTime()).toBeGreaterThan(nextRetry.getTime());

    await db
      .update(webhookDeliveries)
      .set({ nextRetryAt: new Date(Date.now() - 1000) })
      .where(eq(webhookDeliveries.id, delivery!.id));

    await WebhookService.dispatchDue();
    delivery = await db.query.webhookDeliveries.findFirst({ where: eq(webhookDeliveries.id, delivery!.id) });
    expect(delivery!.status).toBe("SENT");
    expect(delivery!.attempts).toBe(3);
  });

  it("konsumsi kredit melebihi saldo memicu webhook credits.insufficient", async () => {
    const email = `wci_${suffix()}@test.tertaut.com`;
    const [b] = await db.insert(builders).values({ name: "CreditBuilder", email, apiKey: generateAppApiKey("live") }).returning();
    const appId = `app_wci_${suffix()}`;
    await db.insert(apps).values({
      id: appId,
      builderId: b.id,
      name: "Credit App",
      slug: `wci-${suffix()}`,
      mode: "sandbox",
      apiKey: generateAppApiKey("sandbox"),
      targetPrice: 0,
    });

    await WebhookService.create(b.id, {
      url: `http://127.0.0.1:${receiver.port}/hooks/credits`,
      events: ["credits.insufficient"],
      secret: "credit-secret",
    });

    const issued = await LicenseService.issueDirect({ appId, customerEmail: `wci_cust_${suffix()}@test.com`, grantDays: 30, maxSeats: 1, grantCredits: 0 });

    // Perlu device teraktivasi agar /credits/consume lolos authorizeLicense
    const actRes = await fetch(`${BASE}/api/v1/licensing/activate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ licenseKey: issued.license.licenseKey, appId, hwid: "wb-hw-1", deviceName: "Webhook Box" }),
    });
    expect(actRes.status).toBe(200);

    const before = captured.length;
    const res = await fetch(`${BASE}/api/v1/licensing/credits/consume`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ licenseKey: issued.license.licenseKey, hwid: "wb-hw-1", amount: 10, reason: "wh-overdraw" }),
    });
    expect(res.status).toBe(402);

    await WebhookService.dispatchDue();
    await new Promise((r) => setTimeout(r, 200));

    const got = captured.slice(before).find((c) => c.event === "credits.insufficient");
    expect(got).toBeDefined();
    const payload = JSON.parse(got!.body);
    expect(payload.event).toBe("credits.insufficient");
    expect(payload.data.licenseKey).toBe(issued.license.licenseKey);
    expect(payload.data.amount).toBe(10);
  });
});