<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import { formatRupiah } from '../lib/utils'
import {
  ShieldCheck,
  CreditCard,
  Lock,
  ArrowRight,
  ArrowLeft,
  Mail,
  Sparkles,
  CheckCircle2,
  QrCode,
  Building,
  Wallet,
  ExternalLink,
  FlaskConical
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
  mode: 'sandbox' | 'live'
  targetPrice: number
  description: string | null
  headline: string | null
  subheadline: string | null
  mediaUrl: string | null
  valueProps: string[]
  redirectUrl: string | null
} | null>(null)

const emailInput = ref('')
const couponInput = ref('')
const appliedCoupon = ref<{ code: string; discountPercent: number; discountAmount: number } | null>(null)
const couponError = ref('')
const loading = ref(true)
const notFound = ref(false)
const isSubmitting = ref(false)
const errorMessage = ref('')
const selectedPaymentRail = ref<'qris' | 'va' | 'ewallet'>('qris')
const sandboxSessionId = ref<string | null>(null)
const sandboxResult = ref<{ message: string; licenseKey?: string } | null>(null)
const isSimulating = ref(false)

/** Estimasi diskon & total bayar untuk pratinjau langsung saat mengetik kupon. */
const estimatedDiscount = computed(() => {
  if (!product.value || !appliedCoupon.value) return 0
  return Math.min(appliedCoupon.value.discountAmount, product.value.targetPrice)
})
const payableAmount = computed(() =>
  product.value ? Math.max(0, product.value.targetPrice - estimatedDiscount.value) : 0
)

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

/**
 * Preview kupon langsung di halaman pay sebelum membuat sesi pembayaran.
 * Validasi otoritatif tetap di server saat POST /checkout/session.
 */
async function applyCoupon() {
  if (!product.value || !couponInput.value.trim()) return
  couponError.value = ''
  appliedCoupon.value = null

  try {
    const res = await fetch('/api/v1/checkout/preview-coupon', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        appId: product.value.id,
        couponCode: couponInput.value.trim(),
        amount: product.value.targetPrice
      })
    })
    const data = await res.json()
    if (!res.ok || !data.valid) {
      couponError.value = data.message || data.error || 'Kupon tidak valid'
      return
    }
    appliedCoupon.value = {
      code: data.coupon.code,
      discountPercent: data.discountPercent,
      discountAmount: data.discountAmount
    }
  } catch {
    couponError.value = 'Gagal memvalidasi kupon. Coba lagi.'
  }
}

function setProductData(data: any) {
  product.value = {
    id: data.id,
    name: queryProductName.value || data.name,
    slug: data.slug,
    mode: data.mode === 'sandbox' ? 'sandbox' : 'live',
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
        redirectUrl: product.value.redirectUrl || window.location.href,
        couponCode: appliedCoupon.value?.code || undefined,
        paymentRail: selectedPaymentRail.value
      })
    })

    const data = await res.json()
    if (!res.ok || !data.success) {
      errorMessage.value = data.error || 'Gagal membuat sesi pembayaran'
      return
    }

    const checkoutUrl = data.data?.xenditInvoiceUrl || data.checkoutUrl
    if (data.data?.isSandbox && data.data?.sessionId) {
      // Mode sandbox: jangan arahkan ke invoice mock. Tawarkan simulasi pembayaran inline.
      sandboxSessionId.value = data.data.sessionId
      sandboxResult.value = null
      return
    }
    if (checkoutUrl) {
      window.location.href = checkoutUrl
    }
  } catch (err: any) {
    errorMessage.value = err.message || 'Terjadi kesalahan jaringan'
  } finally {
    isSubmitting.value = false
  }
}

async function simulateSandboxPayment() {
  const txId = sandboxSessionId.value
  if (!txId) return
  isSimulating.value = true
  errorMessage.value = ''
  try {
    const res = await fetch(`/api/v1/checkout/simulate-paid/${txId}`, { method: 'POST' })
    const data = await res.json()
    if (!res.ok || !data.success) {
      errorMessage.value = data.error || 'Gagal mensimulasikan pembayaran'
      return
    }
    sandboxResult.value = {
      message: data.message,
      licenseKey: data.licenseKey,
    }
  } catch (err: any) {
    errorMessage.value = err.message || 'Terjadi kesalahan jaringan'
  } finally {
    isSimulating.value = false
  }
}

onMounted(() => {
  loadCheckoutData()
})
</script>

<template>
  <div
    class="relative h-screen max-h-screen bg-[#090A0C] text-white flex flex-col justify-center items-center p-3 sm:p-5 lg:p-6 overflow-hidden selection:bg-[#D4AF37]/30 selection:text-white">
    <!-- Ambient Lighting & Developer Grid Background -->
    <div class="fixed inset-0 pointer-events-none z-0">
      <div
        class="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:40px_40px]">
      </div>
      <div
        class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[650px] h-[450px] bg-gradient-to-tr from-[#0F4C3A]/20 via-[#D4AF37]/10 to-transparent rounded-full blur-[140px]">
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="relative z-10 flex flex-col items-center justify-center text-white/70 text-xs gap-3 p-8">
      <div class="w-6 h-6 border-2 border-[#D4AF37] border-t-transparent rounded-full animate-spin"></div>
      <span class="font-mono text-[11px]">Menyiapkan sesi checkout aman tertaut.com...</span>
    </div>

    <!-- Not Found State -->
    <div v-else-if="notFound"
      class="relative z-10 w-full max-w-md rounded-2xl border border-white/10 bg-[#111215]/95 backdrop-blur-2xl p-8 text-center space-y-4 shadow-2xl">
      <div
        class="w-12 h-12 mx-auto rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
        <Lock class="w-5 h-5" />
      </div>
      <div>
        <h1 class="text-base font-bold text-white">Produk Pembayaran Tidak Ditemukan</h1>
        <p class="text-xs text-white/50 mt-1 leading-relaxed">Tautan checkout tidak valid, kedaluwarsa, atau produk
          belum diluncurkan.</p>
      </div>
      <router-link to="/"
        class="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#D4AF37] text-black text-xs font-bold hover:bg-[#C5A059] transition">
        <span>Kembali ke Beranda</span>
      </router-link>
    </div>

    <!-- Active Checkout Master Container -->
    <template v-else-if="product">
      <!-- Top Navigation Bar (Aligned with Master Card width) -->
      <div class="relative z-10 w-full max-w-4xl mb-2 sm:mb-3 flex items-center justify-between px-1 shrink-0">
        <router-link to="/"
          class="inline-flex items-center gap-1.5 text-xs font-semibold text-white/60 hover:text-white transition group">
          <ArrowLeft class="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition" />
          <span>Kembali ke Beranda</span>
        </router-link>

        <div class="flex items-center gap-3 text-xs">
          <div v-if="product.mode === 'sandbox'"
            class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-400 text-[11px] font-mono">
            <FlaskConical class="w-3 h-3" />
            <span>Sandbox Mode</span>
          </div>
          <div v-else
            class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-[11px] font-mono">
            <ShieldCheck class="w-3 h-3" />
            <span>Xendit Secured</span>
          </div>
          <span class="w-1 h-1 rounded-full bg-white/20"></span>
          <span class="text-[11px] text-white/40 font-mono">256-Bit MoR</span>
        </div>
      </div>

      <!-- Master Unified Luxury Card (50/50 Precision Split, High Contrast) -->
      <div
        class="relative z-10 w-full max-w-4xl h-[540px] max-h-[calc(100vh-5rem)] rounded-2xl border border-slate-200/90 bg-white text-slate-900 shadow-[0_25px_70px_rgba(0,0,0,0.6)] overflow-hidden grid grid-cols-1 lg:grid-cols-2 shrink-0">

        <!-- LEFT PANE: Order Summary & Product Details (Presisi 50% Kiri) -->
        <div
          class="hidden lg:flex flex-col justify-between p-7 xl:p-8 border-r border-slate-200 bg-slate-50/70 h-full overflow-hidden shrink-0">
          <!-- Product Details & Pricing Body -->
          <div class="space-y-4 my-auto py-1">
            <div class="space-y-1.5">
              <h1 class="text-2xl xl:text-3xl font-black tracking-tight text-slate-950 leading-tight">
                {{ product.headline || product.name }}
              </h1>
              <p class="text-xs sm:text-sm text-slate-600 leading-relaxed font-normal line-clamp-2">
                {{ product.subheadline || product.description }}
              </p>
            </div>

            <!-- Value Propositions Bullets -->
            <div v-if="product.valueProps && product.valueProps.length > 0" class="space-y-2 py-1">
              <div v-for="(vp, idx) in product.valueProps.slice(0, 3)" :key="idx"
                class="flex items-center gap-2 text-xs sm:text-sm font-semibold text-slate-800">
                <CheckCircle2 class="w-4 h-4 text-emerald-600 shrink-0" />
                <span class="leading-tight">{{ vp }}</span>
              </div>
            </div>

            <!-- Price Breakdown & Kupon -->
            <div class="space-y-2.5 text-xs sm:text-sm pt-3 border-t border-slate-200">
              <div class="flex items-center justify-between font-semibold text-slate-800">
                <span class="truncate max-w-[180px]">{{ product.name }}</span>
                <span class="font-mono font-bold text-slate-950 text-sm sm:text-base">{{ formatRupiah(product.targetPrice) }}</span>
              </div>
              <div class="flex items-center justify-between text-xs text-slate-600 font-medium">
                <span>Biaya Layanan &amp; PPN</span>
                <span class="text-emerald-600 font-bold">Gratis (Ditanggung Penjual)</span>
              </div>

              <!-- Kupon Input / Applied -->
              <div class="pt-1">
                <div v-if="appliedCoupon"
                  class="flex items-center justify-between text-xs py-1.5 px-3 rounded-lg bg-emerald-50 border border-emerald-300">
                  <span class="inline-flex items-center gap-1.5 text-emerald-700 font-bold">
                    <CheckCircle2 class="w-3.5 h-3.5 text-emerald-600" />
                    {{ appliedCoupon.code }} (−{{ appliedCoupon.discountPercent }}%)
                  </span>
                  <button @click="appliedCoupon = null; couponInput = ''"
                    class="text-slate-600 hover:text-slate-950 text-xs font-semibold underline cursor-pointer">Hapus</button>
                </div>
                <div v-else class="flex items-center gap-2">
                  <input v-model="couponInput" type="text" placeholder="Kode kupon (opsional)"
                    class="auth-input flex-1 bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-mono font-bold uppercase text-slate-950 placeholder:normal-case placeholder:font-sans placeholder:text-slate-400 focus:outline-none focus:border-slate-800 focus:ring-1 focus:ring-slate-800 transition"
                    @keyup.enter="applyCoupon" />
                  <button @click="applyCoupon" :disabled="!couponInput.trim()"
                    class="px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-black text-white text-xs font-bold disabled:opacity-30 cursor-pointer transition border border-slate-900">Pakai</button>
                </div>
                <p v-if="couponError" class="text-xs text-red-600 font-semibold mt-1">{{ couponError }}</p>
                <div v-if="estimatedDiscount > 0"
                  class="flex items-center justify-between text-xs font-bold text-emerald-600 pt-1">
                  <span>Diskon Kupon</span>
                  <span class="font-mono">−{{ formatRupiah(estimatedDiscount) }}</span>
                </div>
              </div>
            </div>

            <!-- Grand Total -->
            <div class="flex items-baseline justify-between pt-3 border-t border-slate-200">
              <span class="text-xs font-bold text-slate-700 uppercase tracking-wider">Total Bayar</span>
              <span class="text-2xl sm:text-3xl font-black text-slate-950 font-mono tracking-tight">
                {{ formatRupiah(payableAmount || product.targetPrice) }}
              </span>
            </div>
          </div>

          <!-- Footer Trust -->
          <div
            class="flex items-center justify-between text-xs font-semibold text-slate-600 pt-3 border-t border-slate-200 shrink-0">
            <div class="flex items-center gap-1.5">
              <Lock class="w-3.5 h-3.5 text-amber-600" />
              <span>Enkripsi 256-Bit SSL</span>
            </div>
            <div class="flex items-center gap-1.5">
              <Sparkles class="w-3.5 h-3.5 text-emerald-600" />
              <span>Aktivasi Instan</span>
            </div>
          </div>
        </div>

        <!-- RIGHT PANE: Payment Form & Multi-Rail Selection (Presisi 50% Kanan, Internal Scroll) -->
        <div class="flex flex-col h-full overflow-hidden bg-white text-slate-900">
          <div class="flex-1 overflow-y-auto p-6 sm:p-7 xl:p-8 custom-scrollbar flex flex-col justify-between">
            <div class="space-y-4">
              <!-- Mobile Header & Title (visible on mobile only) -->
              <div class="lg:hidden pb-3 border-b border-slate-200 space-y-1">
                <div class="flex items-center justify-between">
                  <span class="text-xs font-bold text-amber-600 font-mono uppercase">Pesanan Lisensi</span>
                  <span class="font-mono font-black text-sm text-slate-950">{{ formatRupiah(payableAmount ||
                    product.targetPrice) }}</span>
                </div>
                <h1 class="text-base font-bold text-slate-950 leading-tight">{{ product.name }}</h1>
              </div>

              <!-- Email Input -->
              <div v-if="!sandboxSessionId" class="space-y-1.5">
                <label class="block text-xs font-bold text-slate-900">
                  Email Penerima Lisensi Digital <span class="text-amber-500">*</span>
                </label>
                <div class="relative">
                  <Mail class="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-500" />
                  <input v-model="emailInput" type="email" required placeholder="nama@email.com"
                    class="auth-input w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-xs sm:text-sm font-semibold text-slate-950 placeholder-slate-400 outline-none transition focus:border-slate-800 focus:ring-1 focus:ring-slate-800"
                    @keyup.enter="handlePay" />
                </div>
                <p class="text-xs text-slate-600 leading-relaxed font-normal">
                  Kunci lisensi resmi dan petunjuk aktivasi otomatis dikirimkan ke alamat email ini setelah pembayaran
                  tervalidasi.
                </p>
              </div>

              <!-- Multi-Rail Selector (QRIS, VA, E-Wallet) -->
              <div v-if="!sandboxSessionId" class="space-y-2">
                <label class="block text-xs font-bold text-slate-900">Pilih Jalur Pembayaran Resmi</label>
                <div class="grid grid-cols-3 gap-2 sm:gap-2.5">
                  <button type="button" @click="selectedPaymentRail = 'qris'"
                    class="p-3 rounded-xl border-2 text-center transition flex flex-col items-center justify-center gap-1.5 cursor-pointer"
                    :class="selectedPaymentRail === 'qris'
                      ? 'border-amber-500 bg-amber-50/90 text-slate-950 font-bold shadow-xs'
                      : 'border-slate-200 bg-slate-50/70 hover:bg-slate-100 text-slate-800 font-semibold'">
                    <QrCode class="w-5 h-5 text-amber-600" />
                    <span class="text-xs font-bold">QRIS Instan</span>
                  </button>

                  <button type="button" @click="selectedPaymentRail = 'va'"
                    class="p-3 rounded-xl border-2 text-center transition flex flex-col items-center justify-center gap-1.5 cursor-pointer"
                    :class="selectedPaymentRail === 'va'
                      ? 'border-amber-500 bg-amber-50/90 text-slate-950 font-bold shadow-xs'
                      : 'border-slate-200 bg-slate-50/70 hover:bg-slate-100 text-slate-800 font-semibold'">
                    <Building class="w-5 h-5 text-cyan-700" />
                    <span class="text-xs font-bold">Virtual Account</span>
                  </button>

                  <button type="button" @click="selectedPaymentRail = 'ewallet'"
                    class="p-3 rounded-xl border-2 text-center transition flex flex-col items-center justify-center gap-1.5 cursor-pointer"
                    :class="selectedPaymentRail === 'ewallet'
                      ? 'border-amber-500 bg-amber-50/90 text-slate-950 font-bold shadow-xs'
                      : 'border-slate-200 bg-slate-50/70 hover:bg-slate-100 text-slate-800 font-semibold'">
                    <Wallet class="w-5 h-5 text-emerald-700" />
                    <span class="text-xs font-bold">E-Wallet</span>
                  </button>
                </div>
                <div class="flex items-center justify-between text-xs font-semibold text-slate-600 px-1 pt-0.5">
                  <span>BCA, Mandiri, BRI, BNI</span>
                  <span>GoPay, OVO, DANA, ShopeePay</span>
                </div>
              </div>

              <!-- Error Alert -->
              <div v-if="errorMessage"
                class="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold">
                {{ errorMessage }}
              </div>

              <!-- Sandbox: Simulasi Inline -->
              <div v-if="sandboxSessionId && !sandboxResult"
                class="space-y-2.5 p-3.5 rounded-xl bg-blue-50 border border-blue-200">
                <div class="flex items-start gap-2">
                  <FlaskConical class="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <div class="space-y-0.5">
                    <p class="text-xs font-bold text-blue-900">Sesi Pembayaran Sandbox Siap</p>
                    <p class="text-xs text-slate-700">
                      Tidak ada transaksi nyata yang ditagihkan. Klik tombol di bawah untuk mensimulasikan lunas dan
                      menerbitkan lisensi uji coba.
                    </p>
                  </div>
                </div>
                <button @click="simulateSandboxPayment" :disabled="isSimulating"
                  class="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition flex items-center justify-center gap-2 active:scale-98 disabled:opacity-50 cursor-pointer">
                  <FlaskConical class="w-3.5 h-3.5" />
                  <span>{{ isSimulating ? 'Mensimulasikan…' : 'Simulasikan Pembayaran Lunas' }}</span>
                </button>
              </div>

              <!-- Sandbox: Hasil Simulasi -->
              <div v-if="sandboxResult"
                class="space-y-2 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200">
                <div class="flex items-start gap-2">
                  <CheckCircle2 class="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div class="space-y-1 w-full">
                    <p class="text-xs font-bold text-emerald-900">Simulasi Pembayaran Berhasil</p>
                    <p class="text-xs text-slate-700">{{ sandboxResult.message }}</p>
                    <div v-if="sandboxResult.licenseKey" class="pt-1.5 border-t border-emerald-200">
                      <p class="text-xs font-bold text-slate-700 mb-1">Kunci Lisensi Uji Coba Anda:</p>
                      <div
                        class="p-2.5 bg-slate-900 rounded-lg border border-slate-700 font-mono font-bold text-emerald-400 text-xs break-all select-all text-center">
                        {{ sandboxResult.licenseKey }}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Pay Button -->
              <div v-if="!sandboxSessionId" class="pt-1">
                <button @click="handlePay" :disabled="isSubmitting || !emailInput"
                  class="w-full flex items-center justify-center gap-2 rounded-xl bg-amber-400 hover:bg-amber-300 active:scale-[0.99] px-4 py-3 text-xs sm:text-sm font-extrabold text-slate-950 shadow-md transition duration-150 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer border border-amber-500/20"
                  :class="product.mode === 'sandbox' ? '!bg-blue-600 !text-white hover:!bg-blue-500 !border-transparent' : ''">
                  <FlaskConical v-if="product.mode === 'sandbox'" class="w-4 h-4" />
                  <CreditCard v-else class="w-4 h-4 text-slate-950" />
                  <span>
                    {{ isSubmitting ? 'Menyiapkan sesi...' : product.mode === 'sandbox' ? `Mulai Sesi Sandbox —
                    ${formatRupiah(payableAmount || product.targetPrice)}` : `Bayar Sekarang —
                    ${formatRupiah(payableAmount || product.targetPrice)}` }}
                  </span>
                  <ArrowRight v-if="!isSubmitting" class="w-4 h-4 ml-0.5 text-slate-950" />
                </button>
              </div>
            </div>

            <!-- Bottom Disclaimer Notice -->
            <div class="pt-3 border-t border-slate-200 text-center shrink-0">
              <p class="text-xs text-slate-600 leading-relaxed">
                Pembayaran diproses secara aman oleh <span class="text-slate-900 font-bold">Xendit Indonesia</span>.
                Merchant of Record resmi oleh <span class="text-slate-900 font-bold">tertaut.com</span>.
              </p>
            </div>
          </div>
        </div>

      </div>
    </template>
  </div>
</template>

<style scoped>
/* Internal sleek scrollbar for container */
.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.12);
  border-radius: 9999px;
}

.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.25);
}

/* Light mode seamless autofill styling */
.auth-input:-webkit-autofill,
.auth-input:-webkit-autofill:hover,
.auth-input:-webkit-autofill:focus,
.auth-input:-webkit-autofill:active {
  -webkit-box-shadow: 0 0 0 30px #ffffff inset !important;
  -webkit-text-fill-color: #0f172a !important;
  caret-color: #0f172a !important;
  transition: background-color 5000s ease-in-out 0s;
}
</style>
