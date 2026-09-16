<script setup lang="ts">
import { RefreshCw, CheckCircle2 } from 'lucide-vue-next'
import type { AiProxyLogItem } from '../../types'

defineProps<{
  proxyLogs: AiProxyLogItem[]
}>()

const emit = defineEmits<{
  (e: 'refresh'): void
}>()
</script>

<template>
  <div class="luxury-card p-4 md:p-5 rounded-xl space-y-4">
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-sm font-bold text-[#111111]">Audit Log Pemanggilan AI (Cost Guardrails)</h2>
        <p class="text-xs text-[#111111]/60">Monitoring latensi, penggunaan token, dan identifikasi lisensi pemanggil secara real-time.</p>
      </div>
      <button
        @click="emit('refresh')"
        class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#111111]/5 hover:bg-[#111111]/10 text-xs font-bold text-[#111111] cursor-pointer"
      >
        <RefreshCw class="w-3 h-3" />
        <span>Segarkan</span>
      </button>
    </div>

    <div class="overflow-x-auto">
      <table class="w-full text-left text-xs">
        <thead>
          <tr class="border-b border-[#111111]/10 text-[#111111]/60 font-bold uppercase text-[10px]">
            <th class="pb-2">Waktu Panggilan</th>
            <th class="pb-2">Kunci Lisensi</th>
            <th class="pb-2">Provider &amp; Model</th>
            <th class="pb-2">Total Tokens</th>
            <th class="pb-2">Latensi Engine</th>
            <th class="pb-2">Status Shield</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-[#111111]/5">
          <tr v-if="proxyLogs.length === 0">
            <td colspan="6" class="py-6 text-center text-[#111111]/40">
              Belum ada panggilan AI proxy tercatat untuk aplikasi ini.
            </td>
          </tr>
          <tr v-for="log in proxyLogs" :key="log.id" class="hover:bg-[#111111]/[0.02]">
            <td class="py-2.5 font-mono text-[11px] text-[#111111]/60">
              {{ new Date(log.createdAt).toLocaleTimeString('id-ID') }}
            </td>
            <td class="py-2.5 font-mono font-bold text-[#111111]">
              {{ log.licenseKey || 'Direct' }}
            </td>
            <td class="py-2.5 text-[#111111]">
              <span class="font-bold uppercase text-[10px] mr-1 bg-[#111111]/5 px-1.5 py-0.5 rounded">{{ log.provider }}</span>
              <span class="font-mono text-[11px]">{{ log.model }}</span>
            </td>
            <td class="py-2.5 font-mono font-bold text-[#111111]">
              {{ log.totalTokens }} tokens
            </td>
            <td class="py-2.5 font-mono text-[11px] text-[#0F4C3A] font-bold">
              {{ log.latencyMs }} ms
            </td>
            <td class="py-2.5">
              <span class="inline-flex items-center gap-1 text-[10px] font-bold text-[#0F4C3A] bg-[#0F4C3A]/10 px-2 py-0.5 rounded-full">
                <CheckCircle2 class="w-2.5 h-2.5" />
                <span>Verified &amp; Guarded</span>
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
