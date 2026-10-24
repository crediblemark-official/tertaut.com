<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from "vue";
import { api } from "../lib/api";
import type { AppItem } from "../types/app";
import type { LicenseItem, LicensePlatform } from "../types/licensing";
import { dashboardEnv, envPath } from "../lib/environment";
import { CheckCircle2, KeyRound, Webhook } from "lucide-vue-next";
import { useClipboard } from "../composables/useClipboard";
import { useConfirm } from "../composables/useConfirm";
import LicenseTable from "../components/licensing/LicenseTable.vue";

import IssueLicenseModal from "../components/licensing/IssueLicenseModal.vue";
import LicenseActivityPanel from "../components/licensing/LicenseActivityPanel.vue";

const env = dashboardEnv;
const appsList = ref<AppItem[]>([]);
const licensesList = ref<LicenseItem[]>([]);
const loadingLicenses = ref(true);
const actionFeedback = ref<string | null>(null);
let feedbackTimer: ReturnType<typeof setTimeout> | null = null;
const { copy: writeClipboard } = useClipboard();

// Activity Panel State
const activeLicense = ref<LicenseItem | null>(null);

// Issue Modal State
const isIssueModalOpen = ref(false);
const isIssuing = ref(false);

function setFeedback(msg: string, timeoutMs = 4000) {
  if (feedbackTimer) clearTimeout(feedbackTimer);
  actionFeedback.value = msg;
  feedbackTimer = setTimeout(() => {
    actionFeedback.value = null;
    feedbackTimer = null;
  }, timeoutMs);
}

onUnmounted(() => {
  if (feedbackTimer) {
    clearTimeout(feedbackTimer);
    feedbackTimer = null;
  }
});

async function loadData() {
  loadingLicenses.value = true;
  try {
    const [appsRes, licRes] = await Promise.all([api.getApps(), api.getLicenses()]);
    appsList.value = appsRes.apps || [];
    licensesList.value = licRes.licenses || [];
  } catch (err) {
    console.error("Failed to load licenses data:", err);
  } finally {
    loadingLicenses.value = false;
  }
}

async function handleIssueLicense(payload: {
  appId: string;
  customerEmail: string;
  grantDays: number;
  maxSeats: number;
  platform: LicensePlatform;
}) {
  isIssuing.value = true;
  try {
    const res = await api.issueLicense(payload);
    if (res.success && res.license) {
      isIssueModalOpen.value = false;
      setFeedback(`Lisensi baru ${res.license.licenseKey || ""} berhasil diterbitkan!`, 5000);
      await loadData();
      notifyLicensesChanged();
    }
  } finally {
    isIssuing.value = false;
  }
}

const { confirm: confirmDialog } = useConfirm();

async function revokeLicense(lic: LicenseItem) {
  const confirmed = await confirmDialog({
    title: "Cabut Lisensi?",
    message: `Lisensi ${lic.licenseKey} akan dibatalkan permanen.`,
    confirmText: "Cabut",
    cancelText: "Batal",
    variant: "danger",
  });
  if (!confirmed) return;
  try {
    const res = await api.revokeLicense(lic.licenseKey);
    if (res.success) {
      setFeedback(`Lisensi ${lic.licenseKey} berhasil dicabut.`, 4000);
      await loadData();
      notifyLicensesChanged();
    }
  } catch (e) {
    console.error(e);
  }
}

async function unbindHardware(lic: LicenseItem) {
  try {
    const res = await api.unbindHardware(lic.licenseKey);
    if (res.success) {
      setFeedback(
        `Hardware binding untuk ${lic.licenseKey} berhasil di-reset. Pengguna dapat aktivasi di device baru.`,
        4000
      );
      await loadData();
    }
  } catch (e) {
    console.error(e);
  }
}

async function handleDeactivateSeat(licenseKey: string, hwid: string) {
  try {
    const res = await api.deactivateLicense({ licenseKey, hwid });
    if (res.success) {
      setFeedback("Device seat berhasil dilepas!", 4000);
      await loadData();
    } else {
      setFeedback(`Gagal: ${res.error || "Seat tidak bisa dilepas"}`, 4000);
    }
  } catch (e: any) {
    setFeedback(`Error: ${e?.message || "Terjadi kesalahan"}`, 4000);
  }
}

function openDetail(lic: LicenseItem) {
  activeLicense.value = lic;
}

function closeDetail() {
  activeLicense.value = null;
}

/** Beri tahu sidebar (App.vue) bahwa daftar lisensi berubah agar badge ter-update. */
function notifyLicensesChanged() {
  window.dispatchEvent(new Event("tertaut:licenses-changed"));
}

async function copyToClipboard(text: string) {
  const ok = await writeClipboard(text);
  if (!ok) {
    setFeedback("Gagal menyalin ke clipboard. Salin manual dari tabel.", 3000);
    return;
  }
  setFeedback(`Kunci lisensi ${text} disalin ke clipboard!`, 3000);
}

onMounted(() => {
  loadData();
});

// Muat ulang saat environment Live/Sandbox berganti
watch(dashboardEnv, () => {
  loadData();
});
</script>

<template>
  <div class="animate-fadeIn pb-12">
    <!-- License Table -->
    <LicenseTable
      :licenses-list="licensesList"
      :loading="loadingLicenses"
      @refresh="loadData"
      @issue="isIssueModalOpen = true"
      @copy="copyToClipboard"
      @unbind-hardware="unbindHardware"
      @deactivate-seat="handleDeactivateSeat"
      @revoke="revokeLicense"
      @detail="openDetail"
    >
      <template #tabs>
        <div class="flex items-center gap-2.5">
          <div class="flex items-center gap-2">
            <KeyRound class="w-3.5 h-3.5 text-gold" />
            <h2 class="text-xs font-bold uppercase tracking-wider text-white">Daftar Lisensi</h2>
            <span
              class="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white font-mono font-bold"
            >
              {{ licensesList.length }} keys
            </span>
          </div>

          <router-link
            :to="envPath(env, '/developer')"
            class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition"
            title="Kelola Webhook Endpoints & Outbox Logs di Developer Portal"
          >
            <Webhook class="w-3 h-3 text-gold" />
            <span class="hidden sm:inline">Kelola Webhook di Developer Portal</span>
            <span class="sm:hidden">Webhooks</span>
          </router-link>
        </div>
      </template>
    </LicenseTable>

    <!-- Alert Feedback -->
    <div
      v-if="actionFeedback"
      class="mt-3 p-3 rounded-xl bg-forest/10 border border-forest/30 text-forest text-xs font-bold flex items-center gap-2 animate-fadeIn"
    >
      <CheckCircle2 class="w-4 h-4" />
      <span>{{ actionFeedback }}</span>
    </div>

    <!-- Issue License Modal Component -->
    <IssueLicenseModal
      :show="isIssueModalOpen"
      :apps-list="appsList"
      :is-issuing="isIssuing"
      :default-app-id="appsList.length > 0 ? appsList[0].id : ''"
      @close="isIssueModalOpen = false"
      @issue="handleIssueLicense"
    />

    <!-- Activity & Audit Panel -->
    <LicenseActivityPanel
      :license="activeLicense"
      @close="closeDetail"
      @deactivate-seat="handleDeactivateSeat"
    />
  </div>
</template>
