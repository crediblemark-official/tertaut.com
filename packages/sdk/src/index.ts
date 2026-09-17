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

export interface OfflineTokenVerifyResult {
  valid: boolean;
  reason?: string;
  claims?: {
    typ?: string;
    lic?: string;
    app?: string;
    hw?: string | null;
    eml?: string | null;
    seats?: number;
    jti?: string;
    iat?: number;
    exp?: number;
  };
}

export interface CreditBalanceOptions {
  licenseKey: string;
  hwid?: string;
}

export interface CreditBalanceResult {
  success: boolean;
  balance: number;
  licenseKey?: string;
  reason?: string;
  message?: string;
}

export interface CreditConsumeOptions {
  licenseKey: string;
  hwid: string;
  amount: number;
  reason?: string;
  reference?: string;
}

export interface CreditConsumeResult {
  success: boolean;
  balance: number;
  consumed?: number;
  reason?: string;
  message?: string;
}

export interface CreditHistoryOptions {
  licenseKey: string;
  hwid?: string;
  limit?: number;
}

export interface CreditHistoryEntry {
  id: string;
  type: "GRANT" | "DEBIT" | "REFUND" | "ADJUSTMENT";
  delta: number;
  balanceAfter: number;
  reference: string | null;
  description: string | null;
  createdAt: string;
}

export interface CreditHistoryResult {
  success: boolean;
  balance: number;
  entries: CreditHistoryEntry[];
  reason?: string;
  message?: string;
}

/** Decode base64url menjadi Uint8Array tanpa dependensi eksternal. */
function base64urlToBytes(input: string): Uint8Array {
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  if (typeof atob === "function") {
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }
  // @ts-ignore Node/Bun fallback
  return new Uint8Array(Buffer.from(padded, "base64"));
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
    if (!options.customerEmail) {
      throw new Error("[Tertaut SDK] customerEmail is required for checkout.");
    }

    const res = await fetch(`${this.baseUrl}/api/v1/checkout/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        appId: this.appId,
        amount: options.amount,
        grantDays: options.grantDays ?? 30,
        grantCredits: options.grantCredits ?? 0,
        customerEmail: options.customerEmail,
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

    /** Ambil public key Ed25519 (JWKS) untuk verifikasi offline. */
    getJwks: async () => {
      const res = await fetch(`${this.baseUrl}/.well-known/jwks.json`);
      return res.json();
    },

    /**
     * Verifikasi offline license token secara lokal (Ed25519) tanpa memanggil server.
     * Menggunakan Web Crypto API sehingga tetap zero-dependency di browser/Node/Bun.
     * Catatan: verifikasi lokal tidak mengetahui status revoke terbaru — lakukan
     * re-validasi online (`validate`) secara berkala.
     */
    verifyOfflineToken: async (
      token: string,
      options?: { publicKeyJwk?: JsonWebKey; jwksUrl?: string }
    ): Promise<OfflineTokenVerifyResult> => {
      try {
        const [header, body, signature] = token.split(".");
        if (!header || !body || !signature) {
          return { valid: false, reason: "MALFORMED_TOKEN" };
        }

        let jwk = options?.publicKeyJwk;
        if (!jwk) {
          const jwksUrl = options?.jwksUrl || `${this.baseUrl}/.well-known/jwks.json`;
          const res = await fetch(jwksUrl);
          const jwks = (await res.json()) as { keys?: JsonWebKey[] };
          jwk = jwks.keys?.[0];
        }
        if (!jwk) return { valid: false, reason: "PUBLIC_KEY_UNAVAILABLE" };

        const key = await crypto.subtle.importKey(
          "jwk",
          jwk,
          { name: "Ed25519" } as any,
          false,
          ["verify"]
        );
        const signatureBytes = base64urlToBytes(signature);
        const data = new TextEncoder().encode(`${header}.${body}`);
        const ok = await crypto.subtle.verify(
          "Ed25519" as any,
          key,
          signatureBytes as unknown as BufferSource,
          data as unknown as BufferSource
        );
        if (!ok) return { valid: false, reason: "INVALID_SIGNATURE" };

        const claims = JSON.parse(
          new TextDecoder().decode(base64urlToBytes(body))
        ) as OfflineTokenVerifyResult["claims"];

        if (claims?.typ !== "license") return { valid: false, reason: "INVALID_TOKEN_TYPE" };
        if (claims.exp && claims.exp < Math.floor(Date.now() / 1000)) {
          return { valid: false, reason: "TOKEN_EXPIRED" };
        }

        return { valid: true, claims };
      } catch (err: any) {
        return { valid: false, reason: err?.message || "INVALID_TOKEN" };
      }
    },
  };

  /**
   * Modul Kredit: saldo, pemakaian atomik, dan riwayat ledger lisensi.
   */
  public credits = {
    balance: async (options: CreditBalanceOptions): Promise<CreditBalanceResult> => {
      const res = await fetch(`${this.baseUrl}/api/v1/licensing/credits/balance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          licenseKey: options.licenseKey,
          hwid: options.hwid,
        }),
      });
      return res.json();
    },

    consume: async (options: CreditConsumeOptions): Promise<CreditConsumeResult> => {
      const res = await fetch(`${this.baseUrl}/api/v1/licensing/credits/consume`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          licenseKey: options.licenseKey,
          hwid: options.hwid,
          amount: options.amount,
          reason: options.reason,
          reference: options.reference,
        }),
      });
      return res.json();
    },

    history: async (options: CreditHistoryOptions): Promise<CreditHistoryResult> => {
      const res = await fetch(`${this.baseUrl}/api/v1/licensing/credits/history`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          licenseKey: options.licenseKey,
          hwid: options.hwid,
          limit: options.limit,
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
