import { db } from "../db";
import { platformSettings } from "../db/schema/settings";
import { eq } from "drizzle-orm";
import { DEFAULT_GATEWAY_ID, normalizeGatewayId, type GatewayId } from "./gateways/registry";

/**
 * Id gateway aktif. Diturunkan dari registry (`./gateways/registry`) — tambah
 * atau hapus gateway di sana, bukan di sini.
 */
export type PaymentGatewayType = GatewayId;

/**
 * Mengambil payment gateway aktif yang dipilih Super Admin dari panel tertaut.com/panel.
 *
 * Ini SATU-SATUNYA tempat yang membaca `platform_settings.active_payment_gateway`.
 * Dulu tiap modul punya salinan logikanya sendiri (`apps/queries.ts` pernah
 * punya ternary inline); sekarang semuanya lewat fungsi ini.
 */
export async function getActivePaymentGateway(): Promise<PaymentGatewayType> {
  try {
    const row = await db.query.platformSettings.findFirst({
      where: eq(platformSettings.key, "active_payment_gateway"),
    });
    const fromDb = normalizeGatewayId(row?.value);
    if (fromDb) return fromDb;
  } catch {
    // Abaikan jika DB belum siap
  }

  // Fallback ke env. `ACTIVE_PAYMENT_GATEWAY` menang atas `PAYMENT_GATEWAY`
  // karena compose/CI selama ini memakai nama kedua sementara kode lama hanya
  // membaca yang pertama, sehingga pemilihan gateway diam-diam tidak berlaku.
  const fromEnv = normalizeGatewayId(
    process.env.ACTIVE_PAYMENT_GATEWAY || process.env.PAYMENT_GATEWAY
  );
  return fromEnv ?? DEFAULT_GATEWAY_ID;
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
