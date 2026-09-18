<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { api } from '../lib/api'
import type { AppItem } from '../types/app'
import type { LicenseItem } from '../types/licensing'
import type { TransactionItem } from '../types/transaction'
import { dashboardEnv } from '../lib/environment'
import { formatRupiah } from '../lib/utils'
import { useClipboard } from '../composables/useClipboard'
import {
  Repeat,
  Users,
  TrendingUp,
  AlertTriangle,
  Search,
  Filter,
  RefreshCw,
  Sparkles,
  ChevronRight,
  X,
  Copy,
  Check,
  Calendar,
  CreditCard,
  KeyRound,
  ShieldCheck,
  Ban,
} from 'lucide-vue-next'

export interface SubscriptionItem extends LicenseItem {
  ltv: number
  isTrial: boolean
  billingInterval: string
  appName: string
}

const env = dashboardEnv
const loading = ref(false)
const licenses = ref<LicenseItem[]>([])
const transactions = ref<TransactionItem[]>([])
const appsList = ref<AppItem[]>([])

const searchQuery = ref('')
const selectedStatus = ref<'ALL' | 'ACTIVE' | 'EXPIRED' | 'REVOKED'>('ALL')
const selectedAppId = ref<string>('ALL')

const selectedSub = ref<SubscriptionItem | null>(null)
const isDetailModalOpen = ref(false)
const isRevoking = ref(false)

const { copied, copy } = useClipboard()

async function loadData() {
  loading.value = true
  try {
    const [licRes, txRes, appRes] = await Promise.all([
      api.getLicenses(),
      api.getTransactions(),
      api.getApps(),
    ])
    licenses.value = licRes.licenses || []
    transactions.value = txRes.transactions || []
    appsList.value = appRes.apps || []
  } catch (err) {
    console.error('Gagal memuat data subscriptions:', err)
  } finally {
    loading.value = false
  }
}

onMounted(loadData)
watch(env, loadData)

// Map cumulative LTV per customerEmail & appId
const customerLtvMap = computed(() => {
  const map = new Map<string, number>()
  for (const tx of transactions.value) {
    if (tx.paymentStatus === 'PAID') {
      const key = `${tx.customerEmail.toLowerCase()}__${tx.appId}`
      const prev = map.get(key) || 0
      map.set(key, prev + (tx.grossAmount || 0))
    }
  }
  return map
})

function getCustomerLtv(email: string, appId: string): number {
  const key = `${email.toLowerCase()}__${appId}`
  return customerLtvMap.value.get(key) || 0
}

function getAppName(appId: string): string {
  const app = appsList.value.find((a: AppItem) => a.id === appId)
  return app ? app.name : appId
}

function getAppPrice(appId: string): number {
  const app = appsList.value.find((a: AppItem) => a.id === appId)
  return app?.targetPrice || 49000
}

function getAppBillingInterval(appId: string): string {
  const app = appsList.value.find((a: AppItem) => a.id === appId)
  if (app?.pricingType !== 'subscription') {
    return 'Lisensi Lifetime / Sekali'
  }
  const period = app.billingPeriod
  if (period === 'daily') return 'Harian'
  if (period === 'weekly') return 'Mingguan'
  if (period === 'monthly') return 'Bulanan'
  if (period === 'every_3_months') return '3 Bulan'
  if (period === 'every_6_months') return '6 Bulan'
  if (period === 'yearly') return 'Tahunan'
  if (period === 'custom') return 'Kustom'
  return 'Berulang'
}

const subscriptionsList = computed<SubscriptionItem[]>(() => {
  return licenses.value.map((lic: LicenseItem) => {
    const ltv = getCustomerLtv(lic.customerEmail, lic.appId)
    const app = appsList.value.find((a: AppItem) => a.id === lic.appId)
    const isTrial = Boolean(app?.trialPeriodDays && app.trialPeriodDays > 0)
    return {
      ...lic,
      ltv,
      isTrial,
      billingInterval: getAppBillingInterval(lic.appId),
      appName: getAppName(lic.appId),
    }
  })
})

const filteredSubscriptions = computed<SubscriptionItem[]>(() => {
  return subscriptionsList.value.filter((sub: SubscriptionItem) => {
    if (selectedStatus.value !== 'ALL' && sub.status !== selectedStatus.value) {
      return false
    }
    if (selectedAppId.value !== 'ALL' && sub.appId !== selectedAppId.value) {
      return false
    }
    if (searchQuery.value.trim()) {
      const q = searchQuery.value.toLowerCase().trim()
      const matchEmail = sub.customerEmail.toLowerCase().includes(q)
      const matchKey = sub.licenseKey.toLowerCase().includes(q)
      const matchApp = sub.appName.toLowerCase().includes(q)
      if (!matchEmail && !matchKey && !matchApp) return false
    }
    return true
  })
})

const kpiStats = computed(() => {
  const activeSubs = subscriptionsList.value.filter((s: SubscriptionItem) => s.status === 'ACTIVE')
  
  // P7: Hitung MRR hanya dari produk langganan berulang (subscription), bukan produk one-time
  const activeRecurringSubs = activeSubs.filter(s => {
    const app = appsList.value.find(a => a.id === s.appId)
    return app?.pricingType === 'subscription'
  })
  const mrr = activeRecurringSubs.reduce((acc: number, s: SubscriptionItem) => {
    const app = appsList.value.find(a => a.id === s.appId)
    const price = app?.targetPrice || 0
    if (app?.billingPeriod === 'yearly') return acc + Math.round(price / 12)
    if (app?.billingPeriod === 'weekly') return acc + Math.round(price * 4)
    if (app?.billingPeriod === 'daily') return acc + Math.round(price * 30)
    return acc + price
  }, 0)

  // Hitung average LTV
  const totalLtv = activeSubs.reduce((acc: number, s: SubscriptionItem) => acc + s.ltv, 0)
  const avgLtv = activeSubs.length > 0 ? Math.round(totalLtv / activeSubs.length) : 0

  // Langganan yang akan kedaluwarsa dalam 7 hari
  const now = Date.now()
  const in7Days = now + 7 * 24 * 60 * 60 * 1000
  const expiringSoon = activeSubs.filter((s: SubscriptionItem) => {
    if (!s.expiresAt) return false
    const exp = new Date(s.expiresAt).getTime()
    return exp > now && exp <= in7Days
  }).length

  return {
    activeCount: activeSubs.length,
    activeRecurringCount: activeRecurringSubs.length,
    mrr,
    avgLtv,
    expiringSoon,
    totalCount: subscriptionsList.value.length,
  }
})

const actionFeedback = ref<string | null>(null)

function openDetail(sub: SubscriptionItem) {
  selectedSub.value = sub
  isDetailModalOpen.value = true
}

function closeDetail() {
  isDetailModalOpen.value = false
  selectedSub.value = null
}

const linkedTransactions = computed(() => {
  if (!selectedSub.value) return []
  return transactions.value.filter((tx) => {
    return (
      tx.customerEmail.toLowerCase() === selectedSub.value?.customerEmail.toLowerCase() &&
      tx.appId === selectedSub.value?.appId
    )
  })
})

async function handleRevoke(key: string) {
  if (!confirm(`Cabut akses langganan dan lisensi ${key}?`)) return
  isRevoking.value = true
  actionFeedback.value = null
  try {
    const res = await api.revokeLicense(key)
    if (res.success) {
      actionFeedback.value = `Lisensi ${key} berhasil dicabut.`
      await loadData()
      closeDetail()
      setTimeout(() => { actionFeedback.value = null }, 5000)
    } else {
      actionFeedback.value = `Gagal mencabut lisensi: ${res.error || 'Terjadi kesalahan'}`
    }
  } catch (err: any) {
    actionFeedback.value = `Error: ${err?.message || 'Gagal mencabut lisensi'}`
  } finally {
    isRevoking.value = false
  }
}

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return 'Masa aktif permanen'
  const d = new Date(dateStr)
  return d.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}
</script>

<template>
  <div class="animate-fadeIn pb-12">
    <!-- Unified Header & Toolbar (Edge-to-Edge Full Width & Standardized Height) -->
    <div class="-mx-3.5 sm:-mx-4 md:-mx-6 px-3.5 sm:px-4 md:px-6 min-h-[44px] py-1.5 sm:py-0 bg-[#111111] text-white border-b border-[#111111] flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-xs mb-0">
      <div class="flex items-center gap-2">
        <h1 class="text-xs font-bold uppercase tracking-wider text-white">Subscriptions</h1>
        <span class="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white font-mono font-bold">
          {{ subscriptionsList.length }} subs
        </span>
        <span
          class="px-2 py-0.5 rounded-md font-bold text-[10px]"
          :class="env === 'sandbox' ? 'bg-[#D4AF37] text-[#111111]' : 'bg-[#0F4C3A] text-white'"
        >
          {{ env === 'sandbox' ? 'Sandbox' : 'Live' }}
        </span>
      </div>

      <div class="flex items-center gap-2 overflow-x-auto no-scrollbar w-full sm:w-auto">
        <!-- Search Input -->
        <div class="relative w-full sm:w-56">
          <Search class="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Cari email, kunci, app..."
            class="w-full pl-8 pr-2.5 py-1 rounded-lg bg-white/10 border border-white/15 text-xs text-white placeholder:text-white/40 focus:outline-none focus:bg-white/15 focus:border-[#D4AF37] transition"
          />
        </div>

        <!-- Status Filter Pill -->
        <div class="flex items-center h-7 rounded-md bg-white/10 p-0.5 text-[10px] font-medium shrink-0">
          <button
            @click="selectedStatus = 'ALL'"
            :class="['px-2 h-full rounded transition cursor-pointer flex items-center', selectedStatus === 'ALL' ? 'bg-white font-bold text-[#111111]' : 'text-white/70 hover:text-white']"
          >
            Semua
          </button>
          <button
            @click="selectedStatus = 'ACTIVE'"
            :class="['px-2 h-full rounded transition cursor-pointer flex items-center', selectedStatus === 'ACTIVE' ? 'bg-white font-bold text-[#111111]' : 'text-white/70 hover:text-white']"
          >
            Aktif
          </button>
          <button
            @click="selectedStatus = 'EXPIRED'"
            :class="['px-2 h-full rounded transition cursor-pointer flex items-center', selectedStatus === 'EXPIRED' ? 'bg-white font-bold text-[#111111]' : 'text-white/70 hover:text-white']"
          >
            Expired
          </button>
          <button
            @click="selectedStatus = 'REVOKED'"
            :class="['px-2 h-full rounded transition cursor-pointer flex items-center', selectedStatus === 'REVOKED' ? 'bg-white font-bold text-[#111111]' : 'text-white/70 hover:text-white']"
          >
            Dicabut
          </button>
        </div>

        <button
          @click="loadData"
          title="Segarkan"
          class="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer transition shrink-0"
        >
          <RefreshCw class="w-3.5 h-3.5" :class="{ 'animate-spin': loading }" />
        </button>
      </div>
    </div>

    <!-- Product Catalog Stats KPI Bar (Flush Canvas, Creem/Polar style) -->
    <div class="-mx-3.5 sm:-mx-4 md:-mx-6 px-3.5 sm:px-4 md:px-6 grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 py-2.5 sm:py-3 border-b border-[#111111]/15 mb-0">
      <div class="space-y-0.5">
        <div class="text-xs font-semibold text-[#111111]/60">Langganan Aktif</div>
        <div class="text-2xl font-bold text-[#0F4C3A] font-mono tracking-tight">{{ kpiStats.activeCount }}</div>
        <div class="text-[11px] text-[#111111]/50 font-medium">dari total {{ kpiStats.totalCount }} entitas langganan</div>
      </div>

      <div class="space-y-0.5 sm:border-l sm:border-[#111111]/10 sm:pl-5">
        <div class="text-xs font-semibold text-[#111111]/60">Estimasi MRR</div>
        <div class="text-2xl font-bold text-[#111111] font-mono tracking-tight">{{ formatRupiah(kpiStats.mrr) }}</div>
        <div class="text-[11px] text-[#111111]/50 font-medium">Monthly recurring revenue aktif</div>
      </div>

      <div class="space-y-0.5 sm:border-l sm:border-[#111111]/10 sm:pl-5">
        <div class="text-xs font-semibold text-[#111111]/60">Average LTV</div>
        <div class="text-2xl font-bold text-[#111111] font-mono tracking-tight">{{ formatRupiah(kpiStats.avgLtv) }}</div>
        <div class="text-[11px] text-[#111111]/50 font-medium">Rata-rata akumulasi nilai per pelanggan</div>
      </div>

      <div class="space-y-0.5 sm:border-l sm:border-[#111111]/10 sm:pl-5">
        <div class="text-xs font-semibold text-[#111111]/60">Jatuh Tempo (7 Hari)</div>
        <div class="text-2xl font-bold text-[#D4AF37] font-mono tracking-tight">{{ kpiStats.expiringSoon }}</div>
        <div class="text-[11px] text-[#111111]/50 font-medium">Masa aktif lisensi akan berakhir dalam 7 hari</div>
      </div>
    </div>

    <!-- Edge-to-Edge Table -->
    <div class="-mx-3.5 sm:-mx-4 md:-mx-6 overflow-x-auto top-scrollbar">
      <table class="w-full min-w-full text-left text-xs whitespace-nowrap border-b border-[#111111]/15">
        <thead class="border-b border-[#111111]/20 text-xs font-semibold text-[#111111]/70 bg-white">
          <tr>
            <th class="py-2.5 pr-3 pl-3.5 sm:pl-4 md:pl-6">Pelanggan</th>
            <th class="py-2.5 px-3">Produk Software</th>
            <th class="py-2.5 px-3">Kunci Lisensi</th>
            <th class="py-2.5 px-3">Siklus</th>
            <th class="py-2.5 px-3">Total LTV</th>
            <th class="py-2.5 px-3">Status</th>
            <th class="py-2.5 px-3">Jatuh Tempo</th>
            <th class="py-2.5 pl-3 pr-3.5 sm:pr-4 md:pr-6 text-right">Aksi</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-[#111111]/15">
          <tr v-if="filteredSubscriptions.length === 0">
            <td colspan="8" class="py-8 px-3.5 sm:px-4 md:px-6 text-center text-[#111111]/40">
              <div class="space-y-1">
                <p class="font-semibold text-xs text-[#111111]/60">Tidak ada langganan ditemukan.</p>
                <p class="text-[11px] text-[#111111]/40">
                  Coba sesuaikan kata kunci pencarian atau filter status.
                </p>
              </div>
            </td>
          </tr>
          <tr
            v-for="sub in filteredSubscriptions"
            :key="sub.id"
            class="hover:bg-slate-50/70 transition group cursor-pointer"
            @click="openDetail(sub)"
          >
            <td class="py-3 pr-3 pl-3.5 sm:pl-4 md:pl-6 font-medium text-[#111111]">
              {{ sub.customerEmail }}
            </td>
            <td class="py-3 px-3">
              <span class="font-medium text-[#111111]/80">{{ sub.appName }}</span>
            </td>
            <td class="py-3 px-3 font-mono text-[11px] text-[#111111]">
              <span class="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200">
                {{ sub.licenseKey.slice(0, 10) }}...
              </span>
            </td>
            <td class="py-3 px-3 text-[#111111]/70">
              {{ sub.billingInterval }}
            </td>
            <td class="py-3 px-3 font-mono font-bold text-[#0F4C3A]">
              {{ formatRupiah(sub.ltv) }}
            </td>
            <td class="py-3 px-3">
              <span
                :class="[
                  'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider',
                  sub.status === 'ACTIVE'
                    ? 'bg-[#0F4C3A]/10 text-[#0F4C3A] border border-[#0F4C3A]/30'
                    : sub.status === 'EXPIRED'
                    ? 'bg-[#D4AF37]/15 text-[#8a6d1f] border border-[#D4AF37]/30'
                    : 'bg-red-50 text-red-600 border border-red-200'
                ]"
              >
                <span
                  class="w-1.5 h-1.5 rounded-full"
                  :class="sub.status === 'ACTIVE' ? 'bg-[#0F4C3A]' : sub.status === 'EXPIRED' ? 'bg-[#D4AF37]' : 'bg-red-500'"
                ></span>
                {{ sub.status }}
              </span>
            </td>
            <td class="py-3 px-3 text-[11px] text-[#111111]/60 font-mono">
              {{ formatDate(sub.expiresAt) }}
            </td>
            <td class="py-3 pl-3 pr-3.5 sm:pr-4 md:pr-6 text-right" @click.stop>
              <button
                type="button"
                @click="openDetail(sub)"
                class="px-2.5 py-1 rounded-md text-xs font-semibold border border-slate-300 hover:bg-[#111111] hover:text-white hover:border-[#111111] transition cursor-pointer"
              >
                Kelola
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Subscription Detail Modal -->
    <div
      v-if="isDetailModalOpen && selectedSub"
      class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-fadeIn"
      @click.self="closeDetail"
    >
      <div class="bg-white border border-[#111111]/15 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-scaleIn flex flex-col max-h-[90vh]">
        <!-- Header -->
        <div class="px-5 py-3.5 border-b border-[#111111]/10 flex items-center justify-between bg-white shrink-0">
          <div class="flex items-center gap-2">
            <div class="w-2 h-2 rounded-full bg-[#D4AF37]"></div>
            <h3 class="text-xs font-bold uppercase tracking-wider text-[#111111]">
              Rincian Langganan &amp; Nilai LTV
            </h3>
          </div>
          <button
            type="button"
            @click="closeDetail"
            class="text-[#111111]/40 hover:text-[#111111] p-1 rounded-md hover:bg-[#111111]/5 transition cursor-pointer"
          >
            <X class="w-4 h-4" />
          </button>
        </div>

        <!-- Body -->
        <div class="px-5 py-4 overflow-y-auto space-y-4 text-xs">
          <!-- Top LTV Card -->
          <div class="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
            <div class="flex items-center justify-between">
              <span class="text-[11px] text-[#111111]/60 font-semibold">Total Nilai Seumur Hidup (Lifetime Value)</span>
              <span
                :class="selectedSub.status === 'ACTIVE' ? 'bg-[#0F4C3A]/10 text-[#0F4C3A] border-[#0F4C3A]/20' : 'bg-red-500/10 text-red-600 border-red-500/20'"
                class="text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase"
              >
                {{ selectedSub.status }}
              </span>
            </div>
            <div class="text-2xl font-mono font-bold text-[#0F4C3A]">
              {{ formatRupiah(selectedSub.ltv) }}
            </div>
            <p class="text-[10px] text-[#111111]/50">
              Total akumulasi pendapatan yang telah dibayarkan oleh pelanggan ini untuk produk {{ selectedSub.appName }}.
            </p>
          </div>

          <!-- Subscription Metadata -->
          <div class="space-y-2.5">
            <div class="flex justify-between py-1 border-b border-slate-100">
              <span class="text-[#111111]/60">Pelanggan</span>
              <span class="font-semibold text-[#111111]">{{ selectedSub.customerEmail }}</span>
            </div>
            <div class="flex justify-between py-1 border-b border-slate-100">
              <span class="text-[#111111]/60">Produk</span>
              <span class="font-semibold text-[#111111]">{{ selectedSub.appName }}</span>
            </div>
            <div class="flex justify-between items-center py-1 border-b border-slate-100">
              <span class="text-[#111111]/60">Kunci Lisensi</span>
              <div class="flex items-center gap-1.5 font-mono font-bold text-[#111111]">
                <span>{{ selectedSub.licenseKey }}</span>
                <button
                  type="button"
                  @click="copy(selectedSub.licenseKey)"
                  class="text-[#D4AF37] hover:text-[#B89628] p-0.5 cursor-pointer"
                  title="Salin Kunci"
                >
                  <Check v-if="copied" class="w-3.5 h-3.5 text-[#0F4C3A]" />
                  <Copy v-else class="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <div class="flex justify-between py-1 border-b border-slate-100">
              <span class="text-[#111111]/60">Max Device Seats</span>
              <span class="font-semibold text-[#111111]">{{ selectedSub.maxSeats }} Seats</span>
            </div>
            <div class="flex justify-between py-1 border-b border-slate-100">
              <span class="text-[#111111]/60">Masa Berlaku</span>
              <span class="font-semibold text-[#111111]">{{ formatDate(selectedSub.expiresAt) }}</span>
            </div>
          </div>

          <!-- Linked Transactions List -->
          <div class="space-y-2">
            <div class="text-[11px] uppercase font-bold text-[#111111]/70 tracking-wider">
              Riwayat Pembayaran Pelanggan Ini
            </div>
            <div v-if="linkedTransactions.length === 0" class="p-3 text-center text-slate-400 bg-slate-50 rounded-lg text-xs">
              Belum ada transaksi tercatat.
            </div>
            <div v-else class="space-y-1.5 max-h-40 overflow-y-auto">
              <div
                v-for="tx in linkedTransactions"
                :key="tx.id"
                class="p-2 rounded-lg bg-slate-50 border border-slate-200/70 flex items-center justify-between text-xs"
              >
                <div>
                  <div class="font-mono font-bold text-[#111111]">{{ tx.id }}</div>
                  <div class="text-[10px] text-[#111111]/50">{{ formatDate(tx.paidAt || tx.createdAt) }} • {{ tx.paymentChannel || 'QRIS' }}</div>
                </div>
                <div class="text-right">
                  <div class="font-mono font-bold text-[#0F4C3A]">{{ formatRupiah(tx.grossAmount) }}</div>
                  <div class="text-[10px] uppercase font-bold text-slate-500">{{ tx.paymentStatus }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="px-5 py-3 border-t border-[#111111]/10 bg-slate-50/70 shrink-0 flex items-center justify-between">
          <button
            v-if="selectedSub.status === 'ACTIVE'"
            type="button"
            @click="handleRevoke(selectedSub.licenseKey)"
            :disabled="isRevoking"
            class="px-3 h-8 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-xs font-bold text-red-600 transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
          >
            <Ban class="w-3.5 h-3.5" />
            <span>{{ isRevoking ? 'Mencabut...' : 'Cabut Lisensi' }}</span>
          </button>
          <div v-else></div>

          <button
            type="button"
            @click="closeDetail"
            class="h-8 px-4 rounded-lg border border-slate-300 hover:bg-slate-100 text-xs font-bold text-[#111111] transition cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
