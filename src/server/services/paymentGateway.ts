import { db } from "../db";
import { platformSettings } from "../db/schema/settings";
import { eq } from "drizzle-orm";
import { config } from "../config";

export type PaymentGatewayType = "dana" | "xendit";

/**
 * Mengambil payment gateway aktif yang dipilih oleh Super Admin dari panel tertaut.com/panel.
 * Default: "dana", dapat diubah ke "xendit".
 */
export async function getActivePaymentGateway(): Promise<PaymentGatewayType> {
  try {
    const row = await db.query.platformSettings.findFirst({
      where: eq(platformSettings.key, "active_payment_gateway"),
    });

    const val = row?.value?.toLowerCase()?.trim();
    if (val === "xendit" || val === "dana") {
      return val;
    }
  } catch {
    // Abaikan jika DB belum siap
  }

  // Fallback ke config env jika disetel
  const envPg = (process.env.ACTIVE_PAYMENT_GATEWAY || "").toLowerCase().trim();
  if (envPg === "xendit") return "xendit";

  return "dana";
}
