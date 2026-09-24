import { db } from "../../db";
import { platformSettings } from "../../db/schema/settings";
import { eq, inArray } from "drizzle-orm";
import { config } from "../../config";

const DEFAULT_SETTINGS: Record<string, string> = {
  platform_fee_percent: "5",
  min_payout_threshold: "50000",
  announcement_banner: "",
  announcement_type: "info", // info | warning | alert
  payout_schedule_note: "Pencairan massal dieksekusi setiap hari Jumat pukul 17:00 WIB",
  active_payment_gateway: "dana", // dana | xendit
  sandbox_mode: "true", // true (Sandbox / Pengujian) | false (Production / Live)
  xendit_secret_key: "",
  xendit_webhook_token: "",
  dana_sandbox_client_id: "",
  dana_sandbox_client_secret: "",
  dana_sandbox_merchant_id: "",
  checkout_mode: "custom", // custom (Full Custom Native UI) | hosted (Redirect ke Halaman Hosted Xendit)
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

  // Kredensial environment (.env / Dokploy) selalu menjadi acuan utama (di luar test runner)
  if (!config.isTest) {
    if (process.env.XENDIT_SECRET_KEY) {
      settingsMap.xendit_secret_key = process.env.XENDIT_SECRET_KEY;
    }
    if (process.env.XENDIT_WEBHOOK_VERIFICATION_TOKEN || process.env.XENDIT_WEBHOOK_TOKEN) {
      settingsMap.xendit_webhook_token =
        process.env.XENDIT_WEBHOOK_VERIFICATION_TOKEN || process.env.XENDIT_WEBHOOK_TOKEN || "";
    }
    // DANA Sandbox defaults dari environment jika belum ada di database
    if (process.env.DANA_SANDBOX_CLIENT_ID && !settingsMap.dana_sandbox_client_id) {
      settingsMap.dana_sandbox_client_id = process.env.DANA_SANDBOX_CLIENT_ID;
    }
    if (process.env.DANA_SANDBOX_CLIENT_SECRET && !settingsMap.dana_sandbox_client_secret) {
      settingsMap.dana_sandbox_client_secret = process.env.DANA_SANDBOX_CLIENT_SECRET;
    }
    if (process.env.DANA_SANDBOX_MERCHANT_ID && !settingsMap.dana_sandbox_merchant_id) {
      settingsMap.dana_sandbox_merchant_id = process.env.DANA_SANDBOX_MERCHANT_ID;
    }
  }

  settingsMap.xendit_configured = String(
    Boolean(settingsMap.xendit_secret_key && settingsMap.xendit_webhook_token)
  );
  settingsMap.dana_configured = String(
    Boolean(
      process.env.DANA_CLIENT_ID ||
      process.env.DANA_SANDBOX_CLIENT_ID ||
      settingsMap.dana_sandbox_client_id
    )
  );

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

  // Validasi active payment gateway
  if (updates.active_payment_gateway !== undefined) {
    const pg = String(updates.active_payment_gateway).toLowerCase().trim();
    if (pg !== "dana" && pg !== "xendit") {
      set.status = 400;
      return { success: false, error: "Gateway pembayaran harus bernilai 'dana' atau 'xendit'." };
    }
    updates.active_payment_gateway = pg;
  }

  // Validasi checkout mode (custom vs hosted)
  if (updates.checkout_mode !== undefined) {
    const cm = String(updates.checkout_mode).toLowerCase().trim();
    if (cm !== "custom" && cm !== "hosted") {
      set.status = 400;
      return { success: false, error: "Mode checkout harus bernilai 'custom' atau 'hosted'." };
    }
    updates.checkout_mode = cm;
  }

  // Validasi mode sandbox
  if (updates.sandbox_mode !== undefined) {
    const sm = String(updates.sandbox_mode).toLowerCase().trim();
    if (sm !== "true" && sm !== "false") {
      set.status = 400;
      return { success: false, error: "Mode sandbox harus bernilai 'true' atau 'false'." };
    }
    updates.sandbox_mode = sm;
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
