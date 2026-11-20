import { ref, computed, watch } from "vue";
import type { DeliveryConfig, BillingPeriodType, AppItem } from "../types/app";
import { dashboardEnv } from "../lib/environment";
import {
  inferAppCapability,
  type AppCapabilityMode,
  type PricingStrategy,
} from "../lib/appCapability";

export interface UseAppFormOptions {
  initialApp: () => AppItem | null | undefined;
  createFn: (payload: Record<string, any>) => Promise<any>;
  updateFn?: (appId: string, payload: Record<string, any>) => Promise<any>;
  onCreated: (app: AppItem) => void;
  onUpdated: () => void;
}

export function useAppForm(options: UseAppFormOptions) {
  const isEditMode = computed(() => Boolean(options.initialApp()?.id));
  const isCreating = ref(false);
  const createError = ref<string | null>(null);

  const capabilityMode = ref<AppCapabilityMode>("both");
  const pricingStrategy = ref<PricingStrategy>("fixed");
  const hasPayment = computed(() => capabilityMode.value !== "license_only");
  const hasLicense = computed(() => capabilityMode.value !== "payment_only");

  const editTab = ref<"general" | "checkout" | "licensing">("general");

  const newAppName = ref("");
  const newAppSlug = ref("");
  const slugManuallyEdited = ref(false);

  const newAppDesc = ref("");
  const newAppMediaUrl = ref("");
  const logoUrl = ref("");
  const appUrl = ref("");
  const brandColor = ref("#0D9488");
  const webhookUrl = ref("");
  const returnUrl = ref("");

  const pricingType = ref<"one_time" | "subscription" | "free">("subscription");
  const newAppPrice = ref(49000);
  const billingPeriod = ref<BillingPeriodType>("monthly");
  const customBillingDays = ref(14);
  const hasTrialPeriod = ref(false);
  const trialPeriodDays = ref(7);

  const benefits = ref<string[]>([
    "Akses source code lengkap & dokumentasi",
    "Lisensi komersial software",
    "Update berkala & perbaikan bug",
  ]);

  const deliveryConfigState = ref<DeliveryConfig>({
    licenseKey: { enabled: true, maxSeats: 3, expiresInDays: 365, offlineGraceDays: 30 },
    fileDownload: { enabled: false },
    privateNote: { enabled: false },
  });

  const licenseMaxSeats = computed({
    get: () => deliveryConfigState.value.licenseKey?.maxSeats ?? 3,
    set: (val: number) => {
      deliveryConfigState.value = {
        ...deliveryConfigState.value,
        licenseKey: {
          ...(deliveryConfigState.value.licenseKey || { enabled: true }),
          enabled: hasLicense.value,
          maxSeats: Math.max(1, Number(val) || 1),
        },
      };
    },
  });

  const licenseExpiresInDays = computed({
    get: () => deliveryConfigState.value.licenseKey?.expiresInDays ?? 365,
    set: (val: number) => {
      deliveryConfigState.value = {
        ...deliveryConfigState.value,
        licenseKey: {
          ...(deliveryConfigState.value.licenseKey || { enabled: true }),
          enabled: hasLicense.value,
          expiresInDays: Math.max(0, Number(val) || 0),
        },
      };
    },
  });

  const billingPeriodDisplay = computed(() => {
    switch (billingPeriod.value) {
      case "weekly":
        return "/ Minggu (Weekly)";
      case "daily":
        return "/ Hari (Daily)";
      case "monthly":
        return "/ Bulan (Monthly)";
      case "every_3_months":
        return "/ 3 Bulan (Quarterly)";
      case "every_6_months":
        return "/ 6 Bulan (Semi-annual)";
      case "yearly":
        return "/ Tahun (Yearly)";
      case "custom":
        return `/ ${customBillingDays.value} Hari`;
      default:
        return "/ Bulan";
    }
  });

  const derivedAppType = computed<"saas_web" | "desktop_onprem">(() => {
    if (capabilityMode.value === "payment_only") return "saas_web";
    if (capabilityMode.value === "license_only") return "desktop_onprem";
    return pricingStrategy.value === "dynamic" ? "saas_web" : "desktop_onprem";
  });

  const capabilityBadge = computed(() => {
    if (capabilityMode.value === "license_only") {
      return { label: "Lisensi", cls: "bg-amber-50 text-amber-800 border border-amber-200" };
    }
    if (capabilityMode.value === "payment_only") {
      return {
        label: "Pembayaran",
        cls: "bg-emerald-50 text-emerald-700 border border-emerald-200",
      };
    }
    return { label: "Bayar + Lisensi", cls: "bg-gold/15 text-[#8a6d1f] border border-gold/30" };
  });

  watch(newAppName, (val) => {
    if (!slugManuallyEdited.value) {
      newAppSlug.value = val
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
    }
  });

  watch(capabilityMode, (mode) => {
    if (mode === "payment_only") {
      if (editTab.value === "licensing") editTab.value = "general";
      if (pricingType.value === "free") pricingType.value = "subscription";
    } else if (mode === "license_only") {
      if (editTab.value === "checkout") editTab.value = "general";
    }
  });

  function resetForm() {
    capabilityMode.value = "both";
    pricingStrategy.value = "fixed";
    editTab.value = "general";
    newAppName.value = "";
    newAppSlug.value = "";
    slugManuallyEdited.value = false;
    newAppDesc.value = "";
    newAppMediaUrl.value = "";
    logoUrl.value = "";
    appUrl.value = "";
    brandColor.value = "#0D9488";
    webhookUrl.value = "";
    returnUrl.value = "";
    pricingType.value = "subscription";
    newAppPrice.value = 49000;
    billingPeriod.value = "monthly";
    hasTrialPeriod.value = false;
    trialPeriodDays.value = 7;
    benefits.value = [
      "Akses source code lengkap & dokumentasi",
      "Lisensi komersial software",
      "Update berkala & perbaikan bug",
    ];
    deliveryConfigState.value = {
      licenseKey: { enabled: true, maxSeats: 3, expiresInDays: 365, offlineGraceDays: 30 },
      fileDownload: { enabled: false },
      privateNote: { enabled: false },
    };
    createError.value = null;
  }

  function loadApp(app: AppItem) {
    editTab.value = "general";
    newAppName.value = app.name || "";
    newAppSlug.value = app.slug || "";
    slugManuallyEdited.value = true;
    newAppDesc.value = app.description || "";
    newAppMediaUrl.value = app.mediaUrl || "";
    logoUrl.value = app.logoUrl || app.mediaUrl || "";
    appUrl.value = app.appUrl || "";
    brandColor.value = app.brandColor || "#0D9488";
    webhookUrl.value = app.webhookUrl || "";
    returnUrl.value = app.redirectUrl || "";

    const cap = inferAppCapability(app);
    capabilityMode.value = cap.mode;
    pricingStrategy.value = cap.pricingStrategy;

    pricingType.value =
      (app.pricingType as any) || (app.billingPeriod ? "subscription" : "one_time");
    newAppPrice.value = app.targetPrice || 0;
    const rawPeriod = String(app.billingPeriod || "monthly");
    if (rawPeriod.startsWith("custom_")) {
      billingPeriod.value = "custom";
      customBillingDays.value = Math.max(1, Number(rawPeriod.slice(7)) || 14);
    } else {
      billingPeriod.value = (rawPeriod as any) || "monthly";
    }
    hasTrialPeriod.value = Boolean(app.trialPeriodDays && app.trialPeriodDays > 0);
    trialPeriodDays.value = app.trialPeriodDays || 7;

    if (Array.isArray(app.valueProps)) {
      benefits.value = [...app.valueProps];
    } else if (typeof app.valueProps === "string") {
      try {
        benefits.value = JSON.parse(app.valueProps);
      } catch {
        benefits.value = [app.valueProps];
      }
    } else {
      benefits.value = [
        "Akses lisensi software",
        "Update berkala & perbaikan bug",
        "Dukungan teknis prioritas",
      ];
    }

    if (app.deliveryConfig) {
      deliveryConfigState.value = JSON.parse(JSON.stringify(app.deliveryConfig));
    } else {
      deliveryConfigState.value = {
        licenseKey: {
          enabled: cap.hasLicense,
          maxSeats: 3,
          expiresInDays: 365,
          offlineGraceDays: 30,
        },
        fileDownload: { enabled: false },
        privateNote: { enabled: false },
      };
    }
  }

  watch(
    options.initialApp,
    (app) => {
      if (app) loadApp(app);
      else resetForm();
    },
    { immediate: true }
  );

  async function handleSubmitProduct() {
    if (!newAppName.value.trim() || !newAppSlug.value.trim() || isCreating.value) return;
    isCreating.value = true;
    createError.value = null;

    const currentApp = options.initialApp();
    const isDyn = hasPayment.value && pricingStrategy.value === "dynamic";
    const resolvedPrice =
      !hasPayment.value || isDyn || pricingType.value === "free" ? 0 : newAppPrice.value || 0;
    const resolvedPricingType = !hasPayment.value ? "free" : isDyn ? "one_time" : pricingType.value;

    const currentLic: Partial<NonNullable<DeliveryConfig["licenseKey"]>> =
      deliveryConfigState.value.licenseKey ?? {};

    const payload: Record<string, any> = {
      name: newAppName.value.trim(),
      slug: newAppSlug.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
      mode: currentApp ? currentApp.mode : dashboardEnv.value,
      description: newAppDesc.value,
      mediaUrl: newAppMediaUrl.value || logoUrl.value || null,
      redirectUrl: returnUrl.value || null,
      appType: derivedAppType.value,
      brandColor: brandColor.value,
      logoUrl: logoUrl.value || null,
      appUrl: appUrl.value || null,
      webhookUrl: webhookUrl.value || null,
      targetPrice: resolvedPrice,
      pricingType: resolvedPricingType,
      billingPeriod:
        hasPayment.value && !isDyn && resolvedPricingType === "subscription"
          ? billingPeriod.value === "custom"
            ? `custom_${Math.max(1, Math.min(365, Number(customBillingDays.value) || 14))}`
            : billingPeriod.value
          : null,
      trialPeriodDays:
        hasPayment.value && !isDyn && resolvedPricingType === "subscription" && hasTrialPeriod.value
          ? trialPeriodDays.value || 7
          : 0,
      valueProps:
        hasPayment.value && !isDyn ? benefits.value.filter((b) => b.trim().length > 0) : [],
      deliveryConfig: {
        ...deliveryConfigState.value,
        licenseKey: hasLicense.value
          ? {
              ...currentLic,
              enabled: true,
              maxSeats: currentLic.maxSeats ?? 3,
              expiresInDays: currentLic.expiresInDays ?? 365,
              offlineGraceDays: currentLic.offlineGraceDays ?? 30,
            }
          : { enabled: false },
        fileDownload: deliveryConfigState.value.fileDownload || { enabled: false },
        privateNote: deliveryConfigState.value.privateNote || { enabled: false },
      },
    };

    try {
      if (isEditMode.value && currentApp) {
        if (!options.updateFn) throw new Error("Update handler belum didefinisikan.");
        const data = await options.updateFn(currentApp.id, payload);
        if (data && (data.success || data.app)) options.onUpdated();
        else createError.value = data?.error || "Gagal memperbarui aplikasi";
      } else {
        const data = await options.createFn(payload);
        if (data && (data.success || data.app)) {
          const created = data.app as AppItem;
          resetForm();
          options.onCreated(created);
        } else {
          createError.value = data?.error || "Gagal membuat aplikasi";
        }
      }
    } catch (e: any) {
      createError.value = e?.message || "Terjadi kesalahan sistem";
    } finally {
      isCreating.value = false;
    }
  }

  return {
    isEditMode,
    isCreating,
    createError,
    capabilityMode,
    pricingStrategy,
    hasPayment,
    hasLicense,
    editTab,
    newAppName,
    newAppSlug,
    slugManuallyEdited,
    newAppDesc,
    newAppMediaUrl,
    logoUrl,
    appUrl,
    brandColor,
    webhookUrl,
    returnUrl,
    pricingType,
    newAppPrice,
    billingPeriod,
    customBillingDays,
    hasTrialPeriod,
    trialPeriodDays,
    billingPeriodDisplay,
    benefits,
    deliveryConfigState,
    licenseMaxSeats,
    licenseExpiresInDays,
    derivedAppType,
    capabilityBadge,
    handleSubmitProduct,
  };
}
