import { Elysia, t } from "elysia";
import { db } from "../db";
import {
  aiVaultCredentials,
  aiProxyLogs,
  aiProviderKeys,
  aiAppConfigs,
  aiUsageLogs,
  licenses,
  apps,
} from "../db/schema";
import { eq, and } from "drizzle-orm";
import { CryptoService } from "../services/crypto";
import { AiGatewayService } from "../services/aiGateway";
import { config } from "../config";

/**
 * Key mock/sandbox (sk-test/... atau mock/...) hanya boleh dipakai saat isSandbox.
 * Di production key semacam ini tidak boleh menghasilkan respons simulasi.
 */
function isMockApiKey(key: string | null | undefined): boolean {
  return Boolean(key && (key.startsWith("sk-test") || key.startsWith("mock")));
}

/**
 * Panggil upstream AI non-streaming untuk semua provider yang didukung.
 * Mengembalikan teks completion mentah dari provider.
 */
async function callUpstreamNonStreaming(
  provider: string,
  model: string,
  apiKey: string,
  promptText: string
): Promise<string> {
  if (provider === "gemini") {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: promptText }] }] }),
      }
    );
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Gemini upstream error ${res.status}: ${errText.slice(0, 300)}`);
    }
    const data = (await res.json()) as any;
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  }

  if (provider === "openai") {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: promptText }],
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`OpenAI upstream error ${res.status}: ${errText.slice(0, 300)}`);
    }
    const data = (await res.json()) as any;
    return data.choices?.[0]?.message?.content || "";
  }

  if (provider === "anthropic") {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: model || "claude-3-5-haiku-latest",
        max_tokens: 2048,
        messages: [{ role: "user", content: promptText }],
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Anthropic upstream error ${res.status}: ${errText.slice(0, 300)}`);
    }
    const data = (await res.json()) as any;
    return (data.content || []).map((b: any) => b?.text || "").join("");
  }

  if (provider === "deepseek") {
    // DeepSeek kompatibel dengan OpenAI Chat Completions API
    const res = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model || "deepseek-chat",
        messages: [{ role: "user", content: promptText }],
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`DeepSeek upstream error ${res.status}: ${errText.slice(0, 300)}`);
    }
    const data = (await res.json()) as any;
    return data.choices?.[0]?.message?.content || "";
  }

  throw new Error(
    `Provider "${provider}" tidak didukung. Gunakan: gemini, openai, anthropic, atau deepseek.`
  );
}

/**
 * Panggil upstream AI streaming (SSE) untuk semua provider yang didukung.
 * Mengembalikan array potongan teks hasil parse event stream provider.
 */
async function callUpstreamStreamingChunks(
  provider: string,
  model: string,
  apiKey: string,
  promptText: string
): Promise<string[]> {
  if (provider === "gemini") {
    // Gemini streaming via alt=sse
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: promptText }] }] }),
      }
    );
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Gemini upstream error ${res.status}: ${errText.slice(0, 300)}`);
    }
    return parseSseDataLines(res, (json) => json?.candidates?.[0]?.content?.parts?.[0]?.text);
  }

  if (provider === "openai") {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: promptText }],
        stream: true,
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`OpenAI upstream error ${res.status}: ${errText.slice(0, 300)}`);
    }
    return parseSseDataLines(res, (json) => json?.choices?.[0]?.delta?.content);
  }

  if (provider === "anthropic") {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: model || "claude-3-5-haiku-latest",
        max_tokens: 2048,
        messages: [{ role: "user", content: promptText }],
        stream: true,
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Anthropic upstream error ${res.status}: ${errText.slice(0, 300)}`);
    }
    return parseSseDataLines(res, (json) =>
      json?.type === "content_block_delta" ? json?.delta?.text : undefined
    );
  }

  if (provider === "deepseek") {
    const res = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model || "deepseek-chat",
        messages: [{ role: "user", content: promptText }],
        stream: true,
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`DeepSeek upstream error ${res.status}: ${errText.slice(0, 300)}`);
    }
    return parseSseDataLines(res, (json) => json?.choices?.[0]?.delta?.content);
  }

  throw new Error(
    `Provider "${provider}" tidak didukung. Gunakan: gemini, openai, anthropic, atau deepseek.`
  );
}

/**
 * Parse respons SSE upstream: kumpulkan potongan teks dari setiap event
 * `data: {...}` memakai extractor yang dispesifikan per provider.
 */
async function parseSseDataLines(
  res: Response,
  extract: (json: any) => string | undefined
): Promise<string[]> {
  const chunks: string[] = [];
  if (!res.body) return chunks;

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const text = extract(JSON.parse(payload));
        if (text) chunks.push(text);
      } catch {
        // Event non-JSON diabaikan
      }
    }
  }

  return chunks;
}

/**
 * Core Chat Handler for both Streaming (SSE) and Non-Streaming calls
 * Standar PRD Modul 4: FR-1, FR-2, FR-3, FR-4
 */
async function handleAiChat({
  headers,
  body,
  set,
}: {
  headers: Record<string, string | undefined>;
  body: any;
  set: any;
}) {
  const startTime = Date.now();
  const authHeader = headers["authorization"] || headers["Authorization"];

  // 1. Verifikasi Lisensi JWT / Entitlement (FR-2.1 & FR-2.2)
  const validation = await AiGatewayService.validateLicense(
    authHeader,
    body.licenseToken || body.licenseKey
  );

  if (!validation.valid || !validation.license) {
    set.status = validation.statusCode || 403;
    return {
      success: false,
      error: validation.error || "INVALID_LICENSE",
      message: validation.message || "Akses AI ditolak.",
    };
  }

  const license = validation.license;
  const appId = body.appId || license.appId;

  // 2. Strict Request Rate Limiter (FR-3.2)
  // Nilai maxRequestsPerMin diambil dari config app di DB (kolom max_requests_per_min);
  // fallback 15 req/menit untuk config default. Nilai 0/negatif diartikan unlimited.
  let maxRequestsPerMin = 15;
  if (body.appId) {
    const reqLimitConfig = await db.query.aiAppConfigs.findFirst({
      where: and(
        eq(aiAppConfigs.appId, body.appId),
        eq(aiAppConfigs.modelAlias, body.modelAlias || "default")
      ),
    });
    if (reqLimitConfig?.maxRequestsPerMin && reqLimitConfig.maxRequestsPerMin > 0) {
      maxRequestsPerMin = reqLimitConfig.maxRequestsPerMin;
    }
  }
  const rateLimit = AiGatewayService.checkRateLimit(
    license.id || license.licenseKey,
    maxRequestsPerMin
  );
  if (!rateLimit.allowed) {
    set.status = 429;
    return {
      success: false,
      error: "RATE_LIMIT_EXCEEDED",
      message: "Terlalu banyak permintaan AI. Batas rate limit 15 req/menit tercapai.",
      retryAfter: rateLimit.retryAfter,
    };
  }

  // 3. Resolve Model Alias & App Guardrails
  const modelAlias = body.modelAlias || "default";
  const appConfig = await db.query.aiAppConfigs.findFirst({
    where: and(
      eq(aiAppConfigs.appId, appId),
      eq(aiAppConfigs.modelAlias, modelAlias)
    ),
  });

  const dailyTokenLimit = appConfig?.dailyTokenLimit ?? 100_000;
  if (dailyTokenLimit > 0) {
    const dailyTokensUsed = await AiGatewayService.getDailyTokensUsed(license.id, appId);
    if (dailyTokensUsed >= dailyTokenLimit) {
      set.status = 429;
      return {
        success: false,
        error: "DAILY_TOKEN_LIMIT_EXCEEDED",
        message: `Batas kuota token harian (${dailyTokenLimit.toLocaleString("id-ID")} tokens) telah tercapai. Kuota akan direset pada tengah malam.`,
      };
    }
  }

  // 4. Resolve Vault API Key & Decrypt via AES-256-GCM (FR-1.1 & FR-1.2)
  let rawApiKey: string | null = null;
  let resolvedProvider = body.provider || "gemini";
  let targetModel = body.model || appConfig?.targetModelName || "gemini-1.5-flash";

  // Coba ambil dari aiProviderKeys jika config memiliki providerKeyId
  if (appConfig?.providerKeyId) {
    const pKey = await db.query.aiProviderKeys.findFirst({
      where: and(
        eq(aiProviderKeys.id, appConfig.providerKeyId),
        eq(aiProviderKeys.isActive, true)
      ),
    });
    if (pKey) {
      resolvedProvider = pKey.providerName.toLowerCase();
      try {
        rawApiKey = CryptoService.decrypt(
          pKey.encryptedApiKey,
          pKey.ivVector,
          pKey.authTag || ""
        );
      } catch {
        set.status = 500;
        return { success: false, error: "FAILED_DECRYPTING_VAULT_KEY" };
      }
    }
  }

  // Fallback ke aiVaultCredentials (kompatibilitas penuh)
  let vaultCred = await db.query.aiVaultCredentials.findFirst({
    where: and(
      eq(aiVaultCredentials.appId, appId),
      eq(aiVaultCredentials.provider, resolvedProvider as any)
    ),
  });

  if (!vaultCred && !rawApiKey) {
    // Cari kredensial vault pertama yang tersedia untuk app ini
    vaultCred = await db.query.aiVaultCredentials.findFirst({
      where: eq(aiVaultCredentials.appId, appId),
    });
  }

  if (vaultCred) {
    if (vaultCred.isKillSwitchActive) {
      set.status = 429;
      return {
        success: false,
        error: "AI_KILL_SWITCH_ACTIVE",
        message: "Akses AI sedang dibatasi sementara oleh pemilik aplikasi.",
      };
    }

    if ((vaultCred.currentMonthlyUsage ?? 0) >= (vaultCred.monthlyBudgetLimit ?? 500000)) {
      set.status = 429;
      return {
        success: false,
        error: "BUDGET_LIMIT_EXCEEDED",
        message: "Batas anggaran pemakaian AI bulanan telah tercapai.",
      };
    }

    if (!rawApiKey) {
      try {
        rawApiKey = CryptoService.decrypt(
          vaultCred.encryptedApiKey,
          vaultCred.iv,
          vaultCred.authTag
        );
        resolvedProvider = vaultCred.provider;
      } catch {
        set.status = 500;
        return { success: false, error: "FAILED_DECRYPTING_VAULT_KEY" };
      }
    }
  }

  // 5. Ekstrak pesan prompt
  let promptText = body.prompt || "";
  if (!promptText && Array.isArray(body.messages) && body.messages.length > 0) {
    promptText = body.messages.map((m: any) => `${m.role}: ${m.content}`).join("\n");
  }

  if (!promptText) {
    set.status = 400;
    return { success: false, error: "EMPTY_PROMPT", message: "Prompt atau messages wajib diisi." };
  }

  const promptTokens = Math.max(1, Math.ceil(promptText.length / 4));
  const isStream = Boolean(body.stream);
  const chatId = `chatcmpl_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  // 6. Streaming SSE Response Relay (FR-4.1)
  if (isStream) {
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        let fullCompletion = "";

        try {
          // Lakukan pemanggilan upstream atau simulasi streaming chunks
          let chunks: string[] = [];

          if (rawApiKey && !isMockApiKey(rawApiKey)) {
            // Pemanggilan streaming nyata ke upstream AI (SSE relay asli)
            chunks = await callUpstreamStreamingChunks(resolvedProvider, targetModel, rawApiKey, promptText);
          } else if (config.isSandbox) {
            // Sandbox/Mock Mode: tanpa real key, simulasikan streaming chunks
            chunks = [
              "Halo!",
              " Permintaan",
              " Anda",
              " diproses",
              " melalui",
              " Tertaut",
              " AI",
              " Proxy",
              " Shield.",
              " Kredensial",
              " Anda",
              " aman",
              " terenkripsi",
              " AES-256-GCM.",
            ];
          } else {
            set.status = 503;
            controller.error(
              new Error("AI Proxy tidak dapat memproses: API key tidak valid / mode sandbox nonaktif.")
            );
            return;
          }

          // Relay Server-Sent Events Chunks ke client
          for (const chunk of chunks) {
            fullCompletion += chunk;
            const sseChunk = AiGatewayService.formatSseChunk(chatId, chunk);
            controller.enqueue(encoder.encode(sseChunk));
          }

          // FR-4.2: Zero text retention - catat statistik token sebelum menutup stream
          const completionTokens = Math.max(1, Math.ceil(fullCompletion.length / 4));
          const latencyMs = Date.now() - startTime;
          await AiGatewayService.recordUsage({
            licenseId: license.id,
            appId,
            modelAlias,
            promptTokens,
            completionTokens,
            responseTimeMs: latencyMs,
            provider: resolvedProvider,
            model: targetModel,
          });

          // Akhiri stream dengan [DONE]
          controller.enqueue(encoder.encode(AiGatewayService.formatSseDone()));
          controller.close();
        } catch (streamErr: any) {
          set.status = 502;
          controller.error(
            new Error(streamErr?.message || "Upstream AI provider gagal diproses.")
          );
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  }

  // 7. Non-Streaming Response
  let responseText = "";
  if (rawApiKey && !isMockApiKey(rawApiKey)) {
    // Pemanggilan nyata ke upstream (Gemini, OpenAI, Anthropic, DeepSeek).
    // Kegagalan upstream TIDAK lagi disembunyikan di balik teks fallback palsu —
    // client harus tahu request-nya gagal agar bisa retry.
    try {
      responseText = await callUpstreamNonStreaming(resolvedProvider, targetModel, rawApiKey, promptText);
    } catch (upstreamErr: any) {
      set.status = 502;
      return {
        success: false,
        error: "UPSTREAM_AI_ERROR",
        message: upstreamErr?.message || "Provider AI gagal merespons.",
        provider: resolvedProvider,
        model: targetModel,
      };
    }
  } else if (config.isSandbox) {
    responseText = "Respon terverifikasi dari Tertaut AI Proxy Shield. Kredensial terlindungi oleh enkripsi AES-256-GCM.";
  } else {
    set.status = 503;
    return {
      success: false,
      error: "AI_PROXY_UNAVAILABLE",
      message: "API key tidak valid atau mode sandbox nonaktif.",
    };
  }

  const completionTokens = Math.max(1, Math.ceil(responseText.length / 4));
  const latencyMs = Date.now() - startTime;
  const totalTokens = promptTokens + completionTokens;

  // Catat pemakaian token (Zero Text Retention)
  await AiGatewayService.recordUsage({
    licenseId: license.id,
    appId,
    modelAlias,
    promptTokens,
    completionTokens,
    responseTimeMs: latencyMs,
    provider: resolvedProvider,
    model: targetModel,
  });

  return {
    success: true,
    text: responseText,
    model: targetModel,
    provider: resolvedProvider,
    usage: {
      promptTokens,
      completionTokens,
      totalTokens,
    },
    latencyMs,
  };
}

/**
 * Route Handler untuk AI Proxy Shield & Quota Guardrails
 * Dipasang pada `/ai-proxy` dan `/ai`
 */
export function createAiRoutes(prefix: string) {
  return new Elysia({ prefix })
    /**
     * Panggilan AI Chat (Streaming SSE atau Non-Streaming)
     * POST /api/v1/ai/chat dan POST /api/v1/ai-proxy/chat
     */
    .post("/chat", handleAiChat, {
      detail: {
        tags: ["AI API Proxy Shield"],
        summary: "Execute AI Chat Stream / Non-Stream via Proxy Shield",
        description: "Enforces license JWT verification, cost guardrails, AES-256-GCM vault injection, and SSE streaming relay.",
      },
    })

    /**
     * Cek Status Kuota Penggunaan Token Harian
     * GET /api/v1/ai/quota-status dan GET /api/v1/ai-proxy/quota-status
     */
    .get(
      "/quota-status",
      async ({ headers, query, set }) => {
        const authHeader = headers["authorization"] || headers["Authorization"];
        const licenseKey = (query as any)?.licenseKey;

        const validation = await AiGatewayService.validateLicense(authHeader, licenseKey);
        if (!validation.valid || !validation.license) {
          set.status = validation.statusCode || 403;
          return {
            success: false,
            error: validation.error || "INVALID_LICENSE",
            message: validation.message || "Akses AI ditolak.",
          };
        }

        const modelAlias = (query as any)?.modelAlias || "default";
        const quota = await AiGatewayService.getQuotaStatus(validation.license, modelAlias);

        return {
          success: true,
          data: quota,
        };
      },
      {
        detail: {
          tags: ["AI API Proxy Shield"],
          summary: "Fetch Usage Quota Status",
          description: "Returns daily tokens used, limit, remaining tokens, and reset countdown.",
        },
      }
    )

    /**
     * Konfigurasi Model & Guardrails Aplikasi (App Configs)
     */
    .get("/configs/:appId", async ({ params: { appId } }) => {
      const configs = await db.query.aiAppConfigs.findMany({
        where: eq(aiAppConfigs.appId, appId),
      });
      return { success: true, configs };
    })
    .post("/configs", async ({ body, set }) => {
      const {
        appId,
        modelAlias,
        targetModelName,
        maxRequestsPerMin = 15,
        dailyTokenLimit = 100000,
        monthlyBudgetIdr = 500000,
        providerKeyId,
      } = body as any;

      const app = await db.query.apps.findFirst({ where: eq(apps.id, appId) });
      if (!app) {
        set.status = 404;
        return { success: false, error: "App not found" };
      }

      const existing = await db.query.aiAppConfigs.findFirst({
        where: and(
          eq(aiAppConfigs.appId, appId),
          eq(aiAppConfigs.modelAlias, modelAlias)
        ),
      });

      if (existing) {
        await db
          .update(aiAppConfigs)
          .set({
            targetModelName,
            maxRequestsPerMin,
            dailyTokenLimit,
            monthlyBudgetIdr,
            providerKeyId: providerKeyId || null,
          })
          .where(eq(aiAppConfigs.id, existing.id));
      } else {
        await db.insert(aiAppConfigs).values({
          id: `cfg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          appId,
          modelAlias,
          targetModelName,
          maxRequestsPerMin,
          dailyTokenLimit,
          monthlyBudgetIdr,
          providerKeyId: providerKeyId || null,
        });
      }

      return { success: true, message: `Model config '${modelAlias}' berhasil disimpan.` };
    })

    /**
     * Simpan / Perbarui Kredensial AI Vault (AES-256-GCM)
     */
    .post("/vault", async ({ body, set }) => {
      return saveVaultCredential(body, set);
    })
    .post("/vault/save", async ({ body, set }) => {
      return saveVaultCredential(body, set);
    })

    /**
     * Cek status Vault Kredensial AI untuk suatu App
     */
    .get("/vault/:appId", async ({ params: { appId } }) => {
      const creds = await db.query.aiVaultCredentials.findMany({
        where: eq(aiVaultCredentials.appId, appId),
      });

      const sanitized = creds.map((c) => ({
        id: c.id,
        appId: c.appId,
        provider: c.provider,
        monthlyBudgetLimit: c.monthlyBudgetLimit,
        currentMonthlyUsage: c.currentMonthlyUsage,
        isKillSwitchActive: c.isKillSwitchActive,
        updatedAt: c.updatedAt,
      }));

      return {
        success: true,
        credentials: sanitized,
      };
    })

    /**
     * Toggle Kill-Switch
     */
    .post("/vault/toggle-kill-switch", async ({ body, set }) => {
      const { appId, provider } = body as any;

      const cred = await db.query.aiVaultCredentials.findFirst({
        where: and(
          eq(aiVaultCredentials.appId, appId),
          eq(aiVaultCredentials.provider, provider)
        ),
      });

      if (!cred) {
        set.status = 404;
        return { error: "Vault credentials not found for this provider" };
      }

      const nextStatus = !cred.isKillSwitchActive;
      const [updated] = await db
        .update(aiVaultCredentials)
        .set({
          isKillSwitchActive: nextStatus,
          updatedAt: new Date(),
        })
        .where(eq(aiVaultCredentials.id, cred.id))
        .returning();

      return {
        success: true,
        isKillSwitchActive: updated.isKillSwitchActive,
        message: updated.isKillSwitchActive
          ? `Kill switch AKTIF. Seluruh panggilan AI ke ${provider} diblokir sementara.`
          : `Kill switch NON-AKTIF. Panggilan AI ke ${provider} kembali normal.`,
      };
    })

    /**
     * Riwayat panggilan AI Proxy (Audit Log)
     */
    .get("/logs/:appId", async ({ params: { appId }, query }) => {
      const { limit = 50 } = query as any;
      const logs = await db.query.aiProxyLogs.findMany({
        where: eq(aiProxyLogs.appId, appId),
        orderBy: (log, { desc }) => [desc(log.createdAt)],
        limit: Number(limit),
      });

      return {
        success: true,
        logs,
      };
    });
}

/**
 * Helper untuk menyimpan kredensial ke Vault dengan AES-256-GCM
 */
async function saveVaultCredential(body: any, set: any) {
  const { appId, provider, rawApiKey, monthlyBudgetLimit = 500000 } = body;

  const app = await db.query.apps.findFirst({
    where: eq(apps.id, appId),
  });

  if (!app) {
    set.status = 404;
    return { error: "App not found" };
  }

  // Enkripsi API Key dengan AES-256-GCM
  const { cipherText, iv, authTag } = CryptoService.encrypt(rawApiKey);

  const existing = await db.query.aiVaultCredentials.findFirst({
    where: and(
      eq(aiVaultCredentials.appId, appId),
      eq(aiVaultCredentials.provider, provider)
    ),
  });

  if (existing) {
    await db
      .update(aiVaultCredentials)
      .set({
        encryptedApiKey: cipherText,
        iv,
        authTag,
        monthlyBudgetLimit,
        updatedAt: new Date(),
      })
      .where(eq(aiVaultCredentials.id, existing.id));
  } else {
    await db.insert(aiVaultCredentials).values({
      appId,
      provider,
      encryptedApiKey: cipherText,
      iv,
      authTag,
      monthlyBudgetLimit,
    });
  }

  return {
    success: true,
    message: `API Key untuk ${provider} berhasil diamankan di Vault (AES-256-GCM).`,
  };
}

// Ekspor instance router untuk `/ai-proxy` dan `/ai`
export const aiProxyRoutes = createAiRoutes("/ai-proxy");
export const aiRoutes = createAiRoutes("/ai");
