<script setup lang="ts">
import { ShieldCheck, CheckCircle2 } from "lucide-vue-next";
import { COMPANY_INFO, MANAGED_PAYMENT_SPLIT } from "@/constants/company";

defineProps<{
  isSandbox: boolean;
}>();
</script>

<template>
  <div
    class="-mx-3.5 sm:-mx-4 md:-mx-6 px-3.5 sm:px-4 md:px-6 py-2.5 border-b border-jetblack/10 bg-jetblack/[0.02]"
  >
    <div class="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs min-w-0">
      <ShieldCheck
        class="w-4 h-4 shrink-0"
        :class="isSandbox ? 'text-amber-600' : 'text-emerald-600'"
      />
      <span class="font-bold text-jetblack">Managed Payment</span>
      <span
        class="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider"
        :class="isSandbox ? 'text-amber-700' : 'text-emerald-700'"
      >
        <CheckCircle2 class="w-3 h-3" />
        {{ isSandbox ? "Sandbox" : "Aktif" }}
      </span>
      <span class="text-[11px] font-mono tracking-wider font-semibold text-jetblack/65">
        · {{ MANAGED_PAYMENT_SPLIT.developerSharePercent }}% Net /
        {{ MANAGED_PAYMENT_SPLIT.platformFeePercent }}% Fee
      </span>
      <span class="text-[11px] text-jetblack/60 truncate">
        · Via <span class="font-semibold text-jetblack">{{ COMPANY_INFO.legalName }}</span>
        (QRIS, VA, E-Wallet, Retail)
      </span>
    </div>
  </div>
</template>
