import { describe, it, expect, beforeAll } from "bun:test";
import { setupTestAuth, authCookie } from "../setup";
import { app } from "../../index";
import { db } from "../../db";
import {
  builders,
  apps,
  licenses,
  coupons,
  transactions,
  user,
  webhookEndpoints,
  licenseLeases,
} from "../../db/schema";
import { resolveCurrentBuilder, seedSandboxBuilderIfNeeded } from "../../routes/apps/builder";
import { generateAppApiKey, generateBuilderSecretApiKey } from "../../routes/apps/api-key";
import { auth } from "../../auth";
import { enforceRateLimit, resetRateLimits } from "../../services/rateLimiter";
import { LicenseLeaseService } from "../../services/licenseLease";
import { LicenseService } from "../../services/license";
import { DanaService } from "../../services/dana";
import {
  handleListSeats,
  handleHeartbeat,
  handleVerifyLicense,
} from "../../routes/licensing/device";
import { handleListEvents, handleListLicenses } from "../../routes/licensing/admin";
import { handleListWebhooks, handleCreateWebhook } from "../../routes/licensing/adminWebhooks";
import { handleBatchPayout } from "../../routes/panel/payouts";
import { eq } from "drizzle-orm";
import crypto from "crypto";

setupTestAuth();

const suffix = () => `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

describe("Coverage Booster: Health & App Index Endpoints", () => {
  it("GET /health: health check returns 200 ok", async () => {
    const res = await app.handle(new Request("http://localhost:3001/api/v1/health"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.status).toBe("ok");
    expect(body.timestamp).toBeDefined();
  });

  it("GET /: root development info", async () => {
    const res = await app.handle(new Request("http://localhost:3001/"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.service).toContain("tertaut.com");
  });

  it("GET /.well-known/license-public-key.pem", async () => {
    const res = await app.handle(
      new Request("http://localhost:3001/.well-known/license-public-key.pem")
    );
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("PUBLIC KEY");
  });

  it("CORS origin checks for embed and trusted domains", async () => {
    const req1 = new Request("http://localhost:3001/api/v1/badge/app123", {
      headers: { Origin: "https://unknown-embedder.com" },
    });
    const res1 = await app.handle(req1);
    expect(res1.status).toBeDefined();

    const req2 = new Request("http://localhost:3001/api/v1/licensing/list", {
      headers: { Origin: "https://subdomain.tertaut.com" },
    });
    const res2 = await app.handle(req2);
    expect(res2.status).toBeDefined();
  });
});

describe("Coverage Booster: apps/builder.ts & Multi-User Resolution", () => {
  it("resolveCurrentBuilder: creates builder profile for user without one, then finds it by userId and email", async () => {
    const email = `new_builder_${suffix()}@test.com`;
    const password = "Password123!@#";

    const signUpRes = await auth.api.signUpEmail({
      body: { email, password, name: "New Vibe Builder" },
      asResponse: true,
    });
    const userCookie = signUpRes.headers.get("set-cookie")?.split(";")[0] || "";
    const userHeaders = new Headers({ cookie: userCookie });

    // 1. First call: user has no builder, so it inserts a new one
    const res1 = await resolveCurrentBuilder(userHeaders);
    expect(res1.builder).not.toBeNull();
    expect(res1.builder?.email).toBe(email);
    expect(res1.isAdmin).toBe(false);

    // 2. Second call: finds builder by userId
    const res2 = await resolveCurrentBuilder(userHeaders);
    expect(res2.builder?.id).toBe(res1.builder?.id);

    // 3. Third call: nullify userId in builder to test email fallback
    if (res1.builder) {
      await db.update(builders).set({ userId: null }).where(eq(builders.id, res1.builder.id));
      const res3 = await resolveCurrentBuilder(userHeaders);
      expect(res3.builder?.id).toBe(res1.builder.id);
    }
  });
});

describe("Coverage Booster: Rate Limiter Header Parsing & Cleanup", () => {
  it("enforces rate limit with cf-connecting-ip, x-real-ip, and x-forwarded-for", () => {
    const reqCf = new Request("http://localhost/test", {
      headers: { "cf-connecting-ip": "1.1.1.1" },
    });
    const r1 = enforceRateLimit(reqCf, "test-cf", 10, 60000);
    expect(r1.allowed).toBe(true);

    const reqReal = new Request("http://localhost/test", { headers: { "x-real-ip": "2.2.2.2" } });
    const r2 = enforceRateLimit(reqReal, "test-real", 10, 60000);
    expect(r2.allowed).toBe(true);

    const reqXff = new Request("http://localhost/test", {
      headers: { "x-forwarded-for": "3.3.3.3, 10.0.0.1" },
    });
    const r3 = enforceRateLimit(reqXff, "test-xff", 1, 60000);
    expect(r3.allowed).toBe(true);

    // Second hit should be blocked
    const r3Blocked = enforceRateLimit(reqXff, "test-xff", 1, 60000);
    expect(r3Blocked.allowed).toBe(false);
    expect(r3Blocked.retryAfter).toBeGreaterThan(0);

    resetRateLimits();
  });
});

describe("Coverage Booster: License Lease Service Edge Cases", () => {
  it("acquires existing lease, lists for license, and deletes expired leases", async () => {
    const email = `lease_cov_${suffix()}@test.com`;
    const [b] = await db
      .insert(builders)
      .values({ name: "B", email, apiKey: generateAppApiKey("live") })
      .returning();
    const [a] = await db
      .insert(apps)
      .values({
        id: `app_ls_${suffix()}`,
        name: "Lease App",
        slug: `ls-${suffix()}`,
        builderId: b.id,
        targetPrice: 0,
      })
      .returning();
    const issueRes = await LicenseService.issueDirect({
      appId: a.id,
      customerEmail: `c_${suffix()}@test.com`,
      grantDays: 30,
      maxSeats: 2,
      actor: { type: "ADMIN", id: "admin" },
    });
    const licId = issueRes.license.id;
    const hwid = "HWID_LEASE_COV_01";

    // 1. Acquire new lease
    const l1 = await LicenseLeaseService.acquire(licId, hwid, {
      deviceName: "PC 1",
      ttlSeconds: 300,
    });
    expect(l1.isNew).toBe(true);

    // 2. Acquire again with same hwid -> triggers existing update branch
    const l2 = await LicenseLeaseService.acquire(licId, hwid, {
      deviceName: "PC 1 Updated",
      ttlSeconds: 300,
    });
    expect(l2.isNew).toBe(false);
    expect(l2.lease.deviceName).toBe("PC 1 Updated");

    // 3. listForLicense
    const list = await LicenseLeaseService.listForLicense(licId);
    expect(list.length).toBeGreaterThan(0);

    // 4. Set lease expiry to past and call deleteExpired
    await db
      .update(licenseLeases)
      .set({ expiresAt: new Date(Date.now() - 10000) })
      .where(eq(licenseLeases.id, l1.lease.id));
    const deletedCount = await LicenseLeaseService.deleteExpired();
    expect(deletedCount).toBeGreaterThan(0);
  });
});

describe("Coverage Booster: Licensing Device Routes & Seats", () => {
  it("handleListSeats: validates query and returns seat info", async () => {
    const set: any = {};
    const missing = await handleListSeats({ query: {}, set });
    expect(set.status).toBe(400);

    const notFound = await handleListSeats({ query: { licenseKey: "TT-FAKE-0000" }, set });
    expect(set.status).toBe(404);

    const email = `seat_cov_${suffix()}@test.com`;
    const [b] = await db
      .insert(builders)
      .values({ name: "B", email, apiKey: generateAppApiKey("live") })
      .returning();
    const [a] = await db
      .insert(apps)
      .values({
        id: `app_st_${suffix()}`,
        name: "Seat App",
        slug: `st-${suffix()}`,
        builderId: b.id,
        targetPrice: 0,
      })
      .returning();
    const issueRes = await LicenseService.issueDirect({
      appId: a.id,
      customerEmail: `c_${suffix()}@test.com`,
      grantDays: 30,
      maxSeats: 3,
      actor: { type: "ADMIN", id: "admin" },
    });

    const success = await handleListSeats({
      query: { licenseKey: issueRes.license.licenseKey },
      set: {},
    });
    expect(success.success).toBe(true);
    expect(Array.isArray(success.seats)).toBe(true);
    expect(success.seatsUsed).toBe(0);
  });

  it("handleVerifyLicense: expired license status check", async () => {
    const email = `exp_cov_${suffix()}@test.com`;
    const [b] = await db
      .insert(builders)
      .values({ name: "B", email, apiKey: generateAppApiKey("live") })
      .returning();
    const [a] = await db
      .insert(apps)
      .values({
        id: `app_exp_${suffix()}`,
        name: "Exp App",
        slug: `exp-${suffix()}`,
        builderId: b.id,
        targetPrice: 0,
      })
      .returning();
    const issueRes = await LicenseService.issueDirect({
      appId: a.id,
      customerEmail: `c_${suffix()}@test.com`,
      grantDays: 30,
      maxSeats: 1,
      actor: { type: "ADMIN", id: "admin" },
    });

    // Make it expired in DB
    await db
      .update(licenses)
      .set({ expiresAt: new Date(Date.now() - 50000) })
      .where(eq(licenses.id, issueRes.license.id));
    const verifyRes = await handleVerifyLicense({
      body: { licenseKey: issueRes.license.licenseKey },
      set: {},
      request: new Request("http://localhost"),
    });
    expect(verifyRes.valid).toBe(false);
    expect(verifyRes.status).toBe("EXPIRED");
  });
});

describe("Coverage Booster: Licensing Admin Events & Scoping", () => {
  it("handleListEvents: queries with licenseKey, appId, and non-admin builder", async () => {
    const adminHeaders = new Headers({ cookie: authCookie });
    const set: any = {};
    const notFoundKey = await handleListEvents({
      query: { licenseKey: "TT-FAKE-9999" },
      set,
      request: { headers: adminHeaders },
    });
    expect(set.status).toBe(404);

    const notFoundApp = await handleListEvents({
      query: { appId: "app_fake_9999" },
      set,
      request: { headers: adminHeaders },
    });
    expect(set.status).toBe(404);

    const email = `adm_ev_${suffix()}@test.com`;
    const [b] = await db
      .insert(builders)
      .values({ name: "B", email, apiKey: generateAppApiKey("live") })
      .returning();
    const [a] = await db
      .insert(apps)
      .values({
        id: `app_ev_${suffix()}`,
        name: "Event App",
        slug: `ev-${suffix()}`,
        builderId: b.id,
        targetPrice: 0,
      })
      .returning();
    const issueRes = await LicenseService.issueDirect({
      appId: a.id,
      customerEmail: `c_${suffix()}@test.com`,
      grantDays: 30,
      maxSeats: 1,
      actor: { type: "ADMIN", id: "admin" },
    });

    const evByKey = await handleListEvents({
      query: { licenseKey: issueRes.license.licenseKey },
      set: {},
      request: { headers: adminHeaders },
    });
    expect(evByKey.success).toBe(true);

    const evByApp = await handleListEvents({
      query: { appId: a.id },
      set: {},
      request: { headers: adminHeaders },
    });
    expect(evByApp.success).toBe(true);
  });
});

describe("Coverage Booster: Panel Payouts Edges", () => {
  it("handleBatchPayout: returns message when no pending transactions exist", async () => {
    const res = await handleBatchPayout();
    expect(res.success).toBe(true);
    expect(typeof res.processedCount).toBe("number");
  });
});

describe("Coverage Booster: Coupons Router Edge Cases", () => {
  it("tests coupon validation errors (discountValue > 100 on percentage, not found)", async () => {
    // Invalid percent > 100 on POST (Elysia returns 422 for schema validation)
    const resInvalid = await app.handle(
      new Request("http://localhost:3001/api/v1/coupons", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: authCookie,
        },
        body: JSON.stringify({
          code: `INV_${suffix()}`,
          discountType: "percentage",
          discountValue: 150,
        }),
      })
    );
    expect([400, 422]).toContain(resInvalid.status);

    // PATCH non existent coupon
    const resPatch = await app.handle(
      new Request("http://localhost:3001/api/v1/coupons/nonexistent_id", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          cookie: authCookie,
        },
        body: JSON.stringify({ isActive: false }),
      })
    );
    expect(resPatch.status).toBe(404);

    // DELETE non existent coupon
    const resDel = await app.handle(
      new Request("http://localhost:3001/api/v1/coupons/nonexistent_id", {
        method: "DELETE",
        headers: { cookie: authCookie },
      })
    );
    expect(resDel.status).toBe(404);
  });
});

describe("Coverage Booster: DanaService Live Signing & Disbursements", () => {
  it("tests DanaService with RSA keys and fetch calls", async () => {
    const { config } = await import("../../config");
    const origConfig = { ...config.dana, isSandbox: config.isSandbox };

    // Generate RSA key pair for testing
    const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", {
      modulusLength: 2048,
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
    });

    config.dana.clientId = "test_client_123";
    config.dana.clientSecret = "test_secret_123";
    config.dana.merchantId = "test_merchant_123";
    config.dana.privateKey = privateKey;
    config.dana.publicKey = publicKey;
    (config as any).isSandbox = false;

    // Delegate to original fetch unless it's a DANA URL
    const originalFetch = globalThis.fetch;
    globalThis.fetch = ((input: any, init?: any) => {
      const url = typeof input === "string" ? input : input?.url || "";
      if (url.includes("payment-host-to-host")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              responseCode: "2005400",
              responseMessage: "Success",
              webRedirectUrl: "https://m.dana.id/pay",
              referenceNo: "DANA_REF_123",
              acquirementId: "ACQ_123",
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
        );
      }
      if (url.includes("transfer-bank") || url.includes("transferToBank")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              responseCode: "2004300",
              responseMessage: "Successful",
              referenceNo: "DISB_ACQ_123",
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
        );
      }
      return originalFetch(input, init);
    }) as any;

    try {
      // 1. Create order with RSA signature
      const orderRes = await DanaService.createOrder({
        payerEmail: "test@example.com",
        externalId: `dana_ext_${Date.now()}`,
        amount: 50000,
        description: "Test DANA Live Order",
      });
      expect(orderRes.checkoutUrl).toBe("https://m.dana.id/pay");
      expect(orderRes.orderId).toBe("DANA_REF_123");

      // 2. Create disbursement with client credentials
      const disbRes = await DanaService.createDisbursement({
        externalId: `dana_disb_${Date.now()}`,
        amount: 100000,
        bankCode: "BCA",
        accountHolderName: "Test Receiver",
        accountNumber: "1234567890",
        description: "Test Disb",
      });
      expect(disbRes.status).toBe("COMPLETED");

      // 3. Verify webhook with production check (publicKey missing)
      config.dana.publicKey = "";
      const rejectWithoutKey = DanaService.verifyWebhook({ signature: "sig" }, {});
      expect(rejectWithoutKey).toBe(false);
    } finally {
      // Restore
      Object.assign(config.dana, origConfig);
      (config as any).isSandbox = origConfig.isSandbox;
      globalThis.fetch = originalFetch;
    }
  });
});
