/**
 * Modul AI API Proxy Shield Gateway (Streaming & Non-Streaming).
 */

import { createTertautError } from "../errors";
import type { TertautExecutor, AiChatOptions, AiStreamChunk } from "../types";

export interface AiProxyExecutor extends TertautExecutor {}

/**
 * Alias model default harus sama persis dengan fallback server ("default").
 * Nilai lain membuat lookup `ai_app_configs` meleset sehingga guardrail
 * builder (rate limit per menit & kuota token harian) diam-diam diabaikan.
 */
const DEFAULT_MODEL_ALIAS = "default";

function buildChatBody(ctx: AiProxyExecutor, options: AiChatOptions, stream: boolean) {
  return {
    appId: ctx.appId || undefined,
    licenseKey: options.licenseKey,
    prompt: options.prompt,
    messages: options.messages,
    modelAlias: options.modelAlias || DEFAULT_MODEL_ALIAS,
    provider: options.provider,
    model: options.model,
    temperature: options.temperature,
    stream,
  };
}

export class AiProxyModule {
  constructor(private ctx: AiProxyExecutor) {}

  public async chat(options: AiChatOptions): Promise<any> {
    const token = options.licenseToken || options.licenseKey;
    return this.ctx.requestJson("/api/v1/ai/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(buildChatBody(this.ctx, options, false)),
    });
  }

  /**
   * Streaming SSE. Memakai `request` mentah, bukan `requestJson`, karena
   * body harus dibaca bertahap dari reader.
   */
  public async chatStream(options: AiChatOptions): Promise<AsyncIterable<AiStreamChunk>> {
    const token = options.licenseToken || options.licenseKey;
    const res = await this.ctx.request("/api/v1/ai/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(buildChatBody(this.ctx, options, true)),
    });

    if (!res.ok) {
      let payload: any;
      try {
        payload = await res.json();
      } catch {
        payload = undefined;
      }
      throw createTertautError(res.status, payload, {
        path: "/api/v1/ai/chat",
        statusText: res.statusText,
      });
    }

    if (!res.body) {
      throw new Error("No response body available for streaming.");
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();

    return {
      async *[Symbol.asyncIterator]() {
        let buffer = "";
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith("data: ")) {
              const data = trimmed.slice(6).trim();
              if (data === "[DONE]") return;
              try {
                const parsed = JSON.parse(data);
                const chunkText = parsed.choices?.[0]?.delta?.content;
                if (chunkText) {
                  yield { text: chunkText };
                }
              } catch {
                // Abaikan parsing error baris raw SSE
              }
            }
          }
        }
      },
    };
  }

  /**
   * Cek kuota dan status daily token limit untuk lisensi.
   */
  public async quotaStatus(options: { licenseKey: string; modelAlias?: string }): Promise<any> {
    const params = new URLSearchParams({
      licenseKey: options.licenseKey,
      modelAlias: options.modelAlias || DEFAULT_MODEL_ALIAS,
    });
    return this.ctx.requestJson(`/api/v1/ai/quota-status?${params.toString()}`);
  }
}
