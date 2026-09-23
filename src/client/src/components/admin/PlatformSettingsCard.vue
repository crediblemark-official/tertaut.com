<script setup lang="ts">
import { ref, onMounted } from "vue";
import { api } from "../../lib/api";
import { Sliders, Bell, Save, CheckCircle2, AlertTriangle, ShieldCheck } from "lucide-vue-next";

const emit = defineEmits<{
  (e: "alert", payload: { type: "success" | "error"; text: string }): void;
}>();

const loading = ref(false);
const saving = ref(false);

const form = ref({
  platform_fee_percent: "5",
  min_payout_threshold: "50000",
  announcement_banner: "",
  announcement_type: "info",
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
  loadSettings();
});
</script>

<template>
  <div class="space-y-6 max-w-4xl">
    <!-- Card 1: MoR Financial Parameters -->
    <div class="p-6 rounded-2xl bg-white border border-jetblack/10 shadow-xs space-y-4">
      <div class="flex items-center gap-2 pb-3 border-b border-jetblack/10">
        <Sliders class="w-4 h-4 text-gold" />
        <h2 class="text-sm font-extrabold text-jetblack">Parameter Merchant of Record (MoR)</h2>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
        <!-- Platform Fee % -->
        <div class="space-y-1.5">
          <label class="text-xs font-bold text-jetblack block"> Komisi Platform MoR (%) </label>
          <div class="relative">
            <input
              v-model="form.platform_fee_percent"
              type="number"
              min="0"
              max="50"
              step="0.5"
              class="w-full h-10 px-3 pr-8 rounded-lg border border-slate-300 bg-white text-xs font-mono font-bold text-jetblack focus:ring-2 focus:ring-gold/20 focus:border-gold transition"
            />
            <span class="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400"
              >%</span
            >
          </div>
          <p class="text-[11px] text-slate-500">
            Persentase resmi yang dipotong otomatis saat transaksi berhasil. Default 5%.
          </p>
        </div>

        <!-- Min Payout Threshold -->
        <div class="space-y-1.5">
          <label class="text-xs font-bold text-jetblack block">
            Batas Minimum Pencairan (IDR)
          </label>
          <div class="relative">
            <span class="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400"
              >Rp</span
            >
            <input
              v-model="form.min_payout_threshold"
              type="number"
              min="10000"
              step="5000"
              class="w-full h-10 pl-9 pr-3 rounded-lg border border-slate-300 bg-white text-xs font-mono font-bold text-jetblack focus:ring-2 focus:ring-gold/20 focus:border-gold transition"
            />
          </div>
          <p class="text-[11px] text-slate-500">
            Saldo bersih minimal agar builder dapat mencairkan dana. Default Rp 50.000.
          </p>
        </div>
      </div>
    </div>

    <!-- Card 2: Broadcast Announcement Banner -->
    <div class="p-6 rounded-2xl bg-white border border-jetblack/10 shadow-xs space-y-4">
      <div class="flex items-center gap-2 pb-3 border-b border-jetblack/10">
        <Bell class="w-4 h-4 text-emerald-600" />
        <h2 class="text-sm font-extrabold text-jetblack">Pengumuman Broadcast Platform</h2>
      </div>

      <div class="space-y-4 pt-2">
        <div class="space-y-1.5">
          <label class="text-xs font-bold text-jetblack block">
            Teks Pengumuman (Tampil di Seluruh Dashboard Builder)
          </label>
          <textarea
            v-model="form.announcement_banner"
            rows="3"
            placeholder="Kosongkan jika tidak ada pengumuman aktif. Contoh: Pemeliharaan gateway terjadwal hari Minggu pukul 02:00 WIB."
            class="w-full p-3 rounded-lg border border-slate-300 bg-white text-xs text-jetblack focus:ring-2 focus:ring-gold/20 focus:border-gold transition"
          ></textarea>
        </div>

        <div class="space-y-1.5 max-w-xs">
          <label class="text-xs font-bold text-jetblack block">Tipe Banner</label>
          <select
            v-model="form.announcement_type"
            class="w-full h-9 px-3 rounded-lg border border-slate-300 bg-white text-xs font-medium text-jetblack"
          >
            <option value="info">Informasi (Biru / Netral)</option>
            <option value="warning">Peringatan (Kuning / Amber)</option>
            <option value="alert">Penting / Kritis (Merah)</option>
          </select>
        </div>
      </div>
    </div>

    <!-- Save Button -->
    <div class="flex justify-end">
      <button
        @click="handleSave"
        :disabled="saving"
        class="h-10 px-6 rounded-xl btn-gold text-xs font-bold transition inline-flex items-center gap-2 shadow-sm cursor-pointer disabled:opacity-50"
      >
        <span
          v-if="saving"
          class="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin"
        ></span>
        <Save v-else class="w-4 h-4 stroke-[2.5]" />
        <span>Simpan Pengaturan</span>
      </button>
    </div>
  </div>
</template>
