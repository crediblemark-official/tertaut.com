<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { api } from '../lib/api'
import type { AppItem } from '../types/app'
import { dashboardEnv, envPath } from '../lib/environment'
import {
  Sparkles,
  ExternalLink,
  Receipt,
  Copy,
  Check,
  ArrowUpRight,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-vue-next'
import DynamicCheckoutForm from '../components/checkout/DynamicCheckoutForm.vue'
import CheckoutResultCard from '../components/checkout/CheckoutResultCard.vue'
import PaymentsLedger from '../components/payments/PaymentsLedger.vue'
import { useClipboard } from '../composables/useClipboard'

const appsList = ref<AppItem[]>([])
const otherEnvApps = ref<AppItem[]>([])
const selectedAppId = ref('')
const amount = ref<number | string>(0)
const customerEmail = ref('')
const grantDays = ref<number | string>(30)
const loading = ref(false)
const disburseAlert = ref<string | null>(null)
const paymentsLedgerRef = ref<InstanceType<typeof PaymentsLedger> | null>(null)

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

const currentApp = computed(() => {
  return appsList.value.find(a => a.id === selectedAppId.value)
})

watch(selectedAppId, (newId) => {
  const matched = appsList.value.find(a => a.id === newId)
  if (matched) {
    amount.value = matched.targetPrice || 0
  }
})

async function loadApps() {
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
}

async function handleMigrateApp(app: AppItem) {
  try {
    loading.value = true
    disburseAlert.value = null
    const targetMode = dashboardEnv.value === 'sandbox' ? 'sandbox' : 'live'
    await api.updateAppMode(app.id, targetMode)
    await loadApps()
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
      paymentsLedgerRef.value?.refresh()
    } else {
      disburseAlert.value = `Error: ${res?.error || 'Gagal membuat sesi checkout.'}`
    }
  } catch (err: any) {
    disburseAlert.value = `Error: ${err.message || 'Gagal membuat sesi checkout.'}`
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadApps()
})

// Muat ulang saat environment Live/Sandbox berganti
watch(dashboardEnv, () => {
  checkoutResult.value = null
  loadApps()
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
          <span>Riwayat Transaksi & Pembayaran</span>
        </button>
      </div>

      <div class="flex items-center gap-2">
        <router-link
          :to="envPath(dashboardEnv, '/payments')"
          class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition"
          title="Buka Halaman Payments Terpadu"
        >
          <span>Halaman Penuh Payments</span>
          <ArrowUpRight class="w-3 h-3 text-gold" />
        </router-link>
      </div>
    </div>

    <!-- Unified Alert Banner -->
    <div v-if="disburseAlert"
      :class="[
        'p-3 rounded-lg text-xs font-bold flex items-center justify-between transition animate-fadeIn mb-3',
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

    <!-- TAB 2: UNIFIED TRANSACTIONS & PAYMENTS LEDGER -->
    <div v-else-if="activeTab === 'history'" class="space-y-3.5 animate-fadeIn">
      <PaymentsLedger ref="paymentsLedgerRef" />
    </div>
  </div>
</template>
