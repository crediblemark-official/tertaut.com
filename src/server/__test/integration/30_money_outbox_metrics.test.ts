import { beforeAll, afterAll, test, describe, expect, spyOn, mock } from "bun:test";
import { db } from "../../db";
import {
  apps,
  builders,
  transactions,
  licenses,
  paymentOperations,
  webhookDeliveries,
} from "../../db/schema";
import { eq, and } from "drizzle-orm";
import { setupTestAuth } from "../setup";
import { xenditGateway } from "../../services/payments/gateways";
import { requestRefund, applyRefundResult } from "../../services/payments/refunds";
import {
  submitPayout,
  reconcilePayouts,
  applyPayoutCallback,
} from "../../services/payments/payouts";
import { WebhookService } from "../../services/notifications/webhooks";
import * as transport from "../../services/security/webhookUrl";
import * as builderResolver from "../../routes/apps/builder";
import { handleSubscriptionStats } from "../../routes/apps/subscriptionStats";
import { handleListLicenses } from "../../routes/licensing/admin";
import { handleXenditRefundWebhook } from "../../routes/webhook/refund";
import { XenditService } from "../../services/payments/xendit";
import { fulfillPaymentTransaction } from "../../routes/webhook/fulfill";
setupTestAuth();
const runId = crypto.randomUUID();
let builder: typeof builders.$inferSelect;
const appId = `readiness_${runId}`;
let counter = 0;
const operationIds: string[] = [];
const recipient = { bankCode: "BCA", accountHolderName: "Audit", accountNumber: "1234567890" };
async function transaction(extra: Partial<typeof transactions.$inferInsert> = {}) {
  const id = `tx_readiness_${runId}_${counter++}`;
  const [tx] = await db
    .insert(transactions)
    .values({
      id,
      appId,
      builderId: builder.id,
      mode: "live",
      paymentProvider: "xendit",
      providerReferenceId: `pr-${id}`,
      xenditExternalId: `ext_${id}`,
      customerEmail: "buyer@example.invalid",
      grossAmount: 100000,
      netAmount: 95000,
      platformFee: 5000,
      paymentStatus: "PAID",
      ...extra,
    })
    .returning();
  return tx!;
}
async function license(tx: typeof transactions.$inferSelect) {
  const [row] = await db
    .insert(licenses)
    .values({
      id: `lic_${tx.id}`,
      appId,
      mode: "live",
      transactionId: tx.id,
      licenseKey: `TT-${crypto.randomUUID()}`,
      customerEmail: tx.customerEmail,
      status: "ACTIVE",
    })
    .returning();
  return row!;
}
describe("Money lifecycle, durable outbox, and complete metrics", () => {
  beforeAll(async () => {
    [builder] = await db
      .insert(builders)
      .values({ name: "Readiness", email: `ready-${runId}@example.invalid`, apiKey: runId })
      .returning();
    await db.insert(apps).values({
      id: appId,
      slug: appId,
      builderId: builder.id,
      name: "Readiness",
      mode: "live",
      appType: "saas_web",
      targetPrice: 100000,
    });
  });
  afterAll(async () => {
    for (const id of operationIds)
      await db.delete(paymentOperations).where(eq(paymentOperations.id, id));
    await db.delete(builders).where(eq(builders.id, builder.id));
  });
  test("gateway refund adapters preserve provider status and stable refund references", async () => {
    const params = {
      externalId: "rfd_contract",
      referenceNo: "pr-original",
      originalExternalId: "checkout-original",
      amount: 1000,
      reason: "requested",
    };
    const credentials = spyOn(xenditGateway, "getCredentials").mockResolvedValue({
      secretKey: "xnd_test_contract",
      webhookToken: "",
    });
    const http = spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({ id: "rfd-provider", status: "PENDING", amount: 1000 })
    );
    try {
      expect((await xenditGateway.createRefund(params)).status).toBe("PROCESSING");
      const [, request] = http.mock.calls[0];
      expect((request?.headers as Record<string, string>)["idempotency-key"]).toBe(
        params.externalId
      );
      expect(JSON.parse(String(request?.body)).payment_request_id).toBe(params.referenceNo);
      http.mockResolvedValue(Response.json({ id: "rfd-provider", amount: 1000 }));
      expect((await xenditGateway.createRefund(params)).status).toBe("UNKNOWN");
    } finally {
      http.mockRestore();
      credentials.mockRestore();
    }
  });
  test("pending refund preserves paid access and duplicate requests never send another refund", async () => {
    const tx = await transaction();
    const lic = await license(tx);
    const send = spyOn(xenditGateway, "createRefund").mockResolvedValue({
      id: "provider-refund",
      status: "PROCESSING",
      amount: tx.grossAmount,
    });
    try {
      const op = await requestRefund(tx.id, "customer request");
      operationIds.push(op.id);
      expect(op.status).toBe("PROCESSING");
      expect((await requestRefund(tx.id, "duplicate")).id).toBe(op.id);
      expect(send).toHaveBeenCalledTimes(1);
      expect(
        (await db.query.transactions.findFirst({ where: eq(transactions.id, tx.id) }))
          ?.paymentStatus
      ).toBe("PAID");
      expect((await db.query.licenses.findFirst({ where: eq(licenses.id, lic.id) }))?.status).toBe(
        "ACTIVE"
      );
      await applyRefundResult(op.id, {
        id: "provider-refund",
        amount: tx.grossAmount,
        status: "COMPLETED",
      });
      expect(
        (await db.query.transactions.findFirst({ where: eq(transactions.id, tx.id) }))
          ?.paymentStatus
      ).toBe("REFUNDED");
      expect((await db.query.licenses.findFirst({ where: eq(licenses.id, lic.id) }))?.status).toBe(
        "REVOKED"
      );
    } finally {
      send.mockRestore();
    }
  });
  test("a timed-out refund remains UNKNOWN and cannot be submitted again", async () => {
    const tx = await transaction();
    const send = spyOn(xenditGateway, "createRefund").mockRejectedValue(
      new Error("connection lost after provider accepted")
    );
    try {
      const op = await requestRefund(tx.id, "timeout");
      operationIds.push(op.id);
      expect(op.status).toBe("UNKNOWN");
      expect((await requestRefund(tx.id, "retry")).id).toBe(op.id);
      expect(send).toHaveBeenCalledTimes(1);
      expect(
        (await db.query.transactions.findFirst({ where: eq(transactions.id, tx.id) }))?.refundStatus
      ).toBe("UNKNOWN");
    } finally {
      send.mockRestore();
    }
  });
  test("failed refunds retain access, and successful provider refunds survive an outbox rollback", async () => {
    const tx = await transaction();
    const lic = await license(tx);
    const send = spyOn(xenditGateway, "createRefund").mockResolvedValue({
      id: "failed-refund",
      status: "FAILED",
      amount: tx.grossAmount,
    });
    try {
      const failed = await requestRefund(tx.id, "declined");
      operationIds.push(failed.id);
      expect(failed.status).toBe("FAILED");
      expect((await db.query.licenses.findFirst({ where: eq(licenses.id, lic.id) }))?.status).toBe(
        "ACTIVE"
      );
      send.mockResolvedValue({
        id: "confirmed-refund",
        status: "COMPLETED",
        amount: tx.grossAmount,
      });
      const emit = spyOn(WebhookService, "emit").mockRejectedValue(new Error("queue unavailable"));
      let op;
      try {
        op = await requestRefund(tx.id, "retry after rejection");
      } finally {
        emit.mockRestore();
      }
      operationIds.push(op.id);
      expect(op.status).toBe("UNKNOWN");
      expect(op.providerId).toBe("confirmed-refund");
      expect(
        (await db.query.transactions.findFirst({ where: eq(transactions.id, tx.id) }))
          ?.paymentStatus
      ).toBe("PAID");
      await applyRefundResult(op.id, {
        id: op.providerId!,
        status: "COMPLETED",
        amount: tx.grossAmount,
      });
      expect((await db.query.licenses.findFirst({ where: eq(licenses.id, lic.id) }))?.status).toBe(
        "REVOKED"
      );
    } finally {
      send.mockRestore();
    }
  });
  test("refund callbacks authenticate and reject mismatched amounts before revoking access", async () => {
    const tx = await transaction();
    const lic = await license(tx);
    const send = spyOn(xenditGateway, "createRefund").mockResolvedValue({
      id: `callback_${tx.id}`,
      status: "PROCESSING",
      amount: tx.grossAmount,
    });
    const verify = spyOn(XenditService, "verifyWebhook").mockResolvedValue(false);
    try {
      const op = await requestRefund(tx.id, "callback");
      operationIds.push(op.id);
      const body = {
        data: {
          id: op.providerId,
          reference_id: op.id,
          amount: tx.grossAmount,
          currency: "IDR",
          status: "SUCCEEDED",
        },
      };
      const unauthorized: any = {};
      await handleXenditRefundWebhook({ headers: {}, body, set: unauthorized });
      expect(unauthorized.status).toBe(401);
      verify.mockResolvedValue(true);
      const mismatch: any = {};
      await handleXenditRefundWebhook({
        headers: {},
        body: { data: { ...body.data, amount: 1 } },
        set: mismatch,
      });
      expect(mismatch.status).toBe(400);
      expect((await db.query.licenses.findFirst({ where: eq(licenses.id, lic.id) }))?.status).toBe(
        "ACTIVE"
      );
      await handleXenditRefundWebhook({ headers: {}, body, set: {} });
      await handleXenditRefundWebhook({ headers: {}, body, set: {} });
      expect(
        (await db.query.transactions.findFirst({ where: eq(transactions.id, tx.id) }))
          ?.paymentStatus
      ).toBe("REFUNDED");
    } finally {
      send.mockRestore();
      verify.mockRestore();
    }
  });
  test("overlapping payout submissions transfer a transaction at most once", async () => {
    const tx = await transaction();
    const send = spyOn(xenditGateway, "createDisbursement").mockImplementation(async (params) => ({
      id: "concurrent-payout",
      externalId: params.externalId,
      amount: params.amount,
      ...recipient,
      status: "PENDING",
    }));
    try {
      const input = {
        transactionIds: [tx.id],
        builderId: builder.id,
        gateway: xenditGateway,
        recipient,
        description: "Race",
      };
      const results = await Promise.allSettled([submitPayout(input), submitPayout(input)]);
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      expect(send).toHaveBeenCalledTimes(1);
      for (const result of results)
        if (result.status === "fulfilled") operationIds.push(result.value.externalId);
    } finally {
      send.mockRestore();
    }
  });
  test("unsupported refunds fail before changing the paid transaction", async () => {
    const tx = await transaction({ paymentProvider: "retired-provider" });
    await expect(requestRefund(tx.id, "unsupported")).rejects.toThrow("tidak valid");
    expect(
      (await db.query.transactions.findFirst({ where: eq(transactions.id, tx.id) }))?.refundStatus
    ).toBe("NONE");
  });
  test("a definitively failed refund releases payout eligibility", async () => {
    const tx = await transaction({ refundStatus: "FAILED" });
    const send = spyOn(xenditGateway, "createDisbursement").mockImplementation(async (params) => ({
      id: "after-failed-refund",
      externalId: params.externalId,
      amount: params.amount,
      ...recipient,
      status: "COMPLETED",
    }));
    try {
      const result = await submitPayout({
        transactionIds: [tx.id],
        builderId: builder.id,
        gateway: xenditGateway,
        recipient,
        description: "Rejected refund",
      });
      operationIds.push(result.externalId);
      expect(result.status).toBe("COMPLETED");
    } finally {
      send.mockRestore();
    }
  });
  test("payout timeout keeps a durable request, blocks a second transfer, and reconciles via original provider", async () => {
    const tx = await transaction();
    const send = spyOn(xenditGateway, "createDisbursement").mockRejectedValue(new Error("timeout"));
    const inquiry = spyOn(xenditGateway, "queryDisbursement").mockResolvedValue({
      id: "provider-payout",
      amount: tx.netAmount,
      status: "COMPLETED",
    });
    try {
      const input = {
        transactionIds: [tx.id],
        builderId: builder.id,
        gateway: xenditGateway,
        recipient,
        description: "Audit payout",
      };
      const pending = await submitPayout(input);
      operationIds.push(pending.externalId);
      expect(pending.status).toBe("UNKNOWN");
      await expect(submitPayout(input)).rejects.toThrow();
      expect(send).toHaveBeenCalledTimes(1);
      const stored = await db.query.paymentOperations.findFirst({
        where: eq(paymentOperations.id, pending.externalId),
      });
      expect(stored?.request.externalId).toBe(pending.externalId);
      expect(stored?.provider).toBe("xendit");
      await db
        .update(paymentOperations)
        .set({ nextCheckAt: new Date(0) })
        .where(eq(paymentOperations.id, pending.externalId));
      await reconcilePayouts();
      expect(send).toHaveBeenCalledTimes(1);
      expect(inquiry).toHaveBeenCalled();
      expect(
        (await db.query.transactions.findFirst({ where: eq(transactions.id, tx.id) }))
          ?.disbursementStatus
      ).toBe("COMPLETED");
    } finally {
      send.mockRestore();
      inquiry.mockRestore();
    }
  });
  test("callback completing before an HTTP timeout is not overwritten by UNKNOWN", async () => {
    const tx = await transaction();
    const send = spyOn(xenditGateway, "createDisbursement").mockImplementation(async (params) => {
      await applyPayoutCallback("xendit", params.externalId, "early-callback", "COMPLETED");
      throw new Error("HTTP response lost");
    });
    try {
      const result = await submitPayout({
        transactionIds: [tx.id],
        builderId: builder.id,
        gateway: xenditGateway,
        recipient,
        description: "Early callback",
      });
      operationIds.push(result.externalId);
      expect(result.status).toBe("COMPLETED");
    } finally {
      send.mockRestore();
    }
  });
  test("failure to enqueue payment event rolls back payment and license issuance", async () => {
    const tx = await transaction({ paymentStatus: "PENDING" });
    const emit = spyOn(WebhookService, "emitPayment").mockRejectedValue(
      new Error("outbox write failed")
    );
    try {
      await expect(fulfillPaymentTransaction(tx)).rejects.toThrow("outbox write failed");
    } finally {
      emit.mockRestore();
    }
    expect(
      (await db.query.transactions.findFirst({ where: eq(transactions.id, tx.id) }))?.paymentStatus
    ).toBe("PENDING");
    expect(
      await db.query.licenses.findFirst({ where: eq(licenses.transactionId, tx.id) })
    ).toBeUndefined();
  });
  test("concurrent workers claim one delivery once; abandoned claims recover with the same id", async () => {
    const endpoint = await WebhookService.create(builder.id, {
      url: "https://hooks.example.com/worker",
      events: ["payment.success"],
    });
    const tx = await transaction();
    await WebhookService.emitPayment("payment.success", {
      transaction: tx,
      eventId: `test:${tx.id}`,
    });
    await WebhookService.emitPayment("payment.success", {
      transaction: tx,
      eventId: `test:${tx.id}`,
    });
    expect(
      await db.query.webhookDeliveries.findMany({
        where: eq(webhookDeliveries.endpointId, endpoint.id),
      })
    ).toHaveLength(1);
    const send = spyOn(transport, "sendWebhook").mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
      return 200;
    });
    try {
      const counts = await Promise.all([
        WebhookService.dispatchDue({ endpointId: endpoint.id }),
        WebhookService.dispatchDue({ endpointId: endpoint.id }),
      ]);
      expect(counts.reduce((a, b) => a + b, 0)).toBe(1);
      expect(send).toHaveBeenCalledTimes(1);
      const [first] = await db.query.webhookDeliveries.findMany({
        where: eq(webhookDeliveries.endpointId, endpoint.id),
      });
      expect(first.attempts).toBe(1);
      await db
        .update(webhookDeliveries)
        .set({ status: "PROCESSING", claimToken: "dead-worker", lockedUntil: new Date(0) })
        .where(eq(webhookDeliveries.id, first.id));
      await WebhookService.dispatchDue({ endpointId: endpoint.id });
      const after = await db.query.webhookDeliveries.findFirst({
        where: eq(webhookDeliveries.id, first.id),
      });
      expect(after?.status).toBe("SENT");
      expect(after?.attempts).toBe(2);
      expect(send.mock.calls[1][2]["X-Tertaut-Delivery"]).toBe(first.id);
    } finally {
      send.mockRestore();
    }
  });
  test("metrics aggregate more than 200 transactions and 25 licenses without trial or customer duplication", async () => {
    const [metricsOwner] = await db
      .insert(builders)
      .values({
        name: "Metrics",
        email: `metrics-${runId}@example.invalid`,
        apiKey: `metrics-${runId}`,
      })
      .returning();
    const metricsApp = `metrics_${runId}`;
    await db.insert(apps).values({
      id: metricsApp,
      slug: metricsApp,
      builderId: metricsOwner.id,
      name: "Metrics",
      mode: "live",
      pricingType: "subscription",
      trialPeriodDays: 14,
      targetPrice: 999999,
    });
    const resolver = spyOn(builderResolver, "resolveCurrentBuilder").mockResolvedValue({
      builder: metricsOwner,
      isAdmin: false,
    });
    try {
      const rows = await db
        .insert(transactions)
        .values(
          Array.from({ length: 250 }, (_, i) => ({
            id: `metric_${runId}_${i}`,
            appId: metricsApp,
            builderId: metricsOwner.id,
            mode: "live" as const,
            xenditExternalId: `metric_ext_${runId}_${i}`,
            customerEmail: "metrics@example.invalid",
            grossAmount: 1000,
            platformFee: 50,
            netAmount: 950,
            paymentStatus: "PAID" as const,
            grantDays: 30,
          }))
        )
        .returning();
      await db.insert(licenses).values(
        rows.slice(0, 30).map((tx) => ({
          id: `lic_${tx.id}`,
          appId: metricsApp,
          mode: "live" as const,
          transactionId: tx.id,
          customerEmail: tx.customerEmail,
          licenseKey: `KEY_${tx.id}`,
          status: "ACTIVE" as const,
        }))
      );
      const result = await handleSubscriptionStats({
        request: new Request("http://localhost/metrics"),
        query: { mode: "live" },
        set: {},
      });
      expect(result.stats?.totalCount).toBe(30);
      expect(result.stats?.activeRecurringCount).toBe(1);
      expect(result.stats?.avgLtv).toBe(250000);
      expect(result.stats?.monthlyEquivalent).toBe(1015);
      const page = await handleListLicenses({
        request: { headers: new Headers() },
        query: { limit: 25, mode: "live" },
      });
      expect(page.licenses).toHaveLength(25);
      expect(page.licenses.every((lic: any) => lic.ltv === 250000 && lic.isTrial === false)).toBe(
        true
      );
    } finally {
      resolver.mockRestore();
      await db.delete(builders).where(eq(builders.id, metricsOwner.id));
    }
  });
});
