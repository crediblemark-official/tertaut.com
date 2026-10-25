<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { Calendar, X, Sparkles, Clock, Infinity as InfinityIcon, Check } from "lucide-vue-next";
import type { LicenseItem } from "../../types/licensing";
import { formatDate } from "../../lib/utils";
import BaseModal from "../common/BaseModal.vue";

const props = defineProps<{
  show: boolean;
  license: LicenseItem | null;
  loading: boolean;
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (
    e: "save",
    payload: {
      licenseKey: string;
      additionalDays?: number;
      newExpiresAt?: string | null;
      isLifetime?: boolean;
    }
  ): void;
}>();

type ExpiryMode = "preset" | "custom_date" | "lifetime";
const mode = ref<ExpiryMode>("preset");
const selectedDays = ref<number>(30);
const customDate = ref<string>("");

// Inisialisasi state saat modal dibuka
watch(
  () => props.license,
  (lic) => {
    if (!lic) return;
    mode.value = lic.expiresAt ? "preset" : "lifetime";
    selectedDays.value = 30;

    if (lic.expiresAt) {
      // Set default custom date ke 1 bulan dari sekarang
      const d = new Date(lic.expiresAt);
      if (!isNaN(d.getTime())) {
        customDate.value = d.toISOString().split("T")[0];
      } else {
        const fallback = new Date();
        fallback.setDate(fallback.getDate() + 30);
        customDate.value = fallback.toISOString().split("T")[0];
      }
    } else {
      const d = new Date();
      d.setDate(d.getDate() + 30);
      customDate.value = d.toISOString().split("T")[0];
    }
  },
  { immediate: true }
);

const currentExpiryFormatted = computed(() => {
  return formatDate(props.license?.expiresAt, {
    fallback: "Permanen (Lifetime)",
    month: "long",
  });
});

const currentRemainingDays = computed(() => {
  if (!props.license?.expiresAt) return null;
  const target = new Date(props.license.expiresAt).getTime();
  const diff = Math.ceil((target - Date.now()) / (1000 * 60 * 60 * 24));
  return diff;
});

// Preview kalkulasi tanggal kedaluwarsa baru
const newExpiryPreview = computed(() => {
  if (mode.value === "lifetime") return "Permanen (Tanpa Batas Waktu)";

  if (mode.value === "custom_date") {
    if (!customDate.value) return "Pilih tanggal yang valid";
    return formatDate(customDate.value, {
      fallback: "Format tanggal tidak valid",
      month: "long",
    });
  }

  // Preset / Tambah hari
  const base =
    props.license?.expiresAt && new Date(props.license.expiresAt).getTime() > Date.now()
      ? new Date(props.license.expiresAt)
      : new Date();
  const target = new Date(base);
  target.setDate(target.getDate() + (Number(selectedDays.value) || 0));
  return formatDate(target, { month: "long" });
});

function handleSave() {
  if (!props.license) return;

  if (mode.value === "lifetime") {
    emit("save", {
      licenseKey: props.license.licenseKey,
      isLifetime: true,
      newExpiresAt: null,
    });
    return;
  }

  if (mode.value === "custom_date") {
    if (!customDate.value) return;
    // Set ke akhir hari jam 23:59:59 lokal
    const [y, m, d] = customDate.value.split("-").map(Number);
    const targetDate = new Date(y, m - 1, d, 23, 59, 59, 999);
    emit("save", {
      licenseKey: props.license.licenseKey,
      newExpiresAt: targetDate.toISOString(),
    });
    return;
  }

  // Mode preset / tambah hari
  emit("save", {
    licenseKey: props.license.licenseKey,
    additionalDays: Number(selectedDays.value) || 30,
  });
}
</script>

<template>
  <BaseModal :show="show && Boolean(license)" max-width="max-w-md" @close="emit('close')">
    <template #header>
      <div
        class="px-5 py-3.5 bg-jetblack text-white flex items-center justify-between gap-3 border-b border-white/10"
      >
        <div class="flex items-center gap-2.5">
          <div class="w-7 h-7 rounded-lg bg-gold/15 flex items-center justify-center text-gold">
            <Calendar class="w-4 h-4" />
          </div>
          <div>
            <h3 class="text-xs font-bold uppercase tracking-wider text-white">
              Ubah Masa Aktif Lisensi
            </h3>
            <p v-if="license" class="text-[11px] font-mono text-white/60 truncate max-w-[240px]">
              {{ license.licenseKey }}
            </p>
          </div>
        </div>
        <button
          type="button"
          @click="emit('close')"
          class="text-white/50 hover:text-white transition cursor-pointer p-1 rounded-md"
          title="Tutup (Esc)"
        >
          <X class="w-4 h-4" />
        </button>
      </div>
    </template>

    <!-- Content -->
    <div v-if="license" class="p-5 space-y-4 text-xs">
      <!-- Status Masa Aktif Saat Ini -->
      <div class="p-3 rounded-xl bg-jetblack/[0.03] border border-jetblack/10 space-y-1">
        <div class="flex items-center justify-between">
          <span class="text-jetblack/50 text-[11px]">Masa Aktif Saat Ini</span>
          <span
            class="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono"
            :class="[
              license.status === 'ACTIVE'
                ? 'bg-forest/10 text-forest'
                : license.status === 'REVOKED'
                  ? 'bg-crimson/10 text-crimson'
                  : 'bg-jetblack/10 text-jetblack/60',
            ]"
          >
            {{ license.status }}
          </span>
        </div>
        <div class="flex items-baseline justify-between">
          <div class="text-xs font-bold text-jetblack">
            {{ currentExpiryFormatted }}
          </div>
          <div
            v-if="currentRemainingDays !== null"
            class="text-[10px] font-mono"
            :class="currentRemainingDays > 0 ? 'text-forest' : 'text-crimson font-bold'"
          >
            {{
              currentRemainingDays > 0
                ? `Sisa ${currentRemainingDays} hari`
                : `Lewat ${Math.abs(currentRemainingDays)} hari`
            }}
          </div>
        </div>
      </div>

      <!-- Mode Pilihan -->
      <div class="space-y-2">
        <label class="block font-bold text-jetblack text-[11px] uppercase tracking-wider">
          Metode Pengaturan Baru
        </label>
        <div
          class="grid grid-cols-3 gap-1.5 p-1 bg-jetblack/5 rounded-xl border border-jetblack/10"
        >
          <button
            type="button"
            @click="mode = 'preset'"
            class="py-1.5 px-2 rounded-lg font-bold text-[11px] transition text-center cursor-pointer flex items-center justify-center gap-1"
            :class="
              mode === 'preset'
                ? 'bg-white text-jetblack shadow-xs font-bold'
                : 'text-jetblack/60 hover:text-jetblack'
            "
          >
            <Clock class="w-3 h-3" />
            <span>+ Hari</span>
          </button>
          <button
            type="button"
            @click="mode = 'custom_date'"
            class="py-1.5 px-2 rounded-lg font-bold text-[11px] transition text-center cursor-pointer flex items-center justify-center gap-1"
            :class="
              mode === 'custom_date'
                ? 'bg-white text-jetblack shadow-xs font-bold'
                : 'text-jetblack/60 hover:text-jetblack'
            "
          >
            <Calendar class="w-3 h-3" />
            <span>Pilih Tanggal</span>
          </button>
          <button
            type="button"
            @click="mode = 'lifetime'"
            class="py-1.5 px-2 rounded-lg font-bold text-[11px] transition text-center cursor-pointer flex items-center justify-center gap-1"
            :class="
              mode === 'lifetime'
                ? 'bg-white text-jetblack shadow-xs font-bold'
                : 'text-jetblack/60 hover:text-jetblack'
            "
          >
            <InfinityIcon class="w-3 h-3" />
            <span>Lifetime</span>
          </button>
        </div>
      </div>

      <!-- Mode Form: 1. Preset / Tambah Hari -->
      <div v-if="mode === 'preset'" class="space-y-2.5 animate-fadeIn">
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
          <button
            v-for="preset in [
              { days: 30, label: '+30 Hari (1 Bln)' },
              { days: 90, label: '+90 Hari (3 Bln)' },
              { days: 180, label: '+180 Hari (6 Bln)' },
              { days: 365, label: '+365 Hari (1 Thn)' },
            ]"
            :key="preset.days"
            type="button"
            @click="selectedDays = preset.days"
            class="py-2 px-2 rounded-xl border text-[11px] font-bold text-center transition cursor-pointer"
            :class="
              selectedDays === preset.days
                ? 'bg-gold/15 border-gold text-[#7a641a] shadow-xs'
                : 'bg-white border-jetblack/10 hover:border-jetblack/30 text-jetblack/70'
            "
          >
            {{ preset.label }}
          </button>
        </div>

        <div class="space-y-1">
          <label class="block text-[11px] font-bold text-jetblack/70">
            Atau masukkan jumlah hari tambahan:
          </label>
          <div class="relative">
            <input
              v-model.number="selectedDays"
              type="number"
              min="1"
              max="365"
              placeholder="Mis. 30"
              class="w-full pl-3 pr-12 py-2 rounded-xl bg-white border border-jetblack/15 text-xs font-mono font-bold focus:outline-none focus:border-gold transition"
            />
            <span class="absolute right-3 top-2 text-[11px] text-jetblack/40 font-mono">Hari</span>
          </div>
        </div>
      </div>

      <!-- Mode Form: 2. Pilih Tanggal Tertentu -->
      <div v-else-if="mode === 'custom_date'" class="space-y-2 animate-fadeIn">
        <label class="block text-[11px] font-bold text-jetblack/70">
          Tetapkan Tanggal Kedaluwarsa Baru:
        </label>
        <input
          v-model="customDate"
          type="date"
          class="w-full px-3 py-2 rounded-xl bg-white border border-jetblack/15 text-xs font-mono font-bold focus:outline-none focus:border-gold transition"
        />
        <p class="text-[10.5px] text-jetblack/50">
          Cocok jika Anda ingin mengganti masa aktif yang keliru (mis. semula 1 bulan ingin diubah
          ke tanggal spesifik).
        </p>
      </div>

      <!-- Mode Form: 3. Lifetime -->
      <div
        v-else
        class="p-3.5 rounded-xl bg-gold/10 border border-gold/30 text-[#7a641a] space-y-1.5 animate-fadeIn"
      >
        <div class="flex items-center gap-2 font-bold text-xs">
          <Sparkles class="w-4 h-4 text-gold shrink-0" />
          <span>Lisensi Seumur Hidup (Lifetime)</span>
        </div>
        <p class="text-[11px] leading-relaxed text-[#7a641a]/90">
          Lisensi ini tidak akan pernah kedaluwarsa. Pengguna dapat terus menggunakan software tanpa
          batas waktu.
        </p>
      </div>

      <!-- Preview Hasil Perubahan -->
      <div
        class="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 space-y-1"
      >
        <div class="text-[10.5px] font-bold uppercase tracking-wider text-emerald-700">
          Hasil Perubahan Masa Aktif:
        </div>
        <div class="text-xs font-extrabold flex items-center gap-1.5">
          <Check class="w-3.5 h-3.5 text-emerald-600" />
          <span>{{ newExpiryPreview }}</span>
        </div>
        <div v-if="license.status !== 'ACTIVE'" class="text-[10px] text-emerald-600 font-medium">
          * Status lisensi akan otomatis kembali aktif (ACTIVE).
        </div>
      </div>
    </div>

    <!-- Action Buttons -->
    <template #footer>
      <div class="flex items-center justify-end gap-2">
        <button
          type="button"
          @click="emit('close')"
          :disabled="loading"
          class="px-4 py-2 rounded-xl text-xs font-bold text-jetblack/70 hover:bg-jetblack/5 transition cursor-pointer disabled:opacity-50"
        >
          Batal
        </button>
        <button
          type="button"
          @click="handleSave"
          :disabled="loading"
          class="px-4 py-2 rounded-xl text-xs font-bold text-white bg-jetblack hover:bg-jetblack/90 transition cursor-pointer shadow-xs disabled:opacity-50 inline-flex items-center gap-1.5"
        >
          <span
            v-if="loading"
            class="w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin"
          />
          <span>Simpan Perubahan</span>
        </button>
      </div>
    </template>
  </BaseModal>
</template>
