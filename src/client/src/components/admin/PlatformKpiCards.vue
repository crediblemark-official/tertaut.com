<script setup lang="ts">
import { TrendingUp, DollarSign, Users, Send } from "lucide-vue-next";
import type { PanelStats } from "../../types/panel";

defineProps<{
  stats: PanelStats | null;
}>();
</script>

<template>
  <section
    class="w-full flex overflow-x-auto sm:grid sm:grid-cols-2 lg:grid-cols-4 divide-x divide-jetblack/10 border-b border-jetblack/10 pb-4 pt-1 top-scrollbar"
  >
    <!-- 1. Total Platform GMV -->
    <div class="min-w-[220px] sm:min-w-0 flex-1 shrink-0 py-2 pr-4 pl-0 space-y-1">
      <div class="flex items-center justify-between text-jetblack/50 text-xs font-semibold">
        <span>Total Platform GMV</span>
        <TrendingUp class="w-4 h-4 text-jetblack" />
      </div>
      <div class="text-2xl font-black text-jetblack font-mono">
        Rp {{ (stats?.totalGMV || 0).toLocaleString("id-ID") }}
      </div>
      <div class="text-[11px] text-jetblack/50">
        {{ stats?.paidTransactions || 0 }} transaksi berhasil
      </div>
    </div>

    <!-- 2. Platform MoR Fee (5%) -->
    <div class="min-w-[220px] sm:min-w-0 flex-1 shrink-0 py-2 px-4 space-y-1">
      <div class="flex items-center justify-between text-jetblack/50 text-xs font-semibold">
        <span>MoR Fee Pendapatan (5%)</span>
        <DollarSign class="w-4 h-4 text-gold" />
      </div>
      <div class="text-2xl font-black text-jetblack font-mono">
        Rp {{ (stats?.platformFeeRevenue || 0).toLocaleString("id-ID") }}
      </div>
      <div class="text-[11px] text-jetblack/50">Pendapatan kotor platform</div>
    </div>

    <!-- 3. Net Builder Share (95%) -->
    <div class="min-w-[220px] sm:min-w-0 flex-1 shrink-0 py-2 px-4 space-y-1">
      <div class="flex items-center justify-between text-jetblack/50 text-xs font-semibold">
        <span>Porsi Bersih Builder (95%)</span>
        <Users class="w-4 h-4 text-forest" />
      </div>
      <div class="text-2xl font-black text-forest font-mono">
        Rp {{ (stats?.netBuilderShare || 0).toLocaleString("id-ID") }}
      </div>
      <div class="text-[11px] text-forest font-medium">
        {{ stats?.totalBuilders || 0 }} builders terdaftar
      </div>
    </div>

    <!-- 4. Pending Disbursements -->
    <div class="min-w-[220px] sm:min-w-0 flex-1 shrink-0 py-2 px-4 sm:pl-4 sm:pr-0 space-y-1">
      <div class="flex items-center justify-between text-jetblack/50 text-xs font-semibold">
        <span>Pending Payout</span>
        <Send class="w-4 h-4 text-gold" />
      </div>
      <div class="text-2xl font-black text-jetblack font-mono">
        Rp {{ (stats?.pendingDisbursementsAmount || 0).toLocaleString("id-ID") }}
      </div>
      <div class="text-[11px] text-jetblack/50">
        {{ stats?.pendingDisbursementsCount || 0 }} transaksi siap dicairkan
      </div>
    </div>
  </section>
</template>
