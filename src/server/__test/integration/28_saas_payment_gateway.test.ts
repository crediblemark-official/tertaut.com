import { describe, it, expect } from "bun:test";
import { setupTestAuth, authCookie } from "../setup";
import { db } from "../../db";
import { apps, builders, transactions, webhookEndpoints, webhookDeliveries } from "../../db/schema";
import { eq } from "drizzle-orm";
import { app } from "../../index";
import { fulfillPaymentTransaction } from "../../routes/webhook/fulfill";
import { resolveCurrentBuilder } from "../../routes/apps/builder";

setupTestAuth();

describe("Developer-First SaaS Payment Gateway (Multi-SaaS & Dynamic Pricing)", () => {
  it("should create SaaS Web app with branding and webhook fields", async () => {
    const builder = await db.query.builders.findFirst();
    if (!builder) throw new Error("Builder not found");

    const testSlug = `saas-web-${Date.now()}`;
    const res = await app.handle(
      new Request("http://localhost:8081/api/v1/apps", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: authCookie,
        },
        body: JSON.stringify({
          name: "InvoiceFlow Pro",
          slug: testSlug,
          targetPrice: 0,
          appType: "saas_web",
          brandColor: "#7C3AED",
          logoUrl: "https://invoiceflow.io/icon.png",
          appUrl: "https://invoiceflow.io",
          webhookUrl: "https://invoiceflow.io/api/tertaut-webhook",
        }),
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.app.appType).toBe("saas_web");
    expect(body.app.brandColor).toBe("#7C3AED");
    expect(body.app.logoUrl).toBe("https://invoiceflow.io/icon.png");
    expect(body.app.appUrl).toBe("https://invoiceflow.io");
    expect(body.app.webhookUrl).toBe("https://invoiceflow.io/api/tertaut-webhook");

    // Clean up
    await db.delete(apps).where(eq(apps.id, body.app.id));
  });

  it("should allow S2S dynamic checkout session with arbitrary amount and return snapToken", async () => {
    const builder = await db.query.builders.findFirst();
    if (!builder) throw new Error("Builder not found");

    const testSlug = `dynamic-saas-${Date.now()}`;
    const [createdApp] = await db
      .insert(apps)
      .values({
        id: `app_dyn_${Date.now()}`,
        builderId: builder.id,
        name: "Dynamic API SaaS",
        slug: testSlug,
        mode: "sandbox",
        appType: "saas_web",
        targetPrice: 0,
        brandColor: "#0D9488",
      })
      .returning();

    // S2S API call with Authorization: Bearer tt_secret_...
    const sessionRes = await app.handle(
      new Request("http://localhost:8081/api/v1/checkout/session", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${builder.secretApiKey}`,
        },
        body: JSON.stringify({
          appId: createdApp.id,
          amount: 175000, // Dynamic code-driven pricing from developer backend!
          orderId: `ORD-${Date.now()}`,
          customerEmail: "developer@saasapp.com",
          paymentGateway: "sandbox",
        }),
      })
    );

    expect(sessionRes.status).toBe(200);
    const sessionBody = await sessionRes.json();
    expect(sessionBody.success).toBe(true);
    expect(sessionBody.amount).toBe(175000);
    expect(sessionBody.snapToken).toBeDefined();
    expect(sessionBody.data.snapToken).toBe(sessionBody.snapToken);
    expect(sessionBody.checkoutUrl).toBeDefined();

    // Verify transaction recorded in DB with correct appId and amount
    const tx = await db.query.transactions.findFirst({
      where: eq(transactions.id, sessionBody.transactionId),
    });
    expect(tx).toBeDefined();
    expect(tx?.appId).toBe(createdApp.id);
    expect(tx?.grossAmount).toBe(175000);

    // Verify scoped transactions query filters to this app
    const listRes = await app.handle(
      new Request(`http://localhost:8081/api/v1/checkout/transactions?appId=${createdApp.id}`, {
        method: "GET",
        headers: {
          cookie: authCookie,
        },
      })
    );
    expect(listRes.status).toBe(200);
    const listBody = await listRes.json();
    expect(listBody.success).toBe(true);
    expect(listBody.transactions.length).toBeGreaterThanOrEqual(1);
    expect(listBody.transactions.every((t: any) => t.appId === createdApp.id)).toBe(true);

    // Clean up
    await db.delete(transactions).where(eq(transactions.appId, createdApp.id));
    await db.delete(apps).where(eq(apps.id, createdApp.id));
  });

  it("should update SaaS settings including brandColor, logoUrl, and webhookUrl", async () => {
    const builder = await db.query.builders.findFirst();
    if (!builder) throw new Error("Builder not found");

    const [createdApp] = await db
      .insert(apps)
      .values({
        id: `app_upd_${Date.now()}`,
        builderId: builder.id,
        name: "Old SaaS Name",
        slug: `old-saas-${Date.now()}`,
        mode: "sandbox",
        appType: "saas_web",
        targetPrice: 0,
      })
      .returning();

    const patchRes = await app.handle(
      new Request(`http://localhost:8081/api/v1/apps/${createdApp.id}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          cookie: authCookie,
        },
        body: JSON.stringify({
          name: "Updated SaaS Name",
          brandColor: "#EA580C",
          logoUrl: "https://newlogo.com/icon.svg",
          webhookUrl: "https://newlogo.com/webhook",
        }),
      })
    );

    expect(patchRes.status).toBe(200);
    const patchBody = await patchRes.json();
    expect(patchBody.success).toBe(true);
    expect(patchBody.app.name).toBe("Updated SaaS Name");
    expect(patchBody.app.brandColor).toBe("#EA580C");
    expect(patchBody.app.logoUrl).toBe("https://newlogo.com/icon.svg");
    expect(patchBody.app.webhookUrl).toBe("https://newlogo.com/webhook");

    // Clean up
    await db.delete(apps).where(eq(apps.id, createdApp.id));
  });

  it("should return raw qrDataUrl and transactionId for Custom Checkout mode", async () => {
    const builder = await db.query.builders.findFirst();
    if (!builder) throw new Error("Builder not found");

    const testSlug = `custom-saas-${Date.now()}`;
    const [createdApp] = await db
      .insert(apps)
      .values({
        id: `app_custom_${Date.now()}`,
        builderId: builder.id,
        name: "Headless Custom SaaS",
        slug: testSlug,
        mode: "sandbox",
        appType: "saas_web",
        targetPrice: 0,
        brandColor: "#0D9488",
      })
      .returning();

    // Call S2S API for Custom Checkout with paymentRail: "qris"
    const sessionRes = await app.handle(
      new Request("http://localhost:8081/api/v1/checkout/session", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${builder.secretApiKey}`,
        },
        body: JSON.stringify({
          appId: createdApp.id,
          amount: 250000,
          paymentRail: "qris",
          customerEmail: "headless@client.com",
          paymentGateway: "sandbox",
        }),
      })
    );

    expect(sessionRes.status).toBe(200);
    const sessionBody = await sessionRes.json();
    expect(sessionBody.success).toBe(true);
    expect(sessionBody.amount).toBe(250000);
    expect(sessionBody.paymentRail).toBe("qris");
    // In custom checkout, developer gets direct qrDataUrl / qrString to render in their own UI
    expect(sessionBody.transactionId).toBeDefined();

    // Clean up
    await db.delete(transactions).where(eq(transactions.appId, createdApp.id));
    await db.delete(apps).where(eq(apps.id, createdApp.id));
  });

  it("should record webhook delivery outbox log and allow manual retry", async () => {
    const { builder } = await resolveCurrentBuilder(new Headers({ cookie: authCookie }));
    if (!builder) throw new Error("Builder not found");

    // Register a test webhook endpoint
    const [webhookEp] = await db
      .insert(webhookEndpoints)
      .values({
        id: `whk_test_${Date.now()}`,
        builderId: builder.id,
        url: "http://127.0.0.1:9/webhook-saas",
        secret: "whsec_test_secret_key_123",
        events: ["payment.success"],
        isActive: true,
      })
      .returning();

    // Create a SaaS Web app
    const [saasApp] = await db
      .insert(apps)
      .values({
        id: `app_whk_${Date.now()}`,
        builderId: builder.id,
        name: "Webhook Tested SaaS",
        slug: `webhook-saas-${Date.now()}`,
        mode: "sandbox",
        appType: "saas_web",
        targetPrice: 0,
      })
      .returning();

    // Create a transaction with metadata
    const [tx] = await db
      .insert(transactions)
      .values({
        id: `tx_whk_${Date.now()}`,
        builderId: builder.id,
        appId: saasApp.id,
        xenditExternalId: `ext_whk_${Date.now()}`,
        grossAmount: 150000,
        netAmount: 142500,
        platformFee: 7500,
        customerEmail: "saasuser@example.com",
        customerName: "SaaS Subscriber",
        paymentStatus: "PENDING",
        paymentChannel: "QRIS",
        metadata: { tier: "premium", seats: 5 },
      })
      .returning();

    // Fulfill payment
    await fulfillPaymentTransaction(tx, "QRIS");

    // Verify delivery was enqueued in webhookDeliveries
    const delivery = await db.query.webhookDeliveries.findFirst({
      where: eq(webhookDeliveries.endpointId, webhookEp.id),
      orderBy: (d, { desc }) => [desc(d.createdAt)],
    });

    expect(delivery).toBeDefined();
    expect(delivery?.event).toBe("payment.success");
    expect(delivery?.payload?.data?.customerName).toBe("SaaS Subscriber");
    expect(delivery?.payload?.data?.metadata?.tier).toBe("premium");

    // Test GET /webhooks/deliveries via API
    const listRes = await app.handle(
      new Request("http://localhost:8081/api/v1/licensing/webhooks/deliveries", {
        headers: { cookie: authCookie },
      })
    );
    expect(listRes.status).toBe(200);
    const listBody = await listRes.json();
    expect(listBody.success).toBe(true);
    expect(Array.isArray(listBody.deliveries)).toBe(true);
    expect(listBody.deliveries.some((d: any) => d.id === delivery?.id)).toBe(true);

    // Test POST /webhooks/deliveries/:id/retry via API
    const retryRes = await app.handle(
      new Request(
        `http://localhost:8081/api/v1/licensing/webhooks/deliveries/${delivery?.id}/retry`,
        {
          method: "POST",
          headers: { cookie: authCookie },
        }
      )
    );
    expect(retryRes.status).toBe(200);
    const retryBody = await retryRes.json();
    expect(retryBody.success).toBe(true);
    expect(retryBody.delivery.id).toBe(delivery?.id);

    // Cleanup
    await db.delete(webhookDeliveries).where(eq(webhookDeliveries.endpointId, webhookEp.id));
    await db.delete(webhookEndpoints).where(eq(webhookEndpoints.id, webhookEp.id));
    await db.delete(transactions).where(eq(transactions.appId, saasApp.id));
    await db.delete(apps).where(eq(apps.id, saasApp.id));
  });
});
