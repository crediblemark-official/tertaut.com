import { db } from "../../db";
import { platformSettings } from "../../db/schema/settings";
import { eq, inArray } from "drizzle-orm";
import { config } from "../../config";
import {
  DEFAULT_GATEWAY_ID,
  GATEWAY_IDS,
  allCredentialKeys,
  normalizeGatewayId,
} from "../../services/payments/gateways/registry";
import { xenditGateway } from "../../services/payments/gateways/xenditGateway";

const DEFAULT_SETTINGS: Record<string, string> = {
  platform_fee_percent: "5",
  min_payout_threshold: "50000",
  announcement_banner: "",
  announcement_type: "info", // info | warning | alert
  payout_schedule_note: "Pencairan massal dieksekusi setiap hari Jumat pukul 17:00 WIB",
  // Gateway default & daftar credential berasal dari registry — lihat
  // `GATEWAY_REGISTRY`. Menambah gateway tidak perlu menyentuh baris ini.
  active_payment_gateway: DEFAULT_GATEWAY_ID,
  // Sandbox global tidak boleh membaca config gateway tertentu. Dulu baris ini
  // memakai `config.xenithpay.sandboxMode`, jadi menghapus XenithPay ikut
  // mengubah perilaku flag sandbox seluruh platform.
  sandbox_mode: config.isSandbox ? "true" : "false", // true (Sandbox / Pengujian) | false (Production / Live)
  ...Object.fromEntries(allCredentialKeys().map((k) => [k, ""])),
  checkout_mode: "custom", // custom (Full Custom Native UI) | hosted (Redirect ke Halaman Hosted Xendit)
  xendit_qris_enabled: "auto", // auto | true | false
  xendit_va_enabled: "auto", // auto | true | false
  xendit_retail_enabled: "auto", // auto | true | false
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
    if (process.env.XENDIT_SANDBOX_SECRET_KEY || process.env.XENDIT_SECRET_KEY) {
      settingsMap.xendit_secret_key =
        process.env.XENDIT_SANDBOX_SECRET_KEY || process.env.XENDIT_SECRET_KEY || "";
    }
    if (
      process.env.XENDIT_SANDBOX_WEBHOOK_VERIFICATION_TOKEN ||
      process.env.XENDIT_WEBHOOK_VERIFICATION_TOKEN ||
      process.env.XENDIT_WEBHOOK_TOKEN
    ) {
      settingsMap.xendit_webhook_token =
        process.env.XENDIT_SANDBOX_WEBHOOK_VERIFICATION_TOKEN ||
        process.env.XENDIT_WEBHOOK_VERIFICATION_TOKEN ||
        process.env.XENDIT_WEBHOOK_TOKEN ||
        "";
    }
    if (process.env.XENITHPAY_SANDBOX_ACCESS_KEY) {
      settingsMap.xenithpay_sandbox_access_key = process.env.XENITHPAY_SANDBOX_ACCESS_KEY;
    }
    if (process.env.XENITHPAY_SANDBOX_SECRET_KEY) {
      settingsMap.xenithpay_sandbox_secret_key = process.env.XENITHPAY_SANDBOX_SECRET_KEY;
    }
    if (process.env.XENITHPAY_SANDBOX_WEBHOOK_SECRET) {
      settingsMap.xenithpay_sandbox_webhook_secret = process.env.XENITHPAY_SANDBOX_WEBHOOK_SECRET;
    }
    // DANA Sandbox defaults dari environment
    if (process.env.DANA_SANDBOX_CLIENT_ID) {
      settingsMap.dana_sandbox_client_id = process.env.DANA_SANDBOX_CLIENT_ID;
    }
    if (process.env.DANA_SANDBOX_CLIENT_SECRET) {
      settingsMap.dana_sandbox_client_secret = process.env.DANA_SANDBOX_CLIENT_SECRET;
    }
    if (process.env.DANA_SANDBOX_MERCHANT_ID) {
      settingsMap.dana_sandbox_merchant_id = process.env.DANA_SANDBOX_MERCHANT_ID;
    }
  }

  const isSandbox = settingsMap.sandbox_mode !== "false";
  settingsMap.xendit_configured = String(
    Boolean(
      isSandbox
        ? (process.env.XENDIT_SANDBOX_SECRET_KEY || settingsMap.xendit_secret_key) &&
            (process.env.XENDIT_SANDBOX_WEBHOOK_VERIFICATION_TOKEN ||
              settingsMap.xendit_webhook_token)
        : (process.env.XENDIT_PRODUCTION_SECRET_KEY || process.env.XENDIT_SECRET_KEY) &&
            (process.env.XENDIT_PRODUCTION_WEBHOOK_VERIFICATION_TOKEN ||
              settingsMap.xendit_webhook_token)
    )
  );
  settingsMap.dana_configured = String(
    Boolean(
      isSandbox
        ? process.env.DANA_SANDBOX_CLIENT_ID || settingsMap.dana_sandbox_client_id
        : process.env.DANA_CLIENT_ID
    )
  );
  settingsMap.xenithpay_configured = String(
    Boolean(
      isSandbox
        ? process.env.XENITHPAY_SANDBOX_ACCESS_KEY || settingsMap.xenithpay_sandbox_access_key
        : process.env.XENITHPAY_ACCESS_KEY || config.xenithpay.accessKey
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

  // Validasi active payment gateway — memakai registry sebagai satu sumber.
  if (updates.active_payment_gateway !== undefined) {
    const pg = normalizeGatewayId(updates.active_payment_gateway);
    if (!pg) {
      set.status = 400;
      return {
        success: false,
        error: `Gateway pembayaran harus bernilai salah satu dari: ${GATEWAY_IDS.join(", ")}.`,
      };
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

  // Bersihkan cache in-memory payment channels jika ada perubahan settings gateway
  xenditGateway.clearChannelsCache();

  return handleGetPlatformSettings();
}

/**
 * Sinkronisasi dan pengujian channel pembayaran Xendit secara real-time & dinamis
 */
export async function handleSyncPaymentChannels() {
  xenditGateway.clearChannelsCache();
  const channels = await xenditGateway.getPaymentChannels(true);
  const qrisProbe = await xenditGateway.probeQrisLive();

  return {
    success: true,
    channels,
    qrisProbe,
  };
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
