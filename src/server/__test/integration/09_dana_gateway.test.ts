import { describe, it, expect } from "bun:test";
import { setupTestAuth } from "../setup";
import { DanaService } from "../../services/dana";
import { db } from "../../db";
import { apps, licenses, transactions } from "../../db/schema";
import { eq } from "drizzle-orm";

setupTestAuth();

async function createSandboxTestApp(): Promise<{ id: string; slug: string }> {
  const builder = await db.query.builders.findFirst();
  if (!builder) throw new Error("No builder found — jalankan seed/auto-seed dulu");

  const testAppId = `app_sandbox_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`;
  const testSlug = `sandbox-test-${Math.random().toString(36).substring(2, 8)}`;

  await db.insert(apps).values({
    id: testAppId,
    builderId: builder.id,
    name: "Sandbox E2E Test App",
    slug: testSlug,
    mode: "sandbox",
    targetPrice: 50000,
  });

  return { id: testAppId, slug: testSlug };
}

describe("DANA Enterprise Payment Gateway & Multi-PG Integration", () => {
  it("should calculate exactly 5% platform fee and 95% net payout for DANA MoR", () => {
    const gross = 100000;
    const { grossAmount, platformFee, netAmount } = DanaService.calculateMorBreakdown(gross);

    expect(grossAmount).toBe(100000);
    expect(platformFee).toBe(5000); // 5%
    expect(netAmount).toBe(95000); // 95%
    expect(grossAmount).toBe(platformFee + netAmount);
  });

  it("should create DANA order with mock response in sandbox mode", async () => {
    const externalId = `dana_ext_${Date.now()}`;
    const order = await DanaService.createOrder({
      externalId,
      amount: 75000,
      payerEmail: "buyer_dana@test.local",
      description: "Lisensi Test DANA",
      forceMock: true,
    });

    expect(order.externalId).toBe(externalId);
    expect(order.amount).toBe(75000);
    expect(order.checkoutUrl).toContain("checkout/dana/finish");
    expect(order.merchantName).toContain("DANA");
  });

  it("should create checkout session using DANA when paymentGateway='dana'", async () => {
    let existingApp = await db.query.apps.findFirst({
      where: eq(apps.mode, "sandbox"),
    });
    let tempAppCreated = false;
    if (!existingApp) {
      existingApp = (await createSandboxTestApp()) as any;
      tempAppCreated = true;
    }
    if (!existingApp) return;

    const email = `dana_checkout_${Date.now()}@test.local`;
    const res = await fetch("http://localhost:3000/api/v1/checkout/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        appId: existingApp.id,
        amount: 80000,
        customerEmail: email,
        paymentGateway: "dana",
      }),
    });

    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.success).toBe(true);
    expect(body.paymentGateway).toBe("dana");
    expect(
      body.checkoutUrl.includes("checkout/dana/finish") ||
      body.checkoutUrl.includes("sandbox.dana.id")
    ).toBe(true);

    const tx = await db.query.transactions.findFirst({
      where: eq(transactions.id, body.transactionId),
    });
    expect(tx).toBeDefined();
    expect(tx?.paymentProvider).toBe("dana");
    expect(tx?.grossAmount).toBe(80000);

    // Clean up
    await db.delete(transactions).where(eq(transactions.id, body.transactionId));
    if (tempAppCreated && existingApp) {
      await db.delete(apps).where(eq(apps.id, existingApp.id));
    }
  });

  it("should process DANA Finish Payment Webhook and issue license with idempotency", async () => {
    const existingApp = await db.query.apps.findFirst();
    if (!existingApp) return;

    const txId = `tx_dana_test_${Date.now()}`;
    const extId = `tt_dana_${Date.now()}`;
    const custEmail = `customer_dana_${Date.now()}@test.local`;

    await db.insert(transactions).values({
      id: txId,
      appId: existingApp.id,
      builderId: existingApp.builderId,
      paymentProvider: "dana",
      providerReferenceId: extId,
      xenditInvoiceId: extId,
      xenditExternalId: extId,
      xenditInvoiceUrl: `https://checkout.dana.id/mock/${extId}`,
      customerEmail: custEmail,
      grossAmount: 50000,
      platformFee: 2500,
      netAmount: 47500,
      paymentStatus: "PENDING",
      disbursementStatus: "PENDING",
      grantDays: 30,
    });

    // 1. First webhook call: harus berhasil dan terbitkan lisensi
    const webhookRes1 = await fetch("http://localhost:3000/webhook/dana/finish-payment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        merchantTransId: extId,
        orderStatus: "SUCCESS",
        orderAmount: { currency: "IDR", value: "50000" },
        paymentChannel: "DANA_WALLET",
      }),
    });

    expect(webhookRes1.status).toBe(200);
    const resData1: any = await webhookRes1.json();
    expect(resData1.status).toBe("success");
    expect(resData1.licenseKey).toMatch(/^TT-/);

    // Verifikasi database: status PAID
    const txAfter = await db.query.transactions.findFirst({ where: eq(transactions.id, txId) });
    expect(txAfter?.paymentStatus).toBe("PAID");
    expect(txAfter?.paymentChannel).toBe("DANA_WALLET");

    // 2. Second webhook call (Idempotency): tidak boleh duplikasi lisensi
    const webhookRes2 = await fetch("http://localhost:3000/webhook/dana/finish-payment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        merchantTransId: extId,
        orderStatus: "SUCCESS",
      }),
    });

    expect(webhookRes2.status).toBe(200);
    const resData2: any = await webhookRes2.json();
    expect(resData2.message).toContain("idempotent");

    // Pastikan hanya 1 lisensi yang terbit untuk transaksi ini
    const issuedLicenses = await db.query.licenses.findMany({
      where: eq(licenses.transactionId, txId),
    });
    expect(issuedLicenses.length).toBe(1);

    // 3. Test DANA Disburse to Bank Notify Webhook
    const disburseWebhookRes = await fetch("http://localhost:3000/webhook/dana/disburse-notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        partnerReferenceNo: extId,
        status: "SUCCESS",
      }),
    });

    expect(disburseWebhookRes.status).toBe(200);
    const txDisbAfter = await db.query.transactions.findFirst({ where: eq(transactions.id, txId) });
    expect(txDisbAfter?.disbursementStatus).toBe("COMPLETED");

    // Clean up
    await db.delete(licenses).where(eq(licenses.transactionId, txId));
    await db.delete(transactions).where(eq(transactions.id, txId));
  });

  it("should acknowledge DANA Transaction Success Finish Notify (/v1.0/debit/notify) with 2005600 and Successful", async () => {
    // 1. Test against SNAP BI standard route POST /v1.0/debit/notify
    const notifyRes = await fetch("http://localhost:3000/v1.0/debit/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        originalPartnerReferenceNo: `dana_order_${Date.now()}`,
        originalReferenceNo: `dana_ref_${Date.now()}`,
        latestTransactionStatus: "00",
        amount: { value: "11011.00", currency: "IDR" },
      }),
    });

    expect(notifyRes.status).toBe(200);
    const body: any = await notifyRes.json();
    expect(body.responseCode).toBe("2005600");
    expect(body.responseMessage).toBe("Successful");

    // 2. Test Internal Server Error condition (amount = 11012.00)
    const errNotifyRes = await fetch("http://localhost:3000/v1.0/debit/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        originalPartnerReferenceNo: `dana_err_${Date.now()}`,
        latestTransactionStatus: "00",
        amount: { value: "11012.00", currency: "IDR" },
      }),
    });

    expect(errNotifyRes.status).toBe(500);
    const errBody: any = await errNotifyRes.json();
    expect(errBody.responseCode).toBe("5005601");
    expect(errBody.responseMessage).toBe("Internal Server Error");
  });

  it("should fulfill transaction when SNAP BI Finish Notify latestTransactionStatus='00' matches an existing transaction", async () => {
    const existingApp = await db.query.apps.findFirst();
    if (!existingApp) return;

    const txId = `tx_dana_snap_${Date.now()}`;
    const extId = `tt_dana_snap_${Date.now()}`;
    const custEmail = `customer_dana_snap_${Date.now()}@test.local`;

    await db.insert(transactions).values({
      id: txId,
      appId: existingApp.id,
      builderId: existingApp.builderId,
      paymentProvider: "dana",
      providerReferenceId: extId,
      xenditInvoiceId: extId,
      xenditExternalId: extId,
      xenditInvoiceUrl: `https://checkout.dana.id/mock/${extId}`,
      customerEmail: custEmail,
      grossAmount: 50000,
      platformFee: 2500,
      netAmount: 47500,
      paymentStatus: "PENDING",
      disbursementStatus: "PENDING",
      grantDays: 30,
    });

    const res = await fetch("http://localhost:3000/v1.0/debit/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        originalPartnerReferenceNo: extId,
        originalReferenceNo: `dana_ref_${Date.now()}`,
        latestTransactionStatus: "00",
        amount: { value: "50000.00", currency: "IDR" },
      }),
    });

    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.responseCode).toBe("2005600");
    expect(body.responseMessage).toBe("Successful");

    const txAfter = await db.query.transactions.findFirst({ where: eq(transactions.id, txId) });
    expect(txAfter?.paymentStatus).toBe("PAID");

    const issued = await db.query.licenses.findMany({ where: eq(licenses.transactionId, txId) });
    expect(issued.length).toBe(1);

    await db.delete(licenses).where(eq(licenses.transactionId, txId));
    await db.delete(transactions).where(eq(transactions.id, txId));
  });
});
