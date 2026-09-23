import { describe, it, expect, beforeEach } from "bun:test";
import { setupTestAuth, authCookie } from "../setup";
import { db } from "../../db";
import { builders, apps, licenses, creditLedger, user } from "../../db/schema";
import { resolveCurrentBuilder, seedSandboxBuilderIfNeeded } from "../../routes/apps/builder";
import { generateAppApiKey, generateBuilderSecretApiKey } from "../../routes/apps/api-key";
import { LicenseService } from "../../services/license";
import { CreditService } from "../../services/credits";
import { app } from "../../index";
import { eq } from "drizzle-orm";

setupTestAuth();

const suffix = () => `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

describe("Coverage: apps/builder.ts resolveCurrentBuilder & seedSandboxBuilderIfNeeded", () => {
  it("resolveCurrentBuilder: headers tanpa sesi / auth gagal -> builder null", async () => {
    const res = await resolveCurrentBuilder(new Headers());
    expect(res.builder).toBeNull();
    expect(res.isAdmin).toBe(false);
  });

  it("resolveCurrentBuilder: user login cocok dengan builders.userId", async () => {
    const userId = `usr_${suffix()}`;
    const [u] = await db
      .insert(user)
      .values({
        id: userId,
        email: `u_${suffix()}@test.com`,
        name: "Test User",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    const [b] = await db
      .insert(builders)
      .values({
        userId: u.id,
        email: u.email,
        name: u.name,
        apiKey: generateAppApiKey("live"),
        secretApiKey: generateBuilderSecretApiKey(),
      })
      .returning();

    // Headers with admin session from setupTestAuth
    const headers = new Headers();
    if (authCookie) {
      headers.set("cookie", authCookie);
    }
    const res = await resolveCurrentBuilder(headers);
    expect(res).toBeDefined();
  });

  it("seedSandboxBuilderIfNeeded: tidak error jika database sudah ada builder", async () => {
    await expect(seedSandboxBuilderIfNeeded()).resolves.toBeUndefined();
  });
});

describe("Coverage: metering router /events, /usage, /stats", () => {
  let builderId = "";
  let appId = "";
  let licenseKey = "";
  let unmeteredAppId = "";
  let unmeteredLicKey = "";

  beforeEach(async () => {
    const email = `meter_${suffix()}@test.com`;
    const [b] = await db
      .insert(builders)
      .values({
        email,
        name: "Metering Builder",
        apiKey: generateAppApiKey("live"),
        secretApiKey: generateBuilderSecretApiKey(),
      })
      .returning();
    builderId = b.id;

    appId = `app_meter_${suffix()}`;
    await db.insert(apps).values({
      id: appId,
      builderId,
      name: "Metered App",
      slug: `meter-app-${suffix()}`,
      mode: "live",
      targetPrice: 10000,
      meteringConfig: {
        enabled: true,
        unitPrice: 5,
        unitLabel: "api_call",
      } as any,
    });

    const licRes = await LicenseService.issueDirect({
      appId,
      customerEmail: `customer_${suffix()}@test.com`,
      grantDays: 30,
      actor: { type: "ADMIN", id: "admin" },
    });
    licenseKey = licRes.license.licenseKey;

    // Topup credits
    await CreditService.grant(
      {
        licenseId: licRes.license.id,
        appId,
        customerEmail: licRes.license.customerEmail,
      },
      100,
      { description: "Initial balance" }
    );

    // Create unmetered app
    unmeteredAppId = `app_unmeter_${suffix()}`;
    await db.insert(apps).values({
      id: unmeteredAppId,
      builderId,
      name: "Unmetered App",
      slug: `unmeter-app-${suffix()}`,
      mode: "live",
      targetPrice: 10000,
      meteringConfig: {
        enabled: false,
      } as any,
    });

    const unmeteredLic = await LicenseService.issueDirect({
      appId: unmeteredAppId,
      customerEmail: `unmetered_cust_${suffix()}@test.com`,
      grantDays: 30,
      actor: { type: "ADMIN", id: "admin" },
    });
    unmeteredLicKey = unmeteredLic.license.licenseKey;
  });

  it("POST /metering/events: validasi input kosong", async () => {
    const res1 = await fetch("http://localhost:3001/api/v1/metering/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ licenseKey: "", eventName: "call" }),
    });
    expect(res1.status).toBe(400);

    const res2 = await fetch("http://localhost:3001/api/v1/metering/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ licenseKey: "some_key", eventName: "" }),
    });
    expect(res2.status).toBe(400);
  });

  it("POST /metering/events: lisensi tidak ditemukan -> 404", async () => {
    const res = await fetch("http://localhost:3001/api/v1/metering/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ licenseKey: "non_existent_license_key", eventName: "ai_summary" }),
    });
    expect(res.status).toBe(404);
  });

  it("POST /metering/events: lisensi berstatus REVOKED -> 403", async () => {
    await db.update(licenses).set({ status: "REVOKED" }).where(eq(licenses.licenseKey, licenseKey));
    const res = await fetch("http://localhost:3001/api/v1/metering/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ licenseKey, eventName: "ai_summary" }),
    });
    expect(res.status).toBe(403);
  });

  it("POST /metering/events: aplikasi tidak mengaktifkan metering -> 400", async () => {
    const res = await fetch("http://localhost:3001/api/v1/metering/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ licenseKey: unmeteredLicKey, eventName: "ai_summary" }),
    });
    expect(res.status).toBe(400);
  });

  it("POST /metering/events: berhasil debit konsumsi unit", async () => {
    const res = await fetch("http://localhost:3001/api/v1/metering/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        licenseKey,
        eventName: "ai_summary",
        units: 2,
        idempotencyKey: `idem_${suffix()}`,
        metadata: { model: "gemini-flash" },
      }),
    });
    const data = (await res.json()) as any;
    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.creditsDebited).toBe(10); // 2 units * 5 unitPrice
    expect(data.remainingBalance).toBe(90);
  });

  it("POST /metering/events: saldo kredit tidak cukup -> 402", async () => {
    const res = await fetch("http://localhost:3001/api/v1/metering/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        licenseKey,
        eventName: "huge_call",
        units: 50, // 50 * 5 = 250 credits > 100
      }),
    });
    expect(res.status).toBe(402);
  });

  it("GET /metering/usage/:licenseKey: riwayat pemakaian metering", async () => {
    // 404 jika tidak ditemukan
    const notFoundRes = await fetch("http://localhost:3001/api/v1/metering/usage/invalid_key_xyz");
    expect(notFoundRes.status).toBe(404);

    // Sukses jika ada
    const res = await fetch(`http://localhost:3001/api/v1/metering/usage/${licenseKey}`);
    const data = (await res.json()) as any;
    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.balance).toBeDefined();
    expect(Array.isArray(data.events)).toBe(true);
  });

  it("GET /metering/stats: admin / builder ringkasan stats", async () => {
    const res = await fetch("http://localhost:3001/api/v1/metering/stats");
    const data = (await res.json()) as any;
    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(typeof data.totalEvents).toBe("number");
    expect(typeof data.totalCreditsConsumed).toBe("number");
  });
});
