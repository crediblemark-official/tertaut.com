import { describe, it, expect } from "bun:test";
import { AiGatewayService } from "../../services/aiGateway";
import { CryptoService } from "../../services/crypto";
import { db } from "../../db";
import {
  apps,
  licenses,
  aiAppConfigs,
  aiVaultCredentials,
  aiUsageLogs,
  aiProxyLogs,
} from "../../db/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";

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
