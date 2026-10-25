<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { api } from "../lib/api";
import { dashboardEnv, envPath } from "../lib/environment";
import { formatRupiah } from "../lib/utils";
import { useConfirm } from "../composables/useConfirm";
import type { AppItem } from "../types/app";
import DevDeliveryModal from "../components/developer/DevDeliveryModal.vue";
import TableSkeleton from "../components/common/TableSkeleton.vue";
import TableContainer from "../components/common/TableContainer.vue";
import SearchPicker from "../components/common/SearchPicker.vue";
import CopyButton from "../components/common/CopyButton.vue";
import StatusBadge from "../components/common/StatusBadge.vue";
import EmptyState from "../components/common/EmptyState.vue";
import BaseModal from "../components/common/BaseModal.vue";
import {
  KeyRound,
  ShieldAlert,
  Eye,
  EyeOff,
  RefreshCw,
  Terminal,
  Code2,
  Webhook,
  Send,
  Plus,
  Trash2,
  ExternalLink,
  Lock,
  Globe,
  Radio,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileJson,
  Layers,
  BookOpen,
  Pencil,
} from "lucide-vue-next";

const env = dashboardEnv;
const { confirm: confirmDialog } = useConfirm();

const loading = ref(true);
const builderId = ref("");
const builderEmail = ref("");
const builderName = ref("");
const builderApiKey = ref("");
const secretApiKey = ref("");
const revealSecret = ref(false);
const rotatingSecret = ref(false);

const appsList = ref<AppItem[]>([]);
const endpoints = ref<any[]>([]);
const loadingEndpoints = ref(false);

const deliveries = ref<any[]>([]);
const loadingDeliveries = ref(false);
const retryingDeliveryId = ref<string | null>(null);
const selectedDelivery = ref<any | null>(null);
const isDeliveryModalOpen = ref(false);

const feedback = ref<{ type: "success" | "error"; text: string } | null>(null);
function setFeedback(type: "success" | "error", text: string) {
  feedback.value = { type, text };
  setTimeout(() => {
    feedback.value = null;
  }, 4500);
}

const activeSection = ref<"checkout" | "webhook">("checkout");

// Selected SaaS App
const selectedAppId = ref("");

const currentApp = computed(() => {
  return appsList.value.find((a) => a.id === selectedAppId.value) || appsList.value[0] || null;
});

const currentAppId = computed(() => currentApp.value?.id || "app_my_saas_01");
const currentAppPrice = computed(() => currentApp.value?.targetPrice || 135000);

// Tab Webhook & Outbox Logs (Per-Proyek 1 URL)
const activeWebhookTab = ref<"endpoint" | "logs">("endpoint");
const revealWebhookSecret = ref(false);
const rotatingWebhookSecret = ref(false);
const deliveriesScope = ref<"current" | "all">("current");
const editingEndpointId = ref<string | null>(null);

const currentAppEndpoint = computed(() => {
  if (!currentApp.value) return null;
  // 1. By explicit appId
  const byApp = endpoints.value.find((ep) => ep.appId === currentApp.value?.id);
  if (byApp) return byApp;
  // 2. By matching webhookUrl
  if (currentApp.value.webhookUrl) {
    const byUrl = endpoints.value.find((ep) => ep.url === currentApp.value?.webhookUrl);
    if (byUrl) return byUrl;
  }
  // 3. Virtual fallback jika ada webhookUrl di app tapi belum sinkron di endpoints
  if (currentApp.value.webhookUrl) {
    return {
      id: "virtual_" + currentApp.value.id,
      builderId: builderId.value,
      appId: currentApp.value.id,
      url: currentApp.value.webhookUrl,
      secret: secretApiKey.value || "tt_whsec_auto",
      events: [],
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }
  return null;
});

const displayedEndpointSecret = computed(() => {
  const sec = currentAppEndpoint.value?.secret;
  if (!sec) return "tt_whsec_••••••••••••••••";
  if (revealWebhookSecret.value) return sec;
  if (sec.length <= 14) return "•".repeat(24);
  return sec.slice(0, 10) + "•".repeat(sec.length - 14) + sec.slice(-4);
});

const filteredDeliveries = computed(() => {
  if (deliveriesScope.value === "current") {
    return deliveries.value.filter(
      (del) =>
        del.payload?.data?.appId === currentAppId.value ||
        del.payload?.appId === currentAppId.value ||
        (currentAppEndpoint.value && del.endpointId === currentAppEndpoint.value.id)
    );
  }
  return deliveries.value;
});

const currentAppDeliveriesCount = computed(() => {
  return deliveries.value.filter(
    (del) =>
      del.payload?.data?.appId === currentAppId.value ||
      del.payload?.appId === currentAppId.value ||
      (currentAppEndpoint.value && del.endpointId === currentAppEndpoint.value.id)
  ).length;
});

// Create/Edit Webhook modal state
const isWebhookModalOpen = ref(false);
const webhookUrlInput = ref("");
const webhookEventsInput = ref<string[]>([]);
const webhookSecretInput = ref("");
const isSubmittingWebhook = ref(false);
const webhookError = ref<string | null>(null);

const ALL_WEBHOOK_EVENTS = [
  { id: "payment.success", label: "payment.success (Lunas)" },
  { id: "payment.failed", label: "payment.failed (Gagal)" },
  { id: "license.issued", label: "license.issued (Diterbitkan)" },
  { id: "license.activated", label: "license.activated (Seat Aktif)" },
  { id: "license.deactivated", label: "license.deactivated (Seat Dilepas)" },
  { id: "license.seat_full", label: "license.seat_full (Seat Penuh)" },
  { id: "license.revoked", label: "license.revoked (Dicabut)" },
  { id: "license.expired", label: "license.expired (Kadaluarsa)" },
  { id: "license.renewed", label: "license.renewed (Diperpanjang)" },
  { id: "license.transferred", label: "license.transferred (Dipindah)" },
  { id: "license.unbound", label: "license.unbound (Reset HWID)" },
];

function toggleWebhookEvent(evId: string) {
  const idx = webhookEventsInput.value.indexOf(evId);
  if (idx >= 0) webhookEventsInput.value.splice(idx, 1);
  else webhookEventsInput.value.push(evId);
}

const baseUrl = computed(() => {
  if (typeof window !== "undefined") {
    return `${window.location.origin}/api/v1`;
  }
  return "https://tertaut.com/api/v1";
});

const displayedSecretKey = computed(() => {
  const key = secretApiKey.value;
  if (!key) return "tt_secret_live_••••••••••••••••";
  if (revealSecret.value) return key;
  if (key.length <= 14) return "•".repeat(24);
  return key.slice(0, 10) + "•".repeat(key.length - 14) + key.slice(-4);
});

async function loadBuilderData() {
  loading.value = true;
  try {
    const [meRes, appsRes] = await Promise.all([api.getBuilderMyself(), api.getApps(env.value)]);

    if (meRes.success && meRes.builder) {
      builderId.value = meRes.builder.id;
      builderEmail.value = meRes.builder.email;
      builderName.value = meRes.builder.name;
      builderApiKey.value = meRes.builder.apiKey || "";
      secretApiKey.value = meRes.builder.secretApiKey || "";
    }
    appsList.value = appsRes.apps || [];
    if (appsList.value.length > 0 && !selectedAppId.value) {
      selectedAppId.value = appsList.value[0].id;
    }
  } catch (err: any) {
    console.error("Gagal memuat kredensial builder:", err);
  } finally {
    loading.value = false;
  }
}

async function loadWebhooks() {
  loadingEndpoints.value = true;
  try {
    const res = await api.getWebhooks();
    endpoints.value = res.webhooks || [];
  } catch (err: any) {
    console.error("Gagal memuat webhooks:", err);
  } finally {
    loadingEndpoints.value = false;
  }
}

async function loadDeliveries() {
  loadingDeliveries.value = true;
  try {
    const res = await api.getWebhookDeliveries(30);
    deliveries.value = res.deliveries || [];
  } catch (err: any) {
    console.error("Gagal memuat log webhook:", err);
  } finally {
    loadingDeliveries.value = false;
  }
}

async function refreshAll() {
  await Promise.all([loadBuilderData(), loadWebhooks(), loadDeliveries()]);
}

onMounted(() => {
  refreshAll();
});

watch(env, () => {
  selectedAppId.value = "";
  refreshAll();
});

watch(selectedAppId, () => {
  revealWebhookSecret.value = false;
});

async function handleRotateSecret() {
  const ok = await confirmDialog({
    title: "Rotasi Secret API Key?",
    message: "Kunci API lama akan langsung dinonaktifkan.",
    confirmText: "Rotasi",
    cancelText: "Batal",
    variant: "danger",
  });
  if (!ok) return;

  rotatingSecret.value = true;
  try {
    const res = await api.rotateBuilderSecret();
    if (res.success && res.secretApiKey) {
      secretApiKey.value = res.secretApiKey;
      revealSecret.value = true;
      setFeedback("success", "Secret API key berhasil diperbarui!");
    } else {
      setFeedback("error", res.error || "Gagal merotasi secret key");
    }
  } catch (err: any) {
    setFeedback("error", err?.message || "Terjadi kesalahan saat rotasi key");
  } finally {
    rotatingSecret.value = false;
  }
}

function openWebhookModal(isEdit = false) {
  webhookError.value = null;
  if (isEdit && currentAppEndpoint.value) {
    editingEndpointId.value = currentAppEndpoint.value.id.startsWith("virtual_")
      ? null
      : currentAppEndpoint.value.id;
    webhookUrlInput.value = currentAppEndpoint.value.url;
    webhookEventsInput.value = [...(currentAppEndpoint.value.events || [])];
    webhookSecretInput.value = "";
  } else {
    editingEndpointId.value = null;
    webhookUrlInput.value = currentApp.value?.webhookUrl || "";
    webhookEventsInput.value = [];
    webhookSecretInput.value = "";
  }
  isWebhookModalOpen.value = true;
}

async function handleSaveWebhook() {
  const trimmedUrl = webhookUrlInput.value.trim();
  if (!trimmedUrl.startsWith("http://") && !trimmedUrl.startsWith("https://")) {
    webhookError.value = "URL webhook harus valid dan diawali http:// atau https://";
    return;
  }
  isSubmittingWebhook.value = true;
  webhookError.value = null;
  try {
    const eventsToSend =
      webhookEventsInput.value.length > 0
        ? [...webhookEventsInput.value]
        : ALL_WEBHOOK_EVENTS.map((e) => e.id);

    const targetAppId = currentAppId.value;

    if (editingEndpointId.value) {
      const res = await api.updateWebhook(editingEndpointId.value, {
        appId: targetAppId,
        url: trimmedUrl,
        events: eventsToSend,
      });
      if (!res.success) {
        webhookError.value = res.error || "Gagal memperbarui webhook";
        return;
      }
    } else {
      const res = await api.createWebhook({
        appId: targetAppId,
        url: trimmedUrl,
        events: eventsToSend,
        secret: webhookSecretInput.value.trim() || undefined,
      });
      if (!res.success) {
        webhookError.value = res.error || "Gagal mendaftarkan webhook";
        return;
      }
    }

    if (currentApp.value) {
      currentApp.value.webhookUrl = trimmedUrl;
    }

    isWebhookModalOpen.value = false;
    setFeedback(
      "success",
      `Webhook endpoint untuk proyek ${currentApp.value?.name || ""} berhasil disimpan!`
    );
    await loadWebhooks();
  } catch (err: any) {
    webhookError.value = err?.message || "Terjadi kesalahan";
  } finally {
    isSubmittingWebhook.value = false;
  }
}

async function handleDeleteCurrentEndpoint() {
  if (!currentAppEndpoint.value) return;
  const ok = await confirmDialog({
    title: `Hapus Webhook Proyek ${currentApp.value?.name || ""}?`,
    message: "Endpoint ini tidak akan menerima notifikasi event lagi untuk proyek ini.",
    confirmText: "Hapus Webhook",
    cancelText: "Batal",
    variant: "danger",
  });
  if (!ok) return;

  try {
    if (!currentAppEndpoint.value.id.startsWith("virtual_")) {
      await api.deleteWebhook(currentAppEndpoint.value.id);
    }
    if (currentApp.value) {
      currentApp.value.webhookUrl = null;
      await api.updateApp(currentApp.value.id, { webhookUrl: null });
    }
    setFeedback(
      "success",
      `Webhook untuk proyek ${currentApp.value?.name || ""} berhasil dihapus.`
    );
    await loadWebhooks();
  } catch (err: any) {
    setFeedback("error", err?.message || "Gagal menghapus webhook");
  }
}

async function handleTestCurrentEndpoint() {
  if (!currentAppEndpoint.value) return;
  try {
    let epId = currentAppEndpoint.value.id;
    if (epId.startsWith("virtual_")) {
      const res = await api.createWebhook({
        appId: currentAppId.value,
        url: currentAppEndpoint.value.url,
        events: ALL_WEBHOOK_EVENTS.map((e) => e.id),
      });
      if (res.success && res.webhook) {
        epId = res.webhook.id;
        await loadWebhooks();
      }
    }
    const res = await api.testWebhook(epId);
    if (res.success) {
      setFeedback("success", `Test ping berhasil dikirim ke ${currentAppEndpoint.value.url}!`);
      await loadDeliveries();
    } else {
      setFeedback("error", `Test delivery gagal: ${res.error || "Server tidak merespons"}`);
    }
  } catch (err: any) {
    setFeedback("error", err?.message || "Gagal menguji endpoint");
  }
}

async function handleRotateCurrentEndpointSecret() {
  if (!currentAppEndpoint.value) return;
  const ok = await confirmDialog({
    title: "Rotasi Webhook Signing Secret?",
    message:
      "Secret lama akan langsung tidak berlaku. Anda harus memperbarui verifikasi HMAC di server Anda.",
    confirmText: "Rotasi",
    cancelText: "Batal",
    variant: "danger",
  });
  if (!ok) return;

  rotatingWebhookSecret.value = true;
  try {
    let epId = currentAppEndpoint.value.id;
    if (epId.startsWith("virtual_")) {
      const created = await api.createWebhook({
        appId: currentAppId.value,
        url: currentAppEndpoint.value.url,
        events: ALL_WEBHOOK_EVENTS.map((e) => e.id),
      });
      if (created.success && created.webhook) {
        epId = created.webhook.id;
      }
    }
    const res = await api.rotateWebhookSecret(epId);
    if (res.success && res.webhook) {
      revealWebhookSecret.value = true;
      setFeedback("success", "Webhook secret berhasil dirotasi!");
      await loadWebhooks();
    } else {
      setFeedback("error", res.error || "Gagal merotasi secret");
    }
  } catch (err: any) {
    setFeedback("error", err?.message || "Terjadi kesalahan saat rotasi");
  } finally {
    rotatingWebhookSecret.value = false;
  }
}

async function handleToggleEndpointActive() {
  if (!currentAppEndpoint.value) return;
  const nextActive = !currentAppEndpoint.value.isActive;
  try {
    let epId = currentAppEndpoint.value.id;
    if (epId.startsWith("virtual_")) {
      const created = await api.createWebhook({
        appId: currentAppId.value,
        url: currentAppEndpoint.value.url,
        events: ALL_WEBHOOK_EVENTS.map((e) => e.id),
        isActive: nextActive,
      });
      if (created.success) {
        setFeedback("success", `Webhook ${nextActive ? "diaktifkan" : "dinonaktifkan"}.`);
        await loadWebhooks();
      }
      return;
    }
    const res = await api.updateWebhook(epId, { isActive: nextActive });
    if (res.success) {
      setFeedback("success", `Webhook ${nextActive ? "diaktifkan" : "dinonaktifkan"}.`);
      await loadWebhooks();
    }
  } catch (err: any) {
    setFeedback("error", err?.message || "Gagal memperbarui status webhook");
  }
}

async function handleDeleteWebhook(id: string) {
  const ok = await confirmDialog({
    title: "Hapus Endpoint Webhook?",
    message: "Endpoint tidak akan menerima notifikasi lagi.",
    confirmText: "Hapus",
    cancelText: "Batal",
    variant: "danger",
  });
  if (!ok) return;

  try {
    const res = await api.deleteWebhook(id);
    if (res.success) {
      setFeedback("success", "Endpoint webhook berhasil dihapus.");
      await loadWebhooks();
    }
  } catch (err: any) {
    setFeedback("error", err?.message || "Gagal menghapus webhook");
  }
}

async function handleTestWebhook(id: string) {
  try {
    const res = await api.testWebhook(id);
    if (res.success) {
      setFeedback("success", "Test ping delivery berhasil dikirim ke server Anda!");
      await loadDeliveries();
    } else {
      setFeedback("error", `Test delivery gagal: ${res.error || "Server tidak merespons"}`);
    }
  } catch (err: any) {
    setFeedback("error", err?.message || "Gagal menguji endpoint");
  }
}

async function handleRetryDelivery(id: string) {
  retryingDeliveryId.value = id;
  try {
    const res = await api.retryWebhookDelivery(id);
    if (res.success) {
      setFeedback("success", "Pengiriman webhook berhasil dicoba ulang!");
      await loadDeliveries();
    } else {
      setFeedback("error", res.error || "Gagal mengirim ulang webhook");
    }
  } catch (err: any) {
    setFeedback("error", err?.message || "Terjadi kesalahan sistem");
  } finally {
    retryingDeliveryId.value = null;
  }
}

function openDeliveryDetail(item: any) {
  selectedDelivery.value = item;
  isDeliveryModalOpen.value = true;
}

function getEndpointUrl(endpointId: string) {
  const ep = endpoints.value.find((e) => e.id === endpointId);
  return ep ? ep.url : endpointId || "-";
}

function formatTimestamp(dt: string | Date | null | undefined) {
  if (!dt) return "-";
  const d = new Date(dt);
  return d.toLocaleString("id-ID", {
    dateStyle: "short",
    timeStyle: "medium",
  });
}
</script>

<template>
  <div class="animate-fadeIn pb-12">
    <!-- Feedback Toast -->
    <div
      v-if="feedback"
      class="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 text-xs font-semibold rounded-xl shadow-xl transition-all"
      :class="feedback.type === 'success' ? 'bg-forest text-white' : 'bg-crimson text-white'"
    >
      <CheckCircle2 v-if="feedback.type === 'success'" class="w-4 h-4 shrink-0 text-gold" />
      <AlertTriangle v-else class="w-4 h-4 shrink-0" />
      <span>{{ feedback.text }}</span>
      <button
        type="button"
        @click="feedback = null"
        class="text-white/80 hover:text-white font-bold ml-2 cursor-pointer"
      >
        ×
      </button>
    </div>

    <!-- Unified Header & Toolbar (Edge-to-Edge Full Width & Standardized Height) -->
    <div class="view-toolbar">
      <!-- Sisi Kiri: Badge Judul & Mode -->
      <div class="flex items-center gap-2 overflow-x-auto no-scrollbar">
        <div
          class="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-white/20 text-white shadow-2xs shrink-0"
        >
          <Terminal class="w-3.5 h-3.5 text-gold" />
          <span>Developer Portal</span>
        </div>
        <span
          class="px-2 py-0.5 rounded-md font-bold text-[10px] shrink-0"
          :class="env === 'sandbox' ? 'bg-gold text-jetblack' : 'bg-forest text-white'"
        >
          {{ env === "sandbox" ? "Sandbox Mode" : "Live Mode" }}
        </span>
        <span
          class="text-[10px] px-2 py-0.5 rounded-md font-mono font-bold hidden sm:inline-flex shrink-0 items-center gap-1.5"
          :class="currentAppEndpoint ? 'bg-forest/40 text-white' : 'bg-white/10 text-white/70'"
        >
          <span
            class="w-1.5 h-1.5 rounded-full"
            :class="currentAppEndpoint ? 'bg-emerald-400' : 'bg-white/40'"
          ></span>
          <span>{{ currentAppEndpoint ? "Webhook: Aktif" : "Webhook: Belum Ada" }}</span>
        </span>
      </div>

      <!-- Sisi Kanan: Aksi Toolbar (Segarkan, Docs, Swagger) -->
      <div class="flex items-center gap-2 shrink-0">
        <button
          type="button"
          @click="refreshAll"
          :disabled="loading || loadingEndpoints || loadingDeliveries"
          class="inline-flex items-center gap-1.5 px-2.5 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-bold text-white transition cursor-pointer disabled:opacity-50 shrink-0"
          title="Segarkan Seluruh Data Developer"
        >
          <RefreshCw
            class="w-3.5 h-3.5"
            :class="{ 'animate-spin': loading || loadingEndpoints || loadingDeliveries }"
          />
          <span class="hidden sm:inline">Segarkan</span>
        </button>

        <a
          href="/docs/"
          target="_blank"
          class="inline-flex items-center gap-1.5 px-3 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-bold text-white transition cursor-pointer shrink-0"
        >
          <BookOpen class="w-3.5 h-3.5 text-gold" />
          <span>Dokumentasi</span>
          <ExternalLink class="w-3 h-3 opacity-60" />
        </a>

        <a
          href="/swagger"
          target="_blank"
          class="btn-gold h-8 px-3 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition cursor-pointer shadow-xs active:scale-95 shrink-0"
        >
          <span>Swagger API</span>
          <ExternalLink class="w-3 h-3 stroke-[2.5]" />
        </a>
      </div>
    </div>

    <!-- Pemilih Proyek SaaS Aktif (Flush Canvas dengan Garis Pemisah) -->
    <div
      v-if="appsList.length > 0"
      class="-mx-3.5 sm:-mx-4 md:-mx-6 px-3.5 sm:px-4 md:px-6 py-2.5 bg-jetblack/[0.02] border-b border-jetblack/15 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
    >
      <div class="flex items-center gap-2.5">
        <div
          class="w-6 h-6 rounded bg-forest/10 flex items-center justify-center text-forest shrink-0"
        >
          <Layers class="w-3.5 h-3.5" />
        </div>
        <div class="flex items-center gap-2 flex-wrap text-xs">
          <span class="font-bold text-jetblack">Proyek SaaS:</span>
          <span class="font-bold text-forest">{{ currentApp?.name || "Aplikasi" }}</span>
          <span class="text-jetblack/40 font-mono text-[11px]">({{ currentAppId }})</span>
          <span class="text-jetblack/30 hidden sm:inline">•</span>
          <span class="text-jetblack/60 text-[11px] hidden sm:inline"
            >Kredensial &amp; kode di bawah terikat ke proyek ini</span
          >
        </div>
      </div>
      <div class="flex items-center gap-2">
        <label class="text-[11px] font-semibold text-jetblack/50 hidden sm:inline"
          >Ganti Proyek:</label
        >
        <SearchPicker
          v-model="selectedAppId"
          :items="appsList"
          placeholder="Pilih Proyek SaaS..."
          search-placeholder="Cari software SaaS..."
          button-class="!h-8 !rounded-lg !min-w-[200px] sm:!min-w-[240px] !bg-white !border-jetblack/20 hover:!border-gold !shadow-2xs text-xs font-bold"
        />
      </div>
    </div>

    <!-- Kredensial Pengembang (Grid dengan Garis Pemisah / Dividers) -->
    <div class="-mx-3.5 sm:-mx-4 md:-mx-6 px-3.5 sm:px-4 md:px-6 border-b border-jetblack/15 py-5">
      <div
        class="grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-jetblack/15"
      >
        <!-- 1. App ID (Project Identifier) -->
        <div class="space-y-3 pb-5 lg:pb-0 lg:pr-6 flex flex-col justify-between">
          <div class="space-y-2">
            <div class="flex items-start justify-between">
              <div>
                <div class="flex items-center gap-1.5">
                  <Layers class="w-3.5 h-3.5 text-forest" />
                  <h3 class="text-xs font-bold uppercase tracking-wider text-jetblack">
                    App ID (Project Identifier)
                  </h3>
                </div>
                <p class="text-[11px] text-jetblack/50 mt-0.5">
                  Identitas unik proyek SaaS (<strong class="text-jetblack">{{
                    currentApp?.name || "Aplikasi"
                  }}</strong
                  >).
                </p>
              </div>
              <span
                class="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-forest/10 text-forest border border-forest/20 shrink-0"
              >
                PUBLIK
              </span>
            </div>

            <div class="space-y-1.5 pt-1">
              <div
                class="flex items-center justify-between p-2 rounded-lg bg-jetblack text-gold font-mono text-xs font-bold"
              >
                <span class="truncate mr-2 select-all">{{ currentAppId }}</span>
                <CopyButton
                  :text="currentAppId"
                  title="Salin App ID"
                  button-class="p-1 rounded bg-white/10 hover:bg-white/20 text-white transition cursor-pointer shrink-0"
                  icon-class="w-3.5 h-3.5"
                />
              </div>
              <p class="text-[10px] text-jetblack/50 leading-tight">
                Kirimkan pada parameter
                <code class="font-mono bg-jetblack/5 px-1 py-0.5 rounded text-[10px]">appId</code>
                saat checkout atau inisialisasi SDK.
              </p>
            </div>
          </div>

          <div
            class="pt-2 border-t border-jetblack/10 flex items-center justify-between text-[11px] text-jetblack/60"
          >
            <span
              >Slug:
              <strong class="text-jetblack font-mono">{{ currentApp?.slug || "-" }}</strong></span
            >
            <span
              >Harga:
              <strong class="text-jetblack font-semibold">{{
                formatRupiah(currentAppPrice)
              }}</strong></span
            >
          </div>
        </div>

        <!-- 2. Secret API Key (S2S) -->
        <div class="space-y-3 py-5 lg:py-0 lg:px-6 flex flex-col justify-between">
          <div class="space-y-2">
            <div class="flex items-start justify-between">
              <div>
                <div class="flex items-center gap-1.5">
                  <KeyRound class="w-3.5 h-3.5 text-crimson" />
                  <h3 class="text-xs font-bold uppercase tracking-wider text-jetblack">
                    Secret API Key (S2S)
                  </h3>
                </div>
                <p class="text-[11px] text-jetblack/50 mt-0.5">
                  Kunci backend server SaaS untuk transaksi S2S &amp; webhook.
                </p>
              </div>
              <span
                class="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-50 text-rose-700 border border-rose-200 shrink-0"
              >
                PRIVATE
              </span>
            </div>

            <div class="space-y-1.5 pt-1">
              <div
                class="flex items-center justify-between p-2 rounded-lg bg-jetblack/5 border border-jetblack/15 font-mono text-xs text-jetblack"
              >
                <span class="truncate mr-2 select-all">{{ displayedSecretKey }}</span>
                <div class="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    @click="revealSecret = !revealSecret"
                    class="p-1 rounded hover:bg-jetblack/10 text-jetblack/60 hover:text-jetblack transition cursor-pointer"
                    :title="revealSecret ? 'Sembunyikan' : 'Tampilkan'"
                  >
                    <EyeOff v-if="revealSecret" class="w-3.5 h-3.5" />
                    <Eye v-else class="w-3.5 h-3.5" />
                  </button>
                  <CopyButton
                    :text="secretApiKey"
                    title="Salin Secret Key"
                    button-class="p-1 rounded hover:bg-jetblack/10 text-jetblack/60 hover:text-jetblack transition cursor-pointer"
                    icon-class="w-3.5 h-3.5"
                  />
                </div>
              </div>
              <p class="text-[10px] text-crimson font-medium">
                ⚠️ Jangan pernah letakkan kunci ini di kodingan frontend browser.
              </p>
            </div>
          </div>

          <div class="pt-2 border-t border-jetblack/10 flex items-center justify-between">
            <span class="text-[10px] text-jetblack/50">Diperbarui: Otomatis</span>
            <button
              type="button"
              :disabled="rotatingSecret"
              @click="handleRotateSecret"
              class="inline-flex items-center gap-1.5 text-xs font-bold text-crimson hover:text-rose-700 transition cursor-pointer disabled:opacity-50"
            >
              <RefreshCw class="w-3 h-3" :class="{ 'animate-spin': rotatingSecret }" />
              <span>Rotasi Secret Key</span>
            </button>
          </div>
        </div>

        <!-- 3. Base URL & Client Key -->
        <div class="space-y-3 pt-5 lg:pt-0 lg:pl-6 flex flex-col justify-between">
          <div class="space-y-2">
            <div class="flex items-start justify-between">
              <div>
                <div class="flex items-center gap-1.5">
                  <Globe class="w-3.5 h-3.5 text-forest" />
                  <h3 class="text-xs font-bold uppercase tracking-wider text-jetblack">
                    Base URL &amp; Client Key
                  </h3>
                </div>
                <p class="text-[11px] text-jetblack/50 mt-0.5">
                  Endpoint resmi Tertaut dan identitas builder pengembang.
                </p>
              </div>
              <span
                class="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-forest/10 text-forest border border-forest/20 shrink-0"
              >
                PUBLIK
              </span>
            </div>

            <div class="space-y-2 pt-1">
              <div>
                <label
                  class="block text-[10px] font-bold uppercase tracking-wider text-jetblack/50 mb-0.5"
                >
                  Base URL Endpoint
                </label>
                <div
                  class="flex items-center justify-between p-1.5 rounded-lg bg-jetblack/5 border border-jetblack/15 font-mono text-xs text-jetblack"
                >
                  <span class="truncate mr-2">{{ baseUrl }}</span>
                  <CopyButton
                    :text="baseUrl"
                    title="Salin Base URL"
                    button-class="p-1 rounded hover:bg-jetblack/10 text-jetblack/60 hover:text-jetblack transition cursor-pointer"
                    icon-class="w-3.5 h-3.5"
                  />
                </div>
              </div>

              <div>
                <label
                  class="block text-[10px] font-bold uppercase tracking-wider text-jetblack/50 mb-0.5"
                >
                  Publishable Client Key
                </label>
                <div
                  class="flex items-center justify-between p-1.5 rounded-lg bg-jetblack/5 border border-jetblack/15 font-mono text-xs text-jetblack"
                >
                  <span class="truncate mr-2">{{ builderApiKey || "tt_live_public_key" }}</span>
                  <CopyButton
                    :text="builderApiKey || 'tt_live_public_key'"
                    title="Salin Public Key"
                    button-class="p-1 rounded hover:bg-jetblack/10 text-jetblack/60 hover:text-jetblack transition cursor-pointer"
                    icon-class="w-3.5 h-3.5"
                  />
                </div>
              </div>
            </div>
          </div>

          <div class="pt-2 border-t border-jetblack/10 text-[11px] text-jetblack/60 truncate">
            Akun: <strong class="text-jetblack font-semibold">{{ builderEmail }}</strong>
          </div>
        </div>
      </div>
    </div>

    <!-- Section: Panduan Integrasi Docs Callout (Compact & Rapi) -->
    <div
      class="-mx-3.5 sm:-mx-4 md:-mx-6 px-3.5 sm:px-4 md:px-6 py-3 bg-jetblack/[0.02] border-b border-jetblack/15 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
    >
      <div class="flex items-center gap-2">
        <BookOpen class="w-4 h-4 text-gold shrink-0" />
        <span class="text-jetblack/70">
          Butuh panduan integrasi lengkap untuk <strong>@tertaut/sdk</strong>, cURL S2S, Node.js,
          Python, atau PHP?
        </span>
      </div>
      <a
        href="/docs/api/sdk"
        target="_blank"
        class="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-jetblack hover:bg-jetblack-hover text-white text-xs font-bold transition shadow-2xs shrink-0 self-start sm:self-auto"
      >
        <span>Buka Dokumentasi SDK</span>
        <ExternalLink class="w-3 h-3 text-gold" />
      </a>
    </div>

    <!-- Section: Webhook & Outbox Tabs (Flush Canvas, Unified Tab Bar) -->
    <div
      class="-mx-3.5 sm:-mx-4 md:-mx-6 px-3.5 sm:px-4 md:px-6 border-b border-jetblack/15 bg-jetblack/[0.02] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
    >
      <!-- Sisi Kiri: Navigasi Tab -->
      <div class="flex items-center gap-1 sm:gap-2 -mb-px overflow-x-auto no-scrollbar">
        <button
          type="button"
          @click="activeWebhookTab = 'endpoint'"
          class="relative py-3 px-3 sm:px-4 text-xs font-bold transition flex items-center gap-2 cursor-pointer border-b-2 shrink-0"
          :class="
            activeWebhookTab === 'endpoint'
              ? 'border-gold text-jetblack bg-white/70 shadow-2xs rounded-t-lg'
              : 'border-transparent text-jetblack/50 hover:text-jetblack hover:bg-white/30'
          "
        >
          <Webhook
            class="w-3.5 h-3.5"
            :class="activeWebhookTab === 'endpoint' ? 'text-gold' : 'text-jetblack/40'"
          />
          <span>Endpoint Webhook</span>
          <span
            class="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold"
            :class="
              currentAppEndpoint ? 'bg-forest/15 text-forest' : 'bg-jetblack/10 text-jetblack/50'
            "
          >
            {{ currentAppEndpoint ? "1 URL Terpasang" : "Belum Ada" }}
          </span>
        </button>

        <button
          type="button"
          @click="activeWebhookTab = 'logs'"
          class="relative py-3 px-3 sm:px-4 text-xs font-bold transition flex items-center gap-2 cursor-pointer border-b-2 shrink-0"
          :class="
            activeWebhookTab === 'logs'
              ? 'border-gold text-jetblack bg-white/70 shadow-2xs rounded-t-lg'
              : 'border-transparent text-jetblack/50 hover:text-jetblack hover:bg-white/30'
          "
        >
          <Radio
            class="w-3.5 h-3.5"
            :class="
              activeWebhookTab === 'logs' ? 'text-emerald-600 animate-pulse' : 'text-jetblack/40'
            "
          />
          <span>Riwayat Pengiriman (Outbox)</span>
          <span
            class="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-jetblack/10 text-jetblack"
          >
            {{ deliveries.length }}
          </span>
        </button>
      </div>

      <!-- Sisi Kanan: Quick Context Action -->
      <div class="py-2 flex items-center gap-2 shrink-0">
        <template v-if="activeWebhookTab === 'endpoint'">
          <button
            v-if="currentAppEndpoint"
            type="button"
            @click="openWebhookModal(true)"
            class="h-8 px-3 rounded-lg border border-jetblack/20 text-xs font-bold text-jetblack hover:bg-jetblack/5 inline-flex items-center gap-1.5 transition cursor-pointer"
          >
            <Pencil class="w-3.5 h-3.5 text-jetblack/60" />
            <span>Edit Webhook</span>
          </button>
          <button
            v-else
            type="button"
            @click="openWebhookModal(false)"
            class="btn-gold h-8 px-3 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition cursor-pointer shadow-xs active:scale-95"
          >
            <Plus class="w-3.5 h-3.5 stroke-[3]" />
            <span>Atur Webhook untuk Proyek Ini</span>
          </button>
        </template>
        <template v-else>
          <div class="flex items-center gap-1 bg-white border border-jetblack/15 rounded-lg p-0.5">
            <button
              type="button"
              @click="deliveriesScope = 'current'"
              class="px-2 py-1 text-[11px] font-bold rounded cursor-pointer transition"
              :class="
                deliveriesScope === 'current'
                  ? 'bg-jetblack text-white'
                  : 'text-jetblack/60 hover:text-jetblack'
              "
            >
              Proyek Ini ({{ currentAppDeliveriesCount }})
            </button>
            <button
              type="button"
              @click="deliveriesScope = 'all'"
              class="px-2 py-1 text-[11px] font-bold rounded cursor-pointer transition"
              :class="
                deliveriesScope === 'all'
                  ? 'bg-jetblack text-white'
                  : 'text-jetblack/60 hover:text-jetblack'
              "
            >
              Semua ({{ deliveries.length }})
            </button>
          </div>
          <button
            type="button"
            @click="loadDeliveries"
            :disabled="loadingDeliveries"
            class="px-3 h-8 rounded-lg border border-jetblack/20 text-xs font-bold text-jetblack hover:bg-jetblack/5 inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition"
          >
            <RefreshCw class="w-3.5 h-3.5" :class="{ 'animate-spin': loadingDeliveries }" />
            <span class="hidden sm:inline">Muat Ulang</span>
          </button>
        </template>
      </div>
    </div>

    <!-- Tab 1: Webhook Endpoint (1 URL per Proyek) -->
    <div
      v-if="activeWebhookTab === 'endpoint'"
      class="-mx-3.5 sm:-mx-4 md:-mx-6 px-3.5 sm:px-4 md:px-6 py-6 border-b border-jetblack/15"
    >
      <div v-if="loadingEndpoints" class="space-y-4">
        <TableSkeleton :columns="4" :rows="2" />
      </div>

      <!-- Jika Proyek Memiliki Endpoint -->
      <div
        v-else-if="currentAppEndpoint"
        class="bg-white rounded-xl border border-jetblack/15 shadow-2xs overflow-hidden"
      >
        <!-- Card Header: Identitas Proyek & Aksi Utama -->
        <div
          class="flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 bg-jetblack/[0.02] border-b border-jetblack/15"
        >
          <div class="flex items-center gap-3">
            <div
              class="w-9 h-9 rounded-xl bg-forest/10 flex items-center justify-center text-forest shrink-0"
            >
              <Webhook class="w-4 h-4 text-gold" />
            </div>
            <div>
              <div class="flex items-center gap-2 flex-wrap">
                <span class="text-xs font-bold text-jetblack">{{ currentApp?.name }}</span>
                <span class="font-mono text-[10px] text-jetblack/40">({{ currentAppId }})</span>
                <StatusBadge
                  :status="currentAppEndpoint.isActive ? 'ACTIVE' : 'INACTIVE'"
                  :label="currentAppEndpoint.isActive ? 'Aktif' : 'Nonaktif'"
                />
              </div>
              <p class="text-[11px] text-jetblack/60 mt-0.5">
                Setiap proyek SaaS hanya menggunakan 1 URL endpoint webhook penerima event.
              </p>
            </div>
          </div>

          <!-- Tombol Aksi Cepat pada Endpoint -->
          <div class="flex items-center gap-2 flex-wrap self-start md:self-auto">
            <button
              type="button"
              @click="handleToggleEndpointActive"
              class="px-2.5 h-8 rounded-lg text-[11px] font-bold border transition cursor-pointer"
              :class="
                currentAppEndpoint.isActive
                  ? 'border-amber-600/30 text-amber-700 bg-amber-50/50 hover:bg-amber-50'
                  : 'border-forest/30 text-forest bg-forest/5 hover:bg-forest/10'
              "
            >
              {{ currentAppEndpoint.isActive ? "Jeda Sementara" : "Aktifkan Kembali" }}
            </button>

            <button
              type="button"
              @click="handleTestCurrentEndpoint"
              class="px-3 h-8 rounded-lg text-xs font-bold text-forest bg-forest/10 hover:bg-forest/20 transition inline-flex items-center gap-1.5 cursor-pointer shadow-2xs active:scale-95"
              title="Kirim payload uji coba (ping) ke URL ini"
            >
              <Send class="w-3 h-3" />
              <span>Test Ping</span>
            </button>

            <button
              type="button"
              @click="openWebhookModal(true)"
              class="px-3 h-8 rounded-lg text-xs font-bold text-jetblack bg-jetblack/5 hover:bg-jetblack/10 transition inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Pencil class="w-3 h-3 text-jetblack/60" />
              <span>Ubah URL</span>
            </button>

            <button
              type="button"
              @click="handleDeleteCurrentEndpoint"
              class="px-2.5 h-8 rounded-lg text-xs font-bold text-crimson hover:bg-rose-50 transition inline-flex items-center gap-1 cursor-pointer"
              title="Hapus webhook untuk proyek ini"
            >
              <Trash2 class="w-3.5 h-3.5" />
              <span>Hapus</span>
            </button>
          </div>
        </div>

        <!-- Card Body: URL Endpoint, Secret HMAC & Events -->
        <div class="p-4 sm:p-5 space-y-4">
          <!-- 1. URL Endpoint -->
          <div>
            <label class="text-[11px] font-bold text-jetblack/70 mb-1.5 flex items-center gap-1.5">
              <Globe class="w-3.5 h-3.5 text-gold" />
              <span>URL Endpoint HTTP POST</span>
            </label>
            <div
              class="flex items-center justify-between p-2.5 sm:p-3 rounded-lg bg-jetblack/[0.03] border border-jetblack/15 font-mono text-xs font-semibold text-jetblack"
            >
              <span class="truncate select-all">{{ currentAppEndpoint.url }}</span>
              <div class="flex items-center gap-2 shrink-0 ml-3">
                <CopyButton :text="currentAppEndpoint.url" title="Salin URL Endpoint" />
              </div>
            </div>
          </div>

          <!-- 2. Webhook Secret (HMAC Signing Secret) -->
          <div>
            <div class="flex items-center justify-between mb-1.5">
              <label class="text-[11px] font-bold text-jetblack/70 flex items-center gap-1.5">
                <KeyRound class="w-3.5 h-3.5 text-forest" />
                <span>Webhook Signing Secret (HMAC-SHA256)</span>
              </label>
              <span class="text-[10px] text-jetblack/50">Header: X-Tertaut-Signature</span>
            </div>
            <div
              class="flex items-center justify-between p-2.5 sm:p-3 rounded-lg bg-jetblack/[0.03] border border-jetblack/15 font-mono text-xs"
            >
              <span class="text-jetblack/80 font-bold tracking-wider select-all">
                {{ displayedEndpointSecret }}
              </span>
              <div class="flex items-center gap-2 shrink-0 ml-3">
                <button
                  type="button"
                  @click="revealWebhookSecret = !revealWebhookSecret"
                  class="text-jetblack/50 hover:text-jetblack p-1 cursor-pointer transition"
                  :title="revealWebhookSecret ? 'Sembunyikan' : 'Tampilkan Secret'"
                >
                  <EyeOff v-if="revealWebhookSecret" class="w-3.5 h-3.5" />
                  <Eye v-else class="w-3.5 h-3.5" />
                </button>
                <CopyButton :text="currentAppEndpoint.secret" title="Salin Webhook Secret" />
                <button
                  type="button"
                  @click="handleRotateCurrentEndpointSecret"
                  :disabled="rotatingWebhookSecret"
                  class="px-2 py-1 rounded text-[11px] font-bold text-jetblack/70 hover:text-jetblack bg-jetblack/5 hover:bg-jetblack/10 transition inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  title="Rotasi kunci rahasia webhook"
                >
                  <RefreshCw class="w-3 h-3" :class="{ 'animate-spin': rotatingWebhookSecret }" />
                  <span>Rotasi</span>
                </button>
              </div>
            </div>
          </div>

          <!-- 3. Event Langganan -->
          <div>
            <label class="text-[11px] font-bold text-jetblack/70 mb-1.5 block">
              Event Notifikasi yang Dilanggan
            </label>
            <div class="flex flex-wrap gap-1.5">
              <template v-if="!currentAppEndpoint.events || currentAppEndpoint.events.length === 0">
                <span
                  class="px-2.5 py-1 rounded-md text-[10px] font-mono font-bold bg-forest/10 text-forest border border-forest/20 inline-flex items-center gap-1"
                >
                  <Sparkles class="w-3 h-3 text-gold" />
                  <span>Semua Event (Wildcard: Transaksi Pembayaran &amp; Siklus Lisensi)</span>
                </span>
              </template>
              <template v-else>
                <span
                  v-for="ev in currentAppEndpoint.events"
                  :key="ev"
                  class="px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold bg-jetblack/5 text-jetblack border border-jetblack/10"
                >
                  {{ ev }}
                </span>
              </template>
            </div>
          </div>
        </div>

        <!-- Card Footer: Info Panduan Keamanan Verifikasi HMAC -->
        <div
          class="px-4 py-3 bg-jetblack/[0.02] border-t border-jetblack/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-jetblack/60"
        >
          <div class="flex items-center gap-2">
            <Lock class="w-3.5 h-3.5 text-forest shrink-0" />
            <span>
              Verifikasi signature pada server backend Anda menggunakan header:
              <code
                class="font-mono text-[10px] font-bold text-jetblack bg-jetblack/5 px-1 py-0.5 rounded"
                >X-Tertaut-Signature: hmac-sha256=&lt;hash&gt;</code
              >
            </span>
          </div>
          <button
            type="button"
            @click="activeWebhookTab = 'logs'"
            class="text-forest hover:underline font-bold text-xs inline-flex items-center gap-1 cursor-pointer self-start sm:self-auto shrink-0"
          >
            <span>Buka Outbox Logs</span>
            <ExternalLink class="w-3 h-3" />
          </button>
        </div>
      </div>

      <!-- Jika Proyek Belum Memiliki Endpoint Webhook -->
      <div
        v-else
        class="bg-white rounded-xl border border-dashed border-jetblack/25 p-8 text-center space-y-3.5"
      >
        <div
          class="w-12 h-12 rounded-2xl bg-gold/15 text-gold flex items-center justify-center mx-auto shadow-2xs"
        >
          <Webhook class="w-6 h-6" />
        </div>
        <div class="max-w-md mx-auto space-y-1">
          <h3 class="text-sm font-bold text-jetblack">
            Belum Ada Webhook untuk {{ currentApp?.name || "Proyek Ini" }}
          </h3>
          <p class="text-xs text-jetblack/60 leading-relaxed">
            Setiap proyek SaaS hanya membutuhkan 1 URL webhook endpoint. Daftarkan URL backend Anda
            untuk menerima notifikasi HTTP POST otomatis saat pembayaran berhasil atau lisensi
            diaktifkan.
          </p>
        </div>
        <div class="pt-2">
          <button
            type="button"
            @click="openWebhookModal(false)"
            class="btn-gold h-9 px-4 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95 transition"
          >
            <Plus class="w-4 h-4 stroke-[3]" />
            <span>Atur Webhook untuk {{ currentApp?.name || "Proyek Ini" }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Tab 2: Riwayat Pengiriman Webhook (Outbox Logs) -->
    <div
      v-else-if="activeWebhookTab === 'logs'"
      class="-mx-3.5 sm:-mx-4 md:-mx-6 px-3.5 sm:px-4 md:px-6 py-5 space-y-3"
    >
      <div
        class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-jetblack/15 pb-3"
      >
        <div>
          <div class="flex items-center gap-2">
            <Radio class="w-4 h-4 text-emerald-600 animate-pulse" />
            <h2 class="text-sm font-bold text-jetblack">
              Riwayat Pengiriman Webhook (Outbox Logs)
            </h2>
          </div>
          <p class="text-xs text-jetblack/60 mt-0.5">
            Log dispatch webhook real-time ke server Anda dengan status pengiriman dan kemampuan
            retry manual.
          </p>
        </div>
        <div class="flex items-center gap-2">
          <button
            type="button"
            @click="loadDeliveries"
            :disabled="loadingDeliveries"
            class="px-3 h-8 rounded-lg border border-jetblack/20 text-xs font-bold text-jetblack hover:bg-jetblack/5 inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition"
          >
            <RefreshCw class="w-3.5 h-3.5" :class="{ 'animate-spin': loadingDeliveries }" />
            <span>Muat Ulang Log</span>
          </button>
        </div>
      </div>

      <TableContainer>
        <template #head>
          <tr>
            <th class="py-2.5 pr-3 pl-3.5 sm:pl-4 md:px-6">Status</th>
            <th class="py-2.5 px-3">Event</th>
            <th class="py-2.5 px-3">Proyek SaaS</th>
            <th class="py-2.5 px-3">Target Endpoint</th>
            <th class="py-2.5 px-3 text-center">Percobaan</th>
            <th class="py-2.5 px-3">Terakhir Dicoba</th>
            <th class="py-2.5 pl-3 pr-3.5 sm:pr-4 md:pr-6 text-right">Aksi</th>
          </tr>
        </template>

        <TableSkeleton v-if="loadingDeliveries" :columns="7" :rows="4" />
        <tr v-else-if="filteredDeliveries.length === 0">
          <td colspan="7" class="py-12 px-3.5 sm:px-4 md:px-6">
            <EmptyState
              :icon="Radio"
              :title="
                deliveriesScope === 'current'
                  ? `Belum ada log pengiriman untuk ${currentApp?.name || 'proyek ini'}`
                  : 'Belum ada pengiriman webhook'
              "
              description="Log pengiriman akan muncul secara otomatis ketika terjadi event pembayaran atau saat Anda menguji endpoint dengan Test Ping."
              container-class="border-0 bg-transparent py-4"
            />
          </td>
        </tr>
        <tr
          v-else
          v-for="del in filteredDeliveries"
          :key="del.id"
          class="hover:bg-jetblack/[0.02] transition"
        >
          <td class="py-2.5 pr-3 pl-3.5 sm:pl-4 md:px-6">
            <StatusBadge
              :status="
                del.status === 'SENT' ? 'SUCCESS' : del.status === 'FAILED' ? 'FAILED' : 'PENDING'
              "
              :label="
                del.status === 'SENT' ? 'Terkirim' : del.status === 'FAILED' ? 'Gagal' : 'Pending'
              "
            />
          </td>
          <td class="py-2.5 px-3">
            <span
              class="font-mono text-[11px] font-bold text-jetblack bg-jetblack/5 px-2 py-0.5 rounded"
            >
              {{ del.event || del.payload?.event || "event" }}
            </span>
          </td>
          <td class="py-2.5 px-3">
            <span
              class="font-mono text-[11px] font-semibold text-forest bg-forest/10 px-2 py-0.5 rounded border border-forest/15"
            >
              {{
                del.payload?.data?.appName ||
                del.payload?.data?.appId ||
                del.payload?.appId ||
                "SaaS"
              }}
            </span>
          </td>
          <td class="py-2.5 px-3">
            <div
              class="font-mono text-[11px] text-jetblack truncate max-w-[220px]"
              :title="getEndpointUrl(del.endpointId)"
            >
              {{ getEndpointUrl(del.endpointId) }}
            </div>
          </td>
          <td class="py-2.5 px-3 text-center">
            <span class="text-xs font-semibold text-jetblack/70"> {{ del.attempts || 1 }}x </span>
          </td>
          <td class="py-2.5 px-3 text-jetblack/60 text-[11px]">
            {{ formatTimestamp(del.lastAttemptAt || del.createdAt) }}
          </td>
          <td class="py-2.5 pl-3 pr-3.5 sm:pr-4 md:pr-6 text-right">
            <div class="flex items-center justify-end gap-1.5">
              <button
                type="button"
                @click="openDeliveryDetail(del)"
                class="px-2 py-1 rounded text-[11px] font-bold text-jetblack/70 bg-jetblack/5 hover:bg-jetblack/10 transition inline-flex items-center gap-1 cursor-pointer"
                title="Lihat detail payload JSON"
              >
                <FileJson class="w-3 h-3 text-gold" />
                <span>Payload</span>
              </button>
              <button
                type="button"
                :disabled="retryingDeliveryId === del.id"
                @click="handleRetryDelivery(del.id)"
                class="px-2 py-1 rounded text-[11px] font-bold text-forest bg-forest/10 hover:bg-forest/20 transition inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                title="Coba kirim ulang webhook sekarang"
              >
                <RefreshCw
                  class="w-3 h-3"
                  :class="{ 'animate-spin': retryingDeliveryId === del.id }"
                />
                <span>{{ retryingDeliveryId === del.id ? "Mengirim..." : "Retry" }}</span>
              </button>
            </div>
          </td>
        </tr>
      </TableContainer>
    </div>

    <!-- Modal Atur / Ubah Webhook Proyek -->
    <BaseModal
      :show="isWebhookModalOpen"
      :title="
        editingEndpointId
          ? `Ubah Webhook: ${currentApp?.name || 'Proyek'}`
          : `Atur Webhook: ${currentApp?.name || 'Proyek'}`
      "
      max-width="max-w-lg"
      @close="isWebhookModalOpen = false"
    >
      <template #title-icon>
        <Webhook class="w-4 h-4 text-gold" />
      </template>

      <div class="p-6 space-y-4 text-xs">
        <!-- Badge Target Proyek -->
        <div class="p-2.5 rounded-lg bg-forest/5 border border-forest/20 flex items-center gap-2">
          <Layers class="w-4 h-4 text-forest shrink-0" />
          <div class="text-[11px]">
            <span class="text-jetblack/60">Target Proyek SaaS:</span>
            <strong class="text-jetblack ml-1">{{ currentApp?.name }}</strong>
            <code class="text-jetblack/50 ml-1 font-mono text-[10px]">({{ currentAppId }})</code>
          </div>
        </div>

        <div>
          <label class="block text-xs font-bold text-jetblack mb-1">
            URL Webhook Server SaaS
          </label>
          <input
            v-model="webhookUrlInput"
            type="url"
            placeholder="https://api.namasaas.com/webhooks/tertaut"
            class="w-full px-3 py-2 rounded-lg bg-white border border-jetblack/20 text-xs text-jetblack placeholder:text-jetblack/35 focus:outline-none focus:border-gold font-mono"
          />
          <p class="text-[10px] text-jetblack/50 mt-1">
            Endpoint ini wajib dapat diakses publik dan menerima HTTP POST request bertanda tangan
            HMAC-SHA256.
          </p>
        </div>

        <div>
          <div class="flex items-center justify-between mb-1.5">
            <label class="font-bold text-xs text-jetblack">Event yang Dilanggan</label>
            <span class="text-[10px] text-jetblack/50">
              {{
                webhookEventsInput.length === 0
                  ? "Semua event aktif (default)"
                  : `${webhookEventsInput.length} event dipilih`
              }}
            </span>
          </div>
          <div
            class="flex flex-wrap gap-1.5 p-2 rounded-xl bg-jetblack/[0.02] border border-jetblack/10 max-h-44 overflow-y-auto"
          >
            <button
              type="button"
              v-for="ev in ALL_WEBHOOK_EVENTS"
              :key="ev.id"
              @click="toggleWebhookEvent(ev.id)"
              :class="[
                'px-2 py-1 rounded-md text-[10px] font-mono font-bold transition cursor-pointer border',
                webhookEventsInput.includes(ev.id)
                  ? 'bg-jetblack text-white border-jetblack shadow-2xs'
                  : 'bg-white text-jetblack/60 border-jetblack/15 hover:border-jetblack/40',
              ]"
            >
              {{ ev.label }}
            </button>
          </div>
          <p class="text-[10px] text-jetblack/40 mt-1">
            Kosongkan seleksi di atas jika ingin menerima seluruh event pembayaran dan siklus
            lisensi secara otomatis.
          </p>
        </div>

        <div v-if="!editingEndpointId">
          <label class="block text-xs font-bold text-jetblack mb-1">
            Secret Kustom (Opsional)
          </label>
          <input
            v-model="webhookSecretInput"
            type="password"
            placeholder="Kosongkan untuk generate otomatis (tt_whsec_...)"
            class="w-full px-3 py-2 rounded-lg bg-white border border-jetblack/20 text-xs text-jetblack placeholder:text-jetblack/35 focus:outline-none focus:border-gold font-mono"
          />
        </div>

        <div
          v-if="webhookError"
          class="p-2.5 rounded-lg bg-rose-50 text-rose-700 text-xs font-medium border border-rose-200"
        >
          {{ webhookError }}
        </div>
      </div>

      <template #footer>
        <div class="flex items-center justify-end gap-2">
          <button
            type="button"
            @click="isWebhookModalOpen = false"
            class="px-3.5 py-1.5 rounded-lg border border-jetblack/20 text-xs font-bold text-jetblack/70 hover:text-jetblack hover:bg-jetblack/5 cursor-pointer"
          >
            Batal
          </button>
          <button
            type="button"
            :disabled="isSubmittingWebhook"
            @click="handleSaveWebhook"
            class="btn-gold px-4 py-1.5 rounded-lg text-xs font-bold cursor-pointer disabled:opacity-50"
          >
            {{ isSubmittingWebhook ? "Menyimpan..." : "Simpan Webhook" }}
          </button>
        </div>
      </template>
    </BaseModal>

    <!-- Modal Payload Detail Webhook -->
    <DevDeliveryModal
      :is-open="isDeliveryModalOpen"
      :delivery="selectedDelivery"
      :retrying="retryingDeliveryId === selectedDelivery?.id"
      @close="isDeliveryModalOpen = false"
      @retry="handleRetryDelivery"
    />
  </div>
</template>
