<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { api } from '../lib/api'
import type { DashboardStats } from '../types/app'
import type { TransactionItem } from '../types/transaction'
import type { LicenseItem } from '../types/licensing'
import { dashboardEnv, envPath } from '../lib/environment'
import { Plus, RefreshCw } from 'lucide-vue-next'
import OverviewKpiCards from '../components/overview/OverviewKpiCards.vue'
import OverviewAnalyticsChart from '../components/overview/OverviewAnalyticsChart.vue'

const stats = ref<DashboardStats | null>(null)
const allTransactions = ref<TransactionItem[]>([])
const allLicenses = ref<LicenseItem[]>([])
const loading = ref(true)

async function loadData() {
  loading.value = true
  try {
    const [statsRes, txsRes, licsRes] = await Promise.all([
      api.getStats(),
      api.getTransactions(),
      api.getLicenses()
    ])
    stats.value = statsRes
    allTransactions.value = txsRes.transactions || []
    allLicenses.value = licsRes.licenses || []
  } catch (err) {
    console.error('Failed to load dashboard overview data:', err)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadData()
})

// Muat ulang saat environment Live/Sandbox berganti
watch(dashboardEnv, () => {
  loadData()
})
</script>

<template>
  <div class="space-y-5 animate-fadeIn pb-12">
    <!-- Unified Header & Toolbar (Edge-to-Edge Full Width & Standardized Height) -->
    <div class="-mx-3.5 sm:-mx-4 md:-mx-6 px-3.5 sm:px-4 md:px-6 min-h-[44px] py-1.5 sm:py-0 bg-[#111111] text-white border-b border-[#111111] flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-xs mb-3">
      <div class="flex items-center gap-2">
        <h1 class="text-xs font-bold uppercase tracking-wider text-white">Ringkasan Bisnis</h1>
        <span
          class="px-2 py-0.5 rounded-md font-bold text-[10px]"
          :class="dashboardEnv === 'sandbox' ? 'bg-[#D4AF37] text-[#111111]' : 'bg-[#0F4C3A] text-white'"
        >
          {{ dashboardEnv === 'sandbox' ? 'Sandbox Mode' : 'Live Mode' }}
        </span>
      </div>

      <div class="flex items-center gap-2">
        <button
          @click="loadData"
          :disabled="loading"
          class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-bold transition cursor-pointer disabled:opacity-50"
          title="Segarkan Data"
        >
          <RefreshCw class="w-3 h-3" :class="{ 'animate-spin': loading }" />
          <span class="hidden sm:inline">Segarkan</span>
        </button>

        <router-link
          :to="envPath(dashboardEnv, '/apps')"
          class="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg btn-gold text-xs font-bold transition shadow-2xs active:scale-95 cursor-pointer shrink-0"
        >
          <Plus class="w-3.5 h-3.5 stroke-[3]" />
          <span>Tambah Software</span>
        </router-link>
      </div>
    </div>

    <!-- Overview Stats KPI -->
    <OverviewKpiCards :stats="stats" />

    <!-- Analitik & Performa Penjualan -->
    <OverviewAnalyticsChart
      :transactions="allTransactions"
      :licenses="allLicenses"
    />
  </div>
</template>