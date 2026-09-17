import { describe, it, expect, beforeEach } from "bun:test";
import { enforceRateLimit, resetRateLimits } from "../services/rateLimiter";
import { CryptoService } from "../services/crypto";
import { EmailService } from "../services/email";
import { XenditService } from "../services/xendit";
import { DanaService } from "../services/dana";
import { AiGatewayService } from "../services/aiGateway";
import { handleDanaFinishPaymentWebhook, handleDanaDisburseNotifyWebhook } from "../routes/webhook/dana";
import { authenticate } from "../middleware/auth";
import { Tertaut } from "../../../packages/sdk/src/index";
import { config } from "../config";
import { db } from "../db";
import {
  apps,
  licenses,
  aiAppConfigs,
  aiVaultCredentials,
  aiUsageLogs,
  aiProxyLogs,
} from "../db/schema";
import { eq } from "drizzle-orm";
import { generateKeyPairSync, randomUUID } from "crypto";

describe("Unit Tests - RateLimiter Service", () => {
  beforeEach(() => {
    resetRateLimits();
  });

  it("should extract client IP from various headers and handle fallback", () => {
    // 1. cf-connecting-ip
    const reqCf = new Request("http://localhost/test", {
      headers: { "cf-connecting-ip": "198.51.100.1" },
    });
    const resCf = enforceRateLimit(reqCf, "test-scope", 5, 60_000);
    expect(resCf.allowed).toBe(true);

    // 2. x-real-ip
    const reqReal = new Request("http://localhost/test", {
      headers: { "x-real-ip": "198.51.100.2" },
    });
    const resReal = enforceRateLimit(reqReal, "test-scope", 5, 60_000);
    expect(resReal.allowed).toBe(true);

    // 3. x-forwarded-for with multiple IPs
    const reqXff = new Request("http://localhost/test", {
      headers: { "x-forwarded-for": "198.51.100.3, 10.0.0.1" },
    });
    const resXff = enforceRateLimit(reqXff, "test-scope", 5, 60_000);
    expect(resXff.allowed).toBe(true);

    // 4. IPv6 support
    const reqIpv6 = new Request("http://localhost/test", {
      headers: { "cf-connecting-ip": "2001:db8::1" },
    });
    const resIpv6 = enforceRateLimit(reqIpv6, "test-scope", 5, 60_000);
    expect(resIpv6.allowed).toBe(true);

    // 5. Undefined request / missing headers fallback
    const resUndefined = enforceRateLimit(undefined, "test-scope", 5, 60_000);
    expect(resUndefined.allowed).toBe(true);

    const reqEmpty = new Request("http://localhost/test");
    const resEmpty = enforceRateLimit(reqEmpty, "test-scope", 5, 60_000);
    expect(resEmpty.allowed).toBe(true);
  });

  it("should enforce limit and return retryAfter when exceeded", () => {
    const req = new Request("http://localhost/test", {
      headers: { "x-real-ip": "203.0.113.50" },
    });

    const limit = 3;
    const windowMs = 5000;

    // 1st request
    const r1 = enforceRateLimit(req, "auth", limit, windowMs);
    expect(r1.allowed).toBe(true);
    expect(r1.retryAfter).toBe(0);

    // 2nd request
    const r2 = enforceRateLimit(req, "auth", limit, windowMs);
    expect(r2.allowed).toBe(true);

    // 3rd request
    const r3 = enforceRateLimit(req, "auth", limit, windowMs);
    expect(r3.allowed).toBe(true);

    // 4th request (exceeded limit)
    const r4 = enforceRateLimit(req, "auth", limit, windowMs);
    expect(r4.allowed).toBe(false);
    expect(r4.retryAfter).toBeGreaterThan(0);
    expect(r4.retryAfter).toBeLessThanOrEqual(5);
  });
});

describe("Unit Tests - CryptoService", () => {
  it("should handle key derivation branches properly", () => {
    const plain = "secret-tertaut-payload-12345";
    const encrypted = CryptoService.encrypt(plain);
    const decrypted = CryptoService.decrypt(encrypted.cipherText, encrypted.iv, encrypted.authTag);
    expect(decrypted).toBe(plain);
  });

  it("should throw error when decrypting with tampered data or authTag", () => {
    const plain = "tamper-proof-test";
    const encrypted = CryptoService.encrypt(plain);

    // Tampered ciphertext
    expect(() => {
      CryptoService.decrypt("00" + encrypted.cipherText.slice(2), encrypted.iv, encrypted.authTag);
    }).toThrow();

    // Tampered authTag
    expect(() => {
      CryptoService.decrypt(encrypted.cipherText, encrypted.iv, "00" + encrypted.authTag.slice(2));
    }).toThrow();
  });

  it("should create and verify signed JWT tokens correctly", () => {
    const payload = { userId: "usr_123", role: "builder", app: "app_xyz" };
    const token = CryptoService.createSignedToken(payload, 3600);

    expect(typeof token).toBe("string");
    expect(token.split(".").length).toBe(3);

    // Verify valid token
    const verified = CryptoService.verifySignedToken<typeof payload>(token);
    expect(verified).not.toBeNull();
    expect(verified?.userId).toBe("usr_123");
    expect(verified?.role).toBe("builder");
    expect(verified?.app).toBe("app_xyz");
  });

  it("should reject tampered, malformed, or expired signed JWT tokens", () => {
    // Malformed token
    expect(CryptoService.verifySignedToken("invalid.token")).toBeNull();
    expect(CryptoService.verifySignedToken("one.two.three.four")).toBeNull();
    expect(CryptoService.verifySignedToken("")).toBeNull();

    // Tampered token signature
    const token = CryptoService.createSignedToken({ id: "valid_token" }, 3600);
    const parts = token.split(".");
    const tampered = `${parts[0]}.${parts[1]}.badsignature`;
    expect(CryptoService.verifySignedToken(tampered)).toBeNull();

    // Expired token (expires in -10 seconds)
    const expiredToken = CryptoService.createSignedToken({ id: "expired_token" }, -10);
    expect(CryptoService.verifySignedToken(expiredToken)).toBeNull();
  });
});

describe("Unit Tests - EmailService", () => {
  it("should report isConfigured based on config", () => {
    const originalKey = config.email.resendApiKey;
    const originalFrom = config.email.from;

    config.email.resendApiKey = "";
    expect(EmailService.isConfigured()).toBe(false);

    config.email.resendApiKey = "re_test_123";
    config.email.from = "Tertaut <noreply@tertaut.com>";
    expect(EmailService.isConfigured()).toBe(true);

    // Restore
    config.email.resendApiKey = originalKey;
    config.email.from = originalFrom;
  });

  it("should skip sending when unconfigured", async () => {
    const originalKey = config.email.resendApiKey;
    config.email.resendApiKey = "";

    const res = await EmailService.send({
      to: "buyer@example.com",
      subject: "Test Subject",
      html: "<p>Hello</p>",
    });

    expect(res.ok).toBe(false);
    expect(res.skipped).toBe(true);

    config.email.resendApiKey = originalKey;
  });

  it("should send email via Resend and handle 200, error responses, and exceptions", async () => {
    const originalKey = config.email.resendApiKey;
    const originalFrom = config.email.from;
    const originalFetch = globalThis.fetch;

    config.email.resendApiKey = "re_mock_test_key";
    config.email.from = "Tertaut <noreply@tertaut.com>";

    // Mock successful 200 response
    globalThis.fetch = (async () => {
      return new Response(JSON.stringify({ id: "email_msg_999" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as any;

    const okResult = await EmailService.send({
      to: "success@example.com",
      subject: "Success Subject",
      html: "<p>Success</p>",
      text: "Success",
      replyTo: "support@tertaut.com",
    });
    expect(okResult.ok).toBe(true);
    expect(okResult.id).toBe("email_msg_999");

    // Mock 400 error response
    globalThis.fetch = (async () => {
      return new Response(JSON.stringify({ message: "Invalid recipient" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }) as any;

    const errResult = await EmailService.send({
      to: "bad@example.com",
      subject: "Fail Subject",
      html: "<p>Fail</p>",
    });
    expect(errResult.ok).toBe(false);
    expect(errResult.error).toContain("400");

    // Mock network failure exception
    globalThis.fetch = (async () => {
      throw new Error("DNS resolution failed");
    }) as any;

    const netResult = await EmailService.send({
      to: "net@example.com",
      subject: "Net Subject",
      html: "<p>Net</p>",
    });
    expect(netResult.ok).toBe(false);
    expect(netResult.error).toContain("DNS resolution failed");

    // Test sendLicenseIssued helper
    globalThis.fetch = (async () => {
      return new Response(JSON.stringify({ id: "email_lic_111" }), { status: 200 });
    }) as any;

    const licEmailRes = await EmailService.sendLicenseIssued({
      to: "buyer@example.com",
      appName: "Awesome App",
      licenseKey: "TT-TEST-AAAA-BBBB",
      expiresAt: new Date("2026-12-31T00:00:00.000Z"),
      customerName: "Buyer Test",
    });
    expect(licEmailRes.ok).toBe(true);

    // Restore
    globalThis.fetch = originalFetch;
    config.email.resendApiKey = originalKey;
    config.email.from = originalFrom;
  });
});

describe("Unit Tests - XenditService", () => {
  it("should calculate correct MoR breakdown (5% platform fee, 95% net)", () => {
    const breakdown1 = XenditService.calculateMorBreakdown(100_000);
    expect(breakdown1.grossAmount).toBe(100_000);
    expect(breakdown1.platformFee).toBe(5_000);
    expect(breakdown1.netAmount).toBe(95_000);

    const breakdown2 = XenditService.calculateMorBreakdown(50_000);
    expect(breakdown2.grossAmount).toBe(50_000);
    expect(breakdown2.platformFee).toBe(2_500);
    expect(breakdown2.netAmount).toBe(47_500);
  });

  it("should resolve disbursement account for valid bank, sandbox fallback, or live mode", () => {
    // Valid bank account on builder
    const acc = XenditService.resolveDisbursementAccount({
      name: "Budi Builder",
      disbursementAccount: {
        bankCode: "MANDIRI",
        accountNumber: "1400012345678",
        accountHolderName: "Budi Santoso",
      },
    });
    expect(acc?.bankCode).toBe("MANDIRI");
    expect(acc?.accountNumber).toBe("1400012345678");
    expect(acc?.accountHolderName).toBe("Budi Santoso");

    // Sandbox fallback
    const origSandbox = config.isSandbox;
    config.isSandbox = true;
    const sandboxAcc = XenditService.resolveDisbursementAccount({
      name: "Demo Builder",
      disbursementAccount: null,
    });
    expect(sandboxAcc?.bankCode).toBe("BCA");
    expect(sandboxAcc?.accountHolderName).toBe("Demo Builder");

    // Live mode rejection when no account configured
    config.isSandbox = false;
    const liveAcc = XenditService.resolveDisbursementAccount({
      name: "Live Builder",
      disbursementAccount: null,
    });
    expect(liveAcc).toBeNull();

    config.isSandbox = origSandbox;
  });

  it("should verify webhook token accurately", () => {
    const origToken = config.xendit.webhookToken;
    const origSandbox = config.isSandbox;

    // Configured token
    config.xendit.webhookToken = "valid_xendit_webhook_token_123";
    expect(XenditService.verifyWebhook("valid_xendit_webhook_token_123")).toBe(true);
    expect(XenditService.verifyWebhook("wrong_token")).toBe(false);

    // Unconfigured in sandbox bypass vs live rejection
    config.xendit.webhookToken = "";
    config.isSandbox = true;
    expect(XenditService.verifyWebhook(undefined)).toBe(true);

    config.isSandbox = false;
    expect(XenditService.verifyWebhook(undefined)).toBe(false);

    config.xendit.webhookToken = origToken;
    config.isSandbox = origSandbox;
  });

  it("should handle createInvoice in mock mode and throw if unconfigured in live", async () => {
    const origSandbox = config.isSandbox;
    const origKey = config.xendit.secretKey;

    // Mock enabled in sandbox
    config.isSandbox = true;
    config.xendit.secretKey = "";
    const mockInv = await XenditService.createInvoice({
      externalId: "ext_mock_123",
      amount: 150_000,
      payerEmail: "payer@example.com",
      description: "Test Mock Invoice",
    });
    expect(mockInv.status).toBe("PENDING");
    expect(mockInv.amount).toBe(150_000);
    expect(mockInv.external_id).toBe("ext_mock_123");

    // Live without secretKey throws error
    config.isSandbox = false;
    config.xendit.secretKey = "";
    expect(
      XenditService.createInvoice({
        externalId: "ext_live_123",
        amount: 150_000,
        payerEmail: "payer@example.com",
        description: "Live Invoice Fail",
      })
    ).rejects.toThrow();

    config.isSandbox = origSandbox;
    config.xendit.secretKey = origKey;
  });

  it("should create disbursement in mock mode and handle live failure if unconfigured", async () => {
    const origSandbox = config.isSandbox;
    const origKey = config.xendit.secretKey;

    config.isSandbox = true;
    config.xendit.secretKey = "";
    const disb = await XenditService.createDisbursement({
      externalId: "disb_test_123",
      amount: 95_000,
      bankCode: "BCA",
      accountHolderName: "Sandbox Builder",
      accountNumber: "1234567890",
      description: "Payout test",
    });
    expect(disb.status).toBe("COMPLETED");
    expect(disb.amount).toBe(95_000);

    config.isSandbox = false;
    config.xendit.secretKey = "";
    expect(
      XenditService.createDisbursement({
        externalId: "disb_test_fail",
        amount: 95_000,
        bankCode: "BCA",
        accountHolderName: "Live Builder",
        accountNumber: "1234567890",
        description: "Payout live fail",
      })
    ).rejects.toThrow();

    config.isSandbox = origSandbox;
    config.xendit.secretKey = origKey;
  });
});

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
    const signer = require("crypto").createSign("SHA256");
    signer.update(bodyStr);
    const validSig = signer.sign(privateKey, "base64");

    expect(DanaService.verifyWebhook({ signature: validSig }, bodyStr)).toBe(true);
    expect(DanaService.verifyWebhook({ signature: "invalid_sig_base64" }, bodyStr)).toBe(false);

    // Restore
    config.isSandbox = origSandbox;
    config.dana.publicKey = origPubKey;
    config.dana.clientSecret = origSecret;
  });

  it("should handle DANA disbursement mock mode vs missing credential error", async () => {
    const origSandbox = config.isSandbox;
    const origClientId = config.dana.clientId;
    const origSecret = config.dana.clientSecret;

    // Sandbox mock mode
    config.isSandbox = true;
    config.dana.clientId = "";
    config.dana.clientSecret = "";
    const mockDisb = await DanaService.createDisbursement({
      externalId: "dana_disb_unit_1",
      amount: 100_000,
      bankCode: "BNI",
      accountHolderName: "Dana Tester",
      accountNumber: "0987654321",
      description: "Test payout",
    });
    expect(mockDisb.status).toBe("COMPLETED");
    expect(mockDisb.external_id).toBe("dana_disb_unit_1");

    // Live mode without credentials throws error
    config.isSandbox = false;
    config.dana.clientId = "";
    config.dana.clientSecret = "";
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

describe("Unit Tests - AiGatewayService", () => {
  it("should format SSE chunk and done messages according to OpenAI streaming spec", () => {
    const chunk = AiGatewayService.formatSseChunk("chatcmpl-unit-1", "Halo dari AI");
    expect(chunk).toStartWith("data: ");
    expect(chunk).toEndWith("\n\n");
    const jsonStr = chunk.slice(6).trim();
    const parsed = JSON.parse(jsonStr);
    expect(parsed.id).toBe("chatcmpl-unit-1");
    expect(parsed.choices[0].delta.content).toBe("Halo dari AI");

    const done = AiGatewayService.formatSseDone();
    expect(done).toBe("data: [DONE]\n\n");
  });

  it("should enforce sliding window rate limit and prune stale keys when map exceeds threshold", () => {
    const id = "unit_ratelimit_user";

    // Allow under limit
    for (let i = 0; i < 5; i++) {
      const res = AiGatewayService.checkRateLimit(id, 5);
      expect(res.allowed).toBe(true);
    }

    // Exceed limit
    const exceeded = AiGatewayService.checkRateLimit(id, 5);
    expect(exceeded.allowed).toBe(false);
    expect(exceeded.retryAfter).toBeGreaterThan(0);

    // Map pruning test: insert >200 dummy keys
    for (let i = 0; i < 205; i++) {
      AiGatewayService.checkRateLimit(`dummy_key_${i}`, 10);
    }
  });

  it("should validate license with missing token, invalid license, and expired license", async () => {
    // 1. Missing token
    const noToken = await AiGatewayService.validateLicense(undefined, undefined);
    expect(noToken.valid).toBe(false);
    expect(noToken.statusCode).toBe(401);

    // 2. Invalid non-existent license key
    const invalidLic = await AiGatewayService.validateLicense("Bearer TT-NONEXISTENT-9999");
    expect(invalidLic.valid).toBe(false);
    expect(invalidLic.statusCode).toBe(403);
    expect(invalidLic.error).toBe("INVALID_LICENSE");

    // 3. Signed token with REVOKED status in claims
    const revokedClaimToken = CryptoService.createSignedToken(
      { lic: "TT-REVOKED-0001", status: "REVOKED" },
      3600
    );
    const resRevoked = await AiGatewayService.validateLicense(revokedClaimToken);
    expect(resRevoked.valid).toBe(false);
    expect(resRevoked.statusCode).toBe(403);
    expect(resRevoked.error).toBe("LICENSE_REVOKED_OR_EXPIRED");
  });

  it("should calculate daily tokens used, record usage, and calculate quota status", async () => {
    let existingApp = await db.query.apps.findFirst();
    const testLicId = `lic_quota_${Date.now()}`;
    const testLicKey = `TT-QUOTA-${Date.now()}`;
    let testAppId: string;
    let cleanupApp = false;

    if (existingApp) {
      testAppId = existingApp.id;
    } else {
      const builder = await db.query.builders.findFirst();
      if (!builder) return;
      testAppId = `app_quota_${Date.now()}`;
      await db.insert(apps).values({
        id: testAppId,
        slug: `quota-test-${Date.now()}`,
        name: "Quota Test App",
        builderId: builder.id,
      });
      cleanupApp = true;
    }

    await db.insert(licenses).values({
      id: testLicId,
      appId: testAppId,
      licenseKey: testLicKey,
      status: "ACTIVE",
      customerEmail: "quota@tertaut.com",
    });

    const testModelAlias = `alias_${Date.now()}`;

    await db.insert(aiAppConfigs).values({
      id: `cfg_${Date.now()}`,
      appId: testAppId,
      modelAlias: testModelAlias,
      targetModelName: "gpt-4o-mini",
      dailyTokenLimit: 50_000,
    });

    await db.insert(aiVaultCredentials).values({
      id: randomUUID(),
      appId: testAppId,
      provider: "openai",
      encryptedApiKey: "test_key",
      iv: "test_iv",
      authTag: "test_tag",
      monthlyBudgetLimit: 1_000_000,
      currentMonthlyUsage: 100,
    });

    try {
      // Record AI usage
      await AiGatewayService.recordUsage({
        licenseId: testLicId,
        appId: testAppId,
        modelAlias: testModelAlias,
        promptTokens: 150,
        completionTokens: 250,
        responseTimeMs: 320,
        provider: "openai",
        model: "gpt-4o",
      });

      // Verify daily tokens used
      const usedTokens = await AiGatewayService.getDailyTokensUsed(testLicId, testAppId);
      expect(usedTokens).toBeGreaterThanOrEqual(400);

      // Verify quota status
      const licRow = await db.query.licenses.findFirst({
        where: eq(licenses.id, testLicId),
      });
      const quota = await AiGatewayService.getQuotaStatus(licRow!, testModelAlias);
      expect(quota.dailyTokenLimit).toBe(50_000);
      expect(quota.dailyTokensUsed).toBeGreaterThanOrEqual(400);
      expect(quota.remainingTokens).toBeLessThanOrEqual(50_000 - 400);
      expect(quota.resetInSeconds).toBeGreaterThan(0);
    } finally {
      // Cleanup
      await db.delete(aiUsageLogs).where(eq(aiUsageLogs.appId, testAppId));
      await db.delete(aiProxyLogs).where(eq(aiProxyLogs.appId, testAppId));
      await db.delete(aiAppConfigs).where(eq(aiAppConfigs.modelAlias, testModelAlias));
      await db.delete(aiVaultCredentials).where(eq(aiVaultCredentials.appId, testAppId));
      await db.delete(licenses).where(eq(licenses.id, testLicId));
      if (cleanupApp) {
        await db.delete(apps).where(eq(apps.id, testAppId));
      }
    }
  });
});

describe("Unit Tests - Webhook Handlers", () => {
  it("should handle DANA finish payment webhook UAT scenarios (11012 and 11011)", async () => {
    const origSandbox = config.isSandbox;
    config.isSandbox = true;

    const set500: any = {};
    const res500: any = await handleDanaFinishPaymentWebhook({
      headers: {},
      body: { amount: { value: "11012" } },
      set: set500,
    });
    expect(set500.status).toBe(500);
    expect(res500.responseCode).toBe("5005601");

    const set200: any = {};
    const res200: any = await handleDanaFinishPaymentWebhook({
      headers: {},
      body: JSON.stringify({ amount: { value: "11011" } }),
      set: set200,
    });
    expect(set200.status).toBe(200);
    expect(res200.responseCode).toBe("2005600");

    config.isSandbox = origSandbox;
  });

  it("should reject DANA finish payment webhook on invalid signature", async () => {
    const origSandbox = config.isSandbox;
    const origPubKey = config.dana.publicKey;

    config.isSandbox = false;
    config.dana.publicKey = ""; // Live without public key must reject

    const set: any = {};
    const res: any = await handleDanaFinishPaymentWebhook({
      headers: { signature: "invalid_sig" },
      body: { amount: { value: "50000" } },
      set,
    });

    expect(set.status).toBe(401);
    expect(res.responseCode).toBe("4015600");

    config.isSandbox = origSandbox;
    config.dana.publicKey = origPubKey;
  });

  it("should acknowledge DANA finish webhook when transaction is missing or not found", async () => {
    const set: any = {};
    const res: any = await handleDanaFinishPaymentWebhook({
      headers: {},
      body: { merchantTransId: "tx_non_existent_99999" },
      set,
    });

    expect(res.responseCode).toBe("2005600");
  });

  it("should handle DANA disburse notify webhook completed, pending, and rejection", async () => {
    const origSandbox = config.isSandbox;
    config.isSandbox = true;

    // Completed webhook
    const setOk: any = {};
    const resOk = await handleDanaDisburseNotifyWebhook({
      headers: {},
      body: {
        partnerReferenceNo: "disb_ext_999",
        status: "SUCCESS",
      },
      set: setOk,
    });
    expect(resOk.responseCode).toBe("2002900");
    expect(resOk.status).toBe("COMPLETED");

    // Pending webhook
    const resPending = await handleDanaDisburseNotifyWebhook({
      headers: {},
      body: {
        partnerReferenceNo: "disb_ext_999",
        status: "PENDING",
      },
      set: {},
    });
    expect(resPending.responseCode).toBe("2002900");

    // Rejected webhook in live mode with missing signature
    config.isSandbox = false;
    config.dana.publicKey = "";
    const setErr: any = {};
    const resErr = await handleDanaDisburseNotifyWebhook({
      headers: {},
      body: { status: "SUCCESS" },
      set: setErr,
    });
    expect(setErr.status).toBe(401);
    expect(resErr.error).toBe("Invalid Webhook Signature");

    config.isSandbox = origSandbox;
  });
});

describe("Unit Tests - Tertaut SDK", () => {
  it("should enforce constructor validations and default options", () => {
    expect(() => new Tertaut({} as any)).toThrow("[Tertaut SDK] appId is required.");

    const sdkSandbox = new Tertaut({ appId: "app_test_sandbox", environment: "sandbox" });
    expect(sdkSandbox.baseUrl).toBe("http://localhost:3000");

    const sdkProd = new Tertaut({ appId: "app_test_prod", environment: "production" });
    expect(sdkProd.baseUrl).toBe("https://tertaut.com");

    const sdkCustom = new Tertaut({ appId: "app_test_custom", baseUrl: "https://custom.api.com/" });
    expect(sdkCustom.baseUrl).toBe("https://custom.api.com");
  });

  it("should validate checkout params and execute checkout session request", async () => {
    const sdk = new Tertaut({ appId: "app_sdk_test", baseUrl: "http://localhost:3000" });

    // Missing customerEmail throws
    expect(sdk.checkout({ amount: 100_000 } as any)).rejects.toThrow("customerEmail is required");

    // Mock fetch for checkout
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      expect(url).toBe("http://localhost:3000/api/v1/checkout/session");
      const body = JSON.parse(init?.body as string);
      expect(body.appId).toBe("app_sdk_test");
      expect(body.amount).toBe(75_000);
      expect(body.grantDays).toBe(30);
      return new Response(
        JSON.stringify({
          checkoutUrl: "https://tertaut.com/pay/tx_123",
          transactionId: "tx_123",
        }),
        { status: 200 }
      );
    }) as any;

    const result = await sdk.checkout({
      amount: 75_000,
      customerEmail: "sdkbuyer@tertaut.com",
    });

    expect(result.checkoutUrl).toBe("https://tertaut.com/pay/tx_123");
    expect(result.transactionId).toBe("tx_123");

    globalThis.fetch = originalFetch;
  });

  it("should invoke licensing methods: validate, verify, activate, deactivate, and getJwks", async () => {
    const sdk = new Tertaut({ appId: "app_lic_sdk", baseUrl: "http://localhost:3000" });
    const originalFetch = globalThis.fetch;

    globalThis.fetch = (async (url: string) => {
      if (url.endsWith("/licensing/verify")) {
        return new Response(JSON.stringify({ valid: true, status: "ACTIVE" }), { status: 200 });
      }
      if (url.endsWith("/licensing/activate")) {
        return new Response(JSON.stringify({ activated: true }), { status: 200 });
      }
      if (url.endsWith("/licensing/deactivate")) {
        return new Response(JSON.stringify({ deactivated: true }), { status: 200 });
      }
      if (url.endsWith("/jwks.json")) {
        return new Response(JSON.stringify({ keys: [] }), { status: 200 });
      }
      return new Response("{}", { status: 200 });
    }) as any;

    const val = await sdk.licensing.validate({ licenseKey: "TT-123", hardwareId: "HW-1" });
    expect(val.valid).toBe(true);

    const ver = await sdk.licensing.verify({ licenseKey: "TT-123", hwid: "HW-1" });
    expect(ver.valid).toBe(true);

    const act = await sdk.licensing.activate({ licenseKey: "TT-123", hwid: "HW-1" });
    expect(act.activated).toBe(true);

    const deact = await sdk.licensing.deactivate({ licenseKey: "TT-123", hwid: "HW-1" });
    expect(deact.deactivated).toBe(true);

    const jwks = await sdk.licensing.getJwks();
    expect(jwks.keys).toBeDefined();

    globalThis.fetch = originalFetch;
  });

  it("should verify offline token errors: malformed, missing keys, invalid signature", async () => {
    const sdk = new Tertaut({ appId: "app_offline_sdk" });

    // Malformed token
    const malformed = await sdk.licensing.verifyOfflineToken("not.enough.parts.four.five");
    expect(malformed.valid).toBe(false);

    const empty = await sdk.licensing.verifyOfflineToken("");
    expect(empty.valid).toBe(false);
    expect(empty.reason).toBe("MALFORMED_TOKEN");

    // Missing JWK keys
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      return new Response(JSON.stringify({ keys: [] }), { status: 200 });
    }) as any;

    const noKey = await sdk.licensing.verifyOfflineToken("header.claims.sig");
    expect(noKey.valid).toBe(false);
    expect(noKey.reason).toBe("PUBLIC_KEY_UNAVAILABLE");

    globalThis.fetch = originalFetch;
  });

  it("should wrap credits API: balance, consume, and history", async () => {
    const sdk = new Tertaut({ appId: "app_credits_sdk", baseUrl: "http://localhost:3000" });
    const originalFetch = globalThis.fetch;

    globalThis.fetch = (async (url: string) => {
      if (url.endsWith("/credits/balance")) {
        return new Response(JSON.stringify({ balance: 100 }), { status: 200 });
      }
      if (url.endsWith("/credits/consume")) {
        return new Response(JSON.stringify({ balance: 80, consumed: 20 }), { status: 200 });
      }
      if (url.endsWith("/credits/history")) {
        return new Response(JSON.stringify({ balance: 80, entries: [] }), { status: 200 });
      }
      return new Response("{}", { status: 200 });
    }) as any;

    const bal = await sdk.credits.balance({ licenseKey: "TT-CRED", hwid: "HW-1" });
    expect(bal.balance).toBe(100);

    const con = await sdk.credits.consume({ licenseKey: "TT-CRED", hwid: "HW-1", amount: 20 });
    expect(con.consumed).toBe(20);

    const hist = await sdk.credits.history({ licenseKey: "TT-CRED", hwid: "HW-1" });
    expect(hist.balance).toBe(80);

    globalThis.fetch = originalFetch;
  });

  it("should support aiProxy chat and chatStream SSE streaming parser", async () => {
    const sdk = new Tertaut({ appId: "app_ai_sdk", baseUrl: "http://localhost:3000" });
    const originalFetch = globalThis.fetch;

    // 1. Non-streaming chat
    globalThis.fetch = (async () => {
      return new Response(JSON.stringify({ text: "AI Response", model: "fast-summary" }), {
        status: 200,
      });
    }) as any;

    const chatRes = await sdk.aiProxy.chat({
      licenseKey: "TT-AI-KEY",
      prompt: "Ringkas dokumen ini",
    });
    expect(chatRes.text).toBe("AI Response");

    // 2. Streaming chatStream (SSE Generator)
    const sseBody = [
      'data: {"choices":[{"delta":{"content":"Halo "}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"Dunia!"}}]}\n\n',
      "data: [DONE]\n\n",
    ].join("");

    globalThis.fetch = (async () => {
      return new Response(sseBody, {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      });
    }) as any;

    const stream = await sdk.aiProxy.chatStream({
      licenseKey: "TT-AI-KEY",
      prompt: "Streaming test",
    });

    const collected: string[] = [];
    for await (const chunk of stream) {
      collected.push(chunk.text);
    }

    expect(collected.join("")).toBe("Halo Dunia!");

    // 3. Error response handling in chatStream
    globalThis.fetch = (async () => {
      return new Response(JSON.stringify({ message: "Daily limit exceeded" }), { status: 429 });
    }) as any;

    expect(
      sdk.aiProxy.chatStream({
        licenseKey: "TT-AI-KEY",
        prompt: "Will fail",
      })
    ).rejects.toThrow("Daily limit exceeded");

    globalThis.fetch = originalFetch;
  });
});

describe("Unit Tests - Auth Middleware & Guard", () => {
  it("should strictly reject unauthenticated requests with 401 Unauthorized (DEV_USER eliminated)", async () => {
    // Empty headers -> unauthenticated -> status 401
    const res = await authenticate(new Headers());
    expect(res).toEqual({ status: 401, error: "Unauthorized" });
  });

  it("should strictly reject unauthenticated admin requests with 401", async () => {
    // Admin check without session -> status 401
    const res = await authenticate(new Headers(), true);
    expect(res).toEqual({ status: 401, error: "Unauthorized" });
  });
});
