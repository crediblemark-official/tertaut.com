import type { PaymentGatewayAdapter } from "./types";
import { GATEWAY_IDS, GATEWAY_REGISTRY, normalizeGatewayId, DEFAULT_GATEWAY_ID } from "./registry";
import { xenditGateway } from "./xenditGateway";
import { sandboxGateway } from "./sandboxGateway";
import { getActivePaymentGateway as getActivePgSetting } from "../paymentGateway";

export * from "./types";
export * from "./registry";
export { xenditGateway } from "./xenditGateway";
export { sandboxGateway } from "./sandboxGateway";

/**
 * Pemetaan id → adapter.
 *
 * Daftar ini adalah katalog adapter dan WAJIB sinkron dengan `GATEWAY_IDS` di
 * `./registry`. Kata kunci `satisfies` di bawah membuat TypeScript gagal
 * kompilasi bila ada id yang tidak punya adapter atau sebaliknya — jadi tidak
 * ada gateway yang bisa "terdaftar tapi tidak bisa dipakai".
 */
const ADAPTERS = {
  xendit: xenditGateway,
  sandbox: sandboxGateway,
} satisfies Record<(typeof GATEWAY_IDS)[number], PaymentGatewayAdapter>;

export type { PaymentGatewayAdapter };

/**
 * Mendapatkan payment gateway adapter berdasarkan nama/provider.
 * Provider lama/tidak dikenal ditolak agar transaksi historis tidak dialihkan.
 * Nilai kosong memakai Xendit sebagai default untuk pemanggil baru.
 */
export function getPaymentGateway(provider?: string | null): PaymentGatewayAdapter {
  const id = normalizeGatewayId(provider);
  if (!id) {
    if (provider) throw new Error("Provider pembayaran tidak lagi didukung");
    return ADAPTERS[DEFAULT_GATEWAY_ID];
  }
  return ADAPTERS[id];
}

/**
 * Adapter gateway yang sedang aktif di level platform (dari database settings).
 */
export async function getActiveGateway(): Promise<PaymentGatewayAdapter> {
  return getPaymentGateway(await getActivePgSetting());
}

/** Descriptor registry untuk seluruh gateway — handy untuk panel & dokumentasi. */
export { GATEWAY_REGISTRY, GATEWAY_IDS };
