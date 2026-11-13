<script setup lang="ts">
import { computed } from "vue";
import { formatRupiah } from "../../lib/utils";
import type { AppCapabilityMode, PricingStrategy } from "../../lib/appCapability";
import {
  Check,
  Sparkles,
  RefreshCw,
  Globe,
  Webhook,
  Palette,
  Layers,
  Terminal,
  KeyRound,
  CreditCard,
  Zap,
} from "lucide-vue-next";

const props = withDefaults(
  defineProps<{
    appName: string;
    appSlug?: string;
    appDesc: string;
    mediaUrl?: string | null;
    pricingType?: "one_time" | "subscription" | "free";
    price?: number;
    billingPeriodDisplay?: string;
    hasTrialPeriod?: boolean;
    trialPeriodDays?: number;
    benefits?: string[];
    dashboardEnv: "sandbox" | "live";
    isCreating: boolean;
    canPublish: boolean;
    actionLabel?: string;
    appType?: "saas_web" | "desktop_onprem";
    capabilityMode?: AppCapabilityMode;
    pricingStrategy?: PricingStrategy;
    maxSeats?: number;
    expiresInDays?: number;
    brandColor?: string;
    logoUrl?: string;
    appUrl?: string;
    webhookUrl?: string;
    returnUrl?: string;
  }>(),
  {
    pricingType: "subscription",
    price: 49000,
    billingPeriodDisplay: "/ Bulan",
    hasTrialPeriod: false,
    trialPeriodDays: 7,
    benefits: () => [],
    appType: "saas_web",
    brandColor: "#0D9488",
  }
);

const emit = defineEmits<{
  publish: [];
}>();

const capabilityMeta = computed(() => {
  if (props.capabilityMode === "license_only") {
    return { label: "Lisensi", icon: KeyRound, cls: "text-amber-700" };
  }
  if (props.capabilityMode === "payment_only") {
    return { label: "Pembayaran", icon: CreditCard, cls: "text-emerald-700" };
  }
  return { label: "Bayar + Lisensi", icon: Zap, cls: "text-[#8a6d1f]" };
});

const showsPayment = computed(
  () => !props.capabilityMode || props.capabilityMode !== "license_only"
);
const showsLicense = computed(
  () => props.capabilityMode === "license_only" || props.capabilityMode === "both"
);
const isDynamicStrategy = computed(() =>
  props.pricingStrategy ? props.pricingStrategy === "dynamic" : props.appType === "saas_web"
);
</script>

<template>
  <div class="sticky top-6 divide-y divide-jetblack/10">
    <!-- Header Ringkasan -->
    <div class="pb-3 flex items-center justify-between gap-2">
      <div class="flex items-center gap-2">
        <span class="w-2 h-2 rounded-full bg-forest"></span>
        <span class="text-[11px] font-bold uppercase tracking-wider text-jetblack/75">
          Ringkasan Konfigurasi
        </span>
      </div>
      <span
        class="text-[10px] font-mono tracking-wider uppercase font-bold px-2 py-0.5 rounded-full border"
        :class="
          dashboardEnv === 'sandbox'
            ? 'bg-amber-50 text-amber-800 border-amber-200'
            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
        "
      >
        {{ dashboardEnv }}
      </span>
    </div>

    <!-- Identitas -->
    <div class="py-4 flex items-start gap-3">
      <div
        class="w-11 h-11 rounded-lg border border-jetblack/10 flex items-center justify-center overflow-hidden shrink-0 font-black text-sm"
        :style="{
          backgroundColor: brandColor ? `${brandColor}15` : '#0D948815',
          color: brandColor || '#0D9488',
        }"
      >
        <img
          v-if="logoUrl || mediaUrl"
          :src="logoUrl || mediaUrl || ''"
          class="w-full h-full object-cover"
        />
        <span v-else>{{ appName ? appName.charAt(0).toUpperCase() : "A" }}</span>
      </div>
      <div class="overflow-hidden min-w-0">
        <div class="text-xs font-extrabold text-jetblack truncate tracking-tight">
          {{ appName || "Nama Aplikasi" }}
        </div>
        <div
          v-if="appSlug"
          class="text-[10.5px] font-mono tracking-wider text-jetblack/50 truncate"
        >
          /{{ appSlug }}
        </div>
        <div class="text-[11px] text-jetblack/60 line-clamp-2 mt-0.5">
          {{ appDesc || "Belum ada deskripsi." }}
        </div>
      </div>
    </div>

    <!-- Ringkasan Mode Quick Create (Capability-aware) -->
    <template v-if="capabilityMode">
      <div class="py-4 space-y-2.5 text-[11px]">
        <div class="flex items-center justify-between">
          <span class="text-jetblack/60 flex items-center gap-1.5">
            <Layers class="w-3.5 h-3.5 text-jetblack/40" />
            Kebutuhan
          </span>
          <span class="inline-flex items-center gap-1 font-bold" :class="capabilityMeta.cls">
            <component :is="capabilityMeta.icon" class="w-3.5 h-3.5" />
            {{ capabilityMeta.label }}
          </span>
        </div>

        <div v-if="showsLicense" class="flex items-center justify-between">
          <span class="text-jetblack/60 flex items-center gap-1.5">
            <KeyRound class="w-3.5 h-3.5 text-jetblack/40" />
            Lisensi
          </span>
          <span class="font-semibold text-amber-800">Aktif (via Kelola Lisensi)</span>
        </div>

        <div v-if="returnUrl" class="flex items-center justify-between">
          <span class="text-jetblack/60 flex items-center gap-1.5">
            <Globe class="w-3.5 h-3.5 text-jetblack/40" />
            Return URL
          </span>
          <span class="font-mono text-[10.5px] text-jetblack truncate max-w-[155px]">
            {{ returnUrl }}
          </span>
        </div>
      </div>

      <div v-if="showsPayment" class="py-4 space-y-1">
        <div class="text-[10.5px] font-bold uppercase tracking-wider text-jetblack/50">Harga</div>
        <div v-if="isDynamicStrategy" class="flex items-center justify-between text-xs pt-0.5">
          <span class="font-bold text-jetblack flex items-center gap-1.5">
            <Terminal class="w-3.5 h-3.5 text-forest" />
            Dinamis S2S
          </span>
          <span class="font-mono text-[10.5px] text-jetblack/60">via API</span>
        </div>
        <template v-else>
          <div class="flex items-baseline justify-between gap-2">
            <span class="text-xl font-black text-jetblack font-mono tracking-wider">
              {{ pricingType === "free" ? "Gratis" : price ? formatRupiah(price) : "Rp 0" }}
            </span>
            <span class="text-[11px] font-semibold text-jetblack/60">
              {{
                pricingType === "subscription"
                  ? billingPeriodDisplay
                  : pricingType === "free"
                    ? "Gratis"
                    : "Sekali Bayar"
              }}
            </span>
          </div>
          <div
            v-if="pricingType === 'subscription' && hasTrialPeriod"
            class="text-[11px] text-forest font-bold flex items-center gap-1 pt-1"
          >
            <Sparkles class="w-3 h-3 text-gold" />
            <span>{{ trialPeriodDays }} Hari Trial</span>
          </div>
        </template>
      </div>
    </template>

    <!-- Edit Mode Preview: Spesifikasi SaaS Web -->
    <div v-else-if="appType === 'saas_web'" class="py-4 space-y-2 text-[11px]">
      <div class="flex items-center justify-between">
        <span class="text-jetblack/60 flex items-center gap-1.5">
          <Layers class="w-3.5 h-3.5 text-jetblack/40" />
          Solusi
        </span>
        <span class="font-bold text-forest">SaaS Web</span>
      </div>

      <div class="flex items-center justify-between">
        <span class="text-jetblack/60 flex items-center gap-1.5">
          <Terminal class="w-3.5 h-3.5 text-jetblack/40" />
          Harga
        </span>
        <span class="font-bold text-jetblack">Dinamis S2S</span>
      </div>

      <div class="flex items-center justify-between">
        <span class="text-jetblack/60 flex items-center gap-1.5">
          <Globe class="w-3.5 h-3.5 text-jetblack/40" />
          Domain
        </span>
        <span class="font-mono text-[10.5px] text-jetblack truncate max-w-[150px]">
          {{ appUrl || "-" }}
        </span>
      </div>

      <div class="flex items-center justify-between">
        <span class="text-jetblack/60 flex items-center gap-1.5">
          <Webhook class="w-3.5 h-3.5 text-jetblack/40" />
          Webhook
        </span>
        <span class="font-mono text-[10.5px] text-jetblack truncate max-w-[150px]">
          {{ webhookUrl || "-" }}
        </span>
      </div>

      <div class="flex items-center justify-between">
        <span class="text-jetblack/60 flex items-center gap-1.5">
          <Palette class="w-3.5 h-3.5 text-jetblack/40" />
          Warna
        </span>
        <span class="inline-flex items-center gap-1.5 font-mono text-[10.5px] text-jetblack">
          <span
            class="w-3 h-3 rounded-full border border-black/10 shrink-0"
            :style="{ backgroundColor: brandColor || '#0D9488' }"
          ></span>
          {{ brandColor || "#0D9488" }}
        </span>
      </div>
    </div>

    <!-- Edit Mode Preview: Benefits & Fixed Price -->
    <template v-else>
      <div class="py-4 space-y-1.5 text-xs">
        <div class="text-[10.5px] font-bold uppercase tracking-wider text-jetblack/50">Manfaat</div>
        <div v-if="benefits.length > 0" class="space-y-1">
          <div v-for="(b, idx) in benefits" :key="idx" class="flex items-center gap-2 text-[11px]">
            <Check class="w-3 h-3 text-forest shrink-0 stroke-[3]" />
            <span class="truncate">{{ b }}</span>
          </div>
        </div>
        <div v-else class="text-jetblack/45 text-[11px]">Belum ada manfaat.</div>
      </div>

      <div class="py-4 space-y-1">
        <div class="text-[10.5px] font-bold uppercase tracking-wider text-jetblack/50">Harga</div>
        <div class="flex items-baseline justify-between gap-2">
          <span class="text-xl font-black text-jetblack font-mono tracking-wider">
            {{ pricingType === "free" ? "Gratis" : price ? formatRupiah(price) : "Rp 0" }}
          </span>
          <span class="text-[11px] font-semibold text-jetblack/60">
            {{
              pricingType === "subscription"
                ? billingPeriodDisplay
                : pricingType === "free"
                  ? "Gratis"
                  : "Sekali Bayar"
            }}
          </span>
        </div>

        <div
          v-if="pricingType === 'subscription' && hasTrialPeriod"
          class="text-[11px] text-forest font-bold flex items-center gap-1 pt-1"
        >
          <Sparkles class="w-3 h-3 text-gold" />
          <span>{{ trialPeriodDays }} Hari Trial</span>
        </div>
      </div>
    </template>

    <!-- Status + Action -->
    <div class="pt-4 space-y-3">
      <div class="flex items-center justify-between text-[11px] font-semibold">
        <span class="flex items-center gap-1.5 text-jetblack">
          <span
            class="w-2 h-2 rounded-full"
            :class="dashboardEnv === 'sandbox' ? 'bg-amber-500' : 'bg-emerald-500'"
          ></span>
          Lingkungan {{ dashboardEnv === "sandbox" ? "Sandbox" : "Live" }}
        </span>
        <span class="text-forest font-bold">Siap</span>
      </div>

      <button
        type="button"
        @click="emit('publish')"
        :disabled="isCreating || !canPublish"
        class="w-full py-2.5 rounded-lg btn-gold text-xs font-bold shadow-2xs hover:scale-[1.02] active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 cursor-pointer flex items-center justify-center gap-2"
      >
        <RefreshCw v-if="isCreating" class="w-3.5 h-3.5 animate-spin" />
        <span>{{ isCreating ? "Menyimpan..." : actionLabel || "Simpan" }}</span>
      </button>
    </div>
  </div>
</template>
