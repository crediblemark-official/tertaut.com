<script setup lang="ts">
import { formatRupiah } from '../../lib/utils'
import {
  Image as ImageIcon,
  Check,
  Sparkles,
  RefreshCw,
} from 'lucide-vue-next'

const props = defineProps<{
  appName: string
  appDesc: string
  mediaUrl?: string | null
  pricingType: 'one_time' | 'subscription' | 'free'
  price: number
  billingPeriodDisplay: string
  hasTrialPeriod: boolean
  trialPeriodDays: number
  benefits: string[]
  meteringEnabled: boolean
  meteringAggregation?: string
  meteringUnitPrice?: string | number
  meteringMetricUnit?: string
  dashboardEnv: 'sandbox' | 'live'
  isCreating: boolean
  canPublish: boolean
}>()

const emit = defineEmits<{
  publish: []
}>()
</script>

<template>
  <div class="space-y-4 sticky top-6">
    <div class="border-b border-jetblack/10 pb-3">
      <div class="flex items-center gap-2">
        <div class="w-2 h-2 rounded-full bg-forest"></div>
        <h2 class="text-xs font-bold uppercase tracking-wider text-jetblack">Pratinjau Langsung (Checkout)</h2>
      </div>
      <p class="text-[11px] text-jetblack/60 mt-0.5">Simulasi tampilan checkout pembeli secara real-time.</p>
    </div>

    <!-- Live Preview Card -->
    <div class="p-4 rounded-xl bg-white border border-jetblack/10 shadow-xs space-y-4">
      <div class="flex items-start gap-3 p-3 rounded-lg bg-jetblack/[0.02] border border-jetblack/10">
        <div class="w-12 h-12 rounded-md bg-jetblack/5 border border-jetblack/10 flex items-center justify-center overflow-hidden shrink-0">
          <img v-if="mediaUrl" :src="mediaUrl" class="w-full h-full object-cover" />
          <ImageIcon v-else class="w-5 h-5 text-jetblack/40" />
        </div>
        <div class="overflow-hidden">
          <div class="text-xs font-bold text-jetblack truncate">{{ appName || 'Nama Produk Belum Diset' }}</div>
          <div class="text-[10px] text-jetblack/60 line-clamp-2 mt-0.5">{{ appDesc || 'Belum ada deskripsi produk.' }}</div>
        </div>
      </div>

      <!-- Benefits in preview -->
      <div class="space-y-1.5 text-xs">
        <div class="text-[10px] uppercase font-bold text-jetblack/50 tracking-wider">Manfaat Pembeli (Benefits)</div>
        <div v-if="benefits.length > 0" class="space-y-1">
          <div
            v-for="(b, idx) in benefits"
            :key="idx"
            class="flex items-center gap-2 text-jetblack text-[11px]"
          >
            <Check class="w-3 h-3 text-forest shrink-0 stroke-[3]" />
            <span class="truncate">{{ b }}</span>
          </div>
        </div>
        <div v-else class="text-jetblack/40 text-[11px]">Belum ada manfaat ditambahkan</div>
      </div>

      <!-- Price in preview -->
      <div class="space-y-1 text-xs pt-3 border-t border-jetblack/10">
        <div class="text-[10px] uppercase font-bold text-jetblack/50 tracking-wider">Penetapan Harga</div>
        <div class="flex items-baseline justify-between">
          <span class="text-xl font-black text-jetblack font-mono">
            {{ pricingType === 'free' ? 'Gratis' : (price ? formatRupiah(price) : 'Rp 0') }}
          </span>
          <span class="text-[11px] font-semibold text-jetblack/60">
            {{ pricingType === 'subscription' ? billingPeriodDisplay : (pricingType === 'free' ? 'Akses Gratis' : 'Sekali Bayar') }}
          </span>
        </div>
        <p class="text-[10px] text-jetblack/50">Barang digital &amp; SaaS · MoR DANA/Xendit</p>

        <div
          v-if="pricingType === 'subscription' && hasTrialPeriod"
          class="text-[10px] text-forest font-bold flex items-center gap-1 mt-1 bg-forest/10 px-2 py-1 rounded-md border border-forest/20"
        >
          <Sparkles class="w-3 h-3 text-gold" />
          <span>{{ trialPeriodDays }} Hari Uji Coba Gratis (Free Trial)</span>
        </div>

        <div v-if="meteringEnabled" class="mt-2 pt-2 border-t border-dashed border-jetblack/15">
          <div class="text-[10px] text-[#8a6d1f] flex items-center gap-1 font-mono font-bold">
            <Sparkles class="w-3 h-3 text-gold" />
            <span>+ Meter: {{ meteringAggregation }}</span>
          </div>
          <div class="text-[10px] text-jetblack/60 font-mono">Rp {{ meteringUnitPrice }} / {{ meteringMetricUnit }}</div>
        </div>
      </div>

      <!-- Status Checkout -->
      <div class="p-3 rounded-lg bg-jetblack/[0.02] border border-jetblack/10">
        <div class="text-[10px] uppercase font-bold text-jetblack/50 tracking-wider mb-1">Status Checkout</div>
        <div class="text-[11px] text-jetblack font-semibold flex items-center justify-between">
          <span>Tertaut MoR Checkout</span>
          <span class="text-forest text-[10px] font-bold">Siap Aktif</span>
        </div>
      </div>

      <!-- Publish Action -->
      <div class="pt-2">
        <button
          @click="emit('publish')"
          :disabled="isCreating || !canPublish"
          class="w-full py-2.5 rounded-lg btn-gold text-xs font-bold transition shadow-xs disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2 active:scale-98"
        >
          <RefreshCw v-if="isCreating" class="w-3.5 h-3.5 animate-spin" />
          <span>{{ isCreating ? 'Menerbitkan Produk...' : 'Terbitkan Produk' }}</span>
        </button>
        <p class="text-[10px] text-jetblack/50 text-center mt-2 leading-relaxed">
          Mode {{ dashboardEnv === 'sandbox' ? 'Sandbox' : 'Live' }} — produk ini dan checkout link langsung aktif di lingkungan ini.
        </p>
      </div>
    </div>
  </div>
</template>
