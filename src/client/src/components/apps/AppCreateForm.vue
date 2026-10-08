<script setup lang="ts">
import { ref, computed, watch } from "vue";
import type { DeliveryConfig, MeteringConfig, BillingPeriodType, AppItem } from "../../types/app";
import { dashboardEnv, envPath } from "../../lib/environment";
import { useClipboard } from "../../composables/useClipboard";
import {
  ArrowLeft,
  X,
  Check,
  Globe,
  Palette,
  ShieldCheck,
  Code,
  Sparkles,
  ExternalLink,
  Lock,
  Layers,
  Terminal,
  Info,
  Copy,
  Trash2,
} from "lucide-vue-next";

import AppBenefitsForm from "./AppBenefitsForm.vue";
import AppPricingSection from "./AppPricingSection.vue";
import AppDeliverySection from "./AppDeliverySection.vue";
import AppLivePreviewCard from "./AppLivePreviewCard.vue";
import AppMeteringModal, { type MeteringModalResult } from "./AppMeteringModal.vue";

const emit = defineEmits<{
  cancel: [];
  created: [];
  updated: [];
  error: [msg: string];
  delete: [app: AppItem];
}>();

const props = defineProps<{
  createFn: (payload: Record<string, any>) => Promise<any>;
  updateFn?: (appId: string, payload: Record<string, any>) => Promise<any>;
  initialApp?: AppItem | null;
}>();

const isEditMode = computed(() => Boolean(props.initialApp?.id));

const { copied: copiedAppId, copy: copyClipboard } = useClipboard();
async function handleCopyAppId(id: string) {
  await copyClipboard(id);
}

// Form state
const isCreating = ref(false);
const createError = ref<string | null>(null);

// Project Solution Type
const appType = ref<"saas_web" | "desktop_onprem">("saas_web");

// General Info & Multi-SaaS Branding
const newAppName = ref("");
const newAppSlug = ref("");
const slugManuallyEdited = ref(false);
const newAppDesc = ref("");
const newAppMediaUrl = ref("");
const logoUrl = ref("");
const appUrl = ref("");
const brandColor = ref("#0D9488");
const webhookUrl = ref("");

const brandColorPresets = [
  "#0D9488", // Teal Tertaut
  "#2563EB", // Blue
  "#7C3AED", // Purple
  "#DB2777", // Pink
  "#EA580C", // Orange
  "#16A34A", // Green
  "#0F172A", // Slate Dark
];

// Classic Pricing (Desktop / On-Premise)
const pricingType = ref<"one_time" | "subscription" | "free">("subscription");
const newAppPrice = ref(49000);
const billingPeriod = ref<BillingPeriodType>("monthly");
const customBillingDays = ref(14);
const hasTrialPeriod = ref(false);
const trialPeriodDays = ref(7);

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

// Benefits (Classic)
const benefits = ref<string[]>([
  "Akses source code lengkap & dokumentasi",
  "Lisensi komersial software",
  "Update berkala & perbaikan bug",
]);

// Checkout & Follow-up
const returnUrl = ref("");
const abandonedCartRecovery = ref(false);
const autoAffiliateRegistration = ref(false);

// Metering (Usage-based pricing)
const meteringEnabled = ref(false);
const isMeteringModalOpen = ref(false);

const meterTemplateId = ref("llm_tokens");
const meterName = ref("Token LLM");
const meterEventName = ref("ai_usage");
const meterCalcType = ref<"count" | "sum" | "max" | "unique">("count");
const meterUnitLabel = ref("tokens");
const meterFilters = ref<Array<{ property: string; value: string }>>([]);
const meteringAggregation = ref("count on ai_usage");
const meteringUnitPrice = ref<string | number>("20.00");
const meteringMetricUnit = ref("per tokens");
const meteringFreeAllowance = ref<number>(0);

watch(newAppName, (val) => {
  if (!slugManuallyEdited.value) {
    newAppSlug.value = val
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  }
});

function handleMeteringApply(result: MeteringModalResult) {
  meteringEnabled.value = true;
  meterTemplateId.value = result.template;
  meterName.value = result.name;
  meterEventName.value = result.eventName;
  meterCalcType.value = result.calculationType;
  meterUnitLabel.value = result.unitLabel;
  meterFilters.value = result.filters;
  meteringAggregation.value = result.aggregation;
  meteringUnitPrice.value = result.unitPrice;
  meteringMetricUnit.value = result.metricUnit;
  meteringFreeAllowance.value = result.freeAllowance;
}

function removeMetering() {
  meteringEnabled.value = false;
}

function resetForm() {
  appType.value = "saas_web";
  newAppName.value = "";
  newAppSlug.value = "";
  slugManuallyEdited.value = false;
  newAppDesc.value = "";
  newAppMediaUrl.value = "";
  logoUrl.value = "";
  appUrl.value = "";
  brandColor.value = "#0D9488";
  webhookUrl.value = "";
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
  meteringEnabled.value = false;
  meterTemplateId.value = "llm_tokens";
  meterName.value = "Token LLM";
  meterEventName.value = "ai_usage";
  meterCalcType.value = "count";
  meterUnitLabel.value = "tokens";
  meterFilters.value = [];
  meteringAggregation.value = "count on ai_usage";
  meteringUnitPrice.value = "20.00";
  meteringMetricUnit.value = "per tokens";
  meteringFreeAllowance.value = 0;
  returnUrl.value = "";
  abandonedCartRecovery.value = false;
  autoAffiliateRegistration.value = false;
  deliveryConfigState.value = {
    licenseKey: { enabled: true, maxSeats: 3, expiresInDays: 365, offlineGraceDays: 30 },
    fileDownload: { enabled: false },
    privateNote: { enabled: false },
  };
  createError.value = null;
}

const deliveryConfigState = ref<DeliveryConfig>({
  licenseKey: { enabled: true, maxSeats: 3, expiresInDays: 365, offlineGraceDays: 30 },
  fileDownload: { enabled: false },
  privateNote: { enabled: false },
});

watch(
  () => deliveryConfigState.value.apiAccess?.enabled,
  (enabled) => {
    if (!enabled && meteringEnabled.value) {
      removeMetering();
    }
  }
);

function loadApp(app: AppItem) {
  appType.value = (app.appType as any) || "saas_web";
  newAppName.value = app.name || "";
  newAppSlug.value = app.slug || "";
  slugManuallyEdited.value = true;
  newAppDesc.value = app.description || "";
  newAppMediaUrl.value = app.mediaUrl || "";
  logoUrl.value = app.logoUrl || app.mediaUrl || "";
  appUrl.value = app.appUrl || "";
  brandColor.value = app.brandColor || "#0D9488";
  webhookUrl.value = app.webhookUrl || "";

  pricingType.value = (app.pricingType as any) || (app.billingPeriod ? "subscription" : "one_time");
  newAppPrice.value = app.targetPrice || 0;
  billingPeriod.value = (app.billingPeriod as any) || "monthly";
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

  returnUrl.value = app.redirectUrl || "";

  if (app.deliveryConfig) {
    deliveryConfigState.value = JSON.parse(JSON.stringify(app.deliveryConfig));
  } else {
    deliveryConfigState.value = {
      licenseKey: { enabled: true, maxSeats: 3, expiresInDays: 365, offlineGraceDays: 30 },
      fileDownload: { enabled: false },
      privateNote: { enabled: false },
    };
  }

  if (app.meteringConfig?.enabled) {
    meteringEnabled.value = true;
    meterTemplateId.value = app.meteringConfig.template || "custom";
    meterName.value = app.meteringConfig.name || "Metered Usage";
    meterEventName.value = app.meteringConfig.eventName || "usage";
    meterCalcType.value = (app.meteringConfig.calculationType as any) || "count";
    meterUnitLabel.value = app.meteringConfig.unitLabel || "units";
    meterFilters.value = app.meteringConfig.filters ? [...app.meteringConfig.filters] : [];
    meteringAggregation.value = app.meteringConfig.aggregation || "";
    meteringUnitPrice.value = String(app.meteringConfig.unitPrice || "0");
    meteringMetricUnit.value = (app.meteringConfig as any).metricUnit || "per unit";
    meteringFreeAllowance.value = (app.meteringConfig as any).freeAllowance || 0;
  } else {
    meteringEnabled.value = false;
  }
}

watch(
  () => props.initialApp,
  (app) => {
    if (app) {
      loadApp(app);
    } else {
      resetForm();
    }
  },
  { immediate: true }
);

async function handleSubmitProduct() {
  if (!newAppName.value || !newAppSlug.value) return;
  isCreating.value = true;
  createError.value = null;

  const meteringConfig: MeteringConfig | undefined = meteringEnabled.value
    ? {
        enabled: true,
        template: meterTemplateId.value,
        name: meterName.value,
        aggregation: meteringAggregation.value,
        eventName: meterEventName.value,
        calculationType: meterCalcType.value,
        unitLabel: meterUnitLabel.value,
        filters: meterFilters.value.filter(
          (f) => f.property.trim().length > 0 && f.value.trim().length > 0
        ),
        unitPrice: Number(meteringUnitPrice.value) || 0,
        metricUnit: meteringMetricUnit.value,
        freeAllowance: Number(meteringFreeAllowance.value) || 0,
      }
    : undefined;

  const payload: Record<string, any> = {
    name: newAppName.value,
    slug: newAppSlug.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
    mode: props.initialApp ? props.initialApp.mode : dashboardEnv.value,
    description: newAppDesc.value,
    mediaUrl: newAppMediaUrl.value || logoUrl.value || null,
    redirectUrl: returnUrl.value || null,
    appType: appType.value,
    brandColor: brandColor.value,
    logoUrl: logoUrl.value || null,
    appUrl: appUrl.value || null,
    webhookUrl: webhookUrl.value || null,
  };

  if (appType.value === "saas_web") {
    // Pure SaaS Payment Gateway: Dynamic pricing from backend S2S
    payload.targetPrice = 0;
    payload.pricingType = "one_time";
    payload.billingPeriod = null;
    payload.trialPeriodDays = 0;
    payload.valueProps = [];
    payload.deliveryConfig = {
      licenseKey: { enabled: false },
      fileDownload: { enabled: false },
      privateNote: { enabled: false },
    };
  } else {
    // Desktop / Plugin / On-Premise DRM
    payload.targetPrice = pricingType.value === "free" ? 0 : newAppPrice.value || 0;
    payload.pricingType = pricingType.value;
    payload.billingPeriod = pricingType.value === "subscription" ? billingPeriod.value : null;
    payload.trialPeriodDays =
      pricingType.value === "subscription" && hasTrialPeriod.value ? trialPeriodDays.value || 7 : 0;
    payload.valueProps = benefits.value.filter((b) => b.trim().length > 0);
    payload.deliveryConfig = deliveryConfigState.value;
    payload.meteringConfig = meteringConfig;
  }

  try {
    if (isEditMode.value && props.initialApp) {
      if (!props.updateFn) {
        throw new Error("Update handler belum didefinisikan.");
      }
      const data = await props.updateFn(props.initialApp.id, payload);
      if (data && (data.success || data.app)) {
        emit("updated");
      } else {
        createError.value = data?.error || "Gagal memperbarui aplikasi";
      }
    } else {
      const data = await props.createFn(payload);
      if (data && (data.success || data.app)) {
        resetForm();
        emit("created");
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
</script>

<template>
  <div class="space-y-6 animate-fadeIn">
    <!-- Unified Top Navigation & Header -->
    <div
      class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-jetblack/10 py-3 sm:py-3.5"
    >
      <div class="flex items-center gap-3">
        <button
          type="button"
          @click="emit('cancel')"
          class="p-2 rounded-lg bg-white border border-jetblack/10 hover:bg-jetblack/5 transition cursor-pointer text-jetblack shrink-0"
          title="Kembali ke Daftar Aplikasi"
        >
          <ArrowLeft class="w-4 h-4" />
        </button>

        <div
          v-if="initialApp"
          class="w-10 h-10 rounded-xl bg-jetblack/5 border border-jetblack/15 flex items-center justify-center font-bold text-sm shrink-0 overflow-hidden"
        >
          <img
            v-if="initialApp.logoUrl || initialApp.mediaUrl"
            :src="initialApp.logoUrl || initialApp.mediaUrl || ''"
            class="w-full h-full object-cover"
          />
          <span v-else>{{ initialApp.name.charAt(0) }}</span>
        </div>

        <div>
          <div class="flex items-center gap-2 flex-wrap">
            <h1 class="text-base font-bold text-jetblack leading-tight">
              {{ isEditMode ? `Pengaturan: ${initialApp?.name}` : "Daftarkan Proyek SaaS Baru" }}
            </h1>
            <span
              v-if="initialApp"
              class="text-[9px] px-2 py-0.5 rounded-full font-bold uppercase"
              :class="
                initialApp.appType === 'desktop_onprem'
                  ? 'bg-gold/15 text-[#8a6d1f]'
                  : 'bg-forest/10 text-forest'
              "
            >
              {{ initialApp.appType === "desktop_onprem" ? "💻 DRM" : "🚀 SaaS" }}
            </span>
            <span
              class="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full"
              :class="
                (initialApp ? initialApp.mode : dashboardEnv) === 'sandbox'
                  ? 'bg-amber-500/15 text-amber-700 border border-amber-500/30'
                  : 'bg-forest/10 text-forest border border-forest/20'
              "
            >
              Mode
              {{ (initialApp ? initialApp.mode : dashboardEnv) === "sandbox" ? "Sandbox" : "Live" }}
            </span>
          </div>

          <div
            v-if="initialApp"
            class="text-[11px] text-jetblack/50 font-mono flex items-center gap-1.5 mt-1 flex-wrap"
          >
            <button
              type="button"
              @click="handleCopyAppId(initialApp.id)"
              class="hover:text-forest transition inline-flex items-center gap-1 cursor-pointer bg-jetblack/5 hover:bg-jetblack/10 px-1.5 py-0.5 rounded"
              :title="`Salin App ID: ${initialApp.id}`"
            >
              <span>App ID: {{ initialApp.id }}</span>
              <Check v-if="copiedAppId" class="w-2.5 h-2.5 text-forest stroke-[3]" />
              <Copy v-else class="w-2.5 h-2.5 opacity-60" />
            </button>
            <span>•</span>
            <span>Slug: {{ initialApp.slug }}</span>
          </div>
          <p v-else class="text-xs text-jetblack/60 mt-1">
            Daftarkan identitas SaaS Anda untuk mulai memproses transaksi pembayaran.
          </p>
        </div>
      </div>

      <!-- Action Buttons: Batal & Simpan Pengaturan -->
      <div class="flex items-center gap-2 self-start sm:self-center shrink-0">
        <button
          type="button"
          @click="emit('cancel')"
          class="h-9 px-4 rounded-lg border border-jetblack/15 text-xs font-semibold text-jetblack/80 hover:text-jetblack hover:bg-jetblack/5 transition cursor-pointer"
        >
          Batal
        </button>
        <button
          type="button"
          @click="handleSubmitProduct"
          :disabled="isCreating || !newAppName || !newAppSlug"
          class="h-9 px-4 rounded-lg btn-gold text-xs font-bold transition shadow-xs disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5 active:scale-95"
        >
          <span>{{
            isCreating
              ? isEditMode
                ? "Menyimpan..."
                : "Mendaftarkan..."
              : isEditMode
                ? "Simpan Pengaturan"
                : "Simpan & Daftarkan"
          }}</span>
        </button>
      </div>
    </div>

    <!-- Error Banner -->
    <div
      v-if="createError"
      class="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-700 text-xs flex items-center justify-between"
    >
      <span>{{ createError }}</span>
      <button @click="createError = null" class="text-red-700/60 hover:text-red-700">
        <X class="w-3.5 h-3.5" />
      </button>
    </div>

    <!-- Two-column Layout: Form & Live Preview -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <!-- Left Column: Settings Form -->
      <div class="lg:col-span-8 space-y-6">
        <!-- 0. PILIHAN TIPE SOLUSI / PROJECT ARCHITECTURE -->
        <div class="p-4 rounded-xl bg-white border border-jetblack/15 shadow-xs space-y-3">
          <div>
            <h2
              class="text-xs font-bold uppercase tracking-wider text-jetblack flex items-center gap-2"
            >
              <span class="w-2 h-2 rounded-full bg-forest"></span>
              Tipe Solusi &amp; Model Integrasi
            </h2>
            <p class="text-[11px] text-jetblack/60 mt-0.5">
              Pilih model arsitektur aplikasi untuk menyesuaikan opsi pembayaran dan pengiriman.
            </p>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <!-- Option A: SaaS Web -->
            <div
              @click="appType = 'saas_web'"
              :class="[
                'p-3.5 rounded-xl border-2 cursor-pointer transition flex flex-col justify-between gap-3 relative',
                appType === 'saas_web'
                  ? 'border-forest bg-forest/[0.04] shadow-xs'
                  : 'border-jetblack/10 bg-white hover:border-jetblack/20',
              ]"
            >
              <div class="flex items-start justify-between">
                <div class="flex items-center gap-2.5">
                  <div
                    class="w-8 h-8 rounded-lg bg-forest/10 text-forest flex items-center justify-center font-bold text-sm"
                  >
                    🚀
                  </div>
                  <div>
                    <div class="text-xs font-bold text-jetblack">SaaS Web (Default)</div>
                    <span
                      class="text-[9px] font-bold px-1.5 py-0.2 rounded bg-forest/15 text-forest"
                      >Rekomendasi</span
                    >
                  </div>
                </div>
                <div
                  class="w-4 h-4 rounded-full border flex items-center justify-center"
                  :class="
                    appType === 'saas_web'
                      ? 'border-forest bg-forest text-white'
                      : 'border-jetblack/20'
                  "
                >
                  <Check v-if="appType === 'saas_web'" class="w-2.5 h-2.5 stroke-[3]" />
                </div>
              </div>
              <p class="text-[11px] text-jetblack/70 leading-relaxed">
                Payment Gateway in-app untuk Web App &amp; Layanan Online. Harga dinamis dikontrol
                langsung dari kodingan backend server Anda via API checkout S2S.
              </p>
            </div>

            <!-- Option B: Desktop / Plugin -->
            <div
              @click="appType = 'desktop_onprem'"
              :class="[
                'p-3.5 rounded-xl border-2 cursor-pointer transition flex flex-col justify-between gap-3 relative',
                appType === 'desktop_onprem'
                  ? 'border-gold bg-gold/[0.04] shadow-xs'
                  : 'border-jetblack/10 bg-white hover:border-jetblack/20',
              ]"
            >
              <div class="flex items-start justify-between">
                <div class="flex items-center gap-2.5">
                  <div
                    class="w-8 h-8 rounded-lg bg-gold/15 text-gold flex items-center justify-center font-bold text-sm"
                  >
                    💻
                  </div>
                  <div>
                    <div class="text-xs font-bold text-jetblack">Desktop / Plugin</div>
                    <span
                      class="text-[9px] font-bold px-1.5 py-0.2 rounded bg-gold/20 text-[#8a6d1f]"
                      >Software DRM</span
                    >
                  </div>
                </div>
                <div
                  class="w-4 h-4 rounded-full border flex items-center justify-center"
                  :class="
                    appType === 'desktop_onprem'
                      ? 'border-gold bg-gold text-white'
                      : 'border-jetblack/20'
                  "
                >
                  <Check v-if="appType === 'desktop_onprem'" class="w-2.5 h-2.5 stroke-[3]" />
                </div>
              </div>
              <p class="text-[11px] text-jetblack/70 leading-relaxed">
                Distribusi software dengan serial lisensi unik (<code class="font-mono text-[10px]"
                  >TT-XXXX</code
                >), token offline Ed25519, dan validasi hardware ID (HWID).
              </p>
            </div>
          </div>
        </div>

        <!-- ============================================== -->
        <!-- VIEW: SAAS WEB FORM (Modern & Sleek MoR Gateway) -->
        <!-- ============================================== -->
        <template v-if="appType === 'saas_web'">
          <!-- 1. IDENTITAS SAAS & BRANDING -->
          <div class="p-4 rounded-xl bg-white border border-jetblack/15 shadow-xs space-y-4">
            <div class="border-b border-jetblack/10 pb-3">
              <div class="flex items-center gap-2">
                <div class="w-2 h-2 rounded-full bg-forest"></div>
                <h2 class="text-xs font-bold uppercase tracking-wider text-jetblack">
                  Identitas SaaS &amp; Branding
                </h2>
              </div>
              <p class="text-[11px] text-jetblack/60 mt-0.5">
                Atur nama produk, domain, dan palet warna yang akan tampil di modal pop-up Tertaut
                Snap.
              </p>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label class="block text-[11px] font-bold text-jetblack/70 mb-1"
                  >Nama SaaS / Aplikasi <span class="text-red-500">*</span></label
                >
                <input
                  v-model="newAppName"
                  type="text"
                  placeholder="Contoh: DevDocs Pro"
                  class="w-full px-3 py-2 rounded-lg bg-white border border-jetblack/15 text-xs text-jetblack placeholder:text-jetblack/35 focus:outline-none focus:border-forest"
                />
              </div>

              <div>
                <label class="block text-[11px] font-bold text-jetblack/70 mb-1"
                  >App Slug / Identifier <span class="text-red-500">*</span></label
                >
                <input
                  v-model="newAppSlug"
                  @input="slugManuallyEdited = true"
                  type="text"
                  placeholder="devdocs-pro"
                  class="w-full px-3 py-2 rounded-lg bg-white border border-jetblack/15 text-xs text-jetblack font-mono placeholder:text-jetblack/35 focus:outline-none focus:border-forest"
                />
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label class="block text-[11px] font-bold text-jetblack/70 mb-1"
                  >URL Aplikasi / Domain SaaS Anda</label
                >
                <div class="relative">
                  <input
                    v-model="appUrl"
                    type="url"
                    placeholder="https://devdocs.io"
                    class="w-full pl-8 pr-3 py-2 rounded-lg bg-white border border-jetblack/15 text-xs text-jetblack placeholder:text-jetblack/35 focus:outline-none focus:border-forest"
                  />
                  <Globe class="w-3.5 h-3.5 text-jetblack/40 absolute left-2.5 top-2.5" />
                </div>
              </div>

              <div>
                <label class="block text-[11px] font-bold text-jetblack/70 mb-1"
                  >URL Logo / Ikon Persegi</label
                >
                <div class="relative">
                  <input
                    v-model="logoUrl"
                    type="url"
                    placeholder="https://devdocs.io/logo.png"
                    class="w-full pl-8 pr-3 py-2 rounded-lg bg-white border border-jetblack/15 text-xs text-jetblack placeholder:text-jetblack/35 focus:outline-none focus:border-forest"
                  />
                  <ShieldCheck class="w-3.5 h-3.5 text-jetblack/40 absolute left-2.5 top-2.5" />
                </div>
              </div>
            </div>

            <!-- Brand Color Picker -->
            <div>
              <label class="block text-[11px] font-bold text-jetblack/70 mb-1.5"
                >Warna Tema Modal (Brand Color)</label
              >
              <div class="flex items-center gap-3">
                <div class="flex items-center gap-1.5">
                  <button
                    v-for="color in brandColorPresets"
                    :key="color"
                    type="button"
                    @click="brandColor = color"
                    :style="{ backgroundColor: color }"
                    class="w-6 h-6 rounded-full border border-black/10 cursor-pointer transition hover:scale-110 flex items-center justify-center"
                  >
                    <Check v-if="brandColor === color" class="w-3 h-3 text-white stroke-[3]" />
                  </button>
                </div>
                <div
                  class="flex items-center gap-1.5 border border-jetblack/15 rounded-lg px-2 py-1 bg-white"
                >
                  <input
                    v-model="brandColor"
                    type="color"
                    class="w-5 h-5 rounded cursor-pointer border-0 bg-transparent p-0"
                  />
                  <input
                    v-model="brandColor"
                    type="text"
                    placeholder="#0D9488"
                    class="w-20 text-[11px] font-mono text-jetblack border-0 focus:outline-none uppercase"
                  />
                </div>
              </div>
            </div>

            <div>
              <label class="block text-[11px] font-bold text-jetblack/70 mb-1"
                >Deskripsi Singkat SaaS</label
              >
              <textarea
                v-model="newAppDesc"
                rows="2"
                placeholder="Platform dokumentasi API instan untuk engineer modern..."
                class="w-full px-3 py-2 rounded-lg bg-white border border-jetblack/15 text-xs text-jetblack placeholder:text-jetblack/35 focus:outline-none focus:border-forest resize-none"
              ></textarea>
            </div>
          </div>

          <!-- 2. INTEGRASI PEMBAYARAN & WEBHOOK -->
          <div class="p-4 rounded-xl bg-white border border-jetblack/15 shadow-xs space-y-4">
            <div class="border-b border-jetblack/10 pb-3">
              <div class="flex items-center gap-2">
                <div class="w-2 h-2 rounded-full bg-forest"></div>
                <h2 class="text-xs font-bold uppercase tracking-wider text-jetblack">
                  Integrasi Pembayaran &amp; Webhook
                </h2>
              </div>
              <p class="text-[11px] text-jetblack/60 mt-0.5">
                Konfigurasi URL callback agar server SaaS Anda menerima notifikasi instan saat
                pembayaran berhasil.
              </p>
            </div>

            <!-- Dynamic Pricing Notice Callout -->
            <div
              class="p-3.5 rounded-xl bg-forest/[0.06] border border-forest/20 text-forest space-y-1"
            >
              <div class="flex items-center gap-1.5 font-bold text-xs">
                <Info class="w-4 h-4 shrink-0" />
                <span>Harga Dinamis Fleksibel (Code-Driven Pricing)</span>
              </div>
              <p class="text-[11px] text-jetblack/80 leading-relaxed">
                Anda tidak perlu mengunci harga statis di dashboard ini. Nominal pembayaran
                ditentukan secara dinamis melalui parameter
                <code class="bg-forest/10 px-1 py-0.5 rounded font-mono text-[10px] font-bold"
                  >amount</code
                >
                saat server backend Anda memanggil endpoint
                <code class="bg-forest/10 px-1 py-0.5 rounded font-mono text-[10px] font-bold"
                  >/api/v1/checkout/session</code
                >.
              </p>
            </div>

            <div>
              <label class="block text-[11px] font-bold text-jetblack/70 mb-1"
                >Webhook URL (Endpoint Server Anda)</label
              >
              <input
                v-model="webhookUrl"
                type="url"
                placeholder="https://devdocs.io/api/webhooks/tertaut"
                class="w-full px-3 py-2 rounded-lg bg-white border border-jetblack/15 text-xs text-jetblack font-mono placeholder:text-jetblack/35 focus:outline-none focus:border-forest"
              />
              <span class="text-[10px] text-jetblack/50 mt-1 block">
                Tertaut akan mem-POST event
                <code class="font-mono text-[10px]">payment.succeeded</code> bertanda tangan
                HMAC-SHA256 (<code class="font-mono text-[10px]">tt-signature</code>) ke endpoint
                ini.
              </span>
            </div>

            <div>
              <label class="block text-[11px] font-bold text-jetblack/70 mb-1"
                >Return / Redirect URL (Paska Transaksi)</label
              >
              <input
                v-model="returnUrl"
                type="url"
                placeholder="https://devdocs.io/dashboard?payment=success"
                class="w-full px-3 py-2 rounded-lg bg-white border border-jetblack/15 text-xs text-jetblack placeholder:text-jetblack/35 focus:outline-none focus:border-forest"
              />
              <span class="text-[10px] text-jetblack/50 mt-1 block">
                Halaman tujuan pembeli jika menggunakan mode pengalihan (redirect) alih-alih modal
                pop-up.
              </span>
            </div>
          </div>

          <!-- 3. QUICK START INTEGRASI CODE SNIPPET -->
          <div class="p-4 rounded-xl bg-white border border-jetblack/15 shadow-xs space-y-3">
            <div class="flex items-center justify-between border-b border-jetblack/10 pb-2.5">
              <div class="flex items-center gap-2">
                <Terminal class="w-4 h-4 text-forest" />
                <h2 class="text-xs font-bold uppercase tracking-wider text-jetblack">
                  Contoh Integrasi Cepat (Quick Start)
                </h2>
              </div>
              <span class="text-[10px] text-forest font-bold bg-forest/10 px-2 py-0.5 rounded-full">
                S2S + In-App Modal
              </span>
            </div>

            <div class="space-y-3 text-xs">
              <!-- Step 1 -->
              <div>
                <div class="text-[11px] font-bold text-jetblack mb-1">
                  1. Server Backend Anda (Buat Checkout Session):
                </div>
                <div
                  class="bg-jetblack text-white/90 p-3 rounded-lg font-mono text-[10px] overflow-x-auto leading-relaxed"
                >
                  <span class="text-emerald-400">const</span> res =
                  <span class="text-emerald-400">await</span> fetch(<span class="text-amber-300"
                    >"https://api.tertaut.com/api/v1/checkout/session"</span
                  >, &#123;<br />
                  &nbsp;&nbsp;method: <span class="text-amber-300">"POST"</span>,<br />
                  &nbsp;&nbsp;headers: &#123; <span class="text-amber-300">"Authorization"</span>:
                  <span class="text-amber-300">`Bearer ${TERTAUT_SECRET_KEY}`</span>,
                  <span class="text-amber-300">"Content-Type"</span>:
                  <span class="text-amber-300">"application/json"</span> &#125;,<br />
                  &nbsp;&nbsp;body: JSON.stringify(&#123; appId:
                  <span class="text-amber-300">"{{ newAppSlug || "app_id" }}"</span>, amount:
                  <span class="text-purple-300">99000</span>, orderId:
                  <span class="text-amber-300">"INV-101"</span> &#125;)<br />
                  &#125;);<br />
                  <span class="text-emerald-400">const</span> &#123; snapToken &#125; =
                  <span class="text-emerald-400">await</span> res.json();
                </div>
              </div>

              <!-- Step 2 -->
              <div>
                <div class="text-[11px] font-bold text-jetblack mb-1">
                  2. Web Frontend Anda (Tampilkan Pop-up):
                </div>
                <div
                  class="bg-jetblack text-white/90 p-3 rounded-lg font-mono text-[10px] overflow-x-auto leading-relaxed"
                >
                  &lt;<span class="text-emerald-400">script</span> src=<span class="text-amber-300"
                    >"https://tertaut.com/snap/checkout.js"</span
                  >&gt;&lt;/<span class="text-emerald-400">script</span>&gt;<br />
                  Tertaut.open(&#123; snapToken &#125;);
                </div>
              </div>
            </div>
          </div>
        </template>

        <!-- ============================================== -->
        <!-- VIEW: DESKTOP / ON-PREMISE FORM (Classic DRM) -->
        <!-- ============================================== -->
        <template v-else>
          <!-- 1. DETAIL PRODUK -->
          <div class="space-y-4">
            <div class="border-b border-jetblack/10 pb-3">
              <div class="flex items-center gap-2">
                <div class="w-2 h-2 rounded-full bg-gold"></div>
                <h2 class="text-xs font-bold uppercase tracking-wider text-jetblack">
                  Detail Software / Plugin
                </h2>
              </div>
              <p class="text-[11px] text-jetblack/60 mt-0.5">
                Identitas software desktop, script, add-on, atau aplikasi on-premise.
              </p>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label class="block text-[11px] font-bold text-jetblack/70 mb-1"
                  >Nama Produk <span class="text-red-500">*</span></label
                >
                <input
                  v-model="newAppName"
                  type="text"
                  placeholder="Contoh: SuperPrompt Studio"
                  class="w-full px-3 py-2 rounded-lg bg-white border border-jetblack/15 text-xs text-jetblack placeholder:text-jetblack/35 focus:outline-none focus:border-gold"
                />
              </div>
              <div>
                <label class="block text-[11px] font-bold text-jetblack/70 mb-1"
                  >Slug URL <span class="text-red-500">*</span></label
                >
                <input
                  v-model="newAppSlug"
                  @input="slugManuallyEdited = true"
                  type="text"
                  placeholder="superprompt-studio"
                  class="w-full px-3 py-2 rounded-lg bg-white border border-jetblack/15 text-xs text-jetblack font-mono placeholder:text-jetblack/35 focus:outline-none focus:border-gold"
                />
              </div>
            </div>

            <div>
              <label class="block text-[11px] font-bold text-jetblack/70 mb-1"
                >Deskripsi Singkat</label
              >
              <textarea
                v-model="newAppDesc"
                rows="2"
                placeholder="Jelaskan nilai utama atau fungsi software dalam 1-2 kalimat..."
                class="w-full px-3 py-2 rounded-lg bg-white border border-jetblack/15 text-xs text-jetblack placeholder:text-jetblack/35 focus:outline-none focus:border-gold resize-none"
              ></textarea>
            </div>

            <div>
              <label class="block text-[11px] font-bold text-jetblack/70 mb-1"
                >URL Ikon / Sampul (Opsional)</label
              >
              <input
                v-model="newAppMediaUrl"
                type="url"
                placeholder="https://images.unsplash.com/photo-..."
                class="w-full px-3 py-2 rounded-lg bg-white border border-jetblack/15 text-xs text-jetblack placeholder:text-jetblack/35 focus:outline-none focus:border-gold"
              />
            </div>
          </div>

          <!-- 2. MANFAAT PRODUK (BENEFITS) -->
          <AppBenefitsForm v-model="benefits" />

          <!-- 3. PENETAPAN HARGA -->
          <AppPricingSection
            v-model:pricingType="pricingType"
            v-model:price="newAppPrice"
            v-model:billingPeriod="billingPeriod"
            v-model:customBillingDays="customBillingDays"
            v-model:hasTrialPeriod="hasTrialPeriod"
            v-model:trialPeriodDays="trialPeriodDays"
          />

          <!-- 4. PENGIRIMAN DIGITAL (DELIVERY CONFIG) -->
          <AppDeliverySection
            v-model="deliveryConfigState"
            :meteringEnabled="meteringEnabled"
            :meterName="meterName"
            :meterAggregation="meteringAggregation"
            :meteringUnitPrice="meteringUnitPrice"
            :meteringMetricUnit="meteringMetricUnit"
            :meteringFreeAllowance="meteringFreeAllowance"
            @openMeteringModal="isMeteringModalOpen = true"
            @removeMetering="removeMetering"
          />

          <!-- 5. ALUR CHECKOUT & RETENSI -->
          <div class="space-y-4">
            <div class="border-b border-jetblack/10 pb-3">
              <div class="flex items-center gap-2">
                <div class="w-2 h-2 rounded-full bg-gold"></div>
                <h2 class="text-xs font-bold uppercase tracking-wider text-jetblack">
                  Alur Checkout &amp; Retensi
                </h2>
              </div>
              <p class="text-[11px] text-jetblack/60 mt-0.5">
                Tautan pengalihan paska bayar dan otomatisasi tindak lanjut calon pembeli.
              </p>
            </div>

            <div>
              <label class="block text-[11px] font-bold text-jetblack/70 mb-1"
                >Return / Success URL (Opsional)</label
              >
              <input
                v-model="returnUrl"
                type="url"
                placeholder="https://aplikasianda.com/welcome?success=true"
                class="w-full px-3 py-2 rounded-lg bg-white border border-jetblack/15 text-xs text-jetblack placeholder:text-jetblack/35 focus:outline-none focus:border-gold"
              />
            </div>
          </div>
        </template>

        <!-- Danger Zone: Delete Project (Only in Edit Mode) -->
        <div
          v-if="isEditMode && initialApp"
          class="p-4 rounded-xl border border-rose-200 bg-rose-50/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-4"
        >
          <div>
            <div class="text-xs font-bold text-rose-900 flex items-center gap-1.5">
              <Trash2 class="w-3.5 h-3.5 text-rose-600" />
              <span>Zona Bahaya: Hapus Project</span>
            </div>
            <p class="text-[11px] text-rose-700/80 mt-0.5">
              Hapus project "{{ initialApp.name }}" secara permanen beserta seluruh pengaturannya.
            </p>
          </div>
          <button
            type="button"
            @click="emit('delete', initialApp)"
            class="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs shrink-0"
          >
            <Trash2 class="w-3.5 h-3.5" />
            <span>Hapus Project</span>
          </button>
        </div>
      </div>

      <!-- Right Column: Live Preview Card -->
      <div class="lg:col-span-4">
        <AppLivePreviewCard
          :appName="newAppName"
          :appDesc="newAppDesc"
          :mediaUrl="newAppMediaUrl || logoUrl"
          :pricingType="pricingType"
          :price="newAppPrice"
          :billingPeriodDisplay="billingPeriodDisplay"
          :hasTrialPeriod="hasTrialPeriod"
          :trialPeriodDays="trialPeriodDays"
          :benefits="benefits"
          :meteringEnabled="meteringEnabled"
          :meteringAggregation="meteringAggregation"
          :meteringUnitPrice="meteringUnitPrice"
          :meteringMetricUnit="meteringMetricUnit"
          :dashboardEnv="initialApp ? initialApp.mode : dashboardEnv"
          :isCreating="isCreating"
          :canPublish="Boolean(newAppName && newAppSlug)"
          :actionLabel="isEditMode ? 'Simpan Pengaturan' : 'Simpan & Daftarkan'"
          :appType="appType"
          :brandColor="brandColor"
          :logoUrl="logoUrl"
          :appUrl="appUrl"
          :webhookUrl="webhookUrl"
          :returnUrl="returnUrl"
          @publish="handleSubmitProduct"
        />
      </div>
    </div>

    <!-- Usage-based Pricing Modal -->
    <AppMeteringModal
      v-model="isMeteringModalOpen"
      :initialTemplateId="meterTemplateId"
      :initialName="meterName"
      :initialEventName="meterEventName"
      :initialCalcType="meterCalcType"
      :initialUnitLabel="meterUnitLabel"
      :initialFilters="meterFilters"
      :initialUnitPrice="meteringUnitPrice"
      :initialMetricUnit="meteringMetricUnit"
      :initialFreeAllowance="meteringFreeAllowance"
      @apply="handleMeteringApply"
    />
  </div>
</template>
