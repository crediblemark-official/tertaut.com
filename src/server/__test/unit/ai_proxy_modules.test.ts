import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { isMockApiKey, callUpstreamNonStreaming, callUpstreamStreamingChunks, parseSseDataLines } from "../../routes/aiproxy/upstream";
import { handleGetAppConfigs, handleSaveAppConfig } from "../../routes/aiproxy/config";
import { saveVaultCredential, handleGetVaultCredentials, handleToggleKillSwitch } from "../../routes/aiproxy/vault";
import { handleGetAiLogs } from "../../routes/aiproxy/logs";
import { db } from "../../db";
import { apps, builders, aiAppConfigs, aiVaultCredentials, aiProxyLogs } from "../../db/schema";
import { eq } from "drizzle-orm";

describe("AI Proxy Upstream Caller & Utilities", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("should correctly classify mock API keys", () => {
    expect(isMockApiKey("sk-test-1234")).toBe(true);
    expect(isMockApiKey("mock-key")).toBe(true);
    expect(isMockApiKey("real-key-gemini")).toBe(false);
    expect(isMockApiKey("")).toBe(false);
    expect(isMockApiKey(null)).toBe(false);
    expect(isMockApiKey(undefined)).toBe(false);
  });

  it("should execute callUpstreamNonStreaming across all supported providers", async () => {
    // 1. Gemini
    globalThis.fetch = (async (url: string) => {
      if (url.includes("generativelanguage.googleapis.com")) {
        return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "Gemini response" }] } }] }), { status: 200 });
      }
      return new Response("Not found", { status: 404 });
    }) as any;
    const geminiRes = await callUpstreamNonStreaming("gemini", "gemini-1.5-flash", "test-key", "Halo");
    expect(geminiRes).toBe("Gemini response");

    // 2. OpenAI
    globalThis.fetch = (async (url: string) => {
      if (url.includes("api.openai.com")) {
        return new Response(JSON.stringify({ choices: [{ message: { content: "OpenAI response" } }] }), { status: 200 });
      }
      return new Response("Not found", { status: 404 });
    }) as any;
    const openaiRes = await callUpstreamNonStreaming("openai", "gpt-4o-mini", "test-key", "Halo");
    expect(openaiRes).toBe("OpenAI response");

    // 3. Anthropic
    globalThis.fetch = (async (url: string) => {
      if (url.includes("api.anthropic.com")) {
        return new Response(JSON.stringify({ content: [{ text: "Claude response" }] }), { status: 200 });
      }
      return new Response("Not found", { status: 404 });
    }) as any;
    const anthropicRes = await callUpstreamNonStreaming("anthropic", "claude-3-5-haiku-latest", "test-key", "Halo");
    expect(anthropicRes).toBe("Claude response");

    // 4. DeepSeek
    globalThis.fetch = (async (url: string) => {
      if (url.includes("api.deepseek.com")) {
        return new Response(JSON.stringify({ choices: [{ message: { content: "DeepSeek response" } }] }), { status: 200 });
      }
      return new Response("Not found", { status: 404 });
    }) as any;
    const deepseekRes = await callUpstreamNonStreaming("deepseek", "deepseek-chat", "test-key", "Halo");
    expect(deepseekRes).toBe("DeepSeek response");
  });

  it("should throw formatted errors when upstream provider fails in non-streaming", async () => {
    globalThis.fetch = (async () => new Response("Rate limit exceeded", { status: 429 })) as any;
    expect(callUpstreamNonStreaming("gemini", "gemini-1.5-flash", "key", "hi")).rejects.toThrow("Gemini upstream error 429");
    expect(callUpstreamNonStreaming("openai", "gpt-4o", "key", "hi")).rejects.toThrow("OpenAI upstream error 429");
    expect(callUpstreamNonStreaming("anthropic", "claude-3", "key", "hi")).rejects.toThrow("Anthropic upstream error 429");
    expect(callUpstreamNonStreaming("deepseek", "deepseek-chat", "key", "hi")).rejects.toThrow("DeepSeek upstream error 429");
    expect(callUpstreamNonStreaming("unsupported" as any, "m", "k", "h")).rejects.toThrow("tidak didukung");
  });

  it("should stream and parse chunks across all providers in callUpstreamStreamingChunks", async () => {
    // 1. Gemini streaming
    const geminiStream = "data: " + JSON.stringify({ candidates: [{ content: { parts: [{ text: "Gemini chunk" }] } }] }) + "\n\n";
    globalThis.fetch = (async () => new Response(geminiStream, { status: 200 })) as any;
    const geminiChunks = await callUpstreamStreamingChunks("gemini", "gemini-1.5-flash", "key", "test");
    expect(geminiChunks).toEqual(["Gemini chunk"]);

    // 2. OpenAI streaming
    const openaiStream = "data: " + JSON.stringify({ choices: [{ delta: { content: "OpenAI chunk" } }] }) + "\n\ndata: [DONE]\n\n";
    globalThis.fetch = (async () => new Response(openaiStream, { status: 200 })) as any;
    const openaiChunks = await callUpstreamStreamingChunks("openai", "gpt-4o", "key", "test");
    expect(openaiChunks).toEqual(["OpenAI chunk"]);

    // 3. Anthropic streaming
    const anthropicStream = "data: " + JSON.stringify({ type: "content_block_delta", delta: { text: "Anthropic chunk" } }) + "\n\n";
    globalThis.fetch = (async () => new Response(anthropicStream, { status: 200 })) as any;
    const anthropicChunks = await callUpstreamStreamingChunks("anthropic", "claude-3", "key", "test");
    expect(anthropicChunks).toEqual(["Anthropic chunk"]);

    // 4. DeepSeek streaming
    const deepseekStream = "data: " + JSON.stringify({ choices: [{ delta: { content: "DeepSeek chunk" } }] }) + "\n\n";
    globalThis.fetch = (async () => new Response(deepseekStream, { status: 200 })) as any;
    const deepseekChunks = await callUpstreamStreamingChunks("deepseek", "deepseek-chat", "key", "test");
    expect(deepseekChunks).toEqual(["DeepSeek chunk"]);
  });

  it("should throw formatted errors when upstream provider fails in streaming", async () => {
    globalThis.fetch = (async () => new Response("Bad request", { status: 400 })) as any;
    expect(callUpstreamStreamingChunks("gemini", "gemini-1.5-flash", "key", "test")).rejects.toThrow("Gemini upstream error 400");
    expect(callUpstreamStreamingChunks("openai", "gpt-4o", "key", "test")).rejects.toThrow("OpenAI upstream error 400");
    expect(callUpstreamStreamingChunks("anthropic", "claude-3", "key", "test")).rejects.toThrow("Anthropic upstream error 400");
    expect(callUpstreamStreamingChunks("deepseek", "deepseek-chat", "key", "test")).rejects.toThrow("DeepSeek upstream error 400");
    expect(callUpstreamStreamingChunks("unknown" as any, "m", "k", "t")).rejects.toThrow("tidak didukung");
  });

  it("should gracefully handle non-JSON or empty lines in parseSseDataLines", async () => {
    const mixedStream = "data: invalid-json\n\ndata: \n\ndata: {\"text\":\"valid\"}\n\n";
    const res = new Response(mixedStream);
    const result = await parseSseDataLines(res, (json) => json.text);
    expect(result).toEqual(["valid"]);

    // Empty body
    const emptyRes = new Response(null);
    const emptyResult = await parseSseDataLines(emptyRes, () => "test");
    expect(emptyResult).toEqual([]);
  });
});

import { generateAppApiKey } from "../../routes/apps/api-key";

describe("AI App Config, Vault, and Logs Handlers", () => {
  let testAppId: string;

  beforeEach(async () => {
    const existing = await db.query.apps.findFirst();
    if (existing) {
      testAppId = existing.id;
    } else {
      const [b] = await db.insert(builders).values({
        name: "AI Builder",
        email: `ai_${Date.now()}@test.com`,
        apiKey: generateAppApiKey("live"),
      }).returning();
      const [a] = await db.insert(apps).values({
        id: `app_ai_${Date.now()}`,
        name: "AI App",
        slug: `ai-${Date.now()}`,
        builderId: b.id,
        targetPrice: 50000,
      }).returning();
      testAppId = a.id;
    }
  });

  it("should handle save and get AI app configs (create & update)", async () => {
    const set: any = {};
    // 1. Save config when app does not exist
    const notFoundRes = await handleSaveAppConfig({ body: { appId: "non_existent_app_999", modelAlias: "default" }, set });
    expect(set.status).toBe(404);
    expect(notFoundRes.success).toBe(false);

    // 2. Create new config
    const alias = `gpt_${Date.now()}`;
    const createRes = await handleSaveAppConfig({
      body: {
        appId: testAppId,
        modelAlias: alias,
        targetModelName: "gpt-4o-mini",
        maxRequestsPerMin: 20,
        dailyTokenLimit: 50000,
        monthlyBudgetIdr: 300000,
      },
      set: {},
    });
    expect(createRes.success).toBe(true);

    // 3. Update existing config
    const updateRes = await handleSaveAppConfig({
      body: {
        appId: testAppId,
        modelAlias: alias,
        targetModelName: "gpt-4o",
        maxRequestsPerMin: 30,
      },
      set: {},
    });
    expect(updateRes.success).toBe(true);

    // 4. Get configs
    const getRes = await handleGetAppConfigs({ params: { appId: testAppId } });
    expect(getRes.success).toBe(true);
    const found = getRes.configs.find((c: any) => c.modelAlias === alias);
    expect(found).toBeDefined();
    expect(found!.targetModelName).toBe("gpt-4o");
    expect(found!.maxRequestsPerMin).toBe(30);
  });

  it("should handle AI Vault credentials and Kill Switch toggling", async () => {
    const set: any = {};
    // 1. 404 when app does not exist
    const errRes = await saveVaultCredential({ appId: "invalid_app_999", provider: "openai", rawApiKey: "sk-123" }, set);
    expect(set.status).toBe(404);

    // 2. Save credential
    const saveRes = await saveVaultCredential(
      { appId: testAppId, provider: "anthropic", rawApiKey: "sk-ant-test-key-9999", monthlyBudgetLimit: 1000000 },
      {}
    );
    expect(saveRes.success).toBe(true);

    // 3. Update existing credential
    const updateCredRes = await saveVaultCredential(
      { appId: testAppId, provider: "anthropic", rawApiKey: "sk-ant-test-key-updated", monthlyBudgetLimit: 1200000 },
      {}
    );
    expect(updateCredRes.success).toBe(true);

    // 4. Get credentials (sanitized, no raw secrets)
    const listRes = await handleGetVaultCredentials({ params: { appId: testAppId } });
    expect(listRes.success).toBe(true);
    const found = listRes.credentials.find((c: any) => c.provider === "anthropic");
    expect(found).toBeDefined();
    expect(found!.monthlyBudgetLimit).toBe(1200000);
    expect((found as any).encryptedApiKey).toBeUndefined();

    // 5. Toggle kill-switch
    const toggleNotFound = await handleToggleKillSwitch({ body: { appId: testAppId, provider: "non_existent" }, set });
    expect(set.status).toBe(404);

    const toggleOn = await handleToggleKillSwitch({ body: { appId: testAppId, provider: "anthropic" }, set: {} });
    expect(toggleOn.success).toBe(true);
    expect(toggleOn.isKillSwitchActive).toBe(true);

    const toggleOff = await handleToggleKillSwitch({ body: { appId: testAppId, provider: "anthropic" }, set: {} });
    expect(toggleOff.success).toBe(true);
    expect(toggleOff.isKillSwitchActive).toBe(false);
  });

  it("should fetch AI audit logs via handleGetAiLogs", async () => {
    // Insert a dummy log
    await db.insert(aiProxyLogs).values({
      appId: testAppId,
      provider: "openai",
      model: "gpt-4o-mini",
      promptTokens: 50,
      completionTokens: 70,
      totalTokens: 120,
    });

    const res = await handleGetAiLogs({ params: { appId: testAppId }, query: { limit: 5 } });
    expect(res.success).toBe(true);
    expect(Array.isArray(res.logs)).toBe(true);
    expect(res.logs.length).toBeGreaterThanOrEqual(1);
  });
});
