/**
 * @tertaut/sdk
 * AI-First Lightweight Developer SDK (< 15KB)
 * Multi-Platform: Browser, Chrome Extension, Desktop (Tauri/Electron), Node.js, Bun, React Native
 * Zero Heavy Third-Party Dependencies (FR-3.1 & FR-3.2)
 */

export interface TertautConfig {
  appId: string;
  baseUrl?: string;
  environment?: "production" | "sandbox";
}

export interface CheckoutOptions {
  amount: number;
  grantDays?: number;
  grantCredits?: number;
  customerEmail?: string;
  redirectUrl?: string;
}

export interface LicenseValidateOptions {
  licenseKey: string;
  hardwareId?: string;
  platform?: "web" | "desktop" | "chrome_extension" | "android" | "general";
}

export interface LicenseVerifyOptions {
  licenseKey: string;
  hwid?: string;
}

export interface LicenseActivateOptions {
  licenseKey: string;
  hwid: string;
  deviceName?: string;
}

export interface LicenseDeactivateOptions {
  licenseKey: string;
  hwid: string;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AiChatOptions {
  licenseKey?: string;
  licenseToken?: string;
  prompt?: string;
  messages?: ChatMessage[];
  modelAlias?: string;
  provider?: "openai" | "anthropic" | "gemini" | "deepseek" | "custom";
  model?: string;
  temperature?: number;
}

export interface AiStreamChunk {
  text: string;
}

export class Tertaut {
  public appId: string;
  public baseUrl: string;
  public environment: "production" | "sandbox";

  constructor(config: TertautConfig) {
    if (!config.appId) {
      throw new Error("[Tertaut SDK] appId is required.");
    }
    this.appId = config.appId;
    this.environment = config.environment || "production";
    this.baseUrl = (config.baseUrl || (this.environment === "sandbox" ? "http://localhost:3000" : "https://tertaut.com")).replace(/\/$/, "");
  }

  /**
   * Modul 1: Direct Live Checkout (MoR Engine via Xendit) (FR-3.2)
   */
  public async checkout(options: CheckoutOptions): Promise<{ checkoutUrl: string; transactionId: string }> {
    const res = await fetch(`${this.baseUrl}/api/v1/checkout/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        appId: this.appId,
        amount: options.amount,
        grantDays: options.grantDays ?? 30,
        grantCredits: options.grantCredits ?? 0,
        customerEmail: options.customerEmail || "customer@example.com",
        redirectUrl: options.redirectUrl,
      }),
    });

    if (!res.ok) {
      throw new Error(`Checkout session failed: ${res.statusText}`);
    }

    const data = (await res.json()) as { checkoutUrl: string; transactionId: string };
    if (typeof window !== "undefined" && data.checkoutUrl) {
      window.location.href = data.checkoutUrl;
    }
    return data;
  }

  /**
   * Modul 2: Universal Licensing Engine (FR-3.2)
   */
  public licensing = {
    validate: async (options: LicenseValidateOptions) => {
      const res = await fetch(`${this.baseUrl}/api/v1/licensing/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          licenseKey: options.licenseKey,
          hwid: options.hardwareId,
        }),
      });
      return res.json();
    },

    verify: async (options: LicenseVerifyOptions) => {
      const res = await fetch(`${this.baseUrl}/api/v1/licensing/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          licenseKey: options.licenseKey,
          hwid: options.hwid,
        }),
      });
      return res.json();
    },

    activate: async (options: LicenseActivateOptions) => {
      const res = await fetch(`${this.baseUrl}/api/v1/licensing/activate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appId: this.appId,
          licenseKey: options.licenseKey,
          hwid: options.hwid,
          deviceName: options.deviceName || "UserDevice",
        }),
      });
      return res.json();
    },

    deactivate: async (options: LicenseDeactivateOptions) => {
      const res = await fetch(`${this.baseUrl}/api/v1/licensing/deactivate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          licenseKey: options.licenseKey,
          hwid: options.hwid,
        }),
      });
      return res.json();
    },
  };

  /**
   * Modul 3: AI API Proxy Gateway (Streaming & Non-Streaming) (FR-3.2)
   */
  public aiProxy = {
    chat: async (options: AiChatOptions) => {
      const token = options.licenseToken || options.licenseKey;
      const res = await fetch(`${this.baseUrl}/api/v1/ai/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          appId: this.appId,
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
    },

    chatStream: async (options: AiChatOptions): Promise<AsyncIterable<AiStreamChunk>> => {
      const token = options.licenseToken || options.licenseKey;
      const res = await fetch(`${this.baseUrl}/api/v1/ai/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          appId: this.appId,
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
                  // Ignore parse error on raw event lines
                }
              }
            }
          }
        },
      };
    },
  };
}
