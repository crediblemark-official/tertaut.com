import { db } from "../../db";
import { platformSettings } from "../../db/schema/settings";
import { eq, inArray } from "drizzle-orm";

const DEFAULT_SETTINGS: Record<string, string> = {
  platform_fee_percent: "5",
  min_payout_threshold: "50000",
  announcement_banner: "",
  announcement_type: "info", // info | warning | alert
  payout_schedule_note: "Pencairan massal dieksekusi setiap hari Jumat pukul 17:00 WIB",
};

/**
 * Ambil seluruh pengaturan platform (Super Admin)
 */
export async function handleGetPlatformSettings() {
  const rows = await db.select().from(platformSettings);
  const settingsMap: Record<string, string> = { ...DEFAULT_SETTINGS };

  for (const r of rows) {
    settingsMap[r.key] = r.value;
  }

  return {
    success: true,
    settings: settingsMap,
    items: rows,
  };
}

/**
 * Perbarui pengaturan platform (Super Admin)
 */
export async function handleUpdatePlatformSettings({ body, set }: any) {
  const updates: Record<string, string> = body?.settings || body || {};

  if (typeof updates !== "object" || Object.keys(updates).length === 0) {
    set.status = 400;
    return { success: false, error: "Data pengaturan tidak valid." };
  }

  // Validasi fee percent
  if (updates.platform_fee_percent !== undefined) {
    const feeNum = Number(updates.platform_fee_percent);
    if (isNaN(feeNum) || feeNum < 0 || feeNum > 50) {
      set.status = 400;
      return { success: false, error: "Fee platform harus berupa angka antara 0% hingga 50%." };
    }
  }

  // Validasi threshold
  if (updates.min_payout_threshold !== undefined) {
    const threshNum = Number(updates.min_payout_threshold);
    if (isNaN(threshNum) || threshNum < 10000) {
      set.status = 400;
      return { success: false, error: "Batas minimum payout minimal Rp 10.000." };
    }
  }

  const now = new Date();

  for (const [key, val] of Object.entries(updates)) {
    const strVal = String(val ?? "");
    await db
      .insert(platformSettings)
      .values({
        key,
        value: strVal,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: platformSettings.key,
        set: {
          value: strVal,
          updatedAt: now,
        },
      });
  }

  return handleGetPlatformSettings();
}

/**
 * Endpoint publik/builder untuk membaca banner pengumuman aktif
 */
export async function handleGetPublicAnnouncement() {
  const [bannerRow, typeRow] = await Promise.all([
    db.query.platformSettings.findFirst({ where: eq(platformSettings.key, "announcement_banner") }),
    db.query.platformSettings.findFirst({ where: eq(platformSettings.key, "announcement_type") }),
  ]);

  const message = bannerRow?.value || "";
  const type = typeRow?.value || "info";

  return {
    success: true,
    hasAnnouncement: Boolean(message.trim()),
    announcement: message.trim() ? { message, type } : null,
  };
}
