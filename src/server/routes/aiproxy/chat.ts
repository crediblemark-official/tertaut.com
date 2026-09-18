import { db } from "../../db";
import {
  aiVaultCredentials,
  aiProviderKeys,
  aiAppConfigs,
} from "../../db/schema";
import { eq, and } from "drizzle-orm";
import { CryptoService } from "../../services/crypto";
import { AiGatewayService } from "../../services/aiGateway";
import { config } from "../../config";
import {
  isMockApiKey,
  callUpstreamNonStreaming,
  callUpstreamStreamingChunks,
} from "./upstream";

/**
 * Core Chat Handler for both Streaming (SSE) and Non-Streaming calls
 * Standar PRD Modul 4: FR-1, FR-2, FR-3, FR-4
 */
export async function handleAiChat({
  headers,
  body,
  set,
}: {
  headers?: Record<string, string | undefined>;
  body: any;
  set: any;
}) {
  const startTime = Date.now();
  const safeHeaders = headers || {};
  const authHeader = safeHeaders["authorization"] || safeHeaders["Authorization"];

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

  // Entitlement terikat pada app pemilik lisensi — body.appId tidak boleh dipercaya
  // mentah, jika tidak lisensi app A bisa membajak vault/kredensial app B (cross-app leak).
  if (body.appId && body.appId !== license.appId) {
    set.status = 403;
    return {
      success: false,
      error: "APP_MISMATCH",
      message: "Lisensi ini tidak berlaku untuk aplikasi yang diminta.",
    };
  }
  const appId = license.appId;

  // 2. Strict Request Rate Limiter (FR-3.2)
  // Nilai maxRequestsPerMin diambil dari config app di DB (kolom max_requests_per_min);
  // fallback 15 req/menit untuk config default. Nilai 0/negatif diartikan unlimited.
  let maxRequestsPerMin = 15;
  const reqLimitConfig = await db.query.aiAppConfigs.findFirst({
    where: and(
      eq(aiAppConfigs.appId, appId),
      eq(aiAppConfigs.modelAlias, body.modelAlias || "default")
    ),
  });
  if (reqLimitConfig?.maxRequestsPerMin && reqLimitConfig.maxRequestsPerMin > 0) {
    maxRequestsPerMin = reqLimitConfig.maxRequestsPerMin;
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
