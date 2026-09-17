<script setup lang="ts">
import { Send, CheckCircle2 } from 'lucide-vue-next'
import type { PanelStats } from '../../types/panel'

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
  <div class="space-y-3">
    <!-- Quick Action Strip for Batch Payout -->
    <section
      v-if="(stats?.pendingDisbursementsCount || 0) > 0"
      class="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 rounded-lg bg-[#D4AF37]/10 border border-[#D4AF37]/25 text-[#111111]"
    >
      <div class="flex items-center gap-2 text-xs">
        <span class="w-2 h-2 rounded-full bg-[#D4AF37] shrink-0"></span>
        <span class="font-bold">Batch Payout Siap:</span>
        <span class="text-[#111111]/80">
          <strong>{{ stats?.pendingDisbursementsCount }}</strong> transaksi (total <strong>Rp {{ (stats?.pendingDisbursementsAmount || 0).toLocaleString('id-ID') }}</strong>) siap dicairkan ke builder.
        </span>
      </div>

      <button
        @click="emit('triggerPayout')"
        :disabled="isProcessingPayout"
        class="h-9 px-4 rounded-lg btn-gold text-xs font-bold transition inline-flex items-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-50 shadow-sm"
      >
        <span v-if="isProcessingPayout" class="w-3.5 h-3.5 border-2 border-black/30 border-t-black rounded-full animate-spin"></span>
        <Send v-else class="w-3.5 h-3.5 stroke-[2.5]" />
        <span>Eksekusi Payout</span>
      </button>
    </section>

    <!-- Payout Execution Result -->
    <section v-if="payoutResult" class="p-3 rounded-lg bg-[#0F4C3A]/10 border border-[#0F4C3A]/25 text-[#0F4C3A] flex items-center justify-between text-xs font-bold">
      <div class="flex items-center gap-2">
        <CheckCircle2 class="w-4 h-4 shrink-0" />
        <span>Berhasil memproses {{ payoutResult.processedCount }} transaksi (total Rp {{ payoutResult.totalDisbursed.toLocaleString('id-ID') }}).</span>
      </div>
      <span class="text-[10px] text-[#0F4C3A]/70 font-mono">{{ new Date().toLocaleTimeString('id-ID') }}</span>
    </section>
  </div>
</template>
