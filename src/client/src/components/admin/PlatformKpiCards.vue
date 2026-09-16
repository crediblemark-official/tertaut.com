<script setup lang="ts">
import { TrendingUp, DollarSign, Users, Send } from 'lucide-vue-next'
import type { PanelStats } from '../../types'

defineProps<{
  stats: PanelStats | null
}>()
</script>

<template>
  <section class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
    <!-- 1. Total Platform GMV -->
    <div class="bg-white rounded-2xl border border-[#111111]/10 p-5 shadow-xs flex flex-col justify-between">
      <div class="flex items-center justify-between text-xs text-[#111111]/60">
        <span class="font-bold uppercase tracking-wider text-[10px]">Total Platform GMV</span>
        <div class="w-7 h-7 rounded-lg bg-[#111111]/5 flex items-center justify-center text-[#111111]">
          <TrendingUp class="w-4 h-4" />
        </div>
      </div>
      <div class="mt-2">
        <div class="text-2xl font-black text-[#111111] font-mono">
          Rp {{ (stats?.totalGMV || 0).toLocaleString('id-ID') }}
        </div>
        <div class="text-[11px] text-[#111111]/50 mt-1 flex items-center gap-1">
          <span>{{ stats?.paidTransactions || 0 }} transaksi berhasil</span>
        </div>
      </div>
    </div>

    <!-- 2. Platform MoR Fee (5%) -->
    <div class="bg-white rounded-2xl border border-[#D4AF37]/30 bg-gradient-to-br from-[#D4AF37]/5 to-transparent p-5 shadow-xs flex flex-col justify-between">
      <div class="flex items-center justify-between text-xs text-[#996515]">
        <span class="font-bold uppercase tracking-wider text-[10px]">MoR Fee Pendapatan (5%)</span>
        <div class="w-7 h-7 rounded-lg bg-[#D4AF37]/20 flex items-center justify-center text-[#996515]">
          <DollarSign class="w-4 h-4" />
        </div>
      </div>
      <div class="mt-2">
        <div class="text-2xl font-black text-[#996515] font-mono">
          Rp {{ (stats?.platformFeeRevenue || 0).toLocaleString('id-ID') }}
        </div>
        <div class="text-[11px] text-[#996515]/80 mt-1 font-medium">
          Net revenue platform tertaut.com
        </div>
      </div>
    </div>

    <!-- 3. Net Builder Share (95%) -->
    <div class="bg-white rounded-2xl border border-[#0F4C3A]/30 bg-gradient-to-br from-[#0F4C3A]/5 to-transparent p-5 shadow-xs flex flex-col justify-between">
      <div class="flex items-center justify-between text-xs text-[#0F4C3A]">
        <span class="font-bold uppercase tracking-wider text-[10px]">Porsi Bersih Builder (95%)</span>
        <div class="w-7 h-7 rounded-lg bg-[#0F4C3A]/20 flex items-center justify-center text-[#0F4C3A]">
          <Users class="w-4 h-4" />
        </div>
      </div>
      <div class="mt-2">
        <div class="text-2xl font-black text-[#0F4C3A] font-mono">
          Rp {{ (stats?.netBuilderShare || 0).toLocaleString('id-ID') }}
        </div>
        <div class="text-[11px] text-[#0F4C3A]/80 mt-1 font-medium">
          Dialokasikan untuk {{ stats?.totalBuilders || 0 }} builders
        </div>
      </div>
    </div>

    <!-- 4. Pending Disbursements & Action -->
    <div class="bg-white rounded-2xl border border-[#111111]/10 p-5 shadow-xs flex flex-col justify-between">
      <div class="flex items-center justify-between text-xs text-[#111111]/60">
        <span class="font-bold uppercase tracking-wider text-[10px]">Pending Payout Xendit</span>
        <div class="w-7 h-7 rounded-lg bg-[#111111]/5 flex items-center justify-center text-[#111111]">
          <Send class="w-4 h-4" />
        </div>
      </div>
      <div class="mt-2">
        <div class="text-xl font-black text-[#111111] font-mono">
          Rp {{ (stats?.pendingDisbursementsAmount || 0).toLocaleString('id-ID') }}
        </div>
        <div class="text-[11px] text-[#111111]/50 mt-1">
          {{ stats?.pendingDisbursementsCount || 0 }} transaksi siap dicairkan
        </div>
      </div>
    </div>
  </section>
</template>
