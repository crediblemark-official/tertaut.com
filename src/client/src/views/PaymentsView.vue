<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { api } from '../lib/api'
import type { AppItem, DashboardStats } from '../types/app'
import type { TransactionItem } from '../types/transaction'
import { dashboardEnv } from '../lib/environment'
import { formatRupiah } from '../lib/utils'
import {
  CreditCard,
  Receipt,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  X,
  RefreshCw,
  Sparkles,
  Zap,
  ArrowUpRight,
  ShieldCheck,
  Building2,
  Wallet,
} from 'lucide-vue-next'

const env = dashboardEnv
const loading = ref(false)
const transactions = ref<TransactionItem[]>([])
const appsList = ref<AppItem[]>([])
const overviewStats = ref<DashboardStats | null>(null)

const page = ref(1)
const limit = ref(25)
const total = ref(0)
const hasMore = ref(false)

const searchQuery = ref('')
const selectedStatus = ref<'ALL' | 'PAID' | 'PENDING' | 'FAILED' | 'EXPIRED'>('ALL')
const selectedAppId = ref<string>('ALL')

const selectedTx = ref<TransactionItem | null>(null)
const isDetailModalOpen = ref(false)
const isSimulating = ref(false)
const simulateMsg = ref<string | null>(null)

async function loadData() {
  loading.value = true
  try {
    const [txRes, appRes, statsRes] = await Promise.all([
      api.getTransactions({ page: page.value, limit: limit.value }),
      api.getApps(),
      api.getStats().catch(() => null),
    ])
    transactions.value = txRes.transactions || []
    total.value = txRes.total ?? transactions.value.length
    hasMore.value = txRes.hasMore ?? false
    appsList.value = appRes.apps || []
    overviewStats.value = statsRes
  } catch (err) {
    console.error('Gagal memuat data payments:', err)
  } finally {
    loading.value = false
  }
}

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / limit.value)))

function prevPage() {
  if (page.value > 1) {
    page.value--
    loadData()
  }
}

function nextPage() {
  if (page.value < totalPages.value) {
    page.value++
    loadData()
  }
}

onMounted(loadData)
watch(env, () => {
  page.value = 1
  loadData()
})

const filteredTransactions = computed(() => {
  return transactions.value.filter((tx) => {
    if (selectedStatus.value !== 'ALL' && tx.paymentStatus !== selectedStatus.value) {
      return false
    }
    if (selectedAppId.value !== 'ALL' && tx.appId !== selectedAppId.value) {
      return false
    }
    if (searchQuery.value.trim()) {
      const q = searchQuery.value.toLowerCase().trim()
      const matchEmail = tx.customerEmail?.toLowerCase().includes(q)
      const matchId = tx.id.toLowerCase().includes(q)
      const matchExt = tx.xenditExternalId?.toLowerCase().includes(q)
      const matchChannel = tx.paymentChannel?.toLowerCase().includes(q)
      if (!matchEmail && !matchId && !matchExt && !matchChannel) return false
    }
    return true
  })
})

const kpiStats = computed(() => {
  const paidTxs = transactions.value.filter(t => t.paymentStatus === 'PAID')
  const totalGross = overviewStats.value?.totalGMV ?? paidTxs.reduce((acc, t) => acc + (t.grossAmount || 0), 0)
  const totalNet = overviewStats.value?.netEarnings ?? paidTxs.reduce((acc, t) => acc + (t.netAmount || 0), 0)
  const totalFee = overviewStats.value?.platformFeeCollected ?? paidTxs.reduce((acc, t) => acc + (t.platformFee || 0), 0)
  const paidCount = overviewStats.value?.totalTransactions ?? paidTxs.length
  const pendingCount = transactions.value.filter(t => t.paymentStatus === 'PENDING').length

  return {
    totalGross,
    totalNet,
    totalFee,
    paidCount,
    pendingCount,
    totalCount: transactions.value.length,
  }
})

function openDetail(tx: TransactionItem) {
  selectedTx.value = tx
  simulateMsg.value = null
  isDetailModalOpen.value = true
}

function closeDetail() {
  isDetailModalOpen.value = false
  selectedTx.value = null
}

async function handleSimulate(txId: string) {
  isSimulating.value = true
  simulateMsg.value = null
  try {
    const res = await api.simulatePayment(txId)
    if (res.success) {
      simulateMsg.value = 'Pembayaran berhasil disimulasikan!'
      await loadData()
      const updated = transactions.value.find(t => t.id === txId)
      if (updated) selectedTx.value = updated
    } else {
      simulateMsg.value = res.message || 'Gagal simulasi'
    }
  } catch (err: any) {
    simulateMsg.value = err?.message || 'Error simulasi'
  } finally {
    isSimulating.value = false
  }
}

function getAppName(appId: string): string {
  const app = appsList.value.find(a => a.id === appId)
  return app ? app.name : appId
}

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  return d.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
</script>

<template>
  <div class="animate-fadeIn pb-12">
    <!-- Unified Header & Toolbar (Edge-to-Edge Full Width & Standardized Height) -->
    <div class="-mx-3.5 sm:-mx-4 md:-mx-6 px-3.5 sm:px-4 md:px-6 min-h-[44px] py-1.5 sm:py-0 bg-jetblack text-white border-b border-jetblack flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-xs mb-0">
      <div class="flex items-center gap-2">
        <h1 class="text-xs font-bold uppercase tracking-wider text-white">Payments</h1>
        <span class="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white font-mono font-bold">
          {{ transactions.length }} transaksi
        </span>
        <span
          class="px-2 py-0.5 rounded-md font-bold text-[10px]"
          :class="env === 'sandbox' ? 'bg-gold text-jetblack' : 'bg-forest text-white'"
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
            placeholder="Cari tx id, email, invoice..."
            class="w-full pl-8 pr-2.5 py-1 rounded-lg bg-white/10 border border-white/15 text-xs text-white placeholder:text-white/40 focus:outline-none focus:bg-white/15 focus:border-gold transition"
          />
        </div>

        <!-- Status Filter Pill -->
        <div class="flex items-center h-7 rounded-md bg-white/10 p-0.5 text-[10px] font-medium shrink-0">
          <button
            @click="selectedStatus = 'ALL'"
            :class="['px-2 h-full rounded transition cursor-pointer flex items-center', selectedStatus === 'ALL' ? 'bg-white font-bold text-jetblack' : 'text-white/70 hover:text-white']"
          >
            Semua
          </button>
          <button
            @click="selectedStatus = 'PAID'"
            :class="['px-2 h-full rounded transition cursor-pointer flex items-center', selectedStatus === 'PAID' ? 'bg-white font-bold text-jetblack' : 'text-white/70 hover:text-white']"
          >
            Paid
          </button>
          <button
            @click="selectedStatus = 'PENDING'"
            :class="['px-2 h-full rounded transition cursor-pointer flex items-center', selectedStatus === 'PENDING' ? 'bg-white font-bold text-jetblack' : 'text-white/70 hover:text-white']"
          >
            Pending
          </button>
          <button
            @click="selectedStatus = 'FAILED'"
            :class="['px-2 h-full rounded transition cursor-pointer flex items-center', selectedStatus === 'FAILED' ? 'bg-white font-bold text-jetblack' : 'text-white/70 hover:text-white']"
          >
            Failed
          </button>
          <button
            @click="selectedStatus = 'EXPIRED'"
            :class="['px-2 h-full rounded transition cursor-pointer flex items-center', selectedStatus === 'EXPIRED' ? 'bg-white font-bold text-jetblack' : 'text-white/70 hover:text-white']"
          >
            Expired
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
    <div class="-mx-3.5 sm:-mx-4 md:-mx-6 px-3.5 sm:px-4 md:px-6 grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 py-2.5 sm:py-3 border-b border-jetblack/15 mb-0">
      <div class="space-y-0.5">
        <div class="text-xs font-semibold text-jetblack/60">Gross Volume</div>
        <div class="text-2xl font-bold text-jetblack font-mono tracking-tight">{{ formatRupiah(kpiStats.totalGross) }}</div>
        <div class="text-[11px] text-jetblack/50 font-medium">{{ kpiStats.paidCount }} transaksi sukses</div>
      </div>

      <div class="space-y-0.5 sm:border-l sm:border-jetblack/10 sm:pl-5">
        <div class="text-xs font-semibold text-jetblack/60">Net Creator (95%)</div>
        <div class="text-2xl font-bold text-forest font-mono tracking-tight">{{ formatRupiah(kpiStats.totalNet) }}</div>
        <div class="text-[11px] text-jetblack/50 font-medium">Fee MoR Tertaut 5% ({{ formatRupiah(kpiStats.totalFee) }})</div>
      </div>

      <div class="space-y-0.5 sm:border-l sm:border-jetblack/10 sm:pl-5">
        <div class="text-xs font-semibold text-jetblack/60">Transaksi Berhasil</div>
        <div class="text-2xl font-bold text-jetblack font-mono tracking-tight">{{ kpiStats.paidCount }}</div>
        <div class="text-[11px] text-jetblack/50 font-medium">dari total {{ kpiStats.totalCount }} pesanan</div>
      </div>

      <div class="space-y-0.5 sm:border-l sm:border-jetblack/10 sm:pl-5">
        <div class="text-xs font-semibold text-jetblack/60">Menunggu Pembayaran</div>
        <div class="text-2xl font-bold text-gold font-mono tracking-tight">{{ kpiStats.pendingCount }}</div>
        <div class="text-[11px] text-jetblack/50 font-medium">menunggu konfirmasi webhook</div>
      </div>
    </div>

    <!-- Edge-to-Edge Table -->
    <div class="-mx-3.5 sm:-mx-4 md:-mx-6 overflow-x-auto top-scrollbar">
      <table class="w-full min-w-full text-left text-xs whitespace-nowrap border-b border-jetblack/15">
        <thead class="border-b border-jetblack/20 text-xs font-semibold text-jetblack/70 bg-white">
          <tr>
            <th class="py-2.5 pr-3 pl-3.5 sm:pl-4 md:pl-6">ID Transaksi</th>
            <th class="py-2.5 px-3">Pelanggan</th>
            <th class="py-2.5 px-3">Aplikasi</th>
            <th class="py-2.5 px-3">Gross (Bruto)</th>
            <th class="py-2.5 px-3">Net (95%)</th>
            <th class="py-2.5 px-3">Metode</th>
            <th class="py-2.5 px-3">Status</th>
            <th class="py-2.5 px-3">Waktu</th>
            <th class="py-2.5 pl-3 pr-3.5 sm:pr-4 md:pr-6 text-right">Aksi</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-jetblack/15">
          <tr v-if="filteredTransactions.length === 0">
            <td colspan="9" class="py-8 px-3.5 sm:px-4 md:px-6 text-center text-jetblack/40">
              <div class="space-y-1">
                <p class="font-semibold text-xs text-jetblack/60">Tidak ada transaksi ditemukan.</p>
                <p class="text-[11px] text-jetblack/40">
                  Coba sesuaikan kata kunci pencarian atau filter status.
                </p>
              </div>
            </td>
          </tr>
          <tr
            v-for="tx in filteredTransactions"
            :key="tx.id"
            class="hover:bg-slate-50/70 transition group cursor-pointer"
            @click="openDetail(tx)"
          >
            <td class="py-3 pr-3 pl-3.5 sm:pl-4 md:pl-6 font-mono font-bold text-jetblack">
              <div class="flex items-center gap-1.5">
                <span>{{ tx.id }}</span>
                <span
                  v-if="env === 'sandbox'"
                  class="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-gold/15 text-[#8a6d1f] border border-gold/30"
                >
                  SIM
                </span>
              </div>
            </td>
            <td class="py-3 px-3">
              <div class="font-medium text-jetblack">{{ tx.customerEmail || '-' }}</div>
            </td>
            <td class="py-3 px-3">
              <span class="font-medium text-jetblack/80">{{ getAppName(tx.appId) }}</span>
            </td>
            <td class="py-3 px-3 font-mono font-bold text-jetblack">
              {{ formatRupiah(tx.grossAmount) }}
            </td>
            <td class="py-3 px-3 font-mono font-bold text-forest">
              {{ formatRupiah(tx.netAmount) }}
            </td>
            <td class="py-3 px-3">
              <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10.5px] font-medium bg-slate-100 text-slate-700">
                <CreditCard class="w-3 h-3 text-gold" />
                <span>{{ tx.paymentChannel || 'QRIS / VA' }}</span>
              </span>
            </td>
            <td class="py-3 px-3">
              <span
                :class="[
                  'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider',
                  tx.paymentStatus === 'PAID'
                    ? 'bg-forest/10 text-forest border border-forest/30'
                    : tx.paymentStatus === 'PENDING'
                    ? 'bg-gold/15 text-[#8a6d1f] border border-gold/30'
                    : 'bg-red-50 text-red-600 border border-red-200'
                ]"
              >
                <span
                  class="w-1.5 h-1.5 rounded-full"
                  :class="tx.paymentStatus === 'PAID' ? 'bg-forest' : tx.paymentStatus === 'PENDING' ? 'bg-gold' : 'bg-red-500'"
                ></span>
                {{ tx.paymentStatus }}
              </span>
            </td>
            <td class="py-3 px-3 text-[11px] text-jetblack/60 font-mono">
              {{ formatDate(tx.paidAt || tx.createdAt) }}
            </td>
            <td class="py-3 pl-3 pr-3.5 sm:pr-4 md:pr-6 text-right" @click.stop>
              <button
                type="button"
                @click="openDetail(tx)"
                class="px-2.5 py-1 rounded-md text-xs font-semibold border border-slate-300 hover:bg-jetblack hover:text-white hover:border-jetblack transition cursor-pointer"
              >
                Detail
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Pagination Bar -->
    <div class="-mx-3.5 sm:-mx-4 md:-mx-6 px-3.5 sm:px-4 md:px-6 py-3 border-b border-jetblack/15 bg-white flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
      <div class="text-jetblack/60">
        Menampilkan <span class="font-semibold text-jetblack">{{ total > 0 ? (page - 1) * limit + 1 : 0 }}</span> -
        <span class="font-semibold text-jetblack">{{ Math.min(page * limit, total) }}</span> dari
        <span class="font-semibold text-jetblack">{{ total }}</span> transaksi
      </div>
      <div class="flex items-center gap-2">
        <button
          type="button"
          @click="prevPage"
          :disabled="page <= 1 || loading"
          class="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-jetblack transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          Sebelumnya
        </button>
        <span class="px-2 font-mono font-medium text-jetblack">
          Hal {{ page }} / {{ totalPages }}
        </span>
        <button
          type="button"
          @click="nextPage"
          :disabled="page >= totalPages || loading"
          class="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-jetblack transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          Selanjutnya
        </button>
      </div>
    </div>

    <!-- Transaction Detail Modal -->
    <div
      v-if="isDetailModalOpen && selectedTx"
      class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-fadeIn"
      @click.self="closeDetail"
    >
      <div class="bg-white border border-jetblack/15 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-scaleIn flex flex-col max-h-[90vh]">
        <!-- Header -->
        <div class="px-5 py-3.5 border-b border-jetblack/10 flex items-center justify-between bg-white shrink-0">
          <div class="flex items-center gap-2">
            <div class="w-2 h-2 rounded-full bg-gold"></div>
            <h3 class="text-xs font-bold uppercase tracking-wider text-jetblack">
              Rincian Pembayaran
            </h3>
          </div>
          <button
            type="button"
            @click="closeDetail"
            class="text-jetblack/40 hover:text-jetblack p-1 rounded-md hover:bg-jetblack/5 transition cursor-pointer"
          >
            <X class="w-4 h-4" />
          </button>
        </div>

        <!-- Body -->
        <div class="px-5 py-4 overflow-y-auto space-y-4 text-xs">
          <!-- Top Amount Card -->
          <div class="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
            <div class="flex items-center justify-between">
              <span class="text-[11px] text-jetblack/60 font-semibold">Total Nilai Pembayaran</span>
              <span
                :class="selectedTx.paymentStatus === 'PAID' ? 'bg-forest/10 text-forest border-forest/20' : 'bg-amber-500/10 text-amber-700 border-amber-500/20'"
                class="text-[10px] font-bold px-2 py-0.5 rounded-full border"
              >
                {{ selectedTx.paymentStatus === 'PAID' ? 'LUNAS (PAID)' : 'MENUNGGU PEMBAYARAN' }}
              </span>
            </div>
            <div class="text-2xl font-mono font-bold text-jetblack">
              {{ formatRupiah(selectedTx.grossAmount) }}
            </div>
            <div class="pt-2 border-t border-slate-200 grid grid-cols-2 gap-2 text-[11px]">
              <div>
                <span class="text-jetblack/50 block">Platform Fee (5% MoR):</span>
                <span class="font-mono font-bold text-red-600">- {{ formatRupiah(selectedTx.platformFee) }}</span>
              </div>
              <div>
                <span class="text-jetblack/50 block">Net Payout (95%):</span>
                <span class="font-mono font-bold text-forest">{{ formatRupiah(selectedTx.netAmount) }}</span>
              </div>
            </div>
          </div>

          <!-- Transaction Fields Details -->
          <div class="space-y-2.5">
            <div class="flex justify-between py-1 border-b border-slate-100">
              <span class="text-jetblack/60">ID Transaksi</span>
              <span class="font-mono font-semibold text-jetblack">{{ selectedTx.id }}</span>
            </div>
            <div class="flex justify-between py-1 border-b border-slate-100">
              <span class="text-jetblack/60">Pelanggan</span>
              <span class="font-semibold text-jetblack">{{ selectedTx.customerEmail }}</span>
            </div>
            <div class="flex justify-between py-1 border-b border-slate-100">
              <span class="text-jetblack/60">Produk</span>
              <span class="font-semibold text-jetblack">{{ getAppName(selectedTx.appId) }}</span>
            </div>
            <div class="flex justify-between py-1 border-b border-slate-100">
              <span class="text-jetblack/60">Kanal Pembayaran</span>
              <span class="font-mono font-semibold text-jetblack uppercase">{{ selectedTx.paymentChannel || 'QRIS' }}</span>
            </div>
            <div class="flex justify-between py-1 border-b border-slate-100">
              <span class="text-jetblack/60">Gateway / MoR Provider</span>
              <span class="font-semibold text-jetblack uppercase">{{ selectedTx.paymentProvider || 'DANA' }}</span>
            </div>
            <div class="flex justify-between py-1 border-b border-slate-100">
              <span class="text-jetblack/60">Status Pencairan (Disbursement)</span>
              <span class="font-semibold text-jetblack uppercase">{{ selectedTx.disbursementStatus || 'PENDING' }}</span>
            </div>
            <div class="flex justify-between py-1 border-b border-slate-100">
              <span class="text-jetblack/60">Waktu Pembayaran</span>
              <span class="text-jetblack">{{ formatDate(selectedTx.paidAt || selectedTx.createdAt) }}</span>
            </div>
          </div>

          <!-- Sandbox Simulator Action -->
          <div v-if="env === 'sandbox' && selectedTx.paymentStatus === 'PENDING'" class="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-2">
            <div class="flex items-center gap-1.5 text-xs font-bold text-amber-900">
              <Zap class="w-3.5 h-3.5 text-amber-600" />
              <span>Sandbox Payment Simulator</span>
            </div>
            <p class="text-[11px] text-amber-800/80">
              Uji coba konfirmasi pembayaran tanpa dana nyata untuk menerbitkan lisensi dan update webhook.
            </p>
            <button
              type="button"
              @click="handleSimulate(selectedTx.id)"
              :disabled="isSimulating"
              class="w-full py-2 btn-gold rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw v-if="isSimulating" class="w-3.5 h-3.5 animate-spin" />
              <span>{{ isSimulating ? 'Memproses Simulasi...' : 'Simulasikan Pembayaran Lunas' }}</span>
            </button>
            <div v-if="simulateMsg" class="text-xs font-bold text-forest text-center pt-1">
              {{ simulateMsg }}
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="px-5 py-3 border-t border-jetblack/10 bg-slate-50/70 shrink-0 flex items-center justify-end">
          <button
            type="button"
            @click="closeDetail"
            class="h-8 px-4 rounded-lg border border-slate-300 hover:bg-slate-100 text-xs font-bold text-jetblack transition cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
