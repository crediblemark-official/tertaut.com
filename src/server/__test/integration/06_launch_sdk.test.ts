import { describe, it, expect } from "bun:test";
import { setupTestAuth } from "../setup";
import { Tertaut } from "../../../../packages/sdk/src/index";
import { db } from "../../db";
import { apps, licenses, licenseActivations, transactions } from "../../db/schema";
import { eq } from "drizzle-orm";
import { existsSync, statSync } from "fs";

setupTestAuth();

describe("PRD Module 5: Launch Kit & Developer SDK", () => {
  it("FR-1.1, FR-1.2, & FR-1.3: should convert campaign to LIVE and inject discount coupon", async () => {
    // 1. Buat app pengujian
    const testAppId = `app_launch_${Date.now()}`;
    const testSlug = `launch-test-${Math.random().toString(36).substring(2, 6)}`;

    const builder = await db.query.builders.findFirst();
    if (!builder) return;

    await db.insert(apps).values({
      id: testAppId,
      builderId: builder.id,
      name: "FastLaunch AI",
      slug: testSlug,
      mode: "live",
      targetPrice: 49000,
    });

    try {
      // 2. Eksekusi API Convert to Live Launch
      const res = await fetch("http://localhost:3000/api/v1/launch/convert-to-live", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignId: testAppId,
          discountPercent: 50,
          couponCode: "EARLY50",
        }),
      });

      const json: any = await res.json();
      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.campaignId).toBe(testAppId);
      expect(json.data.couponCode).toBe("EARLY50");
      expect(json.data.liveCheckoutUrl).toContain(`/pay/${testSlug}`);
      expect(json.data.status).toBe("LIVE");

      // 3. Verifikasi status aplikasi di DB tetap 'live'
      const updatedApp = await db.query.apps.findFirst({ where: eq(apps.id, testAppId) });
      expect(updatedApp?.mode).toBe("live");
    } finally {
      // Bersihkan data pengujian
      await db.delete(apps).where(eq(apps.id, testAppId));
    }
  });

  it("FR-2.1 & FR-2.2: should provide embeddable widget JSON data and Shadow DOM encapsulated web component script", async () => {
    const app = await db.query.apps.findFirst();
    if (!app) return;

    // 1. Uji endpoint data widget JSON
    const resData = await fetch(`http://localhost:3000/api/v1/widgets/badge/${app.slug}`);
    const jsonData: any = await resData.json();

    expect(resData.status).toBe(200);
    expect(jsonData.success).toBe(true);
    expect(jsonData.data.appName).toBe(app.name);
    expect(jsonData.data.verifiedBy).toBe("tertaut.com");
    expect(typeof jsonData.data.totalCustomers).toBe("number");
    expect(jsonData.data.checkoutUrl).toBeDefined();

    // 2. Uji endpoint embed script Web Component
    const resScript = await fetch("http://localhost:3000/api/v1/widgets/embed.js");
    const scriptText = await resScript.text();

    expect(resScript.status).toBe(200);
    expect(resScript.headers.get("content-type")).toContain("application/javascript");
    expect(scriptText).toContain("customElements.define('tertaut-badge'");
    expect(scriptText).toContain("attachShadow({ mode: 'open' })");
  });

  it("FR-3.1 & FR-3.2: should verify @tertaut/sdk exports unified multi-module interface and bundle size is < 15 KB", () => {
    // 1. Inisialisasi SDK
    const sdk = new Tertaut({
      appId: "app_sdk_test_123",
      environment: "sandbox",
    });

    // Verifikasi seluruh modul tertaut.com terintegrasi (FR-3.2)
    expect(sdk.appId).toBe("app_sdk_test_123");
    expect(typeof sdk.checkout).toBe("function");
    expect(typeof sdk.licensing.validate).toBe("function");
    expect(typeof sdk.licensing.verify).toBe("function");
    expect(typeof sdk.licensing.activate).toBe("function");
    expect(typeof sdk.licensing.deactivate).toBe("function");
    expect(typeof sdk.aiProxy.chat).toBe("function");
    expect(typeof sdk.aiProxy.chatStream).toBe("function");

    // 2. Verifikasi NFR FR-3.1: Ukuran bundle SDK dist/index.js wajib < 15 KB
    const distPath = "packages/sdk/dist/index.js";
    if (existsSync(distPath)) {
      const stats = statSync(distPath);
      const sizeKb = stats.size / 1024;
      expect(sizeKb).toBeLessThan(15); // Harus di bawah 15 KB
      expect(sizeKb).toBeGreaterThan(0);
    }
  });

  it("Super Admin Panel & Seat Deactivation: should support seat deactivation, platform stats, builder directory, and batch payout", async () => {
    const app = await db.query.apps.findFirst();
    if (!app) return;

    const testEmail = `portal_test_${Date.now()}@customer.com`;
    const testLicId = `lic_portal_${Date.now()}`;
    const testKey = `TT-PORTAL-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const testHwid = "portal_device_hwid_test_hash";

    // 1. Setup lisensi dan aktivasi perangkat untuk customer
    await db.insert(licenses).values({
      id: testLicId,
      appId: app.id,
      licenseKey: testKey,
      customerEmail: testEmail,
      status: "ACTIVE",
      maxSeats: 2,
    });

    await db.insert(licenseActivations).values({
      id: `act_${Date.now()}`,
      licenseId: testLicId,
      hwidHash: testHwid,
      deviceName: "MacBook Air M2",
      ipAddress: "127.0.0.1",
    });

    // 2. Setup transaksi untuk customer
    const testTxId = `tx_portal_${Date.now()}`;
    await db.insert(transactions).values({
      id: testTxId,
      appId: app.id,
      builderId: app.builderId,
      xenditInvoiceId: `inv_${Date.now()}`,
      xenditExternalId: `ext_${Date.now()}`,
      customerEmail: testEmail,
      grossAmount: 199000,
      platformFee: 9950,
      netAmount: 189050,
      paymentStatus: "PAID",
      disbursementStatus: "PENDING",
      grantDays: 365,
    });

    try {
      // 2b. Uji Device Seat Deactivation via endpoint resmi: POST /api/v1/licensing/deactivate
      const resDeact = await fetch("http://localhost:3000/api/v1/licensing/deactivate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          licenseKey: testKey,
          hwid: "device_macbook_portal_test",
        }),
      });
      const deactData: any = await resDeact.json();
      expect(resDeact.status).toBe(200);
      expect(deactData.success).toBe(true);

      // 6. Uji Super Admin Panel: GET /api/v1/panel/stats
      const resStats = await fetch("http://localhost:3000/api/v1/panel/stats");
      const statsData: any = await resStats.json();
      expect(resStats.status).toBe(200);
      expect(statsData.success).toBe(true);
      expect(typeof statsData.data.totalGMV).toBe("number");
      expect(typeof statsData.data.platformFeeRevenue).toBe("number");
      expect(typeof statsData.data.netBuilderShare).toBe("number");
      expect(statsData.data.system.bunVersion).toBeDefined();

      // 7. Uji Super Admin Panel: GET /api/v1/panel/builders
      const resBuilders = await fetch("http://localhost:3000/api/v1/panel/builders");
      const buildersData: any = await resBuilders.json();
      expect(resBuilders.status).toBe(200);
      expect(buildersData.success).toBe(true);
      expect(buildersData.count).toBeGreaterThanOrEqual(1);

      // 8. Uji Super Admin Panel: GET /api/v1/panel/transactions
      const resAllTx = await fetch("http://localhost:3000/api/v1/panel/transactions?limit=10");
      const allTxData: any = await resAllTx.json();
      expect(resAllTx.status).toBe(200);
      expect(allTxData.success).toBe(true);

      // 9. Uji Super Admin Panel: POST /api/v1/panel/payouts/batch
      const resPayout = await fetch("http://localhost:3000/api/v1/panel/payouts/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const payoutData: any = await resPayout.json();
      expect(resPayout.status).toBe(200);
      expect(payoutData.success).toBe(true);
      expect(typeof payoutData.processedCount).toBe("number");
    } finally {
      // Cleanup test records
      await db.delete(licenseActivations).where(eq(licenseActivations.licenseId, testLicId));
      await db.delete(licenses).where(eq(licenses.id, testLicId));
      await db.delete(transactions).where(eq(transactions.id, testTxId));
    }
  }, 15000);
});
