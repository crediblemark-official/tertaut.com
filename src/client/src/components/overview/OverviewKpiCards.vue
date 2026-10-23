<script setup lang="ts">
import { DollarSign, TrendingUp, KeyRound, Zap } from "lucide-vue-next";
import type { DashboardStats } from "../../types/app";
import { formatRupiah } from "../../lib/utils";
import StatsBar from "../common/StatsBar.vue";
import StatItem from "../common/StatItem.vue";

withDefaults(
  defineProps<{
    stats: DashboardStats | null;
    loading?: boolean;
  }>(),
  {
    loading: false,
  }
);
</script>

<template>
  <StatsBar wrapper-class="mb-1">
    <StatItem
      label="Gross Volume (MoR)"
      :value="formatRupiah(stats?.totalGMV || 0)"
      sublabel="Total omzet bruto terverifikasi"
      :icon="DollarSign"
      :loading="loading"
    />

    <StatItem
      label="Net Builder Payout (95%)"
      :value="formatRupiah(stats?.netEarnings || 0)"
      sublabel="Hak bersih siap cair ke rekening"
      :icon="TrendingUp"
      variant="forest"
      bordered
      :loading="loading"
    />

    <StatItem
      label="Lisensi Aktif Terbit"
      :value="stats?.activeLicenses || 0"
      sublabel="Hardware-bound & multi-seat"
      :icon="KeyRound"
      icon-color="text-gold"
      bordered
      :loading="loading"
    />

    <StatItem
      label="Total Transaksi"
      :value="stats?.totalTransactions || 0"
      sublabel="Pembayaran QRIS & Virtual Account"
      :icon="Zap"
      icon-color="text-gold"
      bordered
      :loading="loading"
    />
  </StatsBar>
</template>
