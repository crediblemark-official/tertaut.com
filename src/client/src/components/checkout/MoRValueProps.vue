<script setup lang="ts">
import { ShieldCheck, CheckCircle2, Clock } from 'lucide-vue-next'
</script>

<template>
  <div class="w-full grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-[#111111]/10 border-b border-[#111111]/10 pb-4 pt-1">
    <div class="py-2 pr-0 sm:pr-4 pl-0 flex items-start gap-2.5">
      <div class="p-2 rounded-lg bg-[#D4AF37]/15 text-[#111111] shrink-0">
        <ShieldCheck class="w-4 h-4" />
      </div>
      <div>
        <div class="font-bold text-xs text-[#111111]">Zero Legal Entity</div>
        <p class="text-[11px] text-[#111111]/60 mt-0.5">Tidak butuh akta PT/CV atau NIB. Legalitas transaksi ditangani oleh platform.</p>
      </div>
    </div>

    <div class="py-2 px-0 sm:px-4 flex items-start gap-2.5">
      <div class="p-2 rounded-lg bg-[#0F4C3A]/10 text-[#0F4C3A] shrink-0">
        <CheckCircle2 class="w-4 h-4" />
      </div>
      <div>
        <div class="font-bold text-xs text-[#111111]">Zero PG Setup</div>
        <p class="text-[11px] text-[#111111]/60 mt-0.5">Tanpa proses registrasi merchant payment gateway berbulan-bulan.</p>
      </div>
    </div>

    <div class="py-2 pl-0 sm:pl-4 pr-0 flex items-start gap-2.5">
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
