/**
 * @tertaut/sdk
 * Comprehensive Multi-Platform Developer SDK (~16 KB minified, ~5 KB gzipped, zero dependency)
 * Multi-Platform: Browser, Chrome Extension, Desktop (Tauri/Electron), Node.js, Bun, React Native
 */

import { executeCheckout, getPaymentStatus } from "./modules/checkout";
import { LicensingModule } from "./modules/licensing";
import { CreditsModule } from "./modules/credits";
import { AiProxyModule } from "./modules/aiproxy";
import { S2SModule } from "./modules/s2s";
import { verifyWebhookSignature } from "./utils/crypto";
import { createTertautError } from "./errors";

import type {
  TertautConfig,
  TertautEnvironment,
  TertautExecutor,
  CheckoutOptions,
  CheckoutResult,
  CheckoutStatusResult,
} from "./types";

export * from "./types";
export * from "./errors";

export class Tertaut {
  public apiKey: string;
  public appId: string;
  public baseUrl: string;
  public environment: TertautEnvironment;
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
    this.environment = isSecretKey
      ? "server"
      : config.apiKey.startsWith("tt_live_")
        ? "production"
        : "sandbox";
    this.timeoutMs = config.timeoutMs || 15_000;

    this.licensing = new LicensingModule(this.executor());
    this.credits = new CreditsModule(this.executor());
    this.aiProxy = new AiProxyModule(this.executor());
    this.s2s = new S2SModule(this.executor());
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
   * Mengembalikan `Response` mentah — dipakai modul yang butuh akses stream (SSE).
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
   * HTTP request + parse JSON. Melempar subclass `TertautError` yang sesuai
   * bila server merespons status >= 400, sehingga consumer bisa melakukan
   * branching via `instanceof` alih-alih memeriksa bentuk payload manual.
   *
   * Respons 2xx tetap dikembalikan apa adanya, termasuk yang berisi
   * `valid:false` atau `success:false` — status tersebut adalah jawaban
   * bisnis yang sah, bukan kegagalan transport.
   */
  private async requestJson<T = any>(path: string, init?: RequestInit): Promise<T> {
    const res = await this.request(path, init);

    let payload: any;
    try {
      const text = await res.text();
      payload = text ? JSON.parse(text) : undefined;
    } catch {
      payload = undefined;
    }

    if (!res.ok) {
      throw createTertautError(res.status, payload, { path, statusText: res.statusText });
    }
    return payload as T;
  }

  /**
   * Paket kontekstual yang dibagi ke seluruh modul.
   * Dibuat ulang per modul karena setiap modul menambah header sendiri
   * (mis. `Authorization` untuk S2S, `x-api-key` untuk metering).
   */
  private executor(): TertautExecutor {
    return {
      request: this.request.bind(this),
      requestJson: this.requestJson.bind(this),
      appId: this.appId,
      baseUrl: this.baseUrl,
      apiKey: this.apiKey,
    };
  }

  /**
   * Modul Checkout: MoR Engine Dynamic Checkout Session & Redirect.
   */
  public async checkout(options: CheckoutOptions): Promise<CheckoutResult> {
    return executeCheckout(this.executor(), options);
  }

  /**
   * Cek status pembayaran transaksi MoR dengan atau tanpa ticket HMAC.
   */
  public async getPaymentStatus(
    transactionId: string,
    ticket?: string
  ): Promise<CheckoutStatusResult> {
    return getPaymentStatus(this.executor(), transactionId, ticket);
  }
}

export default Tertaut;
