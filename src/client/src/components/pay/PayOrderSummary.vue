<script setup lang="ts">
import { computed } from 'vue'
import {
  CheckCircle2,
  Lock,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Mail
} from 'lucide-vue-next'
import { formatRupiah } from '../../lib/utils'

interface ProductData {
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
}

interface AppliedCoupon {
  code: string
  discountPercent: number
  discountAmount: number
}

const props = defineProps<{
  product: ProductData
  emailInput: string
  activeOrder?: any
  isPaid?: boolean
  appliedCoupon: AppliedCoupon | null
  couponInput: string
  couponError: string
  estimatedDiscount: number
  payableAmount: number
  isMobileOrderExpanded: boolean
}>()

const emit = defineEmits<{
  'update:emailInput': [value: string]
  'update:couponInput': [value: string]
  'update:isMobileOrderExpanded': [value: boolean]
  'applyCoupon': []
  'removeCoupon': []
  'pay': []
}>()

const emailInputValue = computed({
  get: () => props.emailInput,
  set: (val: string) => emit('update:emailInput', val)
})

const couponInputValue = computed({
  get: () => props.couponInput,
  set: (val: string) => emit('update:couponInput', val)
})
</script>

<template>
  <!-- Desktop Left Pane: Order Summary & Product Details -->
  <div class="hidden lg:flex flex-col justify-between p-6 xl:p-7 border-r border-slate-200 bg-slate-50/70 h-full overflow-y-auto custom-scrollbar shrink-0">
    <div class="space-y-3.5 my-auto py-1">
      <div class="space-y-1.5">
        <h1 class="text-2xl xl:text-3xl font-black tracking-tight text-slate-950 leading-tight">
          {{ product.headline || product.name }}
        </h1>
        <p class="text-xs sm:text-sm text-slate-600 leading-relaxed font-normal line-clamp-2">
          {{ product.subheadline || product.description }}
        </p>
      </div>

      <!-- Value Propositions Bullets -->
      <div v-if="product.valueProps && product.valueProps.length > 0" class="space-y-2 py-0.5">
        <div v-for="(vp, idx) in product.valueProps.slice(0, 3)" :key="idx"
          class="flex items-center gap-2 text-xs sm:text-sm font-semibold text-slate-800">
          <CheckCircle2 class="w-4 h-4 text-emerald-600 shrink-0" />
          <span class="leading-tight">{{ vp }}</span>
        </div>
      </div>

      <!-- Email Penerima Lisensi Digital (Kolom Kiri) -->
      <div class="space-y-1.5 pt-3 border-t border-slate-200">
        <label class="block text-xs font-bold text-slate-900">
          Email Penerima Lisensi Digital <span class="text-amber-500">*</span>
        </label>
        <div class="relative">
          <Mail class="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
          <input
            v-model="emailInputValue"
            type="email"
            required
            :disabled="!!activeOrder || isPaid"
            placeholder="nama@email.com"
            class="auth-input w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-3 text-xs sm:text-sm font-semibold text-slate-950 placeholder-slate-400 outline-none transition focus:border-slate-800 focus:ring-1 focus:ring-slate-800 disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
            @keyup.enter="emit('pay')"
          />
        </div>
        <p class="text-[11px] text-slate-600 leading-relaxed font-normal">
          Kunci lisensi resmi dan petunjuk aktivasi otomatis dikirimkan ke alamat email ini setelah pembayaran tervalidasi.
        </p>
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
            <button @click="emit('removeCoupon')"
              class="text-slate-600 hover:text-slate-950 text-xs font-semibold underline cursor-pointer">Hapus</button>
          </div>
          <div v-else class="flex items-center gap-2">
            <input v-model="couponInputValue" type="text" placeholder="Kode kupon (opsional)"
              class="auth-input flex-1 bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-mono font-bold uppercase text-slate-950 placeholder:normal-case placeholder:font-sans placeholder:text-slate-400 focus:outline-none focus:border-slate-800 focus:ring-1 focus:ring-slate-800 transition"
              @keyup.enter="emit('applyCoupon')" />
            <button @click="emit('applyCoupon')" :disabled="!couponInput.trim()"
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

  <!-- Mobile Order Summary & Coupon Dropdown (Mobile-First Experience) -->
  <div class="lg:hidden rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 space-y-2.5">
    <div class="flex items-center justify-between">
      <div>
        <div class="text-[10px] font-bold uppercase tracking-wider text-amber-600 font-mono">Pesanan Software</div>
        <h1 class="text-sm sm:text-base font-extrabold text-slate-950 leading-tight">{{ product.name }}</h1>
      </div>
      <div class="text-right">
        <span class="font-mono font-black text-base text-slate-950 block">
          {{ formatRupiah(payableAmount || product.targetPrice) }}
        </span>
        <button
          type="button"
          @click="emit('update:isMobileOrderExpanded', !isMobileOrderExpanded)"
          class="inline-flex items-center gap-1 text-[10.5px] font-bold text-amber-600 hover:underline pt-0.5 cursor-pointer"
        >
          <span>{{ isMobileOrderExpanded ? 'Tutup Rincian' : 'Rincian & Kupon' }}</span>
          <component :is="isMobileOrderExpanded ? ChevronUp : ChevronDown" class="w-3 h-3" />
        </button>
      </div>
    </div>

    <!-- Mobile Email Input (Always visible) -->
    <div class="pt-2.5 border-t border-slate-200/80 space-y-1.5">
      <label class="block text-xs font-bold text-slate-900">
        Email Penerima Lisensi Digital <span class="text-amber-500">*</span>
      </label>
      <div class="relative">
        <Mail class="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
        <input
          v-model="emailInputValue"
          type="email"
          required
          :disabled="!!activeOrder || isPaid"
          placeholder="nama@email.com"
          class="auth-input w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-3 text-xs sm:text-sm font-semibold text-slate-950 placeholder-slate-400 outline-none transition focus:border-slate-800 focus:ring-1 focus:ring-slate-800 disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
          @keyup.enter="emit('pay')"
        />
      </div>
      <p class="text-[11px] text-slate-600 leading-relaxed font-normal">
        Kunci lisensi resmi dan petunjuk aktivasi otomatis dikirimkan ke alamat email ini setelah pembayaran tervalidasi.
      </p>
    </div>

    <!-- Expandable Mobile Details & Coupon Input -->
    <div v-if="isMobileOrderExpanded" class="pt-2 border-t border-slate-200/80 space-y-2.5 animate-in fade-in duration-150">
      <p v-if="product.description" class="text-xs text-slate-600 leading-relaxed">
        {{ product.description }}
      </p>

      <!-- Value propositions -->
      <div v-if="product.valueProps && product.valueProps.length > 0" class="space-y-1 py-0.5">
        <div v-for="(vp, idx) in product.valueProps.slice(0, 3)" :key="idx" class="flex items-center gap-1.5 text-xs text-slate-700">
          <CheckCircle2 class="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <span>{{ vp }}</span>
        </div>
      </div>

      <!-- Price Breakdown -->
      <div class="text-xs space-y-1 pt-1 border-t border-slate-200/60 font-medium">
        <div class="flex justify-between text-slate-600">
          <span>Harga Asli:</span>
          <span class="font-mono">{{ formatRupiah(product.targetPrice) }}</span>
        </div>
        <div class="flex justify-between text-emerald-600 text-[11px] font-semibold">
          <span>Biaya Layanan:</span>
          <span>Gratis</span>
        </div>
        <div v-if="estimatedDiscount > 0" class="flex justify-between text-emerald-600 font-bold">
          <span>Diskon Kupon:</span>
          <span class="font-mono">−{{ formatRupiah(estimatedDiscount) }}</span>
        </div>
      </div>

      <!-- Mobile Coupon Input Form -->
      <div class="pt-1">
        <div v-if="appliedCoupon" class="flex items-center justify-between text-xs py-1.5 px-3 rounded-lg bg-emerald-50 border border-emerald-300">
          <span class="inline-flex items-center gap-1.5 text-emerald-700 font-bold text-xs">
            <CheckCircle2 class="w-3.5 h-3.5 text-emerald-600" />
            {{ appliedCoupon.code }} (−{{ appliedCoupon.discountPercent }}%)
          </span>
          <button @click="emit('removeCoupon')" class="text-slate-600 hover:text-slate-950 text-xs font-semibold underline cursor-pointer">
            Hapus
          </button>
        </div>
        <div v-else class="flex items-center gap-2">
          <input
            v-model="couponInputValue"
            type="text"
            placeholder="Kode kupon promo"
            class="auth-input flex-1 min-h-[36px] bg-white border border-slate-300 rounded-lg px-3 text-xs font-mono font-bold uppercase text-slate-950 placeholder:normal-case placeholder:font-sans placeholder:text-slate-400 focus:outline-none focus:border-slate-800"
            @keyup.enter="emit('applyCoupon')"
          />
          <button
            type="button"
            @click="emit('applyCoupon')"
            :disabled="!couponInput.trim()"
            class="min-h-[36px] px-3.5 rounded-lg bg-slate-900 text-white text-xs font-bold disabled:opacity-30 cursor-pointer active:scale-95 transition"
          >
            Pakai
          </button>
        </div>
        <p v-if="couponError" class="text-xs text-red-600 font-semibold mt-1">{{ couponError }}</p>
      </div>
    </div>
  </div>
</template>
