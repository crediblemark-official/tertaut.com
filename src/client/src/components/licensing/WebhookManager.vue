<script setup lang="ts">
import { ref, onMounted } from 'vue'
import {
  Webhook,
  Plus,
  Trash2,
  RefreshCw,
  Send,
  Copy,
  Pencil,
  Check,
  Eye,
  EyeOff,
  KeyRound,
} from 'lucide-vue-next'
import { api } from '../../lib/api'
import { useClipboard } from '../../composables/useClipboard'
import type { WebhookEndpointItem } from '../../types/licensing'

const WEBHOOK_EVENT_LABELS: Record<string, string> = {
  'license.issued': 'License Diterbitkan',
  'license.activated': 'License Diaktifkan',
  'license.deactivated': 'License Di-deactivate',
  'license.seat_full': 'Seat Penuh',
  'license.revoked': 'License Dicabut (Revoke)',
  'license.expired': 'License Kadaluarsa',
  'license.renewed': 'License Diperpanjang',
  'license.transferred': 'License Dipindah',
  'license.unbound': 'Hardware Unbound',
  'credits.insufficient': 'Kredit Tidak Cukup',
}

const loading = ref(true)
const webhooks = ref<WebhookEndpointItem[]>([])
const availableEvents = ref<string[]>(Object.keys(WEBHOOK_EVENT_LABELS))
const feedback = ref<string | null>(null)
let feedbackTimer: ReturnType<typeof setTimeout> | null = null

const { copy: writeClipboard } = useClipboard()

const importing = ref(false)
const importUrl = ref('')
const importEvents = ref<string[]>([])
const importAdvancedOpen = ref(false)
const importSecret = ref('')

const editingId = ref<string | null>(null)
const editUrl = ref('')
const editEvents = ref<string[]>([])
const revealSecretId = ref<string | null>(null)

function setFeedback(msg: string, timeoutMs = 4000) {
  if (feedbackTimer) clearTimeout(feedbackTimer)
  feedback.value = msg
  feedbackTimer = setTimeout(() => {
    feedback.value = null
    feedbackTimer = null
  }, timeoutMs)
}

function toggleEvent(list: string[], event: string) {
  const idx = list.indexOf(event)
  if (idx >= 0) list.splice(idx, 1)
  else list.push(event)
}

async function loadWebhooks() {
  loading.value = true
  try {
    const res = await api.getWebhooks()
    webhooks.value = res.webhooks || []
    if (res.events && res.events.length) {
      availableEvents.value = res.events
    }
  } catch (e: any) {
    setFeedback(`Gagal memuat webhook: ${e?.message || 'unknown'}`, 5000)
  } finally {
    loading.value = false
  }
}

async function createWebhook() {
  if (!importUrl.value) return
  importing.value = true
  try {
    const res = await api.createWebhook({
      url: importUrl.value,
      events: [...importEvents.value],
      secret: importSecret.value || undefined,
    })
    if (res.success && res.webhook) {
      setFeedback('Webhook endpoint berhasil didaftarkan!')
      importUrl.value = ''
      importSecret.value = ''
      await loadWebhooks()
    } else {
      setFeedback(`Gagal: ${res.error || 'Terjadi kesalahan'}`, 5000)
    }
  } catch (e: any) {
    setFeedback(`Error: ${e?.message || 'Terjadi kesalahan'}`, 5000)
  } finally {
    importing.value = false
  }
}

async function saveEdit(id: string) {
  try {
    const res = await api.updateWebhook(id, {
      url: editUrl.value,
      events: [...editEvents.value],
    })
    if (res.success) {
      setFeedback('Webhook diperbarui!')
      editingId.value = null
      await loadWebhooks()
    } else {
      setFeedback(`Gagal: ${res.error || 'Terjadi kesalahan'}`, 5000)
    }
  } catch (e: any) {
    setFeedback(`Error: ${e?.message || 'Terjadi kesalahan'}`, 5000)
  }
}

function editWebhook(w: WebhookEndpointItem) {
  editingId.value = w.id
  editUrl.value = w.url
  editEvents.value = [...w.events]
}

async function toggleActive(w: WebhookEndpointItem) {
  try {
    const res = await api.updateWebhook(w.id, { isActive: !w.isActive })
    if (res.success) {
      setFeedback(`Webhook ${w.isActive ? 'dinonaktifkan' : 'diaktifkan'}.`)
      await loadWebhooks()
    } else {
      setFeedback(`Gagal: ${res.error || 'Terjadi kesalahan'}`, 5000)
    }
  } catch (e: any) {
    setFeedback(`Error: ${e?.message || 'Terjadi kesalahan'}`, 5000)
  }
}

async function testWebhook(w: WebhookEndpointItem) {
  try {
    const res = await api.testWebhook(w.id)
    if (res.success) {
      setFeedback(`Test delivery terkirim (delivery ${res.deliveryId}).`)
    } else {
      setFeedback(`Gagal test: ${res.error || 'Terjadi kesalahan'}`, 5000)
    }
  } catch (e: any) {
    setFeedback(`Error: ${e?.message || 'Terjadi kesalahan'}`, 5000)
  }
}

async function rotateSecret(w: WebhookEndpointItem) {
  if (!confirm(`Rotasi secret untuk ${w.url}? Pastikan server penerima diperbarui segera.`)) return
  try {
    const res = await api.rotateWebhookSecret(w.id)
    if (res.success && res.webhook) {
      setFeedback('Secret baru telah diterbitkan. Salin sekarang!', 6000)
      await loadWebhooks()
      revealSecretId.value = res.webhook.id
    } else {
      setFeedback(`Gagal rotasi: ${res.error || 'Terjadi kesalahan'}`, 5000)
    }
  } catch (e: any) {
    setFeedback(`Error: ${e?.message || 'Terjadi kesalahan'}`, 5000)
  }
}

async function deleteWebhook(w: WebhookEndpointItem) {
  if (!confirm(`Hapus webhook endpoint ${w.url}?`)) return
  try {
    const res = await api.deleteWebhook(w.id)
    if (res.success) {
      setFeedback('Webhook endpoint dihapus.')
      await loadWebhooks()
    } else {
      setFeedback(`Gagal: ${res.error || 'Terjadi kesalahan'}`, 5000)
    }
  } catch (e: any) {
    setFeedback(`Error: ${e?.message || 'Terjadi kesalahan'}`, 5000)
  }
}

async function copySecret(w: WebhookEndpointItem) {
  const ok = await writeClipboard(w.secret)
  if (!ok) {
    setFeedback('Gagal menyalin secret ke clipboard.', 3000)
    return
  }
  setFeedback('Secret disalin ke clipboard!', 3000)
}

async function copyUrl(w: WebhookEndpointItem) {
  const ok = await writeClipboard(w.url)
  if (!ok) {
    setFeedback('Gagal menyalin URL.', 3000)
    return
  }
  setFeedback('URL disalin ke clipboard!', 3000)
}

onMounted(loadWebhooks)
</script>

<template>
  <div class="animate-fadeIn space-y-4">
    <!-- Feedback -->
    <div
      v-if="feedback"
      class="p-3 rounded-xl bg-[#0F4C3A]/10 border border-[#0F4C3A]/30 text-[#0F4C3A] text-xs font-bold flex items-center gap-2 animate-fadeIn"
    >
      <Check class="w-4 h-4" />
      <span>{{ feedback }}</span>
    </div>

    <!-- Create Webhook -->
    <div class="-mx-3.5 sm:-mx-4 md:-mx-6 px-3.5 sm:px-4 md:px-6 py-3 bg-[#111111] text-white">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <Webhook class="w-4 h-4 text-[#D4AF37]" />
          <h2 class="text-xs font-bold uppercase tracking-wider">Webhook Endpoints</h2>
          <span class="text-[10px] px-2 py-0.5 rounded-full bg-white/10 font-mono">
            {{ webhooks.length }} endpoint
          </span>
        </div>
        <button
          @click="loadWebhooks"
          title="Segarkan"
          class="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer transition"
        >
          <RefreshCw class="w-3.5 h-3.5" :class="{ 'animate-spin': loading }" />
        </button>
      </div>
    </div>

    <!-- New endpoint form -->
    <div class="rounded-xl border border-[#111111]/10 bg-white shadow-xs p-3.5 sm:p-4 space-y-3">
      <h3 class="text-[11px] font-bold uppercase tracking-wider text-[#111111]/60 flex items-center gap-1.5">
        <Plus class="w-3.5 h-3.5" /> Daftarkan Endpoint Baru
      </h3>
      <div class="space-y-2.5 text-xs">
        <div>
          <label class="block font-semibold text-[11px] text-[#111111]/70 mb-1">Callback URL</label>
          <input
            v-model="importUrl"
            type="url"
            placeholder="https://server-andamu.com/api/webhooks/tertaut"
            class="w-full bg-white border border-[#111111]/15 rounded-lg px-2.5 py-1.5 text-xs text-[#111111] font-mono focus:outline-none focus:border-[#D4AF37]"
          />
        </div>

        <div>
          <label class="block font-semibold text-[11px] text-[#111111]/70 mb-1">
            Event yang Dilanggan <span class="text-[10px] text-[#111111]/40 font-normal">(kosongkan semua = semua event)</span>
          </label>
          <div class="flex flex-wrap gap-1.5">
            <button
              v-for="ev in availableEvents"
              :key="ev"
              @click="toggleEvent(importEvents, ev)"
              :class="[
                'px-2 py-1 rounded-md text-[10px] font-bold transition cursor-pointer border',
                importEvents.includes(ev)
                  ? 'bg-[#111111] text-white border-[#111111]'
                  : 'bg-white text-[#111111]/60 border-[#111111]/15 hover:border-[#111111]/40',
              ]"
              :title="WEBHOOK_EVENT_LABELS[ev] || ev"
            >
              {{ WEBHOOK_EVENT_LABELS[ev] || ev }}
            </button>
          </div>
        </div>

        <div class="pt-0.5 flex flex-wrap items-center justify-between gap-2">
          <button
            @click="importAdvancedOpen = !importAdvancedOpen"
            class="text-[10px] font-bold text-[#111111]/50 hover:text-[#111111] cursor-pointer inline-flex items-center gap-1"
          >
            <KeyRound class="w-3 h-3" /> {{ importAdvancedOpen ? 'Sembunyikan' : 'Tampilkan' }} Secret Opsional
          </button>
          <button
            @click="createWebhook"
            :disabled="importing || !importUrl"
            class="btn-gold px-3.5 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Plus class="w-3.5 h-3.5" />
            <span>{{ importing ? 'Menyimpan...' : 'Daftarkan Endpoint' }}</span>
          </button>
        </div>

        <div v-if="importAdvancedOpen" class="rounded-lg bg-[#111111]/[0.03] border border-[#111111]/10 p-2.5">
          <label class="block font-semibold text-[11px] text-[#111111]/70 mb-1">
            Secret Awal (opsional, untuk HMAC hex-hmac-sha256)
          </label>
          <input
            v-model="importSecret"
            type="password"
            placeholder="Kosongkan untuk generate otomatis"
            class="w-full bg-white border border-[#111111]/15 rounded-lg px-2.5 py-1.5 text-xs text-[#111111] font-mono focus:outline-none focus:border-[#D4AF37]"
          />
          <p class="mt-1.5 text-[10px] text-[#111111]/50 leading-relaxed">
            Setiap delivery ditandatangani header <code class="font-mono">x-tertaut-signature: hex hmac-sha256(endpoint.secret, rawBody)</code>. Tersedia event berikut:
            <span class="font-mono">{{ availableEvents.join(', ') }}</span>.
          </p>
        </div>
      </div>
    </div>

    <!-- Endpoint list -->
    <div v-if="webhooks.length === 0 && !loading" class="rounded-xl border border-dashed border-[#111111]/20 p-6 text-center">
      <p class="text-xs font-semibold text-[#111111]/50">Belum ada webhook endpoint.</p>
      <p class="text-[11px] text-[#111111]/35 mt-1">Daftarkan endpoint di atas untuk mulai menerima event lifecycle lisensi.</p>
    </div>

    <div v-for="w in webhooks" :key="w.id" class="rounded-xl border border-[#111111]/10 bg-white shadow-xs overflow-hidden">
      <div class="flex flex-col sm:flex-row sm:items-center gap-2 px-3.5 py-2.5 bg-[#111111]/[0.03] border-b border-[#111111]/5">
        <div class="flex items-center gap-2 min-w-0 flex-1">
          <span
            class="w-2 h-2 rounded-full shrink-0"
            :class="w.isActive ? 'bg-[#0F4C3A]' : 'bg-[#8B0000]'"
            :title="w.isActive ? 'Aktif' : 'Nonaktif'"
          />
          <span class="font-mono text-[11px] truncate text-[#111111]">{{ w.url }}</span>
        </div>
        <div class="flex items-center gap-1.5">
          <button
            @click="copyUrl(w)"
            title="Salin URL"
            class="p-1.5 rounded-md bg-[#111111]/5 hover:bg-[#111111]/10 cursor-pointer"
          >
            <Copy class="w-3 h-3" />
          </button>
          <button
            @click="toggleActive(w)"
            :class="[
              'px-2 py-1 rounded-md text-[10px] font-bold cursor-pointer transition',
              w.isActive ? 'bg-[#8B0000]/10 text-[#8B0000] hover:bg-[#8B0000]/20' : 'bg-[#0F4C3A]/10 text-[#0F4C3A] hover:bg-[#0F4C3A]/20',
            ]"
          >
            {{ w.isActive ? 'Nonaktifkan' : 'Aktifkan' }}
          </button>
        </div>
      </div>

      <div class="px-3.5 py-2.5 space-y-2">
        <div class="flex flex-wrap gap-1">
          <span
            v-if="w.events.length === 0"
            class="px-1.5 py-0.5 rounded bg-[#D4AF37]/15 text-[#7a641a] text-[10px] font-bold"
          >
            * (semua event)
          </span>
          <span
            v-for="ev in w.events"
            :key="ev"
            class="px-1.5 py-0.5 rounded bg-[#111111]/5 text-[#111111]/70 text-[10px] font-mono"
          >
            {{ ev }}
          </span>
        </div>

        <!-- Edit mode -->
        <div v-if="editingId === w.id" class="space-y-2 border-t border-[#111111]/5 pt-2">
          <input
            v-model="editUrl"
            type="url"
            placeholder="Callback URL baru"
            class="w-full bg-white border border-[#111111]/15 rounded-lg px-2.5 py-1.5 text-xs text-[#111111] font-mono focus:outline-none focus:border-[#D4AF37]"
          />
          <div class="flex flex-wrap gap-1">
            <button
              v-for="ev in availableEvents"
              :key="ev"
              @click="toggleEvent(editEvents, ev)"
              :class="[
                'px-1.5 py-0.5 rounded text-[9px] font-bold transition cursor-pointer border',
                editEvents.includes(ev)
                  ? 'bg-[#111111] text-white border-[#111111]'
                  : 'bg-white text-[#111111]/60 border-[#111111]/15',
              ]"
            >
              {{ WEBHOOK_EVENT_LABELS[ev] || ev }}
            </button>
          </div>
          <div class="flex justify-end gap-1.5">
            <button
              @click="editingId = null"
              class="px-2.5 py-1 rounded-md bg-[#111111]/5 text-[10px] font-bold text-[#111111] hover:bg-[#111111]/10 cursor-pointer"
            >
              Batal
            </button>
            <button
              @click="saveEdit(w.id)"
              class="px-2.5 py-1 rounded-md btn-gold text-[10px] font-bold cursor-pointer"
            >
              Simpan
            </button>
          </div>
        </div>

        <!-- Detail row -->
        <div v-else class="flex flex-wrap items-center justify-between gap-2 pt-1">
          <div class="flex items-center gap-2 text-[10px] text-[#111111]/50 font-mono">
            <span>{{ w.builderId }}</span>
            <span>•</span>
            <span>dibuat {{ new Date(w.createdAt).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' }) }}</span>
          </div>
          <div class="flex items-center gap-1.5">
            <template v-if="revealSecretId === w.id">
              <code class="text-[10px] font-mono text-[#7a641a] bg-[#D4AF37]/10 px-1.5 py-0.5 rounded max-w-40 truncate">
                {{ w.secret }}
              </code>
              <button
                @click="copySecret(w)"
                title="Salin Secret"
                class="p-1.5 rounded-md bg-[#D4AF37]/10 hover:bg-[#D4AF37]/20 cursor-pointer"
              >
                <Copy class="w-3 h-3 text-[#7a641a]" />
              </button>
              <button
                @click="revealSecretId = null"
                title="Sembunyikan"
                class="p-1.5 rounded-md bg-[#111111]/5 hover:bg-[#111111]/10 cursor-pointer"
              >
                <EyeOff class="w-3 h-3" />
              </button>
            </template>
            <button
              v-else
              @click="revealSecretId = w.id"
              title="Lihat Secret"
              class="p-1.5 rounded-md bg-[#111111]/5 hover:bg-[#111111]/10 cursor-pointer"
            >
              <Eye class="w-3 h-3" />
            </button>
            <button
              @click="editWebhook(w)"
              title="Edit"
              class="p-1.5 rounded-md bg-[#111111]/5 hover:bg-[#111111]/10 cursor-pointer"
            >
              <Pencil class="w-3 h-3" />
            </button>
            <button
              @click="rotateSecret(w)"
              title="Rotasi Secret"
              class="p-1.5 rounded-md bg-[#D4AF37]/10 hover:bg-[#D4AF37]/20 cursor-pointer"
            >
              <KeyRound class="w-3 h-3 text-[#7a641a]" />
            </button>
            <button
              @click="testWebhook(w)"
              title="Kirim Test Delivery"
              class="p-1.5 rounded-md bg-[#0F4C3A]/10 hover:bg-[#0F4C3A]/20 cursor-pointer"
            >
              <Send class="w-3 h-3 text-[#0F4C3A]" />
            </button>
            <button
              @click="deleteWebhook(w)"
              title="Hapus"
              class="p-1.5 rounded-md bg-[#8B0000]/10 hover:bg-[#8B0000]/20 cursor-pointer"
            >
              <Trash2 class="w-3 h-3 text-[#8B0000]" />
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>