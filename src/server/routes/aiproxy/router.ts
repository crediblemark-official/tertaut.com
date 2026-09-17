import { Elysia } from "elysia";
import { authenticate } from "../../middleware/auth";
import { handleAiChat } from "./chat";
import { handleGetQuotaStatus } from "./quota";
import { handleGetAppConfigs, handleSaveAppConfig } from "./config";
import {
  saveVaultCredential,
  handleGetVaultCredentials,
  handleToggleKillSwitch,
} from "./vault";
import { handleGetAiLogs } from "./logs";

/**
 * Route Handler untuk AI Proxy Shield & Quota Guardrails
 * Dipasang pada `/ai-proxy` dan `/ai`
 */
export function createAiRoutes(prefix: string) {
  return new Elysia({ prefix })
    // Manajemen vault/config/logs hanya untuk dashboard builder yang login.
    .onBeforeHandle(async ({ request: { headers }, status, path }) => {
      // Pengecekan presisi ketat (hanya /chat atau /quota-status) demi mencegah bypass auth pada endpoint internal
      const isPublicAiEndpoint =
        path === `/api/v1${prefix}/chat` ||
        path === `/api/v1${prefix}/quota-status` ||
        path === `${prefix}/chat` ||
        path === `${prefix}/quota-status`;
      if (isPublicAiEndpoint) return;
      const res = await authenticate(headers);
      if ("status" in res) return status(res.status, { error: res.error });
    })

    /**
     * Panggilan AI Chat (Streaming SSE atau Non-Streaming)
     * POST /api/v1/ai/chat dan POST /api/v1/ai-proxy/chat
     */
    .post("/chat", handleAiChat, {
      detail: {
        tags: ["AI API Proxy Shield"],
        summary: "Execute AI Chat Stream / Non-Stream via Proxy Shield",
        description:
          "Enforces license JWT verification, cost guardrails, AES-256-GCM vault injection, and SSE streaming relay.",
      },
    })

    /**
     * Cek Status Kuota Penggunaan Token Harian
     * GET /api/v1/ai/quota-status dan GET /api/v1/ai-proxy/quota-status
     */
    .get("/quota-status", handleGetQuotaStatus, {
      detail: {
        tags: ["AI API Proxy Shield"],
        summary: "Fetch Usage Quota Status",
        description:
          "Returns daily tokens used, limit, remaining tokens, and reset countdown.",
      },
    })

    /**
     * Konfigurasi Model & Guardrails Aplikasi (App Configs)
     */
    .get("/configs/:appId", handleGetAppConfigs)
    .post("/configs", handleSaveAppConfig)

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
    .get("/vault/:appId", handleGetVaultCredentials)

    /**
     * Toggle Kill-Switch
     */
    .post("/vault/toggle-kill-switch", handleToggleKillSwitch)

    /**
     * Riwayat panggilan AI Proxy (Audit Log)
     */
    .get("/logs/:appId", handleGetAiLogs);
}

// Ekspor instance router untuk `/ai-proxy` dan `/ai`
export const aiProxyRoutes = createAiRoutes("/ai-proxy");
export const aiRoutes = createAiRoutes("/ai");
