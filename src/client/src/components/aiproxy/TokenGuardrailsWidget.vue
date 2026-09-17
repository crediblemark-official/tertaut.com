<script setup lang="ts">
import { computed } from 'vue'
import { Gauge, Zap, Clock, ShieldCheck, CheckCircle2 } from 'lucide-vue-next'
import type { AiQuotaStatus } from '../../types'

const props = defineProps<{
  quotaStatus: AiQuotaStatus | null
}>()

const formattedResetTime = computed(() => {
  if (!props.quotaStatus) return '24h 00m'
  const secs = props.quotaStatus.resetInSeconds
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  return `${h}j ${m}m`
})

const quotaPercent = computed(() => {
  if (!props.quotaStatus || props.quotaStatus.dailyTokenLimit <= 0) return 0
  const pct = (props.quotaStatus.dailyTokensUsed / props.quotaStatus.dailyTokenLimit) * 100
  return Math.min(100, Math.round(pct))
})
</script>

<template>
  <div class="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-[#111111]/10 border-b border-[#111111]/10 pb-4 pt-1">
    <!-- Pemakaian Token Hari Ini -->
    <div class="py-2 pr-0 sm:pr-4 pl-0 flex flex-col justify-between">
      <div class="flex items-center justify-between text-xs text-[#111111]/60 font-medium">
        <span>Pemakaian Token Hari Ini</span>
        <Gauge class="w-4 h-4 text-[#D4AF37]" />
      </div>
      <div class="mt-2">
        <div class="text-xl font-black text-[#111111] font-mono">
          {{ (quotaStatus?.dailyTokensUsed ?? 0).toLocaleString('id-ID') }}
        </div>
        <div class="w-full bg-[#111111]/5 h-1.5 rounded-full overflow-hidden mt-1.5">
          <div
            class="h-full bg-[#D4AF37] transition-all duration-500 rounded-full"
            :style="{ width: `${quotaPercent}%` }"
          ></div>
        </div>
        <div class="text-[10px] text-[#111111]/50 mt-1 flex justify-between">
          <span>{{ quotaPercent }}% terpakai</span>
          <span>Limit: {{ (quotaStatus?.dailyTokenLimit ?? 100000).toLocaleString('id-ID') }}</span>
        </div>
      </div>
    </div>

    <!-- Sisa Token Tersedia -->
    <div class="py-2 px-0 sm:px-4 flex flex-col justify-between">
      <div class="flex items-center justify-between text-xs text-[#111111]/60 font-medium">
        <span>Sisa Token Tersedia</span>
        <Zap class="w-4 h-4 text-[#0F4C3A]" />
      </div>
      <div class="mt-2">
        <div class="text-xl font-black text-[#0F4C3A] font-mono">
          {{ (quotaStatus?.remainingTokens ?? 100000).toLocaleString('id-ID') }}
        </div>
        <p class="text-[10px] text-[#111111]/50 mt-1">
          Guardrail auto cut-off (HTTP 429) jika kuota habis.
        </p>
      </div>
    </div>

    <!-- Reset Kuota Harian -->
    <div class="py-2 px-0 sm:px-4 flex flex-col justify-between">
      <div class="flex items-center justify-between text-xs text-[#111111]/60 font-medium">
        <span>Reset Kuota Harian</span>
        <Clock class="w-4 h-4 text-[#111111]/60" />
      </div>
      <div class="mt-2">
        <div class="text-xl font-black text-[#111111] font-mono">
          {{ formattedResetTime }}
        </div>
        <p class="text-[10px] text-[#111111]/50 mt-1">
          Reset otomatis setiap tengah malam (00:00 UTC).
        </p>
      </div>
    </div>

    <!-- Privasi Prompt -->
    <div class="py-2 pl-0 sm:pl-4 pr-0 flex flex-col justify-between">
      <div class="flex items-center justify-between text-xs text-[#111111]/60 font-medium">
        <span>Privasi Prompt</span>
        <ShieldCheck class="w-4 h-4 text-[#0F4C3A]" />
      </div>
      <div class="mt-2">
        <div class="text-xs font-bold text-[#0F4C3A] flex items-center gap-1">
          <CheckCircle2 class="w-3.5 h-3.5" />
          <span>Zero Prompt Retention</span>
        </div>
        <p class="text-[10px] text-[#111111]/50 mt-1">
          Konten prompt &amp; output AI tidak disimpan di database.
        </p>
      </div>
    </div>
  </div>
</template>
