import { describe, it, expect, beforeAll } from "bun:test";
import { setupTestAuth, authCookie } from "../setup";
import { app } from "../../index";
import { db } from "../../db";
import { apps, builders, licenses, user } from "../../db/schema";
import { randomBytes } from "crypto";

describe("Super Admin Panel Comprehensive Features", () => {
  setupTestAuth();

  let testBuilder: any;
  let testApp: any;
  let testLicense: any;
  let testUser: any;

  beforeAll(async () => {
    // 1. Create builder
    const [b] = await db
      .insert(builders)
      .values({
        name: "Feature Test Builder",
        email: `feat_builder_${randomBytes(4).toString("hex")}@test.com`,
        apiKey: `tt_test_${randomBytes(8).toString("hex")}`,
        secretApiKey: `tt_secret_${randomBytes(16).toString("hex")}`,
      })
      .returning();
    testBuilder = b;

    // 2. Create app
    const [a] = await db
      .insert(apps)
      .values({
        id: `app_feat_${randomBytes(4).toString("hex")}`,
        name: "Feature Test Software",
        slug: `feat-test-${randomBytes(4).toString("hex")}`,
        builderId: b.id,
        mode: "live",
        targetPrice: 250000,
        pricingType: "one_time",
      })
      .returning();
    testApp = a;

    // 3. Create license
    const [lic] = await db
      .insert(licenses)
      .values({
        id: `lic_feat_${randomBytes(6).toString("hex")}`,
        appId: a.id,
        customerEmail: "feat_customer@test.com",
        licenseKey: `TT-FEAT-${randomBytes(4).toString("hex").toUpperCase()}`,
        status: "ACTIVE",
      })
      .returning();
    testLicense = lic;

    // 4. Create user for role & ban test
    const [u] = await db
      .insert(user)
      .values({
        id: `usr_feat_${randomBytes(6).toString("hex")}`,
        name: "Feature Test User",
        email: `feat_user_${randomBytes(4).toString("hex")}@test.com`,
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        role: "user",
      })
      .returning();
    testUser = u;
  });

  it("GET /api/v1/panel/apps: returns all software with builder info", async () => {
    const res = await app.handle(
      new Request("http://localhost:8081/api/v1/panel/apps", {
        headers: { cookie: authCookie },
      })
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(Array.isArray(json.apps)).toBe(true);
    const found = json.apps.find((x: any) => x.id === testApp.id);
    expect(found).toBeDefined();
    expect(found.name).toBe("Feature Test Software");
    expect(found.builderName).toBe("Feature Test Builder");
  });

  it("GET /api/v1/panel/export/apps: exports apps to CSV", async () => {
    const res = await app.handle(
      new Request("http://localhost:8081/api/v1/panel/export/apps", {
        headers: { cookie: authCookie },
      })
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
    const csv = await res.text();
    expect(csv).toContain("Feature Test Software");
  });

  it("GET /api/v1/panel/licenses: lists licenses with search and filters", async () => {
    const res = await app.handle(
      new Request(
        `http://localhost:8081/api/v1/panel/licenses?search=${encodeURIComponent(testLicense.licenseKey)}`,
        {
          headers: { cookie: authCookie },
        }
      )
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.licenses.length).toBeGreaterThanOrEqual(1);
    expect(json.licenses[0].licenseKey).toBe(testLicense.licenseKey);
  });

  it("POST /api/v1/panel/licenses/:id/revoke & reactivate: revokes and reactivates license", async () => {
    // Revoke
    const revokeRes = await app.handle(
      new Request(`http://localhost:8081/api/v1/panel/licenses/${testLicense.id}/revoke`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: authCookie,
        },
        body: JSON.stringify({ reason: "Uji coba pencabutan manual" }),
      })
    );
    expect(revokeRes.status).toBe(200);
    const revokeJson = await revokeRes.json();
    expect(revokeJson.success).toBe(true);
    expect(revokeJson.status).toBe("REVOKED");

    // Reactivate
    const reactivateRes = await app.handle(
      new Request(`http://localhost:8081/api/v1/panel/licenses/${testLicense.id}/reactivate`, {
        method: "POST",
        headers: { cookie: authCookie },
      })
    );
    expect(reactivateRes.status).toBe(200);
    const reactivateJson = await reactivateRes.json();
    expect(reactivateJson.success).toBe(true);
    expect(reactivateJson.status).toBe("ACTIVE");
  });

  it("GET /api/v1/panel/export/licenses: exports licenses to CSV", async () => {
    const res = await app.handle(
      new Request("http://localhost:8081/api/v1/panel/export/licenses", {
        headers: { cookie: authCookie },
      })
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
    const csv = await res.text();
    expect(csv).toContain(testLicense.licenseKey);
  });

  it("Coupons lifecycle: create global coupon, toggle, list, and delete", async () => {
    const code = `PANEL${randomBytes(3).toString("hex").toUpperCase()}`;

    // 1. Create global coupon
    const createRes = await app.handle(
      new Request("http://localhost:8081/api/v1/panel/coupons", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: authCookie,
        },
        body: JSON.stringify({
          code,
          discountPercent: 25,
          maxRedemptions: 50,
        }),
      })
    );
    expect(createRes.status).toBe(200);
    const createJson = await createRes.json();
    expect(createJson.success).toBe(true);
    const couponId = createJson.coupon.id;

    // 2. List coupons
    const listRes = await app.handle(
      new Request("http://localhost:8081/api/v1/panel/coupons", {
        headers: { cookie: authCookie },
      })
    );
    expect(listRes.status).toBe(200);
    const listJson = await listRes.json();
    expect(listJson.success).toBe(true);
    const found = listJson.coupons.find((c: any) => c.code === code);
    expect(found).toBeDefined();
    expect(found.isGlobal).toBe(true);
    expect(found.discountPercent).toBe(25);

    // 3. Toggle active
    const toggleRes = await app.handle(
      new Request(`http://localhost:8081/api/v1/panel/coupons/${couponId}/toggle`, {
        method: "PATCH",
        headers: { cookie: authCookie },
      })
    );
    expect(toggleRes.status).toBe(200);
    const toggleJson = await toggleRes.json();
    expect(toggleJson.isActive).toBe(false);

    // 4. Delete coupon
    const deleteRes = await app.handle(
      new Request(`http://localhost:8081/api/v1/panel/coupons/${couponId}`, {
        method: "DELETE",
        headers: { cookie: authCookie },
      })
    );
    expect(deleteRes.status).toBe(200);
    const deleteJson = await deleteRes.json();
    expect(deleteJson.success).toBe(true);
  });

  it("GET /api/v1/panel/audit-logs: returns audit logs", async () => {
    const res = await app.handle(
      new Request("http://localhost:8081/api/v1/panel/audit-logs?limit=50", {
        headers: { cookie: authCookie },
      })
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(Array.isArray(json.logs)).toBe(true);
  });

  it("Users lifecycle: list users, update role, and toggle ban", async () => {
    // 1. List
    const listRes = await app.handle(
      new Request("http://localhost:8081/api/v1/panel/users", {
        headers: { cookie: authCookie },
      })
    );
    expect(listRes.status).toBe(200);
    const listJson = await listRes.json();
    expect(listJson.success).toBe(true);
    const found = listJson.users.find((u: any) => u.id === testUser.id);
    expect(found).toBeDefined();

    // 2. Update role
    const roleRes = await app.handle(
      new Request(`http://localhost:8081/api/v1/panel/users/${testUser.id}/role`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: authCookie,
        },
        body: JSON.stringify({ role: "admin" }),
      })
    );
    expect(roleRes.status).toBe(200);
    const roleJson = await roleRes.json();
    expect(roleJson.success).toBe(true);
    expect(roleJson.role).toBe("admin");

    // 3. Toggle ban
    const banRes = await app.handle(
      new Request(`http://localhost:8081/api/v1/panel/users/${testUser.id}/toggle-ban`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: authCookie,
        },
        body: JSON.stringify({ reason: "Akun melanggar TOS" }),
      })
    );
    expect(banRes.status).toBe(200);
    const banJson = await banRes.json();
    expect(banJson.success).toBe(true);
    expect(banJson.banned).toBe(true);

    // 4. Unban
    const unbanRes = await app.handle(
      new Request(`http://localhost:8081/api/v1/panel/users/${testUser.id}/toggle-ban`, {
        method: "POST",
        headers: { cookie: authCookie },
      })
    );
    expect(unbanRes.status).toBe(200);
    const unbanJson = await unbanRes.json();
    expect(unbanJson.banned).toBe(false);
  });
});
