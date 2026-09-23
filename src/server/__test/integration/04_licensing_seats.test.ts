import { describe, it, expect } from "bun:test";
import { setupTestAuth } from "../setup";
import { LicenseService } from "../../services/license";
import { LicenseTokenService } from "../../services/licenseToken";
import { Tertaut } from "../../../../packages/sdk/src/index";
import { db } from "../../db";
import { licenses, licenseActivations, revokedTokens } from "../../db/schema";
import { eq } from "drizzle-orm";

setupTestAuth();

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
      const res1 = await fetch("http://localhost:3001/api/v1/licensing/activate", {
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
      const res2 = await fetch("http://localhost:3001/api/v1/licensing/activate", {
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
      const res3 = await fetch("http://localhost:3001/api/v1/licensing/activate", {
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
      const verifyRes1 = await fetch("http://localhost:3001/api/v1/licensing/verify", {
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
      const verifyRes3 = await fetch("http://localhost:3001/api/v1/licensing/verify", {
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
      const deactRes = await fetch("http://localhost:3001/api/v1/licensing/deactivate", {
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
      const res3Retry = await fetch("http://localhost:3001/api/v1/licensing/activate", {
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
        fetch("http://localhost:3001/api/v1/licensing/activate", {
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
      const res = await fetch("http://localhost:3001/api/v1/licensing/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          licenseKey: testKey,
          appId: app.id,
          hwid: rawHwid,
          deviceName: "Legacy Device",
        }),
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

      const migratedLicense = await db.query.licenses.findFirst({
        where: eq(licenses.id, testLicId),
      });
      expect(LicenseService.isSecureHwidHash(migratedLicense!.hardwareId)).toBe(true);

      // Verifikasi dengan HWID mentah (legacy hash) tetap valid.
      const verifyRes = await fetch("http://localhost:3001/api/v1/licensing/verify", {
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
      const res1 = await fetch("http://localhost:3001/api/v1/licensing/verify-offline-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data1: any = await res1.json();
      expect(res1.status).toBe(200);
      expect(data1.valid).toBe(true);

      // 2. JWKS mengekspos public key Ed25519
      const jwksRes = await fetch("http://localhost:3001/.well-known/jwks.json");
      const jwks: any = await jwksRes.json();
      expect(jwksRes.status).toBe(200);
      expect(jwks.keys[0].kty).toBe("OKP");
      expect(jwks.keys[0].crv).toBe("Ed25519");

      // 3. Verifikasi lokal SDK (Web Crypto Ed25519) tanpa server
      const localVerify = await new Tertaut({
        apiKey: "tt_test_int04",
        appId: app.id,
        baseUrl: "http://localhost:3001",
      }).licensing.verifyOfflineToken(token);
      expect(localVerify.valid).toBe(true);
      expect(localVerify.claims?.lic).toBe(testKey);

      // 4. Revoke -> jti masuk denylist
      const revRes = await fetch("http://localhost:3001/api/v1/licensing/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ licenseKey: testKey }),
      });
      expect(revRes.status).toBe(200);

      // 5. Token yang sama harus ditolak setelah revoke
      const res2 = await fetch("http://localhost:3001/api/v1/licensing/verify-offline-token", {
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
