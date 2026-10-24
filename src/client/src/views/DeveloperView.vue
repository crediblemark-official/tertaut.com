<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { api } from "../lib/api";
import { dashboardEnv, envPath } from "../lib/environment";
import { useClipboard } from "../composables/useClipboard";
import { useConfirm } from "../composables/useConfirm";
import { formatRupiah } from "../lib/utils";
import type { AppItem } from "../types/app";
import DevDeliveryModal from "../components/developer/DevDeliveryModal.vue";
import TableSkeleton from "../components/common/TableSkeleton.vue";
import TableContainer from "../components/common/TableContainer.vue";
import SearchPicker from "../components/common/SearchPicker.vue";
import {
  KeyRound,
  ShieldAlert,
  Copy,
  Check,
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
} from "lucide-vue-next";

const env = dashboardEnv;
const { copied, copy: copyClipboard } = useClipboard();
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

// Create Webhook modal state
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

async function handleCreateWebhook() {
  if (!webhookUrlInput.value.trim().startsWith("http")) {
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

    const res = await api.createWebhook({
      url: webhookUrlInput.value.trim(),
      events: eventsToSend,
      secret: webhookSecretInput.value.trim() || undefined,
    });
    if (res.success) {
      isWebhookModalOpen.value = false;
      webhookUrlInput.value = "";
      webhookEventsInput.value = [];
      webhookSecretInput.value = "";
      setFeedback("success", "Endpoint webhook berhasil didaftarkan!");
      await loadWebhooks();
    } else {
      webhookError.value = res.error || "Gagal mendaftarkan webhook";
    }
  } catch (err: any) {
    webhookError.value = err?.message || "Terjadi kesalahan";
  } finally {
    isSubmittingWebhook.value = false;
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
          v-if="endpoints.length > 0"
          class="text-[10px] px-2 py-0.5 rounded-md bg-white/10 text-white/90 font-mono font-medium hidden sm:inline-flex shrink-0"
        >
          {{ endpoints.length }} Webhook Aktif
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
                <button
                  type="button"
                  @click="copyClipboard(currentAppId)"
                  class="p-1 rounded bg-white/10 hover:bg-white/20 text-white transition cursor-pointer shrink-0"
                  title="Salin App ID"
                >
                  <Check v-if="copied" class="w-3.5 h-3.5 text-gold stroke-[3]" />
                  <Copy v-else class="w-3.5 h-3.5" />
                </button>
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
                  <button
                    type="button"
                    @click="copyClipboard(secretApiKey)"
                    class="p-1 rounded hover:bg-jetblack/10 text-jetblack/60 hover:text-jetblack transition cursor-pointer"
                    title="Salin Secret Key"
                  >
                    <Check v-if="copied" class="w-3.5 h-3.5 text-forest stroke-[3]" />
                    <Copy v-else class="w-3.5 h-3.5" />
                  </button>
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
                  <button
                    type="button"
                    @click="copyClipboard(baseUrl)"
                    class="p-1 rounded hover:bg-jetblack/10 text-jetblack/60 hover:text-jetblack transition cursor-pointer"
                    title="Salin Base URL"
                  >
                    <Copy class="w-3.5 h-3.5" />
                  </button>
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
                  <button
                    type="button"
                    @click="copyClipboard(builderApiKey)"
                    class="p-1 rounded hover:bg-jetblack/10 text-jetblack/60 hover:text-jetblack transition cursor-pointer"
                    title="Salin Public Key"
                  >
                    <Copy class="w-3.5 h-3.5" />
                  </button>
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

    <!-- Section: Webhook Endpoints (Garis Pemisah, Flush Canvas) -->
    <div
      class="-mx-3.5 sm:-mx-4 md:-mx-6 px-3.5 sm:px-4 md:px-6 border-b border-jetblack/15 py-5 space-y-3"
    >
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div class="flex items-center gap-2">
            <Webhook class="w-4 h-4 text-gold" />
            <h2 class="text-sm font-bold text-jetblack">
              Webhook Endpoints (Notifikasi Pembayaran &amp; Lisensi)
            </h2>
          </div>
          <p class="text-xs text-jetblack/60 mt-0.5">
            Tertaut mengirimkan notifikasi HTTP POST bertanda tangan HMAC saat transaksi berhasil
            maupun perubahan status lisensi &amp; seat perangkat.
          </p>
        </div>

        <button
          type="button"
          @click="isWebhookModalOpen = true"
          class="btn-gold h-8 px-3 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition cursor-pointer shadow-xs active:scale-95 shrink-0"
        >
          <Plus class="w-3.5 h-3.5 stroke-[3]" />
          <span>Tambah Endpoint Webhook</span>
        </button>
      </div>

      <!-- Table of Registered Webhooks (Flush Edge-to-Edge) -->
      <TableContainer>
        <template #head>
          <tr>
            <th class="py-2.5 pr-3 pl-3.5 sm:pl-4 md:px-6">URL Endpoint</th>
            <th class="py-2.5 px-3">Webhook Secret (HMAC)</th>
            <th class="py-2.5 px-3">Events Langganan</th>
            <th class="py-2.5 px-3">Status</th>
            <th class="py-2.5 pl-3 pr-3.5 sm:pr-4 md:pr-6 text-right">Aksi</th>
          </tr>
        </template>

        <TableSkeleton v-if="loadingEndpoints" :columns="5" :rows="3" />
        <tr v-else-if="endpoints.length === 0">
          <td colspan="5" class="py-8 px-3.5 sm:px-4 md:px-6 text-center text-jetblack/50">
            Belum ada endpoint webhook terdaftar. Klik tombol di atas untuk menambahkan URL webhook
            backend SaaS Anda.
          </td>
        </tr>
        <tr v-else v-for="ep in endpoints" :key="ep.id" class="hover:bg-jetblack/[0.02] transition">
          <td class="py-3 pr-3 pl-3.5 sm:pl-4 md:px-6 font-mono font-semibold text-jetblack">
            {{ ep.url }}
          </td>
          <td class="py-3 px-3 font-mono text-jetblack/70">
            <div class="flex items-center gap-1.5">
              <span class="bg-jetblack/5 px-1.5 py-0.5 rounded text-[10px]">
                {{ ep.secret ? ep.secret.slice(0, 10) + "••••" : "tt_whsec_••••" }}
              </span>
              <button
                type="button"
                @click="copyClipboard(ep.secret)"
                class="hover:text-forest transition p-0.5 cursor-pointer"
                title="Salin Webhook Secret"
              >
                <Copy class="w-3 h-3" />
              </button>
            </div>
          </td>
          <td class="py-3 px-3">
            <span
              class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200"
            >
              {{ ep.events?.length ? ep.events.join(", ") : "Semua Event" }}
            </span>
          </td>
          <td class="py-3 px-3">
            <span
              class="px-2 py-0.5 rounded-full text-[10px] font-bold"
              :class="
                ep.isActive
                  ? 'bg-forest/10 text-forest border border-forest/20'
                  : 'bg-neutral-100 text-neutral-500'
              "
            >
              {{ ep.isActive ? "Aktif" : "Nonaktif" }}
            </span>
          </td>
          <td class="py-3 pl-3 pr-3.5 sm:pr-4 md:pr-6 text-right">
            <div class="flex items-center justify-end gap-1.5">
              <button
                type="button"
                @click="handleTestWebhook(ep.id)"
                class="px-2 py-1 rounded text-[11px] font-bold text-forest bg-forest/10 hover:bg-forest/20 transition inline-flex items-center gap-1 cursor-pointer"
                title="Kirim payload ping uji coba ke endpoint ini"
              >
                <Send class="w-2.5 h-2.5" />
                <span>Test Ping</span>
              </button>
              <button
                type="button"
                @click="handleDeleteWebhook(ep.id)"
                class="px-2 py-1 rounded text-[11px] font-bold text-crimson hover:bg-rose-50 transition inline-flex items-center gap-1 cursor-pointer"
                title="Hapus webhook"
              >
                <Trash2 class="w-3 h-3" />
                <span>Hapus</span>
              </button>
            </div>
          </td>
        </tr>
      </TableContainer>
    </div>

    <!-- Section: Webhook Outbox Delivery Logs (Garis Pemisah, Flush Canvas) -->
    <div class="-mx-3.5 sm:-mx-4 md:-mx-6 px-3.5 sm:px-4 md:px-6 py-5 space-y-3">
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
        <button
          type="button"
          @click="loadDeliveries"
          :disabled="loadingDeliveries"
          class="px-3 h-8 rounded-lg border border-jetblack/20 text-xs font-bold text-jetblack/70 hover:text-jetblack hover:bg-jetblack/5 inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50 self-start sm:self-auto transition"
        >
          <RefreshCw class="w-3.5 h-3.5" :class="{ 'animate-spin': loadingDeliveries }" />
          <span>Muat Ulang Log</span>
        </button>
      </div>

      <TableContainer>
        <template #head>
          <tr>
            <th class="py-2.5 pr-3 pl-3.5 sm:pl-4 md:px-6">Status</th>
            <th class="py-2.5 px-3">Event</th>
            <th class="py-2.5 px-3">Target Endpoint</th>
            <th class="py-2.5 px-3 text-center">Percobaan</th>
            <th class="py-2.5 px-3">Terakhir Dicoba</th>
            <th class="py-2.5 pl-3 pr-3.5 sm:pr-4 md:pr-6 text-right">Aksi</th>
          </tr>
        </template>

        <TableSkeleton v-if="loadingDeliveries" :columns="6" :rows="4" />
        <tr v-else-if="deliveries.length === 0">
          <td colspan="6" class="py-12 px-3.5 sm:px-4 md:px-6 text-center text-jetblack/50">
            <Radio class="w-8 h-8 text-jetblack/20 mx-auto mb-2" />
            <p class="text-xs font-bold text-jetblack">Belum ada pengiriman webhook</p>
            <p class="text-[11px] text-jetblack/50 mt-1 max-w-sm mx-auto">
              Log pengiriman akan muncul secara otomatis ketika terjadi event pembayaran atau saat
              Anda menguji endpoint dengan Test Ping.
            </p>
          </td>
        </tr>
        <tr
          v-else
          v-for="del in deliveries"
          :key="del.id"
          class="hover:bg-jetblack/[0.02] transition"
        >
          <td class="py-3 pr-3 pl-3.5 sm:pl-4 md:px-6">
            <span
              v-if="del.status === 'SENT'"
              class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-forest/10 text-forest border border-forest/20"
            >
              <CheckCircle2 class="w-3 h-3 text-forest" />
              <span>Terkirim</span>
            </span>
            <span
              v-else-if="del.status === 'FAILED'"
              class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200"
            >
              <AlertTriangle class="w-3 h-3 text-rose-600" />
              <span>Gagal</span>
            </span>
            <span
              v-else
              class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-gold/15 text-gold-deep border border-gold/30"
            >
              <Clock class="w-3 h-3 text-gold-deep" />
              <span>Pending</span>
            </span>
          </td>
          <td class="py-3 px-3">
            <span
              class="font-mono text-[11px] font-bold text-jetblack bg-jetblack/5 px-2 py-0.5 rounded"
            >
              {{ del.event || del.payload?.event || "event" }}
            </span>
          </td>
          <td class="py-3 px-3">
            <div
              class="font-mono text-[11px] text-jetblack truncate max-w-[240px]"
              :title="getEndpointUrl(del.endpointId)"
            >
              {{ getEndpointUrl(del.endpointId) }}
            </div>
          </td>
          <td class="py-3 px-3 text-center">
            <span class="text-xs font-semibold text-jetblack/70"> {{ del.attempts || 1 }}x </span>
          </td>
          <td class="py-3 px-3 text-jetblack/60 text-[11px]">
            {{ formatTimestamp(del.lastAttemptAt || del.createdAt) }}
          </td>
          <td class="py-3 pl-3 pr-3.5 sm:pr-4 md:pr-6 text-right">
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

    <!-- Modal Tambah Webhook -->
    <div
      v-if="isWebhookModalOpen"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-jetblack/60 backdrop-blur-xs animate-fadeIn"
      @click.self="isWebhookModalOpen = false"
    >
      <div
        class="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 border border-jetblack/15 max-h-[90vh] flex flex-col"
      >
        <div class="flex items-center justify-between border-b border-jetblack/10 pb-3">
          <div class="flex items-center gap-2">
            <Webhook class="w-4 h-4 text-gold" />
            <h3 class="text-sm font-bold text-jetblack">Daftarkan Endpoint Webhook</h3>
          </div>
          <button
            type="button"
            @click="isWebhookModalOpen = false"
            class="text-jetblack/40 hover:text-jetblack cursor-pointer font-bold text-base"
          >
            ×
          </button>
        </div>

        <div class="space-y-3.5 overflow-y-auto flex-1 pr-1 text-xs">
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
              class="flex flex-wrap gap-1.5 p-2 rounded-xl bg-jetblack/[0.02] border border-jetblack/10"
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

          <div>
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

        <div class="flex items-center justify-end gap-2 pt-3 border-t border-jetblack/10">
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
            @click="handleCreateWebhook"
            class="btn-gold px-4 py-1.5 rounded-lg text-xs font-bold cursor-pointer disabled:opacity-50"
          >
            {{ isSubmittingWebhook ? "Mendaftarkan..." : "Daftarkan Endpoint" }}
          </button>
        </div>
      </div>
    </div>

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
