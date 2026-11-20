export interface MorCalculation {
  grossAmount: number;
  platformFee: number;
  netAmount: number;
}

export function calculateMor(amount: number, feeRatePercent: number): MorCalculation {
  const feeRate = feeRatePercent / 100;
  const platformFee = Math.round(amount * feeRate);
  const netAmount = amount - platformFee;
  return { grossAmount: amount, platformFee, netAmount };
}

const BILLING_PERIOD_DAYS: Record<string, number> = {
  daily: 1,
  weekly: 7,
  monthly: 30,
  every_3_months: 90,
  every_6_months: 180,
  yearly: 365,
};

/**
 * Menentukan masa berlaku lisensi (hari) secara konsisten dari billingPeriod produk
 * subscription atau deliveryConfig.licenseKey.expiresInDays.
 */
export function resolveAppGrantDays(
  app:
    | {
        pricingType?: string | null;
        billingPeriod?: string | null;
        deliveryConfig?: { licenseKey?: { expiresInDays?: number } } | null;
      }
    | null
    | undefined,
  fallbackDays = 365
): number {
  const configuredDays = app?.deliveryConfig?.licenseKey?.expiresInDays;
  const periodRaw = String(app?.billingPeriod || "")
    .trim()
    .toLowerCase();

  let periodDays: number | undefined;
  if (periodRaw && BILLING_PERIOD_DAYS[periodRaw]) {
    periodDays = BILLING_PERIOD_DAYS[periodRaw];
  } else if (periodRaw.startsWith("custom_")) {
    const parsed = Number(periodRaw.slice(7));
    if (Number.isFinite(parsed) && parsed > 0) periodDays = Math.round(parsed);
  }

  if (app?.pricingType === "subscription" && periodDays) {
    // Jika builder tidak mengubah expiresInDays dari default 365 namun memilih siklus selain tahunan,
    // gunakan durasi siklus penagihan agar pembeli mingguan/bulanan tidak mendapat akses 1 tahun.
    if (
      typeof configuredDays === "number" &&
      configuredDays > 0 &&
      (configuredDays !== 365 || periodRaw === "yearly")
    ) {
      return configuredDays;
    }
    return periodDays;
  }

  if (typeof configuredDays === "number" && configuredDays > 0) {
    return configuredDays;
  }
  return fallbackDays > 0 ? fallbackDays : 365;
}

export type PublicPaymentRail = "qris" | "va" | "ewallet" | "card" | "retail";

export interface PublicPaymentRailInfo {
  paymentRail: PublicPaymentRail;
  vaBank?: string;
  retailOutlet?: string;
  ewalletChannel?: string;
  actionUrl?: string;
}

const KNOWN_VA_BANKS = new Set([
  "BCA",
  "BNI",
  "BRI",
  "MANDIRI",
  "PERMATA",
  "CIMB",
  "BSI",
  "BJB",
  "SAHABAT_SAMPOERNA",
  "BSS",
]);

const KNOWN_RETAILS = new Set(["ALFAMART", "INDOMARET", "RETAIL", "OVER_THE_COUNTER"]);

const KNOWN_EWALLETS = new Set([
  "OVO",
  "DANA",
  "SHOPEEPAY",
  "LINKAJA",
  "GOPAY",
  "ASTRAPAY",
  "EWALLET",
]);

/**
 * Menurunkan jenis rail pembayaran & detail kanal dari label paymentChannel tersimpan
 * sehingga frontend dapat memulihkan layar QRIS/VA/Retail/E-Wallet secara akurat saat reload.
 */
export function resolvePublicPaymentRailInfo(
  channel?: string | null,
  invoiceUrl?: string | null
): PublicPaymentRailInfo {
  const ch = (channel || "").trim().toUpperCase();

  if (ch === "QRIS" || ch.includes("QR")) {
    return { paymentRail: "qris" };
  }

  if (ch.startsWith("VA_") || ch.endsWith("_VA") || KNOWN_VA_BANKS.has(ch)) {
    const vaBank = ch.replace(/^VA_/, "").replace(/_VA$/, "");
    return { paymentRail: "va", vaBank: vaBank || undefined };
  }

  if (KNOWN_RETAILS.has(ch)) {
    const retailOutlet = ch === "RETAIL" || ch === "OVER_THE_COUNTER" ? undefined : ch;
    return { paymentRail: "retail", retailOutlet };
  }

  if (KNOWN_EWALLETS.has(ch)) {
    const ewalletChannel = ch === "EWALLET" ? undefined : ch;
    const isInternalHostedPayUrl = Boolean(
      invoiceUrl && /\/pay\/[^?]+\?externalId=/.test(invoiceUrl)
    );
    return {
      paymentRail: "ewallet",
      ewalletChannel,
      actionUrl: invoiceUrl && !isInternalHostedPayUrl ? invoiceUrl : undefined,
    };
  }

  if (ch === "CARD" || ch === "CREDIT_CARD") {
    return { paymentRail: "card" };
  }

  return { paymentRail: "qris" };
}

export interface PublicDeliveryPayload {
  licenseKeyEnabled: boolean;
  fileDownload?: { enabled?: boolean; title?: string; fileUrl?: string; fileName?: string };
  privateNote?: { enabled?: boolean; title?: string; note?: string };
  apiAccess?: {
    enabled?: boolean;
    endpointUrl?: string;
    instruction?: string;
    apiKey?: string;
  };
  redirectUrl?: string;
}

/**
 * Menyusun payload delivery pasca-pembayaran secara konsisten (hanya menyertakan
 * fitur delivery yang aktif/enabled pada konfigurasi aplikasi).
 */
export function buildPublicDeliveryPayload(
  app:
    | {
        redirectUrl?: string | null;
        deliveryConfig?: {
          licenseKey?: { enabled?: boolean };
          fileDownload?: { enabled?: boolean; title?: string; fileUrl?: string; fileName?: string };
          privateNote?: { enabled?: boolean; title?: string; note?: string };
          apiAccess?: { enabled?: boolean; endpointUrl?: string; instruction?: string };
        } | null;
      }
    | null
    | undefined,
  redirectUrlOverride?: string,
  apiKey?: string
): PublicDeliveryPayload {
  const dc = app?.deliveryConfig;
  return {
    licenseKeyEnabled: dc?.licenseKey?.enabled !== false,
    fileDownload: dc?.fileDownload?.enabled ? dc.fileDownload : undefined,
    privateNote: dc?.privateNote?.enabled ? dc.privateNote : undefined,
    apiAccess: dc?.apiAccess?.enabled
      ? {
          enabled: true,
          endpointUrl: dc.apiAccess.endpointUrl,
          instruction: dc.apiAccess.instruction,
          apiKey,
        }
      : undefined,
    redirectUrl: redirectUrlOverride || app?.redirectUrl || undefined,
  };
}
