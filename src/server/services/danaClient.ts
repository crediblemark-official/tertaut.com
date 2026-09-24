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
  forceMock?: boolean;
  /**
   * true = caller mengizinkan order mock (aplikasi mode sandbox).
   * Default = config.isSandbox (deployment sandbox) untuk menjaga perilaku
   * pemanggil lama; session selalu mengirim `app.mode === "sandbox"` secara
   * eksplisit. Aplikasi Live di produksi TIDAK PERNAH menghasilkan mock
   * (guard forceMock + fallback nonaktif); di deployment non-produksi app Live
   * hanya boleh mendapat invoice DEMO (mock:true, dicatat mockOrder=false oleh
   * session sehingga tidak pernah mem-fulfill lisensi).
   */
  allowMock?: boolean;
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
  /** true jika order dibuat sebagai mock (sandbox/forceMock). */
  mock: boolean;
}

// ─── SDK Instance Factory ────────────────────────────────────────────────────

export interface DanaRuntimeConfig {
  partnerId: string;
  privateKey: string;
  origin: string;
  env: "production" | "sandbox";
  clientSecret?: string;
}

export function getDanaInstance(overrides?: Partial<DanaRuntimeConfig>): Dana {
  return new Dana({
    partnerId: overrides?.partnerId || config.dana.clientId || "MOCK_PARTNER_ID",
    privateKey: cleanPemKey(overrides?.privateKey || config.dana.privateKey || "MOCK_PRIVATE_KEY"),
    origin: overrides?.origin || config.dana.origin,
    env: overrides?.env || config.dana.env,
    clientSecret:
      overrides?.clientSecret !== undefined ? overrides.clientSecret : config.dana.clientSecret,
  });
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
