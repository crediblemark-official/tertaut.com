import { describe, it, expect, beforeAll } from "bun:test";
import { setupTestAuth, authCookie } from "../setup";
import { app } from "../../index";
import { db } from "../../db";
import {
  apps,
  transactions,
  licenses,
  builders,
  revokedTokens,
  platformSettings,
} from "../../db/schema";
import { eq } from "drizzle-orm";
import { createPollTicket } from "../../utils/pollTicket";
import { randomBytes } from "crypto";

describe("Super Admin Operations & MoR Business Engine", () => {
  setupTestAuth();

  let testBuilder: any;
  let testApp: any;
  let testTx: any;
  let testLicense: any;
  let testTicket: string;

  beforeAll(async () => {
    // Buat builder untuk pengujian
    const [b] = await db
      .insert(builders)
      .values({
        name: "Test Ops Builder",
        email: `ops_builder_${randomBytes(4).toString("hex")}@test.com`,
        apiKey: `tt_test_${randomBytes(8).toString("hex")}`,
        secretApiKey: `tt_secret_${randomBytes(16).toString("hex")}`,
        disbursementAccount: {
          bankCode: "BCA",
          accountNumber: "1234567890",
          accountHolderName: "Test Ops Builder",
        },
      })
      .returning();
    testBuilder = b;

    // Buat aplikasi
    const [a] = await db
      .insert(apps)
      .values({
        id: `app_ops_${randomBytes(4).toString("hex")}`,
        name: "Ops Test Software",
        slug: `ops-test-${randomBytes(4).toString("hex")}`,
        builderId: b.id,
        mode: "sandbox",
        targetPrice: 111000,
        pricingType: "one_time",
      })
      .returning();
    testApp = a;

    // Buat transaksi PAID
    const txId = `tx_ops_${randomBytes(6).toString("hex")}`;
    const [tx] = await db
      .insert(transactions)
      .values({
        id: txId,
        appId: a.id,
        builderId: b.id,
        customerEmail: "buyer_ops@test.com",
        grossAmount: 111000,
        platformFee: 5550,
        netAmount: 105450,
        paymentStatus: "PAID",
        disbursementStatus: "PENDING",
        xenditExternalId: `ext_${txId}`,
        mockOrder: true,
        grantDays: 60,
      })
      .returning();
    testTx = tx;
    testTicket = createPollTicket(tx.id);

    // Buat lisensi terkait
    const [lic] = await db
      .insert(licenses)
      .values({
        id: `lic_ops_${randomBytes(6).toString("hex")}`,
        appId: a.id,
        customerEmail: "buyer_ops@test.com",
        licenseKey: `TT-${randomBytes(4).toString("hex").toUpperCase()}-${randomBytes(4).toString("hex").toUpperCase()}`,
        transactionId: tx.id,
        status: "ACTIVE",
        expiresAt: new Date(Date.now() + 60 * 86400 * 1000),
      })
      .returning();
    testLicense = lic;
  });

  // 1. Invoice & E-Receipt
  it("GET /api/v1/checkout/invoice/:txId: generates official invoice with ticket", async () => {
    // Tanpa ticket atau admin cookie -> 403
    const unauthRes = await app.handle(
      new Request(`http://localhost:8081/api/v1/checkout/invoice/${testTx.id}`)
    );
    expect(unauthRes.status).toBe(403);

    // Dengan pollTicket valid -> 200 dengan data DPP & PPN 11%
    const res = await app.handle(
      new Request(`http://localhost:8081/api/v1/checkout/invoice/${testTx.id}?ticket=${testTicket}`)
    );
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.success).toBe(true);
    expect(json.invoice.invoiceNumber).toMatch(/^INV-/);
    expect(json.invoice.financials.grossAmount).toBe(111000);
    expect(json.invoice.financials.dpp).toBe(100000);
    expect(json.invoice.financials.ppn11).toBe(11000);
    expect(json.invoice.licenseKey).toBe(testLicense.licenseKey);
  });

  // 2. Refund & Auto-Revoke
  it("POST /api/v1/panel/transactions/:txId/refund: refunds payment and revokes license", async () => {
    const res = await app.handle(
      new Request(`http://localhost:8081/api/v1/panel/transactions/${testTx.id}/refund`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: authCookie,
        },
        body: JSON.stringify({ reason: "Uji coba refund customer" }),
      })
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.paymentStatus).toBe("REFUNDED");
    expect(json.data.disbursementStatus).toBe("CANCELLED");

    // Periksa bahwa status lisensi di database berubah menjadi REVOKED
    const updatedLic = await db.query.licenses.findFirst({
      where: eq(licenses.id, testLicense.id),
    });
    expect(updatedLic?.status).toBe("REVOKED");

    // Periksa bahwa JTI masuk ke denylist revokedTokens
    const denylisted = await db.query.revokedTokens.findFirst({
      where: eq(revokedTokens.licenseId, testLicense.id),
    });
    expect(denylisted).toBeDefined();
    expect(denylisted?.reason).toContain("REFUND");

    // Coba refund kedua kali -> 400
    const secondRes = await app.handle(
      new Request(`http://localhost:8081/api/v1/panel/transactions/${testTx.id}/refund`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: authCookie,
        },
      })
    );
    expect(secondRes.status).toBe(400);
  });

  // 3. Moderasi: Suspend & Unsuspend App
  it("POST /api/v1/panel/apps/:appId/toggle-suspend: blocks checkout when app suspended", async () => {
    // 1. Suspend app
    const suspendRes = await app.handle(
      new Request(`http://localhost:8081/api/v1/panel/apps/${testApp.id}/toggle-suspend`, {
        method: "POST",
        headers: { cookie: authCookie },
      })
    );
    expect(suspendRes.status).toBe(200);
    const suspendJson = await suspendRes.json();
    expect(suspendJson.isSuspended).toBe(true);

    // 2. Coba buat sesi checkout pada app yang di-suspend -> 403
    const checkoutRes = await app.handle(
      new Request(`http://localhost:8081/api/v1/checkout/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appId: testApp.id,
          buyerEmail: "newbuyer@test.com",
        }),
      })
    );
    expect(checkoutRes.status).toBe(403);
    const checkoutJson = await checkoutRes.json();
    expect(checkoutJson.errorCode).toBe("APP_SUSPENDED");

    // 3. Unsuspend app kembali
    const unsuspendRes = await app.handle(
      new Request(`http://localhost:8081/api/v1/panel/apps/${testApp.id}/toggle-suspend`, {
        method: "POST",
        headers: { cookie: authCookie },
      })
    );
    expect(unsuspendRes.status).toBe(200);
    const unsuspendJson = await unsuspendRes.json();
    expect(unsuspendJson.isSuspended).toBe(false);
  });

  // 4. Moderasi: Suspend & Unsuspend Builder
  it("POST /api/v1/panel/builders/:builderId/toggle-suspend: blocks checkout when builder suspended", async () => {
    // 1. Suspend builder
    const suspendRes = await app.handle(
      new Request(`http://localhost:8081/api/v1/panel/builders/${testBuilder.id}/toggle-suspend`, {
        method: "POST",
        headers: { cookie: authCookie },
      })
    );
    expect(suspendRes.status).toBe(200);
    const suspendJson = await suspendRes.json();
    expect(suspendJson.isSuspended).toBe(true);

    // 2. Checkout ditolak karena builder dibekukan -> 403
    const checkoutRes = await app.handle(
      new Request(`http://localhost:8081/api/v1/checkout/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appId: testApp.id,
          buyerEmail: "newbuyer@test.com",
        }),
      })
    );
    expect(checkoutRes.status).toBe(403);
    const checkoutJson = await checkoutRes.json();
    expect(checkoutJson.errorCode).toBe("BUILDER_SUSPENDED");

    // 3. Unsuspend builder kembali
    await app.handle(
      new Request(`http://localhost:8081/api/v1/panel/builders/${testBuilder.id}/toggle-suspend`, {
        method: "POST",
        headers: { cookie: authCookie },
      })
    );
  });

  // 5. Ekspor CSV
  it("GET /api/v1/panel/export/transactions & /builders: streams RFC 4180 CSV with UTF-8 BOM", async () => {
    const txRes = await app.handle(
      new Request(`http://localhost:8081/api/v1/panel/export/transactions`, {
        headers: { cookie: authCookie },
      })
    );
    expect(txRes.status).toBe(200);
    expect(txRes.headers.get("content-type")).toContain("text/csv");
    const txCsv = await txRes.text();
    expect(txCsv.startsWith("\uFEFF")).toBe(true);
    expect(txCsv).toContain("ID Transaksi");
    expect(txCsv).toContain(testTx.id);

    const bRes = await app.handle(
      new Request(`http://localhost:8081/api/v1/panel/export/builders`, {
        headers: { cookie: authCookie },
      })
    );
    expect(bRes.status).toBe(200);
    const bCsv = await bRes.text();
    expect(bCsv).toContain("Nama Builder");
    expect(bCsv).toContain(testBuilder.name);
  });

  // 6. Dynamic Platform Settings & Public Announcement
  it("GET & PUT /api/v1/panel/settings: configures platform fee and broadcasts announcement", async () => {
    // 1. Update settings
    const updateRes = await app.handle(
      new Request(`http://localhost:8081/api/v1/panel/settings`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          cookie: authCookie,
        },
        body: JSON.stringify({
          platform_fee_percent: "7.5",
          announcement_banner: "Pemeliharaan terjadwal sistem jam 00:00 WIB",
          announcement_type: "warning",
        }),
      })
    );
    expect(updateRes.status).toBe(200);
    const updateJson = await updateRes.json();
    expect(updateJson.settings.platform_fee_percent).toBe("7.5");

    // 2. Baca dari endpoint publik announcement
    const annRes = await app.handle(new Request(`http://localhost:8081/api/v1/announcement`));
    expect(annRes.status).toBe(200);
    const annJson = await annRes.json();
    expect(annJson.hasAnnouncement).toBe(true);
    expect(annJson.announcement.message).toContain("Pemeliharaan terjadwal");
    expect(annJson.announcement.type).toBe("warning");

    // 3. Reset settings
    await app.handle(
      new Request(`http://localhost:8081/api/v1/panel/settings`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          cookie: authCookie,
        },
        body: JSON.stringify({
          platform_fee_percent: "5",
          announcement_banner: "",
        }),
      })
    );
  });
});
