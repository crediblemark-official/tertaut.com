import { describe, it, expect } from "bun:test";
import { DanaService } from "../../services/payments/dana/dana";
import { config } from "../../config";
import { generateKeyPairSync, createSign } from "crypto";

describe("Unit Tests - DanaService", () => {
  it("should verify DANA webhook signature with RSA-SHA256 and sandbox/production rules", () => {
    const origSandbox = config.isSandbox;
    const origPubKey = config.dana.publicKey;
    const origSecret = config.dana.clientSecret;

    // 1. Sandbox without keys bypasses
    config.isSandbox = true;
    config.dana.publicKey = "";
    config.dana.clientSecret = "";
    expect(DanaService.verifyWebhook({}, { status: "SUCCESS" })).toBe(true);

    // 2. Production without publicKey rejects
    config.isSandbox = false;
    config.dana.publicKey = "";
    config.dana.clientSecret = "secret";
    expect(DanaService.verifyWebhook({ signature: "some-sig" }, { status: "SUCCESS" })).toBe(false);

    // 3. RSA signature verification
    const { publicKey, privateKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
    });

    config.dana.publicKey = publicKey;
    const bodyObj = { status: "SUCCESS", amount: { value: "50000.00" } };
    const bodyStr = JSON.stringify(bodyObj);

    // Generate valid RSA signature
    const signer = createSign("SHA256");
    signer.update(bodyStr);
    const validSig = signer.sign(privateKey, "base64");

    expect(DanaService.verifyWebhook({ signature: validSig }, bodyStr)).toBe(true);
    expect(DanaService.verifyWebhook({ signature: "invalid_sig_base64" }, bodyStr)).toBe(false);

    // Restore
    config.isSandbox = origSandbox;
    config.dana.publicKey = origPubKey;
    config.dana.clientSecret = origSecret;
  });

  it("should throw error on DANA disbursement when credentials missing", async () => {
    const origSandbox = config.isSandbox;
    const origClientId = config.dana.clientId;
    const origSecret = config.dana.clientSecret;

    // Both sandbox and live throw when credentials are missing (no mock fallback)
    config.isSandbox = true;
    config.dana.clientId = "";
    config.dana.clientSecret = "";
    expect(
      DanaService.createDisbursement({
        externalId: "dana_disb_unit_1",
        amount: 100_000,
        bankCode: "BNI",
        accountHolderName: "Dana Tester",
        accountNumber: "0987654321",
        description: "Test payout",
      })
    ).rejects.toThrow();

    config.isSandbox = false;
    expect(
      DanaService.createDisbursement({
        externalId: "dana_disb_fail",
        amount: 100_000,
        bankCode: "BNI",
        accountHolderName: "Dana Tester",
        accountNumber: "0987654321",
        description: "Test payout fail",
      })
    ).rejects.toThrow();

    config.isSandbox = origSandbox;
    config.dana.clientId = origClientId;
    config.dana.clientSecret = origSecret;
  });
});
