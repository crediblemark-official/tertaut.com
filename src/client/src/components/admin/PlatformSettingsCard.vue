<script setup lang="ts">
import { ref, onMounted, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { api } from "../../lib/api";
import type { PlatformSettingsFormData } from "../../types/panel";
import { CreditCard, Sliders, Bell } from "lucide-vue-next";

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
  active_payment_gateway: "dana",
  xendit_secret_key: "",
  xendit_webhook_token: "",
  xenithpay_sandbox_access_key: "",
  xenithpay_sandbox_secret_key: "",
  xenithpay_sandbox_webhook_secret: "",
  dana_sandbox_client_id: "",
  dana_sandbox_client_secret: "",
  dana_sandbox_merchant_id: "",
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
        active_payment_gateway: res.settings.active_payment_gateway || "dana",
        xendit_secret_key: res.settings.xendit_secret_key || "",
        xendit_webhook_token: res.settings.xendit_webhook_token || "",
        xenithpay_sandbox_access_key: res.settings.xenithpay_sandbox_access_key || "",
        xenithpay_sandbox_secret_key: res.settings.xenithpay_sandbox_secret_key || "",
        xenithpay_sandbox_webhook_secret: res.settings.xenithpay_sandbox_webhook_secret || "",
        dana_sandbox_client_id: res.settings.dana_sandbox_client_id || "",
        dana_sandbox_client_secret: res.settings.dana_sandbox_client_secret || "",
        dana_sandbox_merchant_id: res.settings.dana_sandbox_merchant_id || "",
        checkout_mode: res.settings.checkout_mode || "custom",
        sandbox_mode: res.settings.sandbox_mode !== "false" ? "true" : "false",
        xendit_configured: res.settings.xendit_configured || "false",
        dana_configured: res.settings.dana_configured || "false",
        xenithpay_configured: res.settings.xenithpay_configured || "false",
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
  <div class="space-y-6 max-w-3xl pb-8">
    <!-- Tab Navigation (3 Fitur: Gateway Pembayaran, Komisi & Pencairan, Pengumuman Broadcast) -->
    <div class="flex flex-wrap items-center gap-2 border-b border-jetblack/10 pb-3">
      <button
        type="button"
        @click="setSubTab('gateway')"
        :class="
          activeSubTab === 'gateway'
            ? 'bg-jetblack text-white font-bold shadow-xs'
            : 'bg-jetblack/5 text-jetblack/70 hover:text-jetblack hover:bg-jetblack/10'
        "
        class="px-3.5 py-2 rounded-lg text-xs transition cursor-pointer flex items-center gap-2 select-none"
      >
        <CreditCard
          class="w-3.5 h-3.5"
          :class="activeSubTab === 'gateway' ? 'text-gold' : 'text-jetblack/50'"
        />
        <span>Gateway Pembayaran</span>
        <span
          v-if="form.active_payment_gateway"
          class="text-[10px] px-1.5 py-0.5 rounded font-mono uppercase"
          :class="
            activeSubTab === 'gateway'
              ? 'bg-white/20 text-white font-bold'
              : 'bg-jetblack/10 text-jetblack/70'
          "
        >
          {{ form.active_payment_gateway }}
        </span>
      </button>

      <button
        type="button"
        @click="setSubTab('commission')"
        :class="
          activeSubTab === 'commission'
            ? 'bg-jetblack text-white font-bold shadow-xs'
            : 'bg-jetblack/5 text-jetblack/70 hover:text-jetblack hover:bg-jetblack/10'
        "
        class="px-3.5 py-2 rounded-lg text-xs transition cursor-pointer flex items-center gap-2 select-none"
      >
        <Sliders
          class="w-3.5 h-3.5"
          :class="activeSubTab === 'commission' ? 'text-gold' : 'text-jetblack/50'"
        />
        <span>Komisi &amp; Pencairan</span>
        <span
          class="text-[10px] px-1.5 py-0.5 rounded font-mono"
          :class="
            activeSubTab === 'commission'
              ? 'bg-white/20 text-white font-bold'
              : 'bg-jetblack/10 text-jetblack/70'
          "
        >
          {{ form.platform_fee_percent }}%
        </span>
      </button>

      <button
        type="button"
        @click="setSubTab('announcement')"
        :class="
          activeSubTab === 'announcement'
            ? 'bg-jetblack text-white font-bold shadow-xs'
            : 'bg-jetblack/5 text-jetblack/70 hover:text-jetblack hover:bg-jetblack/10'
        "
        class="px-3.5 py-2 rounded-lg text-xs transition cursor-pointer flex items-center gap-2 select-none"
      >
        <Bell
          class="w-3.5 h-3.5"
          :class="activeSubTab === 'announcement' ? 'text-gold' : 'text-jetblack/50'"
        />
        <span>Pengumuman Broadcast</span>
        <span
          v-if="form.announcement_banner && form.announcement_banner.trim()"
          class="w-2 h-2 rounded-full bg-amber-400 animate-pulse"
        ></span>
      </button>
    </div>

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
</template>
