<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  Mail,
  QrCode,
  Building,
  Wallet,
  FlaskConical,
  CreditCard,
  ArrowRight,
  CheckCircle2,
  Copy,
  Check,
  RotateCcw,
  Clock,
  ShieldCheck
} from 'lucide-vue-next'
import { formatRupiah } from '../../lib/utils'

interface ProductData {
  id: string
  name: string
  slug: string
  mode: 'sandbox' | 'live'
  targetPrice: number
}

const props = defineProps<{
  product: ProductData
  emailInput: string
  selectedPaymentRail: 'qris' | 'va' | 'ewallet'
  selectedBank?: string
  payableAmount: number
  isSubmitting: boolean
  errorMessage: string
  activeOrder?: {
    transactionId: string
    scenario?: string
    paymentRail?: string
    paymentCode?: string
    qrDataUrl?: string
    vaBank?: string
    amount?: number
    checkoutUrl?: string
  } | null
  isPaid?: boolean
  paidResult?: { licenseKey?: string; message?: string } | null
  sandboxSessionId: string | null
  sandboxResult: { message: string; licenseKey?: string } | null
  isSimulating: boolean
}>()

const emit = defineEmits<{
  'update:emailInput': [value: string]
  'update:selectedPaymentRail': [value: 'qris' | 'va' | 'ewallet']
  'update:selectedBank': [value: string]
  'pay': []
  'simulate': []
  'resetOrder': []
}>()

const emailValue = computed({
  get: () => props.emailInput,
  set: (val: string) => emit('update:emailInput', val)
})

const currentBank = computed({
  get: () => props.selectedBank || 'BCA',
  set: (val: string) => emit('update:selectedBank', val)
})

const copiedVa = ref(false)
const copiedLicense = ref(false)

function copyToClipboard(text: string, isLicense = false) {
  if (!text) return
  navigator.clipboard.writeText(text)
  if (isLicense) {
    copiedLicense.value = true
    setTimeout(() => { copiedLicense.value = false }, 2500)
  } else {
    copiedVa.value = true
    setTimeout(() => { copiedVa.value = false }, 2500)
  }
}

const BANKS = [
  { id: 'BCA', label: 'BCA' },
  { id: 'MANDIRI', label: 'Mandiri' },
  { id: 'BNI', label: 'BNI' },
  { id: 'BRI', label: 'BRI' },
  { id: 'CIMB', label: 'CIMB' },
  { id: 'PERMATA', label: 'Permata' },
]
</script>

<template>
  <div class="space-y-4">
    <!-- ======================================================== -->
    <!-- 1. PAID SUCCESS STATE (Real-time Confirmed via Webhook)  -->
    <!-- ======================================================== -->
    <div v-if="isPaid || sandboxResult" class="space-y-4 p-4 sm:p-5 rounded-2xl bg-emerald-50/80 border border-emerald-200">
      <div class="flex items-start gap-3">
        <div class="p-2 rounded-xl bg-emerald-500 text-white shadow-xs shrink-0 mt-0.5">
          <CheckCircle2 class="w-5 h-5" />
        </div>
        <div class="space-y-1 w-full">
          <p class="text-xs sm:text-sm font-extrabold text-emerald-950">Pembayaran Berhasil Diverifikasi!</p>
          <p class="text-xs text-slate-700 leading-relaxed">
            Terima kasih! Pembayaran Anda telah terkonfirmasi oleh DANA Enterprise. Lisensi software Anda sudah aktif.
          </p>
        </div>
      </div>

      <div v-if="(paidResult?.licenseKey || sandboxResult?.licenseKey)" class="pt-3 border-t border-emerald-200 space-y-2">
        <div class="flex items-center justify-between">
          <span class="text-xs font-bold text-slate-800">Kunci Lisensi Resmi Anda</span>
          <span class="text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
            <ShieldCheck class="w-3.5 h-3.5" /> Terproteksi Ed25519
          </span>
        </div>
        <div class="relative group">
          <div
            class="p-3 bg-slate-900 rounded-xl border border-slate-700 font-mono font-bold text-emerald-400 text-xs sm:text-sm tracking-wider break-all select-all text-center shadow-inner">
            {{ paidResult?.licenseKey || sandboxResult?.licenseKey }}
          </div>
          <button @click="copyToClipboard(paidResult?.licenseKey || sandboxResult?.licenseKey || '', true)"
            type="button"
            class="mt-2 w-full py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs">
            <Check v-if="copiedLicense" class="w-3.5 h-3.5" />
            <Copy v-else class="w-3.5 h-3.5" />
            <span>{{ copiedLicense ? 'Kunci Lisensi Tersalin!' : 'Salin Kunci Lisensi' }}</span>
          </button>
        </div>
        <p class="text-[11px] text-slate-600 text-center pt-1">
          Kunci lisensi ini juga telah dikirimkan ke email <span class="font-bold text-slate-900">{{ emailInput }}</span>.
        </p>
      </div>
    </div>

    <!-- ======================================================== -->
    <!-- 2. GAPURA CUSTOM CHECKOUT ACTIVE ORDER (QRIS / VA)       -->
    <!-- ======================================================== -->
    <div v-else-if="activeOrder" class="space-y-4">
      <!-- Status Pulse Header -->
      <div class="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span class="relative flex h-2.5 w-2.5">
            <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </span>
          <span class="text-xs font-bold text-slate-800">Menunggu Pembayaran...</span>
        </div>
        <span class="text-xs font-black text-slate-900 font-mono">
          {{ formatRupiah(activeOrder.amount || payableAmount) }}
        </span>
      </div>

      <!-- A. QRIS VIEW -->
      <div v-if="activeOrder.paymentRail === 'qris'" class="space-y-3">
        <div class="p-4 rounded-2xl border-2 border-slate-200 bg-white text-center flex flex-col items-center justify-center shadow-xs">
          <!-- QRIS Badge Header -->
          <div class="flex items-center gap-1.5 mb-3 px-3 py-1 rounded-full bg-slate-100 text-slate-800 text-[11px] font-bold">
            <QrCode class="w-3.5 h-3.5 text-gold-hover" />
            <span>QRIS Nasional (NMID DANA)</span>
          </div>

          <!-- QR Code Image -->
          <div class="p-2 bg-white rounded-xl border border-slate-200 shadow-inner inline-block">
            <img v-if="activeOrder.qrDataUrl" :src="activeOrder.qrDataUrl" alt="QRIS Code" class="w-52 h-52 object-contain mx-auto" />
            <div v-else class="w-52 h-52 flex items-center justify-center bg-slate-100 text-xs font-mono text-slate-500">
              Menyiapkan QR Code...
            </div>
          </div>

          <p class="text-xs font-bold text-slate-900 mt-3">Scan dengan Aplikasi Pembayaran Apa Saja</p>
          <p class="text-[11px] text-slate-600 mt-1 max-w-xs leading-relaxed">
            Dukung BCA Mobile, Livin' Mandiri, GoPay, DANA, OVO, ShopeePay, LinkAja, & semua aplikasi perbankan.
          </p>
        </div>
      </div>

      <!-- B. VIRTUAL ACCOUNT VIEW -->
      <div v-else-if="activeOrder.paymentRail === 'va'" class="space-y-3">
        <div class="p-4 rounded-2xl border-2 border-slate-200 bg-white shadow-xs space-y-3">
          <div class="flex items-center justify-between pb-2 border-b border-slate-100">
            <div class="flex items-center gap-2">
              <Building class="w-4 h-4 text-cyan-700" />
              <span class="text-xs font-bold text-slate-900">Virtual Account {{ activeOrder.vaBank || 'Bank' }}</span>
            </div>
            <span class="text-[11px] font-semibold text-slate-500">Otomatis Terverifikasi</span>
          </div>

          <div class="space-y-1">
            <label class="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Nomor Rekening Virtual Account</label>
            <div class="flex items-center gap-2">
              <div class="flex-1 p-3 bg-slate-100 rounded-xl border border-slate-200 font-mono font-bold text-sm sm:text-base text-slate-900 tracking-wider select-all">
                {{ activeOrder.paymentCode }}
              </div>
              <button @click="copyToClipboard(activeOrder.paymentCode || '')" type="button"
                class="px-3.5 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition flex items-center gap-1.5 shrink-0 cursor-pointer shadow-xs">
                <Check v-if="copiedVa" class="w-3.5 h-3.5 text-emerald-400" />
                <Copy v-else class="w-3.5 h-3.5" />
                <span>{{ copiedVa ? 'Tersalin' : 'Salin' }}</span>
              </button>
            </div>
          </div>

          <div class="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-[11px] text-slate-600 space-y-1">
            <p class="font-bold text-slate-800">Petunjuk Pembayaran:</p>
            <p>1. Buka m-Banking atau ATM {{ activeOrder.vaBank || 'Bank Anda' }}</p>
            <p>2. Pilih menu <span class="font-semibold">Transfer / Bayar > Virtual Account</span></p>
            <p>3. Masukkan nomor VA di atas dan konfirmasi nominal tepat <span class="font-bold text-slate-900">{{ formatRupiah(activeOrder.amount || payableAmount) }}</span></p>
          </div>
        </div>
      </div>

      <!-- Sandbox Quick Simulator Button -->
      <div v-if="product.mode === 'sandbox'" class="p-3 rounded-xl bg-blue-50 border border-blue-200 space-y-2">
        <div class="flex items-center gap-2 text-blue-900 text-xs font-bold">
          <FlaskConical class="w-4 h-4 text-blue-600" />
          <span>Mode Pengujian Sandbox</span>
        </div>
        <button @click="emit('simulate')" :disabled="isSimulating" type="button"
          class="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-xs disabled:opacity-50">
          <FlaskConical class="w-3.5 h-3.5" />
          <span>{{ isSimulating ? 'Memvalidasi...' : 'Simulasikan Pembayaran Lunas' }}</span>
        </button>
      </div>

      <!-- Action Buttons -->
      <div class="pt-1 flex items-center justify-between text-xs">
        <button @click="emit('resetOrder')" type="button"
          class="inline-flex items-center gap-1.5 text-slate-600 hover:text-slate-900 font-semibold transition cursor-pointer">
          <RotateCcw class="w-3.5 h-3.5" />
          <span>Ganti Metode / Batal</span>
        </button>
        <span class="text-[11px] text-slate-600 flex items-center gap-1">
          <Clock class="w-3 h-3" /> Berlaku 30 Menit
        </span>
      </div>
    </div>

    <!-- ======================================================== -->
    <!-- 3. INITIAL PAYMENT SELECTION FORM                        -->
    <!-- ======================================================== -->
    <div v-else class="space-y-4">
      <!-- Email Input -->
      <div class="space-y-1.5">
        <label class="block text-xs font-bold text-slate-900">
          Email Penerima Lisensi Digital <span class="text-amber-500">*</span>
        </label>
        <div class="relative">
          <Mail class="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-500" />
          <input v-model="emailValue" type="email" required placeholder="nama@email.com"
            class="auth-input w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-xs sm:text-sm font-semibold text-slate-950 placeholder-slate-400 outline-none transition focus:border-slate-800 focus:ring-1 focus:ring-slate-800"
            @keyup.enter="emit('pay')" />
        </div>
        <p class="text-xs text-slate-600 leading-relaxed font-normal">
          Kunci lisensi resmi dan petunjuk aktivasi otomatis dikirimkan ke alamat email ini setelah pembayaran tervalidasi.
        </p>
      </div>

      <!-- Multi-Rail Selector (QRIS, VA, E-Wallet) -->
      <div class="space-y-2">
        <label class="block text-xs font-bold text-slate-900">Pilih Jalur Pembayaran Resmi</label>
        <div class="grid grid-cols-3 gap-2 sm:gap-2.5">
          <button type="button" @click="emit('update:selectedPaymentRail', 'qris')"
            class="p-3 rounded-xl border-2 text-center transition flex flex-col items-center justify-center gap-1.5 cursor-pointer"
            :class="selectedPaymentRail === 'qris'
              ? 'border-gold bg-gold-light text-jetblack font-bold shadow-xs'
              : 'border-slate-200 bg-slate-50/70 hover:bg-slate-100 text-slate-800 font-semibold'">
            <QrCode class="w-5 h-5 text-gold-hover" />
            <span class="text-xs font-bold">QRIS Instan</span>
          </button>

          <button type="button" @click="emit('update:selectedPaymentRail', 'va')"
            class="p-3 rounded-xl border-2 text-center transition flex flex-col items-center justify-center gap-1.5 cursor-pointer"
            :class="selectedPaymentRail === 'va'
              ? 'border-gold bg-gold-light text-jetblack font-bold shadow-xs'
              : 'border-slate-200 bg-slate-50/70 hover:bg-slate-100 text-slate-800 font-semibold'">
            <Building class="w-5 h-5 text-cyan-700" />
            <span class="text-xs font-bold">Virtual Account</span>
          </button>

          <button type="button" @click="emit('update:selectedPaymentRail', 'ewallet')"
            class="p-3 rounded-xl border-2 text-center transition flex flex-col items-center justify-center gap-1.5 cursor-pointer"
            :class="selectedPaymentRail === 'ewallet'
              ? 'border-gold bg-gold-light text-jetblack font-bold shadow-xs'
              : 'border-slate-200 bg-slate-50/70 hover:bg-slate-100 text-slate-800 font-semibold'">
            <Wallet class="w-5 h-5 text-emerald-700" />
            <span class="text-xs font-bold">DANA Wallet</span>
          </button>
        </div>

        <!-- Bank Selector Dropdown / Grid (Only when VA is selected) -->
        <div v-if="selectedPaymentRail === 'va'" class="pt-2 space-y-1.5 animate-fadeIn">
          <label class="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">Pilih Bank Virtual Account</label>
          <div class="grid grid-cols-3 gap-1.5">
            <button v-for="b in BANKS" :key="b.id" type="button" @click="currentBank = b.id"
              class="py-2 px-2.5 rounded-lg border text-xs font-bold transition text-center cursor-pointer"
              :class="currentBank === b.id
                ? 'border-slate-900 bg-slate-900 text-white shadow-xs'
                : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'">
              {{ b.label }}
            </button>
          </div>
        </div>

        <div class="flex items-center justify-between text-[11px] font-semibold text-slate-600 px-1 pt-0.5">
          <span>{{ selectedPaymentRail === 'va' ? 'Nomor VA langsung muncul' : 'BCA, Mandiri, BRI, BNI, GoPay, DANA' }}</span>
          <span>Tanpa Biaya Admin</span>
        </div>
      </div>

      <!-- Error Alert -->
      <div v-if="errorMessage"
        class="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold">
        {{ errorMessage }}
      </div>

      <!-- Pay Button -->
      <div class="pt-1">
        <button @click="emit('pay')" :disabled="isSubmitting || !emailInput"
          class="w-full flex items-center justify-center gap-2 rounded-xl btn-gold active:scale-[0.99] px-4 py-3 text-xs sm:text-sm font-extrabold text-jetblack shadow-md transition duration-150 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          :class="product.mode === 'sandbox' ? '!bg-blue-600 !text-white hover:!bg-blue-500 !border-transparent' : ''">
          <FlaskConical v-if="product.mode === 'sandbox'" class="w-4 h-4" />
          <CreditCard v-else class="w-4 h-4 text-jetblack" />
          <span>
            {{ isSubmitting ? 'Membuat kode pembayaran...' : product.mode === 'sandbox' ? `Mulai Sesi Sandbox — ${formatRupiah(payableAmount || product.targetPrice)}` : `Bayar Sekarang — ${formatRupiah(payableAmount || product.targetPrice)}` }}
          </span>
          <ArrowRight v-if="!isSubmitting" class="w-4 h-4 ml-0.5 text-slate-950" />
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}
.animate-fadeIn {
  animation: fadeIn 0.2s ease-out;
}
</style>
