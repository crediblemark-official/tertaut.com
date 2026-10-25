<script setup lang="ts">
import { ref, computed, watch } from "vue";
import {
  X,
  Settings,
  ShieldCheck,
  Clock,
  Laptop,
  Radio,
  CheckCircle2,
  Sparkles,
  Zap,
} from "lucide-vue-next";
import type { AppItem } from "../../types/app";
import type { LicenseConfigItem, SaveLicenseConfigPayload } from "../../types/licensing";
import SearchPicker from "../common/SearchPicker.vue";
import BaseModal from "../common/BaseModal.vue";

const props = defineProps<{
  show: boolean;
  config?: LicenseConfigItem | null;
  appsList: AppItem[];
  loading?: boolean;
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "save", payload: SaveLicenseConfigPayload): void;
}>();

const isEditing = computed(() => Boolean(props.config && props.config.appId));

const appId = ref("");
const name = ref("");
const enabled = ref(true);
const maxSeats = ref(3);
const isLifetime = ref(false);
const expiresInDays = ref<number>(365);
const offlineGraceDays = ref(30);

const floatingEnabled = ref(false);
const leaseTtlSeconds = ref(300);
const heartbeatIntervalSeconds = ref(60);

const errorMessage = ref<string | null>(null);

function syncForm() {
  errorMessage.value = null;
  if (props.config) {
    appId.value = props.config.appId || "";
    name.value = props.config.name || "";
    enabled.value = props.config.enabled !== false;
    maxSeats.value = props.config.maxSeats || 3;
    if (props.config.expiresInDays === null || props.config.expiresInDays === undefined) {
      isLifetime.value = true;
      expiresInDays.value = 365;
    } else {
      isLifetime.value = false;
      expiresInDays.value = props.config.expiresInDays;
    }
    offlineGraceDays.value = props.config.offlineGraceDays ?? 30;
    floatingEnabled.value = Boolean(props.config.floating?.enabled);
    leaseTtlSeconds.value = props.config.floating?.leaseTtlSeconds ?? 300;
    heartbeatIntervalSeconds.value = props.config.floating?.heartbeatIntervalSeconds ?? 60;
  } else {
    // New config default
    appId.value = props.appsList.length > 0 ? props.appsList[0].id : "";
    name.value = "";
    enabled.value = true;
    maxSeats.value = 3;
    isLifetime.value = false;
    expiresInDays.value = 365;
    offlineGraceDays.value = 30;
    floatingEnabled.value = false;
    leaseTtlSeconds.value = 300;
    heartbeatIntervalSeconds.value = 60;
  }
}

watch(
  () => [props.show, props.config],
  () => {
    if (props.show) syncForm();
  },
  { immediate: true }
);

function applyPreset(days: number | null) {
  if (days === null) {
    isLifetime.value = true;
  } else {
    isLifetime.value = false;
    expiresInDays.value = days;
  }
}

function handleSave() {
  if (!appId.value) {
    errorMessage.value = "Silakan pilih Project / Aplikasi terlebih dahulu.";
    return;
  }

  const payload: SaveLicenseConfigPayload = {
    appId: appId.value,
    name: name.value.trim() || undefined,
    enabled: enabled.value,
    maxSeats: Number(maxSeats.value) || 1,
    expiresInDays: isLifetime.value ? null : Number(expiresInDays.value) || 365,
    offlineGraceDays: Number(offlineGraceDays.value) || 0,
    floating: {
      enabled: floatingEnabled.value,
      leaseTtlSeconds: Number(leaseTtlSeconds.value) || 300,
      heartbeatIntervalSeconds: Number(heartbeatIntervalSeconds.value) || 60,
    },
  };

  emit("save", payload);
}
</script>

<template>
  <BaseModal :show="show" max-width="max-w-xl" @close="emit('close')">
    <!-- Modal Header -->
    <template #header>
      <div class="px-6 py-4 bg-jetblack text-white flex items-center justify-between shrink-0">
        <div class="flex items-center gap-3">
          <div class="p-2 rounded-xl bg-gold/20 text-gold">
            <Settings class="w-5 h-5" />
          </div>
          <div>
            <h3 class="text-sm font-bold uppercase tracking-wider text-white">
              {{ isEditing ? "Ubah Pengaturan Lisensi" : "Buat Pengaturan Lisensi Baru" }}
            </h3>
            <p class="text-xs text-white/60">
              Konfigurasi aturan seat, durasi, dan proteksi untuk dikonsumsi project.
            </p>
          </div>
        </div>
        <button
          type="button"
          @click="emit('close')"
          class="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition cursor-pointer"
        >
          <X class="w-5 h-5" />
        </button>
      </div>
    </template>

    <!-- Modal Body (Scrollable) -->
    <form @submit.prevent="handleSave" class="p-6 space-y-5 overflow-y-auto flex-1 text-xs">
      <!-- Error Banner -->
      <div
        v-if="errorMessage"
        class="p-3 rounded-xl bg-crimson/10 border border-crimson/30 text-crimson text-xs font-semibold flex items-center gap-2"
      >
        <span>{{ errorMessage }}</span>
      </div>

      <!-- Project Selection -->
      <div>
        <label class="block font-bold text-jetblack mb-1.5 flex items-center justify-between">
          <span>Project / Aplikasi Penerima</span>
          <span v-if="isEditing" class="text-[10px] text-jetblack/50 font-normal">
            (Terkunci pada project ini)
          </span>
        </label>
        <SearchPicker
          v-if="!isEditing"
          v-model="appId"
          :items="appsList"
          placeholder="Pilih Project / Software..."
          search-placeholder="Ketik nama software, slug, atau mode..."
          button-class="w-full !h-10 !rounded-xl !bg-white !border-jetblack/15 !text-xs font-medium"
        />
        <div
          v-else
          class="px-3.5 py-2.5 rounded-xl border border-jetblack/15 bg-jetblack/5 font-medium text-jetblack text-xs flex items-center justify-between"
        >
          <span>{{ appsList.find((a) => a.id === appId)?.name || appId }}</span>
          <span class="font-mono text-[11px] text-jetblack/50">({{ appId }})</span>
        </div>
        <p class="text-[11px] text-jetblack/50 mt-1">
          Pengaturan lisensi ini akan terhubung langsung ke project ini dan diterapkan saat checkout
          Tertaut.
        </p>
      </div>

      <!-- Configuration Name / Description -->
      <div>
        <label class="block font-bold text-jetblack mb-1.5">
          Nama Pengaturan / Paket Lisensi
        </label>
        <input
          v-model="name"
          type="text"
          placeholder="Contoh: Kasir Citra Pro (3 Seats • 365 Hari)"
          class="w-full px-3.5 py-2.5 rounded-xl border border-jetblack/15 bg-white text-jetblack font-medium focus:outline-hidden focus:border-gold focus:ring-1 focus:ring-gold transition"
        />
      </div>

      <!-- Enable License Toggle -->
      <div
        class="p-3.5 rounded-xl bg-jetblack/3 border border-jetblack/10 flex items-center justify-between gap-3"
      >
        <div class="flex items-center gap-2.5">
          <ShieldCheck class="w-4 h-4 text-forest" />
          <div>
            <div class="font-bold text-jetblack">Status Engine Lisensi</div>
            <div class="text-[11px] text-jetblack/60">
              Otomatis terbitkan lisensi untuk setiap transaksi pembayaran yang selesai.
            </div>
          </div>
        </div>
        <button
          type="button"
          @click="enabled = !enabled"
          class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden"
          :class="enabled ? 'bg-forest' : 'bg-jetblack/20'"
        >
          <span
            class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out"
            :class="enabled ? 'translate-x-5' : 'translate-x-0'"
          />
        </button>
      </div>

      <!-- Seats Configuration -->
      <div class="p-4 rounded-xl border border-jetblack/10 bg-white space-y-3">
        <div class="flex items-center justify-between">
          <label class="font-bold text-jetblack flex items-center gap-2">
            <Laptop class="w-4 h-4 text-gold" />
            <span>Batas Perangkat / Seat Aktif (Max Seats)</span>
          </label>
          <span
            class="text-[11px] font-mono font-bold px-2 py-0.5 rounded-md bg-gold/15 text-jetblack"
          >
            {{ maxSeats }} Perangkat
          </span>
        </div>
        <div class="flex items-center gap-2">
          <input
            v-model.number="maxSeats"
            type="number"
            min="1"
            max="999"
            class="w-24 px-3 py-2 rounded-xl border border-jetblack/15 font-mono font-bold text-center text-jetblack focus:outline-hidden focus:border-gold"
          />
          <!-- Quick seat buttons -->
          <div class="flex flex-wrap gap-1.5">
            <button
              type="button"
              v-for="s in [1, 2, 3, 5, 10]"
              :key="s"
              @click="maxSeats = s"
              class="px-2.5 py-1.5 rounded-lg border text-[11px] font-bold transition cursor-pointer"
              :class="
                maxSeats === s
                  ? 'bg-jetblack text-white border-jetblack'
                  : 'border-jetblack/10 bg-white text-jetblack/70 hover:border-jetblack/30'
              "
            >
              {{ s }} Seat{{ s > 1 ? "s" : "" }}
            </button>
          </div>
        </div>
        <p class="text-[11px] text-jetblack/50">
          Jumlah maksimum komputer atau perangkat unik yang dapat mengaktifkan lisensi secara
          bersamaan.
        </p>
      </div>

      <!-- Expiry Duration Configuration -->
      <div class="p-4 rounded-xl border border-jetblack/10 bg-white space-y-3">
        <div class="flex items-center justify-between">
          <label class="font-bold text-jetblack flex items-center gap-2">
            <Clock class="w-4 h-4 text-gold" />
            <span>Masa Berlaku Lisensi</span>
          </label>
          <span
            class="text-[11px] font-mono font-bold px-2 py-0.5 rounded-md"
            :class="isLifetime ? 'bg-forest/15 text-forest' : 'bg-gold/15 text-jetblack'"
          >
            {{ isLifetime ? "Selamanya (Lifetime)" : `${expiresInDays} Hari` }}
          </span>
        </div>

        <!-- Presets -->
        <div class="flex flex-wrap gap-1.5">
          <button
            type="button"
            @click="applyPreset(30)"
            class="px-2.5 py-1 rounded-lg border text-[11px] font-bold transition cursor-pointer"
            :class="
              !isLifetime && expiresInDays === 30
                ? 'bg-jetblack text-white border-jetblack'
                : 'border-jetblack/10 bg-white text-jetblack/70'
            "
          >
            30 Hari
          </button>
          <button
            type="button"
            @click="applyPreset(90)"
            class="px-2.5 py-1 rounded-lg border text-[11px] font-bold transition cursor-pointer"
            :class="
              !isLifetime && expiresInDays === 90
                ? 'bg-jetblack text-white border-jetblack'
                : 'border-jetblack/10 bg-white text-jetblack/70'
            "
          >
            90 Hari
          </button>
          <button
            type="button"
            @click="applyPreset(180)"
            class="px-2.5 py-1 rounded-lg border text-[11px] font-bold transition cursor-pointer"
            :class="
              !isLifetime && expiresInDays === 180
                ? 'bg-jetblack text-white border-jetblack'
                : 'border-jetblack/10 bg-white text-jetblack/70'
            "
          >
            180 Hari
          </button>
          <button
            type="button"
            @click="applyPreset(365)"
            class="px-2.5 py-1 rounded-lg border text-[11px] font-bold transition cursor-pointer"
            :class="
              !isLifetime && expiresInDays === 365
                ? 'bg-jetblack text-white border-jetblack'
                : 'border-jetblack/10 bg-white text-jetblack/70'
            "
          >
            1 Tahun (365 Hari)
          </button>
          <button
            type="button"
            @click="applyPreset(null)"
            class="px-2.5 py-1 rounded-lg border text-[11px] font-bold transition cursor-pointer flex items-center gap-1"
            :class="
              isLifetime
                ? 'bg-forest text-white border-forest'
                : 'border-jetblack/10 bg-white text-jetblack/70'
            "
          >
            <Sparkles class="w-3 h-3" />
            <span>Lifetime (Selamanya)</span>
          </button>
        </div>

        <!-- Custom Days Input (shown only if not lifetime) -->
        <div v-if="!isLifetime" class="flex items-center gap-2 pt-1">
          <span class="text-jetblack/70">Durasi Kustom:</span>
          <input
            v-model.number="expiresInDays"
            type="number"
            min="1"
            max="3650"
            class="w-24 px-3 py-1.5 rounded-lg border border-jetblack/15 font-mono font-bold text-center text-jetblack focus:outline-hidden focus:border-gold"
          />
          <span class="text-jetblack/70 font-semibold">Hari</span>
        </div>
      </div>

      <!-- Offline Grace Period -->
      <div class="p-4 rounded-xl border border-jetblack/10 bg-white space-y-2">
        <div class="flex items-center justify-between">
          <label class="font-bold text-jetblack"
            >Masa Toleransi Offline (Offline Grace Period)</label
          >
          <span class="text-[11px] font-mono font-bold text-jetblack/70"
            >{{ offlineGraceDays }} Hari</span
          >
        </div>
        <div class="flex flex-wrap gap-1.5">
          <button
            type="button"
            v-for="d in [0, 7, 14, 30, 60]"
            :key="d"
            @click="offlineGraceDays = d"
            class="px-2.5 py-1 rounded-lg border text-[11px] font-bold transition cursor-pointer"
            :class="
              offlineGraceDays === d
                ? 'bg-jetblack text-white border-jetblack'
                : 'border-jetblack/10 bg-white text-jetblack/70'
            "
          >
            {{ d === 0 ? "Tanpa Offline" : `${d} Hari` }}
          </button>
        </div>
        <p class="text-[11px] text-jetblack/50">
          Aplikasi klien dapat terus beroperasi tanpa koneksi internet selama token offline Ed25519
          belum melewati batas toleransi ini.
        </p>
      </div>

      <!-- Floating Leases / Rolling Seat -->
      <div class="p-4 rounded-xl border border-jetblack/10 bg-white space-y-3">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <Radio class="w-4 h-4 text-gold" />
            <div>
              <div class="font-bold text-jetblack">Mode Floating Lease (Rolling Seats)</div>
              <div class="text-[11px] text-jetblack/60">
                Seat otomatis dilepas jika perangkat menutup aplikasi atau berhenti mengirim
                heartbeat.
              </div>
            </div>
          </div>
          <button
            type="button"
            @click="floatingEnabled = !floatingEnabled"
            class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden"
            :class="floatingEnabled ? 'bg-gold' : 'bg-jetblack/20'"
          >
            <span
              class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out"
              :class="floatingEnabled ? 'translate-x-5' : 'translate-x-0'"
            />
          </button>
        </div>

        <div v-if="floatingEnabled" class="pt-2 border-t border-jetblack/10 grid grid-cols-2 gap-3">
          <div>
            <label class="block font-bold text-jetblack mb-1">TTL Lease (Detik)</label>
            <input
              v-model.number="leaseTtlSeconds"
              type="number"
              min="60"
              step="30"
              class="w-full px-3 py-1.5 rounded-lg border border-jetblack/15 font-mono font-bold text-jetblack"
            />
            <span class="text-[10px] text-jetblack/50">Default 300s (5 menit)</span>
          </div>
          <div>
            <label class="block font-bold text-jetblack mb-1">Interval Heartbeat (Detik)</label>
            <input
              v-model.number="heartbeatIntervalSeconds"
              type="number"
              min="10"
              step="10"
              class="w-full px-3 py-1.5 rounded-lg border border-jetblack/15 font-mono font-bold text-jetblack"
            />
            <span class="text-[10px] text-jetblack/50">Default 60s (1 menit)</span>
          </div>
        </div>
      </div>
    </form>

    <!-- Modal Footer -->
    <template #footer>
      <div class="flex items-center justify-end gap-3">
        <button
          type="button"
          @click="emit('close')"
          class="px-4 py-2 rounded-xl border border-jetblack/15 bg-white text-jetblack font-bold text-xs hover:bg-jetblack/5 transition cursor-pointer"
        >
          Batal
        </button>
        <button
          type="button"
          @click="handleSave"
          :disabled="loading"
          class="px-5 py-2 rounded-xl bg-jetblack text-white font-bold text-xs hover:bg-jetblack/90 transition shadow-sm cursor-pointer flex items-center gap-2 disabled:opacity-50"
        >
          <CheckCircle2 class="w-4 h-4 text-gold" />
          <span>{{ loading ? "Menyimpan..." : "Simpan Pengaturan" }}</span>
        </button>
      </div>
    </template>
  </BaseModal>
</template>
