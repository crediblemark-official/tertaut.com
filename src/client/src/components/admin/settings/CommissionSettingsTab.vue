<script setup lang="ts">
import type { PlatformSettingsFormData } from "../../../types/panel";
import { Save, Sliders, DollarSign, Wallet } from "lucide-vue-next";

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
    <!-- Parameter Finansial Section -->
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <h2 class="text-xs font-bold uppercase tracking-wider text-jetblack">
          Parameter Finansial &amp; Bagi Hasil
        </h2>
        <span class="text-[11px] font-bold text-forest">
          Fee MoR Platform: {{ form.platform_fee_percent }}%
        </span>
      </div>
      <p class="text-[11px] text-jetblack/60 leading-relaxed">
        Atur persentase bagi hasil pemotongan platform (Merchant of Record cut) dari setiap
        transaksi builder dan ambang batas minimum penarikan dana builder.
      </p>

      <!-- Parameter Cards Grid -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
        <!-- Komisi Platform -->
        <div class="p-3.5 rounded-xl border border-jetblack/15 bg-white space-y-2">
          <div class="flex items-center justify-between">
            <label class="text-xs font-bold text-jetblack block">Komisi Platform (%)</label>
            <span class="text-[10px] font-mono text-jetblack/50">Min: 0% • Max: 50%</span>
          </div>
          <div class="relative">
            <input
              v-model="form.platform_fee_percent"
              type="number"
              min="0"
              max="50"
              step="0.5"
              placeholder="5"
              class="w-full h-9 px-3 pr-8 rounded-lg border border-jetblack/15 bg-white text-xs font-mono font-bold text-jetblack focus:border-gold"
            />
            <span class="absolute right-3 top-2 text-xs font-bold text-jetblack/40">%</span>
          </div>
          <p class="text-[11px] text-jetblack/50 leading-relaxed">
            Dipotong otomatis dari total nilai transaksi (GMV) untuk setiap pembelian lisensi
            software builder.
          </p>
        </div>

        <!-- Min. Pencairan -->
        <div class="p-3.5 rounded-xl border border-jetblack/15 bg-white space-y-2">
          <div class="flex items-center justify-between">
            <label class="text-xs font-bold text-jetblack block">Min. Pencairan (Rp)</label>
            <span class="text-[10px] font-mono text-jetblack/50">Kelipatan Rp 5.000</span>
          </div>
          <div class="relative">
            <span class="absolute left-3 top-2 text-xs font-bold text-jetblack/40">Rp</span>
            <input
              v-model="form.min_payout_threshold"
              type="number"
              min="10000"
              step="5000"
              placeholder="50000"
              class="w-full h-9 pl-9 pr-3 rounded-lg border border-jetblack/15 bg-white text-xs font-mono font-bold text-jetblack focus:border-gold"
            />
          </div>
          <p class="text-[11px] text-jetblack/50 leading-relaxed">
            Saldo tertahan builder harus mencapai nominal ini sebelum dapat mengajukan pencairan
            otomatis (Payout).
          </p>
        </div>
      </div>
    </div>

    <!-- Save Button for Commission Tab -->
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
        <span>Simpan Pengaturan Komisi</span>
      </button>
    </div>
  </div>
</template>
