<script setup lang="ts">
import { CreditCard, CheckCircle2, ExternalLink, Copy, Check } from 'lucide-vue-next'
import { formatRupiah } from '../../lib/utils'
import { useClipboard } from '../../composables/useClipboard'

defineProps<{
  checkoutResult: {
    success: boolean
    checkoutUrl?: string
    transactionId?: string
    amount?: number
    platformFee?: number
    netDisbursementAmount?: number
  } | null
}>()

const { copied, copy } = useClipboard()
</script>

<template>
  <div class="space-y-3 flex flex-col h-full">
    <div class="flex items-center justify-between">
      <h2 class="text-xs font-bold uppercase tracking-wider text-[#111111]/80">Hasil Sesi Transaksi</h2>
    </div>

    <!-- Active Result Card -->
    <div v-if="checkoutResult" class="space-y-2.5 text-xs flex-1 flex flex-col justify-between">
      <div class="p-3.5 rounded-xl bg-[#111111] text-white space-y-2">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-1.5 text-xs font-bold text-[#D4AF37]">
            <CheckCircle2 class="w-3.5 h-3.5" />
            <span>Sesi Checkout Siap</span>
          </div>
          <span class="font-mono text-[10px] text-white/50 truncate max-w-[140px]">
            {{ checkoutResult.transactionId }}
          </span>
        </div>

        <div class="grid grid-cols-2 gap-2 text-[11px] font-mono bg-white/5 p-2 rounded-lg">
          <div>
            <span class="text-white/40 block text-[10px]">Total Tagihan:</span>
            <span class="font-bold text-white">{{ formatRupiah(checkoutResult.amount || 0) }}</span>
          </div>
          <div>
            <span class="text-white/40 block text-[10px]">Net Payout (95%):</span>
            <span class="font-bold text-[#D4AF37]">{{ formatRupiah(checkoutResult.netDisbursementAmount || 0) }}</span>
          </div>
        </div>

        <div class="pt-1 flex items-center gap-2">
          <a
            :href="checkoutResult.checkoutUrl"
            target="_blank"
            class="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#D4AF37] text-[#111111] font-bold text-xs hover:bg-[#D4AF37]/90 transition shadow-xs"
          >
            <span>Buka Paywall Xendit</span>
            <ExternalLink class="w-3 h-3" />
          </a>

          <button
            v-if="checkoutResult.checkoutUrl"
            type="button"
            @click="copy(checkoutResult.checkoutUrl)"
            class="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-medium text-xs transition inline-flex items-center gap-1 cursor-pointer"
            title="Salin URL Checkout"
          >
            <component :is="copied ? Check : Copy" class="w-3.5 h-3.5" :class="copied ? 'text-emerald-400' : ''" />
            <span class="hidden sm:inline">{{ copied ? 'Tersalin' : 'Salin' }}</span>
          </button>
        </div>
      </div>

      <p class="text-[10px] text-[#111111]/55 leading-relaxed">
        Pembeli akan memilih channel (QRIS, VA, E-Wallet). Webhook otomatis menerbitkan lisensi &amp; mencatat saldo siap cair.
      </p>
    </div>

    <!-- Minimal Compact Placeholder -->
    <div
      v-else
      class="flex-1 min-h-[140px] flex flex-col items-center justify-center text-center text-[#111111]/40 p-3 border border-dashed border-[#111111]/15 rounded-xl bg-[#111111]/[0.01]"
    >
      <CreditCard class="w-6 h-6 mb-1 opacity-25" />
      <p class="text-[11px] font-medium text-[#111111]/50">Invoice URL &amp; ringkasan transaksi akan muncul di sini.</p>
    </div>
  </div>
</template>
