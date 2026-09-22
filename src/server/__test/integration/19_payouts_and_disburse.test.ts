import { describe, it, expect, beforeAll } from "bun:test";
import { setupTestAuth, authCookie } from "../setup";
import { handleBatchPayout } from "../../routes/panel/payouts";
import { handleDisburse } from "../../routes/apps/disburse";
import { handleDanaFinish, handlePreviewCoupon, handleListTransactions, handleSimulatePaid } from "../../routes/checkout/handlers";
import { db } from "../../db";
import { apps, builders, transactions, coupons } from "../../db/schema";
import { eq } from "drizzle-orm";
import { generateAppApiKey } from "../../routes/apps/api-key";

setupTestAuth();

describe("Payouts, Disbursements, and Checkout Handlers", () => {
  let liveApp: any;
  let sandboxApp: any;
  let testBuilder: any;
  let adminHeaders: Headers;

  beforeAll(async () => {
    adminHeaders = new Headers({ cookie: authCookie });
    const existingBuilder = await db.query.builders.findFirst();
    if (existingBuilder) {
      testBuilder = existingBuilder;
    } else {
      const [b] = await db.insert(builders).values({
        name: "Payout Builder",
        email: `payout_${Date.now()}@test.com`,
        apiKey: generateAppApiKey("live"),
      }).returning();
      testBuilder = b;
    }

    const [lApp] = await db.insert(apps).values({
      id: `app_live_${Date.now()}`,
      name: "Live Payout App",
      slug: `live-pay-${Date.now()}`,
      builderId: testBuilder.id,
      mode: "live",
      targetPrice: 100000,
    }).returning();
    liveApp = lApp;

    const [sApp] = await db.insert(apps).values({
      id: `app_sand_${Date.now()}`,
      name: "Sandbox Payout App",
      slug: `sand-pay-${Date.now()}`,
      builderId: testBuilder.id,
      mode: "sandbox",
      targetPrice: 100000,
    }).returning();
    sandboxApp = sApp;
  });

  it("should test handleBatchPayout in panel", async () => {
    // 1. Batch payout when no eligible transactions exist
    const emptyBatch = await handleBatchPayout();
    expect(emptyBatch.success).toBe(true);
    expect(emptyBatch.processedCount).toBe(0);

    // 2. Insert an eligible paid transaction in LIVE app
    const txId = `tx_batch_${Date.now()}`;
    await db.insert(transactions).values({
      id: txId,
      appId: liveApp.id,
      builderId: testBuilder.id,
      xenditExternalId: `ext_${txId}`,
      customerEmail: "buyer@batch.com",
      grossAmount: 100000,
      platformFee: 5000,
      netAmount: 95000,
      paymentStatus: "PAID",
      disbursementStatus: "PENDING",
    });

    // Ensure builder has disbursement account
    await db.update(builders).set({
      disbursementAccount: {
        bankCode: "BCA",
        accountNumber: "1234567890",
        accountHolderName: "Test Builder",
      },
    }).where(eq(builders.id, testBuilder.id));

    const batchRes = await handleBatchPayout();
    expect(batchRes.success).toBe(true);
  });

  it("should test handleDisburse edge cases (404, 400 unpaid, 400 sandbox, success)", async () => {
    const set: any = {};

    // 1. 404 Transaction Not Found
    const notFoundRes = await handleDisburse({
      params: { transactionId: "non_existent_tx_999" },
      set,
      request: { headers: adminHeaders },
    });
    expect(set.status).toBe(404);
    expect(notFoundRes.error).toContain("not found");

    // 2. 400 Unpaid Transaction
    const unpaidTxId = `tx_unpaid_${Date.now()}`;
    await db.insert(transactions).values({
      id: unpaidTxId,
      appId: liveApp.id,
      builderId: testBuilder.id,
      xenditExternalId: `ext_${unpaidTxId}`,
      customerEmail: "unpaid@test.com",
      grossAmount: 100000,
      platformFee: 5000,
      netAmount: 95000,
      paymentStatus: "PENDING",
      disbursementStatus: "PENDING",
    });

    const unpaidRes = await handleDisburse({
      params: { transactionId: unpaidTxId },
      set,
      request: { headers: adminHeaders },
    });
    expect(set.status).toBe(400);
    expect(unpaidRes.error).toContain("unpaid");

    // 3. 400 Sandbox Mode Transaction
    const sandboxTxId = `tx_sand_${Date.now()}`;
    await db.insert(transactions).values({
      id: sandboxTxId,
      appId: sandboxApp.id,
      builderId: testBuilder.id,
      xenditExternalId: `ext_${sandboxTxId}`,
      customerEmail: "sand@test.com",
      grossAmount: 100000,
      platformFee: 5000,
      netAmount: 95000,
      paymentStatus: "PAID",
      disbursementStatus: "PENDING",
    });

    const sandRes = await handleDisburse({
      params: { transactionId: sandboxTxId },
      set,
      request: { headers: adminHeaders },
    });
    expect(set.status).toBe(400);
    expect(sandRes.error).toContain("sandbox");

    // 4. Successful Disburse of a Live Paid Transaction
    const paidTxId = `tx_paid_${Date.now()}`;
    await db.insert(transactions).values({
      id: paidTxId,
      appId: liveApp.id,
      builderId: testBuilder.id,
      xenditExternalId: `ext_${paidTxId}`,
      customerEmail: "paid@test.com",
      grossAmount: 100000,
      platformFee: 5000,
      netAmount: 95000,
      paymentStatus: "PAID",
      disbursementStatus: "PENDING",
    });

    const disburseSuccess = await handleDisburse({
      params: { transactionId: paidTxId },
      set: {},
      request: { headers: adminHeaders },
    });
    expect(disburseSuccess.success).toBe(true);

    // 5. Re-disbursing already completed/processing transaction gives 400
    const secondTry = await handleDisburse({
      params: { transactionId: paidTxId },
      set,
      request: { headers: adminHeaders },
    });
    expect(set.status).toBe(400);
  });

  it("should test Payouts router endpoints via app.handle HTTP", async () => {
    // 1. GET /api/v1/payouts/account
    const getAccountRes = await fetch("http://localhost:3001/api/v1/payouts/account");
    expect(getAccountRes.status).toBe(200);
    const getAccountData: any = await getAccountRes.json();
    expect(getAccountData.success).toBe(true);

    // 2. POST /api/v1/payouts/account (update disbursement info)
    const updateAccountRes = await fetch("http://localhost:3001/api/v1/payouts/account", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bankCode: "MANDIRI",
        accountNumber: "987654321",
        accountHolderName: "Fikri Payout",
        eWalletType: "DANA",
        phoneNumber: "08123456789",
      }),
    });
    expect(updateAccountRes.status).toBe(200);
    const updateAccountData: any = await updateAccountRes.json();
    expect(updateAccountData.success).toBe(true);
    expect(updateAccountData.disbursementAccount.bankCode).toBe("MANDIRI");

    // 3. POST /api/v1/payouts/trigger with sandbox mode -> rejected (400)
    const triggerSandboxRes = await fetch("http://localhost:3001/api/v1/payouts/trigger", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "sandbox" }),
    });
    expect(triggerSandboxRes.status).toBe(400);

    // 4. POST /api/v1/payouts/trigger with live mode
    const triggerLiveRes = await fetch("http://localhost:3001/api/v1/payouts/trigger", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "live" }),
    });
    expect([200, 400]).toContain(triggerLiveRes.status);
  });

  it("should test checkout handlers: handleDanaFinish, handlePreviewCoupon, handleListTransactions, handleSimulatePaid", async () => {
    const set: any = {};

    // 1. handleDanaFinish: missing externalId (400)
    const finishMissing = await handleDanaFinish({ query: {}, set });
    expect(set.status).toBe(400);

    // 404 Tx Not Found
    const finishNotFound = await handleDanaFinish({ query: { externalId: "fake_ext_999" }, set });
    expect(set.status).toBe(404);

    // Valid handleDanaFinish
    const extId = `ext_${Date.now()}`;
    const txId = `tx_dana_${Date.now()}`;
    await db.insert(transactions).values({
      id: txId,
      appId: liveApp.id,
      builderId: testBuilder.id,
      xenditExternalId: extId,
      customerEmail: "dana_cust@test.com",
      grossAmount: 50000,
      platformFee: 2500,
      netAmount: 47500,
      paymentStatus: "PAID",
      disbursementStatus: "PENDING",
    });

    const finishSuccess = await handleDanaFinish({ query: { externalId: extId }, set: {} });
    expect(finishSuccess?.success).toBe(true);
    expect(finishSuccess?.paymentStatus).toBe("PAID");

    // 2. handlePreviewCoupon
    const previewNoApp = await handlePreviewCoupon({ body: { appId: "fake_app", couponCode: "DISC10" }, set });
    expect(set.status).toBe(404);

    // Create a coupon
    const couponCode = `TEST${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    await db.insert(coupons).values({
      id: `cpn_${Date.now()}`,
      appId: liveApp.id,
      code: couponCode,
      discountPercent: 20,
      isActive: true,
    });

    const previewSuccess = await handlePreviewCoupon({
      body: { appId: liveApp.id, couponCode, amount: 100000 },
      set: {},
    });
    expect(previewSuccess.valid).toBe(true);
    expect(previewSuccess.discountPercent).toBe(20);
    expect(previewSuccess.discountAmount).toBe(20000);
    expect(previewSuccess.payableAmount).toBe(80000);

    // 3. handleListTransactions
    const listTx = await handleListTransactions({
      query: { appId: liveApp.id, limit: 10 },
      request: { headers: adminHeaders },
    });
    expect(listTx.success).toBe(true);
    expect(Array.isArray(listTx.transactions)).toBe(true);

    // 4. handleSimulatePaid
    const simNotFound = await handleSimulatePaid({ params: { txId: "non_existent_tx" }, set });
    expect(set.status).toBe(404);

    // Create a pending transaction for sandboxApp
    const simTxId = `tx_sim_${Date.now()}`;
    await db.insert(transactions).values({
      id: simTxId,
      appId: sandboxApp.id,
      builderId: testBuilder.id,
      xenditExternalId: `ext_${simTxId}`,
      customerEmail: "sim@test.com",
      grossAmount: 50000,
      platformFee: 2500,
      netAmount: 47500,
      paymentStatus: "PENDING",
      disbursementStatus: "PENDING",
    });

    const simSuccess = await handleSimulatePaid({ params: { txId: simTxId }, set: {} });
    expect(simSuccess.success).toBe(true);
    expect(simSuccess.licenseKey).toBeDefined();

    // Call again on already PAID transaction
    const simAgain = await handleSimulatePaid({ params: { txId: simTxId }, set: {} });
    expect(simAgain.success).toBe(true);
    expect(simAgain.message).toContain("PAID sebelumnya");
  });
});
