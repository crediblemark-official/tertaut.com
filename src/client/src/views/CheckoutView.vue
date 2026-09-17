<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { api, type AppItem, type TransactionItem } from '../lib/api'
import { dashboardEnv } from '../lib/environment'
import { formatRupiah } from '../lib/utils'
import {
  CreditCard,
  Sparkles,
  ExternalLink,
  Send,
  CheckCircle2
} from 'lucide-vue-next'
import MoRValueProps from '../components/checkout/MoRValueProps.vue'
import DynamicCheckoutForm from '../components/checkout/DynamicCheckoutForm.vue'
import CheckoutResultCard from '../components/checkout/CheckoutResultCard.vue'
import TransactionsLedgerTable from '../components/checkout/TransactionsLedgerTable.vue'
import SearchPicker from '../components/common/SearchPicker.vue'

const appsList = ref<AppItem[]>([])
const selectedAppId = ref('')
const amount = ref(49000)
const customerEmail = ref('')
const grantDays = ref(30)
const loading = ref(false)
const disburseLoading = ref<string | null>(null)
const disburseAlert = ref<string | null>(null)

const checkoutResult = ref<{
  success: boolean
  checkoutUrl?: string
  transactionId?: string
  amount?: number
  platformFee?: number
  netDisbursementAmount?: number
} | null>(null)

const transactions = ref<TransactionItem[]>([])
const loadingTxs = ref(false)
const searchQuery = ref('')
const statusFilter = ref<'ALL' | 'PAID' | 'PENDING'>('ALL')
const simulatingTxId = ref<string | null>(null)

const currentApp = computed(() => {
  return appsList.value.find(a => a.id === selectedAppId.value)
})

async function loadAppsAndTransactions() {
  try {
    const appsRes = await api.getApps()
    appsList.value = appsRes.apps || []
    if (appsRes.apps && appsRes.apps.length > 0) {
      selectedAppId.value = appsRes.apps[0].id
      amount.value = appsRes.apps[0].targetPrice || 49000
    }
  } catch (e) {
    console.error('Failed to load apps:', e)
  }

  await loadTransactions()
}

function onAppChange() {
  if (currentApp.value) {
    amount.value = currentApp.value.targetPrice || 49000
  }
}

async function loadTransactions() {
  loadingTxs.value = true
  try {
    const res = await api.getTransactions()
    transactions.value = res.transactions || []
  } catch (e) {
    console.error('Failed to load transactions:', e)
  } finally {
    loadingTxs.value = false
  }
}



async function createCheckout() {
  if (!selectedAppId.value) return
  loading.value = true
  try {
    const res = await api.createCheckoutSession({
      appId: selectedAppId.value,
      amount: amount.value,
      customerEmail: customerEmail.value,
      grantDays: grantDays.value
    })
    checkoutResult.value = res
    await loadTransactions()
  } finally {
    loading.value = false
  }
}

async function handleSimulatePayment(tx: TransactionItem) {
  simulatingTxId.value = tx.id
  disburseAlert.value = null
  try {
    const res = await api.simulatePayment(tx.id)
    if (res.success) {
      disburseAlert.value = `Berhasil! Pembayaran ${tx.id} disimulasikan lunas. Lisensi ${res.licenseKey || ''} berhasil diterbitkan.`
    } else {
      disburseAlert.value = `Info: ${res.message}`
    }
    await loadTransactions()
  } catch (err: any) {
    disburseAlert.value = `Error: ${err.message || 'Gagal simulasi pembayaran.'}`
  } finally {
    simulatingTxId.value = null
  }
}

async function triggerDisbursement(tx: TransactionItem) {
  disburseLoading.value = tx.id
  disburseAlert.value = null
  try {
    const res = await api.disburseTransaction(tx.id)
    if (res.success) {
      disburseAlert.value = `Berhasil! Pencairan ${formatRupiah(tx.netAmount)} untuk transaksi ${tx.id} berhasil diproses ke rekening builder via API Xendit.`
    } else {
      disburseAlert.value = `Info: ${res.error || res.message}`
    }
    await loadTransactions()
  } catch (err: any) {
    disburseAlert.value = `Error: ${err.message || 'Gagal memproses pencairan.'}`
  } finally {
    disburseLoading.value = null
  }
}

async function triggerBatchPayout() {
  disburseLoading.value = 'all'
  disburseAlert.value = null
  try {
    const res = await api.triggerPayout()
    if (res.success) {
      disburseAlert.value = `Berhasil! Pencairan ${formatRupiah(res.data.amount)} berhasil diproses ke rekening ${res.data.bankCode} (${res.data.recipientName}) via Xendit API.`
    } else {
      disburseAlert.value = `Info: ${res.error || res.message}`
    }
    await loadTransactions()
  } catch (err: any) {
    disburseAlert.value = `Error: ${err.message || 'Gagal memproses payout.'}`
  } finally {
    disburseLoading.value = null
  }
}

const totalPendingPayout = computed(() => {
  return transactions.value
    .filter(t => t.paymentStatus === 'PAID' && t.disbursementStatus === 'PENDING')
    .reduce((sum, t) => sum + t.netAmount, 0)
})

onMounted(() => {
  loadAppsAndTransactions()
})

// Muat ulang saat environment Live/Sandbox berganti
watch(dashboardEnv, () => {
  checkoutResult.value = null
  loadAppsAndTransactions()
})
</script>

<template>
  <div class="space-y-6 animate-fadeIn pb-16">
    <!-- Compact Action Bar -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-1 border-b border-[#111111]/10">
      <div class="flex items-center gap-2">
        <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#D4AF37]/15 border border-[#D4AF37]/35 text-[#111111] text-xs font-bold">
          <CreditCard class="w-3.5 h-3.5 text-[#D4AF37]" />
          <span>Xendit MoR Rail</span>
        </span>
        <span class="text-xs text-[#111111]/50 font-medium hidden sm:inline">
          QRIS, VA &amp; E-Wallet • 95% Net Payout
        </span>
      </div>

      <!-- App Selector Dropdown & Batch Disburse -->
      <div class="flex items-center gap-2">
        <div v-if="appsList.length > 0" class="flex items-center gap-1.5">
          <SearchPicker
            v-model="selectedAppId"
            :items="appsList"
            @change="onAppChange"
            placeholder="Pilih aplikasi..."
            search-placeholder="Cari software..."
          />
        </div>

        <button
          v-if="totalPendingPayout >= 50000 && dashboardEnv === 'live'"
          @click="triggerBatchPayout"
          :disabled="disburseLoading === 'all'"
          class="px-3 py-1.5 rounded-lg bg-[#0F4C3A] text-white text-xs font-bold hover:bg-[#0F4C3A]/90 transition shadow-sm flex items-center gap-1 cursor-pointer active:scale-95 disabled:opacity-50"
        >
          <Send class="w-3 h-3" />
          <span>Cairkan Semua ({{ formatRupiah(totalPendingPayout) }})</span>
        </button>
      </div>
    </div>

    <!-- Quick Hosted Checkout Link (FR-1.1) -->
    <div v-if="currentApp" class="p-3.5 rounded-xl bg-[#D4AF37]/10 border border-[#D4AF37]/35 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
      <div class="flex items-center gap-2 text-xs">
        <Sparkles class="w-4 h-4 text-[#D4AF37] shrink-0" />
        <div>
          <span class="font-bold text-[#111111]">Tautan Pembayaran Publik (Hosted Checkout Link):</span>
          <span class="font-mono text-[#D4AF37] ml-1.5 font-bold">tertaut.com/pay/{{ currentApp.slug }}</span>
        </div>
      </div>

      <div class="flex items-center gap-2 shrink-0">
        <router-link
          :to="`/pay/${currentApp.slug}`"
          target="_blank"
          class="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#111111] text-[#D4AF37] text-xs font-bold hover:bg-[#222222] transition"
        >
          <span>Uji Halaman Bayar</span>
          <ExternalLink class="w-3 h-3" />
        </router-link>
      </div>
    </div>

    <!-- MoR Value Proposition Cards Component -->
    <MoRValueProps />

    <!-- Dynamic Checkout Generator & Result Grid -->
    <div class="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-[#111111]/10 border-t border-b border-[#111111]/10 py-6">
      <!-- Checkout Generator Form Component -->
      <div class="pb-6 lg:pb-0 pr-0 lg:pr-6">
        <DynamicCheckoutForm
          :loading="loading"
          v-model:amount="amount"
          v-model:customer-email="customerEmail"
          v-model:grant-days="grantDays"
          @create-checkout="createCheckout"
        />
      </div>

      <!-- Checkout Output Card Component -->
      <div class="pt-6 lg:pt-0 pl-0 lg:pl-6">
        <CheckoutResultCard :checkout-result="checkoutResult" />
      </div>
    </div>

    <!-- Alert Disbursement Banner -->
    <div
      v-if="disburseAlert"
      class="p-3 rounded-xl bg-[#0F4C3A]/10 border border-[#0F4C3A]/25 text-[#0F4C3A] text-xs font-bold flex items-center justify-between"
    >
      <div class="flex items-center gap-1.5">
        <CheckCircle2 class="w-4 h-4 shrink-0" />
        <span>{{ disburseAlert }}</span>
      </div>
      <button @click="disburseAlert = null" class="text-xs underline cursor-pointer">Tutup</button>
    </div>

    <!-- Transactions & Disbursement Ledger Table Component -->
    <TransactionsLedgerTable
      :transactions="transactions"
      :loading-txs="loadingTxs"
      :simulating-tx-id="simulatingTxId"
      :disburse-loading="disburseLoading"
      :is-sandbox="dashboardEnv === 'sandbox'"
      v-model:search-query="searchQuery"
      v-model:status-filter="statusFilter"
      @refresh="loadTransactions"
      @simulate-payment="handleSimulatePayment"
      @disburse="triggerDisbursement"
    />
  </div>
</template>
