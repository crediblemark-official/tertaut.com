<script setup lang="ts">
import { computed } from "vue";
import type { PlatformSettingsFormData } from "../../../types/panel";
import { Save, Sliders, DollarSign, Wallet, Calculator, Landmark } from "lucide-vue-next";

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
  <div
    class="-mx-3.5 sm:-mx-4 md:-mx-6 divide-y divide-jetblack/10 border-b border-jetblack/10 animate-fadeIn"
  >
    <!-- SECTION 1: PARAMETER FINANSIAL & BAGI HASIL -->
    <section class="divide-y divide-jetblack/10">
      <div
        class="px-3.5 sm:px-4 md:px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
      >
        <div>
          <h2
            class="text-xs font-bold uppercase tracking-wider text-jetblack flex items-center gap-2"
          >
            <Sliders class="w-3.5 h-3.5 text-gold" />
            <span>Parameter Finansial &amp; Bagi Hasil</span>
          </h2>
          <p class="text-[11px] text-jetblack/60 mt-0.5">
            Atur persentase bagi hasil pemotongan platform dari setiap transaksi builder dan ambang
            batas minimum penarikan dana builder.
          </p>
        </div>
        <span class="text-[11px] font-bold text-forest font-mono uppercase shrink-0">
          Fee Platform: {{ form.platform_fee_percent }}%
        </span>
      </div>

      <!-- Parameter Inputs (Hairline 2-Col Split) -->
      <div
        class="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-jetblack/10"
      >
        <!-- 1. Komisi Platform -->
        <div class="px-3.5 sm:px-4 md:px-6 py-4 space-y-1.5">
          <div class="flex items-center justify-between">
            <label class="text-xs font-bold text-jetblack flex items-center gap-1.5">
              <DollarSign class="w-3.5 h-3.5 text-gold" />
              <span>Komisi Platform (%)</span>
            </label>
            <span class="text-[10px] font-mono text-jetblack/50">Min: 0% &bull; Max: 50%</span>
          </div>
          <div class="relative">
            <input
              v-model="form.platform_fee_percent"
              type="number"
              min="0"
              max="50"
              step="0.5"
              placeholder="5"
              class="w-full h-9 px-3 pr-8 rounded-md border border-jetblack/20 bg-white text-xs font-mono font-bold text-jetblack focus:border-gold focus:outline-none"
            />
            <span class="absolute right-3 top-2.5 text-xs font-bold text-jetblack/40">%</span>
          </div>
          <p class="text-[11px] text-jetblack/60 leading-relaxed">
            Dipotong otomatis dari total nilai transaksi (GMV) untuk setiap pembelian lisensi
            software builder yang berhasil dibayar pembeli.
          </p>
        </div>

        <!-- 2. Min. Pencairan -->
        <div class="px-3.5 sm:px-4 md:px-6 py-4 space-y-1.5">
          <div class="flex items-center justify-between">
            <label class="text-xs font-bold text-jetblack flex items-center gap-1.5">
              <Wallet class="w-3.5 h-3.5 text-forest" />
              <span>Min. Pencairan (Rp)</span>
            </label>
            <span class="text-[10px] font-mono text-jetblack/50">Kelipatan Rp 5.000</span>
          </div>
          <div class="relative">
            <span class="absolute left-3 top-2.5 text-xs font-bold text-jetblack/40">Rp</span>
            <input
              v-model="form.min_payout_threshold"
              type="number"
              min="10000"
              step="5000"
              placeholder="50000"
              class="w-full h-9 pl-9 pr-3 rounded-md border border-jetblack/20 bg-white text-xs font-mono font-bold text-jetblack focus:border-gold focus:outline-none"
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
    <section class="divide-y divide-jetblack/10">
      <div class="px-3.5 sm:px-4 md:px-6 py-3.5 flex items-center justify-between">
        <div class="flex items-center gap-2">
          <Calculator class="w-3.5 h-3.5 text-gold" />
          <h3 class="text-xs font-bold uppercase tracking-wider text-jetblack">
            Simulasi Perhitungan Bagi Hasil Transaksi
          </h3>
        </div>
        <span class="text-[10px] font-mono font-bold text-jetblack/50 uppercase">
          Contoh GMV: Rp {{ simulationGMV.toLocaleString("id-ID") }}
        </span>
      </div>

      <!-- 3-Column Breakdown with Hairline Dividers -->
      <div
        class="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-jetblack/10"
      >
        <div class="px-3.5 sm:px-4 md:px-6 py-3.5 space-y-1">
          <span class="text-[10px] font-bold text-jetblack/50 uppercase tracking-wider block">
            1. Total Bayar Pembeli (GMV)
          </span>
          <div class="text-sm font-bold font-mono text-jetblack">
            Rp {{ simulationGMV.toLocaleString("id-ID") }}
          </div>
          <span class="text-[10px] text-jetblack/50 block">Nilai lisensi dibayar pelanggan</span>
        </div>

        <div class="px-3.5 sm:px-4 md:px-6 py-3.5 space-y-1">
          <div class="flex items-center justify-between">
            <span class="text-[10px] font-bold text-[#8a6d1f] uppercase tracking-wider block">
              2. Fee Platform ({{ feePercent }}%)
            </span>
            <span class="text-[10px] font-bold text-[#8a6d1f] font-mono">Otomatis</span>
          </div>
          <div class="text-sm font-bold font-mono text-[#8a6d1f]">
            Rp {{ feeCutAmount.toLocaleString("id-ID") }}
          </div>
          <span class="text-[10px] text-jetblack/50 block">Pendapatan operasional Tertaut</span>
        </div>

        <div class="px-3.5 sm:px-4 md:px-6 py-3.5 space-y-1">
          <div class="flex items-center justify-between">
            <span class="text-[10px] font-bold text-forest uppercase tracking-wider block">
              3. Bersih Diterima Builder
            </span>
            <span class="text-[10px] font-bold text-forest font-mono">
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
    <div class="px-3.5 sm:px-4 md:px-6 py-4 space-y-1.5">
      <div class="flex items-center gap-2">
        <Landmark class="w-4 h-4 text-forest" />
        <h3 class="text-xs font-bold text-jetblack">Kebijakan &amp; Eksekusi Batch Payout</h3>
      </div>
      <p class="text-[11px] text-jetblack/70 leading-relaxed">
        Pencairan saldo massal builder dieksekusi berkala setiap hari Jumat pukul 17:00 WIB melalui
        menu <strong>Ringkasan Ekosistem</strong>. Seluruh builder dengan rekening bank
        terverifikasi dan saldo memenuhi ambang batas minimum di atas akan diproses otomatis ke
        rekening masing-masing.
      </p>
    </div>

    <!-- SECTION 4: SAVE ACTION BOTTOM BAR -->
    <div
      class="px-3.5 sm:px-4 md:px-6 py-4 bg-jetblack/[0.015] flex items-center justify-between gap-4"
    >
      <div class="text-xs text-jetblack/60 hidden sm:block">
        Perubahan fee berlaku seketika untuk transaksi pembelian baru berikutnya.
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
