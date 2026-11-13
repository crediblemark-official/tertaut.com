<script setup lang="ts">
import type { PlatformSettingsFormData } from "../../../types/panel";
import { Save, Bell, Sparkles, RotateCcw, X } from "lucide-vue-next";

const props = defineProps<{
  form: PlatformSettingsFormData;
  saving: boolean;
}>();

const emit = defineEmits<{
  (e: "save"): void;
}>();

const PRESETS = [
  {
    label: "Pemeliharaan Server",
    type: "warning" as const,
    text: "Pemeliharaan terjadwal server dan gateway pembayaran pada Minggu pukul 02:00 - 04:00 WIB. Transaksi mungkin mengalami jeda sesaat.",
  },
  {
    label: "Update Fitur Baru",
    type: "info" as const,
    text: "Pembaruan v2.3: Dukungan QRIS Realtime Xendit dan lisensi multi-device kini aktif otomatis untuk seluruh software Anda!",
  },
  {
    label: "Libur Operasional Bank",
    type: "info" as const,
    text: "Pemberitahuan: Kliring perbankan libur cuti bersama nasional. Pengajuan pencairan saldo diproses pada hari kerja berikutnya.",
  },
];

function applyPreset(preset: (typeof PRESETS)[number]) {
  props.form.announcement_banner = preset.text;
  props.form.announcement_type = preset.type;
}

function clearBanner() {
  props.form.announcement_banner = "";
}
</script>

<template>
  <div
    class="-mx-3.5 sm:-mx-4 md:-mx-6 divide-y divide-jetblack/10 border-b border-jetblack/10 animate-fadeIn"
  >
    <!-- SECTION 1: PENGUMUMAN BROADCAST DASHBOARD -->
    <section class="divide-y divide-jetblack/10">
      <div
        class="px-3.5 sm:px-4 md:px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
      >
        <div>
          <h2
            class="text-xs font-bold uppercase tracking-wider text-jetblack flex items-center gap-2"
          >
            <Bell class="w-3.5 h-3.5 text-gold" />
            <span>Pengumuman Broadcast Dashboard</span>
          </h2>
          <p class="text-[11px] text-jetblack/60 mt-0.5">
            Kirimkan pesan global yang akan ditampilkan sebagai banner di bagian paling atas seluruh
            dashboard builder aktif.
          </p>
        </div>
        <span
          v-if="form.announcement_banner && form.announcement_banner.trim()"
          class="text-[11px] font-bold text-[#8a6d1f] inline-flex items-center gap-1.5 shrink-0 font-mono uppercase"
        >
          <span class="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
          <span>Banner Aktif ({{ form.announcement_type.toUpperCase() }})</span>
        </span>
        <span v-else class="text-[11px] text-jetblack/45 shrink-0 font-mono uppercase">
          Nonaktif
        </span>
      </div>

      <!-- Quick Preset Buttons -->
      <div class="px-3.5 sm:px-4 md:px-6 py-3 flex items-center gap-2 flex-wrap text-xs">
        <span class="text-[11px] font-semibold text-jetblack/60 flex items-center gap-1">
          <Sparkles class="w-3.5 h-3.5 text-gold" />
          <span>Template Cepat:</span>
        </span>
        <button
          v-for="p in PRESETS"
          :key="p.label"
          type="button"
          @click="applyPreset(p)"
          class="px-2.5 py-1 rounded-md border border-jetblack/15 bg-white hover:border-gold hover:text-[#8a6d1f] text-[11px] font-medium text-jetblack transition cursor-pointer"
        >
          {{ p.label }}
        </button>
      </div>

      <!-- Textarea Input Row -->
      <div class="px-3.5 sm:px-4 md:px-6 py-4 space-y-2">
        <div class="flex items-center justify-between">
          <label class="text-xs font-bold text-jetblack block">Isi Pesan Pengumuman</label>
          <div class="flex items-center gap-2">
            <span class="text-[10px] font-mono text-jetblack/45">
              {{ form.announcement_banner ? form.announcement_banner.length : 0 }} karakter
            </span>
            <button
              v-if="form.announcement_banner && form.announcement_banner.trim()"
              type="button"
              @click="clearBanner"
              class="text-[10.5px] font-semibold text-crimson hover:underline flex items-center gap-1 cursor-pointer ml-1"
              title="Kosongkan isi banner"
            >
              <RotateCcw class="w-3 h-3" />
              <span>Kosongkan</span>
            </button>
          </div>
        </div>
        <textarea
          v-model="form.announcement_banner"
          rows="3"
          placeholder="Tulis pesan pengumuman untuk seluruh dashboard builder (kosongkan jika tidak ingin menampilkan banner)..."
          class="w-full p-2.5 rounded-md border border-jetblack/20 bg-white text-xs text-jetblack focus:border-gold focus:outline-none placeholder:text-jetblack/35 leading-relaxed"
        ></textarea>
        <p class="text-[11px] text-jetblack/60">
          Pesan ini muncul di header seluruh akun builder. Kosongkan textarea dan klik simpan untuk
          menonaktifkan banner.
        </p>
      </div>

      <!-- Tingkat Urgensi Select Row -->
      <div
        class="px-3.5 sm:px-4 md:px-6 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
      >
        <div>
          <label class="text-xs font-bold text-jetblack block"
            >Tingkat Urgensi / Tipe Tampilan:</label
          >
          <p class="text-[11px] text-jetblack/60 mt-0.5">
            Menentukan warna tema dan ikon yang tampil di banner dashboard builder.
          </p>
        </div>
        <select
          v-model="form.announcement_type"
          class="h-9 px-3 pr-8 rounded-md border border-jetblack/20 bg-white text-xs text-jetblack font-bold focus:border-gold focus:outline-none shrink-0 cursor-pointer"
        >
          <option value="info">Informasi (Biru - Fitur &amp; Jadwal)</option>
          <option value="warning">Peringatan (Kuning - Maintenance)</option>
          <option value="alert">Kritis (Merah - Gangguan Layanan)</option>
        </select>
      </div>

      <!-- Live Preview of Banner as Rendered in Builder Dashboard -->
      <div class="py-4 space-y-2.5">
        <div class="px-3.5 sm:px-4 md:px-6 flex items-center justify-between">
          <span class="text-xs font-bold text-jetblack flex items-center gap-1.5">
            <Sparkles class="w-3.5 h-3.5 text-gold" />
            <span>Live Preview Banner di Dashboard Builder</span>
          </span>
          <span class="text-[10px] font-mono font-bold text-jetblack/50 uppercase">
            Tampilan Presisi 1:1
          </span>
        </div>

        <div v-if="form.announcement_banner && form.announcement_banner.trim()">
          <div
            :class="[
              'w-full px-3.5 sm:px-4 md:px-6 py-2.5 text-xs font-semibold flex items-center justify-between border-y transition',
              form.announcement_type === 'alert'
                ? 'bg-red-50 text-red-700 border-red-200'
                : form.announcement_type === 'warning'
                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                  : 'bg-blue-50 text-blue-700 border-blue-200',
            ]"
          >
            <div class="flex items-center gap-2">
              <Bell class="w-3.5 h-3.5 shrink-0" />
              <span>{{ form.announcement_banner }}</span>
            </div>
            <button
              type="button"
              @click="clearBanner"
              class="opacity-60 hover:opacity-100 p-0.5 cursor-pointer shrink-0 ml-2"
              title="Tutup"
              aria-label="Tutup"
            >
              <X class="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        <div v-else class="px-3.5 sm:px-4 md:px-6 py-2 text-xs text-jetblack/45 italic">
          Banner saat ini kosong (tidak ada pesan yang ditampilkan di dashboard builder).
        </div>
      </div>
    </section>

    <!-- SECTION 2: SAVE ACTION BOTTOM BAR -->
    <div
      class="px-3.5 sm:px-4 md:px-6 py-4 bg-jetblack/[0.015] flex items-center justify-between gap-4"
    >
      <div class="text-xs text-jetblack/60 hidden sm:block">
        Banner langsung diperbarui pada sesi berikutnya bagi seluruh builder aktif.
      </div>
      <button
        type="button"
        @click="emit('save')"
        :disabled="saving"
        class="h-9 px-5 rounded-lg btn-gold text-xs font-bold transition inline-flex items-center gap-2 cursor-pointer disabled:opacity-50 active:scale-95 shrink-0 ml-auto sm:ml-0"
      >
        <span
          v-if="saving"
          class="w-3.5 h-3.5 border-2 border-black/30 border-t-black rounded-full animate-spin"
        ></span>
        <Save v-else class="w-3.5 h-3.5 stroke-[2.5]" />
        <span>Simpan</span>
      </button>
    </div>
  </div>
</template>
