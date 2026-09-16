<script setup lang="ts">
import { ref, onMounted } from 'vue'
import {
  api,
  type PanelStats,
  type PanelBuilderItem,
  type PanelTransactionItem
} from '../lib/api'
import {
  ShieldAlert,
  Building2,
  Receipt,
  Server,
  RefreshCw,
  ChevronRight,
  CheckCircle2,
  AlertTriangle
} from 'lucide-vue-next'
import PlatformKpiCards from '../components/admin/PlatformKpiCards.vue'
import BatchPayoutBanner from '../components/admin/BatchPayoutBanner.vue'
import BuilderDirectoryTable from '../components/admin/BuilderDirectoryTable.vue'
import GlobalLedgerTable from '../components/admin/GlobalLedgerTable.vue'
import SystemTelemetryCard from '../components/admin/SystemTelemetryCard.vue'

const stats = ref<PanelStats | null>(null)
const builders = ref<PanelBuilderItem[]>([])
const transactions = ref<PanelTransactionItem[]>([])
const loading = ref(true)
const refreshing = ref(false)
const activeTab = ref<'builders' | 'ledger' | 'system'>('builders')

// Search & Filters
const txStatusFilter = ref<string>('')
const txSearchQuery = ref<string>('')

// Batch Payout state
const isProcessingPayout = ref(false)
const payoutResult = ref<any>(null)
const alertMessage = ref<{ type: 'success' | 'error'; text: string } | null>(null)

function showAlert(type: 'success' | 'error', text: string) {
  alertMessage.value = { type, text }
  setTimeout(() => {
    if (alertMessage.value?.text === text) {
      alertMessage.value = null
    }
  }, 4500)
}

async function loadAllData() {
  refreshing.value = true
  try {
    const [statsRes, buildersRes, txRes] = await Promise.all([
      api.getPanelStats(),
      api.getPanelBuilders(),
      api.getPanelTransactions(100, txStatusFilter.value || undefined)
    ])

    if (statsRes.success) {
      stats.value = statsRes.data
    }
    if (buildersRes.success) {
      builders.value = buildersRes.builders
    }
    if (txRes.success) {
      transactions.value = txRes.transactions
    }
  } catch (err: any) {
    showAlert('error', err.message || 'Gagal memuat data Super Admin Panel.')
  } finally {
    loading.value = false
    refreshing.value = false
  }
}

async function handleTriggerBatchPayout() {
  if (!confirm(`Konfirmasi eksekusi batch payout untuk ${stats.value?.pendingDisbursementsCount || 0} transaksi tertunda senilai Rp ${(stats.value?.pendingDisbursementsAmount || 0).toLocaleString('id-ID')}?`)) {
    return
  }

  isProcessingPayout.value = true
  payoutResult.value = null

  try {
    const res = await api.triggerBatchPayout()
    if (res.success) {
      payoutResult.value = res
      showAlert('success', res.message || 'Batch payout berhasil dieksekusi!')
      await loadAllData()
    } else {
      showAlert('error', res.error || 'Gagal memproses batch payout.')
    }
  } catch (err: any) {
    showAlert('error', err.message || 'Terjadi kesalahan sistem saat mengeksekusi batch payout.')
  } finally {
    isProcessingPayout.value = false
  }
}

function formatUptime(seconds: number) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  return `${h}j ${m}m ${s}d`
}

onMounted(() => {
  loadAllData()
})
</script>

<template>
  <div class="min-h-screen bg-[#F8F9FA] text-[#111111] flex flex-col font-sans">
    <!-- Top Admin Header -->
    <header class="border-b border-[#111111]/10 bg-[#111111] text-white sticky top-0 z-30 shadow-md">
      <div class="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <router-link to="/" class="flex items-center gap-2 group">
            <div class="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center font-bold text-white relative shadow-inner group-hover:scale-105 transition">
              <span class="text-sm font-black tracking-tighter">T</span>
              <span class="absolute bottom-1 right-1 w-1.5 h-1.5 rounded-full bg-[#D4AF37]"></span>
            </div>
            <div class="font-mono font-extrabold text-sm text-white">
              tertaut<span class="text-[#D4AF37]">.com</span>
            </div>
          </router-link>
          <div class="h-4 w-px bg-white/20"></div>
          <div class="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#D4AF37]/20 text-[#D4AF37] text-xs font-bold border border-[#D4AF37]/40">
            <ShieldAlert class="w-3.5 h-3.5" />
            <span>Super Admin Panel</span>
          </div>
        </div>

        <!-- Telemetry Status & Switchers -->
        <div class="flex items-center gap-3 text-xs">
          <div v-if="stats" class="hidden lg:flex items-center gap-2 text-white/60 font-mono text-[11px] bg-white/5 px-2.5 py-1 rounded-lg border border-white/10">
            <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Bun {{ stats.system.bunVersion }}</span>
            <span>•</span>
            <span>RSS {{ stats.system.memoryUsageMB.rss }}MB</span>
            <span>•</span>
            <span>Uptime {{ formatUptime(stats.system.uptimeSeconds) }}</span>
          </div>

          <button
            @click="loadAllData"
            :disabled="refreshing"
            class="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white font-medium transition flex items-center gap-1.5 text-xs disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw class="w-3.5 h-3.5" :class="{ 'animate-spin': refreshing }" />
            <span class="hidden sm:inline">Refresh</span>
          </button>

          <router-link
            to="/dashboard"
            class="px-3 py-1 rounded-lg bg-white text-[#111111] hover:bg-white/90 font-bold transition flex items-center gap-1"
          >
            <span>Builder Dashboard</span>
            <ChevronRight class="w-3.5 h-3.5" />
          </router-link>
        </div>
      </div>
    </header>

    <!-- Main Workspace Container -->
    <main class="flex-1 max-w-7xl mx-auto w-full px-4 py-6 space-y-6">
      <!-- Toast Alert -->
      <div
        v-if="alertMessage"
        :class="[
          'p-3.5 rounded-xl text-xs font-semibold flex items-center justify-between shadow-sm transition-all',
          alertMessage.type === 'success'
            ? 'bg-[#0F4C3A] text-white'
            : 'bg-[#B91C1C] text-white'
        ]"
      >
        <div class="flex items-center gap-2">
          <CheckCircle2 v-if="alertMessage.type === 'success'" class="w-4 h-4 text-emerald-300" />
          <AlertTriangle v-else class="w-4 h-4 text-rose-300" />
          <span>{{ alertMessage.text }}</span>
        </div>
        <button @click="alertMessage = null" class="opacity-75 hover:opacity-100 p-1 cursor-pointer">✕</button>
      </div>

      <!-- Macro Platform KPI Cards Component -->
      <PlatformKpiCards :stats="stats" />

      <!-- Quick Action Banner for Batch Payout Component -->
      <BatchPayoutBanner
        :stats="stats"
        :is-processing-payout="isProcessingPayout"
        :payout-result="payoutResult"
        @trigger-payout="handleTriggerBatchPayout"
      />

      <!-- Panel Navigation Tabs -->
      <div class="flex items-center gap-2 border-b border-[#111111]/10 pb-2">
        <button
          @click="activeTab = 'builders'"
          :class="[
            'flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer',
            activeTab === 'builders'
              ? 'bg-[#111111] text-white shadow-xs'
              : 'text-[#111111]/60 hover:text-[#111111] hover:bg-[#111111]/5'
          ]"
        >
          <Building2 class="w-3.5 h-3.5" :class="activeTab === 'builders' ? 'text-[#D4AF37]' : ''" />
          <span>Direktori Builder</span>
          <span class="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20 text-white" v-if="activeTab === 'builders'">
            {{ builders.length }}
          </span>
        </button>

        <button
          @click="activeTab = 'ledger'"
          :class="[
            'flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer',
            activeTab === 'ledger'
              ? 'bg-[#111111] text-white shadow-xs'
              : 'text-[#111111]/60 hover:text-[#111111] hover:bg-[#111111]/5'
          ]"
        >
          <Receipt class="w-3.5 h-3.5" :class="activeTab === 'ledger' ? 'text-[#D4AF37]' : ''" />
          <span>Ledger Transaksi Global</span>
        </button>

        <button
          @click="activeTab = 'system'"
          :class="[
            'flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer',
            activeTab === 'system'
              ? 'bg-[#111111] text-white shadow-xs'
              : 'text-[#111111]/60 hover:text-[#111111] hover:bg-[#111111]/5'
          ]"
        >
          <Server class="w-3.5 h-3.5" :class="activeTab === 'system' ? 'text-[#D4AF37]' : ''" />
          <span>System Health &amp; Telemetri</span>
        </button>
      </div>

      <!-- TAB 1: BUILDERS DIRECTORY COMPONENT -->
      <BuilderDirectoryTable
        v-if="activeTab === 'builders'"
        :builders="builders"
      />

      <!-- TAB 2: GLOBAL TRANSACTION AUDIT LEDGER COMPONENT -->
      <GlobalLedgerTable
        v-if="activeTab === 'ledger'"
        :transactions="transactions"
        v-model:status-filter="txStatusFilter"
        v-model:search-query="txSearchQuery"
        @filter-change="loadAllData"
      />

      <!-- TAB 3: SYSTEM HEALTH & TELEMETRY COMPONENT -->
      <SystemTelemetryCard
        v-if="activeTab === 'system'"
        :stats="stats"
      />
    </main>
  </div>
</template>
