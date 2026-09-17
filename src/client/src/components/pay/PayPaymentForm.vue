<script setup lang="ts">
import { computed } from 'vue'
import {
  Mail,
  QrCode,
  Building,
  Wallet,
  FlaskConical,
  CreditCard,
  ArrowRight,
  CheckCircle2
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
  payableAmount: number
  isSubmitting: boolean
  errorMessage: string
  sandboxSessionId: string | null
  sandboxResult: { message: string; licenseKey?: string } | null
  isSimulating: boolean
}>()

const emit = defineEmits<{
  'update:emailInput': [value: string]
  'update:selectedPaymentRail': [value: 'qris' | 'va' | 'ewallet']
  'pay': []
  'simulate': []
}>()

const emailValue = computed({
  get: () => props.emailInput,
  set: (val: string) => emit('update:emailInput', val)
})
</script>

<template>
  <div class="space-y-4">
    <!-- Email Input -->
    <div v-if="!sandboxSessionId" class="space-y-1.5">
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
        Kunci lisensi resmi dan petunjuk aktivasi otomatis dikirimkan ke alamat email ini setelah pembayaran
        tervalidasi.
      </p>
    </div>

    <!-- Multi-Rail Selector (QRIS, VA, E-Wallet) -->
    <div v-if="!sandboxSessionId" class="space-y-2">
      <label class="block text-xs font-bold text-slate-900">Pilih Jalur Pembayaran Resmi</label>
      <div class="grid grid-cols-3 gap-2 sm:gap-2.5">
        <button type="button" @click="emit('update:selectedPaymentRail', 'qris')"
          class="p-3 rounded-xl border-2 text-center transition flex flex-col items-center justify-center gap-1.5 cursor-pointer"
          :class="selectedPaymentRail === 'qris'
            ? 'border-amber-500 bg-amber-50/90 text-slate-950 font-bold shadow-xs'
            : 'border-slate-200 bg-slate-50/70 hover:bg-slate-100 text-slate-800 font-semibold'">
          <QrCode class="w-5 h-5 text-amber-600" />
          <span class="text-xs font-bold">QRIS Instan</span>
        </button>

        <button type="button" @click="emit('update:selectedPaymentRail', 'va')"
          class="p-3 rounded-xl border-2 text-center transition flex flex-col items-center justify-center gap-1.5 cursor-pointer"
          :class="selectedPaymentRail === 'va'
            ? 'border-amber-500 bg-amber-50/90 text-slate-950 font-bold shadow-xs'
            : 'border-slate-200 bg-slate-50/70 hover:bg-slate-100 text-slate-800 font-semibold'">
          <Building class="w-5 h-5 text-cyan-700" />
          <span class="text-xs font-bold">Virtual Account</span>
        </button>

        <button type="button" @click="emit('update:selectedPaymentRail', 'ewallet')"
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
      <button @click="emit('simulate')" :disabled="isSimulating"
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
      <button @click="emit('pay')" :disabled="isSubmitting || !emailInput"
        class="w-full flex items-center justify-center gap-2 rounded-xl bg-amber-400 hover:bg-amber-300 active:scale-[0.99] px-4 py-3 text-xs sm:text-sm font-extrabold text-slate-950 shadow-md transition duration-150 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer border border-amber-500/20"
        :class="product.mode === 'sandbox' ? '!bg-blue-600 !text-white hover:!bg-blue-500 !border-transparent' : ''">
        <FlaskConical v-if="product.mode === 'sandbox'" class="w-4 h-4" />
        <CreditCard v-else class="w-4 h-4 text-slate-950" />
        <span>
          {{ isSubmitting ? 'Menyiapkan sesi...' : product.mode === 'sandbox' ? `Mulai Sesi Sandbox — ${formatRupiah(payableAmount || product.targetPrice)}` : `Bayar Sekarang — ${formatRupiah(payableAmount || product.targetPrice)}` }}
        </span>
        <ArrowRight v-if="!isSubmitting" class="w-4 h-4 ml-0.5 text-slate-950" />
      </button>
    </div>
  </div>
</template>
