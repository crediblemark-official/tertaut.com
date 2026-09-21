import { describe, it, expect, beforeAll } from "bun:test";
import { setupTestAuth, authCookie } from "../setup";
import {
  handleGetBuilderMyself,
  handleListApps,
  handleStatsOverview,
  handleStatsCatalog,
  handleCheckSlug,
  handleGetBySlug,
} from "../../routes/apps/queries";
import { resolveCurrentBuilder, seedSandboxBuilderIfNeeded } from "../../routes/apps/builder";
import { DanaService } from "../../services/dana";
import { db } from "../../db";
import { apps, builders, transactions, coupons } from "../../db/schema";
import { eq } from "drizzle-orm";
import { generateAppApiKey } from "../../routes/apps/api-key";

setupTestAuth();

describe("Apps Queries, Builder Resolution, Badges, and Coupons", () => {
  let testApp: any;
  let testBuilder: any;
  let adminHeaders: Headers;

  beforeAll(async () => {
    adminHeaders = new Headers({ cookie: authCookie });
    const bList = await db.query.builders.findMany({ limit: 1 });
    if (bList.length > 0) {
      testBuilder = bList[0];
    } else {
      const [b] = await db.insert(builders).values({
        name: "Queries Builder",
        email: `q_${Date.now()}@test.com`,
        apiKey: generateAppApiKey("live"),
      }).returning();
      testBuilder = b;
    }

    const testSlug = `app-query-${Date.now()}`;
    const [a] = await db.insert(apps).values({
      id: `app_q_${Date.now()}`,
      name: "Query Test App",
      slug: testSlug,
      builderId: testBuilder.id,
      mode: "live",
      targetPrice: 50000,
    }).returning();
    testApp = a;
  });

  it("should test apps queries handlers (getBuilderMyself, listApps, stats, checkSlug, getBySlug)", async () => {
    const set: any = {};

    // 1. handleGetBuilderMyself with no auth (401)
    const noAuthRes = await handleGetBuilderMyself({ request: { headers: new Headers() }, set });
    expect(set.status).toBe(401);

    // handleGetBuilderMyself with admin headers
    const selfRes = await handleGetBuilderMyself({ request: { headers: adminHeaders }, set: {} });
    expect(selfRes.success).toBe(true);
    expect(selfRes.builder).toBeDefined();

    // 2. handleListApps (with and without mode query)
    const listAll = await handleListApps({ query: {}, request: { headers: adminHeaders } });
    expect(Array.isArray(listAll.apps)).toBe(true);

    const listLive = await handleListApps({ query: { mode: "live" }, request: { headers: adminHeaders } });
    expect(Array.isArray(listLive.apps)).toBe(true);

    // 3. handleStatsOverview & handleStatsCatalog
    const statsOverview = await handleStatsOverview({ query: { mode: "live" }, request: { headers: adminHeaders } });
    expect(statsOverview).toBeDefined();

    const statsCatalog = await handleStatsCatalog({ query: {}, request: { headers: adminHeaders } });
    expect(statsCatalog).toBeDefined();

    // 4. handleCheckSlug
    const checkTaken = await handleCheckSlug({ params: { slug: testApp.slug } });
    expect(checkTaken.available).toBe(false);

    const checkAvailable = await handleCheckSlug({ params: { slug: `unique-slug-${Date.now()}` } });
    expect(checkAvailable.available).toBe(true);

    // 5. handleGetBySlug
    const getNotFound = await handleGetBySlug({ params: { slug: "non-existent-slug-000" }, set });
    expect(set.status).toBe(404);

    const getFound = await handleGetBySlug({ params: { slug: testApp.slug }, set: {} });
    expect(getFound.id).toBe(testApp.id);
    expect(getFound.slug).toBe(testApp.slug);

    // 6. builder.ts resolveCurrentBuilder & seedSandboxBuilderIfNeeded
    const actor = await resolveCurrentBuilder(adminHeaders);
    expect(actor.isAdmin).toBe(true);

    await seedSandboxBuilderIfNeeded();
  });

  it("should test Badge and Widget endpoints over HTTP app.handle", async () => {
    // 1. GET /badge/:slug for Live app
    const liveBadgeRes = await fetch(`http://localhost:3000/badge/${testApp.slug}`);
    expect(liveBadgeRes.status).toBe(200);
    expect(liveBadgeRes.headers.get("content-type")).toContain("image/svg+xml");
    const liveSvg = await liveBadgeRes.text();
    expect(liveSvg).toContain("Verified • MoR Protected");

    // 2. GET /badge/:slug for Non-existent app
    const missingBadgeRes = await fetch("http://localhost:3000/badge/non-existent-app-999");
    expect(missingBadgeRes.status).toBe(200);
    const missingSvg = await missingBadgeRes.text();
    expect(missingSvg).toContain("unverified");

    // 3. GET /api/v1/widgets/badge/:app_slug
    const widgetRes = await fetch(`http://localhost:3000/api/v1/widgets/badge/${testApp.slug}`);
    expect(widgetRes.status).toBe(200);
    const widgetData: any = await widgetRes.json();
    expect(widgetData.success).toBe(true);
    expect(widgetData.data).toBeDefined();

    // 4. GET /api/v1/widgets/badge/:app_slug for 404
    const widget404 = await fetch("http://localhost:3000/api/v1/widgets/badge/does-not-exist");
    expect(widget404.status).toBe(404);

    // 5. GET /api/v1/widgets/embed.js
    const embedRes = await fetch("http://localhost:3000/api/v1/widgets/embed.js");
    expect(embedRes.status).toBe(200);
    expect(embedRes.headers.get("content-type")).toContain("javascript");
    const scriptText = await embedRes.text();
    expect(scriptText).toContain("tertaut-badge");
  });

  it("should test Coupons router CRUD & stats over HTTP app.handle", async () => {
    // 1. GET /api/v1/coupons/
    const listRes = await fetch("http://localhost:3000/api/v1/coupons/");
    expect(listRes.status).toBe(200);
    const listData: any = await listRes.json();
    expect(listData.success).toBe(true);

    // 2. GET /api/v1/coupons/stats
    const statsRes = await fetch("http://localhost:3000/api/v1/coupons/stats?days=30");
    expect(statsRes.status).toBe(200);
    const statsData: any = await statsRes.json();
    expect(statsData.success).toBe(true);

    // 3. POST /api/v1/coupons validations
    // App not found (404)
    const errAppRes = await fetch("http://localhost:3000/api/v1/coupons/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appId: "non_existent_app", code: "PROMO10", discountPercent: 10 }),
    });
    expect(errAppRes.status).toBe(404);

    // Invalid coupon code format
    const errCodeRes = await fetch("http://localhost:3000/api/v1/coupons/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appId: testApp.id, code: "!", discountPercent: 10 }),
    });
    expect([400, 422]).toContain(errCodeRes.status);

    // Invalid discountPercent
    const errDiscRes = await fetch("http://localhost:3000/api/v1/coupons/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appId: testApp.id, code: "PROMO150", discountPercent: 150 }),
    });
    expect([400, 422]).toContain(errDiscRes.status);

    // Valid create
    const couponCode = `SAVE${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const createRes = await fetch("http://localhost:3000/api/v1/coupons/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        appId: testApp.id,
        code: couponCode,
        discountPercent: 15,
        maxRedemptions: 50,
      }),
    });
    expect(createRes.status).toBe(200);
    const createData: any = await createRes.json();
    expect(createData.success).toBe(true);
    const couponId = createData.coupon.id;

    // Duplicate create (409)
    const clashRes = await fetch("http://localhost:3000/api/v1/coupons/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        appId: testApp.id,
        code: couponCode,
        discountPercent: 15,
      }),
    });
    expect(clashRes.status).toBe(409);

    // 4. PATCH /api/v1/coupons/:couponId (toggle active / update quota)
    const patchRes = await fetch(`http://localhost:3000/api/v1/coupons/${couponId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: false, maxRedemptions: 25 }),
    });
    expect(patchRes.status).toBe(200);
    const patchData: any = await patchRes.json();
    expect(patchData.success).toBe(true);
    expect(patchData.coupon.isActive).toBe(false);

    // 5. DELETE /api/v1/coupons/:couponId
    const delRes = await fetch(`http://localhost:3000/api/v1/coupons/${couponId}`, {
      method: "DELETE",
    });
    expect(delRes.status).toBe(200);
    const delData: any = await delRes.json();
    expect(delData.success).toBe(true);

    // Delete 404
    const del404 = await fetch(`http://localhost:3000/api/v1/coupons/${couponId}`, {
      method: "DELETE",
    });
    expect(del404.status).toBe(404);
  });

  it("should test DanaService (calculateMorBreakdown, createOrder, verifyWebhook, createDisbursement)", async () => {
    // 1. calculateMorBreakdown
    const mor = DanaService.calculateMorBreakdown(100000);
    expect(mor.grossAmount).toBe(100000);
    expect(mor.platformFee).toBe(5000);
    expect(mor.netAmount).toBe(95000);

    // 2. createOrder (forceMock)
    const order = await DanaService.createOrder({
      externalId: `dana_order_${Date.now()}`,
      amount: 75000,
      payerEmail: "buyer@dana.com",
      description: "Test Order",
      forceMock: true,
    });
    expect(order.orderId).toBeDefined();
    expect(order.checkoutUrl).toContain("checkout/dana/finish");

    // 3. verifyWebhook
    const validWebhook = DanaService.verifyWebhook({}, { status: "PAID" });
    expect(typeof validWebhook).toBe("boolean");

    const missingSig = DanaService.verifyWebhook({}, "{}");
    expect(typeof missingSig).toBe("boolean");

    // 4. createDisbursement with mock fetch
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (url: any, init: any) => {
      const urlStr = typeof url === "string" ? url : url?.url || "";
      if (urlStr.includes("dana/v1/disbursement")) {
        return new Response(JSON.stringify({ acquirementId: "dana_disb_mock_123" }), { status: 200 });
      }
      return originalFetch(url, init);
    }) as any;

    try {
      const disb = await DanaService.createDisbursement({
        externalId: `dana_disb_${Date.now()}`,
        amount: 50000,
        bankCode: "BCA",
        accountHolderName: "John Dana",
        accountNumber: "12345678",
        description: "Payout Dana",
      });
      expect(disb.id).toBeDefined();
      expect(disb.status).toBe("COMPLETED");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
