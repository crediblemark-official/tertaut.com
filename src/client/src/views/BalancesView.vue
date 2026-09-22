<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { api } from '../lib/api'
import type { TransactionItem } from '../types/transaction'
import { dashboardEnv } from '../lib/environment'
import { formatRupiah } from '../lib/utils'
import {
  AlertCircle,
  RefreshCw,
  Building2,
  X,
  Send,
  Search,
  Landmark,
  CheckCircle2,
  ArrowDownLeft,
} from 'lucide-vue-next'

const env = dashboardEnv
const loading = ref(false)
const transactions = ref<TransactionItem[]>([])

const isPayoutModalOpen = ref(false)
const payoutAmount = ref<number>(0)
const isSubmittingPayout = ref(false)
const payoutError = ref<string | null>(null)
const payoutSuccess = ref<string | null>(null)

const disbSearchQuery = ref('')

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
    const [txRes] = await Promise.all([
      api.getTransactions(),
    ])
    transactions.value = txRes.transactions || []
    await loadAccountData()
  } catch (err) {
    console.error('Gagal memuat data balances:', err)
  } finally {
    loading.value = false
  }
}

onMounted(loadData)
watch(env, loadData)

// ── KPI ──────────────────────────────────────────────────────────
const balanceKPIs = computed(() => {
  const paidTxs = transactions.value.filter(t => t.paymentStatus === 'PAID')

  const availableTxs = paidTxs.filter(t => t.disbursementStatus === 'PENDING' || !t.disbursementStatus)
  const availableBalance = availableTxs.reduce((acc, t) => acc + (t.netAmount || 0), 0)

  const processingTxs = paidTxs.filter(t => t.disbursementStatus === 'PROCESSING')
  const processingBalance = processingTxs.reduce((acc, t) => acc + (t.netAmount || 0), 0)

  const completedTxs = paidTxs.filter(t => t.disbursementStatus === 'COMPLETED')
  const totalPaidOut = completedTxs.reduce((acc, t) => acc + (t.netAmount || 0), 0)

  const totalFeeMoR = paidTxs.reduce((acc, t) => acc + (t.platformFee || 0), 0)

  return {
    availableBalance,
    processingBalance,
    totalPaidOut,
    totalFeeMoR,
    availableCount: availableTxs.length,
  }
})

// ── Disbursement groups (COMPLETED + PROCESSING) ──────────────────
interface DisbursementGroup {
  disbursementId: string
  status: 'COMPLETED' | 'PROCESSING'
  totalNet: number
  latestDate: string | null
}

const disbursementGroups = computed((): DisbursementGroup[] => {
  const paidTxs = transactions.value.filter(t => t.paymentStatus === 'PAID')
  const disbursed = paidTxs.filter(t =>
    (t.disbursementStatus === 'COMPLETED' || t.disbursementStatus === 'PROCESSING') &&
    t.disbursementId
  )

  const map = new Map<string, DisbursementGroup>()
  for (const tx of disbursed) {
    const key = tx.disbursementId!
    if (!map.has(key)) {
      map.set(key, {
        disbursementId: key,
        status: tx.disbursementStatus as 'COMPLETED' | 'PROCESSING',
        totalNet: 0,
        latestDate: null,
      })
    }
    const g = map.get(key)!
    g.totalNet += tx.netAmount || 0
    const d = tx.paidAt || tx.createdAt
    if (d && (!g.latestDate || d > g.latestDate)) g.latestDate = d
  }

  const q = disbSearchQuery.value.toLowerCase().trim()
  let groups = [...map.values()]
  if (q) {
    groups = groups.filter(g => g.disbursementId.toLowerCase().includes(q))
  }

  return groups.sort((a, b) => {
    if (!a.latestDate) return 1
    if (!b.latestDate) return -1
    return b.latestDate.localeCompare(a.latestDate)
  })
})

// ── Helpers ────────────────────────────────────────────────────────
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
    <!-- Unified Header & Toolbar -->
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
          :title="env === 'sandbox' ? 'Pencairan dana hanya tersedia di mode LIVE' : 'Tarik Saldo Tersedia'"
        >
          <Send class="w-3.5 h-3.5 stroke-[2.5]" />
          <span>{{ env === 'sandbox' ? 'Simulasi' : 'Tarik Dana' }}</span>
        </button>
      </div>
    </div>

    <!-- KPI Bar -->
    <div class="-mx-3.5 sm:-mx-4 md:-mx-6 px-3.5 sm:px-4 md:px-6 grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 py-2.5 sm:py-3 border-b border-jetblack/15 mb-0">
      <div class="space-y-0.5">
        <div class="text-xs font-semibold text-jetblack/60 flex items-center gap-1.5">
          <span>Saldo Tersedia</span>
          <span v-if="env === 'sandbox'" class="text-[9px] px-1.5 rounded bg-amber-500/15 text-amber-800 font-bold uppercase">Simulasi</span>
        </div>
        <div class="text-2xl font-bold text-jetblack font-mono tracking-tight">{{ formatRupiah(balanceKPIs.availableBalance) }}</div>
        <div class="text-[11px] text-jetblack/50 font-medium">Dari {{ balanceKPIs.availableCount }} penjualan · Min tarik Rp 50.000</div>
      </div>

      <div class="space-y-0.5 sm:border-l sm:border-jetblack/10 sm:pl-5">
        <div class="text-xs font-semibold text-jetblack/60">Sedang Diproses</div>
        <div class="text-2xl font-bold text-gold font-mono tracking-tight">{{ formatRupiah(balanceKPIs.processingBalance) }}</div>
        <div class="text-[11px] text-jetblack/50 font-medium">Dalam antrean settlement bank</div>
      </div>

      <div class="space-y-0.5 sm:border-l sm:border-jetblack/10 sm:pl-5">
        <div class="text-xs font-semibold text-jetblack/60">Total Telah Dicairkan</div>
        <div class="text-2xl font-bold text-forest font-mono tracking-tight">{{ formatRupiah(balanceKPIs.totalPaidOut) }}</div>
        <div class="text-[11px] text-jetblack/50 font-medium">{{ disbursementGroups.length }} batch transfer ke rekening</div>
      </div>

      <div class="space-y-0.5 sm:border-l sm:border-jetblack/10 sm:pl-5">
        <div class="text-xs font-semibold text-jetblack/60">Fee MoR Tertaut (5%)</div>
        <div class="text-2xl font-bold text-jetblack font-mono tracking-tight">{{ formatRupiah(balanceKPIs.totalFeeMoR) }}</div>
        <div class="text-[11px] text-jetblack/50 font-medium">Biaya platform & pajak terkelola</div>
      </div>
    </div>

    <!-- Available Balance Card (sandbox notice or CTA) -->
    <div
      v-if="balanceKPIs.availableBalance > 0"
      class="-mx-3.5 sm:-mx-4 md:-mx-6 px-3.5 sm:px-4 md:px-6 py-3 border-b border-jetblack/10"
    >
      <div
        class="rounded-xl border flex items-center justify-between gap-4 px-4 py-3"
        :class="env === 'sandbox' ? 'bg-amber-50 border-amber-200' : 'bg-forest/5 border-forest/20'"
      >
        <div class="flex items-center gap-3">
          <div
            class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            :class="env === 'sandbox' ? 'bg-amber-100' : 'bg-forest/10'"
          >
            <ArrowDownLeft :class="env === 'sandbox' ? 'w-4 h-4 text-amber-600' : 'w-4 h-4 text-forest'" />
          </div>
          <div>
            <div class="text-xs font-bold text-jetblack">
              {{ env === 'sandbox' ? 'Saldo Simulasi Tersedia' : 'Saldo Siap Ditarik ke Rekening' }}
            </div>
            <div class="text-[11px] text-jetblack/60 mt-0.5">
              {{ env === 'sandbox'
                ? 'Di mode sandbox, saldo bersifat simulasi dan tidak dapat dicairkan.'
                : `${formatRupiah(balanceKPIs.availableBalance)} bersih setelah potongan fee 5%. Klik "Tarik Dana" untuk mencairkan.`
              }}
            </div>
          </div>
        </div>
        <button
          v-if="env !== 'sandbox'"
          type="button"
          @click="openPayoutModal"
          class="btn-gold shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition shadow-2xs cursor-pointer active:scale-95"
        >
          <Send class="w-3.5 h-3.5 stroke-[2.5]" />
          Tarik Dana
        </button>
      </div>
    </div>

    <!-- Section: Riwayat Pencairan -->
    <div class="-mx-3.5 sm:-mx-4 md:-mx-6 px-3.5 sm:px-4 md:px-6 flex items-center justify-between py-1.5 border-b border-jetblack/10">
      <div class="flex items-center gap-2">
        <Landmark class="w-3.5 h-3.5 text-jetblack/50" />
        <span class="text-[11px] font-bold uppercase tracking-wider text-jetblack/60">Riwayat Pencairan</span>
        <span class="text-[10px] px-1.5 py-0.5 rounded-full bg-jetblack/8 text-jetblack/60 font-mono font-bold">
          {{ disbursementGroups.length }} batch
        </span>
      </div>
      <div class="relative w-64">
        <Search class="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-jetblack/30 pointer-events-none" />
        <input
          v-model="disbSearchQuery"
          type="text"
          placeholder="Cari ID pencairan..."
          class="w-full pl-7 pr-2.5 py-1 rounded-lg bg-jetblack/5 border border-jetblack/12 text-[11px] text-jetblack placeholder:text-jetblack/30 focus:outline-none focus:border-gold/60 transition"
        />
      </div>
    </div>

    <div class="-mx-3.5 sm:-mx-4 md:-mx-6 overflow-x-auto top-scrollbar">
      <table class="w-full min-w-full text-left text-xs whitespace-nowrap border-b border-jetblack/15">
        <thead class="border-b border-jetblack/20 text-xs font-semibold text-jetblack/70 bg-white">
          <tr>
            <th class="py-2.5 pr-3 pl-3.5 sm:pl-4 md:pl-6">ID Pencairan</th>
            <th class="py-2.5 px-3">Total Dicairkan (Net)</th>
            <th class="py-2.5 px-3">Status</th>
            <th class="py-2.5 pl-3 pr-3.5 sm:pr-4 md:pr-6 text-right">Tanggal</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-jetblack/15">
          <tr v-if="disbursementGroups.length === 0 && !loading">
            <td colspan="4" class="py-10 px-3.5 sm:px-4 md:px-6 text-center">
              <div class="space-y-2">
                <Landmark class="w-7 h-7 text-jetblack/20 mx-auto" />
                <p class="font-semibold text-xs text-jetblack/50">Belum ada riwayat pencairan.</p>
                <p class="text-[11px] text-jetblack/35">
                  Pencairan akan muncul di sini setelah Anda menarik saldo ke rekening bank.
                </p>
              </div>
            </td>
          </tr>

          <tr v-if="loading">
            <td colspan="4" class="py-8 text-center text-jetblack/40 text-xs">Memuat data...</td>
          </tr>

          <tr
            v-for="group in disbursementGroups"
            :key="group.disbursementId"
            class="hover:bg-slate-50/80 transition"
          >
            <td class="py-3 pr-3 pl-3.5 sm:pl-4 md:pl-6 font-mono font-bold text-jetblack text-[11px]">
              {{ group.disbursementId }}
            </td>
            <td class="py-3 px-3 font-mono font-bold text-forest text-sm">
              {{ formatRupiah(group.totalNet) }}
            </td>
            <td class="py-3 px-3">
              <span
                :class="[
                  'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider',
                  group.status === 'COMPLETED'
                    ? 'bg-forest/10 text-forest border border-forest/30'
                    : 'bg-blue-50 text-blue-600 border border-blue-200'
                ]"
              >
                <span
                  class="w-1.5 h-1.5 rounded-full"
                  :class="group.status === 'COMPLETED' ? 'bg-forest' : 'bg-blue-500'"
                ></span>
                {{ group.status === 'COMPLETED' ? 'Dicairkan' : 'Diproses' }}
              </span>
            </td>
            <td class="py-3 pl-3 pr-3.5 sm:pr-4 md:pr-6 text-right text-[11px] text-jetblack/60 font-mono">
              {{ formatDate(group.latestDate) }}
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

        <form @submit.prevent="handleRequestPayout" class="p-5 space-y-4 text-xs">
          <!-- Saldo Tersedia -->
          <div class="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
            <span class="text-[11px] text-jetblack/60 font-semibold">Saldo Bersih Siap Ditarik</span>
            <div class="text-2xl font-mono font-bold text-jetblack">
              {{ formatRupiah(balanceKPIs.availableBalance) }}
            </div>
            <p class="text-[10px] text-jetblack/50">
              Total akumulasi penjualan setelah potongan fee platform 5%.
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

          <!-- Payout Destination -->
          <div class="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-start gap-2.5">
            <Building2 class="w-4 h-4 text-gold shrink-0 mt-0.5" />
            <div>
              <div class="font-bold text-jetblack">Rekening Penerima Terverifikasi</div>
              <div class="text-[11px] text-jetblack/60 mt-0.5">
                Dana akan langsung ditransfer ke rekening bank / DANA bisnis yang terdaftar di profil builder Anda.
              </div>
            </div>
          </div>

          <div v-if="payoutError" class="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
            <AlertCircle class="w-4 h-4 shrink-0" />
            <span>{{ payoutError }}</span>
          </div>

          <div v-if="payoutSuccess" class="p-3 rounded-lg bg-forest/10 border border-forest/20 text-forest text-xs flex items-center gap-2">
            <CheckCircle2 class="w-4 h-4 shrink-0" />
            <span>{{ payoutSuccess }}</span>
          </div>

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
