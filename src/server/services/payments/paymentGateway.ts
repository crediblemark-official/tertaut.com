import { db } from "../../db";
import { platformSettings } from "../../db/schema/settings";
import { eq } from "drizzle-orm";

/** Mengambil nilai `active_payment_gateway` dari platform_settings. */
export async function getActivePgSetting(): Promise<string> {
  const row = await db.query.platformSettings.findFirst({
    where: eq(platformSettings.key, "active_payment_gateway"),
  });
  return row?.value ?? "xendit";
}

/** Mendapatkan nama gateway yang aktif dari pengaturan platform. */
export async function getActivePaymentGateway(): Promise<string> {
  return getActivePgSetting();
}

export * from "./gateways";
