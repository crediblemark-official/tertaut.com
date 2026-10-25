<script setup lang="ts">
import { ref, onMounted, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { api } from "../../lib/api";
import type { PlatformSettingsFormData } from "../../types/panel";
import { CreditCard, Sliders, Bell, Percent, ShieldCheck, RefreshCw, Save } from "lucide-vue-next";

import StatsBar from "../common/StatsBar.vue";
import StatItem from "../common/StatItem.vue";
import GatewaySettingsTab from "./settings/GatewaySettingsTab.vue";
import CommissionSettingsTab from "./settings/CommissionSettingsTab.vue";
import AnnouncementSettingsTab from "./settings/AnnouncementSettingsTab.vue";

const route = useRoute();
const router = useRouter();

type SettingsTab = "gateway" | "commission" | "announcement";
const activeSubTab = ref<SettingsTab>("gateway");

function initTabFromQuery() {
  const q = String(
    route.query.section || route.query.subtab || route.query.tab || ""
  ).toLowerCase();
  if (
    q === "commission" ||
    q === "payout" ||
    q === "komisi" ||
    q === "operations" ||
    q === "finansial"
  ) {
    activeSubTab.value = "commission";
  } else if (q === "announcement" || q === "broadcast" || q === "pengumuman") {
    activeSubTab.value = "announcement";
  } else if (q === "gateway") {
    activeSubTab.value = "gateway";
  }
}

function setSubTab(tab: SettingsTab) {
  activeSubTab.value = tab;
  router.replace({
    query: {
      ...route.query,
      section: tab,
    },
  });
}

watch(
  () => route.query.section,
  (newSection) => {
    if (newSection === "commission" || newSection === "payout" || newSection === "operations") {
      activeSubTab.value = "commission";
    } else if (newSection === "announcement" || newSection === "broadcast") {
      activeSubTab.value = "announcement";
    } else if (newSection === "gateway") {
      activeSubTab.value = "gateway";
    }
  }
);

const emit = defineEmits<{
  (e: "alert", payload: { type: "success" | "error"; text: string }): void;
}>();

const loading = ref(false);
const saving = ref(false);

const form = ref<PlatformSettingsFormData>({
  platform_fee_percent: "5",
  min_payout_threshold: "50000",
  announcement_banner: "",
  announcement_type: "info",
  active_payment_gateway: "xendit",
  xendit_secret_key: "",
  xendit_webhook_token: "",
  checkout_mode: "custom",
  sandbox_mode: "true",
});

async function loadSettings() {
  loading.value = true;
  try {
    const res = await api.getPlatformSettings();
    if (res.success && res.settings) {
      form.value = {
        platform_fee_percent: res.settings.platform_fee_percent || "5",
        min_payout_threshold: res.settings.min_payout_threshold || "50000",
        announcement_banner: res.settings.announcement_banner || "",
        announcement_type: res.settings.announcement_type || "info",
        active_payment_gateway: res.settings.active_payment_gateway || "xendit",
        xendit_secret_key: res.settings.xendit_secret_key || "",
        xendit_webhook_token: res.settings.xendit_webhook_token || "",
        checkout_mode: res.settings.checkout_mode || "custom",
        sandbox_mode: res.settings.sandbox_mode !== "false" ? "true" : "false",
        xendit_configured: res.settings.xendit_configured || "false",
      };
    }
  } catch (err: any) {
    emit("alert", { type: "error", text: err.message || "Gagal memuat pengaturan platform." });
  } finally {
    loading.value = false;
  }
}

async function handleSave() {
  saving.value = true;
  try {
    const res = await api.updatePlatformSettings(form.value);
    if (res.success) {
      emit("alert", { type: "success", text: "Pengaturan platform berhasil disimpan!" });
    } else {
      emit("alert", { type: "error", text: res.error || "Gagal menyimpan pengaturan." });
    }
  } catch (err: any) {
    emit("alert", {
      type: "error",
      text: err.message || "Terjadi kesalahan saat menyimpan pengaturan.",
    });
  } finally {
    saving.value = false;
  }
}

onMounted(() => {
  initTabFromQuery();
  loadSettings();
});
</script>

<template>
  <div class="space-y-4">
    <!-- Macro Summary Counter (Standard Tertaut Top StatsBar) -->
    <StatsBar borderless>
      <StatItem
        label="Gateway Pembayaran"
        :value="(form.active_payment_gateway || 'xendit').toUpperCase()"
        sublabel="Payment Gateway Utama"
        variant="forest"
        :icon="CreditCard"
        :loading="loading"
      />
      <StatItem
        label="Lingkungan Transaksi"
        :value="form.sandbox_mode === 'true' ? 'Mode Sandbox' : 'Mode Live'"
        :sublabel="
          form.sandbox_mode === 'true' ? 'Pengujian simulasi aktif' : 'Produksi transaksi riil'
        "
        :variant="form.sandbox_mode === 'true' ? 'gold' : 'forest'"
        bordered
        :icon="ShieldCheck"
        :loading="loading"
      />
      <StatItem
        label="Komisi Platform"
        :value="`${form.platform_fee_percent}%`"
        :sublabel="`Min. pencairan Rp ${Number(form.min_payout_threshold || 50000).toLocaleString('id-ID')}`"
        variant="default"
        bordered
        :icon="Percent"
        :loading="loading"
      />
      <StatItem
        label="Pengumuman Broadcast"
        :value="
          form.announcement_banner && form.announcement_banner.trim() ? 'Banner Aktif' : 'Nonaktif'
        "
        :sublabel="
          form.announcement_banner && form.announcement_banner.trim()
            ? `Tipe: ${form.announcement_type.toUpperCase()}`
            : 'Tidak ada pesan global'
        "
        :variant="form.announcement_banner && form.announcement_banner.trim() ? 'gold' : 'default'"
        bordered
        :icon="Bell"
        :loading="loading"
      />
    </StatsBar>

    <!-- Unified Dark Toolbar (Standard Tertaut Dark Bar) -->
    <div
      class="-mx-3.5 sm:-mx-4 md:-mx-6 px-3.5 sm:px-4 md:px-6 min-h-[44px] py-1.5 sm:py-0 bg-jetblack text-white border-b border-jetblack flex items-center justify-between gap-3 overflow-x-auto no-scrollbar shadow-xs mb-0 !mt-0"
    >
      <!-- Sisi Kiri: Judul & Subtab Pills -->
      <div class="flex items-center gap-2 shrink-0">
        <div class="flex items-center gap-2 shrink-0">
          <Sliders class="w-3.5 h-3.5 text-gold" />
          <span class="text-xs font-bold text-white uppercase tracking-wider">
            Pengaturan Platform
          </span>
          <span
            class="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white font-mono font-bold"
          >
            Pengaturan Inti
          </span>
        </div>

        <!-- Subtab Switcher Pills in Dark Bar -->
        <div
          class="flex items-center h-7 rounded-md bg-white/10 p-0.5 text-xs font-medium shrink-0 ml-1 sm:ml-3"
        >
          <button
            type="button"
            @click="setSubTab('gateway')"
            class="px-2.5 h-full rounded transition cursor-pointer flex items-center gap-1.5 text-xs select-none"
            :class="
              activeSubTab === 'gateway'
                ? 'bg-white font-bold text-jetblack shadow-2xs'
                : 'text-white/70 hover:text-white'
            "
          >
            <CreditCard
              class="w-3 h-3"
              :class="activeSubTab === 'gateway' ? 'text-forest' : 'text-gold'"
            />
            <span>Gateway Pembayaran</span>
            <span
              class="text-[9.5px] px-1 py-0.2 rounded font-mono uppercase"
              :class="
                activeSubTab === 'gateway'
                  ? 'bg-jetblack/10 text-jetblack font-bold'
                  : 'bg-white/15 text-white/90'
              "
            >
              {{ form.active_payment_gateway || "xendit" }}
            </span>
          </button>

          <button
            type="button"
            @click="setSubTab('commission')"
            class="px-2.5 h-full rounded transition cursor-pointer flex items-center gap-1.5 text-xs select-none"
            :class="
              activeSubTab === 'commission'
                ? 'bg-white font-bold text-jetblack shadow-2xs'
                : 'text-white/70 hover:text-white'
            "
          >
            <Sliders
              class="w-3 h-3"
              :class="activeSubTab === 'commission' ? 'text-forest' : 'text-gold'"
            />
            <span>Komisi &amp; Payout</span>
            <span
              class="text-[9.5px] px-1 py-0.2 rounded font-mono"
              :class="
                activeSubTab === 'commission'
                  ? 'bg-jetblack/10 text-jetblack font-bold'
                  : 'bg-white/15 text-white/90'
              "
            >
              {{ form.platform_fee_percent }}%
            </span>
          </button>

          <button
            type="button"
            @click="setSubTab('announcement')"
            class="px-2.5 h-full rounded transition cursor-pointer flex items-center gap-1.5 text-xs select-none"
            :class="
              activeSubTab === 'announcement'
                ? 'bg-white font-bold text-jetblack shadow-2xs'
                : 'text-white/70 hover:text-white'
            "
          >
            <Bell
              class="w-3 h-3"
              :class="activeSubTab === 'announcement' ? 'text-forest' : 'text-gold'"
            />
            <span>Pengumuman</span>
            <span
              v-if="form.announcement_banner && form.announcement_banner.trim()"
              class="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"
            ></span>
          </button>
        </div>
      </div>

      <!-- Sisi Kanan: Aksi Toolbar (Segarkan & Simpan Pengaturan) -->
      <div class="flex items-center gap-2 shrink-0">
        <button
          type="button"
          @click="loadSettings"
          :disabled="loading || saving"
          class="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition cursor-pointer disabled:opacity-50"
          title="Segarkan pengaturan platform"
        >
          <RefreshCw class="w-3.5 h-3.5" :class="{ 'animate-spin': loading }" />
        </button>

        <button
          type="button"
          @click="handleSave"
          :disabled="saving || loading"
          class="inline-flex items-center gap-1.5 px-3.5 h-8 rounded-lg btn-gold text-xs font-bold transition shadow-2xs cursor-pointer active:scale-95 disabled:opacity-50 shrink-0"
        >
          <span
            v-if="saving"
            class="w-3.5 h-3.5 border-2 border-black/30 border-t-black rounded-full animate-spin"
          ></span>
          <Save v-else class="w-3.5 h-3.5 stroke-[2.5]" />
          <span>Simpan Pengaturan</span>
        </button>
      </div>
    </div>

    <!-- Main Settings Form Canvas (Standard Responsive Full-Width) -->
    <div class="pt-2 pb-12 w-full animate-fadeIn">
      <!-- TAB 1: GATEWAY PEMBAYARAN -->
      <GatewaySettingsTab
        v-if="activeSubTab === 'gateway'"
        :form="form"
        :saving="saving"
        @save="handleSave"
      />

      <!-- TAB 2: KOMISI & PENCAIRAN -->
      <CommissionSettingsTab
        v-else-if="activeSubTab === 'commission'"
        :form="form"
        :saving="saving"
        @save="handleSave"
      />

      <!-- TAB 3: PENGUMUMAN BROADCAST -->
      <AnnouncementSettingsTab
        v-else-if="activeSubTab === 'announcement'"
        :form="form"
        :saving="saving"
        @save="handleSave"
      />
    </div>
  </div>
</template>
