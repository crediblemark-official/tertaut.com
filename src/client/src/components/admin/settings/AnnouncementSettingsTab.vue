<script setup lang="ts">
import type { PlatformSettingsFormData } from "../../../types/panel";
import { Save, Bell, AlertTriangle, Info, AlertCircle } from "lucide-vue-next";

defineProps<{
  form: PlatformSettingsFormData;
  saving: boolean;
}>();

const emit = defineEmits<{
  (e: "save"): void;
}>();
</script>

<template>
  <div class="space-y-6 animate-fadeIn">
    <!-- Pengumuman Broadcast Section -->
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <h2 class="text-xs font-bold uppercase tracking-wider text-jetblack">
          Pengumuman Broadcast Dashboard
        </h2>
        <span
          v-if="form.announcement_banner && form.announcement_banner.trim()"
          class="text-[11px] font-bold text-amber-600 flex items-center gap-1.5"
        >
          <span class="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
          Banner Aktif
        </span>
        <span v-else class="text-[11px] text-jetblack/40"> Tidak Ada Banner Aktif </span>
      </div>
      <p class="text-[11px] text-jetblack/60 leading-relaxed">
        Kirimkan pesan global yang akan ditampilkan sebagai banner di bagian paling atas seluruh
        dashboard builder aktif.
      </p>

      <div class="space-y-4 pt-1">
        <!-- Textarea input -->
        <div class="space-y-1.5">
          <label class="text-xs font-bold text-jetblack block">Isi Pesan Pengumuman</label>
          <textarea
            v-model="form.announcement_banner"
            rows="3"
            placeholder="Tulis pengumuman untuk seluruh dashboard builder (kosongkan jika tidak ingin menampilkan banner)..."
            class="w-full p-3 rounded-xl border border-jetblack/15 bg-white text-xs text-jetblack focus:border-gold placeholder:text-jetblack/30 leading-relaxed shadow-xs"
          ></textarea>
        </div>

        <!-- Banner Type Select -->
        <div class="flex flex-col sm:flex-row sm:items-center gap-3">
          <label class="text-xs font-bold text-jetblack shrink-0"
            >Tingkat Urgensi / Tipe Banner:</label
          >
          <select
            v-model="form.announcement_type"
            class="h-9 px-3 rounded-lg border border-jetblack/15 bg-white text-xs text-jetblack focus:border-gold font-medium"
          >
            <option value="info">Informasi (Biru - Pengumuman Fitur &amp; Jadwal)</option>
            <option value="warning">Peringatan (Kuning - Maintenance Mendatang)</option>
            <option value="alert">Kritis (Merah - Gangguan Layanan Segera)</option>
          </select>
        </div>

        <!-- Live Preview of Announcement Banner -->
        <div v-if="form.announcement_banner && form.announcement_banner.trim()" class="pt-2">
          <label class="text-[11px] font-semibold text-jetblack/60 block mb-1.5">
            Live Preview Banner di Dashboard Builder:
          </label>
          <div
            class="p-3.5 rounded-xl text-xs font-medium flex items-start gap-2.5 border shadow-xs transition"
            :class="[
              form.announcement_type === 'info'
                ? 'bg-blue-50 border-blue-200 text-blue-900'
                : form.announcement_type === 'warning'
                  ? 'bg-amber-50 border-amber-200 text-amber-900'
                  : 'bg-rose-50 border-rose-200 text-rose-900',
            ]"
          >
            <Info
              v-if="form.announcement_type === 'info'"
              class="w-4 h-4 text-blue-600 shrink-0 mt-0.5"
            />
            <AlertTriangle
              v-else-if="form.announcement_type === 'warning'"
              class="w-4 h-4 text-amber-600 shrink-0 mt-0.5"
            />
            <AlertCircle v-else class="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div class="flex-1 leading-relaxed">
              <span class="font-bold mr-1">
                {{
                  form.announcement_type === "info"
                    ? "Info:"
                    : form.announcement_type === "warning"
                      ? "Peringatan:"
                      : "Penting:"
                }}
              </span>
              <span>{{ form.announcement_banner }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Save Button for Announcement Tab -->
    <div class="pt-6 flex justify-end border-t border-jetblack/10">
      <button
        @click="emit('save')"
        :disabled="saving"
        class="h-9 px-5 rounded-lg btn-gold text-xs font-bold transition inline-flex items-center gap-2 cursor-pointer disabled:opacity-50 active:scale-95"
      >
        <span
          v-if="saving"
          class="w-3.5 h-3.5 border-2 border-black/30 border-t-black rounded-full animate-spin"
        ></span>
        <Save v-else class="w-3.5 h-3.5 stroke-[2.5]" />
        <span>Simpan Pengumuman</span>
      </button>
    </div>
  </div>
</template>
