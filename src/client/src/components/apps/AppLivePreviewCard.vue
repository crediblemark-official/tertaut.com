<script setup lang="ts">
import { formatRupiah } from "../../lib/utils";
import {
  Image as ImageIcon,
  Check,
  Sparkles,
  RefreshCw,
  Globe,
  Webhook,
  Palette,
  ExternalLink,
  ShieldCheck,
  Layers,
  Terminal,
} from "lucide-vue-next";

const props = withDefaults(
  defineProps<{
    appName: string;
    appDesc: string;
    mediaUrl?: string | null;
    pricingType?: "one_time" | "subscription" | "free";
    price?: number;
    billingPeriodDisplay?: string;
    hasTrialPeriod?: boolean;
    trialPeriodDays?: number;
    benefits?: string[];
    meteringEnabled?: boolean;
    meteringAggregation?: string;
    meteringUnitPrice?: string | number;
    meteringMetricUnit?: string;
    dashboardEnv: "sandbox" | "live";
    isCreating: boolean;
    canPublish: boolean;
    actionLabel?: string;
    appType?: "saas_web" | "desktop_onprem";
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
    meteringEnabled: false,
    appType: "saas_web",
    brandColor: "#0D9488",
  }
);

const emit = defineEmits<{
  publish: [];
}>();
</script>

<template>
  <div class="space-y-4 sticky top-6">
    <!-- Header Ringkasan -->
    <div class="border-b border-jetblack/10 pb-3">
      <div class="flex items-center gap-2">
        <div class="w-2 h-2 rounded-full bg-forest"></div>
        <h2 class="text-xs font-bold uppercase tracking-wider text-jetblack">
          Ringkasan Konfigurasi
        </h2>
      </div>
      <p class="text-[11px] text-jetblack/60 mt-0.5">
        Ringkasan data identitas dan integrasi aplikasi Anda sebelum disimpan.
      </p>
    </div>

    <!-- Main Summary Card -->
    <div class="p-4 rounded-xl bg-white border border-jetblack/10 shadow-xs space-y-4">
      <!-- Identitas Aplikasi -->
      <div
        class="flex items-start gap-3 p-3 rounded-lg bg-jetblack/[0.02] border border-jetblack/10"
      >
        <div
          class="w-12 h-12 rounded-lg border border-jetblack/10 flex items-center justify-center overflow-hidden shrink-0 font-black text-sm"
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
          <div class="text-xs font-bold text-jetblack truncate">
            {{ appName || "Nama Aplikasi Belum Diset" }}
          </div>
          <div class="text-[11px] text-jetblack/60 line-clamp-2 mt-0.5">
            {{ appDesc || "Belum ada deskripsi yang ditambahkan." }}
          </div>
        </div>
      </div>

      <!-- Tipe Spesifik: SAAS WEB -->
      <div v-if="appType === 'saas_web'" class="space-y-2.5 text-xs">
        <div class="text-[10px] uppercase font-bold text-jetblack/50 tracking-wider">
          Spesifikasi Integrasi SaaS
        </div>

        <div class="p-3 rounded-lg bg-jetblack/[0.02] border border-jetblack/10 space-y-2">
          <!-- Model Arsitektur -->
          <div class="flex items-center justify-between text-[11px]">
            <span class="text-jetblack/60 flex items-center gap-1.5">
              <Layers class="w-3.5 h-3.5 text-jetblack/40" />
              Tipe Solusi:
            </span>
            <span class="font-bold text-forest">SaaS Web (MoR)</span>
          </div>

          <!-- Model Pricing -->
          <div class="flex items-center justify-between text-[11px]">
            <span class="text-jetblack/60 flex items-center gap-1.5">
              <Terminal class="w-3.5 h-3.5 text-jetblack/40" />
              Penetapan Harga:
            </span>
            <span class="font-bold text-jetblack">Dinamis via Backend S2S</span>
          </div>

          <!-- Domain / App URL -->
          <div
            class="flex items-center justify-between text-[11px] pt-1.5 border-t border-jetblack/5"
          >
            <span class="text-jetblack/60 flex items-center gap-1.5">
              <Globe class="w-3.5 h-3.5 text-jetblack/40" />
              Domain / Web:
            </span>
            <span class="font-mono text-[10px] text-jetblack truncate max-w-[140px]">
              {{ appUrl || "Belum diatur" }}
            </span>
          </div>

          <!-- Webhook Callback -->
          <div class="flex items-center justify-between text-[11px]">
            <span class="text-jetblack/60 flex items-center gap-1.5">
              <Webhook class="w-3.5 h-3.5 text-jetblack/40" />
              Webhook S2S:
            </span>
            <span class="font-mono text-[10px] text-jetblack truncate max-w-[140px]">
              {{ webhookUrl || "Belum diatur" }}
            </span>
          </div>

          <!-- Brand Accent Color -->
          <div class="flex items-center justify-between text-[11px]">
            <span class="text-jetblack/60 flex items-center gap-1.5">
              <Palette class="w-3.5 h-3.5 text-jetblack/40" />
              Warna Brand:
            </span>
            <div class="flex items-center gap-1.5 font-mono text-[10px] text-jetblack">
              <span
                class="w-3 h-3 rounded-full border border-black/10 shrink-0"
                :style="{ backgroundColor: brandColor || '#0D9488' }"
              ></span>
              <span>{{ brandColor || "#0D9488" }}</span>
            </div>
          </div>
        </div>

        <div
          class="p-2.5 rounded-lg bg-forest/5 border border-forest/15 text-[11px] text-jetblack/70 flex items-start gap-2"
        >
          <ShieldCheck class="w-4 h-4 text-forest shrink-0 mt-0.5" />
          <p class="leading-relaxed">
            SaaS Web menggunakan integrasi Server-to-Server. Nilai pembayaran dan metadata user
            ditentukan langsung oleh backend Anda saat memanggil API Tertaut.
          </p>
        </div>
      </div>

      <!-- Tipe Spesifik: DESKTOP / ON-PREMISE -->
      <div v-else class="space-y-3 text-xs">
        <!-- Benefits -->
        <div class="space-y-1.5">
          <div class="text-[10px] uppercase font-bold text-jetblack/50 tracking-wider">
            Manfaat Pembeli
          </div>
          <div v-if="benefits.length > 0" class="space-y-1">
            <div
              v-for="(b, idx) in benefits"
              :key="idx"
              class="flex items-center gap-2 text-jetblack text-[11px]"
            >
              <Check class="w-3 h-3 text-forest shrink-0 stroke-[3]" />
              <span class="truncate">{{ b }}</span>
            </div>
          </div>
          <div v-else class="text-jetblack/40 text-[11px]">Belum ada manfaat ditambahkan</div>
        </div>

        <!-- Price -->
        <div class="space-y-1 pt-2 border-t border-jetblack/10">
          <div class="text-[10px] uppercase font-bold text-jetblack/50 tracking-wider">
            Penetapan Harga
          </div>
          <div class="flex items-baseline justify-between">
            <span class="text-xl font-black text-jetblack font-mono">
              {{ pricingType === "free" ? "Gratis" : price ? formatRupiah(price) : "Rp 0" }}
            </span>
            <span class="text-[11px] font-semibold text-jetblack/60">
              {{
                pricingType === "subscription"
                  ? billingPeriodDisplay
                  : pricingType === "free"
                    ? "Akses Gratis"
                    : "Sekali Bayar"
              }}
            </span>
          </div>

          <div
            v-if="pricingType === 'subscription' && hasTrialPeriod"
            class="text-[10px] text-forest font-bold flex items-center gap-1 mt-1 bg-forest/10 px-2 py-1 rounded-md border border-forest/20"
          >
            <Sparkles class="w-3 h-3 text-gold" />
            <span>{{ trialPeriodDays }} Hari Uji Coba Gratis</span>
          </div>

          <div v-if="meteringEnabled" class="mt-2 pt-2 border-t border-dashed border-jetblack/15">
            <div class="text-[10px] text-[#8a6d1f] flex items-center gap-1 font-mono font-bold">
              <Sparkles class="w-3 h-3 text-gold" />
              <span>+ Meter: {{ meteringAggregation }}</span>
            </div>
            <div class="text-[10px] text-jetblack/60 font-mono">
              Rp {{ meteringUnitPrice }} / {{ meteringMetricUnit }}
            </div>
          </div>
        </div>
      </div>

      <!-- Status Lingkungan -->
      <div class="p-3 rounded-lg bg-jetblack/[0.02] border border-jetblack/10">
        <div class="text-[10px] uppercase font-bold text-jetblack/50 tracking-wider mb-1">
          Status Konfigurasi
        </div>
        <div class="text-[11px] text-jetblack font-semibold flex items-center justify-between">
          <span class="flex items-center gap-1.5">
            <span
              class="w-2 h-2 rounded-full"
              :class="dashboardEnv === 'sandbox' ? 'bg-amber-500' : 'bg-emerald-500'"
            ></span>
            Lingkungan {{ dashboardEnv === "sandbox" ? "Sandbox" : "Live" }}
          </span>
          <span class="text-forest text-[10px] font-bold">Siap Didaftarkan</span>
        </div>
      </div>

      <!-- Action Button Submit -->
      <div class="pt-2">
        <button
          @click="emit('publish')"
          :disabled="isCreating || !canPublish"
          class="w-full py-2.5 rounded-lg btn-gold text-xs font-bold transition shadow-xs disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2 active:scale-98"
        >
          <RefreshCw v-if="isCreating" class="w-3.5 h-3.5 animate-spin" />
          <span>
            {{
              isCreating
                ? actionLabel
                  ? `${actionLabel}...`
                  : "Menyimpan Data..."
                : actionLabel || "Simpan Konfigurasi"
            }}
          </span>
        </button>
        <p class="text-[10px] text-jetblack/50 text-center mt-2 leading-relaxed">
          Mode {{ dashboardEnv === "sandbox" ? "Sandbox" : "Live" }} — data proyek langsung aktif di
          dashboard Anda setelah disimpan.
        </p>
      </div>
    </div>
  </div>
</template>
