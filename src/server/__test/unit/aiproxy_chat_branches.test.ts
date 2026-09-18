import { describe, it, expect, beforeEach } from "bun:test";
import { setupTestAuth } from "../setup";
import { db } from "../../db";
import { builders, apps, aiVaultCredentials, aiAppConfigs } from "../../db/schema";
import { generateAppApiKey, generateBuilderSecretApiKey } from "../../routes/apps/api-key";
import { LicenseService } from "../../services/license";
import { CryptoService } from "../../services/crypto";
import { AiGatewayService } from "../../services/aiGateway";
import { handleAiChat } from "../../routes/aiproxy/chat";
import { eq } from "drizzle-orm";

setupTestAuth();

const suffix = () => `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

describe("Coverage: handleAiChat edge cases & error branches", () => {
  let builderId = "";
  let appId = "";
  let licenseKey = "";

  beforeEach(async () => {
    const email = `ai_chat_${suffix()}@test.com`;
    const [b] = await db.insert(builders).values({
      email,
      name: "AI Chat Builder",
      apiKey: generateAppApiKey("live"),
      secretApiKey: generateBuilderSecretApiKey(),
    }).returning();
    builderId = b.id;

    appId = `app_aichat_${suffix()}`;
    await db.insert(apps).values({
      id: appId,
      builderId,
      name: "AI Chat App",
      slug: `ai-chat-${suffix()}`,
      mode: "live",
      targetPrice: 50000,
    });

    const licRes = await LicenseService.issueDirect({
      appId,
      customerEmail: `customer_${suffix()}@test.com`,
      grantDays: 30,
      actor: { type: "ADMIN", id: "admin" },
    });
    licenseKey = licRes.license.licenseKey;
  });

  it("app mismatch: lisensi digunakan untuk appId lain -> 403", async () => {
    const set: any = { status: 200 };
    const res: any = await handleAiChat({
      body: { licenseKey, appId: "different_app_id", prompt: "Hello" },
      set,
    });
    expect(set.status).toBe(403);
    expect(res.error).toBe("APP_MISMATCH");
  });

  it("rate limit exceeded -> 429", async () => {
    const origCheck = AiGatewayService.checkRateLimit;
    try {
      AiGatewayService.checkRateLimit = () => ({ allowed: false, retryAfter: 60 });
      const set: any = { status: 200 };
      const res: any = await handleAiChat({
        body: { licenseKey, appId, prompt: "Hello" },
        set,
      });
      expect(set.status).toBe(429);
      expect(res.error).toBe("RATE_LIMIT_EXCEEDED");
    } finally {
      AiGatewayService.checkRateLimit = origCheck;
    }
  });

  it("daily token limit exceeded -> 429", async () => {
    const origTokens = AiGatewayService.getDailyTokensUsed;
    try {
      AiGatewayService.getDailyTokensUsed = async () => 200_000;
      const set: any = { status: 200 };
      const res: any = await handleAiChat({
        body: { licenseKey, appId, prompt: "Hello" },
        set,
      });
      expect(set.status).toBe(429);
      expect(res.error).toBe("DAILY_TOKEN_LIMIT_EXCEEDED");
    } finally {
      AiGatewayService.getDailyTokensUsed = origTokens;
    }
  });

  it("kill switch active -> 429", async () => {
    const encrypted = CryptoService.encrypt("sample_secret_key");
    await db.insert(aiVaultCredentials).values({
      appId,
      provider: "gemini",
      encryptedApiKey: encrypted.cipherText,
      iv: encrypted.iv,
      authTag: encrypted.authTag,
      isKillSwitchActive: true,
    });

    const set: any = { status: 200 };
    const res: any = await handleAiChat({
      body: { licenseKey, appId, prompt: "Hello" },
      set,
    });
    expect(set.status).toBe(429);
    expect(res.error).toBe("AI_KILL_SWITCH_ACTIVE");
  });

  it("monthly budget limit exceeded -> 429", async () => {
    const encrypted = CryptoService.encrypt("sample_secret_key");
    await db.insert(aiVaultCredentials).values({
      appId,
      provider: "gemini",
      encryptedApiKey: encrypted.cipherText,
      iv: encrypted.iv,
      authTag: encrypted.authTag,
      isKillSwitchActive: false,
      monthlyBudgetLimit: 100000,
      currentMonthlyUsage: 150000,
    });

    const set: any = { status: 200 };
    const res: any = await handleAiChat({
      body: { licenseKey, appId, prompt: "Hello" },
      set,
    });
    expect(set.status).toBe(429);
    expect(res.error).toBe("BUDGET_LIMIT_EXCEEDED");
  });

  it("failed decrypting vault key -> 500", async () => {
    // Insert corrupted authTag / iv
    await db.insert(aiVaultCredentials).values({
      appId,
      provider: "gemini",
      encryptedApiKey: "corrupted_payload",
      iv: "bad_iv",
      authTag: "bad_tag",
      isKillSwitchActive: false,
      monthlyBudgetLimit: 500000,
      currentMonthlyUsage: 0,
    });

    const set: any = { status: 200 };
    const res: any = await handleAiChat({
      body: { licenseKey, appId, prompt: "Hello" },
      set,
    });
    expect(set.status).toBe(500);
    expect(res.error).toBe("FAILED_DECRYPTING_VAULT_KEY");
  });

  it("empty prompt and empty messages -> 400", async () => {
    const set: any = { status: 200 };
    const res: any = await handleAiChat({
      body: { licenseKey, appId, prompt: "", messages: [] },
      set,
    });
    expect(set.status).toBe(400);
    expect(res.error).toBe("EMPTY_PROMPT");
  });
});
