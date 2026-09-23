/**
 * @tertaut/sdk
 * Comprehensive Multi-Platform Developer SDK (< 15KB)
 * Multi-Platform: Browser, Chrome Extension, Desktop (Tauri/Electron), Node.js, Bun, React Native
 * Zero Heavy Third-Party Dependencies
 */

import { executeCheckout } from "./modules/checkout";
import { LicensingModule } from "./modules/licensing";
import { CreditsModule } from "./modules/credits";
import { AiProxyModule } from "./modules/aiproxy";
import { S2SModule } from "./modules/s2s";
import { verifyWebhookSignature } from "./utils/crypto";

import type { TertautConfig, CheckoutOptions } from "./types";

export * from "./types";
export * from "./errors";

export class Tertaut {
  public apiKey: string;
  public appId: string;
  public baseUrl: string;
  public environment: "production" | "sandbox";
  public timeoutMs: number;

  public licensing: LicensingModule;
  public credits: CreditsModule;
  public aiProxy: AiProxyModule;
  public s2s: S2SModule;

  constructor(config: TertautConfig) {
    if (!config.apiKey || !/^tt_(live|test|secret)_/.test(config.apiKey)) {
      throw new Error(
        "[Tertaut SDK] apiKey wajib diisi dengan format tt_live_... / tt_test_... (publishable API key) atau tt_secret_... (server secret key)."
      );
    }
    const isSecretKey = config.apiKey.startsWith("tt_secret_");
    if (!isSecretKey && !config.appId) {
      throw new Error("[Tertaut SDK] appId is required.");
    }
    if (!config.baseUrl || !/^https?:\/\/\S+$/.test(config.baseUrl)) {
      throw new Error(
        "[Tertaut SDK] baseUrl wajib diisi, mis. https://tertaut.com atau URL sandbox/staging."
      );
    }

    this.apiKey = config.apiKey;
    this.appId = config.appId || "";
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
    this.environment = config.apiKey.startsWith("tt_live_") ? "production" : "sandbox";
    this.timeoutMs = config.timeoutMs || 15_000;

    const requestExecutor = {
      request: this.request.bind(this),
      appId: this.appId,
      baseUrl: this.baseUrl,
      apiKey: this.apiKey,
    };

    this.licensing = new LicensingModule(requestExecutor);
    this.credits = new CreditsModule(requestExecutor);
    this.aiProxy = new AiProxyModule(requestExecutor);
    this.s2s = new S2SModule(requestExecutor);
  }

  /**
   * Verifikasi signature HMAC-SHA256 webhook secara universal (Web Crypto API).
   * Bekerja di Node.js, Bun, Deno, dan browser tanpa dependensi pihak ketiga.
   */
  public static async verifyWebhookSignature(
    rawBody: string,
    signatureHeader: string,
    secret: string
  ): Promise<boolean> {
    return verifyWebhookSignature(rawBody, signatureHeader, secret);
  }

  /**
   * Helper internal untuk HTTP request dengan batas timeout.
   */
  private async request(path: string, init?: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        signal: controller.signal,
      });
      return res;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Modul Checkout: MoR Engine Dynamic Checkout Session & Redirect.
   */
  public async checkout(
    options: CheckoutOptions
  ): Promise<{ checkoutUrl: string; transactionId: string }> {
    return executeCheckout(
      {
        request: this.request.bind(this),
        appId: this.appId,
      },
      options
    );
  }
}

export default Tertaut;
