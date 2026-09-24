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

  // Fallback ke config env jika disetel.
  // BUG C1: dokumen/compose/CI historically memakai PAYMENT_GATEWAY, padahal kode
  // hanya membaca ACTIVE_PAYMENT_GATEWAY → pemilihan gateway diam-diam tidak berlaku.
  // Terima keduanya (ACTIVE_PAYMENT_GATEWAY menang) agar konfigurasi apa pun berlaku.
  const envPg = (process.env.ACTIVE_PAYMENT_GATEWAY || process.env.PAYMENT_GATEWAY || "")
    .toLowerCase()
    .trim();
  if (envPg === "xendit") return "xendit";

  return "dana";
}

/**
 * Mengambil status mode sandbox gateway dari platformSettings (Super Admin Panel).
 * Jika sandbox_mode === "false", maka gateway berada dalam mode Production.
 * Default: true (Sandbox aktif).
 */
export async function isGatewaySandboxActive(): Promise<boolean> {
  try {
    const row = await db.query.platformSettings.findFirst({
      where: eq(platformSettings.key, "sandbox_mode"),
    });
    if (row?.value === "false") {
      return false;
    }
  } catch {
    // Fallback ke default
  }
  return true;
}
