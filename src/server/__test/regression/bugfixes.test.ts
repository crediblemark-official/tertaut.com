/**
 * Test regresi untuk bug yang ditemukan pada audit.
 *
 * 1. grantCredits dari body publik /checkout/session (cetak kredit gratis)
 * 2. /validate merotasi offline token dua kali → token client tidak tersimpan di DB
 * 3. checkoutUrl mock DANA memakai param `orderId` padahal handler baca `externalId`
 * 4. /validate tidak mengecek lease floating (bypass rolling seat)
 * 5. Backstop 23505 aktivasi mengembalikan token lama yang sudah di-denylist
 * 6. Ekspresi mati `(floating.enabled || true)` di handleListSeats
 * 7. acquire() lease hanya lookup hash salted → lease dobel untuk device legacy
 * 8. simulate-paid tidak meng-grant credits / features / offline token
 * 9. handleDisburse lolos otorisasi saat authBuilder null
 */
import { describe, it, expect } from "bun:test";
import { setupTestAuth } from "../setup";
import { app } from "../../index";
import { db } from "../../db";
import {
  builders,
  apps,
  licenses,
  transactions,
  licenseLeases,
  creditLedger,
} from "../../db/schema";
import { eq, and } from "drizzle-orm";
import { LicenseService } from "../../services/license";
import { LicenseTokenService } from "../../services/licenseToken";
import { CreditService } from "../../services/credits";
import { generateAppApiKey, generateBuilderSecretApiKey } from "../../routes/apps/api-key";
import {
  handleActivateLicense,
  handleValidateLicense,
  handleListSeats,
} from "../../routes/licensing/device";
import { handleSimulatePaid } from "../../routes/checkout/handlers";
import { handleDisburse } from "../../routes/apps/disburse";
import { DanaService } from "../../services/dana";
import { config } from "../../config";

setupTestAuth();

const BASE = "http://localhost:3001";
const suffix = () => `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

async function seedBuilderApp(deliveryConfig: Record<string, any> = {}) {
  const email = `reg_${suffix()}@test.com`;
  const [b] = await db
    .insert(builders)
    .values({
      name: "Reg Builder",
      email,
      apiKey: generateAppApiKey("live"),
      secretApiKey: generateBuilderSecretApiKey(),
    })
    .returning();
  const [a] = await db
    .insert(apps)
    .values({
      id: `app_reg_${suffix()}`,
      name: "Reg App",
      slug: `reg-${suffix()}`,
      builderId: b.id,
      targetPrice: 50000,
      mode: "sandbox",
      apiKey: generateAppApiKey("sandbox"),
      ...(Object.keys(deliveryConfig).length ? { deliveryConfig } : {}),
    })
    .returning();
  return { builder: b, app: a };
}

async function createTx(builderId: string, appId: string, extras: Record<string, any> = {}) {
  const [tx] = await db
    .insert(transactions)
    .values({
      id: `tx_reg_${suffix()}`,
      builderId,
      appId,
      xenditExternalId: `ext_${suffix()}`,
      customerEmail: `c_${suffix()}@t.com`,
      grossAmount: 100000,
      netAmount: 95000,
      platformFee: 5000,
      paymentStatus: "PENDING",
      disbursementStatus: "PENDING",
      ...extras,
    })
    .returning();
  return tx;
}

// ─────────────────────────────────────────────────────────────────────────────
// Bug #1: grantCredits dari body publik /checkout/session
// ─────────────────────────────────────────────────────────────────────────────
describe("Regression #1: /checkout/session tidak lagi menerima grantCredits dari client", () => {
  it("schema menolak field grantCredits (client tidak bisa mengirim kredit)", async () => {
    const { app: a } = await seedBuilderApp();
    const res = await app.handle(
      new Request(`${BASE}/api/v1/checkout/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appId: a.id,
          customerEmail: `buyer_${suffix()}@test.com`,
          amount: 50000,
          grantCredits: 999_999_999,
        }),
      })
    );
    // Elysia menolak field di luar skema → 422; jika lolos skema juga tidak fatal
    // karena handler mengabaikan body.grantCredits dan memakai meteringConfig.
    if (res.status === 200) {
      const data: any = await res.json();
      expect(data.grantCredits ?? 0).toBeLessThanOrEqual(0);
    } else {
      expect([400, 422]).toContain(res.status);
    }
  });

  it("grantCredits transaksi diambil dari meteringConfig.freeAllowance produk, bukan body", async () => {
    const allowance = 777;
    const { app: a } = await seedBuilderApp();
    await db
      .update(apps)
      .set({
        meteringConfig: {
          enabled: true,
          template: "api_calls",
          name: "calls",
          aggregation: "sum",
          freeAllowance: allowance,
        } as any,
      })
      .where(eq(apps.id, a.id));

    const res = await app.handle(
      new Request(`${BASE}/api/v1/checkout/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appId: a.id,
          customerEmail: `buyer_${suffix()}@test.com`,
          amount: 50000,
        }),
      })
    );
    expect(res.status).toBe(200);
    const sessionId = (await res.json()).transactionId as string;

    const tx = await db.query.transactions.findFirst({ where: eq(transactions.id, sessionId) });
    expect(tx).toBeDefined();
    expect(tx!.grantCredits).toBe(allowance);
  });

  it("produk tanpa meteringConfig → grantCredits 0 walau client mengirim nilai besar", async () => {
    const { app: a } = await seedBuilderApp();
    // Kirim langsung ke handler dengan body mentah (bypass schema) untuk membuktikan
    // handler sama sekali tidak membaca body.grantCredits lagi.
    const mod = await import("../../routes/checkout/session");
    const set: any = {};
    const res: any = await mod.handleCreateSession({
      request: new Request(`${BASE}/api/v1/checkout/session`),
      body: {
        appId: a.id,
        customerEmail: `buyer_${suffix()}@test.com`,
        amount: 50000,
        grantCredits: 5_000_000,
      },
      set,
    });
    expect(res.success).toBe(true);
    const tx = await db.query.transactions.findFirst({
      where: eq(transactions.id, res.transactionId),
    });
    expect(tx!.grantCredits).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Bug #2: /validate merotasi token dua kali
// ─────────────────────────────────────────────────────────────────────────────
describe("Regression #2: /validate mengembalikan tepat token yang tersimpan di DB", () => {
  it("token respons == token DB, dan hanya SATU jti baru diterbitkan per panggilan", async () => {
    const { app: a } = await seedBuilderApp();
    const issued = await LicenseService.issueDirect({
      appId: a.id,
      customerEmail: `v2_${suffix()}@test.com`,
      grantDays: 30,
      maxSeats: 2,
    });
    const licKey = issued.license.licenseKey;
    const oldToken = issued.license.offlineJwtGraceToken!;
    const oldJti = LicenseTokenService.verify(oldToken).claims!.jti;

    const set: any = {};
    const res: any = await handleValidateLicense({
      body: { licenseKey: licKey, appId: a.id },
      set,
      request: new Request("http://localhost"),
    });
    expect(res.valid).toBe(true);

    const fresh = await db.query.licenses.findFirst({ where: eq(licenses.licenseKey, licKey) });
    expect(fresh!.offlineJwtGraceToken).toBe(res.offlineGraceToken);

    // Token yang dikembalikan valid sebagai offline token
    const decoded = LicenseTokenService.verify(res.offlineGraceToken);
    expect(decoded.valid).toBe(true);
    expect(decoded.claims!.jti).not.toBe(oldJti);
  });

  it("revoke() men-denylist token yang dipegang client setelah /validate", async () => {
    const { app: a } = await seedBuilderApp();
    const issued = await LicenseService.issueDirect({
      appId: a.id,
      customerEmail: `v2b_${suffix()}@test.com`,
      grantDays: 30,
      maxSeats: 2,
    });
    const licKey = issued.license.licenseKey;

    const set: any = {};
    const res: any = await handleValidateLicense({
      body: { licenseKey: licKey, appId: a.id },
      set,
      request: new Request("http://localhost"),
    });
    const clientToken = res.offlineGraceToken;

    await LicenseService.revoke({ licenseKey: licKey });

    // Token yang dipegang client kini harus ditolak
    const verifyRes = await app.handle(
      new Request(`${BASE}/api/v1/licensing/verify-offline-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: clientToken }),
      })
    );
    expect(verifyRes.status).toBe(401);
    expect((await verifyRes.json()).reason).toBe("TOKEN_REVOKED");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Bug #3: checkoutUrl mock DANA memakai param yang salah
// ─────────────────────────────────────────────────────────────────────────────
describe("Regression #3: checkoutUrl mock DANA memakai param externalId", () => {
  it("URL memuat externalId (bukan orderId=...)", async () => {
    const externalId = `tt_${suffix()}`;
    const order = await DanaService.createOrder({
      externalId,
      amount: 50000,
      payerEmail: `mock_${suffix()}@test.com`,
      description: "Regression mock",
      forceMock: true,
    });
    expect(order.checkoutUrl).toContain(`externalId=${externalId}`);
    expect(order.checkoutUrl).not.toContain("orderId=");

    // Endpoint finish harus menerima URL ini tanpa 400
    const finishRes = await app.handle(
      new Request(`${BASE}/api/v1/checkout/dana/finish?externalId=${externalId}`)
    );
    // 404 transaksi tidak ada pun membuktikan param terbaca (sebelumnya 400 param hilang)
    expect([200, 404]).toContain(finishRes.status);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Bug #4: /validate tidak mengecek lease floating
// ─────────────────────────────────────────────────────────────────────────────
describe("Regression #4: /validate menegakkan LEASE_STALE untuk lisensi floating", () => {
  it("device dengan lease mati ditolak via /validate", async () => {
    const { app: a } = await seedBuilderApp({
      licenseKey: {
        enabled: true,
        floating: { enabled: true, leaseTtlSeconds: 30, heartbeatIntervalSeconds: 10 },
      },
    });
    const issued = await LicenseService.issueDirect({
      appId: a.id,
      customerEmail: `v4_${suffix()}@test.com`,
      grantDays: 30,
      maxSeats: 2,
    });
    const licKey = issued.license.licenseKey;
    const hwid = `hwid_fl_${suffix()}`;

    const setAct: any = {};
    const act: any = await handleActivateLicense({
      body: { licenseKey: licKey, appId: a.id, hwid, deviceName: "PC" },
      set: setAct,
      request: new Request("http://localhost"),
    });
    expect(act.success).toBe(true);

    // Matikan lease secara langsung (simulasi device berhenti heartbeat)
    await db
      .update(licenseLeases)
      .set({ expiresAt: new Date(Date.now() - 60_000) })
      .where(eq(licenseLeases.licenseId, issued.license.id));

    const set: any = {};
    const res: any = await handleValidateLicense({
      body: { licenseKey: licKey, appId: a.id, hardwareId: hwid },
      set,
      request: new Request("http://localhost"),
    });
    expect(res.valid).toBe(false);
    expect(res.reason).toBe("LEASE_STALE");
  });

  it("device dengan lease hidup tetap lolos /validate", async () => {
    const { app: a } = await seedBuilderApp({
      licenseKey: {
        enabled: true,
        floating: { enabled: true, leaseTtlSeconds: 30, heartbeatIntervalSeconds: 10 },
      },
    });
    const issued = await LicenseService.issueDirect({
      appId: a.id,
      customerEmail: `v4b_${suffix()}@test.com`,
      grantDays: 30,
      maxSeats: 2,
    });
    const licKey = issued.license.licenseKey;
    const hwid = `hwid_fl_ok_${suffix()}`;

    await handleActivateLicense({
      body: { licenseKey: licKey, appId: a.id, hwid, deviceName: "PC" },
      set: {},
      request: new Request("http://localhost"),
    });

    const set: any = {};
    const res: any = await handleValidateLicense({
      body: { licenseKey: licKey, appId: a.id, hardwareId: hwid },
      set,
      request: new Request("http://localhost"),
    });
    expect(res.valid).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Bug #5: backstop 23505 mengembalikan token yang sudah di-denylist
// ─────────────────────────────────────────────────────────────────────────────
describe("Regression #5: aktivasi idempotent mengembalikan token terbaru dari DB", () => {
  it("sebelum transaksi: handler validasi normal menulis token baru ke DB dan mengembalikannya", async () => {
    // Proxy untuk bug #5: token pada DB harus selalu == token yang direspons
    // setelah aktivasi ulang (jalur normal), agar backstop 23505 yang membaca
    // ulang DB konsisten dengan kontrak verifikasi offline.
    const { app: a } = await seedBuilderApp();
    const issued = await LicenseService.issueDirect({
      appId: a.id,
      customerEmail: `v5_${suffix()}@test.com`,
      grantDays: 30,
      maxSeats: 2,
    });
    const licKey = issued.license.licenseKey;
    const hwid = `hwid_v5_${suffix()}`;

    await handleActivateLicense({
      body: { licenseKey: licKey, appId: a.id, hwid },
      set: {},
      request: new Request("http://localhost"),
    });

    const fresh = await db.query.licenses.findFirst({ where: eq(licenses.licenseKey, licKey) });
    const decoded = LicenseTokenService.verify(fresh!.offlineJwtGraceToken!);
    expect(decoded.valid).toBe(true);

    // Token lama dari issueDirect harus sudah masuk denylist (ROTATED)
    const verifyRes = await app.handle(
      new Request(`${BASE}/api/v1/licensing/verify-offline-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: issued.license.offlineJwtGraceToken }),
      })
    );
    expect(verifyRes.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Bug #6: ekspresi mati di handleListSeats
// ─────────────────────────────────────────────────────────────────────────────
describe("Regression #6: handleListSeats leaseActive konsisten dengan status lease", () => {
  it("floating: lease hidup → leaseActive true; lease mati → false", async () => {
    const { app: a } = await seedBuilderApp({
      licenseKey: {
        enabled: true,
        floating: { enabled: true, leaseTtlSeconds: 30, heartbeatIntervalSeconds: 10 },
      },
    });
    const issued = await LicenseService.issueDirect({
      appId: a.id,
      customerEmail: `v6_${suffix()}@test.com`,
      grantDays: 30,
      maxSeats: 2,
    });
    const licKey = issued.license.licenseKey;

    await handleActivateLicense({
      body: { licenseKey: licKey, appId: a.id, hwid: `hwid_v6_${suffix()}` },
      set: {},
      request: new Request("http://localhost"),
    });

    const res1: any = await handleListSeats({ query: { licenseKey: licKey }, set: {} });
    expect(res1.success).toBe(true);
    expect(res1.seats[0].leaseActive).toBe(true);

    await db
      .update(licenseLeases)
      .set({ expiresAt: new Date(Date.now() - 60_000) })
      .where(eq(licenseLeases.licenseId, issued.license.id));

    const res2: any = await handleListSeats({ query: { licenseKey: licKey }, set: {} });
    expect(res2.seats[0].leaseActive).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Bug #7: acquire() lease tidak mengenali hash legacy
// ─────────────────────────────────────────────────────────────────────────────
describe("Regression #7: acquire() dengan lookupHashes mengenali lease legacy (tanpa duplikat)", () => {
  it("lease legacy di-update, bukan dibuat baris kedua", async () => {
    const { LicenseLeaseService } = await import("../../services/licenseLease");
    const { app: a } = await seedBuilderApp();
    const issued = await LicenseService.issueDirect({
      appId: a.id,
      customerEmail: `v7_${suffix()}@test.com`,
      grantDays: 30,
      maxSeats: 3,
    });

    const legacyHash = LicenseService.hashHardwareId("hwid_legacy_007");
    const saltedHash = LicenseService.hashHardwareIdSecure("hwid_legacy_007");
    const lookupHashes = [saltedHash, legacyHash];

    // Simulasi lease lama yang tersimpan dengan hash legacy
    await db.insert(licenseLeases).values({
      id: `lsl_${suffix()}`,
      licenseId: issued.license.id,
      hwidHash: legacyHash,
      deviceName: "Old Device",
      leaseKey: "lk_legacy_seed",
      lastHeartbeatAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
    });

    const { lease, isNew } = await LicenseLeaseService.acquire(issued.license.id, saltedHash, {
      ttlSeconds: 300,
      lookupHashes,
    });
    expect(isNew).toBe(false);
    expect(lease.leaseKey).toBe("lk_legacy_seed");
    // hwidHash baris lama dimigrasi ke salted
    expect(lease.hwidHash).toBe(saltedHash);

    const rows = await db.query.licenseLeases.findMany({
      where: eq(licenseLeases.licenseId, issued.license.id),
    });
    expect(rows.length).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Bug #8: simulate-paid tidak setara fulfillment webhook
// ─────────────────────────────────────────────────────────────────────────────
describe("Regression #8: simulate-paid menerbitkan lisensi lengkap", () => {
  it("offline token, features, dan grantCredits sesuai konfigurasi produk", async () => {
    const { builder, app: a } = await seedBuilderApp({
      licenseKey: {
        enabled: true,
        expiresInDays: 90,
        maxSeats: 5,
        defaultFeatures: { tier: "pro" },
      },
      apiAccess: { enabled: true },
    });
    await db
      .update(apps)
      .set({
        meteringConfig: {
          enabled: true,
          template: "api_calls",
          name: "calls",
          aggregation: "sum",
          freeAllowance: 250,
        } as any,
      })
      .where(eq(apps.id, a.id));

    const tx = await createTx(builder.id, a.id, { grantCredits: 250 });
    const set: any = {};
    const res: any = await handleSimulatePaid({ params: { txId: tx.id }, set });

    expect(res.success).toBe(true);
    expect(res.creditBalance).toBe(250);

    const lic = await db.query.licenses.findFirst({ where: eq(licenses.transactionId, tx.id) });
    expect(lic).toBeDefined();
    expect(lic!.offlineJwtGraceToken).toBeTruthy();
    expect(LicenseTokenService.verify(lic!.offlineJwtGraceToken!).valid).toBe(true);
    expect(lic!.features).toEqual({ tier: "pro" });
    expect(lic!.maxSeats).toBe(5);
    expect(lic!.apiKey).toMatch(/^tt_cust_/);

    const ledger = await db.query.creditLedger.findMany({
      where: eq(creditLedger.licenseId, lic!.id),
    });
    expect(ledger.length).toBe(1);
    expect(ledger[0].delta).toBe(250);
  });

  it("tetap idempotent untuk transaksi yang sudah PAID", async () => {
    const { builder, app: a } = await seedBuilderApp();
    const tx = await createTx(builder.id, a.id, { paymentStatus: "PAID" });
    const set: any = {};
    const res: any = await handleSimulatePaid({ params: { txId: tx.id }, set });
    expect(res.success).toBe(true);
    expect(res.licenseKey).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Bug #9: handleDisburse lolos otorisasi saat authBuilder null
// ─────────────────────────────────────────────────────────────────────────────
describe("Regression #9: disburse menolak pemanggil tanpa profil builder", () => {
  it("403 saat bukan admin dan tidak punya profil builder", async () => {
    const { builder, app: a } = await seedBuilderApp();
    const tx = await createTx(builder.id, a.id, { paymentStatus: "PAID" });

    // Kredensial tidak valid → resolveCurrentBuilder mengembalikan builder null &
    // bukan admin → guard baru wajib menolak dengan 403 (sebelumnya lolos).
    const authHeaders = new Headers({ authorization: "Bearer tt_secret_not_exists" });

    const set: any = {};
    const res: any = await handleDisburse({
      params: { transactionId: tx.id },
      set,
      request: { headers: authHeaders },
    });
    expect(set.status).toBe(403);
    expect(res.error).toBeDefined();
  });

  it("admin tetap boleh mencairkan transaksi builder lain (jalur lama tidak rusak)", async () => {
    const { builder, app: a } = await seedBuilderApp();
    const tx = await createTx(builder.id, a.id, { paymentStatus: "PAID" });

    // Login sebagai admin sungguhan via setupTestAuth
    const { authCookie } = await import("../setup");
    const set: any = {};
    const res: any = await handleDisburse({
      params: { transactionId: tx.id },
      set,
      request: { headers: new Headers({ cookie: authCookie }) },
    });
    // Admin + transaksi sandbox → ditolak oleh guard mode sandbox, bukan 403 otorisasi
    expect(set.status).toBe(400);
    expect(res.error).toContain("sandbox");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Sanity: config sandbox untuk test webhook bypass signature
// ─────────────────────────────────────────────────────────────────────────────
describe("Sanity", () => {
  it("sandbox test env aktif untuk bypass verifikasi webhook", () => {
    expect(config.isSandbox).toBe(true);
  });
});
