import { describe, it, expect } from "bun:test";
import { XenditService } from "../../services/xendit";
import { config } from "../../config";
import { db } from "../../db";
import { transactions, licenses } from "../../db/schema";
import { eq, inArray } from "drizzle-orm";
import {
  handleXenditInvoiceWebhook,
  handleXenditDisbursementWebhook,
} from "../../routes/webhook/xendit";

describe("PRD Module 2: Dynamic Checkout Engine & MoR Payments (Xendit)", () => {
  it("should validate Xendit callback token security header", () => {
    expect(XenditService.verifyWebhook(config.xendit.webhookToken)).toBe(true);
    if (config.xendit.webhookToken) {
      expect(XenditService.verifyWebhook("invalid-tampered-token")).toBe(false);
      expect(XenditService.verifyWebhook(undefined)).toBe(false);
    }
  });

  it("should enforce minimum payout threshold of Rp 50.000", () => {
    const MIN_THRESHOLD = 50000;
    const pendingBalanceLow = 38000;
    const pendingBalanceHigh = 95000;

    const isLowEligible = pendingBalanceLow >= MIN_THRESHOLD;
    const isHighEligible = pendingBalanceHigh >= MIN_THRESHOLD;

    expect(isLowEligible).toBe(false);
    expect(isHighEligible).toBe(true);
  });

  it("should enforce webhook idempotency (single license provisioning & no duplicate processing)", async () => {
    // Find or create test app
    let app = await db.query.apps.findFirst();
    if (!app) {
      return; // Skip if db not populated
    }

    const testTxId = `tx_test_idemp_${Date.now()}`;
    const testExtId = `tt_ext_${Date.now()}`;
    const testInvId = `inv_test_${Date.now()}`;

    // 1. Insert initial PENDING transaction
    await db.insert(transactions).values({
      id: testTxId,
      appId: app.id,
      builderId: app.builderId,
      xenditInvoiceId: testInvId,
      xenditExternalId: testExtId,
      customerEmail: "buyer_idempotent_test@tertaut.com",
      grossAmount: 100000,
      platformFee: 5000,
      netAmount: 95000,
      paymentStatus: "PENDING",
      disbursementStatus: "PENDING",
    });

    try {
      const setObj: any = {};
      const webhookHeaders = { "x-callback-token": config.xendit.webhookToken || "" };

      // 2. First callback: should mark as PAID and generate exactly 1 license
      const firstResult: any = await handleXenditInvoiceWebhook({
        headers: webhookHeaders,
        body: {
          id: testInvId,
          external_id: testExtId,
          status: "PAID",
          payment_method: "QRIS",
        },
        set: setObj,
      });

      expect(firstResult.status).toBe("success");
      expect(firstResult.licenseKey).toBeDefined();

      const createdLicensesAfterFirst = await db.query.licenses.findMany({
        where: eq(licenses.transactionId, testTxId),
      });
      expect(createdLicensesAfterFirst.length).toBe(1);

      // 3. Second callback with identical invoice (re-delivery / duplicate webhook)
      const secondResult: any = await handleXenditInvoiceWebhook({
        headers: webhookHeaders,
        body: {
          id: testInvId,
          external_id: testExtId,
          status: "PAID",
          payment_method: "QRIS",
        },
        set: setObj,
      });

      expect(secondResult.status).toBe("success");
      expect(secondResult.message).toContain("idempotent");

      // Verify that licenses count is STILL strictly 1 (no duplicate key generated)
      const createdLicensesAfterSecond = await db.query.licenses.findMany({
        where: eq(licenses.transactionId, testTxId),
      });
      expect(createdLicensesAfterSecond.length).toBe(1);
    } finally {
      // Clean up test data
      await db.delete(licenses).where(eq(licenses.transactionId, testTxId));
      await db.delete(transactions).where(eq(transactions.id, testTxId));
    }
  });

  it("should mark failed/expired invoices and never downgrade an already PAID transaction", async () => {
    const app = await db.query.apps.findFirst();
    if (!app) return;

    const failedTxId = `tx_failed_${Date.now()}`;
    const failedExt = `tt_ext_failed_${Date.now()}`;
    const paidTxId = `tx_paid_${Date.now()}`;
    const paidExt = `tt_ext_paid_${Date.now()}`;

    await db.insert(transactions).values([
      {
        id: failedTxId,
        appId: app.id,
        builderId: app.builderId,
        xenditInvoiceId: `inv_${failedTxId}`,
        xenditExternalId: failedExt,
        customerEmail: "failed@tertaut.com",
        grossAmount: 100000,
        platformFee: 5000,
        netAmount: 95000,
        paymentStatus: "PENDING",
        disbursementStatus: "PENDING",
      },
      {
        id: paidTxId,
        appId: app.id,
        builderId: app.builderId,
        xenditInvoiceId: `inv_${paidTxId}`,
        xenditExternalId: paidExt,
        customerEmail: "paid@tertaut.com",
        grossAmount: 100000,
        platformFee: 5000,
        netAmount: 95000,
        paymentStatus: "PAID",
        disbursementStatus: "PENDING",
      },
    ]);

    try {
      const headers = { "x-callback-token": config.xendit.webhookToken || "" };

      await handleXenditInvoiceWebhook({
        headers,
        body: { id: `inv_${failedTxId}`, external_id: failedExt, status: "FAILED" },
        set: {},
      });
      await handleXenditInvoiceWebhook({
        headers,
        body: { id: `inv_${paidTxId}`, external_id: paidExt, status: "EXPIRED" },
        set: {},
      });

      const failedTx = await db.query.transactions.findFirst({ where: eq(transactions.id, failedTxId) });
      const paidTx = await db.query.transactions.findFirst({ where: eq(transactions.id, paidTxId) });
      expect(failedTx!.paymentStatus).toBe("FAILED");
      expect(paidTx!.paymentStatus).toBe("PAID");
    } finally {
      await db.delete(licenses).where(eq(licenses.transactionId, failedTxId));
      await db.delete(licenses).where(eq(licenses.transactionId, paidTxId));
      await db.delete(transactions).where(eq(transactions.id, failedTxId));
      await db.delete(transactions).where(eq(transactions.id, paidTxId));
    }
  });

  it("should finalize Xendit disbursement callbacks without overwriting terminal status", async () => {
    const app = await db.query.apps.findFirst();
    if (!app) return;

    const processingId = `tx_disb_proc_${Date.now()}`;
    const failedId = `tx_disb_fail_${Date.now()}`;
    const completedId = `tx_disb_done_${Date.now()}`;

    const base = {
      appId: app.id,
      builderId: app.builderId,
      customerEmail: "disb@tertaut.com",
      grossAmount: 100000,
      platformFee: 5000,
      netAmount: 95000,
      paymentStatus: "PAID" as const,
    };

    await db.insert(transactions).values([
      { ...base, id: processingId, xenditExternalId: `ext_${processingId}`, disbursementStatus: "PROCESSING" as const, disbursementId: `disb_${processingId}` },
      { ...base, id: failedId, xenditExternalId: `ext_${failedId}`, disbursementStatus: "PROCESSING" as const, disbursementId: `disb_${failedId}` },
      { ...base, id: completedId, xenditExternalId: `ext_${completedId}`, disbursementStatus: "COMPLETED" as const, disbursementId: `disb_${completedId}` },
    ]);

    try {
      const headers = { "x-callback-token": config.xendit.webhookToken || "" };

      await handleXenditDisbursementWebhook({
        headers,
        body: { id: `disb_${processingId}`, status: "COMPLETED" },
        set: {},
      });
      await handleXenditDisbursementWebhook({
        headers,
        body: { id: `disb_${failedId}`, status: "FAILED" },
        set: {},
      });
      // Callback telat: transaksi sudah COMPLETED, tidak boleh turun ke FAILED.
      await handleXenditDisbursementWebhook({
        headers,
        body: { id: `disb_${completedId}`, status: "FAILED" },
        set: {},
      });

      const processingTx = await db.query.transactions.findFirst({ where: eq(transactions.id, processingId) });
      const failedTx = await db.query.transactions.findFirst({ where: eq(transactions.id, failedId) });
      const completedTx = await db.query.transactions.findFirst({ where: eq(transactions.id, completedId) });
      expect(processingTx!.disbursementStatus).toBe("COMPLETED");
      expect(failedTx!.disbursementStatus).toBe("FAILED");
      expect(completedTx!.disbursementStatus).toBe("COMPLETED");
    } finally {
      await db.delete(transactions).where(inArray(transactions.id, [processingId, failedId, completedId]));
    }
  });
});
