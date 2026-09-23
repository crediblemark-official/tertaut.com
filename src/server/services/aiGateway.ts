import { db } from "../db";
import {
  aiAppConfigs,
  aiProviderKeys,
  aiUsageLogs,
  aiVaultCredentials,
  aiProxyLogs,
  licenses,
  apps,
  type License,
} from "../db/schema";
import { eq, and, gte, sql } from "drizzle-orm";
import { CryptoService } from "./crypto";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AiChatRequest {
  modelAlias?: string;
  messages?: ChatMessage[];
  prompt?: string;
  provider?: "openai" | "anthropic" | "gemini" | "deepseek" | "custom";
  model?: string;
  temperature?: number;
  stream?: boolean;
}

export interface LicenseValidationResult {
  valid: boolean;
  statusCode?: number;
  error?: string;
  message?: string;
  license?: License;
  appId?: string;
}

export class AiGatewayService {
  // In-memory sliding window rate limiter: Key -> array of timestamps
  private static rateLimitMap = new Map<string, number[]>();

  /**
   * Validasi lisensi JWT atau licenseKey mentah dari Modul 3
   * Menegakkan FR-2.1 (Entitlement) & FR-2.2 (Kill-Switch Active Status Check)
   */
  static async validateLicense(
    authHeaderOrToken?: string,
    bodyLicenseKey?: string
  ): Promise<LicenseValidationResult> {
    let rawToken = "";

    if (authHeaderOrToken) {
      if (authHeaderOrToken.startsWith("Bearer ")) {
        rawToken = authHeaderOrToken.slice(7).trim();
      } else {
        rawToken = authHeaderOrToken.trim();
      }
    }

    if (!rawToken && bodyLicenseKey) {
      rawToken = bodyLicenseKey.trim();
    }

    if (!rawToken) {
      return {
        valid: false,
        statusCode: 401,
        error: "UNAUTHORIZED",
        message: "Authorization token atau licenseKey wajib disertakan.",
      };
    }

    // 1. Cek apakah ini JWT token terverifikasi (Modul 3 offline/online token)
    let keyToLookup = rawToken;
    const verifiedJwt = CryptoService.verifySignedToken<any>(rawToken);
    if (verifiedJwt) {
      keyToLookup = verifiedJwt.lic || verifiedJwt.sub || rawToken;
      if (verifiedJwt.status === "REVOKED" || verifiedJwt.status === "EXPIRED") {
        return {
          valid: false,
          statusCode: 403,
          error: "LICENSE_REVOKED_OR_EXPIRED",
          message: "Akses AI ditolak: Lisensi dalam status dicabut atau kedaluwarsa.",
        };
      }
    }

    // 2. Lookup status terkini di database
    const lic = await db.query.licenses.findFirst({
      where: eq(licenses.licenseKey, keyToLookup),
    });

    if (!lic) {
      return {
        valid: false,
        statusCode: 403,
        error: "INVALID_LICENSE",
        message: "Kunci lisensi tidak ditemukan di sistem.",
      };
    }

    if (lic.status === "REVOKED" || lic.status === "EXPIRED") {
      return {
        valid: false,
        statusCode: 403,
        error: "LICENSE_REVOKED_OR_EXPIRED",
        message: "Akses AI ditolak: Lisensi telah dicabut (REVOKED) atau kedaluwarsa (EXPIRED).",
      };
    }

    // Cek tanggal kadaluarsa jika ada
    if (lic.expiresAt && new Date(lic.expiresAt).getTime() < Date.now()) {
      return {
        valid: false,
        statusCode: 403,
        error: "LICENSE_EXPIRED",
        message: "Masa berlaku lisensi telah habis.",
      };
    }

    return {
      valid: true,
      license: lic,
      appId: lic.appId,
    };
  }

  /**
   * Cek Rate Limit (FR-3.2: Strict Request Rate Limit per minute)
   */
  static checkRateLimit(
    identifier: string,
    maxRequestsPerMin = 15
  ): { allowed: boolean; retryAfter?: number } {
    const now = Date.now();
    const windowStart = now - 60_000;

    // Memory leak protection: prune stale keys when map grows
    if (this.rateLimitMap.size > 200) {
      for (const [key, timestamps] of this.rateLimitMap.entries()) {
        if (!timestamps.some((t) => t > windowStart)) {
          this.rateLimitMap.delete(key);
        }
      }
    }

    const timestamps = this.rateLimitMap.get(identifier) || [];

    // Filter out timestamps outside window
    const validTimestamps = timestamps.filter((t) => t > windowStart);

    if (validTimestamps.length >= maxRequestsPerMin) {
      const oldestInWindow = validTimestamps[0];
      const retryAfter = Math.ceil((oldestInWindow + 60_000 - now) / 1000);
      return { allowed: false, retryAfter };
    }

    validTimestamps.push(now);
    this.rateLimitMap.set(identifier, validTimestamps);
    return { allowed: true };
  }

  /**
   * Hitung pemakaian token hari ini (FR-3.1 & FR-3.2: Daily Token Cap)
   */
  static async getDailyTokensUsed(licenseId?: string, appId?: string): Promise<number> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    let totalUsed = 0;

    // 1. Cek dari ai_usage_logs
    if (licenseId) {
      const usageResults = await db
        .select({
          sumTokens: sql<number>`COALESCE(SUM(${aiUsageLogs.totalTokens}), 0)::int`,
        })
        .from(aiUsageLogs)
        .where(and(eq(aiUsageLogs.licenseId, licenseId), gte(aiUsageLogs.createdAt, startOfDay)));
      totalUsed += usageResults[0]?.sumTokens || 0;
    }

    // 2. Cek juga dari legacy ai_proxy_logs jika ada
    if (appId) {
      const legacyResults = await db
        .select({
          sumTokens: sql<number>`COALESCE(SUM(${aiProxyLogs.totalTokens}), 0)::int`,
        })
        .from(aiProxyLogs)
        .where(and(eq(aiProxyLogs.appId, appId), gte(aiProxyLogs.createdAt, startOfDay)));
      totalUsed += legacyResults[0]?.sumTokens || 0;
    }

    return totalUsed;
  }

  /**
   * Tambah pemakaian bulanan pada kredensial vault (FR-3.3: Monthly Budget Guardrail).
   * Tanpa increment ini, cek BUDGET_LIMIT_EXCEEDED tidak pernah terpicu oleh
   * pemakaian nyata. Dipanggil setiap kali request AI sukses diproses.
   */
  static async incrementVaultMonthlyUsage(
    appId: string,
    provider: string,
    totalTokens: number
  ): Promise<void> {
    if (totalTokens <= 0) return;

    await db
      .update(aiVaultCredentials)
      .set({
        currentMonthlyUsage: sql`COALESCE(${aiVaultCredentials.currentMonthlyUsage}, 0) + ${totalTokens}`,
        updatedAt: new Date(),
      })
      .where(
        and(eq(aiVaultCredentials.appId, appId), eq(aiVaultCredentials.provider, provider as any))
      );
  }

  /**
   * Ambil status kuota (FR-3.2 & API 7.1.B: Quota Status)
   */
  static async getQuotaStatus(license: License, modelAlias = "default") {
    // Ambil app config untuk mendapatkan daily_token_limit
    const appConfig = await db.query.aiAppConfigs.findFirst({
      where: and(eq(aiAppConfigs.appId, license.appId), eq(aiAppConfigs.modelAlias, modelAlias)),
    });

    const dailyLimit = appConfig?.dailyTokenLimit ?? 100_000;
    const dailyTokensUsed = await this.getDailyTokensUsed(license.id, license.appId);
    const remainingTokens = Math.max(0, dailyLimit - dailyTokensUsed);

    // Hitung sisa detik hingga tengah malam (UTC reset)
    const now = new Date();
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);
    const resetInSeconds = Math.max(0, Math.floor((endOfDay.getTime() - now.getTime()) / 1000));

    return {
      dailyTokensUsed,
      dailyTokenLimit: dailyLimit,
      remainingTokens,
      resetInSeconds,
    };
  }

  /**
   * Catat pemakaian token ke database (Zero Text Retention)
   * NFR FR-4.2: Teks prompt dan jawaban AI TIDAK DISIMPAN
   */
  static async recordUsage(params: {
    licenseId?: string;
    appId: string;
    modelAlias: string;
    promptTokens: number;
    completionTokens: number;
    responseTimeMs: number;
    provider?: string;
    model?: string;
  }) {
    const totalTokens = params.promptTokens + params.completionTokens;

    // 1. Simpan ke ai_usage_logs (PRD Modul 4)
    await db.insert(aiUsageLogs).values({
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      licenseId: params.licenseId,
      appId: params.appId,
      modelAlias: params.modelAlias,
      promptTokens: params.promptTokens,
      completionTokens: params.completionTokens,
      totalTokens,
      responseTimeMs: params.responseTimeMs,
    });

    // 2. Simpan juga ke legacy ai_proxy_logs agar dashboard audit lama tetap update
    await db.insert(aiProxyLogs).values({
      appId: params.appId,
      licenseKey: params.licenseId,
      provider: params.provider || "openai",
      model: params.model || params.modelAlias,
      promptTokens: params.promptTokens,
      completionTokens: params.completionTokens,
      totalTokens,
      latencyMs: params.responseTimeMs,
    });

    // 3. Tambah pemakaian bulanan vault agar budget guardrail (FR-3.3)
    // BUDGET_LIMIT_EXCEEDED benar-benar terpicu oleh pemakaian nyata.
    if (params.provider) {
      await this.incrementVaultMonthlyUsage(params.appId, params.provider, totalTokens);
    }
  }

  /**
   * Format Server-Sent Events (SSE) stream chunk
   * Standar OpenAI SSE relay format
   */
  static formatSseChunk(id: string, textChunk: string): string {
    const payload = {
      id,
      object: "chat.completion.chunk",
      created: Math.floor(Date.now() / 1000),
      choices: [
        {
          index: 0,
          delta: { content: textChunk },
          finish_reason: null,
        },
      ],
    };
    return `data: ${JSON.stringify(payload)}\n\n`;
  }

  static formatSseDone(): string {
    return "data: [DONE]\n\n";
  }
}
