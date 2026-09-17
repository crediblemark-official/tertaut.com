<script setup lang="ts">
import { Send, Bot } from 'lucide-vue-next'
import type { AppItem } from '../../types/app'
import SearchPicker from '../common/SearchPicker.vue'

defineProps<{
  loading: boolean
  aiResult: any
  appsList?: AppItem[]
}>()

const selectedAppId = defineModel<string>('selectedAppId', { default: '' })
const licenseKey = defineModel<string>('licenseKey', { default: '' })
const modelAlias = defineModel<string>('modelAlias', { default: 'fast-summary-model' })
const streamMode = defineModel<boolean>('streamMode', { default: true })
const userPrompt = defineModel<string>('userPrompt', {
  default: 'Rangkumkan email penting dari investor ini dalam 3 poin actionable.'
})

const emit = defineEmits<{
  (e: 'testAiCall'): void
  (e: 'appChange'): void
}>()
</script>

<template>
  <div class="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-[#111111]/10 border-t border-b border-[#111111]/10 py-6">
    <!-- Prompt Input Form -->
    <div class="pb-6 lg:pb-0 pr-0 lg:pr-6 space-y-3.5">
      <div class="flex items-center justify-between">
        <h2 class="text-sm font-bold text-[#111111]">Tes Eksekusi AI via Proxy Shield</h2>
        <div class="flex items-center gap-1.5 text-xs text-[#111111]/70 font-semibold">
          <input
            type="checkbox"
            id="streamMode"
            v-model="streamMode"
            class="accent-[#D4AF37] cursor-pointer"
          />
          <label for="streamMode" class="cursor-pointer text-[11px]">SSE Streaming Relay</label>
        </div>
      </div>

      <div class="space-y-3 text-xs">
        <!-- Target Software Selector -->
        <div v-if="appsList && appsList.length > 0">
          <label class="block font-bold text-[#111111]/70 mb-1">Target Software</label>
          <SearchPicker
            v-model="selectedAppId"
            :items="appsList"
            @change="emit('appChange')"
            placeholder="Pilih software..."
            search-placeholder="Cari software..."
            button-class="w-full !h-9 !rounded-lg justify-between"
          />
        </div>

        <div>
          <label class="block font-bold text-[#111111]/70 mb-1">Kunci Lisensi Pemanggil</label>
          <input
            v-model="licenseKey"
            type="text"
            class="w-full h-9 bg-white border border-slate-300/80 hover:border-slate-400 rounded-lg px-3 text-xs shadow-2xs focus:ring-2 focus:ring-[#D4AF37]/20 focus:border-[#D4AF37] focus:outline-none text-[#111111] font-mono font-bold transition"
          />
        </div>

        <div>
          <label class="block font-bold text-[#111111]/70 mb-1">Model Alias</label>
          <input
            v-model="modelAlias"
            type="text"
            placeholder="fast-summary-model"
            class="w-full h-9 bg-white border border-slate-300/80 hover:border-slate-400 rounded-lg px-3 text-xs shadow-2xs focus:ring-2 focus:ring-[#D4AF37]/20 focus:border-[#D4AF37] focus:outline-none text-[#111111] font-mono transition"
          />
        </div>

        <div>
          <label class="block font-bold text-[#111111]/70 mb-1">User Prompt</label>
          <textarea
            v-model="userPrompt"
            rows="3"
            class="w-full bg-white border border-slate-300/80 hover:border-slate-400 rounded-lg p-2.5 text-[#111111] text-xs shadow-2xs focus:ring-2 focus:ring-[#D4AF37]/20 focus:border-[#D4AF37] focus:outline-none transition"
          ></textarea>
        </div>

        <button
          @click="emit('testAiCall')"
          :disabled="loading"
          class="w-full h-9 rounded-lg btn-gold text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm active:scale-95 cursor-pointer disabled:opacity-50"
        >
          <Send class="w-3.5 h-3.5" />
          <span>{{ loading ? 'Mengalirkan via Proxy Shield...' : 'Kirim via Proxy Shield' }}</span>
        </button>
      </div>
    </div>

    <!-- Live Terminal Output -->
    <div class="pt-6 lg:pt-0 pl-0 lg:pl-6 space-y-3.5">
      <h2 class="text-sm font-bold text-[#111111]">Respon AI Terlindungi</h2>

      <div v-if="aiResult" class="p-3.5 rounded-xl bg-[#111111] text-white font-mono text-xs space-y-2">
        <div class="flex items-center justify-between text-[11px] border-b border-white/10 pb-1.5">
          <span class="text-[#D4AF37] font-bold">Latency: {{ aiResult.latencyMs ?? 'Streaming...' }}ms</span>
          <span class="text-white/60">Model: {{ aiResult.model || modelAlias }}</span>
        </div>

        <div v-if="aiResult.error" class="text-[#8B0000] font-bold">
          {{ aiResult.error }} - {{ aiResult.message }}
        </div>

        <div v-else class="text-white/90 text-xs whitespace-pre-wrap leading-relaxed min-h-[80px]">
          {{ aiResult.text }}
          <span v-if="aiResult.isStreaming" class="inline-block w-2 h-4 bg-[#D4AF37] animate-pulse ml-0.5"></span>
        </div>
      </div>

      <div
        v-else
        class="h-44 flex flex-col items-center justify-center text-center text-[#111111]/40 p-4 border border-[#111111]/10 rounded-lg"
      >
        <Bot class="w-7 h-7 mb-1.5 opacity-25" />
        <p class="text-xs">Kirim prompt untuk menguji SSE streaming dan quota guardrails.</p>
      </div>
    </div>
  </div>
</template>
