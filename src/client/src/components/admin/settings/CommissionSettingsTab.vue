<script setup lang="ts">
import { computed } from "vue";
import type { PlatformSettingsFormData } from "../../../types/panel";
import {
  Save,
  Sliders,
  DollarSign,
  Wallet,
  Calculator,
  ArrowRight,
  Landmark,
  ShieldAlert,
} from "lucide-vue-next";

const props = defineProps<{
  form: PlatformSettingsFormData;
  saving: boolean;
}>();

const emit = defineEmits<{
  (e: "save"): void;
}>();

// Perhitungan simulasi real-time berdasarkan persentase form
const simulationGMV = 100000;
const feePercent = computed(() => {
  const p = parseFloat(props.form.platform_fee_percent);
  return isNaN(p) ? 5 : Math.max(0, Math.min(50, p));
});

const feeCutAmount = computed(() => Math.round((simulationGMV * feePercent.value) / 100));
const builderNetAmount = computed(() => simulationGMV - feeCutAmount.value);
</script>

<template>
  <div class="space-y-6 animate-fadeIn">
    <!-- SECTION 1: PARAMETER FINANSIAL & BAGI HASIL -->
    <section class="space-y-3">
      <div
        class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-jetblack/15"
      >
        <div>
          <h2
            class="text-xs font-bold uppercase tracking-wider text-jetblack flex items-center gap-2"
          >
            <Sliders class="w-4 h-4 text-gold" />
            <span>Parameter Finansial &amp; Bagi Hasil</span>
          </h2>
          <p class="text-[11px] text-jetblack/60 mt-0.5">
            Atur persentase bagi hasil pemotongan platform dari setiap transaksi builder dan ambang
            batas minimum penarikan dana builder.
          </p>
        </div>
        <span
          class="text-[10px] font-bold text-forest bg-forest/10 px-2.5 py-0.5 rounded-full border border-forest/20 shrink-0 self-start sm:self-auto font-mono"
        >
          Fee Platform: {{ form.platform_fee_percent }}%
        </span>
      </div>

      <!-- Parameter Inputs (Clean Grid without Box Wrappers) -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-6 py-3 border-b border-jetblack/10">
        <!-- 1. Komisi Platform -->
        <div class="space-y-1.5">
          <div class="flex items-center justify-between">
            <label class="text-xs font-bold text-jetblack flex items-center gap-1.5">
              <DollarSign class="w-3.5 h-3.5 text-gold" />
              <span>Komisi Platform (%)</span>
            </label>
            <span class="text-[10px] font-mono text-jetblack/50"> Min: 0% • Max: 50% </span>
          </div>
          <div class="relative">
            <input
              v-model="form.platform_fee_percent"
              type="number"
              min="0"
              max="50"
              step="0.5"
              placeholder="5"
              class="w-full h-9 px-3 pr-8 rounded-lg border border-jetblack/20 bg-white text-xs font-mono font-bold text-jetblack focus:border-gold focus:ring-1 focus:ring-gold/30"
            />
            <span class="absolute right-3 top-2 text-xs font-bold text-jetblack/40">%</span>
          </div>
          <p class="text-[11px] text-jetblack/60 leading-relaxed">
            Dipotong otomatis dari total nilai transaksi (GMV) untuk setiap pembelian lisensi
            software builder yang berhasil dibayar pembeli.
          </p>
        </div>

        <!-- 2. Min. Pencairan -->
        <div class="space-y-1.5">
          <div class="flex items-center justify-between">
            <label class="text-xs font-bold text-jetblack flex items-center gap-1.5">
              <Wallet class="w-3.5 h-3.5 text-forest" />
              <span>Min. Pencairan (Rp)</span>
            </label>
            <span class="text-[10px] font-mono text-jetblack/50"> Kelipatan Rp 5.000 </span>
          </div>
          <div class="relative">
            <span class="absolute left-3 top-2 text-xs font-bold text-jetblack/40">Rp</span>
            <input
              v-model="form.min_payout_threshold"
              type="number"
              min="10000"
              step="5000"
              placeholder="50000"
              class="w-full h-9 pl-9 pr-3 rounded-lg border border-jetblack/20 bg-white text-xs font-mono font-bold text-jetblack focus:border-gold focus:ring-1 focus:ring-gold/30"
            />
          </div>
          <p class="text-[11px] text-jetblack/60 leading-relaxed">
            Saldo tertahan builder harus mencapai nominal ini sebelum dapat mengajukan atau diproses
            dalam batch pencairan otomatis (Payout).
          </p>
        </div>
      </div>
    </section>

    <!-- SECTION 2: SIMULASI BAGI HASIL REALTIME -->
    <section class="space-y-3 pt-2">
      <div class="flex items-center justify-between pb-2 border-b border-jetblack/15">
        <div class="flex items-center gap-2">
          <Calculator class="w-4 h-4 text-gold" />
          <h3 class="text-xs font-bold uppercase tracking-wider text-jetblack">
            Simulasi Perhitungan Bagi Hasil Transaksi
          </h3>
        </div>
        <span class="text-[10px] font-mono font-bold text-jetblack/50 uppercase">
          Contoh GMV: Rp {{ simulationGMV.toLocaleString("id-ID") }}
        </span>
      </div>

      <!-- 3-Column Breakdown with Divider Lines -->
      <div
        class="grid grid-cols-1 sm:grid-cols-3 gap-4 divide-y sm:divide-y-0 sm:divide-x divide-jetblack/10 py-2 border-b border-jetblack/10"
      >
        <!-- Nilai Transaksi Pembeli -->
        <div class="pt-2 sm:pt-0 sm:pr-4 space-y-1">
          <span class="text-[10px] font-bold text-jetblack/50 uppercase tracking-wider block">
            1. Total Bayar Pembeli (GMV)
          </span>
          <div class="text-sm font-bold font-mono text-jetblack">
            Rp {{ simulationGMV.toLocaleString("id-ID") }}
          </div>
          <span class="text-[10px] text-jetblack/50 block">Nilai lisensi dibayar pelanggan</span>
        </div>

        <!-- Potongan Fee Platform -->
        <div class="pt-2 sm:pt-0 sm:px-4 space-y-1">
          <div class="flex items-center justify-between">
            <span class="text-[10px] font-bold text-gold-muted uppercase tracking-wider block">
              2. Fee Platform ({{ feePercent }}%)
            </span>
            <span
              class="text-[9px] font-bold px-1.5 py-0.2 rounded bg-gold/15 text-gold-muted font-mono"
            >
              Otomatis
            </span>
          </div>
          <div class="text-sm font-bold font-mono text-gold-muted">
            Rp {{ feeCutAmount.toLocaleString("id-ID") }}
          </div>
          <span class="text-[10px] text-jetblack/50 block">Pendapatan operasional Tertaut</span>
        </div>

        <!-- Bersih Diterima Builder -->
        <div class="pt-2 sm:pt-0 sm:pl-4 space-y-1">
          <div class="flex items-center justify-between">
            <span class="text-[10px] font-bold text-forest uppercase tracking-wider block">
              3. Bersih Diterima Builder
            </span>
            <span
              class="text-[9px] font-bold px-1.5 py-0.2 rounded bg-forest/15 text-forest font-mono"
            >
              {{ 100 - feePercent }}% Bersih
            </span>
          </div>
          <div class="text-sm font-bold font-mono text-forest">
            Rp {{ builderNetAmount.toLocaleString("id-ID") }}
          </div>
          <span class="text-[10px] text-jetblack/50 block">Masuk ke saldo builder siap payout</span>
        </div>
      </div>
    </section>

    <!-- SECTION 3: JADWAL & PROSEDUR PENCAIRAN -->
    <div class="py-3 border-b border-jetblack/10 space-y-1.5">
      <div class="flex items-center gap-2">
        <Landmark class="w-4 h-4 text-forest" />
        <h3 class="text-xs font-bold text-jetblack">Kebijakan &amp; Eksekusi Batch Payout</h3>
      </div>
      <p class="text-[11px] text-jetblack/70 leading-relaxed">
        Pencairan saldo massal builder dieksekusi berkala setiap hari Jumat pukul 17:00 WIB melalui
        menu
        <strong>Ringkasan Ekosistem (Overview)</strong>. Seluruh builder dengan rekening bank
        terverifikasi dan saldo memenuhi ambang batas minimum di atas akan diproses otomatis ke
        rekening masing-masing.
      </p>
    </div>

    <!-- SECTION 4: SAVE ACTION BOTTOM BAR -->
    <div class="pt-6 flex items-center justify-between border-t border-jetblack/15">
      <div class="text-xs text-jetblack/60 hidden sm:block">
        Perubahan fee berlaku seketika untuk transaksi pembelian baru berikutnya.
      </div>
      <button
        type="button"
        @click="emit('save')"
        :disabled="saving"
        class="h-9 px-5 rounded-lg btn-gold text-xs font-bold transition inline-flex items-center gap-2 cursor-pointer disabled:opacity-50 active:scale-95 shadow-xs shrink-0"
      >
        <span
          v-if="saving"
          class="w-3.5 h-3.5 border-2 border-black/30 border-t-black rounded-full animate-spin"
        ></span>
        <Save v-else class="w-3.5 h-3.5 stroke-[2.5]" />
        <span>Simpan Pengaturan Komisi</span>
      </button>
    </div>
  </div>
</template>
