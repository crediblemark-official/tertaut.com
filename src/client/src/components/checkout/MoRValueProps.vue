<script setup lang="ts">
import { ShieldCheck, CheckCircle2, Clock } from 'lucide-vue-next'
</script>

<template>
  <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
    <div class="luxury-card p-3.5 rounded-xl flex items-start gap-2.5">
      <div class="p-2 rounded-lg bg-[#D4AF37]/15 text-[#111111] shrink-0">
        <ShieldCheck class="w-4 h-4" />
      </div>
      <div>
        <div class="font-bold text-xs text-[#111111]">Zero Legal Entity</div>
        <p class="text-[11px] text-[#111111]/60 mt-0.5">Tidak butuh akta PT/CV atau NIB. Legalitas transaksi ditangani oleh platform.</p>
      </div>
    </div>

    <div class="luxury-card p-3.5 rounded-xl flex items-start gap-2.5">
      <div class="p-2 rounded-lg bg-[#0F4C3A]/10 text-[#0F4C3A] shrink-0">
        <CheckCircle2 class="w-4 h-4" />
      </div>
      <div>
        <div class="font-bold text-xs text-[#111111]">Zero PG Setup</div>
        <p class="text-[11px] text-[#111111]/60 mt-0.5">Tanpa proses registrasi merchant payment gateway berbulan-bulan.</p>
      </div>
    </div>

    <div class="luxury-card p-3.5 rounded-xl flex items-start gap-2.5">
      <div class="p-2 rounded-lg bg-[#111111]/5 text-[#111111] shrink-0">
        <Clock class="w-4 h-4" />
      </div>
      <div>
        <div class="font-bold text-xs text-[#111111]">Automated Disbursement</div>
        <p class="text-[11px] text-[#111111]/60 mt-0.5">95% dana bersih dicairkan ke rekening bank/e-wallet via API Xendit.</p>
      </div>
    </div>
  </div>
</template>
