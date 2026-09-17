<script setup lang="ts">
import { Sparkles } from 'lucide-vue-next'
import { formatRupiah } from '../../lib/utils'

defineProps<{
  loading: boolean
}>()

const amount = defineModel<number>('amount', { default: 49000 })
const customerEmail = defineModel<string>('customerEmail', { default: 'pembeli@tertaut.com' })
const grantDays = defineModel<number>('grantDays', { default: 30 })

const emit = defineEmits<{
  (e: 'createCheckout'): void
}>()
</script>

<template>
  <div class="space-y-4">
    <h2 class="text-sm font-bold text-[#111111]">Buat Sesi Dynamic Checkout</h2>

    <div class="space-y-3 text-xs">
      <div>
        <label class="block font-bold text-[#111111]/70 mb-1">Nominal Pembayaran (IDR)</label>
        <input
          v-model.number="amount"
          type="number"
          step="1000"
          class="w-full bg-[#FFFFFF] border border-[#111111]/15 rounded-lg p-2 text-[#111111] font-mono font-bold focus:outline-none focus:border-[#D4AF37]"
        />
      </div>

      <div>
        <label class="block font-bold text-[#111111]/70 mb-1">Email Pembeli</label>
        <input
          v-model="customerEmail"
          type="email"
          class="w-full bg-[#FFFFFF] border border-[#111111]/15 rounded-lg p-2 text-[#111111] focus:outline-none focus:border-[#D4AF37]"
        />
      </div>

      <div>
        <label class="block font-bold text-[#111111]/70 mb-1">Masa Aktif Lisensi (Hari)</label>
        <input
          v-model.number="grantDays"
          type="number"
          class="w-full bg-[#FFFFFF] border border-[#111111]/15 rounded-lg p-2 text-[#111111] font-mono focus:outline-none focus:border-[#D4AF37]"
        />
      </div>

      <!-- Fee Breakdown Live Preview (Compact Luxury) -->
      <div class="p-3 rounded-lg bg-[#111111]/[0.02] border border-[#111111]/10 space-y-1.5 text-xs">
        <div class="flex justify-between text-[#111111]/70">
          <span>Gross Amount:</span>
          <span class="font-mono font-bold text-[#111111]">{{ formatRupiah(amount) }}</span>
        </div>
        <div class="flex justify-between text-[#111111]/70">
          <span>Platform Fee (5%):</span>
          <span class="font-mono font-bold text-[#8B0000]">- {{ formatRupiah(Math.round(amount * 0.05)) }}</span>
        </div>
        <div class="border-t border-[#111111]/10 pt-1.5 flex justify-between font-bold text-xs">
          <span class="text-[#111111]">Net Pencairan Builder (95%):</span>
          <span class="font-mono text-[#0F4C3A] bg-[#0F4C3A]/10 px-1.5 py-0.5 rounded">{{ formatRupiah(amount - Math.round(amount * 0.05)) }}</span>
        </div>
      </div>

      <button
        @click="emit('createCheckout')"
        :disabled="loading"
        class="w-full py-2.5 rounded-lg btn-gold text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm active:scale-95 cursor-pointer disabled:opacity-50"
      >
        <Sparkles class="w-3.5 h-3.5" />
        <span>{{ loading ? 'Menghubungkan ke API Xendit...' : 'Generate Dynamic Checkout Link' }}</span>
      </button>
    </div>
  </div>
</template>
