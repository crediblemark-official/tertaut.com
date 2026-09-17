<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '../lib/api'
import type {
  PanelStats,
  PanelBuilderItem,
  PanelTransactionItem
} from '../types/panel'
import { authClient } from '../lib/auth'
import {
  ShieldAlert,
  Building2,
  Receipt,
  Server,
  TrendingUp,
  CheckCircle2,
  AlertTriangle
} from 'lucide-vue-next'
import AdminSidebar from '../components/admin/AdminSidebar.vue'
import AdminTopHeader from '../components/admin/AdminTopHeader.vue'
import AdminMobileNav from '../components/admin/AdminMobileNav.vue'
import PlatformKpiCards from '../components/admin/PlatformKpiCards.vue'
import BatchPayoutBanner from '../components/admin/BatchPayoutBanner.vue'
import OverviewPreviews from '../components/admin/OverviewPreviews.vue'
import BuilderDirectoryTable from '../components/admin/BuilderDirectoryTable.vue'
import GlobalLedgerTable from '../components/admin/GlobalLedgerTable.vue'
import SystemTelemetryCard from '../components/admin/SystemTelemetryCard.vue'

const router = useRouter()
const session = authClient.useSession()
const adminName = computed(() => session.value?.data?.user?.name || 'Administrator')
const adminEmail = computed(() => session.value?.data?.user?.email || '')
const adminInitial = computed(() => (adminName.value[0] || 'A').toUpperCase())

const stats = ref<PanelStats | null>(null)
const builders = ref<PanelBuilderItem[]>([])
const transactions = ref<PanelTransactionItem[]>([])
const loading = ref(true)
const refreshing = ref(false)
const activeTab = ref<'overview' | 'builders' | 'ledger' | 'system'>('overview')

// Search & Filters
const txStatusFilter = ref<string>('')
const txSearchQuery = ref<string>('')

// Batch Payout state
const isProcessingPayout = ref(false)
const payoutResult = ref<any>(null)
const alertMessage = ref<{ type: 'success' | 'error'; text: string } | null>(null)
let alertTimer: ReturnType<typeof setTimeout> | null = null

function showAlert(type: 'success' | 'error', text: string) {
  if (alertTimer) clearTimeout(alertTimer)
  alertMessage.value = { type, text }
  alertTimer = setTimeout(() => {
    alertMessage.value = null
    alertTimer = null
  }, 4500)
}

onUnmounted(() => {
  if (alertTimer) {
    clearTimeout(alertTimer)
    alertTimer = null
  }
})

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

async function handleLogout() {
  try {
    await authClient.signOut()
  } catch {}
  router.push('/login')
}

const adminNavItems = computed(() => [
  {
    key: 'overview',
    name: 'Ringkasan Platform',
    icon: TrendingUp,
    category: 'Overview'
  },
  {
    key: 'builders',
    name: 'Direktori Builder',
    icon: Building2,
    badge: builders.value.length,
    category: 'Direktori'
  },
  {
    key: 'ledger',
    name: 'Ledger Transaksi',
    icon: Receipt,
    badge: transactions.value.length,
    category: 'Ledger Global'
  },
  {
    key: 'system',
    name: 'System & Telemetri',
    icon: Server,
    category: 'Infrastructure'
  }
])

const currentNavItem = computed(() => {
  return adminNavItems.value.find(item => item.key === activeTab.value) || adminNavItems.value[0]
})

onMounted(() => {
  loadAllData()
})
</script>

<template>
  <div class="min-h-screen bg-white text-[#111111] flex flex-col md:flex-row font-sans pb-24 md:pb-0">
    <!-- Dedicated Super Admin Sidebar -->
    <AdminSidebar
      :active-tab="activeTab"
      :admin-nav-items="adminNavItems"
      :admin-name="adminName"
      :admin-email="adminEmail"
      :admin-initial="adminInitial"
      @update:active-tab="activeTab = $event as any"
      @logout="handleLogout"
    />

    <!-- Main Content Area with Desktop Top Bar -->
    <div class="flex-1 flex flex-col min-w-0">
      <!-- Admin Top Header (Desktop & Mobile) -->
      <AdminTopHeader
        :current-nav-item="currentNavItem"
        :refreshing="refreshing"
        @refresh="loadAllData"
      />

      <!-- Main Workspace Container -->
      <main class="flex-1 min-w-0 px-3.5 py-4 sm:px-4 sm:py-5 md:px-6 md:py-6 overflow-y-auto w-full">
        <div class="space-y-6 animate-fadeIn pb-28 md:pb-12">
          <!-- Toast Alert -->
          <div
            v-if="alertMessage"
            :class="[
              'p-3.5 rounded-lg text-xs font-semibold flex items-center justify-between shadow-xs transition-all',
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

          <!-- TAB 1: OVERVIEW / RINGKASAN PLATFORM -->
          <div v-if="activeTab === 'overview'" class="space-y-6">
            <div class="flex items-center justify-between gap-3 pb-1 border-b border-[#111111]/10">
              <div class="flex items-center gap-2.5">
                <h1 class="text-base font-extrabold text-[#111111]">Ringkasan Ekosistem Platform</h1>
                <span class="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#D4AF37]/15 text-[#8a6d1f] text-[11px] font-bold border border-[#D4AF37]/30">
                  <ShieldAlert class="w-3 h-3 text-[#D4AF37]" />
                  MoR Core
                </span>
              </div>
              <span class="text-xs text-[#111111]/50 font-mono">Xendit Rail • 5% Platform MoR Cut</span>
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

            <!-- Overview Quick Previews: 2-Column Split -->
            <OverviewPreviews
              :builders="builders"
              :transactions="transactions"
              @select-tab="activeTab = $event"
            />
          </div>

          <!-- TAB 2: BUILDERS DIRECTORY -->
          <div v-else-if="activeTab === 'builders'" class="space-y-4">
            <div class="flex items-center justify-between gap-3 pb-1 border-b border-[#111111]/10">
              <h1 class="text-base font-extrabold text-[#111111]">Direktori Builder Terdaftar</h1>
              <span class="text-xs text-[#111111]/50 font-mono">{{ builders.length }} Builder Aktif</span>
            </div>
            <BuilderDirectoryTable :builders="builders" />
          </div>

          <!-- TAB 3: GLOBAL LEDGER -->
          <div v-else-if="activeTab === 'ledger'" class="space-y-4">
            <div class="flex items-center justify-between gap-3 pb-1 border-b border-[#111111]/10">
              <h1 class="text-base font-extrabold text-[#111111]">Ledger Transaksi Global</h1>
              <span class="text-xs text-[#111111]/50 font-mono">{{ transactions.length }} Transaksi Tercatat</span>
            </div>
            <GlobalLedgerTable
              :transactions="transactions"
              v-model:status-filter="txStatusFilter"
              v-model:search-query="txSearchQuery"
              @filter-change="loadAllData"
            />
          </div>

          <!-- TAB 4: SYSTEM TELEMETRY -->
          <div v-else-if="activeTab === 'system'" class="space-y-4">
            <div class="flex items-center justify-between gap-3 pb-1 border-b border-[#111111]/10">
              <h1 class="text-base font-extrabold text-[#111111]">System Health &amp; Telemetri Engine</h1>
              <span class="text-xs text-emerald-600 font-bold flex items-center gap-1">
                <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                All Systems Operational
              </span>
            </div>
            <SystemTelemetryCard :stats="stats" />
          </div>
        </div>
      </main>
    </div>

    <!-- Mobile Bottom Navigation Bar for Admin -->
    <AdminMobileNav
      :active-tab="activeTab"
      :admin-nav-items="adminNavItems"
      @update:active-tab="activeTab = $event as any"
    />
  </div>
</template>
