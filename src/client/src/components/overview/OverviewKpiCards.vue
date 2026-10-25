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
  <StatsBar borderless>
    <StatItem
      label="Total Penjualan Kotor"
      :value="formatRupiah(stats?.totalGMV || 0)"
      sublabel="Omzet bruto dari seluruh penjualan"
      :icon="DollarSign"
      :loading="loading"
    />

    <StatItem
      label="Penghasilan Bersih (95%)"
      :value="formatRupiah(stats?.netEarnings || 0)"
      sublabel="Siap dicairkan langsung ke rekening Anda"
      :icon="TrendingUp"
      variant="forest"
      bordered
      :loading="loading"
    />

    <StatItem
      label="Lisensi Aktif"
      :value="stats?.activeLicenses || 0"
      sublabel="Digunakan aktif di perangkat pelanggan"
      :icon="KeyRound"
      icon-color="text-gold"
      bordered
      :loading="loading"
    />

    <StatItem
      label="Transaksi Berhasil"
      :value="stats?.totalTransactions || 0"
      sublabel="Pembayaran via QRIS & Virtual Account"
      :icon="Zap"
      icon-color="text-gold"
      bordered
      :loading="loading"
    />
  </StatsBar>
</template>
