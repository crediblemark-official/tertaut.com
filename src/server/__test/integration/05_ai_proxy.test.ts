import { describe, it, expect } from "bun:test";
import { setupTestAuth } from "../setup";
import { CryptoService } from "../../services/crypto";
import { AiGatewayService } from "../../services/aiGateway";
import { db } from "../../db";
import { licenses, aiAppConfigs, aiUsageLogs, aiVaultCredentials } from "../../db/schema";
import { eq, inArray } from "drizzle-orm";
import { app } from "../../index";

setupTestAuth();

describe("PRD Module 4: AI API Proxy Shield & Cost Guardrails", () => {
  it("should reject cross-app AI entitlement (body.appId tidak boleh membajak vault app lain)", async () => {
    const appList = await db.query.apps.findMany({ limit: 2 });
    if (appList.length < 2) return;
    const [ownerApp, otherApp] = appList;

    const testLicId = `lic_ai_cross_${Date.now()}`;
    const testKey = `TT-AICROSS-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    await db.insert(licenses).values({
      id: testLicId,
      appId: ownerApp.id,
      licenseKey: testKey,
      customerEmail: "cross@tertaut.com",
      status: "ACTIVE",
      maxSeats: 1,
    });

    try {
      const res = await fetch("http://localhost:3001/api/v1/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ licenseKey: testKey, appId: otherApp.id, prompt: "halo" }),
      });
      const data: any = await res.json();
      expect(res.status).toBe(403);
      expect(data.error).toBe("APP_MISMATCH");
    } finally {
      await db.delete(licenses).where(eq(licenses.id, testLicId));
    }
  });

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
      const res = await fetch("http://localhost:3001/api/v1/ai/chat", {
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
        `http://localhost:3001/api/v1/ai/quota-status?licenseKey=${quotaKey}&modelAlias=fast-summary-model`
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
      const chatRes = await fetch("http://localhost:3001/api/v1/ai/chat", {
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

    // Pastikan vault credential untuk app ini menggunakan mock key
    // agar chat handler masuk ke sandbox mock path (bukan upstream real)
    const mockKey = "mock-sse-test-key-sandbox";
    const encrypted = CryptoService.encrypt(mockKey);
    const [insertedVault] = await db
      .insert(aiVaultCredentials)
      .values({
        appId: app.id,
        provider: "openai",
        encryptedApiKey: encrypted.cipherText,
        iv: encrypted.iv,
        authTag: encrypted.authTag,
      })
      .returning({ id: aiVaultCredentials.id });
    const vaultId = insertedVault.id;

    // Hapus vault credential real yang mungkin sudah ada untuk app ini
    // agar hanya mock vault yang dipakai
    const existingVaults = await db.query.aiVaultCredentials.findMany({
      where: eq(aiVaultCredentials.appId, app.id),
    });
    const realVaultIds = existingVaults.filter((v) => v.id !== vaultId).map((v) => v.id);

    try {
      // Temporarily delete real vault credentials so mock vault is used
      if (realVaultIds.length > 0) {
        await db.delete(aiVaultCredentials).where(inArray(aiVaultCredentials.id, realVaultIds));
      }

      // 1. Eksekusi streaming chat ke /api/v1/ai/chat (atau alias /api/v1/ai-proxy/chat)
      const res = await fetch("http://localhost:3001/api/v1/ai-proxy/chat", {
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
      // Restore real vault credentials
      if (realVaultIds.length > 0) {
        for (const rv of existingVaults.filter((v) => v.id !== vaultId)) {
          await db.insert(aiVaultCredentials).values(rv).onConflictDoNothing();
        }
      }
      await db.delete(aiVaultCredentials).where(eq(aiVaultCredentials.id, vaultId));
      await db.delete(aiUsageLogs).where(eq(aiUsageLogs.licenseId, testLicSseId));
      await db.delete(licenses).where(eq(licenses.id, testLicSseId));
    }
  });

  it("should allow public access to /api/v1/ai/chat and /quota-status without Better Auth session cookie", async () => {
    // Request raw tanpa cookie Better Auth
    const chatReq = new Request("http://localhost:3001/api/v1/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ licenseKey: "TT-NONEXISTENT", prompt: "halo" }),
    });
    const chatRes = await app.handle(chatReq);
    // Tidak boleh 401 Unauthorized dari apiV1Routes onBeforeHandle, melainkan dievaluasi oleh handler AI (403 INVALID_LICENSE)
    expect(chatRes.status).toBe(403);
    const chatData: any = await chatRes.json();
    expect(chatData.error).toBe("INVALID_LICENSE");

    const quotaReq = new Request(
      "http://localhost:3001/api/v1/ai/quota-status?licenseKey=TT-NONEXISTENT",
      {
        method: "GET",
      }
    );
    const quotaRes = await app.handle(quotaReq);
    expect(quotaRes.status).toBe(403);
    const quotaData: any = await quotaRes.json();
    expect(quotaData.error).toBe("INVALID_LICENSE");
  });
});
