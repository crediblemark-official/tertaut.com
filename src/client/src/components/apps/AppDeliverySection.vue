<script setup lang="ts">
import { ref, computed, watch, onMounted } from "vue";
import {
  KeyRound,
  Zap,
  ArrowUpRight,
  Settings,
  ChevronDown,
  Copy,
  Check,
  Plus,
  RefreshCw,
  ExternalLink,
  Laptop,
  Clock,
  Radio,
  ShieldCheck,
} from "lucide-vue-next";
import type { DeliveryConfig } from "../../types/app";
import type { LicenseConfigItem } from "../../types/licensing";
import { api } from "../../lib/api";
import { dashboardEnv, envPath, type DashboardEnv } from "../../lib/environment";
import { useClipboard } from "../../composables/useClipboard";

const props = defineProps<{
  modelValue: DeliveryConfig;
  appId?: string;
}>();

const emit = defineEmits<{
  "update:modelValue": [val: DeliveryConfig];
}>();

const { copy, copied } = useClipboard();

// Reactive states for Developer Fulfillment
const licenseEnabled = ref(Boolean(props.modelValue.licenseKey?.enabled));
const assignedLicenseKey = ref<string | undefined>(props.modelValue.licenseKey?.assignedLicenseKey);
const maxSeats = ref(props.modelValue.licenseKey?.maxSeats ?? 3);
const expiresInDays = ref(props.modelValue.licenseKey?.expiresInDays ?? 365);
const offlineGraceDays = ref(props.modelValue.licenseKey?.offlineGraceDays ?? 30);
const floatingEnabled = ref(props.modelValue.licenseKey?.floating?.enabled ?? false);
const leaseTtlSeconds = ref(props.modelValue.licenseKey?.floating?.leaseTtlSeconds ?? 300);
const heartbeatIntervalSeconds = ref(
  props.modelValue.licenseKey?.floating?.heartbeatIntervalSeconds ?? 60
);

const apiEnabled = ref(Boolean(props.modelValue.apiAccess?.enabled));
const apiEndpoint = ref(props.modelValue.apiAccess?.endpointUrl ?? "");
const apiInstruction = ref(props.modelValue.apiAccess?.instruction ?? "");

// Daftar Pengaturan Lisensi dari Menu Lisensi (http://localhost:5173/dashboard/licensing)
const availableConfigs = ref<LicenseConfigItem[]>([]);
const loadingConfigs = ref(false);

const targetEnv = computed<DashboardEnv>(() => {
  if (props.appId?.startsWith("app_sand_")) return "sandbox";
  if (props.appId?.startsWith("app_live_")) return "live";
  return dashboardEnv.value;
});

async function fetchConfigs() {
  loadingConfigs.value = true;
  try {
    const res = await api.getLicenseConfigs();
    availableConfigs.value = res.configs || [];
  } catch (err) {
    console.error("Gagal memanggil daftar pengaturan lisensi:", err);
  } finally {
    loadingConfigs.value = false;
  }
}

onMounted(() => {
  fetchConfigs();
});

// Dropdown value: 'none' atau target appId dari konfigurasi
const selectedValue = computed(() => {
  if (!licenseEnabled.value) return "none";
  if (props.appId) {
    const found = availableConfigs.value.find((c) => c.appId === props.appId);
    if (found) return found.appId;
  }
  if (availableConfigs.value.length > 0) {
    return availableConfigs.value[0].appId;
  }
  return "custom";
});

const selectedConfig = computed<LicenseConfigItem | null>(() => {
  if (!licenseEnabled.value) return null;
  if (props.appId) {
    const found = availableConfigs.value.find((c) => c.appId === props.appId);
    if (found) return found;
  }
  return availableConfigs.value[0] || null;
});

function handleLicenseSelect(event: Event) {
  const val = (event.target as HTMLSelectElement).value;
  if (val === "none") {
    licenseEnabled.value = false;
    assignedLicenseKey.value = undefined;
  } else {
    // Memilih pengaturan lisensi spesifik dari Menu Lisensi
    licenseEnabled.value = true;
    const found = availableConfigs.value.find((c) => c.appId === val);
    if (found) {
      maxSeats.value = found.maxSeats || 3;
      expiresInDays.value = found.expiresInDays ?? 365;
      offlineGraceDays.value = found.offlineGraceDays ?? 30;
      floatingEnabled.value = Boolean(found.floating?.enabled);
      leaseTtlSeconds.value = found.floating?.leaseTtlSeconds ?? 300;
      heartbeatIntervalSeconds.value = found.floating?.heartbeatIntervalSeconds ?? 60;
    }
  }
  updateConfig();
}

let isSyncing = false;

function syncFromProps(val: DeliveryConfig) {
  isSyncing = true;
  licenseEnabled.value = Boolean(val.licenseKey?.enabled);
  assignedLicenseKey.value = val.licenseKey?.assignedLicenseKey;
  maxSeats.value = val.licenseKey?.maxSeats ?? 3;
  expiresInDays.value = val.licenseKey?.expiresInDays ?? 365;
  offlineGraceDays.value = val.licenseKey?.offlineGraceDays ?? 30;
  floatingEnabled.value = Boolean(val.licenseKey?.floating?.enabled);
  leaseTtlSeconds.value = val.licenseKey?.floating?.leaseTtlSeconds ?? 300;
  heartbeatIntervalSeconds.value = val.licenseKey?.floating?.heartbeatIntervalSeconds ?? 60;

  apiEnabled.value = Boolean(val.apiAccess?.enabled);
  apiEndpoint.value = val.apiAccess?.endpointUrl ?? "";
  apiInstruction.value = val.apiAccess?.instruction ?? "";
  isSyncing = false;
}

watch(
  () => props.modelValue,
  (val) => {
    if (val && !isSyncing) syncFromProps(val);
  },
  { deep: true, immediate: true }
);

function updateConfig() {
  if (isSyncing) return;
  const next: DeliveryConfig = {
    licenseKey: licenseEnabled.value
      ? {
          enabled: true,
          description: selectedConfig.value?.name || "Lisensi Universal Tertaut",
          assignedLicenseKey: assignedLicenseKey.value,
          maxSeats: Number(maxSeats.value) || 3,
          expiresInDays: Number(expiresInDays.value) || 365,
          offlineGraceDays: Number(offlineGraceDays.value) || 30,
          floating: floatingEnabled.value
            ? {
                enabled: true,
                leaseTtlSeconds: Number(leaseTtlSeconds.value) || 300,
                heartbeatIntervalSeconds: Number(heartbeatIntervalSeconds.value) || 60,
              }
            : undefined,
        }
      : { enabled: false },
    fileDownload: { enabled: false },
    privateNote: { enabled: false },
    apiAccess: apiEnabled.value
      ? {
          enabled: true,
          endpointUrl: apiEndpoint.value,
          instruction: apiInstruction.value,
        }
      : { enabled: false },
  };
  emit("update:modelValue", next);
}

watch(
  [
    licenseEnabled,
    assignedLicenseKey,
    maxSeats,
    expiresInDays,
    offlineGraceDays,
    floatingEnabled,
    leaseTtlSeconds,
    heartbeatIntervalSeconds,
    apiEnabled,
    apiEndpoint,
    apiInstruction,
  ],
  () => {
    updateConfig();
  }
);

const licensingMenuUrl = computed(() => {
  return envPath(targetEnv.value, "/licensing" + (props.appId ? "?app_id=" + props.appId : ""));
});
</script>

<template>
  <div class="space-y-4">
    <div class="border-b border-jetblack/10 pb-3">
      <div class="flex items-center gap-2">
        <div class="w-2 h-2 rounded-full bg-gold"></div>
        <h2 class="text-xs font-bold uppercase tracking-wider text-jetblack">
          Opsi Pemenuhan Software & Lisensi (Fulfillment)
        </h2>
      </div>
      <p class="text-[11px] text-jetblack/60 mt-0.5">
        Pilih opsi pemenuhan akses setelah pembayaran: menghubungkan Pengaturan Lisensi dari Menu
        Lisensi atau auto-provisioning kunci API.
      </p>
    </div>

    <!-- Fulfillment Options -->
    <div class="space-y-3">
      <!-- 1. License Key (DRM Engine) -->
      <div
        class="p-4 rounded-xl border transition"
        :class="
          licenseEnabled
            ? 'bg-white border-gold/40 shadow-xs'
            : 'bg-jetblack/[0.02] border-jetblack/10'
        "
      >
        <div class="flex items-center justify-between gap-3 mb-3">
          <div class="flex items-center gap-2.5 min-w-0">
            <div
              class="w-7 h-7 rounded-lg bg-gold/15 flex items-center justify-center text-jetblack shrink-0"
            >
              <KeyRound class="w-3.5 h-3.5 text-gold" />
            </div>
            <div class="min-w-0">
              <div class="text-xs font-bold text-jetblack flex items-center gap-2">
                <span>Pengaturan Lisensi Software (License Engine)</span>
                <span
                  class="px-2 py-0.2 rounded-full text-[10px] font-bold"
                  :class="
                    licenseEnabled ? 'bg-forest/10 text-forest' : 'bg-jetblack/10 text-jetblack/50'
                  "
                >
                  {{ licenseEnabled ? "Aktif" : "Nonaktif" }}
                </span>
              </div>
              <div class="text-[10.5px] text-jetblack/60 truncate">
                Pilih skema pengaturan dari Menu Lisensi untuk mengatur seat, masa aktif, dan
                proteksi perangkat
              </div>
            </div>
          </div>

          <button
            type="button"
            @click="fetchConfigs"
            title="Segarkan daftar pengaturan lisensi dari Menu Lisensi"
            class="p-1.5 rounded-lg bg-jetblack/5 hover:bg-jetblack/10 text-jetblack/60 transition cursor-pointer shrink-0"
          >
            <RefreshCw class="w-3.5 h-3.5" :class="{ 'animate-spin': loadingConfigs }" />
          </button>
        </div>

        <!-- DROPDOWN: MEMANGGIL DAFTAR PENGATURAN LISENSI DARI MENU LISENSI -->
        <div class="space-y-2.5">
          <div class="flex items-center justify-between">
            <label class="block text-[11px] font-bold text-jetblack/80">
              Pilih Pengaturan Lisensi (Menu Lisensi):
            </label>
            <router-link
              :to="licensingMenuUrl"
              class="text-[10.5px] text-gold hover:underline font-bold inline-flex items-center gap-1"
            >
              <Plus class="w-3 h-3" />
              <span>Kelola di Menu Lisensi</span>
            </router-link>
          </div>

          <div class="relative">
            <select
              :value="selectedValue"
              @change="handleLicenseSelect"
              class="w-full pl-3 pr-8 py-2.5 rounded-xl bg-white border border-jetblack/20 text-xs font-bold text-jetblack focus:outline-none focus:border-gold shadow-2xs cursor-pointer appearance-none"
            >
              <option value="none">❌ Tanpa Lisensi (Aplikasi Gratis / Nonaktif)</option>

              <!-- Optgroup berisi daftar pengaturan lisensi dari Menu Lisensi -->
              <optgroup
                v-if="availableConfigs.length > 0"
                label="📋 Daftar Pengaturan Lisensi (Menu Lisensi)"
              >
                <option v-for="cfg in availableConfigs" :key="cfg.appId" :value="cfg.appId">
                  🔑 {{ cfg.name }} — {{ cfg.maxSeats }} Seats •
                  {{ cfg.expiresInDays ? cfg.expiresInDays + " Hari" : "Lifetime" }}
                  {{ cfg.floating?.enabled ? "• Floating" : "" }}
                </option>
              </optgroup>
            </select>
            <ChevronDown
              class="w-4 h-4 text-jetblack/40 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
            />
          </div>

          <!-- KONDISI: Pengaturan Lisensi Terpilih -->
          <div
            v-if="licenseEnabled"
            class="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3 shadow-2xs animate-fadeIn mt-2"
          >
            <div
              class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/70 pb-2.5"
            >
              <div class="flex items-center gap-2">
                <span class="w-2 h-2 rounded-full bg-forest animate-pulse" />
                <span class="text-xs font-bold text-jetblack">Pengaturan Lisensi Terpilih:</span>
                <span
                  class="px-2 py-0.5 rounded-md bg-white border border-slate-200 font-bold text-xs text-jetblack"
                >
                  {{ selectedConfig?.name || "Lisensi Universal Tertaut" }}
                </span>
              </div>

              <div class="flex items-center gap-1.5 self-start sm:self-auto">
                <span
                  class="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase"
                  :class="
                    selectedConfig?.mode === 'live'
                      ? 'bg-forest/10 text-forest'
                      : 'bg-gold/15 text-jetblack'
                  "
                >
                  {{ selectedConfig?.mode || targetEnv }}
                </span>
                <span
                  class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-forest/10 text-forest"
                >
                  Engine Siap
                </span>
              </div>
            </div>

            <!-- Configuration Parameters Summary Grid -->
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
              <div class="p-2.5 rounded-lg bg-white border border-slate-200/80">
                <div class="text-[10px] text-jetblack/50 flex items-center gap-1 mb-0.5">
                  <Laptop class="w-3 h-3 text-gold" />
                  <span>Batas Perangkat:</span>
                </div>
                <div class="font-bold text-jetblack font-mono">{{ maxSeats }} Seats</div>
              </div>

              <div class="p-2.5 rounded-lg bg-white border border-slate-200/80">
                <div class="text-[10px] text-jetblack/50 flex items-center gap-1 mb-0.5">
                  <Clock class="w-3 h-3 text-gold" />
                  <span>Masa Berlaku:</span>
                </div>
                <div class="font-bold text-jetblack font-mono">
                  {{
                    expiresInDays >= 3650 || !expiresInDays
                      ? "Selamanya (Lifetime)"
                      : `${expiresInDays} Hari`
                  }}
                </div>
              </div>

              <div class="p-2.5 rounded-lg bg-white border border-slate-200/80">
                <div class="text-[10px] text-jetblack/50 flex items-center gap-1 mb-0.5">
                  <ShieldCheck class="w-3 h-3 text-gold" />
                  <span>Offline Grace:</span>
                </div>
                <div class="font-bold text-jetblack font-mono">{{ offlineGraceDays }} Hari</div>
              </div>

              <div class="p-2.5 rounded-lg bg-white border border-slate-200/80">
                <div class="text-[10px] text-jetblack/50 flex items-center gap-1 mb-0.5">
                  <Radio class="w-3 h-3 text-gold" />
                  <span>Mode Validasi:</span>
                </div>
                <div class="font-bold text-jetblack">
                  {{ floatingEnabled ? "Floating Lease" : "Standar Ed25519" }}
                </div>
              </div>
            </div>

            <!-- Information Banner & Link to Licensing Menu -->
            <div
              class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 border-t border-slate-200/60 text-[11px]"
            >
              <p class="text-jetblack/60 flex items-center gap-1.5">
                <span class="w-1.5 h-1.5 rounded-full bg-forest shrink-0"></span>
                <span
                  >Setiap pembeli yang membayar via Tertaut akan otomatis diterbitkan lisensi sesuai
                  pengaturan ini.</span
                >
              </p>

              <router-link
                :to="licensingMenuUrl"
                class="inline-flex items-center gap-1 text-[11px] font-bold text-jetblack hover:text-gold transition shrink-0"
              >
                <span>Kelola di Menu Lisensi</span>
                <ArrowUpRight class="w-3.5 h-3.5" />
              </router-link>
            </div>
          </div>
        </div>
      </div>

      <!-- 2. API Access & Provisioning -->
      <div
        class="p-3.5 rounded-xl border transition"
        :class="
          apiEnabled
            ? 'bg-white border-emerald-500/40 shadow-xs'
            : 'bg-jetblack/[0.02] border-jetblack/10 opacity-70'
        "
      >
        <label class="flex items-center justify-between cursor-pointer select-none">
          <div class="flex items-center gap-2.5">
            <div
              class="w-7 h-7 rounded-lg bg-emerald-500/15 flex items-center justify-center text-emerald-700 shrink-0"
            >
              <Zap class="w-3.5 h-3.5" />
            </div>
            <div>
              <div class="text-xs font-bold text-jetblack">
                Akses API &amp; Auto-Provisioning Kunci
              </div>
              <div class="text-[10px] text-jetblack/60">
                Sistem menerbitkan API key unik untuk pelanggan memanggil API server Anda
              </div>
            </div>
          </div>

          <button
            type="button"
            @click="apiEnabled = !apiEnabled"
            class="relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden"
            :class="apiEnabled ? 'bg-emerald-600' : 'bg-jetblack/20'"
          >
            <span
              class="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out"
              :class="apiEnabled ? 'translate-x-4' : 'translate-x-0'"
            />
          </button>
        </label>

        <div v-if="apiEnabled" class="mt-3 pt-3 border-t border-jetblack/10 space-y-2.5 text-xs">
          <div>
            <label class="block text-[11px] font-bold text-jetblack/80 mb-1">
              Endpoint Base URL API Anda:
            </label>
            <input
              v-model="apiEndpoint"
              type="url"
              placeholder="https://api.yourdomain.com/v1"
              class="w-full px-3 py-2 rounded-xl bg-jetblack/5 border border-jetblack/10 text-xs font-mono text-jetblack focus:outline-hidden focus:border-emerald-500"
            />
          </div>

          <div>
            <label class="block text-[11px] font-bold text-jetblack/80 mb-1">
              Petunjuk Penggunaan Header / Auth:
            </label>
            <textarea
              v-model="apiInstruction"
              rows="2"
              placeholder="Contoh: Sertakan header `Authorization: Bearer <API_KEY>` pada setiap request."
              class="w-full px-3 py-2 rounded-xl bg-jetblack/5 border border-jetblack/10 text-xs text-jetblack focus:outline-hidden focus:border-emerald-500"
            ></textarea>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
