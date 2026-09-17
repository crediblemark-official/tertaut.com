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
  <div class="min-h-screen w-full bg-white text-[#111111] flex items-center justify-center p-4 sm:p-8 lg:p-12 animate-fadeIn">
    <!-- Loading State -->
    <div v-if="loading" class="flex items-center justify-center text-[#111111]/60 text-xs gap-2 p-8">
      <div class="w-4 h-4 border-2 border-[#D4AF37] border-t-transparent rounded-full animate-spin"></div>
      <span>Menyiapkan sesi pembayaran aman...</span>
    </div>

    <!-- Not Found State -->
    <div v-else-if="notFound" class="flex flex-col items-center justify-center text-center p-6 space-y-3">
      <div class="w-12 h-12 mx-auto rounded-full bg-[#8B0000]/10 flex items-center justify-center text-[#8B0000]">
        <Lock class="w-6 h-6" />
      </div>
      <h1 class="text-lg font-black text-[#111111]">Produk Pembayaran Tidak Ditemukan</h1>
      <p class="text-xs text-[#111111]/60 max-w-sm leading-relaxed">Tautan pembayaran tidak valid, kedaluwarsa, atau produk belum diluncurkan.</p>
      <router-link to="/dashboard" class="inline-block mt-2 text-xs font-bold text-[#D4AF37] hover:underline">
        Kembali ke Dashboard
      </router-link>
    </div>

    <!-- 2-Column Checkout (Compact, Centered, No Container Card, Clean Dividers) -->
    <div v-else-if="product" class="w-full max-w-4xl mx-auto">
      <div class="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-[#111111]/10">
        
        <!-- ============================================== -->
        <!-- KOLOM KIRI (5 cols): Order Summary & Branding  -->
        <!-- ============================================== -->
        <div class="lg:col-span-5 pb-8 lg:pb-0 lg:pr-8 space-y-6">
          <!-- Brand & Merchant of Record Header -->
          <div class="flex items-center justify-between pb-4 border-b border-[#111111]/10">
            <div class="flex items-center gap-2.5">
              <div class="w-8 h-8 rounded-xl bg-[#111111] flex items-center justify-center font-bold text-white text-xs shadow-xs">
                T
              </div>
              <div>
                <div class="text-xs font-extrabold text-[#111111] font-mono tracking-tight">
                  tertaut<span class="text-[#D4AF37]">.com</span>
                </div>
                <div class="text-[9px] text-[#111111]/50 font-medium">Official Merchant of Record (MoR)</div>
              </div>
            </div>

            <div v-if="product.mode === 'sandbox'" class="flex items-center gap-1 text-[10px] font-bold text-[#2563EB] bg-[#2563EB]/10 px-2.5 py-1 rounded-full border border-[#2563EB]/30">
              <FlaskConical class="w-3.5 h-3.5" />
              <span>Sandbox</span>
            </div>
            <div v-else class="flex items-center gap-1 text-[10px] font-bold text-[#0F4C3A] bg-[#0F4C3A]/10 px-2.5 py-1 rounded-full border border-[#0F4C3A]/25">
              <ShieldCheck class="w-3.5 h-3.5" />
              <span>Xendit Secured</span>
            </div>
          </div>

          <!-- Product Headline & Description -->
          <div class="space-y-1.5">
            <div class="text-[10px] font-mono font-bold uppercase text-[#D4AF37] tracking-wider">Pesanan Lisensi Digital</div>
            <h1 class="text-2xl font-black text-[#111111] tracking-tight">
              {{ product.headline || product.name }}
            </h1>
            <p class="text-xs text-[#111111]/70 leading-relaxed">
              {{ product.subheadline || product.description }}
            </p>
          </div>

          <!-- Optional Product Media/Screenshot -->
          <div v-if="product.mediaUrl" class="rounded-xl overflow-hidden border border-[#111111]/10">
            <img :src="product.mediaUrl" :alt="product.name" class="w-full h-auto object-cover max-h-48" />
          </div>

          <!-- Product Value Propositions (Feature bullets) -->
          <div v-if="product.valueProps && product.valueProps.length > 0" class="space-y-2">
            <div v-for="(vp, idx) in product.valueProps" :key="idx" class="flex items-start gap-2 text-xs text-[#111111]/80">
              <CheckCircle2 class="w-4 h-4 text-[#0F4C3A] shrink-0 mt-0.5" />
              <span class="leading-tight">{{ vp }}</span>
            </div>
          </div>

          <!-- Price Breakdown: Flat Divider Lines -->
          <div class="py-4 border-t border-b border-[#111111]/10 space-y-2.5">
            <div class="flex items-center justify-between text-xs">
              <span class="text-[#111111]/70">{{ product.name }}</span>
              <span class="font-mono font-bold text-[#111111]">{{ formatRupiah(product.targetPrice) }}</span>
            </div>
            <div class="flex items-center justify-between text-[11px] text-[#111111]/50">
              <span>Biaya Layanan &amp; PPN</span>
              <span class="text-[#0F4C3A] font-bold">Gratis (Ditanggung Penjual)</span>
            </div>

            <!-- Kupon Diskon -->
            <div class="space-y-1.5 pt-1 border-t border-[#111111]/5">
              <div v-if="appliedCoupon" class="flex items-center justify-between text-xs">
                <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#0F4C3A]/10 border border-[#0F4C3A]/30 text-[#0F4C3A] font-bold">
                  <CheckCircle2 class="w-3 h-3" />
                  {{ appliedCoupon.code }} (−{{ appliedCoupon.discountPercent }}%)
                </span>
                <button
                  @click="appliedCoupon = null; couponInput = ''"
                  class="text-[#111111]/40 underline hover:text-[#111111] cursor-pointer"
                >Hapus</button>
              </div>
              <div v-else class="flex items-center gap-2">
                <input
                  v-model="couponInput"
                  type="text"
                  placeholder="Kode kupon (opsional)"
                  class="flex-1 bg-[#FAFAFA] border border-[#111111]/15 rounded-lg px-2.5 py-1.5 text-xs uppercase font-mono text-[#111111] placeholder:normal-case placeholder:font-sans placeholder:text-[#111111]/35 focus:outline-none focus:border-[#D4AF37]"
                  @keyup.enter="applyCoupon"
                />
                <button
                  @click="applyCoupon"
                  :disabled="!couponInput.trim()"
                  class="px-3 py-1.5 rounded-lg bg-[#111111] text-[#D4AF37] text-xs font-bold disabled:opacity-40 cursor-pointer hover:bg-[#222222] transition"
                >Pakai</button>
              </div>
              <p v-if="couponError" class="text-[10px] text-[#8B0000] font-bold">{{ couponError }}</p>
            </div>

            <div v-if="estimatedDiscount > 0" class="flex items-center justify-between text-xs text-[#0F4C3A] font-bold">
              <span>Diskon kupon</span>
              <span class="font-mono">−{{ formatRupiah(estimatedDiscount) }}</span>
            </div>
          </div>

          <!-- Total Pembayaran -->
          <div class="flex items-baseline justify-between pt-0.5">
            <span class="text-xs font-bold text-[#111111]/80 uppercase tracking-wider">Total Pembayaran</span>
            <span class="text-2xl font-black text-[#111111] font-mono">
              {{ formatRupiah(payableAmount || product.targetPrice) }}
            </span>
          </div>

          <!-- Trust Badges Footer (Left Column) -->
          <div class="pt-4 border-t border-[#111111]/10 grid grid-cols-2 gap-2 text-[10px] text-[#111111]/60">
            <div class="flex items-center gap-1.5">
              <Lock class="w-3.5 h-3.5 text-[#0F4C3A] shrink-0" />
              <span>Enkripsi 256-Bit SSL</span>
            </div>
            <div class="flex items-center gap-1.5">
              <Sparkles class="w-3.5 h-3.5 text-[#D4AF37] shrink-0" />
              <span>Aktivasi Lisensi Instan</span>
            </div>
          </div>
        </div>

        <!-- ============================================== -->
        <!-- KOLOM KANAN (7 cols): Checkout & Payment Form  -->
        <!-- ============================================== -->
        <div class="lg:col-span-7 pt-8 lg:pt-0 lg:pl-8 space-y-5">
          <div class="pb-3 border-b border-[#111111]/10">
            <h2 class="text-lg font-bold text-[#111111] tracking-tight">Detail Pembayaran</h2>
            <p class="text-xs text-[#111111]/60 mt-0.5">Lengkapi informasi untuk penerbitan lisensi resmi Anda.</p>
          </div>

          <!-- Buyer Email Input for License Delivery -->
          <div v-if="!sandboxSessionId" class="space-y-1.5">
            <label class="block text-xs font-bold text-[#111111]/80">
              Email Penerima Lisensi Digital <span class="text-[#8B0000]">*</span>
            </label>
            <input
              v-model="emailInput"
              type="email"
              placeholder="nama@email.com"
              class="w-full bg-white border border-[#111111]/20 rounded-xl px-3.5 py-2.5 text-xs text-[#111111] placeholder-[#111111]/40 focus:outline-none focus:border-[#D4AF37] transition"
              @keyup.enter="handlePay"
            />
            <p class="text-[10px] text-[#111111]/50 leading-relaxed">
              Kunci lisensi resmi dan petunjuk aktivasi akan dikirimkan otomatis ke alamat email ini segera setelah pembayaran dikonfirmasi.
            </p>
          </div>

          <!-- Multi-Rail Payment Options Selector (FR-2.1) -->
          <div v-if="!sandboxSessionId" class="space-y-2">
            <label class="block text-[11px] font-bold text-[#111111]/70">Pilih Jalur Pembayaran Resmi</label>
            <div class="grid grid-cols-3 gap-2.5">
              <button
                type="button"
                @click="selectedPaymentRail = 'qris'"
                class="p-2.5 rounded-xl border text-center transition flex flex-col items-center justify-center gap-1 cursor-pointer"
                :class="selectedPaymentRail === 'qris' ? 'border-[#D4AF37] bg-[#D4AF37]/10 font-bold text-[#111111] shadow-xs' : 'border-[#111111]/15 hover:bg-[#111111]/5 text-[#111111]/70'"
              >
                <QrCode class="w-4 h-4 text-[#D4AF37]" />
                <span class="text-[11px]">QRIS Instan</span>
              </button>

              <button
                type="button"
                @click="selectedPaymentRail = 'va'"
                class="p-2.5 rounded-xl border text-center transition flex flex-col items-center justify-center gap-1 cursor-pointer"
                :class="selectedPaymentRail === 'va' ? 'border-[#D4AF37] bg-[#D4AF37]/10 font-bold text-[#111111] shadow-xs' : 'border-[#111111]/15 hover:bg-[#111111]/5 text-[#111111]/70'"
              >
                <Building class="w-4 h-4 text-[#111111]" />
                <span class="text-[11px]">Virtual Account</span>
              </button>

              <button
                type="button"
                @click="selectedPaymentRail = 'ewallet'"
                class="p-2.5 rounded-xl border text-center transition flex flex-col items-center justify-center gap-1 cursor-pointer"
                :class="selectedPaymentRail === 'ewallet' ? 'border-[#D4AF37] bg-[#D4AF37]/10 font-bold text-[#111111] shadow-xs' : 'border-[#111111]/15 hover:bg-[#111111]/5 text-[#111111]/70'"
              >
                <Wallet class="w-4 h-4 text-[#0F4C3A]" />
                <span class="text-[11px]">E-Wallet</span>
              </button>
            </div>
            <div class="flex items-center justify-between text-[10px] text-[#111111]/50 px-1 pt-0.5">
              <span>Mendukung BCA, Mandiri, BRI, BNI</span>
              <span>GoPay, OVO, DANA, ShopeePay</span>
            </div>
          </div>

          <!-- Error Alert -->
          <div v-if="errorMessage" class="p-3 rounded-xl bg-[#8B0000]/10 border border-[#8B0000]/25 text-[#8B0000] text-xs font-bold">
              {{ errorMessage }}
          </div>

          <!-- Sandbox: Simulasi Pembayaran Inline -->
          <div v-if="sandboxSessionId && !sandboxResult" class="space-y-3 p-3.5 rounded-xl bg-[#2563EB]/5 border border-[#2563EB]/25">
            <div class="flex items-start gap-2">
              <FlaskConical class="w-4 h-4 text-[#2563EB] shrink-0 mt-0.5" />
              <div class="space-y-0.5">
                <p class="text-xs font-bold text-[#2563EB]">Sesi Pembayaran Sandbox Siap</p>
                <p class="text-[10px] text-[#111111]/60">
                  Tidak ada transaksi nyata yang akan ditagihkan. Klik tombol di bawah untuk mensimulasikan lunas dan menerbitkan lisensi uji coba.
                </p>
              </div>
            </div>
            <button
              @click="simulateSandboxPayment"
              :disabled="isSimulating"
              class="w-full py-2.5 rounded-xl bg-[#2563EB] text-white text-xs font-bold transition hover:bg-[#1D4ED8] flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              <FlaskConical class="w-4 h-4" />
              <span>{{ isSimulating ? 'Mensimulasikan…' : 'Simulasikan Pembayaran' }}</span>
            </button>
          </div>

          <!-- Sandbox: Hasil Simulasi -->
          <div v-if="sandboxResult" class="space-y-2 p-3.5 rounded-xl bg-[#0F4C3A]/10 border border-[#0F4C3A]/30">
            <div class="flex items-start gap-2">
              <CheckCircle2 class="w-4 h-4 text-[#0F4C3A] shrink-0 mt-0.5" />
              <div class="space-y-1 w-full">
                <p class="text-xs font-bold text-[#0F4C3A]">Simulasi Pembayaran Berhasil</p>
                <p class="text-[10px] text-[#111111]/70">{{ sandboxResult.message }}</p>
                <div v-if="sandboxResult.licenseKey" class="pt-1.5 border-t border-[#0F4C3A]/20">
                  <p class="text-[10px] font-bold text-[#111111]/60 mb-1">Kunci Lisensi Uji Coba Anda:</p>
                  <div class="p-2 bg-white rounded-lg border border-[#0F4C3A]/30 font-mono font-extrabold text-[#0F4C3A] text-xs break-all select-all text-center">
                    {{ sandboxResult.licenseKey }}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Pay Button -->
          <div v-if="!sandboxSessionId" class="pt-1">
            <button
              @click="handlePay"
              :disabled="isSubmitting || !emailInput"
              class="w-full py-3 rounded-xl btn-gold text-xs font-bold transition flex items-center justify-center gap-2 active:scale-98 disabled:opacity-50 cursor-pointer shadow-gold-glow"
              :class="product.mode === 'sandbox' ? '!bg-[#2563EB] !text-white hover:!bg-[#1D4ED8]' : ''"
            >
              <FlaskConical v-if="product.mode === 'sandbox'" class="w-4 h-4" />
              <CreditCard v-else class="w-4 h-4" />
              <span>
                {{ isSubmitting ? 'Menyiapkan sesi...' : product.mode === 'sandbox' ? `Mulai Sesi Sandbox — ${formatRupiah(payableAmount || product.targetPrice)}` : `Bayar Sekarang — ${formatRupiah(payableAmount || product.targetPrice)}` }}
              </span>
              <ArrowRight class="w-3.5 h-3.5" />
            </button>
          </div>

          <!-- Bottom Assurance Note -->
          <div class="pt-3 border-t border-[#111111]/10 text-center">
            <p class="text-[10px] text-[#111111]/50 leading-relaxed">
              Pembayaran diproses secara aman oleh <span class="font-bold text-[#111111]/70">Xendit Indonesia</span>. Merchant of Record resmi oleh <span class="font-bold text-[#111111]/70">tertaut.com</span>. Faktur dan garansi berlaku penuh.
            </p>
          </div>
        </div>

      </div>
    </div>
  </div>
</template>
