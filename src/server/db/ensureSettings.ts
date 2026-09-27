import { db } from "./index";
import { platformSettings } from "./schema/settings";

/**
 * Pengaturan Platform & Kredensial Gateway Default
 * Di-seed secara non-destruktif (onConflictDoNothing), sehingga aman dijalankan
 * setiap kali server startup atau deploy tanpa menghapus atau menimpa data yang ada.
 */
export const DEFAULT_PLATFORM_SETTINGS = [
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
    key: "active_payment_gateway",
    value: "xenithpay",
    description: "Gateway pembayaran aktif default",
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
  // XenithPay Sandbox Credentials
  {
    key: "xenithpay_sandbox_access_key",
    value: "ak-6aeedc57464fc85638ebee9ef121add6cf0a876da3dd5f47a4bf867ff7dab701",
    description: "XenithPay Sandbox Access Key",
  },
  {
    key: "xenithpay_sandbox_secret_key",
    value:
      "sk-80b0eddf8ee0fddaecb00deba46bf423fbc9fcaebe3b019e2f0a1fec7eed23cd70d752df9123d9089aac398cd48c849e66c0d2f5896433c40996ae9d0972ed6c",
    description: "XenithPay Sandbox Secret Key",
  },
  {
    key: "xenithpay_sandbox_webhook_secret",
    value: "bNhIQPhTEOWhdS8-ukYPBIpvVITadn51jlshccNG33IqdYmed3GgeyzbsQZB0y3o",
    description: "XenithPay Sandbox Webhook Secret",
  },
  // Xendit Development Credentials
  {
    key: "xendit_secret_key",
    value: "xnd_development_T8pyD9ZQrhXNKDwLwAakFWOclcmk2m6Z8VRvdA1ZejgHS2jqX7yAUWNRra",
    description: "Xendit Development Secret Key",
  },
  {
    key: "xendit_public_key",
    value: "xnd_public_development_mbk6iKJSkIbUbuBw0AFooGoLrOVGaWwVuWGHxPfK2tCicZ8Ynkct1ClMAejYnKo",
    description: "Xendit Development Public Key",
  },
  {
    key: "xendit_webhook_token",
    value: "k7ioh5IKLXqTFI0iWetVQDaTJx1akOnAy8u3rCzzrU1z4BVK",
    description: "Xendit Webhook Verification Token",
  },
  // DANA Sandbox Credentials
  {
    key: "dana_sandbox_client_id",
    value: "2026091703024650623472",
    description: "DANA Sandbox Client ID",
  },
  {
    key: "dana_sandbox_client_secret",
    value: "0417e2553e17413056f7f7bdf18b5020c9e0eef9dec11b32ec58480bbcf452d3",
    description: "DANA Sandbox Client Secret",
  },
  {
    key: "dana_sandbox_merchant_id",
    value: "216620090015052037410",
    description: "DANA Sandbox Merchant ID",
  },
];

/**
 * Memastikan default platform settings terisi tanpa menimpa data yang sudah diatur admin.
 */
export async function ensurePlatformSettings(): Promise<void> {
  try {
    await db
      .insert(platformSettings)
      .values(DEFAULT_PLATFORM_SETTINGS)
      .onConflictDoNothing({ target: platformSettings.key });
  } catch (err: any) {
    console.warn("[Settings] Gagal memastikan default platform settings:", err?.message || err);
  }
}
