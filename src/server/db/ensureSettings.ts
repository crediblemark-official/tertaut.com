import { db } from "./index";
import { platformSettings } from "./schema/settings";
import { GATEWAY_IDS, GATEWAY_LIST, normalizeGatewayId } from "../services/gateways/registry";

/**
 * Pengaturan Platform non-kredensial.
 *
 * Di-seed secara non-destruktif (onConflictDoNothing), sehingga aman dijalankan
 * setiap kali server startup atau deploy tanpa menghapus atau menimpa data yang
 * sudah diatur admin.
 */
const BASE_PLATFORM_SETTINGS: Array<{ key: string; value: string; description: string }> = [
  {
    key: "platform_fee_percent",
    value: "5",
    description: "Potongan platform fee default (%)",
  },
  {
    key: "min_payout_threshold",
    value: "50000",
    description: "Batas minimum pencairan saldo builder (Rp)",
  },
  {
    key: "announcement_banner",
    value: "",
    description: "Pengumuman global platform",
  },
  {
    key: "announcement_type",
    value: "warning",
    description: "Tipe banner pengumuman (info, warning, success)",
  },
  {
    key: "sandbox_mode",
    value: "true",
    description: "Mode sandbox pembayaran (true/false)",
  },
  {
    key: "checkout_mode",
    value: "hosted",
    description: "Mode checkout default (custom/hosted)",
  },
];

/** Deskripsi kolom kredensial, ditulis dari nama gateway di registry. */
function describeCredential(key: string): string {
  const pretty = key
    .replace(/^xendit_/, "")
    .replace(/^xenithpay_/, "")
    .replace(/^dana_/, "")
    .replace(/_/g, " ")
    .trim();
  return pretty ? `${pretty.charAt(0).toUpperCase()}${pretty.slice(1)}` : key;
}

/**
 * Kredensial gateway — key-nya diambil dari registry, nilainya SELALU kosong.
 *
 * Nilai sandbox Xendit/XenithPay/DANA pernah ditulis literal di file ini sehingga
 * ikut ter-commit ke repo. Sekarang key tetap dibuat (agar panel menampilkan
 * kolomnya) tapi isinya datang dari environment — lihat `seedGatewayCredentialsFromEnv`.
 *
 * Menghapus gateway dari registry otomatis menghapus key kredensialnya di sini.
 */
const CREDENTIAL_PLATFORM_SETTINGS = GATEWAY_LIST.flatMap((gateway) =>
  Object.keys(gateway.credentials).map((key) => ({
    key,
    value: "",
    description: describeCredential(key),
  }))
);

const DEFAULT_PLATFORM_SETTINGS = [...BASE_PLATFORM_SETTINGS, ...CREDENTIAL_PLATFORM_SETTINGS];

/**
 * Isi kredensial gateway dari environment bila tersedia.
 *
 * Nilai yang sudah diisi admin lewat dashboard tidak ditimpa. Key yang masih
 * kosong diisi dari env — itu berarti "belum dikonfigurasi".
 */
async function seedGatewayCredentialsFromEnv(): Promise<void> {
  const { eq } = await import("drizzle-orm");

  for (const gateway of GATEWAY_LIST) {
    for (const [key, envKeys] of Object.entries(gateway.credentials)) {
      const fromEnv = envKeys.map((e) => (process.env[e] || "").trim()).find(Boolean);
      if (!fromEnv) continue;

      const existing = await db.query.platformSettings.findFirst({
        where: eq(platformSettings.key, key),
      });
      if (existing && existing.value.trim() !== "") continue; // sudah diisi admin

      await db
        .insert(platformSettings)
        .values({ key, value: fromEnv, updatedAt: new Date() })
        .onConflictDoUpdate({
          target: platformSettings.key,
          set: { value: fromEnv, updatedAt: new Date() },
        });
    }
  }
}

/**
 * Memastikan default platform settings terisi tanpa menimpa data yang sudah
 * diatur admin.
 */
export async function ensurePlatformSettings(): Promise<void> {
  try {
    await db
      .insert(platformSettings)
      .values(DEFAULT_PLATFORM_SETTINGS)
      .onConflictDoNothing({ target: platformSettings.key });

    await seedGatewayCredentialsFromEnv();

    // Gateway aktif dari env — divalidasi lewat registry, bukan daftar literal.
    const envGateway = normalizeGatewayId(
      process.env.ACTIVE_PAYMENT_GATEWAY || process.env.PAYMENT_GATEWAY
    );
    if (envGateway && (GATEWAY_IDS as readonly string[]).includes(envGateway)) {
      const { eq } = await import("drizzle-orm");
      await db
        .update(platformSettings)
        .set({ value: envGateway })
        .where(eq(platformSettings.key, "active_payment_gateway"));
    }
  } catch (err: any) {
    console.warn("[Settings] Gagal memastikan default platform settings:", err?.message || err);
  }
}
