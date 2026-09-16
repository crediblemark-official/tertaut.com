<script setup lang="ts">
import { CreditCard, CheckCircle2, ExternalLink } from 'lucide-vue-next'
import { formatRupiah } from '../../lib/utils'

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
</script>

<template>
  <div class="luxury-card p-4 md:p-5 rounded-xl space-y-4">
    <h2 class="text-sm font-bold text-[#111111]">Hasil Sesi Transaksi</h2>

    <div v-if="checkoutResult" class="space-y-3 text-xs">
      <div class="p-4 rounded-xl bg-[#111111] text-white space-y-2.5">
        <div class="flex items-center gap-1.5 text-xs font-bold text-[#D4AF37]">
          <CheckCircle2 class="w-4 h-4" />
          <span>Sesi Checkout Xendit Berhasil Dibuat!</span>
        </div>

        <div class="text-[11px] space-y-1.5 font-mono text-white/80">
          <div><span class="text-white/40">ID Transaksi:</span> {{ checkoutResult.transactionId }}</div>
          <div><span class="text-white/40">Total Tagihan:</span> {{ formatRupiah(checkoutResult.amount || 0) }}</div>
          <div><span class="text-white/40">Net Payout (95%):</span> {{ formatRupiah(checkoutResult.netDisbursementAmount || 0) }}</div>
        </div>

        <div class="pt-2">
          <a
            :href="checkoutResult.checkoutUrl"
            target="_blank"
            class="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#D4AF37] text-[#111111] font-bold text-xs hover:bg-[#D4AF37]/90 transition shadow-sm"
          >
            <span>Buka Hosted Paywall Xendit</span>
            <ExternalLink class="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
      <p class="text-[11px] text-[#111111]/60 leading-relaxed">
        Pembeli akan dialihkan ke paywall Xendit untuk memilih channel (QRIS, VA, atau E-Wallet). Ketika pembayaran lunas, webhook Xendit akan otomatis menerbitkan lisensi dan mencatat saldo bersih siap cair.
      </p>
    </div>

    <div
      v-else
      class="h-56 flex flex-col items-center justify-center text-center text-[#111111]/40 p-4 border border-dashed border-[#111111]/15 rounded-xl"
    >
      <CreditCard class="w-8 h-8 mb-1.5 opacity-30" />
      <p class="text-xs">Klik tombol "Generate Dynamic Checkout Link" untuk membuat invoice Xendit riil.</p>
    </div>
  </div>
</template>
