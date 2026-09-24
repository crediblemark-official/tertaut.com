import type { PaymentGatewayAdapter } from "./types";
import { danaGateway } from "./danaGateway";
import { xenditGateway } from "./xenditGateway";
import { getActivePaymentGateway as getActivePgSetting } from "../paymentGateway";

export * from "./types";
export { danaGateway } from "./danaGateway";
export { xenditGateway } from "./xenditGateway";

/**
 * Mendapatkan payment gateway adapter berdasarkan nama/provider
 * @param provider "dana" | "xendit"
 */
export function getPaymentGateway(provider?: string | null): PaymentGatewayAdapter {
  const normalized = (provider || "dana").toLowerCase().trim();
  if (normalized === "xendit") {
    return xenditGateway;
  }
  return danaGateway;
}

/**
 * Mendapatkan payment gateway adapter yang sedang aktif di level platform (dari database settings)
 */
export async function getActiveGateway(): Promise<PaymentGatewayAdapter> {
  const activePgName = await getActivePgSetting();
  return getPaymentGateway(activePgName);
}
