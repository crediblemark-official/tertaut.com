import { describe, it, expect } from "bun:test";
import { CryptoService } from "../../services/crypto";
import { LicenseService } from "../../services/license";
import { LicenseTokenService } from "../../services/licenseToken";
import { DanaService } from "../../services/dana";

describe("CryptoService (AES-256-GCM & JWT Tokens)", () => {
  it("should encrypt and decrypt string accurately using AES-256-GCM", () => {
    const originalText = "sk-ant-api03-sample-super-secret-key-12345";
    const encrypted = CryptoService.encrypt(originalText);

    expect(encrypted.cipherText).not.toBe(originalText);
    expect(encrypted.iv).toBeDefined();
    expect(encrypted.authTag).toBeDefined();

    const decrypted = CryptoService.decrypt(encrypted.cipherText, encrypted.iv, encrypted.authTag);
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

describe("DanaService (Merchant of Record Fee Breakdown)", () => {
  it("should calculate exactly 5% platform fee and 95% net payout", () => {
    const breakdown = DanaService.calculateMorBreakdown(100000);
    expect(breakdown.grossAmount).toBe(100000);
    expect(breakdown.platformFee).toBe(5000);
    expect(breakdown.netAmount).toBe(95000);
  });

  it("should accurately handle odd amounts with rounding", () => {
    const breakdown = DanaService.calculateMorBreakdown(49000);
    expect(breakdown.grossAmount).toBe(49000);
    expect(breakdown.platformFee).toBe(2450);
    expect(breakdown.netAmount).toBe(46550);
  });

  it("should process disbursement calculation with correct parameters", async () => {
    const disb = await DanaService.createDisbursement({
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
