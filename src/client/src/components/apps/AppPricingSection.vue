<script setup lang="ts">
import { ref, computed } from 'vue'
import type { BillingPeriodType } from '../../types/app'
import {
  Sparkles,
  Zap,
  Plus,
  Trash2,
  ChevronDown,
  Check,
} from 'lucide-vue-next'

const props = defineProps<{
  pricingType: 'one_time' | 'subscription' | 'free'
  price: number
  billingPeriod: BillingPeriodType
  customBillingDays: number
  hasTrialPeriod: boolean
  trialPeriodDays: number
  meteringEnabled: boolean
  meterName?: string
  meterAggregation?: string
  meteringUnitPrice?: string | number
  meteringMetricUnit?: string
  meteringFreeAllowance?: number
}>()

const emit = defineEmits<{
  'update:pricingType': [val: 'one_time' | 'subscription' | 'free']
  'update:price': [val: number]
  'update:billingPeriod': [val: BillingPeriodType]
  'update:customBillingDays': [val: number]
  'update:hasTrialPeriod': [val: boolean]
  'update:trialPeriodDays': [val: number]
  openMeteringModal: []
  removeMetering: []
}>()

const isBillingPeriodDropdownOpen = ref(false)

const billingPeriodOptions: { id: BillingPeriodType; label: string }[] = [
  { id: 'weekly', label: 'Weekly' },
  { id: 'daily', label: 'Daily' },
  { id: 'monthly', label: 'Monthly' },
  { id: 'every_3_months', label: '3 Months' },
  { id: 'every_6_months', label: '6 Months' },
  { id: 'yearly', label: 'Yearly' },
  { id: 'custom', label: 'Custom' },
]

const selectedBillingPeriodLabel = computed(() => {
  const opt = billingPeriodOptions.find(o => o.id === props.billingPeriod)
  return opt ? opt.label : 'Monthly'
})

function selectBillingPeriod(id: BillingPeriodType) {
  emit('update:billingPeriod', id)
  isBillingPeriodDropdownOpen.value = false
}
</script>

<template>
  <div class="space-y-4">
    <div class="border-b border-[#111111]/10 pb-3">
      <div class="flex items-center gap-2">
        <div class="w-2 h-2 rounded-full bg-[#D4AF37]"></div>
        <h2 class="text-xs font-bold uppercase tracking-wider text-[#111111]">Penetapan Harga &amp; Metering</h2>
      </div>
      <p class="text-[11px] text-[#111111]/60 mt-0.5">Atur skema pembayaran langganan berkala, freemium, atau sekali bayar.</p>
    </div>

    <!-- Pricing Model Selection Cards -->
    <div class="grid grid-cols-3 gap-2.5">
      <button
        type="button"
        @click="emit('update:pricingType', 'free')"
        class="p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between"
        :class="pricingType === 'free' ? 'border-[#0F4C3A] bg-[#0F4C3A]/5 ring-1 ring-[#0F4C3A]' : 'border-[#111111]/10 bg-white hover:border-[#111111]/25'"
      >
        <div class="font-bold text-xs text-[#111111]">Gratis</div>
        <div class="text-[10px] text-[#111111]/60 mt-1">Lead magnet / free tier open</div>
      </button>

      <button
        type="button"
        @click="emit('update:pricingType', 'one_time')"
        class="p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between"
        :class="pricingType === 'one_time' ? 'border-[#D4AF37] bg-[#D4AF37]/5 ring-1 ring-[#D4AF37]' : 'border-[#111111]/10 bg-white hover:border-[#111111]/25'"
      >
        <div class="font-bold text-xs text-[#111111]">Sekali Bayar</div>
        <div class="text-[10px] text-[#111111]/60 mt-1">Lifetime / digital download</div>
      </button>

      <button
        type="button"
        @click="emit('update:pricingType', 'subscription')"
        class="p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between"
        :class="pricingType === 'subscription' ? 'border-[#D4AF37] bg-[#D4AF37]/5 ring-1 ring-[#D4AF37]' : 'border-[#111111]/10 bg-white hover:border-[#111111]/25'"
      >
        <div class="flex items-center justify-between">
          <span class="font-bold text-xs text-[#111111]">Berlangganan</span>
          <span class="text-[9px] font-bold px-1 py-0.5 rounded bg-[#D4AF37]/20 text-[#8a6d1f]">SaaS</span>
        </div>
        <div class="text-[10px] text-[#111111]/60 mt-1">Recurring invoice berkala</div>
      </button>
    </div>

    <!-- Price & Interval Fields -->
    <div v-if="pricingType !== 'free'" :class="pricingType === 'subscription' ? 'grid grid-cols-1 sm:grid-cols-2 gap-4' : ''">
      <div>
        <label class="block text-[11px] font-bold text-[#111111]/70 mb-1">
          {{ pricingType === 'subscription' ? 'Nominal Langganan Dasar' : 'Harga Produk' }}
        </label>
        <div class="relative">
          <span class="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#111111]/50">Rp</span>
          <input
            :value="price"
            @input="emit('update:price', Number(($event.target as HTMLInputElement).value) || 0)"
            type="number"
            min="0"
            placeholder="49000"
            class="w-full pl-9 pr-3 py-2 rounded-lg bg-white border border-[#111111]/15 text-xs text-[#111111] font-mono font-bold focus:outline-none focus:border-[#D4AF37]"
          />
        </div>
      </div>

      <!-- Billing Period Dropdown when subscription -->
      <div v-if="pricingType === 'subscription'">
        <label class="block text-[11px] font-bold text-[#111111]/70 mb-1">Interval Penagihan (Billing Period)</label>
        <div class="relative">
          <button
            type="button"
            @click="isBillingPeriodDropdownOpen = !isBillingPeriodDropdownOpen"
            class="w-full px-3 py-2 rounded-lg bg-white border border-[#111111]/15 text-xs text-[#111111] flex items-center justify-between hover:border-[#111111]/30 transition cursor-pointer shadow-2xs"
          >
            <span class="font-medium">{{ selectedBillingPeriodLabel }}</span>
            <ChevronDown class="w-3.5 h-3.5 text-[#111111]/50 transition-transform duration-200" :class="{ 'rotate-180': isBillingPeriodDropdownOpen }" />
          </button>

          <div v-if="isBillingPeriodDropdownOpen" @click="isBillingPeriodDropdownOpen = false" class="fixed inset-0 z-30"></div>

          <div
            v-if="isBillingPeriodDropdownOpen"
            class="absolute left-0 right-0 mt-1 bg-white border border-[#111111]/10 rounded-xl shadow-xl p-1 z-40 animate-fadeIn space-y-0.5"
          >
            <button
              v-for="opt in billingPeriodOptions"
              :key="opt.id"
              type="button"
              @click="selectBillingPeriod(opt.id)"
              class="w-full px-3 py-2 text-xs rounded-lg text-left flex items-center justify-between transition cursor-pointer"
              :class="billingPeriod === opt.id ? 'bg-[#D4AF37]/10 text-[#8a6d1f] font-bold' : 'text-[#111111] hover:bg-[#111111]/5'"
            >
              <span>{{ opt.label }}</span>
              <Check v-if="billingPeriod === opt.id" class="w-3.5 h-3.5 text-[#D4AF37] stroke-[2.5]" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Subscription Additional Settings (Custom days & Trial) -->
    <div v-if="pricingType === 'subscription'" class="space-y-3 pt-1">

      <!-- Custom Days Input -->
      <div v-if="billingPeriod === 'custom'" class="p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
        <label class="block text-[11px] font-bold text-amber-900 mb-1">Siklus Kustom (Hari)</label>
        <input
          :value="customBillingDays"
          @input="emit('update:customBillingDays', Number(($event.target as HTMLInputElement).value) || 1)"
          type="number"
          min="1"
          class="w-28 px-3 py-1.5 rounded bg-white border border-amber-500/30 text-xs font-mono font-bold text-[#111111] focus:outline-none focus:border-amber-600"
        />
        <span class="text-[10px] text-amber-800/70 mt-1 block">Masa aktif lisensi berlaku per siklus tagihan: {{ customBillingDays }} hari.</span>
      </div>

      <!-- Free Trial Period Switch -->
      <div class="flex items-center justify-between p-3 rounded-xl bg-white border border-[#111111]/10 text-[#111111]">
        <div>
          <div class="text-xs font-bold text-[#111111] flex items-center gap-1.5">
            <Sparkles class="w-3.5 h-3.5 text-[#D4AF37]" />
            <span>Trial period</span>
          </div>
          <div class="text-[10px] text-[#111111]/60 mt-0.5">Tandai durasi masa uji coba gratis untuk lisensi pengguna.</div>
        </div>

        <div class="flex items-center gap-2">
          <label class="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              :checked="hasTrialPeriod"
              @change="emit('update:hasTrialPeriod', ($event.target as HTMLInputElement).checked)"
              class="sr-only peer"
            />
            <div class="w-9 h-5 bg-slate-200 rounded-full peer peer-checked:bg-[#0F4C3A] transition-colors after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white peer-checked:after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full shadow-inner"></div>
          </label>
        </div>
      </div>

      <!-- Trial Days Input -->
      <div v-if="hasTrialPeriod" class="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[#111111]">
        <span class="text-xs text-[#111111]/80 font-medium">Durasi uji coba gratis:</span>
        <input
          :value="trialPeriodDays"
          @input="emit('update:trialPeriodDays', Number(($event.target as HTMLInputElement).value) || 1)"
          type="number"
          min="1"
          class="w-16 px-2 py-1 text-xs text-center font-bold bg-white border border-slate-300 text-[#111111] rounded-md focus:outline-none focus:border-[#D4AF37]"
        />
        <span class="text-xs text-[#111111]/70 font-medium">hari</span>
      </div>
    </div>

    <!-- Metered Billing Block -->
    <div class="p-3.5 rounded-xl bg-[#D4AF37]/5 border border-[#D4AF37]/25 space-y-3">
      <div class="flex items-center justify-between">
        <div>
          <div class="flex items-center gap-1.5">
            <Sparkles class="w-3.5 h-3.5 text-[#D4AF37]" />
            <h3 class="text-xs font-bold text-[#111111]">Biaya Berbasis Penggunaan (Metered Billing)</h3>
          </div>
          <p class="text-[11px] text-[#111111]/60">Parameter batas pemakaian & kuota kredit yang terhubung dengan SDK/AI Proxy Tertaut.</p>
        </div>
        <button
          v-if="!meteringEnabled"
          type="button"
          @click="emit('openMeteringModal')"
          class="px-3 py-1 rounded-lg btn-gold text-xs font-bold transition cursor-pointer flex items-center gap-1 shadow-2xs active:scale-95"
        >
          <Plus class="w-3 h-3 stroke-[3]" />
          <span>Tambah Meter</span>
        </button>
      </div>

      <div v-if="meteringEnabled" class="p-3 rounded-xl bg-white border border-[#D4AF37]/40 flex items-center justify-between shadow-2xs">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-lg bg-[#D4AF37]/15 text-[#8a6d1f] flex items-center justify-center">
            <Zap class="w-4 h-4" />
          </div>
          <div>
            <div class="flex items-center gap-2">
              <span class="text-xs font-bold text-[#111111]">{{ meterName || 'Meter Kustom' }}</span>
              <code class="text-[10px] text-[#8a6d1f] bg-[#D4AF37]/10 px-2 py-0.5 rounded border border-[#D4AF37]/30 font-mono font-bold">{{ meterAggregation }}</code>
            </div>
            <div class="text-[11px] text-[#111111]/60 font-mono mt-0.5">
              Rp {{ meteringUnitPrice }} / {{ meteringMetricUnit }}
              <span v-if="meteringFreeAllowance" class="text-[#0F4C3A] font-sans font-semibold ml-1.5">({{ meteringFreeAllowance }} gratis/siklus)</span>
            </div>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <button
            type="button"
            @click="emit('openMeteringModal')"
            class="text-xs font-bold text-[#111111]/70 hover:text-[#111111] transition cursor-pointer px-2.5 py-1 rounded-md bg-[#111111]/5 hover:bg-[#111111]/10"
          >
            Ubah
          </button>
          <button
            type="button"
            @click="emit('removeMetering')"
            class="text-[#111111]/40 hover:text-red-600 transition cursor-pointer p-1"
          >
            <Trash2 class="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
