import type { AppItem } from "../types/app";

export type AppCapabilityMode = "payment_only" | "license_only" | "both";
export type PricingStrategy = "fixed" | "dynamic";

export interface AppCapabilityMeta {
  mode: AppCapabilityMode;
  pricingStrategy: PricingStrategy;
  hasPayment: boolean;
  hasLicense: boolean;
  label: string;
  badgeClass: string;
}

/**
 * Menyimpulkan kebutuhan utama aplikasi (Pembayaran Saja / Lisensi Saja / Keduanya)
 * secara konsisten dari skema data AppItem tanpa mengubah struktur tabel database.
 */
export function inferAppCapability(app: AppItem): AppCapabilityMeta {
  const explicitlyDisabled = app.deliveryConfig?.licenseKey?.enabled === false;
  const explicitlyEnabled = app.deliveryConfig?.licenseKey?.enabled === true;
  const hasLicense = explicitlyEnabled || (!explicitlyDisabled && app.appType === "desktop_onprem");

  const isZeroPrice = !app.targetPrice || app.targetPrice === 0;
  const isDynamic = app.appType === "saas_web" && isZeroPrice;
  const isLicenseOnly =
    hasLicense && app.appType === "desktop_onprem" && app.pricingType === "free" && isZeroPrice;

  if (isLicenseOnly) {
    return {
      mode: "license_only",
      pricingStrategy: "fixed",
      hasPayment: false,
      hasLicense: true,
      label: "Lisensi Saja",
      badgeClass: "bg-amber-500/15 text-amber-800",
    };
  }

  if (!hasLicense) {
    return {
      mode: "payment_only",
      pricingStrategy: isDynamic ? "dynamic" : "fixed",
      hasPayment: true,
      hasLicense: false,
      label: "Pembayaran",
      badgeClass: "bg-forest/10 text-forest",
    };
  }

  return {
    mode: "both",
    pricingStrategy: isDynamic ? "dynamic" : "fixed",
    hasPayment: true,
    hasLicense: true,
    label: "Bayar + Lisensi",
    badgeClass: "bg-gold/15 text-[#8a6d1f]",
  };
}
