<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useClipboard } from '../composables/useClipboard'
import {
  Terminal,
  Copy,
  Check,
  Sparkles,
  BookOpen,
  Code2,
  ShieldCheck,
  Zap,
  Globe,
  Bot,
  ExternalLink,
  Layers,
} from 'lucide-vue-next'

import { api } from '../lib/api'
import type { AppItem } from '../types/app'

const copiedIndex = ref<number | null>(null)
const appsList = ref<AppItem[]>([])
const selectedAppSlug = ref('')
const selectedWidgetType = ref<'verified' | 'sales_counter' | 'status'>('verified')
const widgetCustomers = ref<number | null>(null)
const { copy: writeClipboard } = useClipboard()
let copyTimer: ReturnType<typeof setTimeout> | null = null

const currentApp = computed(() => {
  return appsList.value.find((a) => a.slug === selectedAppSlug.value) || appsList.value[0] || null
})

const currentAppId = computed(() => currentApp.value?.id || 'app_sample_id')
const currentAppPrice = computed(() => currentApp.value?.targetPrice || 0)

async function loadWidgetSales() {
  if (!selectedAppSlug.value) return
  try {
    const res = await fetch(`/api/v1/widgets/badge/${selectedAppSlug.value}`)
    if (!res.ok) {
      widgetCustomers.value = null
      return
    }
    const json = await res.json()
    widgetCustomers.value = typeof json?.data?.totalCustomers === 'number' ? json.data.totalCustomers : null
  } catch {
    widgetCustomers.value = null
  }
}

async function loadApps() {
  try {
    const res = await api.getApps()
    appsList.value = res.apps || []
    if (res.apps && res.apps.length > 0 && !selectedAppSlug.value) {
      selectedAppSlug.value = res.apps[0].slug
    }
  } catch {
    // fallback
  }
  await loadWidgetSales()
}

onMounted(loadApps)
watch(selectedAppSlug, loadWidgetSales)

onUnmounted(() => {
  if (copyTimer) {
    clearTimeout(copyTimer)
    copyTimer = null
  }
})

async function copyCode(text: string, index: number) {
  const ok = await writeClipboard(text)
  if (!ok) return
  copiedIndex.value = index
  if (copyTimer) clearTimeout(copyTimer)
  copyTimer = setTimeout(() => {
    if (copiedIndex.value === index) copiedIndex.value = null
    copyTimer = null
  }, 2000)
}

const aiPromptCursor = computed(() => {
  const activeSlug = selectedAppSlug.value || 'my-app'
  return `Kamu adalah Senior Fullstack Engineer. Tugasmu adalah mengintegrasikan infrastruktur tertaut.com ke dalam aplikasi ini menggunakan @tertaut/sdk.

Informasi Proyek:
- App ID: ${currentAppId.value}
- API Endpoint: ${typeof window !== 'undefined' ? window.location.origin : 'https://tertaut.com'}
- Target Model AI: fast-summary-model

Langkah Integrasi:
1. Pasang SDK: npm install @tertaut/sdk
2. Inisialisasi SDK:
   import { Tertaut } from '@tertaut/sdk';
   const tertaut = new Tertaut({ appId: '${currentAppId.value}', environment: 'production' });
3. Modul 1 (Checkout): Di tombol upgrade/beli, panggil tertaut.checkout({ amount: ${currentAppPrice.value}, grantDays: 30, redirectUrl: window.location.origin + '/dashboard' });
4. Modul 2 (Lisensi): Di startup aplikasi, validasi lisensi:
   const status = await tertaut.licensing.verify({ licenseKey: userSavedKey, hwid: deviceHardwareId });
5. Modul 3 (Streaming AI Gateway): Panggil LLM tanpa ekspos API key:
   const stream = await tertaut.aiProxy.chatStream({ licenseToken: userSavedKey, modelAlias: 'fast-summary-model', messages: [{ role: 'user', content: prompt }] });
   for await (const chunk of stream) { process.stdout.write(chunk.text); }
`
})

const widgetEmbedScript = computed(() => {
  const host = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'
  return `<!-- Tertaut.com Embeddable Trust & Sales Badge -->
<script src="${host}/api/v1/widgets/embed.js" async><\/script>
<tertaut-badge app="${selectedAppSlug.value || 'my-app'}" type="${selectedWidgetType.value}"></tertaut-badge>`
})

const sdkFullSnippet = computed(() => `import { Tertaut } from '@tertaut/sdk';

// Inisialisasi client library (< 15KB)
export const tertaut = new Tertaut({
  appId: '${currentAppId.value}',
  environment: 'production'
});

// 1. Modul 1: Direct Live Checkout (MoR Engine via Xendit)
export async function buyProduct() {
  await tertaut.checkout({
    amount: ${currentAppPrice.value},
    grantDays: 30,
    redirectUrl: 'https://myapp.com/dashboard'
  });
}

// 2. Modul 2: Universal Licensing Engine (Online & Offline Grace Period)
export async function checkEntitlement(licenseKey: string, hwid: string) {
  const result = await tertaut.licensing.verify({ licenseKey, hwid });
  return result.valid && result.status === 'ACTIVE';
}

// 3. Modul 3: Streaming AI Proxy Gateway (Zero API Key Leak)
export async function streamAiResponse(prompt: string, licenseToken: string) {
  const stream = await tertaut.aiProxy.chatStream({
    licenseToken,
    modelAlias: 'fast-summary-model',
    messages: [{ role: 'user', content: prompt }]
  });

  for await (const chunk of stream) {
    console.log(chunk.text);
  }
}
`)
</script>

<template>
  <div class="space-y-6 animate-fadeIn pb-16">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div>
        <div class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#D4AF37]/15 border border-[#D4AF37]/35 text-[#111111] text-[10px] font-bold mb-1">
          <BookOpen class="w-3 h-3 text-[#D4AF37]" />
          <span>Modul 5: Launch Kit &amp; Developer SDK</span>
        </div>
        <h1 class="text-xl md:text-2xl font-extrabold text-[#111111] tracking-tight">Developer Center &amp; AI Launch Kit</h1>
        <p class="text-xs text-[#111111]/60">
          SDK ultra-ringan (&lt; 15 KB), Web Component Embeddable Badges, dan Prompt-Ready Docs untuk Cursor &amp; v0.
        </p>
      </div>

      <div class="flex items-center gap-2">
        <a
          href="/api/v1/swagger"
          target="_blank"
          class="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#111111] text-[#D4AF37] text-xs font-bold transition hover:bg-[#111111]/90 shadow-sm"
        >
          <span>OpenAPI / Swagger</span>
          <ExternalLink class="w-3 h-3" />
        </a>
      </div>
    </div>

    <!-- Package Installation Banner -->
    <div class="space-y-2.5 pb-6 border-b border-[#111111]/10">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <Terminal class="w-4 h-4 text-[#D4AF37]" />
          <span class="text-xs font-bold text-[#111111]">Pemasangan Pustaka (@tertaut/sdk &lt; 15 KB)</span>
        </div>
        <button
          @click="copyCode('npm install @tertaut/sdk', 1)"
          class="text-xs font-bold text-[#D4AF37] hover:underline flex items-center gap-1 transition cursor-pointer"
        >
          <Check v-if="copiedIndex === 1" class="w-3.5 h-3.5 text-[#0F4C3A]" />
          <Copy v-else class="w-3.5 h-3.5" />
          <span>{{ copiedIndex === 1 ? 'Tersalin' : 'Salin Perintah' }}</span>
        </button>
      </div>

      <div class="p-2.5 rounded-lg bg-[#111111] font-mono text-xs text-[#D4AF37] border border-[#111111]/20 flex items-center justify-between">
        <span>npm install @tertaut/sdk</span>
        <span class="text-white/40 text-[10px]"># Zero heavy dependencies • Cross-platform</span>
      </div>
    </div>

    <!-- Prompt-Ready Integration Generator (FR-4.1) -->
    <div class="space-y-3 pb-6 border-b border-[#111111]/10">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div class="flex items-center gap-2">
          <Sparkles class="w-4 h-4 text-[#D4AF37]" />
          <div>
            <h2 class="text-sm font-bold text-[#111111]">Prompt-Ready Integration Snippet (Cursor / Windsurf / v0)</h2>
            <p class="text-[11px] text-[#111111]/60">Copy dan paste langsung ke editor berbasis AI untuk integrasi otomatis.</p>
          </div>
        </div>

        <button
          @click="copyCode(aiPromptCursor, 2)"
          class="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg btn-gold text-xs font-bold transition shrink-0 cursor-pointer shadow-sm"
        >
          <Check v-if="copiedIndex === 2" class="w-3.5 h-3.5 text-[#0F4C3A]" />
          <Copy v-else class="w-3.5 h-3.5" />
          <span>{{ copiedIndex === 2 ? 'Tersalin!' : 'Salin Prompt untuk AI' }}</span>
        </button>
      </div>

      <pre class="p-3.5 rounded-xl bg-[#111111] font-mono text-xs text-white/90 overflow-x-auto border border-[#111111]/20 whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto">{{ aiPromptCursor }}</pre>
    </div>

    <!-- Embeddable Badges & Social Proof Widgets Generator (FR-2.1 & FR-2.2) -->
    <div class="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-[#111111]/10 border-b border-[#111111]/10 pb-6 pt-1">
      <div class="pb-6 lg:pb-0 pr-0 lg:pr-6 space-y-3">
        <div class="flex items-center gap-2">
          <ShieldCheck class="w-4 h-4 text-[#0F4C3A]" />
          <h2 class="text-sm font-bold text-[#111111]">Generator Embeddable Widget &amp; Badges</h2>
        </div>
        <p class="text-xs text-[#111111]/60">
          Pasang Social Proof &amp; Trust Badge langsung di landing page Anda tanpa merusak styling (Shadow DOM Encapsulation).
        </p>

        <div class="space-y-3 text-xs">
          <div>
            <label class="block font-bold text-[#111111]/70 mb-1">Pilih Tipe Widget</label>
            <div class="grid grid-cols-3 gap-2">
              <button
                @click="selectedWidgetType = 'verified'"
                class="p-2 rounded-lg border font-bold text-center transition cursor-pointer"
                :class="selectedWidgetType === 'verified' ? 'bg-[#111111] text-[#D4AF37] border-[#111111]' : 'border-[#111111]/15 text-[#111111]/70 hover:bg-[#111111]/5'"
              >
                Verified Trust
              </button>
              <button
                @click="selectedWidgetType = 'sales_counter'"
                class="p-2 rounded-lg border font-bold text-center transition cursor-pointer"
                :class="selectedWidgetType === 'sales_counter' ? 'bg-[#111111] text-[#D4AF37] border-[#111111]' : 'border-[#111111]/15 text-[#111111]/70 hover:bg-[#111111]/5'"
              >
                Sales Counter
              </button>
              <button
                @click="selectedWidgetType = 'status'"
                class="p-2 rounded-lg border font-bold text-center transition cursor-pointer"
                :class="selectedWidgetType === 'status' ? 'bg-[#111111] text-[#D4AF37] border-[#111111]' : 'border-[#111111]/15 text-[#111111]/70 hover:bg-[#111111]/5'"
              >
                Live Status
              </button>
            </div>
          </div>

          <div>
            <label class="block font-bold text-[#111111]/70 mb-1">Slug Aplikasi Anda</label>
            <input
              v-model="selectedAppSlug"
              type="text"
              placeholder="nama-slug-aplikasi"
              class="w-full bg-[#111111]/5 border border-[#111111]/10 rounded-lg p-2 font-mono text-xs text-[#111111] focus:outline-none focus:bg-white focus:border-[#D4AF37] transition"
            />
          </div>

          <div class="space-y-1.5 pt-1">
            <div class="flex items-center justify-between">
              <span class="font-bold text-[#111111]/70 text-[11px]">Kode HTML Embed:</span>
              <button
                @click="copyCode(widgetEmbedScript, 4)"
                class="text-[11px] font-bold text-[#D4AF37] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Check v-if="copiedIndex === 4" class="w-3 h-3 text-[#0F4C3A]" />
                <Copy v-else class="w-3 h-3" />
                <span>{{ copiedIndex === 4 ? 'Tersalin' : 'Salin Snippet' }}</span>
              </button>
            </div>
            <pre class="p-2.5 rounded-lg bg-[#111111] font-mono text-[11px] text-[#D4AF37] overflow-x-auto whitespace-pre-wrap leading-relaxed">{{ widgetEmbedScript }}</pre>
          </div>
        </div>
      </div>

      <!-- Live Widget Preview -->
      <div class="pt-6 lg:pt-0 pl-0 lg:pl-6 space-y-4 flex flex-col justify-between">
        <div>
          <h2 class="text-sm font-bold text-[#111111]">Pratinjau Widget (Live Preview)</h2>
          <p class="text-xs text-[#111111]/60">Tampilan render di situs web pembeli:</p>
        </div>

        <div class="h-40 flex flex-col items-center justify-center p-6 border border-dashed border-[#111111]/20 rounded-xl bg-[#FAFAFA] space-y-3">
          <!-- Verified Trust Preview -->
          <div
            v-if="selectedWidgetType === 'verified'"
            class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#111111] text-white border border-[#D4AF37]/50 shadow-md text-xs font-bold cursor-pointer transition hover:scale-105"
          >
            <ShieldCheck class="w-3.5 h-3.5 text-[#D4AF37]" />
            <span>Verified by tertaut.com</span>
          </div>

          <!-- Sales Counter Preview -->
          <div
            v-else-if="selectedWidgetType === 'sales_counter'"
            class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#111111] text-white border border-[#D4AF37]/50 shadow-md text-xs font-bold cursor-pointer transition hover:scale-105"
          >
            <span class="w-2 h-2 rounded-full bg-[#0F4C3A] animate-ping"></span>
            <span>{{ widgetCustomers === null ? '—' : `${widgetCustomers.toLocaleString('id-ID')} Lisensi Terjual` }}</span>
            <span class="opacity-30">•</span>
            <span class="text-[#D4AF37]">tertaut</span>
          </div>

          <!-- Status Indicator Preview -->
          <div
            v-else
            class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#111111] text-white border border-[#D4AF37]/50 shadow-md text-xs font-bold cursor-pointer transition hover:scale-105"
          >
            <span class="w-2 h-2 rounded-full bg-[#0F4C3A]"></span>
            <span>Just Launched</span>
            <span class="opacity-30">•</span>
            <span class="text-[#D4AF37]">tertaut</span>
          </div>

          <p class="text-[10px] text-[#111111]/50 text-center">
            Terisolasi di dalam Web Component Shadow DOM sehingga tidak mengganggu CSS landing page utama.
          </p>
        </div>

        <div class="text-[11px] text-[#111111]/60 flex items-center justify-between border-t border-[#111111]/10 pt-3">
          <span>Tersedia juga format SVG statis:</span>
          <a
            :href="`/api/v1/badge/${selectedAppSlug}`"
            target="_blank"
            class="text-[#D4AF37] font-bold hover:underline flex items-center gap-1"
          >
            <span>/api/v1/badge/{{ selectedAppSlug }}.svg</span>
            <ExternalLink class="w-3 h-3" />
          </a>
        </div>
      </div>
    </div>

    <!-- Complete Unified SDK Reference Code (FR-3.2) -->
    <div class="space-y-3 pt-2">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <Code2 class="w-4 h-4 text-[#D4AF37]" />
          <h2 class="text-sm font-bold text-[#111111]">Referensi Kode Lengkap (@tertaut/sdk Multi-Module Interface)</h2>
        </div>
        <button
          @click="copyCode(sdkFullSnippet, 3)"
          class="text-xs font-bold text-[#D4AF37] hover:underline flex items-center gap-1 transition cursor-pointer"
        >
          <Check v-if="copiedIndex === 3" class="w-3.5 h-3.5 text-[#0F4C3A]" />
          <Copy v-else class="w-3.5 h-3.5" />
          <span>{{ copiedIndex === 3 ? 'Tersalin' : 'Salin Kode' }}</span>
        </button>
      </div>

      <pre class="p-4 rounded-xl bg-[#111111] font-mono text-xs text-white/90 overflow-x-auto border border-[#111111]/20 leading-relaxed">{{ sdkFullSnippet }}</pre>
    </div>
  </div>
</template>
