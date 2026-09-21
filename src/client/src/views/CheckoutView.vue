<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { api } from '../lib/api'
import type { AppItem } from '../types/app'
import type { TransactionItem } from '../types/transaction'
import { dashboardEnv, envPath } from '../lib/environment'
import { formatRupiah } from '../lib/utils'
import {
  Sparkles,
  ExternalLink,
  Send,
  CheckCircle2,
  Receipt,
  Copy,
  Check,
  ArrowUpRight,
  AlertTriangle,
} from 'lucide-vue-next'
import DynamicCheckoutForm from '../components/checkout/DynamicCheckoutForm.vue'
import CheckoutResultCard from '../components/checkout/CheckoutResultCard.vue'
import TransactionsLedgerTable from '../components/checkout/TransactionsLedgerTable.vue'
import { useClipboard } from '../composables/useClipboard'

const appsList = ref<AppItem[]>([])
const otherEnvApps = ref<AppItem[]>([])
const selectedAppId = ref('')
const amount = ref<number | string>(0)
const customerEmail = ref('')
const grantDays = ref<number | string>(30)
const loading = ref(false)
const disburseLoading = ref<string | null>(null)
const disburseAlert = ref<string | null>(null)

const { copied: hostedCopied, copy: copyClipboard } = useClipboard()

function copyHostedLink() {
  if (currentApp.value?.slug) {
    const url = `${window.location.origin}/pay/${currentApp.value.slug}`
    copyClipboard(url)
  }
}

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

watch(selectedAppId, (newId) => {
  const matched = appsList.value.find(a => a.id === newId)
  if (matched) {
    amount.value = matched.targetPrice || 0
  }
})

async function loadAppsAndTransactions() {
  try {
    const appsRes = await api.getApps()
    appsList.value = appsRes.apps || []
    if (appsRes.apps && appsRes.apps.length > 0) {
      selectedAppId.value = appsRes.apps[0].id
      amount.value = appsRes.apps[0].targetPrice || 0
      otherEnvApps.value = []
    } else {
      try {
        const otherMode = dashboardEnv.value === 'sandbox' ? 'live' : 'sandbox'
        const otherRes = await api.getApps(otherMode)
        otherEnvApps.value = otherRes.apps || []
      } catch {}
    }
    if (!customerEmail.value) {
      try {
        const me = await api.getBuilderMyself()
        if (me?.builder?.email) {
          customerEmail.value = me.builder.email
        }
      } catch {}
    }
  } catch (e) {
    console.error('Failed to load apps:', e)
  }

  await loadTransactions()
}

async function handleMigrateApp(app: AppItem) {
  try {
    loading.value = true
    disburseAlert.value = null
    const targetMode = dashboardEnv.value === 'sandbox' ? 'sandbox' : 'live'
    await api.updateAppMode(app.id, targetMode)
    await loadAppsAndTransactions()
    disburseAlert.value = `Berhasil memindahkan "${app.name}" ke mode ${targetMode.toUpperCase()}.`
  } catch (err: any) {
    disburseAlert.value = `Gagal mengubah mode software: ${err?.message || err}`
  } finally {
    loading.value = false
  }
}

function onAppChange() {
  if (currentApp.value) {
    amount.value = currentApp.value.targetPrice || 0
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
  if (!selectedAppId.value) {
    disburseAlert.value = 'Peringatan: Silakan buat atau pilih software terlebih dahulu sebelum membuat link checkout.'
    return
  }
  if (!customerEmail.value || !customerEmail.value.includes('@')) {
    disburseAlert.value = 'Peringatan: Silakan masukkan email pembeli yang valid (contoh: buyer@example.com).'
    return
  }
  loading.value = true
  disburseAlert.value = null
  try {
    const res = await api.createCheckoutSession({
      appId: selectedAppId.value,
      amount: Number(amount.value) || 0,
      customerEmail: customerEmail.value.trim(),
      grantDays: Number(grantDays.value) || 30
    })
    if (res && res.success !== false) {
      checkoutResult.value = res
      await loadTransactions()
    } else {
      disburseAlert.value = `Error: ${res?.error || 'Gagal membuat sesi checkout.'}`
    }
  } catch (err: any) {
    disburseAlert.value = `Error: ${err.message || 'Gagal membuat sesi checkout.'}`
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
      disburseAlert.value = `Berhasil! Pencairan ${formatRupiah(tx.netAmount)} untuk transaksi ${tx.id} berhasil diproses ke rekening builder via DANA Transfer to Bank.`
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
    if (res && res.success && res.data) {
      disburseAlert.value = `Berhasil! Pencairan ${formatRupiah(res.data.amount)} berhasil diproses ke rekening ${res.data.bankCode} (${res.data.recipientName}) via DANA Transfer to Bank.`
    } else {
      disburseAlert.value = `Info: ${res?.error || res?.message || 'Pencairan berhasil diproses.'}`
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
const activeTab = ref<'generator' | 'history'>('generator')
</script>

<template>
  <div class="animate-fadeIn pb-8">
    <!-- Unified Header & Toolbar (Edge-to-Edge Full Width & Standardized Height) -->
    <div class="-mx-3.5 sm:-mx-4 md:-mx-6 px-3.5 sm:px-4 md:px-6 min-h-[44px] py-1.5 sm:py-0 bg-jetblack text-white border-b border-jetblack flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-xs mb-3">
      <div class="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
        <button type="button" @click="activeTab = 'generator'" :class="[
          'flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer',
          activeTab === 'generator'
            ? 'bg-white/20 text-white shadow-2xs'
            : 'text-white/60 hover:text-white hover:bg-white/10'
        ]">
          <Sparkles class="w-3.5 h-3.5" :class="activeTab === 'generator' ? 'text-gold' : ''" />
          <span>Buat Sesi Checkout</span>
        </button>

        <button type="button" @click="activeTab = 'history'" :class="[
          'flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer',
          activeTab === 'history'
            ? 'bg-white/20 text-white shadow-2xs'
            : 'text-white/60 hover:text-white hover:bg-white/10'
        ]">
          <Receipt class="w-3.5 h-3.5" :class="activeTab === 'history' ? 'text-gold' : ''" />
          <span>Riwayat Transaksi</span>
          <span :class="[
            'px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold',
            activeTab === 'history' ? 'bg-white text-jetblack' : 'bg-white/10 text-white'
          ]">
            {{ transactions.length }}
          </span>
        </button>
      </div>

      <!-- Batch Disburse if live & pending -->
      <div v-if="totalPendingPayout >= 50000 && dashboardEnv === 'live'">
        <button @click="triggerBatchPayout" :disabled="disburseLoading === 'all'"
          class="px-2.5 py-1 rounded-lg bg-forest text-white text-xs font-bold hover:bg-forest/90 transition shadow-2xs flex items-center gap-1 cursor-pointer active:scale-95 disabled:opacity-50">
          <Send class="w-3 h-3" />
          <span>Cairkan Semua ({{ formatRupiah(totalPendingPayout) }})</span>
        </button>
      </div>
    </div>

    <!-- Unified Alert Banner (Visible on all tabs) -->
    <div v-if="disburseAlert"
      :class="[
        'p-3 rounded-lg text-xs font-bold flex items-center justify-between transition animate-fadeIn',
        disburseAlert.startsWith('Error') || disburseAlert.startsWith('Peringatan') || disburseAlert.startsWith('Silakan')
          ? 'bg-amber-50 border border-amber-200 text-amber-900'
          : 'bg-forest/10 border border-forest/25 text-forest'
      ]">
      <div class="flex items-center gap-2">
        <component
          :is="disburseAlert.startsWith('Error') || disburseAlert.startsWith('Peringatan') || disburseAlert.startsWith('Silakan') ? AlertTriangle : CheckCircle2"
          class="w-4 h-4 shrink-0"
        />
        <span>{{ disburseAlert }}</span>
      </div>
      <button @click="disburseAlert = null" class="text-xs underline cursor-pointer ml-3 shrink-0">Tutup</button>
    </div>

    <!-- TAB 1: DYNAMIC CHECKOUT GENERATOR & HOSTED LINK -->
    <div v-if="activeTab === 'generator'" class="space-y-3.5 animate-fadeIn">
      <!-- Quick Hosted Checkout Link (FR-1.1) - Compact Bar -->
      <div v-if="currentApp"
        class="px-3 py-1.5 rounded-lg bg-gold/10 border border-gold/35 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
        <div class="flex items-center gap-2 truncate">
          <Sparkles class="w-3.5 h-3.5 text-gold shrink-0" />
          <div class="truncate">
            <span class="font-bold text-jetblack">Tautan Publik:</span>
            <span class="font-mono text-gold ml-1.5 font-bold">tertaut.com/pay/{{ currentApp.slug }}</span>
          </div>
        </div>

        <div class="flex items-center gap-1.5 shrink-0">
          <button type="button" @click="copyHostedLink"
            class="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white border border-gold/40 text-jetblack text-[11px] font-semibold hover:bg-slate-50 transition cursor-pointer shadow-2xs"
            title="Salin Tautan Publik">
            <component :is="hostedCopied ? Check : Copy" class="w-3 h-3"
              :class="hostedCopied ? 'text-emerald-600' : 'text-gold'" />
            <span>{{ hostedCopied ? 'Tersalin' : 'Salin' }}</span>
          </button>

          <router-link :to="`/pay/${currentApp.slug}`" target="_blank"
            class="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-jetblack text-gold text-[11px] font-bold hover:bg-jetblack-hover transition cursor-pointer shadow-2xs">
            <span>Uji Halaman</span>
            <ExternalLink class="w-3 h-3" />
          </router-link>
        </div>
      </div>

      <!-- Dynamic Checkout Generator & Result Grid (with Separator Line) -->
      <div class="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-jetblack/10 border-t border-jetblack/10 pt-3.5">
        <!-- Checkout Generator Form Component -->
        <div class="lg:col-span-7 pb-4 lg:pb-0 pr-0 lg:pr-6">
          <DynamicCheckoutForm :loading="loading" :apps-list="appsList" :other-env-apps="otherEnvApps" v-model:selected-app-id="selectedAppId"
            v-model:amount="amount" v-model:customer-email="customerEmail" v-model:grant-days="grantDays"
            @app-change="onAppChange" @create-checkout="createCheckout" @migrate-app="handleMigrateApp" />
        </div>

        <!-- Checkout Output Card Component -->
        <div class="lg:col-span-5 pt-4 lg:pt-0 pl-0 lg:pl-6 flex flex-col">
          <CheckoutResultCard :checkout-result="checkoutResult" />
        </div>
      </div>
    </div>

    <!-- TAB 2: TRANSACTIONS & DISBURSEMENTS -->
    <div v-else-if="activeTab === 'history'" class="space-y-3.5 animate-fadeIn">
      <!-- Role Clarification Notice -->
      <div class="p-2.5 rounded-lg bg-jetblack/[0.03] border border-jetblack/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
        <span class="text-jetblack/70">Untuk pelacakan transaksi terpusat, filter status lengkap (PAID, PENDING, EXPIRED, FAILED), dan ekspor:</span>
        <router-link :to="envPath(dashboardEnv, '/payments')" class="font-bold text-gold hover:underline inline-flex items-center gap-1 shrink-0">
          <span>Buka Menu Payments</span>
          <ArrowUpRight class="w-3.5 h-3.5" />
        </router-link>
      </div>



      <!-- Transactions & Disbursement Ledger Table Component -->
      <TransactionsLedgerTable :transactions="transactions" :loading-txs="loadingTxs" :simulating-tx-id="simulatingTxId"
        :disburse-loading="disburseLoading" :is-sandbox="dashboardEnv === 'sandbox'" v-model:search-query="searchQuery"
        v-model:status-filter="statusFilter" @refresh="loadTransactions" @simulate-payment="handleSimulatePayment"
        @disburse="triggerDisbursement" />
    </div>
  </div>
</template>
