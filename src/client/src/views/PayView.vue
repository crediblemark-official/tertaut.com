<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import { api } from '../lib/api'
import {
  ShieldCheck,
  Lock,
  ArrowLeft,
  FlaskConical
} from 'lucide-vue-next'
import PayOrderSummary from '../components/pay/PayOrderSummary.vue'
import PayPaymentForm from '../components/pay/PayPaymentForm.vue'

const route = useRoute()

// Can be /pay/:slug or /pay?app_id=...&amount=...
const slug = computed(() => (route.params.slug as string) || (route.query.app_slug as string) || (route.query.slug as string) || '')
const queryAppId = computed(() => (route.query.app_id as string) || '')
const queryAmount = computed(() => route.query.amount ? Number(route.query.amount) : null)
const queryProductName = computed(() => (route.query.product_name as string) || '')
const queryGrantDays = computed(() => route.query.grant_days ? Number(route.query.grant_days) : 30)
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
const isMobileOrderExpanded = ref(false)

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
      // U7: Pengunjung publik tanpa parameter slug langsung diarahkan ke pesan ramah tanpa error auth
      notFound.value = true
      return
    }

    try {
      const data = await api.getAppBySlug(identifier)
      if (data && data.id) {
        setProductData(data)
        return
      }
    } catch {
      // Coba cari di list apps jika by-slug gagal (untuk builder login)
      try {
        const json = await api.getApps()
        if (json.apps) {
          const found = json.apps.find((a: any) => a.slug === identifier || a.id === identifier)
          if (found) {
            setProductData(found)
            return
          }
        }
      } catch {
        // Abaikan kegagalan getApps pada visitor publik
      }
      notFound.value = true
    }
  } catch (err: any) {
    errorMessage.value = err.message || 'Gagal memuat produk pembayaran'
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
    const data = await api.previewCoupon({
      appId: product.value.id,
      couponCode: couponInput.value.trim(),
      amount: product.value.targetPrice
    })
    if (!data.valid || !data.coupon) {
      couponError.value = data.message || data.error || 'Kupon tidak valid'
      return
    }
    appliedCoupon.value = {
      code: data.coupon.code,
      discountPercent: data.discountPercent || 0,
      discountAmount: data.discountAmount || 0
    }
  } catch (err: any) {
    couponError.value = err.message || 'Gagal memvalidasi kupon. Coba lagi.'
  }
}

function setProductData(app: any) {
  product.value = {
    id: app.id,
    name: queryProductName.value || app.name,
    slug: app.slug || '',
    mode: app.mode || 'live',
    targetPrice: queryAmount.value || app.targetPrice || 0,
    description: app.description || 'Solusi software premium otomatis & berlisensi resmi.',
    headline: app.headline || null,
    subheadline: app.subheadline || null,
    mediaUrl: app.mediaUrl || null,
    valueProps: Array.isArray(app.valueProps) ? app.valueProps : (app.valueProps ? JSON.parse(app.valueProps) : [
      'Aktivasi instan dan otomatis via email',
      'Lisensi resmi terikat hardware / device',
      'Update versi & dukungan pelanggan langsung'
    ]),
    redirectUrl: queryRedirectUrl.value || app.redirectUrl || null
  }
}

async function handlePay() {
  if (!product.value || !emailInput.value) return
  isSubmitting.value = true
  errorMessage.value = ''
  sandboxResult.value = null

  try {
    // B1: Kirim targetPrice asli produk, biarkan server menghitung diskon kupon secara atomik.
    // B2: grantDays dikontrol oleh konfigurasi produk di backend, bukan query param pembeli.
    const data = await api.createCheckoutSession({
      appId: product.value.id,
      customerEmail: emailInput.value,
      amount: product.value.targetPrice,
      preferredPaymentChannel: selectedPaymentRail.value,
      redirectUrl: product.value.redirectUrl || `${window.location.origin}/dashboard`,
      couponCode: appliedCoupon.value?.code || couponInput.value.trim() || undefined
    })

    if (!data.success) {
      errorMessage.value = data.error || 'Gagal menyiapkan sesi checkout'
      return
    }

    if (product.value.mode === 'sandbox') {
      sandboxSessionId.value = data.transactionId || ''
    } else if (data.checkoutUrl) {
      window.location.href = data.checkoutUrl
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
    const data = await api.simulatePayment(txId)
    if (!data.success) {
      errorMessage.value = data.message || 'Gagal mensimulasikan pembayaran'
      return
    }
    sandboxResult.value = {
      message: data.message,
      licenseKey: data.licenseKey || '',
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
    class="relative min-h-screen lg:h-screen lg:max-h-screen bg-[#090A0C] text-white flex flex-col justify-start lg:justify-center items-center p-3 sm:p-5 lg:p-6 overflow-y-auto lg:overflow-hidden selection:bg-[#D4AF37]/30 selection:text-white py-4 sm:py-6">
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
    <div v-if="loading" class="relative z-10 flex flex-col items-center justify-center text-white/70 text-xs gap-3 p-8 my-auto">
      <div class="w-6 h-6 border-2 border-[#D4AF37] border-t-transparent rounded-full animate-spin"></div>
      <span class="font-mono text-[11px]">Menyiapkan sesi checkout aman tertaut.com...</span>
    </div>

    <!-- Not Found State -->
    <div v-else-if="notFound"
      class="relative z-10 w-full max-w-md rounded-2xl border border-white/10 bg-[#111215]/95 backdrop-blur-2xl p-8 text-center space-y-4 shadow-2xl my-auto">
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
        class="relative z-10 w-full max-w-4xl h-auto lg:h-[540px] lg:max-h-[calc(100vh-5rem)] rounded-2xl border border-slate-200/90 bg-white text-slate-900 shadow-[0_25px_70px_rgba(0,0,0,0.6)] overflow-hidden grid grid-cols-1 lg:grid-cols-2 shrink-0 my-auto">

        <!-- LEFT PANE: Order Summary & Product Details (Desktop & Mobile) -->
        <PayOrderSummary
          :product="product"
          :applied-coupon="appliedCoupon"
          :coupon-input="couponInput"
          :coupon-error="couponError"
          :estimated-discount="estimatedDiscount"
          :payable-amount="payableAmount"
          :is-mobile-order-expanded="isMobileOrderExpanded"
          @update:coupon-input="couponInput = $event"
          @update:is-mobile-order-expanded="isMobileOrderExpanded = $event"
          @apply-coupon="applyCoupon"
          @remove-coupon="appliedCoupon = null; couponInput = ''"
        />

        <!-- RIGHT PANE: Payment Form & Multi-Rail Selection -->
        <div class="flex flex-col h-full overflow-hidden bg-white text-slate-900">
          <div class="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-7 xl:p-8 custom-scrollbar flex flex-col justify-between">
            <PayPaymentForm
              :product="product"
              :email-input="emailInput"
              :selected-payment-rail="selectedPaymentRail"
              :payable-amount="payableAmount"
              :is-submitting="isSubmitting"
              :error-message="errorMessage"
              :sandbox-session-id="sandboxSessionId"
              :sandbox-result="sandboxResult"
              :is-simulating="isSimulating"
              @update:email-input="emailInput = $event"
              @update:selected-payment-rail="selectedPaymentRail = $event"
              @pay="handlePay"
              @simulate="simulateSandboxPayment"
            />

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
