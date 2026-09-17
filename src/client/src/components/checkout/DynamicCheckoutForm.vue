<script setup lang="ts">
import { Sparkles } from 'lucide-vue-next'
import { formatRupiah } from '../../lib/utils'
import type { AppItem } from '../../lib/api'
import SearchPicker from '../common/SearchPicker.vue'

defineProps<{
  loading: boolean
  appsList?: AppItem[]
}>()

const selectedAppId = defineModel<string>('selectedAppId', { default: '' })
const amount = defineModel<number>('amount', { default: 0 })
const customerEmail = defineModel<string>('customerEmail', { default: '' })
const grantDays = defineModel<number>('grantDays', { default: 30 })

const emit = defineEmits<{
  (e: 'createCheckout'): void
  (e: 'appChange'): void
}>()
</script>

<template>
  <div class="space-y-3">
    <div class="flex items-center justify-between">
      <h2 class="text-xs font-bold uppercase tracking-wider text-[#111111]/80">Buat Sesi Dynamic Checkout</h2>
    </div>

    <div class="space-y-2.5 text-xs">
      <!-- 2-Column Input Grid for Compact Density & Perfect Alignment -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <!-- Target Software Selector (Integrated with form) -->
        <div v-if="appsList && appsList.length > 0">
          <label class="block font-bold text-[11px] text-[#111111]/70 mb-1">Target Software</label>
          <SearchPicker
            v-model="selectedAppId"
            :items="appsList"
            @change="emit('appChange')"
            placeholder="Pilih software..."
            search-placeholder="Cari software..."
            button-class="w-full !h-9 !rounded-lg !min-w-0 justify-between px-3 text-xs border-slate-300/80 hover:border-slate-400 bg-white shadow-2xs focus:ring-2 focus:ring-[#D4AF37]/20 focus:border-[#D4AF37]"
          />
        </div>

        <div>
          <label class="block font-bold text-[11px] text-[#111111]/70 mb-1">Nominal Pembayaran (IDR)</label>
          <input
            v-model.number="amount"
            type="number"
            step="1000"
            class="w-full h-9 bg-white border border-slate-300/80 hover:border-slate-400 rounded-lg px-3 text-xs text-slate-900 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/20 focus:border-[#D4AF37] shadow-2xs transition"
          />
        </div>

        <div>
          <label class="block font-bold text-[11px] text-[#111111]/70 mb-1">Email Pembeli (Opsional)</label>
          <input
            v-model="customerEmail"
            type="email"
            placeholder="buyer@example.com"
            class="w-full h-9 bg-white border border-slate-300/80 hover:border-slate-400 rounded-lg px-3 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/20 focus:border-[#D4AF37] shadow-2xs transition"
          />
        </div>

        <div>
          <label class="block font-bold text-[11px] text-[#111111]/70 mb-1">Masa Aktif Lisensi (Hari)</label>
          <input
            v-model.number="grantDays"
            type="number"
            class="w-full h-9 bg-white border border-slate-300/80 hover:border-slate-400 rounded-lg px-3 text-xs text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/20 focus:border-[#D4AF37] shadow-2xs transition"
          />
        </div>
      </div>

      <!-- Compact Fee Breakdown Live Preview Strip -->
      <div class="px-3 py-2 rounded-lg bg-[#111111]/[0.02] border border-[#111111]/10 text-xs">
        <div class="flex flex-wrap sm:flex-nowrap items-center justify-between gap-2">
          <div class="flex items-center gap-3 text-[#111111]/70 text-[11px]">
            <span>Gross: <strong class="font-mono text-[#111111] font-bold">{{ formatRupiah(amount) }}</strong></span>
            <span class="text-[#111111]/30">•</span>
            <span>Fee 5%: <strong class="font-mono text-[#8B0000] font-bold">-{{ formatRupiah(Math.round(amount * 0.05)) }}</strong></span>
          </div>
          <div class="flex items-center gap-1.5 font-bold">
            <span class="text-[11px] text-[#111111]/60">Net Payout (95%):</span>
            <span class="font-mono text-[#0F4C3A] bg-[#0F4C3A]/10 px-2 py-0.5 rounded text-xs font-black">
              {{ formatRupiah(amount - Math.round(amount * 0.05)) }}
            </span>
          </div>
        </div>
      </div>

      <!-- Action Button (Mobile-First Thumb-Friendly) -->
      <button
        @click="emit('createCheckout')"
        :disabled="loading"
        class="w-full min-h-[40px] py-2.5 rounded-lg btn-gold text-xs font-bold transition flex items-center justify-center gap-2 shadow-xs active:scale-95 cursor-pointer disabled:opacity-50"
      >
        <Sparkles class="w-4 h-4" />
        <span>{{ loading ? 'Menghubungkan ke API Xendit...' : 'Generate Dynamic Checkout Link' }}</span>
      </button>
    </div>
  </div>
</template>
