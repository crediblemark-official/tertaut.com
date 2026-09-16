<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import { formatRupiah } from '../lib/utils'
import {
  ShieldCheck,
  CreditCard,
  Lock,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  QrCode,
  Building,
  Wallet,
  ExternalLink
} from 'lucide-vue-next'

const route = useRoute()

// Can be /pay/:slug or /pay?app_id=...&amount=...
const slug = computed(() => (route.params.slug as string) || (route.query.app_slug as string) || (route.query.slug as string) || '')
const queryAppId = computed(() => (route.query.app_id as string) || '')
const queryAmount = computed(() => route.query.amount ? Number(route.query.amount) : null)
const queryProductName = computed(() => (route.query.product_name as string) || '')
const queryGrantDays = computed(() => route.query.grant_days ? Number(route.query.grant_days) : 365)
const queryRedirectUrl = computed(() => (route.query.redirect_url as string) || '')

const product = ref<{
  id: string
  name: string
  slug: string
  targetPrice: number
  description: string | null
  headline: string | null
  subheadline: string | null
  mediaUrl: string | null
  valueProps: string[]
  redirectUrl: string | null
} | null>(null)

const emailInput = ref('')
const loading = ref(true)
const notFound = ref(false)
const isSubmitting = ref(false)
const errorMessage = ref('')
const selectedPaymentRail = ref<'qris' | 'va' | 'ewallet'>('qris')

async function loadCheckoutData() {
  loading.value = true
  errorMessage.value = ''
  try {
    const identifier = slug.value || queryAppId.value
    if (!identifier) {
      // Jika tidak ada parameter, coba ambil aplikasi live pertama
      const res = await fetch('/api/v1/apps')
      const json = await res.json()
      if (json.apps && json.apps.length > 0) {
        const liveApp = json.apps.find((a: any) => a.mode === 'live') || json.apps[0]
        setProductData(liveApp)
      } else {
        notFound.value = true
      }
      return
    }

    const res = await fetch(`/api/v1/apps/by-slug/${identifier}`)
    if (res.ok) {
      const data = await res.json()
      setProductData(data)
    } else {
      // Coba fetch via ID
      const appsRes = await fetch('/api/v1/apps')
      const appsJson = await appsRes.json()
      const matched = appsJson.apps?.find((a: any) => a.id === identifier || a.slug === identifier)
      if (matched) {
        setProductData(matched)
      } else {
        notFound.value = true
      }
    }
  } catch (err: any) {
    notFound.value = true
  } finally {
    loading.value = false
  }
}

function setProductData(data: any) {
  product.value = {
    id: data.id,
    name: queryProductName.value || data.name,
    slug: data.slug,
    // Harga resmi dari server selalu menang atas override lewat query string,
    // supaya nominal di halaman ini tidak bisa dimanipulasi oleh tautan.
    targetPrice: data.targetPrice || queryAmount.value || 49000,
    description: data.description || data.subheadline || null,
    headline: data.headline || data.name,
    subheadline: data.subheadline || data.description,
    mediaUrl: data.mediaUrl || null,
    valueProps: data.valueProps || ['Lisensi resmi multi-platform', 'Aktivasi otomatis instan', 'Garansi pembaruan versi'],
    redirectUrl: queryRedirectUrl.value || data.redirectUrl || null
  }
  document.title = `Checkout ${product.value.name} — tertaut.com MoR`
}

async function handlePay() {
  if (!product.value || !emailInput.value) return
  isSubmitting.value = true
  errorMessage.value = ''

  try {
    const res = await fetch('/api/v1/checkout/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        appId: product.value.id,
        appSlug: product.value.slug,
        amount: product.value.targetPrice,
        customerEmail: emailInput.value,
        grantDays: queryGrantDays.value || 365,
        redirectUrl: product.value.redirectUrl || window.location.href
      })
    })

    const data = await res.json()
    if (!res.ok || !data.success) {
      errorMessage.value = data.error || 'Gagal membuat sesi pembayaran'
      return
    }

    const checkoutUrl = data.data?.xenditInvoiceUrl || data.checkoutUrl
    if (checkoutUrl) {
      window.location.href = checkoutUrl
    }
  } catch (err: any) {
    errorMessage.value = err.message || 'Terjadi kesalahan jaringan'
  } finally {
    isSubmitting.value = false
  }
}

onMounted(() => {
  loadCheckoutData()
})
</script>

<template>
  <div class="min-h-screen sm:min-h-[90vh] flex flex-col items-center justify-start sm:justify-center p-0 sm:px-3 sm:py-8 md:py-12 animate-fadeIn bg-white sm:bg-transparent">
    <div v-if="loading" class="text-[#111111]/60 text-xs flex items-center gap-2 p-8">
      <div class="w-4 h-4 border-2 border-[#D4AF37] border-t-transparent rounded-full animate-spin"></div>
      <span>Menyiapkan sesi pembayaran aman...</span>
    </div>

    <div v-else-if="notFound" class="text-center space-y-2 max-w-sm luxury-card p-6 rounded-2xl m-4 sm:m-0">
      <h1 class="text-base font-extrabold text-[#111111]">Produk Pembayaran Tidak Ditemukan</h1>
      <p class="text-xs text-[#111111]/60">Tautan pembayaran tidak valid atau produk belum diluncurkan.</p>
      <router-link to="/dashboard" class="inline-block mt-2 text-xs font-bold text-[#D4AF37] underline">Kembali ke Dashboard</router-link>
    </div>

    <div v-else-if="product" class="w-full sm:max-w-md space-y-0 sm:space-y-4">
      <!-- Hosted Checkout Card: Full Edge on Mobile (No container, no border, no radius), Luxury Card on sm+ -->
      <div class="w-full bg-white rounded-none border-0 shadow-none p-4 pb-8 sm:p-6 space-y-5 sm:rounded-2xl sm:border sm:border-[#111111]/12 sm:shadow-luxury-hover sm:luxury-card">
        <!-- Brand & Merchant of Record Header -->
        <div class="flex items-center justify-between pb-3 border-b border-[#111111]/10">
          <div class="flex items-center gap-2">
            <div class="w-8 h-8 rounded-xl bg-[#111111] flex items-center justify-center font-bold text-white text-xs shadow-md">
              T
            </div>
            <div>
              <div class="text-xs font-extrabold text-[#111111] font-mono">
                tertaut<span class="text-[#D4AF37]">.com</span>
              </div>
              <div class="text-[9px] text-[#111111]/50 font-medium">Official Merchant of Record (MoR)</div>
            </div>
          </div>

          <div class="flex items-center gap-1 text-[10px] font-bold text-[#0F4C3A] bg-[#0F4C3A]/10 px-2.5 py-1 rounded-full border border-[#0F4C3A]/25">
            <ShieldCheck class="w-3.5 h-3.5" />
            <span>Xendit Secured</span>
          </div>
        </div>

        <!-- Product Summary -->
        <div class="space-y-1">
          <div class="text-[10px] font-mono font-bold uppercase text-[#D4AF37]">Pesanan Lisensi Digital</div>
          <h1 class="text-xl font-black text-[#111111] tracking-tight">
            {{ product.headline || product.name }}
          </h1>
          <p class="text-xs text-[#111111]/70 leading-relaxed">
            {{ product.subheadline || product.description }}
          </p>
        </div>

        <!-- Total Breakdown Card -->
        <div class="p-3.5 rounded-xl bg-[#111111]/5 border border-[#111111]/10 space-y-2">
          <div class="flex items-center justify-between text-xs">
            <span class="text-[#111111]/70">{{ product.name }}</span>
            <span class="font-mono font-bold text-[#111111]">{{ formatRupiah(product.targetPrice) }}</span>
          </div>
          <div class="flex items-center justify-between text-[11px] text-[#111111]/50">
            <span>Biaya Layanan &amp; PPN</span>
            <span class="text-[#0F4C3A] font-bold">Gratis (Ditanggung Penjual)</span>
          </div>
          <div class="pt-2 border-t border-[#111111]/10 flex items-baseline justify-between">
            <span class="text-xs font-bold text-[#111111]">Total Pembayaran</span>
            <span class="text-xl font-black text-[#111111] font-mono">
              {{ formatRupiah(product.targetPrice) }}
            </span>
          </div>
        </div>

        <!-- Multi-Rail Payment Options Selector (FR-2.1) -->
        <div class="space-y-2">
          <label class="block text-[11px] font-bold text-[#111111]/70">Pilih Jalur Pembayaran Resmi</label>
          <div class="grid grid-cols-3 gap-2">
            <button
              type="button"
              @click="selectedPaymentRail = 'qris'"
              class="p-2.5 rounded-xl border text-center transition flex flex-col items-center justify-center gap-1 cursor-pointer"
              :class="selectedPaymentRail === 'qris' ? 'border-[#D4AF37] bg-[#D4AF37]/10 font-bold text-[#111111]' : 'border-[#111111]/15 hover:bg-[#111111]/5 text-[#111111]/70'"
            >
              <QrCode class="w-4 h-4 text-[#D4AF37]" />
              <span class="text-[10px]">QRIS Instan</span>
            </button>

            <button
              type="button"
              @click="selectedPaymentRail = 'va'"
              class="p-2.5 rounded-xl border text-center transition flex flex-col items-center justify-center gap-1 cursor-pointer"
              :class="selectedPaymentRail === 'va' ? 'border-[#D4AF37] bg-[#D4AF37]/10 font-bold text-[#111111]' : 'border-[#111111]/15 hover:bg-[#111111]/5 text-[#111111]/70'"
            >
              <Building class="w-4 h-4 text-[#111111]" />
              <span class="text-[10px]">Virtual Account</span>
            </button>

            <button
              type="button"
              @click="selectedPaymentRail = 'ewallet'"
              class="p-2.5 rounded-xl border text-center transition flex flex-col items-center justify-center gap-1 cursor-pointer"
              :class="selectedPaymentRail === 'ewallet' ? 'border-[#D4AF37] bg-[#D4AF37]/10 font-bold text-[#111111]' : 'border-[#111111]/15 hover:bg-[#111111]/5 text-[#111111]/70'"
            >
              <Wallet class="w-4 h-4 text-[#0F4C3A]" />
              <span class="text-[10px]">E-Wallet</span>
            </button>
          </div>
          <p class="text-[10px] text-[#111111]/50 text-center">
            Mendukung BCA, Mandiri, BRI, BNI, GoPay, OVO, DANA, dan ShopeePay.
          </p>
        </div>

        <!-- Buyer Email Input for License Delivery -->
        <div class="space-y-1.5">
          <label class="block text-xs font-bold text-[#111111]/80">
            Email Penerima Lisensi Digital <span class="text-[#8B0000]">*</span>
          </label>
          <input
            v-model="emailInput"
            type="email"
            placeholder="nama@email.com"
            class="w-full bg-[#FFFFFF] border border-[#111111]/20 rounded-xl px-3.5 py-2.5 text-xs text-[#111111] placeholder-[#111111]/40 focus:outline-none focus:border-[#D4AF37] transition"
            @keyup.enter="handlePay"
          />
          <p class="text-[10px] text-[#111111]/50">
            Kunci lisensi resmi dan petunjuk instalasi akan dikirimkan ke email ini.
          </p>
        </div>

        <!-- Error Alert -->
        <div v-if="errorMessage" class="p-2.5 rounded-lg bg-[#8B0000]/10 border border-[#8B0000]/25 text-[#8B0000] text-xs font-bold">
          {{ errorMessage }}
        </div>

        <!-- Pay Button -->
        <div>
          <button
            @click="handlePay"
            :disabled="isSubmitting || !emailInput"
            class="w-full py-3.5 rounded-xl btn-gold text-xs font-bold transition flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 cursor-pointer shadow-gold-glow"
          >
            <CreditCard class="w-4 h-4" />
            <span>
              {{ isSubmitting ? 'Menghubungkan ke Gateway Xendit...' : `Bayar Sekarang — ${formatRupiah(product.targetPrice)}` }}
            </span>
            <ArrowRight class="w-3.5 h-3.5" />
          </button>
        </div>

        <!-- Trust Badges -->
        <div class="pt-3 border-t border-[#111111]/10 flex items-center justify-between text-[10px] text-[#111111]/60">
          <div class="flex items-center gap-1">
            <Lock class="w-3.5 h-3.5 text-[#0F4C3A]" />
            <span>Enkripsi 256-Bit SSL</span>
          </div>
          <div class="flex items-center gap-1">
            <Sparkles class="w-3.5 h-3.5 text-[#D4AF37]" />
            <span>Aktivasi Lisensi Instan</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
