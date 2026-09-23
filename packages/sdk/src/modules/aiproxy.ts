/**
 * Modul AI API Proxy Shield Gateway (Streaming & Non-Streaming).
 */

import type { AiChatOptions, AiStreamChunk } from "../types";

export interface AiProxyExecutor {
  request: (path: string, init?: RequestInit) => Promise<Response>;
  appId: string;
}

export class AiProxyModule {
  constructor(private ctx: AiProxyExecutor) {}

  public async chat(options: AiChatOptions): Promise<any> {
    const token = options.licenseToken || options.licenseKey;
    const res = await this.ctx.request("/api/v1/ai/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        appId: this.ctx.appId,
        licenseKey: options.licenseKey,
        prompt: options.prompt,
        messages: options.messages,
        modelAlias: options.modelAlias || "fast-summary-model",
        provider: options.provider,
        model: options.model,
        temperature: options.temperature,
        stream: false,
      }),
    });
    return res.json();
  }

  public async chatStream(options: AiChatOptions): Promise<AsyncIterable<AiStreamChunk>> {
    const token = options.licenseToken || options.licenseKey;
    const res = await this.ctx.request("/api/v1/ai/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        appId: this.ctx.appId,
        licenseKey: options.licenseKey,
        prompt: options.prompt,
        messages: options.messages,
        modelAlias: options.modelAlias || "fast-summary-model",
        provider: options.provider,
        model: options.model,
        temperature: options.temperature,
        stream: true,
      }),
    });

    if (!res.ok) {
      const errJson = (await res.json().catch(() => ({}))) as any;
      throw new Error(errJson.message || `AI Proxy request failed with status ${res.status}`);
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
    const params = new URLSearchParams({ licenseKey: options.licenseKey });
    if (options.modelAlias) params.set("modelAlias", options.modelAlias);
    const res = await this.ctx.request(`/api/v1/ai/quota-status?${params.toString()}`);
    return res.json();
  }
}
