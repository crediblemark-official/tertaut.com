import { describe, it, expect, beforeEach, afterAll } from "bun:test";
import { setupTestAuth, authCookie } from "../setup";
import { app } from "../../index";
import { db } from "../../db";
import { apps, transactions, licenses, platformSettings, builders } from "../../db/schema";
import { eq } from "drizzle-orm";
import { XenditService } from "../../services/xendit";
import { getActivePaymentGateway } from "../../services/paymentGateway";

describe("Multi-Payment Gateway Integration (DANA & Xendit)", () => {
  setupTestAuth();

  let testAppId: string;
  let testBuilderId: string;

  beforeEach(async () => {
    // Reset active payment gateway setting
    await db
      .insert(platformSettings)
      .values({
        key: "active_payment_gateway",
        value: "dana",
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: platformSettings.key,
        set: { value: "dana", updatedAt: new Date() },
      });

    const builder = await db.query.builders.findFirst();
    testBuilderId = builder!.id;

    // Pastikan ada app sandbox untuk test
    let testApp = await db.query.apps.findFirst({
      where: eq(apps.slug, "fastmail-ai"),
    });

    if (!testApp) {
      const [newApp] = await db
        .insert(apps)
        .values({
          id: `app_test_${Date.now()}`,
          builderId: testBuilderId,
          apiKey: `tt_test_${Date.now()}`,
          name: "Test Multi PG App",
          slug: `test-multi-pg-${Date.now()}`,
          mode: "sandbox",
          targetPrice: 50000,
        })
        .returning();
      testApp = newApp;
    }
    testAppId = testApp.id;
  });

  it("should calculate MoR breakdown accurately (5% fee, 95% net)", () => {
    const breakdown = XenditService.calculateMorBreakdown(100000);
    expect(breakdown.grossAmount).toBe(100000);
    expect(breakdown.platformFee).toBe(5000);
    expect(breakdown.netAmount).toBe(95000);
  });

  it("should create mock Xendit order when in sandbox or forced mock", async () => {
    const order = await XenditService.createOrder({
      externalId: `tt_test_${Date.now()}`,
      amount: 49000,
      payerEmail: "tester@tertaut.com",
      description: "Test Xendit Order",
      forceMock: true,
      paymentRail: "qris",
    });

    expect(order.orderId).toContain("xnd_inv_");
    expect(order.checkoutUrl).toContain("checkout.xendit.co");
    expect(order.mock).toBe(true);
    expect(order.paymentRail).toBe("qris");
    expect(order.qrDataUrl).toBeDefined();
  });

  it("should create mock Xendit VA with valid bank prefix", async () => {
    const order = await XenditService.createOrder({
      externalId: `tt_test_va_${Date.now()}`,
      amount: 75000,
      payerEmail: "va_tester@tertaut.com",
      description: "Test Xendit VA Order",
      forceMock: true,
      paymentRail: "va",
      vaBank: "BCA",
    });

    expect(order.paymentRail).toBe("va");
    expect(order.vaBank).toBe("BCA");
    expect(order.paymentCode?.startsWith("3901")).toBe(true);
  });

  it("should update and retrieve active_payment_gateway from Super Admin panel settings", async () => {
    // 1. Cek default gateway
    const initialPg = await getActivePaymentGateway();
    expect(initialPg).toBe("dana");

    // 2. Set ke xendit lewat endpoint panel settings
    const updateRes = await app.handle(
      new Request("http://localhost:8081/api/v1/panel/settings", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          cookie: authCookie,
        },
        body: JSON.stringify({
          active_payment_gateway: "xendit",
          xendit_secret_key: "xnd_test_dummy_key",
          xendit_webhook_token: "test_wh_token_123",
        }),
      })
    );

    expect(updateRes.status).toBe(200);
    const updateJson = (await updateRes.json()) as any;
    expect(updateJson.success).toBe(true);
    expect(updateJson.settings.active_payment_gateway).toBe("xendit");
    expect(updateJson.settings.xendit_webhook_token).toBe("test_wh_token_123");

    // 3. Verifikasi helper getActivePaymentGateway membaca nilai baru
    const activePg = await getActivePaymentGateway();
    expect(activePg).toBe("xendit");

    // 4. Cek kredensial via XenditService
    const creds = await XenditService.getCredentials();
    expect(creds.secretKey).toBe("xnd_test_dummy_key");
    expect(creds.webhookToken).toBe("test_wh_token_123");
  });

  it("should route checkout session to Xendit when active_payment_gateway is xendit", async () => {
    // Set active PG ke xendit
    await db
      .update(platformSettings)
      .set({ value: "xendit", updatedAt: new Date() })
      .where(eq(platformSettings.key, "active_payment_gateway"));

    const res = await app.handle(
      new Request("http://localhost:8081/api/v1/checkout/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appId: testAppId,
          customerEmail: "buyer-xendit@test.com",
          paymentRail: "qris",
        }),
      })
    );

    expect(res.status).toBe(200);
    const json = (await res.json()) as any;
    expect(json.success).toBe(true);
    expect(json.paymentGateway).toBe("xendit");
    expect(json.message).toContain("Xendit");

    // Verifikasi transaksi tercatat di database dengan provider xendit
    const tx = await db.query.transactions.findFirst({
      where: eq(transactions.id, json.transactionId),
    });
    expect(tx).toBeDefined();
    expect(tx?.paymentProvider).toBe("xendit");
    expect(tx?.customerEmail).toBe("buyer-xendit@test.com");
  });

  it("should process Xendit webhook callback and fulfill license issuance", async () => {
    // Buat transaksi pending Xendit
    const txId = `tx_xnd_test_${Date.now()}`;
    const extId = `tt_xnd_ext_${Date.now()}`;
    const invId = `xnd_inv_${Date.now()}`;

    await db.insert(transactions).values({
      id: txId,
      appId: testAppId,
      builderId: testBuilderId,
      paymentProvider: "xendit",
      providerReferenceId: invId,
      xenditInvoiceId: invId,
      xenditExternalId: extId,
      customerEmail: "xendit-webhook-test@tertaut.com",
      grossAmount: 49000,
      platformFee: 2450,
      netAmount: 46550,
      paymentChannel: "XENDIT_QRIS",
      paymentStatus: "PENDING",
      disbursementStatus: "PENDING",
      grantDays: 365,
      grantCredits: 100,
    });

    // Kirim webhook Xendit PAID
    const whRes = await app.handle(
      new Request("http://localhost:8081/api/v1/webhook/xendit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-callback-token": "test_wh_token_123",
        },
        body: JSON.stringify({
          id: invId,
          external_id: extId,
          status: "PAID",
          payment_channel: "QRIS",
        }),
      })
    );

    expect(whRes.status).toBe(200);
    const whJson = (await whRes.json()) as any;
    expect(whJson.success).toBe(true);

    // Verifikasi status transaksi berubah jadi PAID
    const updatedTx = await db.query.transactions.findFirst({
      where: eq(transactions.id, txId),
    });
    expect(updatedTx?.paymentStatus).toBe("PAID");

    // Verifikasi lisensi terbit
    const issuedLicense = await db.query.licenses.findFirst({
      where: eq(licenses.transactionId, txId),
    });
    expect(issuedLicense).toBeDefined();
    expect(issuedLicense?.customerEmail).toBe("xendit-webhook-test@tertaut.com");
    expect(issuedLicense?.status).toBe("ACTIVE");
  });

  it("should process Xendit v3 Payments API (payment.capture) webhook event", async () => {
    const txId = `tx_v3_${Date.now()}`;
    const extId = `tt_v3_${Date.now()}`;

    await db.insert(transactions).values({
      id: txId,
      appId: testAppId,
      builderId: testBuilderId,
      paymentProvider: "xendit",
      customerEmail: "v3-webhook-test@tertaut.com",
      grossAmount: 75000,
      platformFee: 3750,
      netAmount: 71250,
      paymentChannel: "QRIS",
      paymentStatus: "PENDING",
      disbursementStatus: "PENDING",
      grantDays: 30,
      grantCredits: 0,
      mockOrder: false,
      xenditExternalId: extId,
    });

    const whRes = await app.handle(
      new Request("http://localhost/webhook/xendit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-callback-token": "test_wh_token_123",
        },
        body: JSON.stringify({
          created: new Date().toISOString(),
          business_id: "biz_123",
          event: "payment.capture",
          api_version: "v3",
          data: {
            payment_id: "py_test_123",
            business_id: "biz_123",
            reference_id: extId,
            status: "SUCCEEDED",
            request_amount: 75000,
            channel_code: "QRIS",
          },
        }),
      })
    );

    expect(whRes.status).toBe(200);
    const whJson = (await whRes.json()) as any;
    expect(whJson.success).toBe(true);

    const updatedTx = await db.query.transactions.findFirst({
      where: eq(transactions.id, txId),
    });
    expect(updatedTx?.paymentStatus).toBe("PAID");
  });

  afterAll(async () => {
    await db
      .insert(platformSettings)
      .values({
        key: "active_payment_gateway",
        value: "dana",
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: platformSettings.key,
        set: { value: "dana", updatedAt: new Date() },
      });
  });
});
