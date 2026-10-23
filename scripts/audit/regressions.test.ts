/** Audit regression tests. Run in a separate process to isolate module mocks. */
import { test, expect, mock, beforeEach } from "bun:test";
import { EventEmitter } from "node:events";
mock.module("node:dns/promises", () => ({
  lookup: async () => [{ address: "8.8.8.8", family: 4 }],
}));
let transportCalls: { url: URL; options: any }[] = [];
mock.module("node:https", () => ({
  request: (url: URL, options: any, onResponse: any) => {
    transportCalls.push({ url, options });
    const socket = new EventEmitter() as any;
    socket.end = () =>
      queueMicrotask(() =>
        onResponse({
          statusCode: 302,
          headers: { location: "http://127.0.0.1/internal" },
          destroy() {},
        })
      );
    socket.destroy = () => {};
    return socket;
  },
}));
const root = new URL("../../src/server/", import.meta.url).pathname;
const mod = (path: string, exports: any) => mock.module(root + path, () => exports);
let tx: any, app: any, builder: any, lease: any, relatedLicense: any;
let updates: any[], inserts: any[], deletes: any[], selections: any[];
let recipient: any = null;
let operation: any = null;
const db: any = {
  transaction: async (fn: any) => fn(db),
  select: () => ({
    from: (table: any) => ({
      where: (where: any) => ({
        orderBy: () => ({ for: async () => [tx] }),
        for: async () => {
          if (table === schema.paymentOperations) return operation ? [operation] : [];
          selections.push({ table, where });
          return table === schema.transactions
            ? [tx]
            : new PgDialect().sqlToQuery(where).sql.includes('"transaction_id"')
              ? relatedLicense
                ? [relatedLicense]
                : []
              : [{ id: "lic_1", status: "ACTIVE" }];
        },
      }),
    }),
  }),
  query: {
    transactions: { findFirst: async () => tx },
    paymentOperations: { findFirst: async () => operation },
    apps: { findFirst: async () => app },
    builders: { findFirst: async () => builder },
    licenses: {
      findFirst: async () =>
        relatedLicense || { id: "lic_victim", licenseKey: "TT-VICTIM", transactionId: tx.id },
    },
    platformSettings: { findFirst: async () => null },
    licenseLeases: { findFirst: async () => lease },
    webhookEndpoints: { findMany: async () => [] },
  },
  insert: (table: any) => ({
    values: (data: any) => {
      inserts.push({ table, data });
      if (table === schema.paymentOperations) operation = { ...data };
      return {
        onConflictDoNothing: async () => {},
        returning: async () => [{ ...data }],
        then: (resolve: any) => Promise.resolve().then(resolve),
      };
    },
  }),
  update: (table: any) => ({
    set: (data: any) => ({
      where: (where: any) => {
        updates.push({ table, data, where });
        if (table === schema.paymentOperations) Object.assign(operation, data);
        if (table === schema.transactions) Object.assign(tx, data);
        return {
          returning: async () =>
            table === schema.licenseLeases && lease.expiresAt <= new Date()
              ? []
              : [{ ...tx, ...data }],
          then: (resolve: any) => Promise.resolve().then(resolve),
        };
      },
    }),
  }),
  delete: (table: any) => ({
    where: (where: any) => {
      deletes.push({ table, where });
      return { returning: async () => [], then: (resolve: any) => Promise.resolve().then(resolve) };
    },
  }),
};
mod("db/index.ts", { db });
mod("config.ts", {
  config: { security: { jwtSecret: "audit-secret" }, isTest: true, defaultPrice: 100000 },
  resolveRequestOrigin: () => "https://audit.invalid",
});
mod("routes/apps/builder.ts", { resolveCurrentBuilder: async () => ({ builder, isAdmin: false }) });
mod("services/licensing/license.ts", {
  LicenseService: {
    hwidLookupHashes: (hw: string) => [hw],
    hashHardwareIdSecure: (hw: string) => hw,
    generateLicenseKey: () => "TT-AUDIT",
    createOfflineGraceToken: () => "header.payload.signature",
  },
});
mod("services/licensing/licenseToken.ts", {
  LicenseTokenService: {
    verify: () => ({ valid: true, claims: { jti: "existing_jti", exp: 2000000000 } }),
  },
});
mod("services/monetization/coupon.ts", { CouponService: {} });
mod("services/payments/payoutAccount.ts", { resolveDisbursementAccount: () => recipient });
mod("services/payments/xendit.ts", { XenditService: { verifyWebhook: async () => true } });
mod("services/payments/paymentGateway.ts", { getActivePaymentGateway: async () => "xendit" });
const gateway: any = {
  id: "xendit",
  displayName: "Audit",
  calculateMor: (n: number) => ({ grossAmount: n, platformFee: n * 0.05, netAmount: n * 0.95 }),
  createOrder: async () => ({
    orderId: "inv_sandbox_audit",
    checkoutUrl: "https://audit.invalid",
    paymentRail: "va",
    scenario: "API",
  }),
};
let selected: string;
mod("services/payments/gateways/index.ts", {
  getActiveGateway: async () => gateway,
  getPaymentGateway: (id: string) => {
    selected = id;
    return gateway;
  },
});
mod("services/notifications/email.ts", { EmailService: { sendLicenseIssued: async () => {} } });
mod("services/notifications/notifier.ts", { NotifierService: { notifyRefund: async () => {} } });
mod("services/security/rateLimiter.ts", {
  enforceRateLimit: () => ({ allowed: true }),
  enforceRateLimitAsync: async () => ({ allowed: true }),
});
const { handleCreateSession } = await import(root + "routes/checkout/session.ts");
const { handleGetPaymentStatus } = await import(root + "routes/checkout/handlers.ts");
const { handleDisburse } = await import(root + "routes/apps/disburse.ts");
const { LicenseLeaseService } = await import(root + "services/licensing/licenseLease.ts");
const { WebhookService } = await import(root + "services/notifications/webhooks.ts");
const { handleXenditDisbursementWebhook } = await import(root + "routes/webhook/xendit.ts");
const schema = await import(root + "db/schema/index.ts");
const { PgDialect } = await import("drizzle-orm/pg-core");
const sqlParams = (where: any) => new PgDialect().sqlToQuery(where).params;
const req = () => new Request("https://audit.invalid/api/v1/checkout/session");
beforeEach(() => {
  app = {
    id: "app_live",
    slug: "live-product",
    builderId: "builder_1",
    mode: "live",
    targetPrice: 100000,
    appType: "desktop",
  };
  tx = {
    id: "tx_victim",
    appId: app.id,
    builderId: "builder_1",
    xenditExternalId: "tt_victim",
    paymentProvider: "xendit",
    mode: "live",
    paymentStatus: "PAID",
    disbursementStatus: "PENDING",
    grossAmount: 100000,
    netAmount: 95000,
  };
  builder = { id: "builder_1", secretApiKey: "tt_secret_private" };
  lease = {
    id: "lease_A",
    leaseKey: "secret_A",
    expiresAt: new Date(Date.now() - 60000),
    hwidHash: "device_A",
  };
  updates = [];
  inserts = [];
  deletes = [];
  selected = "";
  selections = [];
  recipient = null;
  relatedLicense = null;
  operation = null;
  tx.providerReferenceId = "inv_original";
  gateway.createRefund = async () => ({
    id: "refund_provider",
    status: "COMPLETED",
    amount: tx.grossAmount,
  });
});
const { handleRefundTransaction } = await import(root + "routes/panel/refund.ts");
const { handleS2SCreateWebhook } = await import(root + "routes/s2s/webhooks.ts");
const { createPollTicket } = await import(root + "utils/pollTicket.ts");
const { parseWebhookUrl, resolveWebhookTarget, isPublicWebhookAddress } = await import(
  root + "services/security/webhookUrl.ts"
);
const { matchesLicenseEnvironment } = await import(root + "lib/licenseEnvironment.ts");
for (const body of [{ paymentGateway: "sandbox" }, { demoMode: true }]) {
  test(`live checkout rejects simulation ${JSON.stringify(body)}`, async () => {
    const set: any = {};
    const result = await handleCreateSession({
      request: req(),
      body: { appId: app.id, customerEmail: "buyer@example.invalid", ...body },
      set,
    });
    expect(set.status).toBe(403);
    expect(result.success).toBe(false);
    expect(inserts).toHaveLength(0);
  });
}
test("sandbox checkout persists environment and original payment instructions", async () => {
  app.mode = "sandbox";
  gateway.createOrder = async () => ({
    orderId: "inv_sandbox_original",
    checkoutUrl: "https://audit.invalid",
    paymentRail: "va",
    paymentCode: "original-va",
    qrDataUrl: "original-qr",
    expiryDate: "2026-12-01T00:00:00Z",
  });
  const result: any = await handleCreateSession({
    request: req(),
    body: { appId: app.id, customerEmail: "buyer@example.invalid", paymentGateway: "sandbox" },
    set: {},
  });
  expect(result.success).toBe(true);
  expect(inserts[0].data.mode).toBe("sandbox");
  expect(inserts[0].data.paymentCode).toBe("original-va");
  expect(inserts[0].data.qrDataUrl).toBe("original-qr");
  expect(inserts[0].data.paymentExpiresAt).toEqual(new Date("2026-12-01T00:00:00Z"));
});
test("SaaS public checkout refuses underpayment; authenticated builder retains dynamic pricing", async () => {
  app.appType = "saas_web";
  const set: any = {};
  const result = await handleCreateSession({
    request: req(),
    body: { appId: app.id, customerEmail: "buyer@example.invalid", amount: 1 },
    set,
  });
  expect(set.status).toBe(400);
  expect(inserts).toHaveLength(0);
  const authorized = new Request(req(), {
    headers: { authorization: `Bearer ${builder.secretApiKey}` },
  });
  const valid: any = await handleCreateSession({
    request: authorized,
    body: { appId: app.id, customerEmail: "buyer@example.invalid", amount: 1000 },
    set: {},
  });
  expect(valid.success).toBe(true);
  expect(valid.amount).toBe(1000);
});
test("missing recipient returns 400 before acquiring payout lock", async () => {
  const set: any = {};
  await handleDisburse({ params: { transactionId: tx.id }, request: req(), set });
  expect(set.status).toBe(400);
  expect(updates).toHaveLength(0);
});
test("sandbox transaction cannot be cashed out after product switches to live", async () => {
  tx.mode = "sandbox";
  const set: any = {};
  await handleDisburse({ params: { transactionId: tx.id }, request: req(), set });
  expect(set.status).toBe(400);
  expect(updates).toHaveLength(0);
  expect(await matchesLicenseEnvironment({ appId: app.id, mode: "sandbox" })).toBe(false);
  expect(await matchesLicenseEnvironment({ appId: app.id, mode: "live" })).toBe(true);
});
test("single payout stores provider id and merchant reference separately", async () => {
  recipient = { accountNumber: "123", accountHolderName: "Builder", bankCode: "BCA" };
  gateway.createDisbursement = async (input: any) => ({
    id: "provider_id",
    externalId: input.externalId,
    status: "PENDING",
  });
  const result: any = await handleDisburse({
    params: { transactionId: tx.id },
    request: req(),
    set: {},
  });
  expect(result.success).toBe(true);
  expect(operation.id).toStartWith("disb_");
  expect(operation.id.length).toBeLessThanOrEqual(64);
  expect(tx.disbursementId).toBe("provider_id");
  expect(tx.disbursementExternalId).toBe(operation.id);
});
test("expired floating lease cannot be revived by heartbeat", async () => {
  expect(await LicenseLeaseService.heartbeat("lic_1", "device_A", "secret_A")).toBeNull();
  expect(new PgDialect().sqlToQuery(updates[0].where).sql).toContain("clock_timestamp()");
});
test("live heartbeat uses atomic expiry and key predicates", async () => {
  lease.expiresAt = new Date(Date.now() + 60000);
  expect(await LicenseLeaseService.heartbeat("lic_1", "device_A", "secret_A")).toBeTruthy();
  const query = new PgDialect().sqlToQuery(updates[0].where);
  expect(query.sql).toContain('"expires_at" >');
  expect(query.params).toContain("secret_A");
});
test("wrong builder delete never deletes another endpoint's deliveries", async () => {
  expect(await WebhookService.delete("attacker_builder", "victim_endpoint")).toBe(false);
  expect(deletes).toHaveLength(1);
  expect(deletes[0].table).toBe(schema.webhookEndpoints);
  expect(sqlParams(deletes[0].where)).toEqual(["victim_endpoint", "attacker_builder"]);
});
test("Xendit payout callback updates all payout members by payout identity, never checkout reference", async () => {
  const result = await handleXenditDisbursementWebhook({
    headers: { "x-callback-token": "valid" },
    body: { id: "provider_payout_1", external_id: "disb_batch_123", status: "COMPLETED" },
    set: {},
  });
  expect(result.received).toBe(true);
  expect(updates).toHaveLength(1);
  const query = new PgDialect().sqlToQuery(updates[0].where);
  expect(query.sql).toContain('"disbursement_external_id"');
  expect(query.sql).not.toContain('"xendit_external_id"');
  expect(query.sql).not.toContain('"transactions"."id" =');
  expect(query.params).toContain("provider_payout_1");
  expect(query.params).toContain("disb_batch_123");
  expect(updates[0].data.disbursementStatus).toBe("COMPLETED");
});
test("refund locks the paid transaction and selects its linked license", async () => {
  relatedLicense = {
    id: "lic_original_purchase",
    transactionId: tx.id,
    licenseKey: "TT-ORIGINAL",
    appId: app.id,
    status: "ACTIVE",
    offlineJwtGraceToken: "existing-token",
  };
  const result = await handleRefundTransaction({ params: { txId: tx.id }, body: {}, set: {} });
  expect(result.success).toBe(true);
  expect(result.data?.revokedLicenseKey).toBe("TT-ORIGINAL");
  expect(sqlParams(selections[2].where)).toEqual([tx.id]);
  expect(new PgDialect().sqlToQuery(selections[2].where).sql).toContain('"transaction_id"');
  expect(inserts.find((x) => x.table === schema.revokedTokens)?.data.jti).toBe("existing_jti");
});
test("refunding the same transaction again makes no changes", async () => {
  tx.paymentStatus = "REFUNDED";
  const set: any = {};
  const result = await handleRefundTransaction({ params: { txId: tx.id }, body: {}, set });
  expect(result.success).toBe(false);
  expect(set.status).toBe(400);
  expect(updates).toHaveLength(0);
});
test("webhook registration rejects internal network targets", async () => {
  const set: any = {};
  const result = await handleS2SCreateWebhook({
    builder,
    body: { url: "http://127.0.0.1:8081/internal", events: [] },
    set,
  });
  expect(set.status).toBe(400);
  expect(result.success).toBe(false);
  expect(inserts).toHaveLength(0);
});
for (const url of [
  "http://localhost/hook",
  "http://2130706433/hook",
  "http://[::1]/hook",
  "http://[::ffff:127.0.0.1]/hook",
  "http://169.254.169.254/",
  "http://10.0.0.1/",
  "http://user:pass@example.com/hook",
  "file:///tmp/test",
]) {
  test(`unsafe webhook URL rejected: ${url}`, () => expect(() => parseWebhookUrl(url)).toThrow());
}
test("DNS validation rejects mixed public/private answers and pins a public answer", async () => {
  const mixed = async () => [
    { address: "8.8.8.8", family: 4 },
    { address: "127.0.0.1", family: 4 },
  ];
  await expect(resolveWebhookTarget("https://example.com/hook", mixed as any)).rejects.toThrow();
  const publicOnly = async () => [{ address: "8.8.8.8", family: 4 }];
  expect(
    (await resolveWebhookTarget("https://example.com/hook", publicOnly as any)).address.address
  ).toBe("8.8.8.8");
  expect(isPublicWebhookAddress("2606:4700:4700::1111")).toBe(true);
  expect(isPublicWebhookAddress("fc00::1")).toBe(false);
  expect(isPublicWebhookAddress("2002:7f00:1::")).toBe(false);
});
test("status returns stored payment instructions consistently, with no fabricated fallback", async () => {
  tx.paymentStatus = "PENDING";
  tx.paymentProvider = "xendit";
  tx.paymentChannel = "VA_BCA";
  gateway.queryOrderStatus = async () => ({ isPaid: false });
  const input = {
    params: { txId: tx.id },
    query: { ticket: createPollTicket(tx.id) },
    request: req(),
    set: {},
  };
  const missing: any = await handleGetPaymentStatus(input);
  expect(missing.paymentCode).toBeUndefined();
  expect(missing.qrDataUrl).toBeUndefined();
  tx.paymentCode = "real-provider-va";
  tx.qrDataUrl = "real-provider-qr";
  const first: any = await handleGetPaymentStatus(input);
  const second: any = await handleGetPaymentStatus(input);
  expect(first.paymentCode).toBe("real-provider-va");
  expect(second.paymentCode).toBe(first.paymentCode);
  expect(second.qrDataUrl).toBe("real-provider-qr");
});

test("webhook transport pins the validated IP and never follows an internal redirect", async () => {
  const { sendWebhook } = await import(root + "services/security/webhookUrl.ts");
  transportCalls = [];
  expect(await sendWebhook("https://hooks.audit.test/hook", "{}", {}, 1000)).toBe(302);
  expect(transportCalls).toHaveLength(1);
  const call = transportCalls[0]!;
  expect(call.options.agent).toBe(false);
  expect(call.options.hostname).toBe("8.8.8.8");
  expect(call.options.servername).toBe("hooks.audit.test");
  expect(call.options.headers.Host).toBe("hooks.audit.test");
  let pinned: unknown;
  call.options.lookup("rebound.example", {}, (_error: unknown, address: string) => {
    pinned = address;
  });
  expect(pinned).toBe("8.8.8.8");
});

test("SaaS without a catalog price requires an authenticated backend quote", async () => {
  app.appType = "saas_web";
  app.targetPrice = 0;
  const set: any = {};
  const result = await handleCreateSession({
    request: req(),
    body: { appId: app.id, customerEmail: "buyer@example.invalid", amount: 1 },
    set,
  });
  expect(set.status).toBe(401);
  expect(result.errorCode).toBe("S2S_REQUIRED");
  expect(inserts).toHaveLength(0);
});
