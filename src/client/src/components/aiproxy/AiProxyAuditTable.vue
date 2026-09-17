<script setup lang="ts">
import { RefreshCw, CheckCircle2 } from 'lucide-vue-next'
import type { AiProxyLogItem, AppItem } from '../../types'
import SearchPicker from '../common/SearchPicker.vue'

defineProps<{
  proxyLogs: AiProxyLogItem[]
  appsList?: AppItem[]
}>()

const selectedAppId = defineModel<string>('selectedAppId', { default: '' })

const emit = defineEmits<{
  (e: 'refresh'): void
  (e: 'appChange'): void
}>()
</script>

<template>
  <div class="space-y-4">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-[#111111]/10">
      <h2 class="text-sm font-bold text-[#111111]">Audit Log Pemanggilan AI</h2>
      <div class="flex items-center gap-2 self-start sm:self-auto">
        <SearchPicker
          v-if="appsList && appsList.length > 0"
          v-model="selectedAppId"
          :items="appsList"
          @change="emit('appChange')"
          placeholder="Pilih software..."
          search-placeholder="Cari software..."
          button-class="!h-9 !rounded-lg"
        />
        <button
          @click="emit('refresh')"
          class="inline-flex items-center gap-1.5 px-2.5 h-9 rounded-lg bg-[#111111]/5 hover:bg-[#111111]/10 text-xs font-bold text-[#111111] cursor-pointer transition shrink-0"
        >
          <RefreshCw class="w-3 h-3" />
          <span>Segarkan</span>
        </button>
      </div>
    </div>

    <!-- Desktop Table (Flush left/right) -->
    <div class="hidden sm:block overflow-x-auto w-full top-scrollbar">
      <table class="w-full text-left text-xs whitespace-nowrap">
        <thead class="border-b border-[#111111]/10 text-[#111111]/60 font-bold uppercase text-[10px]">
          <tr>
            <th class="py-2 pr-3 pl-0">Waktu</th>
            <th class="py-2 px-3">Kunci Lisensi</th>
            <th class="py-2 px-3">Provider &amp; Model</th>
            <th class="py-2 px-3">Tokens</th>
            <th class="py-2 px-3">Latensi</th>
            <th class="py-2 pl-3 pr-0 text-right">Status Shield</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-[#111111]/5">
          <tr v-if="proxyLogs.length === 0">
            <td colspan="6" class="py-6 text-center text-[#111111]/40">
              Belum ada panggilan AI proxy tercatat untuk aplikasi ini.
            </td>
          </tr>
          <tr v-for="log in proxyLogs" :key="log.id" class="hover:bg-[#111111]/[0.02]">
            <td class="py-2 pr-3 pl-0 font-mono text-[11px] text-[#111111]/60">
              {{ new Date(log.createdAt).toLocaleTimeString('id-ID') }}
            </td>
            <td class="py-2 px-3 font-mono font-bold text-[#111111]">
              {{ log.licenseKey || 'Direct' }}
            </td>
            <td class="py-2 px-3 text-[#111111]">
              <span class="font-bold uppercase text-[10px] mr-1 bg-[#111111]/5 px-1.5 py-0.5 rounded">{{ log.provider }}</span>
              <span class="font-mono text-[11px]">{{ log.model }}</span>
            </td>
            <td class="py-2 px-3 font-mono font-bold text-[#111111]">
              {{ log.totalTokens }} tokens
            </td>
            <td class="py-2 px-3 font-mono text-[11px] text-[#0F4C3A] font-bold">
              {{ log.latencyMs }} ms
            </td>
            <td class="py-2 pl-3 pr-0 text-right">
              <span class="inline-flex items-center gap-1 text-[10px] font-bold text-[#0F4C3A] bg-[#0F4C3A]/10 px-2 py-0.5 rounded-full">
                <CheckCircle2 class="w-2.5 h-2.5" />
                <span>Guarded</span>
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Mobile List View -->
    <div class="sm:hidden divide-y divide-[#111111]/10">
      <div v-for="log in proxyLogs" :key="log.id" class="py-2.5 space-y-1.5">
        <div class="flex items-start justify-between">
          <div>
            <div class="font-mono font-bold text-xs text-[#111111]">{{ log.licenseKey || 'Direct' }}</div>
            <div class="text-[10px] text-[#111111]/50 font-mono">{{ log.provider }} · {{ log.model }}</div>
          </div>
          <span class="inline-flex items-center gap-1 text-[9px] font-bold text-[#0F4C3A] bg-[#0F4C3A]/10 px-2 py-0.5 rounded-full">
            <CheckCircle2 class="w-2.5 h-2.5" />
            <span>Guarded</span>
          </span>
        </div>
        <div class="flex items-center justify-between text-[10px] text-[#111111]/70">
          <span>{{ log.totalTokens }} tokens · {{ log.latencyMs }} ms</span>
          <span class="font-mono text-[#111111]/50">{{ new Date(log.createdAt).toLocaleTimeString('id-ID') }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
