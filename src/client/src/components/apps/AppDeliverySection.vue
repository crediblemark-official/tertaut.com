<script setup lang="ts">
import { ref, computed, watch, onMounted } from "vue";
import {
  KeyRound,
  Zap,
  ArrowUpRight,
  ChevronDown,
  RefreshCw,
  Laptop,
  Clock,
  Radio,
  ShieldCheck,
} from "lucide-vue-next";
import type { DeliveryConfig } from "../../types/app";
import type { LicenseConfigItem } from "../../types/licensing";
import { api } from "../../lib/api";
import { dashboardEnv, envPath, type DashboardEnv } from "../../lib/environment";

const props = defineProps<{
  modelValue: DeliveryConfig;
  appId?: string;
}>();

const emit = defineEmits<{
  "update:modelValue": [val: DeliveryConfig];
}>();

const showAdvancedLicense = ref(false);
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
const fileDownloadEnabled = ref(Boolean(props.modelValue.fileDownload?.enabled));
const fileDownloadTitle = ref(props.modelValue.fileDownload?.title ?? "");
const fileDownloadUrl = ref(props.modelValue.fileDownload?.fileUrl ?? "");
const fileDownloadName = ref(props.modelValue.fileDownload?.fileName ?? "");
const privateNoteEnabled = ref(Boolean(props.modelValue.privateNote?.enabled));
const privateNoteTitle = ref(props.modelValue.privateNote?.title ?? "");
const privateNoteBody = ref(props.modelValue.privateNote?.note ?? "");
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

const selectedValue = computed(() => {
  if (!licenseEnabled.value) return "none";
  if (props.appId) {
    const found = availableConfigs.value.find((c) => c.appId === props.appId);
    if (found) return found.appId;
  }
  return availableConfigs.value.length > 0 ? availableConfigs.value[0].appId : "custom";
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
  fileDownloadEnabled.value = Boolean(val.fileDownload?.enabled);
  fileDownloadTitle.value = val.fileDownload?.title ?? "";
  fileDownloadUrl.value = val.fileDownload?.fileUrl ?? "";
  fileDownloadName.value = val.fileDownload?.fileName ?? "";
  privateNoteEnabled.value = Boolean(val.privateNote?.enabled);
  privateNoteTitle.value = val.privateNote?.title ?? "";
  privateNoteBody.value = val.privateNote?.note ?? "";
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
    fileDownload: fileDownloadEnabled.value
      ? {
          enabled: true,
          title: fileDownloadTitle.value.trim() || undefined,
          fileUrl: fileDownloadUrl.value.trim() || undefined,
          fileName: fileDownloadName.value.trim() || undefined,
        }
      : { enabled: false },
    privateNote: privateNoteEnabled.value
      ? {
          enabled: true,
          title: privateNoteTitle.value.trim() || undefined,
          note: privateNoteBody.value || undefined,
        }
      : { enabled: false },
    apiAccess: apiEnabled.value
      ? { enabled: true, endpointUrl: apiEndpoint.value, instruction: apiInstruction.value }
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
    fileDownloadEnabled,
    fileDownloadTitle,
    fileDownloadUrl,
    fileDownloadName,
    privateNoteEnabled,
    privateNoteTitle,
    privateNoteBody,
    apiEnabled,
    apiEndpoint,
    apiInstruction,
  ],
  updateConfig
);

const licensingMenuUrl = computed(() =>
  envPath(targetEnv.value, "/licensing" + (props.appId ? "?app_id=" + props.appId : ""))
);
</script>

<template>
  <div
    class="-mx-3.5 sm:-mx-4 md:-mx-6 bg-white divide-y divide-jetblack/10 border-b border-jetblack/10"
  >
    <!-- 1. License Engine (Docked Hairline Row) -->
    <section class="px-3.5 sm:px-4 md:px-6 py-5 space-y-4 max-w-4xl">
      <div class="flex items-center justify-between gap-3">
        <div class="flex items-center gap-2.5 min-w-0">
          <KeyRound class="w-4 h-4 text-gold shrink-0" />
          <div class="min-w-0">
            <div class="text-xs font-bold text-jetblack flex items-center gap-2">
              <span>License Engine</span>
              <span
                class="px-2 py-0.5 rounded-full text-[10px] font-bold border"
                :class="
                  licenseEnabled
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-jetblack/5 text-jetblack/55 border-jetblack/10'
                "
              >
                {{ licenseEnabled ? "Aktif" : "Nonaktif" }}
              </span>
            </div>
            <div class="text-[11px] text-jetblack/55 truncate">
              Batas perangkat, masa berlaku, dan token Ed25519
            </div>
          </div>
        </div>

        <button
          type="button"
          aria-label="Aktifkan License Engine"
          @click="licenseEnabled = !licenseEnabled"
          class="relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
          :class="licenseEnabled ? 'bg-forest' : 'bg-jetblack/20'"
        >
          <span
            class="pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-2xs transition duration-200"
            :class="licenseEnabled ? 'translate-x-4' : 'translate-x-0'"
          />
        </button>
      </div>

      <div v-if="licenseEnabled" class="space-y-4 pt-3 border-t border-jetblack/10">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label class="block text-[11px] font-bold text-jetblack/75 mb-1">Maks. Perangkat</label>
            <div class="relative">
              <input
                v-model.number="maxSeats"
                type="number"
                min="1"
                max="1000"
                class="w-full pl-8 pr-3 py-2 rounded-lg bg-white border border-jetblack/15 text-xs font-mono tracking-wider font-bold text-jetblack focus:outline-none focus:border-gold"
              />
              <Laptop class="w-3.5 h-3.5 text-jetblack/40 absolute left-2.5 top-2.5" />
            </div>
          </div>

          <div>
            <label class="block text-[11px] font-bold text-jetblack/75 mb-1">
              Masa Berlaku (Hari, 0 = Lifetime)
            </label>
            <div class="relative">
              <input
                v-model.number="expiresInDays"
                type="number"
                min="0"
                max="36500"
                class="w-full pl-8 pr-3 py-2 rounded-lg bg-white border border-jetblack/15 text-xs font-mono tracking-wider font-bold text-jetblack focus:outline-none focus:border-gold"
              />
              <Clock class="w-3.5 h-3.5 text-jetblack/40 absolute left-2.5 top-2.5" />
            </div>
          </div>
        </div>

        <div class="pt-2 border-t border-jetblack/10">
          <button
            type="button"
            @click="showAdvancedLicense = !showAdvancedLicense"
            class="inline-flex items-center gap-1.5 text-[11px] font-semibold text-jetblack/65 hover:text-jetblack cursor-pointer"
          >
            <ChevronDown
              class="w-3.5 h-3.5 transition-transform duration-150"
              :class="{ 'rotate-180': showAdvancedLicense }"
            />
            <span>Lanjutan (Offline Grace, Floating, Template)</span>
          </button>

          <div v-if="showAdvancedLicense" class="mt-3 pt-3 border-t border-jetblack/10 space-y-3">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label class="block text-[11px] font-bold text-jetblack/75 mb-1">
                  Offline Grace (Hari)
                </label>
                <div class="relative">
                  <input
                    v-model.number="offlineGraceDays"
                    type="number"
                    min="1"
                    max="90"
                    class="w-full pl-8 pr-3 py-2 rounded-lg bg-white border border-jetblack/15 text-xs font-mono tracking-wider font-bold text-jetblack focus:outline-none focus:border-gold"
                  />
                  <ShieldCheck class="w-3.5 h-3.5 text-jetblack/40 absolute left-2.5 top-2.5" />
                </div>
              </div>

              <div>
                <label class="block text-[11px] font-bold text-jetblack/75 mb-1">Template</label>
                <div class="relative flex gap-1.5">
                  <select
                    :value="selectedValue"
                    @change="handleLicenseSelect"
                    class="w-full pl-3 pr-8 py-2 rounded-lg bg-white border border-jetblack/15 text-xs font-semibold text-jetblack focus:outline-none focus:border-gold cursor-pointer appearance-none"
                  >
                    <option value="custom">Atur Manual</option>
                    <option v-for="cfg in availableConfigs" :key="cfg.appId" :value="cfg.appId">
                      {{ cfg.name }} ({{ cfg.maxSeats }} Seat)
                    </option>
                  </select>
                  <ChevronDown
                    class="w-4 h-4 text-jetblack/40 absolute right-10 top-1/2 -translate-y-1/2 pointer-events-none"
                  />
                  <button
                    type="button"
                    @click="fetchConfigs"
                    title="Segarkan"
                    aria-label="Segarkan"
                    class="p-2 rounded-lg bg-white border border-jetblack/15 text-jetblack/60 hover:text-jetblack active:scale-[0.95] transition cursor-pointer shrink-0"
                  >
                    <RefreshCw class="w-3.5 h-3.5" :class="{ 'animate-spin': loadingConfigs }" />
                  </button>
                </div>
              </div>
            </div>

            <label
              class="flex items-center justify-between gap-3 pt-2.5 border-t border-jetblack/10 cursor-pointer"
            >
              <div class="flex items-center gap-2">
                <Radio class="w-4 h-4 text-gold shrink-0" />
                <div>
                  <div class="text-xs font-bold text-jetblack">Floating License</div>
                  <div class="text-[10.5px] text-jetblack/55">
                    Seat otomatis lepas saat heartbeat berhenti
                  </div>
                </div>
              </div>
              <input
                v-model="floatingEnabled"
                type="checkbox"
                class="rounded border-jetblack/30 text-gold focus:ring-gold cursor-pointer"
              />
            </label>

            <div v-if="floatingEnabled" class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-[11px] font-bold text-jetblack/70 mb-1">
                  Lease TTL (Detik)
                </label>
                <input
                  v-model.number="leaseTtlSeconds"
                  type="number"
                  min="60"
                  class="w-full px-3 py-1.5 rounded-lg bg-white border border-jetblack/15 text-xs font-mono tracking-wider"
                />
              </div>
              <div>
                <label class="block text-[11px] font-bold text-jetblack/70 mb-1">
                  Heartbeat (Detik)
                </label>
                <input
                  v-model.number="heartbeatIntervalSeconds"
                  type="number"
                  min="15"
                  class="w-full px-3 py-1.5 rounded-lg bg-white border border-jetblack/15 text-xs font-mono tracking-wider"
                />
              </div>
            </div>

            <div class="flex justify-end pt-1">
              <router-link
                :to="licensingMenuUrl"
                class="inline-flex items-center gap-1 text-[11px] font-bold text-jetblack hover:text-gold transition-colors"
              >
                <span>Buka Menu Lisensi</span>
                <ArrowUpRight class="w-3.5 h-3.5" />
              </router-link>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- 2. API Access (Docked Hairline Row) -->
    <section class="px-3.5 sm:px-4 md:px-6 py-5 space-y-4 max-w-4xl">
      <div class="flex items-center justify-between gap-3">
        <div class="flex items-center gap-2.5 min-w-0">
          <Zap class="w-4 h-4 text-emerald-700 shrink-0" />
          <div class="min-w-0">
            <div class="text-xs font-bold text-jetblack">Akses API</div>
            <div class="text-[11px] text-jetblack/55 truncate">
              Auto-provisioning API key unik bagi pembeli
            </div>
          </div>
        </div>

        <button
          type="button"
          aria-label="Aktifkan Akses API"
          @click="apiEnabled = !apiEnabled"
          class="relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
          :class="apiEnabled ? 'bg-emerald-600' : 'bg-jetblack/20'"
        >
          <span
            class="pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-2xs transition duration-200"
            :class="apiEnabled ? 'translate-x-4' : 'translate-x-0'"
          />
        </button>
      </div>

      <div v-if="apiEnabled" class="pt-3 border-t border-jetblack/10 space-y-3 text-xs">
        <div>
          <label class="block text-[11px] font-bold text-jetblack/75 mb-1">Endpoint URL</label>
          <input
            v-model="apiEndpoint"
            type="url"
            placeholder="https://api.yourdomain.com/v1"
            class="w-full px-3 py-2 rounded-lg bg-white border border-jetblack/15 text-xs font-mono text-jetblack focus:outline-none focus:border-gold"
          />
        </div>

        <div>
          <label class="block text-[11px] font-bold text-jetblack/75 mb-1">Petunjuk Auth</label>
          <textarea
            v-model="apiInstruction"
            rows="2"
            placeholder="Contoh: Sertakan header Authorization: Bearer <API_KEY>"
            class="w-full px-3 py-2 rounded-lg bg-white border border-jetblack/15 text-xs text-jetblack focus:outline-none focus:border-gold"
          ></textarea>
        </div>
      </div>
    </section>

    <!-- 3. File Download Delivery -->
    <section class="px-3.5 sm:px-4 md:px-6 py-5 space-y-4 max-w-4xl">
      <div class="flex items-center justify-between gap-3">
        <div class="min-w-0">
          <div class="text-xs font-bold text-jetblack">Unduhan Berkas Digital</div>
          <div class="text-[11px] text-jetblack/55 truncate">
            Tautan installer, ZIP, atau aset digital setelah pembayaran lunas
          </div>
        </div>
        <button
          type="button"
          aria-label="Aktifkan Unduhan Berkas"
          @click="fileDownloadEnabled = !fileDownloadEnabled"
          class="relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200"
          :class="fileDownloadEnabled ? 'bg-emerald-600' : 'bg-jetblack/20'"
        >
          <span
            class="pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-2xs transition duration-200"
            :class="fileDownloadEnabled ? 'translate-x-4' : 'translate-x-0'"
          />
        </button>
      </div>

      <div v-if="fileDownloadEnabled" class="pt-3 border-t border-jetblack/10 space-y-3 text-xs">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label class="block text-[11px] font-bold text-jetblack/75 mb-1"
              >Judul Tombol Unduh</label
            >
            <input
              v-model="fileDownloadTitle"
              type="text"
              placeholder="Contoh: Unduh Installer v2.1"
              class="w-full px-3 py-2 rounded-lg bg-white border border-jetblack/15 text-xs text-jetblack focus:outline-none focus:border-gold"
            />
          </div>
          <div>
            <label class="block text-[11px] font-bold text-jetblack/75 mb-1"
              >Nama File (Opsional)</label
            >
            <input
              v-model="fileDownloadName"
              type="text"
              placeholder="Contoh: AppInstaller.zip"
              class="w-full px-3 py-2 rounded-lg bg-white border border-jetblack/15 text-xs font-mono text-jetblack focus:outline-none focus:border-gold"
            />
          </div>
        </div>
        <div>
          <label class="block text-[11px] font-bold text-jetblack/75 mb-1">URL Berkas</label>
          <input
            v-model="fileDownloadUrl"
            type="url"
            placeholder="https://cdn.yourdomain.com/releases/app.zip"
            class="w-full px-3 py-2 rounded-lg bg-white border border-jetblack/15 text-xs font-mono text-jetblack focus:outline-none focus:border-gold"
          />
        </div>
      </div>
    </section>

    <!-- 4. Private Note Delivery -->
    <section class="px-3.5 sm:px-4 md:px-6 py-5 space-y-4 max-w-4xl">
      <div class="flex items-center justify-between gap-3">
        <div class="min-w-0">
          <div class="text-xs font-bold text-jetblack">Catatan Privat &amp; Link Komunitas</div>
          <div class="text-[11px] text-jetblack/55 truncate">
            Instruksi onboarding, link Discord/GitHub, atau panduan rahasia untuk pembeli
          </div>
        </div>
        <button
          type="button"
          aria-label="Aktifkan Catatan Privat"
          @click="privateNoteEnabled = !privateNoteEnabled"
          class="relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200"
          :class="privateNoteEnabled ? 'bg-emerald-600' : 'bg-jetblack/20'"
        >
          <span
            class="pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-2xs transition duration-200"
            :class="privateNoteEnabled ? 'translate-x-4' : 'translate-x-0'"
          />
        </button>
      </div>

      <div v-if="privateNoteEnabled" class="pt-3 border-t border-jetblack/10 space-y-3 text-xs">
        <div>
          <label class="block text-[11px] font-bold text-jetblack/75 mb-1">Judul Catatan</label>
          <input
            v-model="privateNoteTitle"
            type="text"
            placeholder="Contoh: Panduan Akses & Komunitas"
            class="w-full px-3 py-2 rounded-lg bg-white border border-jetblack/15 text-xs text-jetblack focus:outline-none focus:border-gold"
          />
        </div>
        <div>
          <label class="block text-[11px] font-bold text-jetblack/75 mb-1">Isi Catatan</label>
          <textarea
            v-model="privateNoteBody"
            rows="3"
            placeholder="Tulis panduan instalasi atau tautan privat..."
            class="w-full px-3 py-2 rounded-lg bg-white border border-jetblack/15 text-xs text-jetblack focus:outline-none focus:border-gold"
          ></textarea>
        </div>
      </div>
    </section>
  </div>
</template>
