<script setup lang="ts">
import { Send, CheckCircle2 } from 'lucide-vue-next'
import type { PanelStats } from '../../types'

defineProps<{
  stats: PanelStats | null
  isProcessingPayout: boolean
  payoutResult: any
}>()

const emit = defineEmits<{
  (e: 'triggerPayout'): void
}>()
</script>

<template>
  <div class="space-y-4">
    <!-- Quick Action Banner for Batch Payout -->
    <section
      v-if="(stats?.pendingDisbursementsCount || 0) > 0"
      class="bg-[#111111] text-white rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm"
    >
      <div class="space-y-1 text-center sm:text-left">
        <div class="flex items-center gap-2 justify-center sm:justify-start">
          <span class="w-2 h-2 rounded-full bg-[#D4AF37] animate-ping"></span>
          <h3 class="font-bold text-sm text-[#D4AF37]">Batch Payout Siap Dieksekusi</h3>
        </div>
        <p class="text-xs text-white/70">
          Terdapat <strong>{{ stats?.pendingDisbursementsCount }}</strong> transaksi (total <strong>Rp {{ (stats?.pendingDisbursementsAmount || 0).toLocaleString('id-ID') }}</strong>) siap ditransfer ke rekening masing-masing builder via Xendit MoR Rail.
        </p>
      </div>

      <button
        @click="emit('triggerPayout')"
        :disabled="isProcessingPayout"
        class="px-5 py-2.5 rounded-xl bg-[#D4AF37] hover:bg-[#b5952f] text-black font-bold text-xs transition flex items-center gap-2 shrink-0 shadow-sm disabled:opacity-50 cursor-pointer"
      >
        <span v-if="isProcessingPayout" class="w-3.5 h-3.5 border-2 border-black/30 border-t-black rounded-full animate-spin"></span>
        <Send v-else class="w-3.5 h-3.5" />
        <span>Eksekusi Batch Payout Sekarang</span>
      </button>
    </section>

    <!-- Payout Execution Result Card (If just triggered) -->
    <section v-if="payoutResult" class="bg-white rounded-2xl border border-[#0F4C3A]/30 p-5 space-y-3">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <CheckCircle2 class="w-4 h-4 text-[#0F4C3A]" />
          <h3 class="font-bold text-xs text-[#0F4C3A]">Hasil Eksekusi Batch Payout Xendit</h3>
        </div>
        <span class="text-[10px] text-[#111111]/50 font-mono">{{ new Date().toLocaleTimeString('id-ID') }}</span>
      </div>
      <p class="text-xs text-[#111111]/70">
        Berhasil memproses <strong>{{ payoutResult.processedCount }}</strong> transaksi dengan total dana <strong>Rp {{ payoutResult.totalDisbursed.toLocaleString('id-ID') }}</strong> ke rekening builder.
      </p>
    </section>
  </div>
</template>
