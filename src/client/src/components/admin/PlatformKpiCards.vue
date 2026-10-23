<script setup lang="ts">
import { TrendingUp, DollarSign, Users, Send } from "lucide-vue-next";
import type { PanelStats } from "../../types/panel";
import StatsBar from "../common/StatsBar.vue";
import StatItem from "../common/StatItem.vue";

defineProps<{
  stats: PanelStats | null;
  loading?: boolean;
}>();
</script>

<template>
  <StatsBar>
    <!-- 1. Total Platform GMV -->
    <StatItem
      label="Total Platform GMV"
      :value="`Rp ${(stats?.totalGMV || 0).toLocaleString('id-ID')}`"
      :icon="TrendingUp"
      :loading="loading || !stats"
    >
      <template #sublabel>
        <div class="flex items-center justify-between">
          <span>{{ stats?.paidTransactions || 0 }} transaksi LIVE</span>
          <span
            v-if="stats?.sandboxTransactions"
            class="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200"
            :title="`Volume simulasi sandbox: Rp ${(stats.sandboxGMV || 0).toLocaleString('id-ID')}`"
          >
            {{ stats.sandboxTransactions }} sandbox
          </span>
        </div>
      </template>
    </StatItem>

    <!-- 2. Platform MoR Fee (5%) -->
    <StatItem
      label="MoR Fee Pendapatan (5%)"
      :value="`Rp ${(stats?.platformFeeRevenue || 0).toLocaleString('id-ID')}`"
      sublabel="Pendapatan kotor platform"
      :icon="DollarSign"
      icon-color="text-gold"
      bordered
      :loading="loading || !stats"
    />

    <!-- 3. Net Builder Share (95%) -->
    <StatItem
      label="Porsi Bersih Builder (95%)"
      :value="`Rp ${(stats?.netBuilderShare || 0).toLocaleString('id-ID')}`"
      :sublabel="`${stats?.totalBuilders || 0} builders terdaftar`"
      :icon="Users"
      variant="forest"
      bordered
      :loading="loading || !stats"
    />

    <!-- 4. Pending Disbursements -->
    <StatItem
      label="Pending Payout"
      :value="`Rp ${(stats?.pendingDisbursementsAmount || 0).toLocaleString('id-ID')}`"
      :sublabel="`${stats?.pendingDisbursementsCount || 0} transaksi siap dicairkan`"
      :icon="Send"
      icon-color="text-gold"
      bordered
      :loading="loading || !stats"
    />
  </StatsBar>
</template>
