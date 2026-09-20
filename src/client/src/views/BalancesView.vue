<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { api } from '../lib/api'
import type { AppItem } from '../types/app'
import type { TransactionItem } from '../types/transaction'
import { dashboardEnv } from '../lib/environment'
import { formatRupiah } from '../lib/utils'
import {
  Wallet,
  Landmark,
  ArrowDownLeft,
  ArrowUpRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Sparkles,
  Building2,
  X,
  Plus,
  ShieldCheck,
  ChevronRight,
  Send,
  Search,
} from 'lucide-vue-next'

const env = dashboardEnv
const loading = ref(false)
const transactions = ref<TransactionItem[]>([])
const appsList = ref<AppItem[]>([])

const isPayoutModalOpen = ref(false)
const payoutAmount = ref<number>(0)
const isSubmittingPayout = ref(false)
const payoutError = ref<string | null>(null)
const payoutSuccess = ref<string | null>(null)

const statusFilter = ref<'ALL' | 'PENDING' | 'PROCESSING' | 'COMPLETED'>('ALL')
const searchQuery = ref('')

const isAccountModalOpen = ref(false)
const isSavingAccount = ref(false)
const accountFeedback = ref<string | null>(null)
const accountForm = ref({
  bankCode: 'BCA',
  accountNumber: '',
  accountHolderName: '',
})

async function loadAccountData() {
  try {
    const res = await api.getPayoutAccount()
    if (res.success && res.disbursementAccount) {
      accountForm.value = {
        bankCode: res.disbursementAccount.bankCode || 'BCA',
        accountNumber: res.disbursementAccount.accountNumber || '',
        accountHolderName: res.disbursementAccount.accountHolderName || '',
      }
    }
  } catch {
    // Non-blocking
  }
}

async function handleSaveAccount() {
  if (!accountForm.value.accountNumber.trim() || !accountForm.value.accountHolderName.trim()) {
    accountFeedback.value = 'Nomor rekening dan nama pemilik akun wajib diisi.'
    return
  }
  isSavingAccount.value = true
  accountFeedback.value = null
  try {
    const res = await api.updatePayoutAccount(accountForm.value)
    if (res.success) {
      accountFeedback.value = 'Rekening pencairan berhasil disimpan!'
      setTimeout(() => {
        isAccountModalOpen.value = false
        accountFeedback.value = null
      }, 1200)
    } else {
      accountFeedback.value = res.error || 'Gagal menyimpan rekening'
    }
  } catch (err: any) {
    accountFeedback.value = err?.message || 'Terjadi kesalahan sistem'
  } finally {
    isSavingAccount.value = false
  }
}

async function loadData() {
  loading.value = true
  try {
    const [txRes, appRes] = await Promise.all([
      api.getTransactions(),
      api.getApps(),
    ])
    transactions.value = txRes.transactions || []
    appsList.value = appRes.apps || []
    await loadAccountData()
  } catch (err) {
    console.error('Gagal memuat data balances:', err)
  } finally {
    loading.value = false
  }
}

onMounted(loadData)
watch(env, loadData)

const balanceKPIs = computed(() => {
  const paidTxs = transactions.value.filter(t => t.paymentStatus === 'PAID')

  // Saldo tersedia: transaksi PAID yang belum pernah ditarik (disbursementStatus === 'PENDING')
  const availableTxs = paidTxs.filter(t => t.disbursementStatus === 'PENDING' || !t.disbursementStatus)
  const availableBalance = availableTxs.reduce((acc, t) => acc + (t.netAmount || 0), 0)

  // Saldo sedang diproses
  const processingTxs = paidTxs.filter(t => t.disbursementStatus === 'PROCESSING')
  const processingBalance = processingTxs.reduce((acc, t) => acc + (t.netAmount || 0), 0)

  // Total yang sudah dicairkan ke bank
  const completedTxs = paidTxs.filter(t => t.disbursementStatus === 'COMPLETED')
  const totalPaidOut = completedTxs.reduce((acc, t) => acc + (t.netAmount || 0), 0)

  // Total Platform MoR fee
  const totalFeeMoR = paidTxs.reduce((acc, t) => acc + (t.platformFee || 0), 0)

  return {
    availableBalance,
    processingBalance,
    totalPaidOut,
    totalFeeMoR,
    availableCount: availableTxs.length,
    completedCount: completedTxs.length,
  }
})

const filteredLedger = computed(() => {
  const paidTxs = transactions.value.filter(t => t.paymentStatus === 'PAID')
  return paidTxs.filter(t => {
    if (statusFilter.value !== 'ALL' && t.disbursementStatus !== statusFilter.value) {
      return false
    }
    if (searchQuery.value.trim()) {
      const q = searchQuery.value.toLowerCase().trim()
      const matchId = t.id.toLowerCase().includes(q)
      const matchEmail = (t.customerEmail || '').toLowerCase().includes(q)
      const matchApp = getAppName(t.appId).toLowerCase().includes(q)
      if (!matchId && !matchEmail && !matchApp) return false
    }
    return true
  })
})

function openPayoutModal() {
  payoutAmount.value = balanceKPIs.value.availableBalance
  payoutError.value = null
  payoutSuccess.value = null
  isPayoutModalOpen.value = true
}

function closePayoutModal() {
  isPayoutModalOpen.value = false
}

function setMaxPayout() {
  payoutAmount.value = balanceKPIs.value.availableBalance
}

async function handleRequestPayout() {
  payoutError.value = null
  payoutSuccess.value = null

  if (env.value === 'sandbox') {
    payoutError.value = 'Pencairan dana nyata hanya tersedia di mode LIVE. Di mode Sandbox, saldo bersifat simulasi.'
    return
  }

  if (payoutAmount.value < 50000) {
    payoutError.value = 'Batas minimum pencairan adalah Rp 50.000.'
    return
  }

  if (payoutAmount.value > balanceKPIs.value.availableBalance) {
    payoutError.value = 'Nominal melebihi saldo tersedia yang dapat ditarik.'
    return
  }

  isSubmittingPayout.value = true
  try {
    const res = await api.triggerPayout(payoutAmount.value)
    if (res.success) {
      payoutSuccess.value = res.message || 'Permintaan pencairan dana berhasil diproses!'
      await loadData()
      setTimeout(() => {
        closePayoutModal()
      }, 1500)
    } else {
      payoutError.value = res.error || 'Gagal memproses pencairan.'
    }
  } catch (err: any) {
    payoutError.value = err?.message || 'Terjadi kesalahan sistem.'
  } finally {
    isSubmittingPayout.value = false
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
        <h1 class="text-xs font-bold uppercase tracking-wider text-white">Balances</h1>
        <span class="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white font-mono font-bold">
          {{ formatRupiah(balanceKPIs.availableBalance) }} siap tarik
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
        <div class="relative w-full sm:w-52">
          <Search class="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Cari ref, email, produk..."
            class="w-full pl-8 pr-2.5 py-1 rounded-lg bg-white/10 border border-white/15 text-xs text-white placeholder:text-white/40 focus:outline-none focus:bg-white/15 focus:border-gold transition"
          />
        </div>

        <!-- Status Filter Pill -->
        <div class="flex items-center h-7 rounded-md bg-white/10 p-0.5 text-[10px] font-medium shrink-0">
          <button
            @click="statusFilter = 'ALL'"
            :class="['px-2 h-full rounded transition cursor-pointer flex items-center', statusFilter === 'ALL' ? 'bg-white font-bold text-jetblack' : 'text-white/70 hover:text-white']"
          >
            Semua
          </button>
          <button
            @click="statusFilter = 'PENDING'"
            :class="['px-2 h-full rounded transition cursor-pointer flex items-center', statusFilter === 'PENDING' ? 'bg-white font-bold text-jetblack' : 'text-white/70 hover:text-white']"
          >
            Siap Tarik
          </button>
          <button
            @click="statusFilter = 'PROCESSING'"
            :class="['px-2 h-full rounded transition cursor-pointer flex items-center', statusFilter === 'PROCESSING' ? 'bg-white font-bold text-jetblack' : 'text-white/70 hover:text-white']"
          >
            Diproses
          </button>
          <button
            @click="statusFilter = 'COMPLETED'"
            :class="['px-2 h-full rounded transition cursor-pointer flex items-center', statusFilter === 'COMPLETED' ? 'bg-white font-bold text-jetblack' : 'text-white/70 hover:text-white']"
          >
            Dicairkan
          </button>
        </div>

        <button
          type="button"
          @click="isAccountModalOpen = true"
          title="Atur Rekening Pencairan"
          class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-bold text-white transition cursor-pointer shrink-0"
        >
          <Building2 class="w-3.5 h-3.5" />
          <span class="hidden sm:inline">Rekening Bank</span>
        </button>

        <button
          @click="loadData"
          title="Segarkan"
          class="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer transition shrink-0"
        >
          <RefreshCw class="w-3.5 h-3.5" :class="{ 'animate-spin': loading }" />
        </button>

        <button
          type="button"
          @click="env === 'sandbox' ? null : openPayoutModal()"
          :disabled="env === 'sandbox'"
          :class="[
            'inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition shadow-2xs shrink-0',
            env === 'sandbox'
              ? 'bg-white/15 text-white/40 cursor-not-allowed'
              : 'btn-gold cursor-pointer active:scale-95'
          ]"
          :title="env === 'sandbox' ? 'Pencairan dana hanya tersedia di mode LIVE (Saldo Sandbox bersifat simulasi)' : 'Tarik Saldo Tersedia'"
        >
          <Send class="w-3.5 h-3.5 stroke-[2.5]" />
          <span>{{ env === 'sandbox' ? 'Simulasi' : 'Tarik Dana' }}</span>
        </button>
      </div>
    </div>

    <!-- Product Catalog Stats KPI Bar (Flush Canvas, Creem/Polar style) -->
    <div class="-mx-3.5 sm:-mx-4 md:-mx-6 px-3.5 sm:px-4 md:px-6 grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 py-2.5 sm:py-3 border-b border-jetblack/15 mb-0">
      <div class="space-y-0.5">
        <div class="text-xs font-semibold text-jetblack/60 flex items-center gap-1.5">
          <span>Saldo Tersedia (Available)</span>
          <span v-if="env === 'sandbox'" class="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-800 font-bold uppercase">Simulasi</span>
        </div>
        <div class="text-2xl font-bold text-jetblack font-mono tracking-tight">{{ formatRupiah(balanceKPIs.availableBalance) }}</div>
        <div class="text-[11px] text-jetblack/50 font-medium">{{ balanceKPIs.availableCount }} transaksi siap ditarik (Min Rp 50.000)</div>
      </div>

      <div class="space-y-0.5 sm:border-l sm:border-jetblack/10 sm:pl-5">
        <div class="text-xs font-semibold text-jetblack/60">Sedang Diproses</div>
        <div class="text-2xl font-bold text-gold font-mono tracking-tight">{{ formatRupiah(balanceKPIs.processingBalance) }}</div>
        <div class="text-[11px] text-jetblack/50 font-medium">Dalam antrean settlement bank</div>
      </div>

      <div class="space-y-0.5 sm:border-l sm:border-jetblack/10 sm:pl-5">
        <div class="text-xs font-semibold text-jetblack/60">Total Telah Dicairkan</div>
        <div class="text-2xl font-bold text-forest font-mono tracking-tight">{{ formatRupiah(balanceKPIs.totalPaidOut) }}</div>
        <div class="text-[11px] text-jetblack/50 font-medium">{{ balanceKPIs.completedCount }} transfer berhasil ke rekening</div>
      </div>

      <div class="space-y-0.5 sm:border-l sm:border-jetblack/10 sm:pl-5">
        <div class="text-xs font-semibold text-jetblack/60">Fee MoR Tertaut (5%)</div>
        <div class="text-2xl font-bold text-jetblack font-mono tracking-tight">{{ formatRupiah(balanceKPIs.totalFeeMoR) }}</div>
        <div class="text-[11px] text-jetblack/50 font-medium">Biaya platform & pajak terkelola</div>
      </div>
    </div>

    <!-- Edge-to-Edge Table -->
    <div class="-mx-3.5 sm:-mx-4 md:-mx-6 overflow-x-auto top-scrollbar">
      <table class="w-full min-w-full text-left text-xs whitespace-nowrap border-b border-jetblack/15">
        <thead class="border-b border-jetblack/20 text-xs font-semibold text-jetblack/70 bg-white">
          <tr>
            <th class="py-2.5 pr-3 pl-3.5 sm:pl-4 md:pl-6">ID Transaksi / Ref</th>
            <th class="py-2.5 px-3">Produk</th>
            <th class="py-2.5 px-3">Pelanggan</th>
            <th class="py-2.5 px-3">Gross (Rp)</th>
            <th class="py-2.5 px-3">Fee MoR (5%)</th>
            <th class="py-2.5 px-3">Net Payout (95%)</th>
            <th class="py-2.5 px-3">Status Pencairan</th>
            <th class="py-2.5 pl-3 pr-3.5 sm:pr-4 md:pr-6 text-right">Tanggal</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-jetblack/15">
          <tr v-if="filteredLedger.length === 0">
            <td colspan="8" class="py-8 px-3.5 sm:px-4 md:px-6 text-center text-jetblack/40">
              <div class="space-y-1">
                <p class="font-semibold text-xs text-jetblack/60">Tidak ada riwayat saldo ditemukan.</p>
                <p class="text-[11px] text-jetblack/40">
                  Coba sesuaikan filter atau lakukan transaksi penjualan pertama.
                </p>
              </div>
            </td>
          </tr>
          <tr
            v-for="tx in filteredLedger"
            :key="tx.id"
            class="hover:bg-slate-50/70 transition"
          >
            <td class="py-3 pr-3 pl-3.5 sm:pl-4 md:pl-6 font-mono font-bold text-jetblack">
              {{ tx.id }}
            </td>
            <td class="py-3 px-3 font-medium text-jetblack">
              {{ getAppName(tx.appId) }}
            </td>
            <td class="py-3 px-3 text-jetblack/80">
              {{ tx.customerEmail }}
            </td>
            <td class="py-3 px-3 font-mono font-bold text-jetblack">
              {{ formatRupiah(tx.grossAmount) }}
            </td>
            <td class="py-3 px-3 font-mono text-red-600 font-semibold">
              - {{ formatRupiah(tx.platformFee) }}
            </td>
            <td class="py-3 px-3 font-mono font-bold text-forest">
              {{ formatRupiah(tx.netAmount) }}
            </td>
            <td class="py-3 px-3">
              <span
                :class="[
                  'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider',
                  tx.disbursementStatus === 'COMPLETED'
                    ? 'bg-forest/10 text-forest border border-forest/30'
                    : tx.disbursementStatus === 'PROCESSING'
                    ? 'bg-blue-50 text-blue-600 border border-blue-200'
                    : 'bg-gold/15 text-[#8a6d1f] border border-gold/30'
                ]"
              >
                <span
                  class="w-1.5 h-1.5 rounded-full"
                  :class="tx.disbursementStatus === 'COMPLETED' ? 'bg-forest' : tx.disbursementStatus === 'PROCESSING' ? 'bg-blue-500' : 'bg-gold'"
                ></span>
                {{ tx.disbursementStatus === 'COMPLETED' ? 'Dicairkan' : tx.disbursementStatus === 'PROCESSING' ? 'Diproses' : 'Siap Tarik' }}
              </span>
            </td>
            <td class="py-3 pl-3 pr-3.5 sm:pr-4 md:pr-6 text-right text-[11px] text-jetblack/60 font-mono">
              {{ formatDate(tx.paidAt || tx.createdAt) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Request Payout Modal -->
    <div
      v-if="isPayoutModalOpen"
      class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-fadeIn"
      @click.self="closePayoutModal"
    >
      <div class="bg-white border border-jetblack/15 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-scaleIn flex flex-col">
        <!-- Header -->
        <div class="px-5 py-3.5 border-b border-jetblack/10 flex items-center justify-between bg-white shrink-0">
          <div class="flex items-center gap-2">
            <div class="w-2 h-2 rounded-full bg-gold"></div>
            <h3 class="text-xs font-bold uppercase tracking-wider text-jetblack">
              Permintaan Pencairan Saldo
            </h3>
          </div>
          <button
            type="button"
            @click="closePayoutModal"
            class="text-jetblack/40 hover:text-jetblack p-1 rounded-md hover:bg-jetblack/5 transition cursor-pointer"
          >
            <X class="w-4 h-4" />
          </button>
        </div>

        <!-- Body Form -->
        <form @submit.prevent="handleRequestPayout" class="p-5 space-y-4 text-xs">
          <!-- Available Balance Overview Box -->
          <div class="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
            <span class="text-[11px] text-jetblack/60 font-semibold">Saldo Bersih Siap Ditarik</span>
            <div class="text-2xl font-mono font-bold text-jetblack">
              {{ formatRupiah(balanceKPIs.availableBalance) }}
            </div>
            <p class="text-[10px] text-jetblack/50">
              Saldo otomatis didebet dari transaksi yang sudah berstatus lunas.
            </p>
          </div>

          <!-- Nominal Input -->
          <div>
            <div class="flex items-center justify-between mb-1">
              <label class="block font-bold text-jetblack">Jumlah Penarikan (Rp)</label>
              <button
                type="button"
                @click="setMaxPayout"
                class="text-[11px] font-bold text-[#8a6d1f] hover:text-gold cursor-pointer"
              >
                Tarik Semua
              </button>
            </div>
            <div class="relative">
              <span class="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-jetblack/40">Rp</span>
              <input
                v-model.number="payoutAmount"
                type="number"
                min="50000"
                :max="balanceKPIs.availableBalance"
                placeholder="50000"
                required
                class="w-full h-9 pl-9 pr-3 rounded-lg bg-white border border-slate-300 hover:border-slate-400 focus:border-gold focus:ring-2 focus:ring-gold/20 text-xs font-mono font-bold text-jetblack outline-none transition shadow-2xs"
              />
            </div>
            <p class="text-[10px] text-jetblack/50 mt-1">Minimal penarikan dana adalah Rp 50.000.</p>
          </div>

          <!-- Payout Destination Info -->
          <div class="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-start gap-2.5">
            <Building2 class="w-4 h-4 text-gold shrink-0 mt-0.5" />
            <div>
              <div class="font-bold text-jetblack">Rekening Penerima Terverifikasi</div>
              <div class="text-[11px] text-jetblack/60 mt-0.5">
                Dana akan langsung ditransfer ke rekening bank / DANA bisnis yang terdaftar di profil builder Anda.
              </div>
            </div>
          </div>

          <!-- Error Alert -->
          <div v-if="payoutError" class="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
            <AlertCircle class="w-4 h-4 shrink-0" />
            <span>{{ payoutError }}</span>
          </div>

          <!-- Success Alert -->
          <div v-if="payoutSuccess" class="p-3 rounded-lg bg-forest/10 border border-forest/20 text-forest text-xs flex items-center gap-2">
            <CheckCircle2 class="w-4 h-4 shrink-0" />
            <span>{{ payoutSuccess }}</span>
          </div>

          <!-- Actions -->
          <div class="pt-2 flex items-center justify-end gap-2 border-t border-jetblack/10">
            <button
              type="button"
              @click="closePayoutModal"
              class="h-9 px-4 rounded-lg border border-slate-300 hover:bg-slate-100 text-xs font-bold text-jetblack transition cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              :disabled="isSubmittingPayout || balanceKPIs.availableBalance < 50000 || payoutAmount < 50000"
              class="h-9 px-4 btn-gold rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 active:scale-95 shadow-2xs"
            >
              <RefreshCw v-if="isSubmittingPayout" class="w-3.5 h-3.5 animate-spin" />
              <span>{{ isSubmittingPayout ? 'Memproses Payout...' : 'Konfirmasi Payout' }}</span>
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Account Settings Modal -->
    <div
      v-if="isAccountModalOpen"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn"
    >
      <div class="w-full max-w-md bg-white border border-jetblack/15 rounded-2xl shadow-2xl p-5 space-y-4">
        <div class="flex items-center justify-between border-b border-jetblack/10 pb-3">
          <div class="flex items-center gap-2">
            <Building2 class="w-4 h-4 text-gold" />
            <h3 class="text-xs font-bold uppercase tracking-wider text-jetblack">Rekening Pencairan Builder</h3>
          </div>
          <button @click="isAccountModalOpen = false" class="p-1 text-jetblack/40 hover:text-jetblack transition cursor-pointer">
            <X class="w-4 h-4" />
          </button>
        </div>

        <form @submit.prevent="handleSaveAccount" class="space-y-3 text-xs">
          <div>
            <label class="block text-[11px] font-bold text-jetblack/70 mb-1">Nama Bank / Kanal Payout</label>
            <select
              v-model="accountForm.bankCode"
              class="w-full h-9 px-3 rounded-lg bg-slate-50 border border-slate-300 text-xs font-bold text-jetblack outline-none focus:border-gold"
            >
              <option value="BCA">BCA - Bank Central Asia</option>
              <option value="BNI">BNI - Bank Negara Indonesia</option>
              <option value="BRI">BRI - Bank Rakyat Indonesia</option>
              <option value="MANDIRI">Bank Mandiri</option>
              <option value="PERMATA">Bank Permata</option>
              <option value="CIMB">CIMB Niaga</option>
              <option value="DANA">DANA Bisnis / E-Wallet</option>
            </select>
          </div>

          <div>
            <label class="block text-[11px] font-bold text-jetblack/70 mb-1">Nomor Rekening / HP Akun</label>
            <input
              v-model="accountForm.accountNumber"
              type="text"
              placeholder="Contoh: 1234567890"
              required
              class="w-full h-9 px-3 rounded-lg bg-slate-50 border border-slate-300 text-xs font-mono font-bold text-jetblack outline-none focus:border-gold"
            />
          </div>

          <div>
            <label class="block text-[11px] font-bold text-jetblack/70 mb-1">Nama Pemilik Rekening Sesuai Buku Tabungan</label>
            <input
              v-model="accountForm.accountHolderName"
              type="text"
              placeholder="Contoh: PT MAKMUR / NAMA ANDA"
              required
              class="w-full h-9 px-3 rounded-lg bg-slate-50 border border-slate-300 text-xs font-bold text-jetblack outline-none focus:border-gold"
            />
          </div>

          <div v-if="accountFeedback" class="p-2.5 rounded-lg bg-forest/10 border border-forest/20 text-forest text-xs font-bold flex items-center gap-2">
            <CheckCircle2 class="w-4 h-4 shrink-0" />
            <span>{{ accountFeedback }}</span>
          </div>

          <div class="pt-2 flex items-center justify-end gap-2 border-t border-jetblack/10">
            <button
              type="button"
              @click="isAccountModalOpen = false"
              class="h-9 px-4 rounded-lg border border-slate-300 hover:bg-slate-100 text-xs font-bold text-jetblack transition cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              :disabled="isSavingAccount"
              class="h-9 px-4 btn-gold rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw v-if="isSavingAccount" class="w-3.5 h-3.5 animate-spin" />
              <span>Simpan Rekening</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>
