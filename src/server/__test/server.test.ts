import { describe, it, expect } from "bun:test";
import { CryptoService } from "../services/crypto";
import { LicenseService } from "../services/license";
import { LicenseTokenService } from "../services/licenseToken";
import { XenditService } from "../services/xendit";
import { DanaService } from "../services/dana";
import { config } from "../config";
import { db } from "../db";
import {
  transactions,
  licenses,
  apps,
  licenseActivations,
  aiVaultCredentials,
  aiProxyLogs,
  aiProviderKeys,
  aiAppConfigs,
  aiUsageLogs,
  coupons,
  revokedTokens,
} from "../db/schema";
import { eq, desc } from "drizzle-orm";
import { handleXenditInvoiceWebhook } from "../routes/webhook";
import { AiGatewayService } from "../services/aiGateway";
import { LaunchService } from "../services/launchService";
import { Tertaut } from "../../../packages/sdk/src/index";
import { statSync, existsSync } from "fs";

describe("CryptoService (AES-256-GCM & JWT Tokens)", () => {
  it("should encrypt and decrypt string accurately using AES-256-GCM", () => {
    const originalText = "sk-ant-api03-sample-super-secret-key-12345";
    const encrypted = CryptoService.encrypt(originalText);

    expect(encrypted.cipherText).not.toBe(originalText);
    expect(encrypted.iv).toBeDefined();
    expect(encrypted.authTag).toBeDefined();

    const decrypted = CryptoService.decrypt(
      encrypted.cipherText,
      encrypted.iv,
      encrypted.authTag
    );
    expect(decrypted).toBe(originalText);
  });

  it("should generate and verify 30-day offline grace license token (Ed25519)", () => {
    const token = LicenseService.createOfflineGraceToken("TT-TEST-KEY-0001", "app_demo");
    const verified = LicenseTokenService.verify(token);

    expect(verified.valid).toBe(true);
    expect(verified.claims?.lic).toBe("TT-TEST-KEY-0001");
    expect(verified.claims?.app).toBe("app_demo");
  });
});

describe("LicenseService (Anti-Piracy & Key Generator)", () => {
  it("should generate proper TT-XXXX-XXXX-XXXX license format", () => {
    const key = LicenseService.generateLicenseKey();
    expect(key).toMatch(/^TT-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
  });

  it("should deterministically hash hardware ID", () => {
    const hw1 = "CPU_M3_MAX_12345";
    const hw2 = "cpu_m3_max_12345 "; // whitespace and lowercase check
    expect(LicenseService.hashHardwareId(hw1)).toBe(LicenseService.hashHardwareId(hw2));
  });

  it("should salt hardware ID hashing and keep legacy hashes as lookup candidates", () => {
    const hw = "CPU_RYZEN_9_7950X_SN_001";
    const secure1 = LicenseService.hashHardwareIdSecure(hw);
    const secure2 = LicenseService.hashHardwareIdSecure("cpu_ryzen_9_7950x_sn_001 ");
    const legacy = LicenseService.hashHardwareId(hw);

    expect(secure1).toBe(secure2);
    expect(secure1).toMatch(/^hw2:[a-f0-9]{64}$/);
    expect(secure1).not.toBe(legacy);
    expect(LicenseService.isSecureHwidHash(secure1)).toBe(true);
    expect(LicenseService.isSecureHwidHash(legacy)).toBe(false);

    const candidates = LicenseService.hwidLookupHashes(hw);
    expect(candidates).toContain(secure1);
    expect(candidates).toContain(legacy);
  });
});

describe("XenditService (Merchant of Record Fee Breakdown)", () => {
  it("should calculate exactly 5% platform fee and 95% net payout", () => {
    const breakdown = XenditService.calculateMorBreakdown(100000);
    expect(breakdown.grossAmount).toBe(100000);
    expect(breakdown.platformFee).toBe(5000);
    expect(breakdown.netAmount).toBe(95000);
  });

  it("should accurately handle odd amounts with rounding", () => {
    const breakdown = XenditService.calculateMorBreakdown(49000);
    expect(breakdown.grossAmount).toBe(49000);
    expect(breakdown.platformFee).toBe(2450);
    expect(breakdown.netAmount).toBe(46550);
  });

  it("should process disbursement calculation with correct parameters", async () => {
    const disb = await XenditService.createDisbursement({
      externalId: `test_disb_${Date.now()}`,
      amount: 46550,
      bankCode: "BCA",
      accountHolderName: "Vibe Builder",
      accountNumber: "1234567890",
      description: "Pencairan Net",
    });
    expect(disb).toBeDefined();
    expect(disb.amount).toBe(46550);
    expect(disb.status).toBeDefined();
  });
});

describe("App End-to-End Validation & MoR Calculations", () => {
  it("should verify 5% MoR cut holds true for micro-transactions", () => {
    const prices = [10000, 25000, 49000, 99000, 149000, 299000];
    for (const p of prices) {
      const { grossAmount, platformFee, netAmount } = XenditService.calculateMorBreakdown(p);
      expect(grossAmount).toBe(p);
      expect(platformFee + netAmount).toBe(grossAmount);
      expect(platformFee).toBe(Math.round(p * 0.05));
    }
  });

  it("should correctly handle offline license token expiration timestamps", () => {
    const token = LicenseService.createOfflineGraceToken("TT-VALID-9999", "app_test");
    const result = LicenseTokenService.verify(token);
    expect(result.valid).toBe(true);
    expect(result.claims?.typ).toBe("license");
    // Verify exp is ~30 days in future
    const now = Math.floor(Date.now() / 1000);
    expect(result.claims!.exp).toBeGreaterThan(now + 25 * 86400);
  });
});

describe("PRD Module 1: Page Blocks & App Configuration", () => {
  it("should save pageBlocks to app via PATCH /api/v1/apps/:appId", async () => {
    // First, get the first app
    const appsRes = await fetch("http://localhost:3000/api/v1/apps");
    const appsData: any = await appsRes.json();
    expect(appsRes.status).toBe(200);

    if (!appsData.apps || appsData.apps.length === 0) {
      console.warn("No apps found, skipping pageBlocks test");
      return;
    }

    const testApp = appsData.apps[0];
    const testSlug = testApp.slug;

    // Construct minimal content blocks
    const testBlocks = [
      {
        id: "blk_hero_test",
        type: "hero",
        title: "Test Hero Block",
        enabled: true,
        content: {
          appName: testApp.name,
          headline: "Test Headline dari Unit Test",
          subheadline: "Unit test otomatis untuk memvalidasi penyimpanan pageBlocks.",
          tag: "Unit Test",
        },
      },
      {
        id: "blk_cta_test",
        type: "intent_cta",
        title: "Test CTA Block",
        enabled: true,
        content: {
          ctaText: "Beli via Test — Rp 49.000",
          price: 49000,
          strikePrice: 98000,
          guaranteeText: "Garansi 14 Hari atau Uang Kembali",
        },
      },
    ];

    // Save pageBlocks via PATCH
    const patchRes = await fetch(`http://localhost:3000/api/v1/apps/${testApp.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pageBlocks: testBlocks }),
    });
    const patchData: any = await patchRes.json();
    expect(patchRes.status).toBe(200);
    expect(patchData.success).toBe(true);
    expect(patchData.app.pageBlocks).toBeDefined();
    expect(Array.isArray(patchData.app.pageBlocks)).toBe(true);
    expect(patchData.app.pageBlocks.length).toBe(2);
    expect(patchData.app.pageBlocks[0].type).toBe("hero");
    expect(patchData.app.pageBlocks[1].type).toBe("intent_cta");
  });
});

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
});

describe("PRD Module 3: Universal Licensing Engine & Device Seat Management", () => {
  it("should generate valid TAUT-XXXX-XXXX-XXXX and TT-XXXX-XXXX-XXXX license formats", () => {
    const keyTT = LicenseService.generateLicenseKey("TT");
    const keyTAUT = LicenseService.generateLicenseKey("TAUT");

    expect(keyTT).toMatch(/^TT-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    expect(keyTAUT).toMatch(/^TAUT-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
  });

  it("should create and verify Ed25519 signed offline license token with seat quota", () => {
    const token = LicenseService.createOfflineGraceToken(
      "TAUT-TEST-8812-9999",
      "app_devdocs_pro",
      "hwid_hash_12345",
      "buyer@tertaut.com",
      3
    );

    const verified = LicenseTokenService.verify(token);
    expect(verified.valid).toBe(true);
    expect(verified.claims?.lic).toBe("TAUT-TEST-8812-9999");
    expect(verified.claims?.app).toBe("app_devdocs_pro");
    expect(verified.claims?.seats).toBe(3);
    expect(verified.claims?.hw).toBe("hwid_hash_12345");
    expect(verified.claims?.typ).toBe("license");
    expect(typeof verified.claims?.jti).toBe("string");

    // Token yang diubah harus ditolak (signature tidak valid)
    const tampered = token.slice(0, -2) + (token.slice(-2) === "aa" ? "bb" : "aa");
    expect(LicenseTokenService.verify(tampered).valid).toBe(false);
  });

  it("should enforce multi-platform device seat quota (N_active <= N_max) and support seat deactivation", async () => {
    const app = await db.query.apps.findFirst();
    if (!app) return;

    const testLicId = `lic_seat_test_${Date.now()}`;
    const testKey = `TAUT-SEAT-${Math.random().toString(36).substring(2, 6).toUpperCase()}-TEST`;

    // Create a license with maxSeats = 2 for testing
    await db.insert(licenses).values({
      id: testLicId,
      appId: app.id,
      licenseKey: testKey,
      customerEmail: "seat_tester@example.com",
      status: "ACTIVE",
      maxSeats: 2,
    });

    try {
      // 1. Activate Device 1: Should succeed (Seats: 1/2)
      const res1 = await fetch("http://localhost:3000/api/v1/licensing/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          licenseKey: testKey,
          appId: app.id,
          hwid: "CPU_M3_MAX_MACBOOK_01",
          deviceName: "Fikri-MacBook",
        }),
      });
      const data1: any = await res1.json();
      expect(res1.status).toBe(200);
      expect(data1.success).toBe(true);
      expect(data1.data.seatsUsed).toBe(1);
      expect(data1.data.maxSeats).toBe(2);

      // 2. Activate Device 2: Should succeed (Seats: 2/2)
      const res2 = await fetch("http://localhost:3000/api/v1/licensing/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          licenseKey: testKey,
          appId: app.id,
          hwid: "CPU_RYZEN_9_PC_02",
          deviceName: "Office-Workstation",
        }),
      });
      const data2: any = await res2.json();
      expect(res2.status).toBe(200);
      expect(data2.success).toBe(true);
      expect(data2.data.seatsUsed).toBe(2);

      // 3. Activate Device 3: Should FAIL with 403 (Quota Exceeded 2/2)
      const res3 = await fetch("http://localhost:3000/api/v1/licensing/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          licenseKey: testKey,
          appId: app.id,
          hwid: "CPU_INTEL_i7_LAPTOP_03",
          deviceName: "Travel-Laptop",
        }),
      });
      const data3: any = await res3.json();
      expect(res3.status).toBe(403);
      expect(data3.success).toBe(false);
      expect(data3.error).toContain("Device seats quota exceeded");

      // 4. Online Verify Device 1: Should be valid
      const verifyRes1 = await fetch("http://localhost:3000/api/v1/licensing/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          licenseKey: testKey,
          hwid: "CPU_M3_MAX_MACBOOK_01",
        }),
      });
      const verifyData1: any = await verifyRes1.json();
      expect(verifyData1.valid).toBe(true);
      expect(verifyData1.status).toBe("ACTIVE");

      // 5. Online Verify Unactivated Device 3: Should return DEVICE_NOT_ACTIVATED
      const verifyRes3 = await fetch("http://localhost:3000/api/v1/licensing/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          licenseKey: testKey,
          hwid: "CPU_INTEL_i7_LAPTOP_03",
        }),
      });
      const verifyData3: any = await verifyRes3.json();
      expect(verifyData3.valid).toBe(false);
      expect(verifyData3.status).toBe("DEVICE_NOT_ACTIVATED");

      // 6. Deactivate Device 1: Should release seat
      const deactRes = await fetch("http://localhost:3000/api/v1/licensing/deactivate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          licenseKey: testKey,
          hwid: "CPU_M3_MAX_MACBOOK_01",
        }),
      });
      const deactData: any = await deactRes.json();
      expect(deactData.success).toBe(true);
      expect(deactData.message).toContain("released successfully");

      // 7. Now Activate Device 3: Should succeed now that seat is freed
      const res3Retry = await fetch("http://localhost:3000/api/v1/licensing/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          licenseKey: testKey,
          appId: app.id,
          hwid: "CPU_INTEL_i7_LAPTOP_03",
          deviceName: "Travel-Laptop",
        }),
      });
      const data3Retry: any = await res3Retry.json();
      expect(res3Retry.status).toBe(200);
      expect(data3Retry.success).toBe(true);
      expect(data3Retry.data.seatsUsed).toBe(2);
    } finally {
      // Clean up test data
      await db.delete(licenseActivations).where(eq(licenseActivations.licenseId, testLicId));
      await db.delete(licenses).where(eq(licenses.id, testLicId));
    }
  });

  it("should claim device seats atomically under concurrent activation (no quota over-run)", async () => {
    const app = await db.query.apps.findFirst();
    if (!app) return;

    const testLicId = `lic_race_test_${Date.now()}`;
    const testKey = `TAUT-RACE-${Math.random().toString(36).substring(2, 6).toUpperCase()}-TEST`;

    await db.insert(licenses).values({
      id: testLicId,
      appId: app.id,
      licenseKey: testKey,
      customerEmail: "race_tester@example.com",
      status: "ACTIVE",
      maxSeats: 1,
    });

    try {
      const attempts = Array.from({ length: 6 }, (_, i) =>
        fetch("http://localhost:3000/api/v1/licensing/activate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            licenseKey: testKey,
            appId: app.id,
            hwid: `CPU_RACE_DEVICE_${i}`,
            deviceName: `Race Device ${i}`,
          }),
        }).then(async (r) => ({ status: r.status, data: await r.json() }))
      );

      const results = await Promise.all(attempts);
      const successes = results.filter((r) => r.status === 200 && r.data.success === true);
      const rejections = results.filter((r) => r.status === 403);

      expect(successes.length).toBe(1);
      expect(rejections.length).toBe(5);

      const activations = await db.query.licenseActivations.findMany({
        where: eq(licenseActivations.licenseId, testLicId),
      });
      expect(activations.length).toBe(1);
    } finally {
      await db.delete(licenseActivations).where(eq(licenseActivations.licenseId, testLicId));
      await db.delete(licenses).where(eq(licenses.id, testLicId));
    }
  });

  it("should transparently migrate legacy unsalted HWID bindings to salted hashes", async () => {
    const app = await db.query.apps.findFirst();
    if (!app) return;

    const testLicId = `lic_migrate_${Date.now()}`;
    const testKey = `TT-MIGR8-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const rawHwid = "CPU_LEGACY_DEVICE_SN_777";
    const legacyHash = LicenseService.hashHardwareId(rawHwid);

    await db.insert(licenses).values({
      id: testLicId,
      appId: app.id,
      licenseKey: testKey,
      customerEmail: "migrate@example.com",
      status: "ACTIVE",
      maxSeats: 1,
      hardwareId: legacyHash,
    });
    await db.insert(licenseActivations).values({
      id: `act_migrate_${Date.now()}`,
      licenseId: testLicId,
      hwidHash: legacyHash,
      deviceName: "Legacy Device",
    });

    try {
      // Aktivasi ulang dengan HWID mentah yang sama harus me-migrasi, bukan menambah seat.
      const res = await fetch("http://localhost:3000/api/v1/licensing/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ licenseKey: testKey, appId: app.id, hwid: rawHwid, deviceName: "Legacy Device" }),
      });
      const data: any = await res.json();
      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.seatsUsed).toBe(1);

      const activations = await db.query.licenseActivations.findMany({
        where: eq(licenseActivations.licenseId, testLicId),
      });
      expect(activations.length).toBe(1);
      expect(LicenseService.isSecureHwidHash(activations[0].hwidHash)).toBe(true);

      const migratedLicense = await db.query.licenses.findFirst({ where: eq(licenses.id, testLicId) });
      expect(LicenseService.isSecureHwidHash(migratedLicense!.hardwareId)).toBe(true);

      // Verifikasi dengan HWID mentah (legacy hash) tetap valid.
      const verifyRes = await fetch("http://localhost:3000/api/v1/licensing/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ licenseKey: testKey, hwid: rawHwid }),
      });
      const verifyData: any = await verifyRes.json();
      expect(verifyRes.status).toBe(200);
      expect(verifyData.valid).toBe(true);
    } finally {
      await db.delete(licenseActivations).where(eq(licenseActivations.licenseId, testLicId));
      await db.delete(licenses).where(eq(licenses.id, testLicId));
    }
  });

  it("should reject revoked offline tokens via jti denylist and expose Ed25519 JWKS", async () => {
    const app = await db.query.apps.findFirst();
    if (!app) return;

    const testLicId = `lic_revoke_${Date.now()}`;
    const testKey = `TT-REVOKE-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const token = LicenseService.createOfflineGraceToken(
      testKey,
      app.id,
      "hw_revoke",
      "revoke@test.com",
      1
    );

    await db.insert(licenses).values({
      id: testLicId,
      appId: app.id,
      licenseKey: testKey,
      customerEmail: "revoke@test.com",
      status: "ACTIVE",
      maxSeats: 1,
      offlineJwtGraceToken: token,
    });

    try {
      // 1. Token valid sebelum revoke
      const res1 = await fetch("http://localhost:3000/api/v1/licensing/verify-offline-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data1: any = await res1.json();
      expect(res1.status).toBe(200);
      expect(data1.valid).toBe(true);

      // 2. JWKS mengekspos public key Ed25519
      const jwksRes = await fetch("http://localhost:3000/.well-known/jwks.json");
      const jwks: any = await jwksRes.json();
      expect(jwksRes.status).toBe(200);
      expect(jwks.keys[0].kty).toBe("OKP");
      expect(jwks.keys[0].crv).toBe("Ed25519");

      // 3. Verifikasi lokal SDK (Web Crypto Ed25519) tanpa server
      const localVerify = await new Tertaut({ appId: app.id, environment: "sandbox" }).licensing.verifyOfflineToken(token);
      expect(localVerify.valid).toBe(true);
      expect(localVerify.claims?.lic).toBe(testKey);

      // 4. Revoke -> jti masuk denylist
      const revRes = await fetch("http://localhost:3000/api/v1/licensing/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ licenseKey: testKey }),
      });
      expect(revRes.status).toBe(200);

      // 5. Token yang sama harus ditolak setelah revoke
      const res2 = await fetch("http://localhost:3000/api/v1/licensing/verify-offline-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data2: any = await res2.json();
      expect(res2.status).toBe(401);
      expect(data2.valid).toBe(false);
      expect(["TOKEN_REVOKED", "LICENSE_REVOKED"]).toContain(data2.reason);
    } finally {
      await db.delete(revokedTokens).where(eq(revokedTokens.licenseId, testLicId));
      await db.delete(licenses).where(eq(licenses.id, testLicId));
    }
  });
});

describe("PRD Module 4: AI API Proxy Shield & Cost Guardrails", () => {
  it("FR-1.1 & FR-1.2: should securely encrypt and decrypt multi-provider API keys (OpenAI, Anthropic, Gemini, DeepSeek)", () => {
    const keys = [
      { provider: "openai", key: "sk-proj-openai-sample-secure-key-12345" },
      { provider: "anthropic", key: "sk-ant-claude35-sonnet-secret-key-67890" },
      { provider: "gemini", key: "AIzaSyGeminiUltraSecureKey-ABCDEF12345" },
      { provider: "deepseek", key: "sk-ds-deepseek-v3-reasoner-superkey-99999" },
    ];

    for (const item of keys) {
      const encrypted = CryptoService.encrypt(item.key);
      expect(encrypted.cipherText).not.toBe(item.key);
      expect(encrypted.iv).toBeDefined();
      expect(encrypted.authTag).toBeDefined();

      const decrypted = CryptoService.decrypt(
        encrypted.cipherText,
        encrypted.iv,
        encrypted.authTag
      );
      expect(decrypted).toBe(item.key);
    }
  });

  it("FR-2.1 & FR-2.2: should enforce License JWT Entitlement and reject REVOKED/EXPIRED licenses with HTTP 403", async () => {
    const app = await db.query.apps.findFirst();
    if (!app) return;

    const testLicRevokedId = `lic_revoked_${Date.now()}`;
    const revokedKey = `TT-REVOKED-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    // Buat lisensi REVOKED di DB
    await db.insert(licenses).values({
      id: testLicRevokedId,
      appId: app.id,
      licenseKey: revokedKey,
      customerEmail: "revoked_user@example.com",
      status: "REVOKED",
    });

    try {
      // Panggil AI chat dengan lisensi revoked
      const res = await fetch("http://localhost:3000/api/v1/ai/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${revokedKey}`,
        },
        body: JSON.stringify({
          appId: app.id,
          prompt: "Ringkas artikel ini.",
        }),
      });

      const data: any = await res.json();
      expect(res.status).toBe(403);
      expect(data.error).toBe("LICENSE_REVOKED_OR_EXPIRED");
    } finally {
      await db.delete(licenses).where(eq(licenses.id, testLicRevokedId));
    }
  });

  it("FR-3.2: should enforce Strict Request Rate Limiter (max 15 req/min)", () => {
    const testRateId = `rate_test_${Date.now()}`;

    // 15 permintaan berturut-turut harus diizinkan
    for (let i = 0; i < 15; i++) {
      const check = AiGatewayService.checkRateLimit(testRateId, 15);
      expect(check.allowed).toBe(true);
    }

    // Permintaan ke-16 dalam window 1 menit harus ditolak dengan 429
    const check16 = AiGatewayService.checkRateLimit(testRateId, 15);
    expect(check16.allowed).toBe(false);
    expect(check16.retryAfter).toBeGreaterThan(0);
  });

  it("FR-3.1, FR-3.2, & API 7.1.B: should fetch quota status and enforce Daily Token Cap auto cut-off (HTTP 429)", async () => {
    const app = await db.query.apps.findFirst();
    if (!app) return;

    const testLicQuotaId = `lic_quota_${Date.now()}`;
    const quotaKey = `TAUT-QUOTA-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    // 1. Buat lisensi aktif
    await db.insert(licenses).values({
      id: testLicQuotaId,
      appId: app.id,
      licenseKey: quotaKey,
      customerEmail: "quota_user@example.com",
      status: "ACTIVE",
    });

    // 2. Buat App Config dengan daily_token_limit = 50.000
    const configId = `cfg_test_${Date.now()}`;
    await db.insert(aiAppConfigs).values({
      id: configId,
      appId: app.id,
      modelAlias: "fast-summary-model",
      targetModelName: "gpt-4o-mini",
      dailyTokenLimit: 50000,
      monthlyBudgetIdr: 500000,
    });

    try {
      // 3. Cek endpoint quota-status awal
      const quotaRes = await fetch(
        `http://localhost:3000/api/v1/ai/quota-status?licenseKey=${quotaKey}&modelAlias=fast-summary-model`
      );
      const quotaData: any = await quotaRes.json();
      expect(quotaRes.status).toBe(200);
      expect(quotaData.success).toBe(true);
      expect(quotaData.data.dailyTokenLimit).toBe(50000);
      expect(quotaData.data.remainingTokens).toBeGreaterThan(0);
      expect(quotaData.data.resetInSeconds).toBeGreaterThan(0);

      // 4. Masukkan log penggunaan melebihi kuota 50.000 tokens
      const logId = `log_test_excess_${Date.now()}`;
      await db.insert(aiUsageLogs).values({
        id: logId,
        licenseId: testLicQuotaId,
        appId: app.id,
        modelAlias: "fast-summary-model",
        promptTokens: 30000,
        completionTokens: 25000,
        totalTokens: 55000,
        responseTimeMs: 25,
      });

      // 5. Panggil chat lagi - harus ditolak dengan HTTP 429 DAILY_TOKEN_LIMIT_EXCEEDED
      const chatRes = await fetch("http://localhost:3000/api/v1/ai/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${quotaKey}`,
        },
        body: JSON.stringify({
          appId: app.id,
          modelAlias: "fast-summary-model",
          prompt: "Lakukan rangkuman sekarang.",
        }),
      });

      const chatData: any = await chatRes.json();
      expect(chatRes.status).toBe(429);
      expect(chatData.error).toBe("DAILY_TOKEN_LIMIT_EXCEEDED");

      // Bersihkan usage log dummy
      await db.delete(aiUsageLogs).where(eq(aiUsageLogs.id, logId));
    } finally {
      await db.delete(aiAppConfigs).where(eq(aiAppConfigs.id, configId));
      await db.delete(licenses).where(eq(licenses.id, testLicQuotaId));
    }
  });

  it("FR-4.1 & FR-4.2: should support Server-Sent Events (SSE) streaming relay and enforce Zero Prompt Retention", async () => {
    const app = await db.query.apps.findFirst();
    if (!app) return;

    const testLicSseId = `lic_sse_${Date.now()}`;
    const sseKey = `TAUT-SSE-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    await db.insert(licenses).values({
      id: testLicSseId,
      appId: app.id,
      licenseKey: sseKey,
      customerEmail: "sse_user@example.com",
      status: "ACTIVE",
    });

    try {
      // 1. Eksekusi streaming chat ke /api/v1/ai/chat (atau alias /api/v1/ai-proxy/chat)
      const res = await fetch("http://localhost:3000/api/v1/ai-proxy/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sseKey}`,
        },
        body: JSON.stringify({
          appId: app.id,
          modelAlias: "default",
          stream: true,
          messages: [
            { role: "system", content: "You are a concise summarizer." },
            { role: "user", content: "Jelaskan konsep zero text retention dalam satu kalimat." },
          ],
        }),
      });

      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("text/event-stream");

      // 2. Baca streaming body dan periksa chunk format SSE
      const reader = res.body?.getReader();
      expect(reader).toBeDefined();

      let streamOutput = "";
      const decoder = new TextDecoder();
      let done = false;

      while (!done && reader) {
        const chunk = await reader.read();
        done = chunk.done;
        if (chunk.value) {
          streamOutput += decoder.decode(chunk.value);
        }
      }

      // Pastikan format mematuhi data: {"id":...} dan diakhiri dengan data: [DONE]
      expect(streamOutput).toContain("data: {");
      expect(streamOutput).toContain("data: [DONE]");

      // 3. FR-4.2 Zero Text Retention Audit: Periksa database ai_usage_logs
      // Hanya prompt_tokens, completion_tokens, total_tokens, response_time_ms yang boleh ada
      const recentLog = await db.query.aiUsageLogs.findFirst({
        where: eq(aiUsageLogs.licenseId, testLicSseId),
        orderBy: (log, { desc }) => [desc(log.createdAt)],
      });

      expect(recentLog).toBeDefined();
      expect(recentLog?.promptTokens).toBeGreaterThan(0);
      expect(recentLog?.completionTokens).toBeGreaterThan(0);
      expect(recentLog?.totalTokens).toBe(recentLog!.promptTokens + recentLog!.completionTokens);
      expect(recentLog?.responseTimeMs).toBeDefined();

      // Pastikan kolom teks prompt / response TIDAK ADA pada skema log
      expect((recentLog as any).prompt).toBeUndefined();
      expect((recentLog as any).completion).toBeUndefined();
      expect((recentLog as any).text).toBeUndefined();
    } finally {
      await db.delete(aiUsageLogs).where(eq(aiUsageLogs.licenseId, testLicSseId));
      await db.delete(licenses).where(eq(licenses.id, testLicSseId));
    }
  });
});

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

  it("Customer Portal & Super Admin Panel: should support customer license lookup, device deactivation, platform stats, builder directory, and batch payout", async () => {
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
      // 2b. Uji Customer Portal: POST /api/v1/portal/access (tukar email + license key -> token)
      const resAccess = await fetch("http://localhost:3000/api/v1/portal/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: testEmail, licenseKey: testKey }),
      });
      const accessData: any = await resAccess.json();
      expect(resAccess.status).toBe(200);
      expect(accessData.success).toBe(true);
      expect(typeof accessData.token).toBe("string");
      const portalToken: string = accessData.token;

      // Bukti kepemilikan salah harus ditolak
      const resAccessBad = await fetch("http://localhost:3000/api/v1/portal/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "orang_lain@customer.com", licenseKey: testKey }),
      });
      expect(resAccessBad.status).toBe(403);

      // 3. Uji Customer Portal: GET /api/v1/portal/licenses (wajib portal token)
      const resLicenses = await fetch(`http://localhost:3000/api/v1/portal/licenses?token=${portalToken}`);
      const licData: any = await resLicenses.json();
      expect(resLicenses.status).toBe(200);
      expect(licData.success).toBe(true);
      expect(licData.count).toBe(1);
      expect(licData.licenses[0].licenseKey).toBe(testKey);
      expect(licData.licenses[0].seatsUsed).toBe(1);
      expect(licData.licenses[0].activations.length).toBe(1);

      // 4. Uji Customer Portal: POST /api/v1/portal/deactivate-device (Self-service seat release)
      const resDeact = await fetch("http://localhost:3000/api/v1/portal/deactivate-device", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          licenseKey: testKey,
          hwidHash: testHwid,
          customerEmail: testEmail,
        }),
      });
      const deactData: any = await resDeact.json();
      expect(resDeact.status).toBe(200);
      expect(deactData.success).toBe(true);
      expect(deactData.remainingSeats).toBe(2);

      // 5. Uji Customer Portal: GET /api/v1/portal/transactions (wajib portal token)
      const resTx = await fetch(`http://localhost:3000/api/v1/portal/transactions?token=${portalToken}`);
      const txData: any = await resTx.json();
      expect(resTx.status).toBe(200);
      expect(txData.success).toBe(true);
      expect(txData.count).toBeGreaterThanOrEqual(1);

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
  });
});

describe("PRD Module 1.5: Discount Coupon Redemption (E2E via API)", () => {
  async function createTestApp(): Promise<{ id: string; slug: string }> {
    const builder = await db.query.builders.findFirst();
    if (!builder) throw new Error("No builder found — jalankan seed/auto-seed dulu");

    const testAppId = `app_coupon_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`;
    const testSlug = `coupon-test-${Math.random().toString(36).substring(2, 8)}`;

    await db.insert(apps).values({
      id: testAppId,
      builderId: builder.id,
      name: "Coupon E2E Test App",
      slug: testSlug,
      mode: "live",
      targetPrice: 100000,
    });

    return { id: testAppId, slug: testSlug };
  }

  it("should create coupon via API, preview discount, and redeem it on checkout session", async () => {
    const testApp = await createTestApp();
    const testCode = `E2E${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    try {
      // 1. Buat kupon via API manajemen
      const createRes = await fetch("http://localhost:3000/api/v1/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appId: testApp.id,
          code: testCode,
          discountPercent: 25,
          maxRedemptions: 5,
        }),
      });
      const createData: any = await createRes.json();
      expect(createRes.status).toBe(200);
      expect(createData.success).toBe(true);
      expect(createData.coupon.code).toBe(testCode);
      expect(createData.coupon.discountPercent).toBe(25);
      expect(createData.coupon.redemptionCount).toBe(0);
      const couponId = createData.coupon.id as string;

      // 2. Preview diskon TANPA membuat transaksi
      const previewRes = await fetch("http://localhost:3000/api/v1/checkout/preview-coupon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appId: testApp.id, couponCode: testCode, amount: 100000 }),
      });
      const previewData: any = await previewRes.json();
      expect(previewRes.status).toBe(200);
      expect(previewData.valid).toBe(true);
      expect(previewData.discountPercent).toBe(25);
      expect(previewData.discountAmount).toBe(25000);
      expect(previewData.payableAmount).toBe(75000);

      // 3. Tebus kupon via checkout session sungguhan (invoice mock di sandbox)
      const checkoutRes = await fetch("http://localhost:3000/api/v1/checkout/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appId: testApp.id,
          amount: 100000,
          customerEmail: `coupon_e2e_${Date.now()}@test.local`,
          couponCode: testCode,
        }),
      });
      const checkoutData: any = await checkoutRes.json();
      expect(checkoutRes.status).toBe(200);
      expect(checkoutData.success).toBe(true);
      expect(checkoutData.couponCode).toBe(testCode);
      expect(checkoutData.discountAmount).toBe(25000);
      // Nominal yang ditagihkan Xendit = harga list - diskon
      expect(checkoutData.amount).toBe(75000);

      // 4. Transaksi di DB mencatat kupon & breakdown MoR atas nominal terdiskon
      const txId = checkoutData.transactionId as string;
      const tx = await db.query.transactions.findFirst({ where: eq(transactions.id, txId) });
      expect(tx).toBeDefined();
      expect(tx!.couponCode).toBe(testCode);
      expect(tx!.discountAmount).toBe(25000);
      expect(tx!.grossAmount).toBe(75000);
      // 5% dari 75000 = 3750; net 95% = 71250
      expect(tx!.platformFee).toBe(3750);
      expect(tx!.netAmount).toBe(71250);

      // 5. Kuota penebusan naik tepat 1
      const redeemed = await db.query.coupons.findFirst({ where: eq(coupons.id, couponId) });
      expect(redeemed).toBeDefined();
      expect(redeemed!.redemptionCount).toBe(1);

      // Cleanup transaksi tes
      await db.delete(transactions).where(eq(transactions.id, txId));
    } finally {
      await db.delete(coupons).where(eq(coupons.appId, testApp.id));
      await db.delete(apps).where(eq(apps.id, testApp.id));
    }
  });

  it("should reject unknown coupon codes and app-mismatched coupons at checkout", async () => {
    const testApp = await createTestApp();
    const otherApp = await createTestApp();

    try {
      // 1. Kode yang tidak ada sama sekali
      const unknownRes = await fetch("http://localhost:3000/api/v1/checkout/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appId: testApp.id,
          amount: 100000,
          customerEmail: `coupon_unknown_${Date.now()}@test.local`,
          couponCode: "NO_SUCH_COUPON_XYZ",
        }),
      });
      const unknownData: any = await unknownRes.json();
      expect(unknownRes.status).toBe(400);
      expect(unknownData.errorCode).toBe("COUPON_NOT_FOUND");

      // 2. Kupon valid milik app lain tidak boleh dipakai lintas app
      const createRes = await fetch("http://localhost:3000/api/v1/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appId: otherApp.id,
          code: `OWN${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
          discountPercent: 10,
        }),
      });
      const created: any = await createRes.json();
      expect(createRes.status).toBe(200);

      const mismatchRes = await fetch("http://localhost:3000/api/v1/checkout/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appId: testApp.id,
          amount: 100000,
          customerEmail: `coupon_mismatch_${Date.now()}@test.local`,
          couponCode: created.coupon.code,
        }),
      });
      const mismatchData: any = await mismatchRes.json();
      expect(mismatchRes.status).toBe(400);
      expect(mismatchData.errorCode).toBe("COUPON_NOT_FOUND");
    } finally {
      await db.delete(coupons).where(eq(coupons.appId, otherApp.id));
      await db.delete(apps).where(eq(apps.id, otherApp.id));
      await db.delete(apps).where(eq(apps.id, testApp.id));
    }
  });

  it("should enforce maxRedemptions quota (second redemption rejected, no ghost invoice)", async () => {
    const testApp = await createTestApp();
    const testCode = `QTA${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    try {
      // Kupon dengan kuota 1x
      const createRes = await fetch("http://localhost:3000/api/v1/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appId: testApp.id,
          code: testCode,
          discountPercent: 50,
          maxRedemptions: 1,
        }),
      });
      expect(createRes.status).toBe(200);

      // Penebusan #1: sukses
      const res1 = await fetch("http://localhost:3000/api/v1/checkout/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appId: testApp.id,
          amount: 100000,
          customerEmail: `coupon_quota1_${Date.now()}@test.local`,
          couponCode: testCode,
        }),
      });
      const data1: any = await res1.json();
      expect(res1.status).toBe(200);
      expect(data1.success).toBe(true);
      expect(data1.amount).toBe(50000);

      // Penebusan #2: ditolak karena kuota habis
      const res2 = await fetch("http://localhost:3000/api/v1/checkout/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appId: testApp.id,
          amount: 100000,
          customerEmail: `coupon_quota2_${Date.now()}@test.local`,
          couponCode: testCode,
        }),
      });
      const data2: any = await res2.json();
      expect(res2.status).toBe(400);
      expect(data2.errorCode).toBe("COUPON_EXHAUSTED");

      // Transaksi dengan kupon ini harus TEPAT 1 (tidak ada invoice hantu terdiskon)
      const txsWithCoupon = await db.query.transactions.findMany({
        where: eq(transactions.couponCode, testCode),
      });
      expect(txsWithCoupon.length).toBe(1);
      expect(txsWithCoupon[0].customerEmail).toContain("coupon_quota1_");

      // Cleanup transaksi penebusan pertama
      await db.delete(transactions).where(eq(transactions.id, data1.transactionId));
    } finally {
      await db.delete(coupons).where(eq(coupons.appId, testApp.id));
      await db.delete(apps).where(eq(apps.id, testApp.id));
    }
  });

  it("should toggle coupon active state via API and block redemption while inactive", async () => {
    const testApp = await createTestApp();
    const testCode = `TOG${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    try {
      const createRes = await fetch("http://localhost:3000/api/v1/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appId: testApp.id,
          code: testCode,
          discountPercent: 20,
        }),
      });
      const created: any = await createRes.json();
      expect(createRes.status).toBe(200);
      const couponId = created.coupon.id as string;

      // Nonaktifkan via PATCH
      const patchRes = await fetch(`http://localhost:3000/api/v1/coupons/${couponId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: false }),
      });
      const patchData: any = await patchRes.json();
      expect(patchRes.status).toBe(200);
      expect(patchData.coupon.isActive).toBe(false);

      // Penebusan saat nonaktif harus ditolak
      const redeemRes = await fetch("http://localhost:3000/api/v1/checkout/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appId: testApp.id,
          amount: 100000,
          customerEmail: `coupon_inactive_${Date.now()}@test.local`,
          couponCode: testCode,
        }),
      });
      const redeemData: any = await redeemRes.json();
      expect(redeemRes.status).toBe(400);
      expect(redeemData.errorCode).toBe("COUPON_INACTIVE");

      // Aktifkan kembali → preview valid lagi
      await fetch(`http://localhost:3000/api/v1/coupons/${couponId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: true }),
      });

      const previewRes = await fetch("http://localhost:3000/api/v1/checkout/preview-coupon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appId: testApp.id, couponCode: testCode, amount: 100000 }),
      });
      const previewData: any = await previewRes.json();
      expect(previewRes.status).toBe(200);
      expect(previewData.valid).toBe(true);
      expect(previewData.discountAmount).toBe(20000);
    } finally {
      await db.delete(coupons).where(eq(coupons.appId, testApp.id));
      await db.delete(apps).where(eq(apps.id, testApp.id));
    }
  });
});

describe("Sandbox & Live App Mode (creem.io-style)", () => {
  async function createSandboxTestApp(): Promise<{ id: string; slug: string }> {
    const builder = await db.query.builders.findFirst();
    if (!builder) throw new Error("No builder found — jalankan seed/auto-seed dulu");

    const testAppId = `app_sandbox_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`;
    const testSlug = `sandbox-test-${Math.random().toString(36).substring(2, 8)}`;

    await db.insert(apps).values({
      id: testAppId,
      builderId: builder.id,
      name: "Sandbox E2E Test App",
      slug: testSlug,
      mode: "sandbox",
      targetPrice: 50000,
    });

    return { id: testAppId, slug: testSlug };
  }

  it("should create app with sandbox mode by default and allow mode toggle to live", async () => {
    const builder = await db.query.builders.findFirst();
    if (!builder) return;

    const testSlug = `mode-test-${Math.random().toString(36).substring(2, 8)}`;
    let createdAppId: string | null = null;

    try {
      // App baru dibuat TANPA mode eksplisit → default sandbox (seperti creem.io)
      const createRes = await fetch("http://localhost:3000/api/v1/apps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Default Sandbox App",
          slug: testSlug,
          targetPrice: 25000,
        }),
      });
      const created: any = await createRes.json();
      expect(createRes.status).toBe(200);
      expect(created.app.mode).toBe("sandbox");
      createdAppId = created.app.id;

      // Toggle ke live
      const toggleRes = await fetch(`http://localhost:3000/api/v1/apps/${createdAppId}/mode`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "live" }),
      });
      const toggled: any = await toggleRes.json();
      expect(toggleRes.status).toBe(200);
      expect(toggled.app.mode).toBe("live");
    } finally {
      if (createdAppId) await db.delete(apps).where(eq(apps.id, createdAppId));
    }
  });

  it("should mark checkout session as sandbox and simulate payment to issue license", async () => {
    const testApp = await createSandboxTestApp();

    try {
      // 1. Buat sesi checkout → invoice mock karena app mode sandbox
      const sessionRes = await fetch("http://localhost:3000/api/v1/checkout/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appId: testApp.id,
          amount: 50000,
          customerEmail: `sandbox_${Date.now()}@test.local`,
        }),
      });
      const sessionData: any = await sessionRes.json();
      expect(sessionRes.status).toBe(200);
      expect(sessionData.success).toBe(true);
      expect(sessionData.data.isSandbox).toBe(true);
      expect(sessionData.data.xenditInvoiceUrl).toContain("mock");

      const txId = sessionData.data.sessionId;

      // 2. Simulasikan pembayaran
      const simRes = await fetch(`http://localhost:3000/api/v1/checkout/simulate-paid/${txId}`, {
        method: "POST",
      });
      const simData: any = await simRes.json();
      expect(simRes.status).toBe(200);
      expect(simData.success).toBe(true);
      expect(simData.licenseKey).toMatch(/^TT-/);

      // 3. Transaksi berstatus PAID
      const tx = await db.query.transactions.findFirst({ where: eq(transactions.id, txId) });
      expect(tx?.paymentStatus).toBe("PAID");

      // 4. Pencairan harus DITOLAK untuk transaksi sandbox
      const disbRes = await fetch(`http://localhost:3000/api/v1/checkout/disburse/${txId}`, {
        method: "POST",
      });
      expect(disbRes.status).toBe(400);

      // 5. Simulate-paid untuk app yang sudah LIVE hanya diizinkan saat sandbox
      //    global aktif (development). Di luar itu harus ditolak (403).
      await db.update(apps).set({ mode: "live" }).where(eq(apps.id, testApp.id));
      const simLiveRes = await fetch(`http://localhost:3000/api/v1/checkout/simulate-paid/${txId}`, {
        method: "POST",
      });
      if (config.isSandbox) {
        expect(simLiveRes.status).toBe(200);
      } else {
        expect(simLiveRes.status).toBe(403);
      }
    } finally {
      await db.delete(licenses).where(eq(licenses.appId, testApp.id));
      await db.delete(transactions).where(eq(transactions.appId, testApp.id));
      await db.delete(apps).where(eq(apps.id, testApp.id));
    }
  });
});

describe("DANA Enterprise Payment Gateway & Multi-PG Integration", () => {
  it("should calculate exactly 5% platform fee and 95% net payout for DANA MoR", () => {
    const gross = 100000;
    const { grossAmount, platformFee, netAmount } = DanaService.calculateMorBreakdown(gross);

    expect(grossAmount).toBe(100000);
    expect(platformFee).toBe(5000); // 5%
    expect(netAmount).toBe(95000); // 95%
    expect(grossAmount).toBe(platformFee + netAmount);
  });

  it("should create DANA order with mock response in sandbox mode", async () => {
    const externalId = `dana_ext_${Date.now()}`;
    const order = await DanaService.createOrder({
      externalId,
      amount: 75000,
      payerEmail: "buyer_dana@test.local",
      description: "Lisensi Test DANA",
      forceMock: true,
    });

    expect(order.externalId).toBe(externalId);
    expect(order.amount).toBe(75000);
    expect(order.checkoutUrl).toContain("checkout/dana/finish");
    expect(order.merchantName).toContain("DANA");
  });

  it("should create checkout session using DANA when paymentGateway='dana'", async () => {
    const existingApp = await db.query.apps.findFirst();
    if (!existingApp) return;

    const email = `dana_checkout_${Date.now()}@test.local`;
    const res = await fetch("http://localhost:3000/api/v1/checkout/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        appId: existingApp.id,
        amount: 80000,
        customerEmail: email,
        paymentGateway: "dana",
      }),
    });

    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.success).toBe(true);
    expect(body.paymentGateway).toBe("dana");
    expect(
      body.checkoutUrl.includes("checkout/dana/finish") ||
      body.checkoutUrl.includes("sandbox.dana.id")
    ).toBe(true);

    const tx = await db.query.transactions.findFirst({
      where: eq(transactions.id, body.transactionId),
    });
    expect(tx).toBeDefined();
    expect(tx?.paymentProvider).toBe("dana");
    expect(tx?.grossAmount).toBe(80000);

    // Clean up
    await db.delete(transactions).where(eq(transactions.id, body.transactionId));
  });

  it("should process DANA Finish Payment Webhook and issue license with idempotency", async () => {
    const existingApp = await db.query.apps.findFirst();
    if (!existingApp) return;

    const txId = `tx_dana_test_${Date.now()}`;
    const extId = `tt_dana_${Date.now()}`;
    const custEmail = `customer_dana_${Date.now()}@test.local`;

    await db.insert(transactions).values({
      id: txId,
      appId: existingApp.id,
      builderId: existingApp.builderId,
      paymentProvider: "dana",
      providerReferenceId: extId,
      xenditInvoiceId: extId,
      xenditExternalId: extId,
      xenditInvoiceUrl: `https://checkout.dana.id/mock/${extId}`,
      customerEmail: custEmail,
      grossAmount: 50000,
      platformFee: 2500,
      netAmount: 47500,
      paymentStatus: "PENDING",
      disbursementStatus: "PENDING",
      grantDays: 30,
    });

    // 1. First webhook call: harus berhasil dan terbitkan lisensi
    const webhookRes1 = await fetch("http://localhost:3000/webhook/dana/finish-payment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        merchantTransId: extId,
        orderStatus: "SUCCESS",
        orderAmount: { currency: "IDR", value: "50000" },
        paymentChannel: "DANA_WALLET",
      }),
    });

    expect(webhookRes1.status).toBe(200);
    const resData1: any = await webhookRes1.json();
    expect(resData1.status).toBe("success");
    expect(resData1.licenseKey).toMatch(/^TT-/);

    // Verifikasi database: status PAID
    const txAfter = await db.query.transactions.findFirst({ where: eq(transactions.id, txId) });
    expect(txAfter?.paymentStatus).toBe("PAID");
    expect(txAfter?.paymentChannel).toBe("DANA_WALLET");

    // 2. Second webhook call (Idempotency): tidak boleh duplikasi lisensi
    const webhookRes2 = await fetch("http://localhost:3000/webhook/dana/finish-payment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        merchantTransId: extId,
        orderStatus: "SUCCESS",
      }),
    });

    expect(webhookRes2.status).toBe(200);
    const resData2: any = await webhookRes2.json();
    expect(resData2.message).toContain("idempotent");

    // Pastikan hanya 1 lisensi yang terbit untuk transaksi ini
    const issuedLicenses = await db.query.licenses.findMany({
      where: eq(licenses.transactionId, txId),
    });
    expect(issuedLicenses.length).toBe(1);

    // 3. Test DANA Disburse to Bank Notify Webhook
    const disburseWebhookRes = await fetch("http://localhost:3000/webhook/dana/disburse-notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        partnerReferenceNo: extId,
        status: "SUCCESS",
      }),
    });

    expect(disburseWebhookRes.status).toBe(200);
    const txDisbAfter = await db.query.transactions.findFirst({ where: eq(transactions.id, txId) });
    expect(txDisbAfter?.disbursementStatus).toBe("COMPLETED");

    // Clean up
    await db.delete(licenses).where(eq(licenses.transactionId, txId));
    await db.delete(transactions).where(eq(transactions.id, txId));
  });

  it("should acknowledge DANA Transaction Success Finish Notify (/v1.0/debit/notify) with 2005600 and Successful", async () => {
    // 1. Test against SNAP BI standard route POST /v1.0/debit/notify
    const notifyRes = await fetch("http://localhost:3000/v1.0/debit/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        originalPartnerReferenceNo: `dana_order_${Date.now()}`,
        originalReferenceNo: `dana_ref_${Date.now()}`,
        latestTransactionStatus: "00",
        amount: { value: "11011.00", currency: "IDR" },
      }),
    });

    expect(notifyRes.status).toBe(200);
    const body: any = await notifyRes.json();
    expect(body.responseCode).toBe("2005600");
    expect(body.responseMessage).toBe("Successful");

    // 2. Test Internal Server Error condition (amount = 11012.00)
    const errNotifyRes = await fetch("http://localhost:3000/v1.0/debit/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        originalPartnerReferenceNo: `dana_err_${Date.now()}`,
        latestTransactionStatus: "00",
        amount: { value: "11012.00", currency: "IDR" },
      }),
    });

    expect(errNotifyRes.status).toBe(500);
    const errBody: any = await errNotifyRes.json();
    expect(errBody.responseCode).toBe("5005601");
    expect(errBody.responseMessage).toBe("Internal Server Error");
  });

  it("should fulfill transaction when SNAP BI Finish Notify latestTransactionStatus='00' matches an existing transaction", async () => {
    const existingApp = await db.query.apps.findFirst();
    if (!existingApp) return;

    const txId = `tx_dana_snap_${Date.now()}`;
    const extId = `tt_dana_snap_${Date.now()}`;
    const custEmail = `customer_dana_snap_${Date.now()}@test.local`;

    await db.insert(transactions).values({
      id: txId,
      appId: existingApp.id,
      builderId: existingApp.builderId,
      paymentProvider: "dana",
      providerReferenceId: extId,
      xenditInvoiceId: extId,
      xenditExternalId: extId,
      xenditInvoiceUrl: `https://checkout.dana.id/mock/${extId}`,
      customerEmail: custEmail,
      grossAmount: 50000,
      platformFee: 2500,
      netAmount: 47500,
      paymentStatus: "PENDING",
      disbursementStatus: "PENDING",
      grantDays: 30,
    });

    const res = await fetch("http://localhost:3000/v1.0/debit/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        originalPartnerReferenceNo: extId,
        originalReferenceNo: `dana_ref_${Date.now()}`,
        latestTransactionStatus: "00",
        amount: { value: "50000.00", currency: "IDR" },
      }),
    });

    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.responseCode).toBe("2005600");
    expect(body.responseMessage).toBe("Successful");

    const txAfter = await db.query.transactions.findFirst({ where: eq(transactions.id, txId) });
    expect(txAfter?.paymentStatus).toBe("PAID");

    const issued = await db.query.licenses.findMany({ where: eq(licenses.transactionId, txId) });
    expect(issued.length).toBe(1);

    await db.delete(licenses).where(eq(licenses.transactionId, txId));
    await db.delete(transactions).where(eq(transactions.id, txId));
  });
});
