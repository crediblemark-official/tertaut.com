<script setup lang="ts">
import { DollarSign, TrendingUp, KeyRound, Zap } from 'lucide-vue-next'
import type { DashboardStats } from '../../types/app'
import { formatRupiah } from '../../lib/utils'

defineProps<{
  stats: DashboardStats | null
}>()
</script>

<template>
  <!-- Overview Stats KPI (Horizontal Scroll on Mobile, Grid on Tablet/Desktop) -->
  <div class="w-full flex overflow-x-auto sm:grid sm:grid-cols-2 lg:grid-cols-4 divide-x divide-jetblack/10 border-b border-jetblack/10 pb-4 pt-1 top-scrollbar">
    <div class="min-w-[220px] sm:min-w-0 flex-1 shrink-0 py-2 pr-4 pl-0 space-y-1">
      <div class="flex items-center justify-between text-jetblack/50 text-xs font-semibold">
        <span>Gross Volume (MoR)</span>
        <DollarSign class="w-4 h-4 text-jetblack" />
      </div>
      <div class="text-2xl font-black text-jetblack font-mono">
        {{ formatRupiah(stats?.totalGMV || 0) }}
      </div>
      <div class="text-[11px] text-jetblack/50">
        Total omzet bruto terverifikasi
      </div>
    </div>

    <div class="min-w-[220px] sm:min-w-0 flex-1 shrink-0 py-2 px-4 space-y-1">
      <div class="flex items-center justify-between text-jetblack/50 text-xs font-semibold">
        <span>Net Builder Payout (95%)</span>
        <TrendingUp class="w-4 h-4 text-forest" />
      </div>
      <div class="text-2xl font-black text-forest font-mono">
        {{ formatRupiah(stats?.netEarnings || 0) }}
      </div>
      <div class="text-[11px] text-forest font-medium flex items-center gap-1">
        <span>Hak bersih siap cair ke rekening</span>
      </div>
    </div>

    <div class="min-w-[220px] sm:min-w-0 flex-1 shrink-0 py-2 px-4 space-y-1">
      <div class="flex items-center justify-between text-jetblack/50 text-xs font-semibold">
        <span>Lisensi Aktif Terbit</span>
        <KeyRound class="w-4 h-4 text-gold" />
      </div>
      <div class="text-2xl font-black text-jetblack font-mono">
        {{ stats?.activeLicenses || 0 }}
      </div>
      <div class="text-[11px] text-jetblack/50">
        Hardware-bound &amp; multi-seat
      </div>
    </div>

    <div class="min-w-[220px] sm:min-w-0 flex-1 shrink-0 py-2 px-4 sm:pl-4 sm:pr-0 space-y-1">
      <div class="flex items-center justify-between text-jetblack/50 text-xs font-semibold">
        <span>Total Transaksi</span>
        <Zap class="w-4 h-4 text-gold" />
      </div>
      <div class="text-2xl font-black text-jetblack font-mono">
        {{ stats?.totalTransactions || 0 }}
      </div>
      <div class="text-[11px] text-jetblack/50">
        Pembayaran QRIS &amp; Virtual Account
      </div>
    </div>
  </div>
</template>
