<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import {
  api,
  type PortalLicenseItem,
  type PortalTransactionItem
} from '../lib/api'
import {
  KeyRound,
  ShieldCheck,
  Receipt,
  ChevronRight,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle
} from 'lucide-vue-next'
import PortalSearchHero from '../components/portal/PortalSearchHero.vue'
import CustomerLicenseCard from '../components/portal/CustomerLicenseCard.vue'
import CustomerTransactionTable from '../components/portal/CustomerTransactionTable.vue'
import OfflineJwtModal from '../components/portal/OfflineJwtModal.vue'

const route = useRoute()

const customerEmail = ref((route.query.email as string) || '')
const licenses = ref<PortalLicenseItem[]>([])
const transactions = ref<PortalTransactionItem[]>([])
const loading = ref(false)
const searched = ref(false)
const activeTab = ref<'licenses' | 'transactions'>('licenses')

// UI alerts
const alertMessage = ref<{ type: 'success' | 'error'; text: string } | null>(null)
const copiedKey = ref<string | null>(null)
const deactivatingHwid = ref<string | null>(null)

// Offline Token Modal State
const selectedJwtLicense = ref<PortalLicenseItem | null>(null)
const isJwtModalOpen = ref(false)

function showAlert(type: 'success' | 'error', text: string) {
  alertMessage.value = { type, text }
  setTimeout(() => {
    if (alertMessage.value?.text === text) {
      alertMessage.value = null
    }
  }, 4000)
}

function copyToClipboard(text: string, id: string) {
  navigator.clipboard.writeText(text)
  copiedKey.value = id
  showAlert('success', 'Berhasil disalin ke clipboard!')
  setTimeout(() => {
    if (copiedKey.value === id) copiedKey.value = null
  }, 2000)
}

async function loadCustomerData() {
  if (!customerEmail.value.trim()) {
    showAlert('error', 'Silakan masukkan alamat email yang digunakan saat pembelian.')
    return
  }

  loading.value = true
  alertMessage.value = null

  try {
    const [licRes, txRes] = await Promise.all([
      api.getPortalLicenses(customerEmail.value.trim()),
      api.getPortalTransactions(customerEmail.value.trim())
    ])

    licenses.value = licRes.success ? licRes.licenses : []
    transactions.value = txRes.success ? txRes.transactions : []
    searched.value = true
  } catch (err: any) {
    showAlert('error', err.message || 'Gagal memuat data pembeli.')
  } finally {
    loading.value = false
  }
}

async function handleDeactivateDevice(licenseKey: string, hwidHash: string, deviceName: string | null) {
  if (!confirm(`Lepas lisensi dari perangkat "${deviceName || hwidHash.slice(0, 10)}"? Anda dapat menggunakan seat ini di perangkat lain.`)) {
    return
  }

  deactivatingHwid.value = hwidHash
  try {
    const res = await api.deactivatePortalDevice({
      licenseKey,
      hwidHash,
      customerEmail: customerEmail.value.trim()
    })

    if (res.success) {
      showAlert('success', res.message || 'Seat perangkat berhasil dilepas!')
      await loadCustomerData()
    } else {
      showAlert('error', res.error || 'Gagal melepas perangkat.')
    }
  } catch (err: any) {
    showAlert('error', err.message || 'Terjadi kesalahan saat melepas perangkat.')
  } finally {
    deactivatingHwid.value = null
  }
}

function openOfflineJwtModal(lic: PortalLicenseItem) {
  selectedJwtLicense.value = lic
  isJwtModalOpen.value = true
}

function prefillDemoEmail() {
  customerEmail.value = 'pembeli@tertaut.com'
  loadCustomerData()
}

onMounted(() => {
  if (customerEmail.value.trim()) {
    loadCustomerData()
  }
})
</script>

<template>
  <div class="min-h-screen bg-[#FAFAFA] text-[#111111] flex flex-col font-sans">
    <!-- Top Customer Portal Navigation Header -->
    <header class="border-b border-[#111111]/10 bg-white sticky top-0 z-30 shadow-xs">
      <div class="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <router-link to="/" class="flex items-center gap-2 group">
            <div class="w-8 h-8 rounded-lg bg-[#111111] flex items-center justify-center font-bold text-white relative shadow-sm group-hover:scale-105 transition">
              <span class="text-sm font-black tracking-tighter">T</span>
              <span class="absolute bottom-1 right-1 w-1.5 h-1.5 rounded-full bg-[#D4AF37]"></span>
            </div>
            <div class="font-mono font-extrabold text-sm text-[#111111]">
              tertaut<span class="text-[#D4AF37]">.com</span>
            </div>
          </router-link>
          <div class="h-4 w-px bg-[#111111]/15"></div>
          <div class="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#0F4C3A]/10 text-[#0F4C3A] text-xs font-semibold">
            <ShieldCheck class="w-3.5 h-3.5" />
            <span>Customer Portal</span>
          </div>
        </div>

        <div class="flex items-center gap-3 text-xs">
          <router-link
            to="/dashboard"
            class="hidden sm:inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[#111111]/15 hover:bg-[#111111]/5 font-medium transition text-[#111111]/80"
          >
            Mode Builder / Developer
            <ChevronRight class="w-3.5 h-3.5 opacity-60" />
          </router-link>
          <router-link
            to="/"
            class="inline-flex items-center gap-1 text-[#111111]/70 hover:text-[#111111] font-medium transition"
          >
            <ArrowLeft class="w-3.5 h-3.5" />
            Kembali
          </router-link>
        </div>
      </div>
    </header>

    <!-- Main Container -->
    <main class="flex-1 max-w-5xl mx-auto w-full px-4 py-8 space-y-8">
      <!-- Feedback Notification Banner -->
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

      <!-- Hero Header & Search Form Component -->
      <PortalSearchHero
        v-model:email="customerEmail"
        :loading="loading"
        @search="loadCustomerData"
        @prefill-demo="prefillDemoEmail"
      />

      <!-- Customer Results Section -->
      <section v-if="searched" class="space-y-6">
        <!-- Navigation Tabs -->
        <div class="flex items-center gap-2 border-b border-[#111111]/10 pb-2">
          <button
            @click="activeTab = 'licenses'"
            :class="[
              'flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer',
              activeTab === 'licenses'
                ? 'bg-[#111111] text-white shadow-xs'
                : 'text-[#111111]/60 hover:text-[#111111] hover:bg-[#111111]/5'
            ]"
          >
            <KeyRound class="w-3.5 h-3.5" :class="activeTab === 'licenses' ? 'text-[#D4AF37]' : ''" />
            <span>Lisensi Saya</span>
            <span
              :class="[
                'px-1.5 py-0.2 rounded-full text-[10px]',
                activeTab === 'licenses' ? 'bg-white/20 text-white' : 'bg-[#111111]/10 text-[#111111]'
              ]"
            >
              {{ licenses.length }}
            </span>
          </button>

          <button
            @click="activeTab = 'transactions'"
            :class="[
              'flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer',
              activeTab === 'transactions'
                ? 'bg-[#111111] text-white shadow-xs'
                : 'text-[#111111]/60 hover:text-[#111111] hover:bg-[#111111]/5'
            ]"
          >
            <Receipt class="w-3.5 h-3.5" :class="activeTab === 'transactions' ? 'text-[#D4AF37]' : ''" />
            <span>Riwayat Transaksi</span>
            <span
              :class="[
                'px-1.5 py-0.2 rounded-full text-[10px]',
                activeTab === 'transactions' ? 'bg-white/20 text-white' : 'bg-[#111111]/10 text-[#111111]'
              ]"
            >
              {{ transactions.length }}
            </span>
          </button>
        </div>

        <!-- TAB 1: LICENSES LIST -->
        <div v-if="activeTab === 'licenses'" class="space-y-4">
          <!-- Empty State -->
          <div
            v-if="licenses.length === 0"
            class="p-12 text-center bg-white rounded-2xl border border-[#111111]/10 space-y-3"
          >
            <div class="w-12 h-12 rounded-full bg-[#111111]/5 mx-auto flex items-center justify-center text-[#111111]/40">
              <KeyRound class="w-6 h-6" />
            </div>
            <h3 class="text-sm font-bold text-[#111111]">Belum Ada Lisensi Ditemukan</h3>
            <p class="text-xs text-[#111111]/60 max-w-sm mx-auto">
              Tidak ada software terdaftar dengan email <span class="font-mono font-semibold">{{ customerEmail }}</span>. Pastikan Anda memasukkan email yang sama saat pembayaran.
            </p>
          </div>

          <!-- License Cards List -->
          <CustomerLicenseCard
            v-for="lic in licenses"
            :key="lic.id"
            :lic="lic"
            :copied-key="copiedKey"
            :deactivating-hwid="deactivatingHwid"
            @copy="copyToClipboard"
            @deactivate-device="handleDeactivateDevice"
            @open-jwt-modal="openOfflineJwtModal"
          />
        </div>

        <!-- TAB 2: TRANSACTIONS & RECEIPTS COMPONENT -->
        <CustomerTransactionTable
          v-if="activeTab === 'transactions'"
          :transactions="transactions"
        />
      </section>

      <!-- Offline JWT Modal Component -->
      <OfflineJwtModal
        :show="isJwtModalOpen"
        :lic="selectedJwtLicense"
        @close="isJwtModalOpen = false"
        @copy="copyToClipboard"
      />
    </main>

    <!-- Footer -->
    <footer class="border-t border-[#111111]/10 bg-white py-6 text-center text-xs text-[#111111]/50 mt-auto">
      <div class="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div class="flex items-center gap-2 font-mono">
          <span>tertaut.com</span>
          <span>•</span>
          <span>Merchant of Record Platform</span>
        </div>
        <div class="flex items-center gap-4 text-[11px]">
          <router-link to="/" class="hover:text-[#111111]">Beranda</router-link>
          <router-link to="/dashboard" class="hover:text-[#111111]">Builder Portal</router-link>
          <a href="/swagger" target="_blank" class="hover:text-[#111111]">API Docs</a>
        </div>
      </div>
    </footer>
  </div>
</template>
