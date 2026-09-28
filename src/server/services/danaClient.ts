import { config, cleanPemKey } from "../config";
import Dana from "dana-node";
import { PaymentGatewayApi } from "dana-node/payment_gateway/v1";
import { DisbursementApi } from "dana-node/disbursement/v1";

// ─── Shared Types ─────────────────────────────────────────────────────────────

export type DanaPaymentRail = "qris" | "va" | "ewallet" | "balance";
export type DanaVaBank = "BCA" | "MANDIRI" | "BNI" | "BRI" | "CIMB" | "PERMATA" | "BSI";

export interface CreateDanaOrderParams {
  externalId: string;
  amount: number;
  payerEmail: string;
  description: string;
  returnUrl?: string;
  finishRedirectUrl?: string;
  scenario?: "API" | "REDIRECT";
  paymentRail?: DanaPaymentRail;
  vaBank?: DanaVaBank | string;
}

export interface DanaOrderResponse {
  orderId: string;
  externalId: string;
  status: string;
  merchantName: string;
  amount: number;
  payerEmail: string;
  description: string;
  checkoutUrl: string;
  expiryDate: string;
  scenario?: "API" | "REDIRECT";
  paymentRail?: DanaPaymentRail;
  paymentCode?: string;
  qrDataUrl?: string;
  vaBank?: string;
  bankName?: string;
}

// ─── SDK Instance Factory ────────────────────────────────────────────────────

export interface DanaRuntimeConfig {
  partnerId: string;
  privateKey: string;
  origin: string;
  env: "production" | "sandbox";
  clientSecret?: string;
}

/**
 * Workaround bug `dana-node@2.2.2` (runtime.js ~161-165):
 *
 * ```js
 * try { errorResponse = await response.json(); }
 * catch (e) { errorResponse = await response.text(); }   // body sudah terkonsumsi
 * ```
 *
 * Untuk respons non-2xx yang body-nya bukan JSON valid, `json()` sudah
 * menghabiskan stream sebelum melempar, sehingga `text()` gagal dengan
 * `TypeError: Body already used`. Akibatnya error asli dari DANA (mis.
 * `404 Invalid Merchant`) hilang dan yang muncul hanya "Body already used" —
 * smoke test pun jadi tidak bisa dipakai untuk diagnosa.
 *
 * `dana-node@2.2.2` adalah versi terbaru di npm, jadi perbaikan harus di sisi
 * kita: pada respons error, buffer body sekali lalu sajikan `json()`/`text()`
 * yang bisa dipanggil berulang. Respons sukses tidak diubah (dibaca satu kali).
 */
function patchDanaErrorBody(api: any): void {
  // `Configuration` hanya mengekspos getter (basePath/fetchApi/middleware/…)
  // yang meneruskan ke `this.configuration` — objek biasa di dalamnya. Yang
  // perlu dimutasi adalah `.configuration.configuration`.
  const configuration = api?.configuration?.configuration;
  if (!configuration || configuration.__tertautBodyPatched) return;
  configuration.__tertautBodyPatched = true;

  const inner = configuration.fetchApi || fetch;
  configuration.fetchApi = async (url: any, init: any) => {
    const res = await inner(url, init);
    if (res.status >= 200 && res.status < 300) return res;

    let buffer: ArrayBuffer;
    try {
      buffer = await res.arrayBuffer();
    } catch {
      return res; // body tidak terbaca (mis. stream error) — biarkan apa adanya
    }
    const rebuild = () =>
      new Response(buffer, {
        status: res.status,
        statusText: res.statusText,
        headers: res.headers,
      });

    return new Proxy(res, {
      get(target, prop) {
        if (prop === "json") return () => rebuild().json();
        if (prop === "text") return () => rebuild().text();
        if (prop === "arrayBuffer") return () => rebuild().arrayBuffer();
        const value = Reflect.get(target, prop, target);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
  };
}

export function getDanaInstance(overrides?: Partial<DanaRuntimeConfig>): Dana {
  const instance = new Dana({
    partnerId: overrides?.partnerId || config.dana.clientId || "MOCK_PARTNER_ID",
    privateKey: cleanPemKey(overrides?.privateKey || config.dana.privateKey || "MOCK_PRIVATE_KEY"),
    origin: overrides?.origin || config.dana.origin,
    env: overrides?.env || config.dana.env,
    clientSecret:
      overrides?.clientSecret !== undefined ? overrides.clientSecret : config.dana.clientSecret,
  });

  patchDanaErrorBody(instance.paymentGatewayApi);
  patchDanaErrorBody(instance.disbursementApi);
  patchDanaErrorBody(instance.widgetApi);
  patchDanaErrorBody(instance.merchantManagementApi);

  return instance;
}

export function getDanaPaymentGateway(overrides?: Partial<DanaRuntimeConfig>): PaymentGatewayApi {
  return getDanaInstance(overrides).paymentGatewayApi;
}

export function getDanaDisbursementApi(): DisbursementApi {
  return getDanaInstance().disbursementApi;
}

// ─── Timeout Wrapper ─────────────────────────────────────────────────────────

/** Batas waktu panggilan HTTP ke gateway DANA (mencegah request menggantung saat DANA lambat/down). */
export const DANA_HTTP_TIMEOUT_MS = 15_000;

/**
 * Bungkus promise panggilan SDK dana-node dengan timeout. Request yang sudah
 * berjalan tidak dibatalkan, namun handler tetap selesai dalam batas waktu —
 * origin tidak pernah menggantung menunggu gateway yang tidak merespons.
 */
export async function withDanaTimeout<T>(label: string, promise: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () =>
        reject(
          new Error(
            `DANA ${label} timeout setelah ${DANA_HTTP_TIMEOUT_MS}ms — gateway tidak merespons. Silakan coba lagi.`
          )
        ),
      DANA_HTTP_TIMEOUT_MS
    );
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}
