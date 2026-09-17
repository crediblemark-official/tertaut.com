<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  api,
  type PanelStats,
  type PanelBuilderItem,
  type PanelTransactionItem
} from '../lib/api'
import { authClient } from '../lib/auth'
import {
  ShieldAlert,
  Building2,
  Receipt,
  Server,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  LayoutDashboard,
  LogOut,
  ChevronRight,
  Globe,
  Code2,
  TrendingUp,
  ExternalLink
} from 'lucide-vue-next'
import PlatformKpiCards from '../components/admin/PlatformKpiCards.vue'
import BatchPayoutBanner from '../components/admin/BatchPayoutBanner.vue'
import BuilderDirectoryTable from '../components/admin/BuilderDirectoryTable.vue'
import GlobalLedgerTable from '../components/admin/GlobalLedgerTable.vue'
import SystemTelemetryCard from '../components/admin/SystemTelemetryCard.vue'

const router = useRouter()
const session = authClient.useSession()
const adminName = computed(() => session.value?.data?.user?.name || 'Super Admin')
const adminEmail = computed(() => session.value?.data?.user?.email || 'admin@tertaut.com')
const adminInitial = computed(() => (adminName.value[0] || 'S').toUpperCase())

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
    <!-- Dedicated Super Admin Sidebar (w-56) -->
    <aside class="hidden md:flex w-56 flex-col justify-between p-4 border-r border-[#111111]/10 bg-[#FFFFFF] sticky top-0 h-screen shrink-0 z-30">
      <div class="space-y-5">
        <!-- Brand Header with Super Admin Tag -->
        <router-link to="/panel" class="flex items-center gap-2.5 px-2 py-1 group">
          <div class="w-8 h-8 rounded-lg bg-[#111111] flex items-center justify-center font-bold text-white shadow-md relative overflow-hidden group-hover:scale-105 transition">
            <span class="text-sm font-black tracking-tighter">T</span>
            <span class="absolute bottom-1 right-1 w-1.5 h-1.5 rounded-full bg-[#D4AF37] shadow-[0_0_6px_#D4AF37]"></span>
          </div>
          <div>
            <div class="font-extrabold text-sm tracking-tight text-[#111111] flex items-center gap-0.5 font-mono">
              tertaut<span class="text-[#D4AF37]">.com</span>
            </div>
            <div class="text-[10px] text-[#111111]/50 font-medium flex items-center gap-1">
              <ShieldAlert class="w-3 h-3 text-[#D4AF37]" />
              <span>Admin Console</span>
            </div>
          </div>
        </router-link>

        <!-- Access Scope Pill -->
        <div class="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-[#111111]/5 border border-[#111111]/10 text-xs">
          <span class="text-[10px] font-bold uppercase tracking-wider text-[#111111]/60">Hak Akses</span>
          <span class="px-2 py-0.5 rounded-md bg-[#D4AF37]/20 text-[#8a6d1f] text-[10px] font-bold border border-[#D4AF37]/30">
            Super Admin
          </span>
        </div>

        <!-- Dedicated Navigation Menu -->
        <nav class="space-y-1">
          <button
            v-for="item in adminNavItems"
            :key="item.key"
            @click="activeTab = item.key as any"
            type="button"
            :class="[
              'w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer',
              activeTab === item.key
                ? 'bg-[#111111] text-white shadow-sm'
                : 'text-[#111111]/75 hover:text-[#111111] hover:bg-[#111111]/5'
            ]"
          >
            <div class="flex items-center gap-2.5">
              <component
                :is="item.icon"
                class="w-4 h-4 shrink-0"
                :class="activeTab === item.key ? 'text-[#D4AF37]' : 'text-[#111111]/50'"
              />
              <span>{{ item.name }}</span>
            </div>
            <div class="flex items-center gap-1.5">
              <span
                v-if="item.badge !== undefined"
                :class="[
                  'px-1.5 py-0.2 rounded-full text-[10px] font-bold',
                  activeTab === item.key ? 'bg-white/20 text-white' : 'bg-[#111111]/5 text-[#111111]/60'
                ]"
              >
                {{ item.badge }}
              </span>
              <span
                v-if="activeTab === item.key"
                class="w-1.5 h-1.5 rounded-full bg-[#D4AF37] shadow-[0_0_8px_#D4AF37]"
              ></span>
            </div>
          </button>
        </nav>
      </div>

      <!-- Bottom Sidebar Section -->
      <div class="space-y-2 pt-3 border-t border-[#111111]/10">
        <!-- Switch to Builder Dashboard -->
        <router-link
          to="/dashboard"
          class="flex items-center justify-between px-3 py-1.5 rounded-lg bg-[#111111]/5 hover:bg-[#111111]/10 text-xs font-semibold text-[#111111] transition border border-[#111111]/10"
        >
          <div class="flex items-center gap-2">
            <LayoutDashboard class="w-3.5 h-3.5 text-[#D4AF37]" />
            <span>Builder Dashboard</span>
          </div>
          <ChevronRight class="w-3 h-3 text-[#111111]/40" />
        </router-link>

        <router-link
          to="/"
          target="_blank"
          class="flex items-center justify-between px-3 py-1.5 rounded-lg hover:bg-[#111111]/5 text-xs font-medium text-[#111111]/70 transition"
        >
          <div class="flex items-center gap-2">
            <Globe class="w-3.5 h-3.5" />
            <span>Beranda Publik</span>
          </div>
          <ExternalLink class="w-3 h-3 text-[#111111]/40" />
        </router-link>

        <!-- Engine Rail Info -->
        <div class="p-2.5 rounded-lg bg-[#111111] text-white space-y-1 text-[11px] shadow-sm">
          <div class="flex items-center justify-between">
            <span class="text-[10px] font-bold uppercase tracking-wider text-[#D4AF37]">Admin Rail</span>
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 ring-2 ring-emerald-400/40 animate-pulse"></span>
          </div>
          <div class="text-[10px] text-white/75 font-mono">Bun + PostgreSQL Live</div>
        </div>

        <!-- Super Admin Profile & Logout -->
        <div class="pt-2 border-t border-[#111111]/10 space-y-1.5">
          <div class="p-2 rounded-lg bg-[#111111]/5 space-y-2">
            <div class="flex items-center gap-2 min-w-0">
              <div class="w-7 h-7 rounded-full bg-[#111111] text-white flex items-center justify-center font-bold text-xs shrink-0 ring-1 ring-[#D4AF37]/40">
                {{ adminInitial }}
              </div>
              <div class="min-w-0 text-left flex-1">
                <div class="text-xs font-bold text-[#111111] truncate">{{ adminName }}</div>
                <div class="text-[10px] text-[#111111]/50 font-medium truncate">{{ adminEmail }}</div>
              </div>
            </div>
            <button
              type="button"
              class="flex items-center justify-center gap-1.5 w-full py-1.5 px-2 rounded-md bg-white border border-[#111111]/10 hover:border-red-500/30 hover:bg-red-50 hover:text-red-600 text-xs font-semibold text-[#111111]/70 transition shadow-xs cursor-pointer"
              title="Keluar dari sesi admin"
              @click="handleLogout"
            >
              <LogOut class="w-3.5 h-3.5" />
              <span>Keluar (Log Out)</span>
            </button>
          </div>
        </div>
      </div>
    </aside>

    <!-- Main Content Area with Desktop Top Bar -->
    <div class="flex-1 flex flex-col min-w-0">
      <!-- Admin Desktop Top Header -->
      <header class="hidden md:flex items-center justify-between px-6 min-h-[44px] py-1.5 sm:py-0 border-b border-[#111111] bg-[#111111] text-white shrink-0 z-20">
        <!-- Left: Breadcrumb / Category / Title -->
        <div class="flex items-center gap-3">
          <div class="flex items-center gap-1.5 text-xs text-white/50 font-medium">
            <span class="hover:text-white transition cursor-default">Super Admin</span>
            <ChevronRight class="w-3 h-3 text-white/30" />
            <span class="text-[#D4AF37] font-semibold">{{ currentNavItem.category }}</span>
            <ChevronRight class="w-3 h-3 text-white/30" />
          </div>
          <h2 class="text-sm font-bold text-white tracking-tight flex items-center gap-2">
            <span>{{ currentNavItem.name }}</span>
            <span class="px-2 py-0.5 rounded-full bg-white/10 text-white text-[10px] font-mono font-normal">v2.2</span>
          </h2>
        </div>

        <!-- Right: Status, Refresh & External Links -->
        <div class="flex items-center gap-3">
          <!-- Mode Pill -->
          <div class="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[11px] font-semibold bg-[#0F4C3A]/30 border-[#0F4C3A]/50 text-emerald-300">
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Super Admin Rail</span>
          </div>

          <!-- Refresh Button -->
          <button
            @click="loadAllData"
            :disabled="refreshing"
            class="h-8 px-3 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold transition flex items-center gap-1.5 text-xs disabled:opacity-50 cursor-pointer shadow-xs"
          >
            <RefreshCw class="w-3.5 h-3.5" :class="{ 'animate-spin': refreshing }" />
            <span>Segarkan</span>
          </button>

          <div class="flex items-center gap-1 border-l border-white/15 pl-2">
            <router-link
              to="/"
              target="_blank"
              class="p-1.5 rounded-md hover:bg-white/10 text-white/60 hover:text-white transition"
              title="Kunjungi Beranda Publik"
            >
              <Globe class="w-4 h-4" />
            </router-link>
            <a
              href="/swagger"
              target="_blank"
              class="p-1.5 rounded-md hover:bg-white/10 text-white/60 hover:text-white transition"
              title="Buka Swagger API Docs"
            >
              <Code2 class="w-4 h-4" />
            </a>
          </div>
        </div>
      </header>

      <!-- Mobile Top Compact Bar (Two-Tier Contextual Bar) -->
      <header class="md:hidden bg-[#111111] text-white border-b border-[#111111] sticky top-0 z-40 shadow-xs min-h-[44px]">
        <div class="flex items-center justify-between px-3.5 py-1.5">
          <router-link to="/panel" class="flex items-center gap-2">
            <div class="w-7 h-7 rounded-md bg-white/10 flex items-center justify-center font-bold text-white text-xs relative shadow-xs">
              T
              <span class="absolute bottom-0.5 right-0.5 w-1 h-1 rounded-full bg-[#D4AF37]"></span>
            </div>
            <span class="font-extrabold text-xs tracking-tight text-white font-mono">
              tertaut<span class="text-[#D4AF37]">.admin</span>
            </span>
          </router-link>

          <div class="flex items-center gap-2">
            <router-link
              to="/dashboard"
              class="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[10.5px] font-bold text-white flex items-center gap-1 transition"
            >
              <LayoutDashboard class="w-3.5 h-3.5 text-[#D4AF37]" />
              <span>Builder</span>
            </router-link>

            <button
              @click="loadAllData"
              :disabled="refreshing"
              class="p-1.5 min-w-[32px] min-h-[32px] rounded-lg bg-white/10 text-white text-xs flex items-center justify-center cursor-pointer transition active:scale-95"
              title="Segarkan data admin"
            >
              <RefreshCw class="w-3.5 h-3.5" :class="{ 'animate-spin': refreshing }" />
            </button>
          </div>
        </div>

        <!-- Context Sub-bar -->
        <div class="px-3.5 py-1.5 bg-[#111111]/[0.02] border-t border-[#111111]/5 flex items-center justify-between text-[11px]">
          <div class="flex items-center gap-1.5 font-medium text-[#111111]/60 truncate">
            <span class="text-[#D4AF37] font-bold">{{ currentNavItem.category }}</span>
            <span>•</span>
            <span class="text-[#111111] font-semibold truncate">{{ currentNavItem.name }}</span>
          </div>
          <span class="text-[9.5px] font-mono text-[#111111]/40 shrink-0">Super Admin</span>
        </div>
      </header>

      <!-- Main Workspace Container (Full Width & Aligned, Thumb Friendly Padding) -->
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
            <div class="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-[#111111]/10 border-b border-[#111111]/10 pb-6 pt-2">
              <!-- Left Column: Builder Highlights -->
              <div class="lg:pr-6 space-y-3 pb-6 lg:pb-0">
                <div class="flex items-center justify-between">
                  <h2 class="text-xs font-bold text-[#111111] uppercase tracking-wide">Builder Terdaftar Terbaru</h2>
                  <button @click="activeTab = 'builders'" class="text-[11px] font-bold text-[#D4AF37] hover:underline cursor-pointer">
                    Buka Direktori ({{ builders.length }}) →
                  </button>
                </div>
                <div class="space-y-2 divide-y divide-[#111111]/10">
                  <div v-for="b in builders.slice(0, 5)" :key="b.id" class="flex items-center justify-between pt-2 text-xs">
                    <div>
                      <div class="font-bold text-[#111111]">{{ b.name || 'Builder' }}</div>
                      <div class="text-[10px] text-[#111111]/50 font-mono">{{ b.email }}</div>
                    </div>
                    <div class="text-right">
                      <div class="font-mono font-bold text-[#0F4C3A]">Rp {{ (b.totalGMV || 0).toLocaleString('id-ID') }}</div>
                      <div class="text-[10px] text-[#111111]/50">{{ b.appCount || 0 }} Aplikasi</div>
                    </div>
                  </div>
                  <div v-if="builders.length === 0" class="pt-3 text-xs text-[#111111]/40 italic">
                    Belum ada builder yang terdaftar.
                  </div>
                </div>
              </div>

              <!-- Right Column: Recent Transactions -->
              <div class="lg:pl-6 space-y-3 pt-6 lg:pt-0">
                <div class="flex items-center justify-between">
                  <h2 class="text-xs font-bold text-[#111111] uppercase tracking-wide">Transaksi Global Terkini</h2>
                  <button @click="activeTab = 'ledger'" class="text-[11px] font-bold text-[#D4AF37] hover:underline cursor-pointer">
                    Buka Ledger ({{ transactions.length }}) →
                  </button>
                </div>
                <div class="space-y-2 divide-y divide-[#111111]/10">
                  <div v-for="t in transactions.slice(0, 5)" :key="t.id" class="flex items-center justify-between pt-2 text-xs">
                    <div>
                      <div class="font-mono font-bold text-[#111111] truncate max-w-[200px]">{{ t.customerEmail }}</div>
                      <div class="text-[10px] text-[#111111]/50 font-mono">{{ t.id }}</div>
                    </div>
                    <div class="text-right">
                      <div class="font-mono font-bold text-[#111111]">Rp {{ t.grossAmount.toLocaleString('id-ID') }}</div>
                      <span :class="t.paymentStatus === 'PAID' ? 'text-emerald-700' : 'text-amber-700'" class="text-[10px] font-bold font-mono">
                        {{ t.paymentStatus }}
                      </span>
                    </div>
                  </div>
                  <div v-if="transactions.length === 0" class="pt-3 text-xs text-[#111111]/40 italic">
                    Belum ada riwayat transaksi.
                  </div>
                </div>
              </div>
            </div>
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

    <!-- Mobile Bottom Navigation Bar for Admin (Safe-Area & Thumb Reachable) -->
    <nav class="md:hidden fixed bottom-0 left-0 right-0 h-16 pb-[env(safe-area-inset-bottom,0px)] bg-[#FFFFFF]/95 backdrop-blur-md border-t border-[#111111]/10 flex items-center justify-around px-2 z-50 shadow-[0_-4px_20px_rgba(17,17,17,0.08)]">
      <button
        v-for="item in adminNavItems"
        :key="item.key"
        @click="activeTab = item.key as any"
        type="button"
        :class="[
          'flex flex-col items-center justify-center flex-1 h-14 py-1 text-[10px] font-semibold transition-all relative cursor-pointer active:scale-95',
          activeTab === item.key ? 'text-[#111111] font-bold' : 'text-[#111111]/50 hover:text-[#111111]'
        ]"
      >
        <component
          :is="item.icon"
          class="w-4 h-4 mb-1 transition-transform"
          :class="activeTab === item.key ? 'text-[#D4AF37] scale-110' : 'text-[#111111]/40'"
        />
        <!-- Badge counter if exists -->
        <span
          v-if="item.badge !== undefined && item.badge > 0"
          class="absolute top-1 right-[calc(50%-14px)] min-w-[15px] px-1 py-px rounded-full bg-[#D4AF37] text-[#111111] text-[8px] font-black leading-tight text-center shadow-xs"
        >
          {{ item.badge }}
        </span>
        <span class="truncate max-w-[65px] text-[9.5px] leading-tight">{{ item.name.replace('Platform', '').replace('Builder', '').trim() }}</span>
        <span v-if="activeTab === item.key" class="absolute top-0.5 w-6 h-0.5 bg-[#D4AF37] rounded-full shadow-[0_0_4px_#D4AF37]"></span>
      </button>
    </nav>
  </div>
</template>
