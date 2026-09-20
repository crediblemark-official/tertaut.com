<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import {
  X,
  Monitor,
  Activity,
  RefreshCw,
  Wifi,
  WifiOff,
  LogOut,
  Box,
  Globe,
  KeyRound,
  Check,
  AlertTriangle,
} from 'lucide-vue-next'
import { api } from '../../lib/api'
import type { LicenseItem, SeatsResponse, LicenseEventItem, LicenseSeatItem } from '../../types/licensing'

const props = defineProps<{
  license: LicenseItem | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'deactivateSeat', key: string, hwid: string): void
}>()

const tab = ref<'seats' | 'audit'>('seats')
const loadingSeats = ref(false)
const loadingEvents = ref(false)
const seatsData = ref<SeatsResponse | null>(null)
const events = ref<LicenseEventItem[]>([])
const errorMsg = ref<string | null>(null)
let pollTimer: ReturnType<typeof setInterval> | null = null

async function loadSeats() {
  if (!props.license) return
  loadingSeats.value = true
  errorMsg.value = null
  try {
    const res = await api.getLicenseSeats(props.license.licenseKey)
    if (res.success) {
      seatsData.value = res
    } else {
      errorMsg.value = 'Gagal memuat data seats.'
    }
  } catch (e: any) {
    errorMsg.value = `Error: ${e?.message || 'Terjadi kesalahan'}`
  } finally {
    loadingSeats.value = false
  }
}

async function loadEvents() {
  if (!props.license) return
  loadingEvents.value = true
  try {
    const res = await api.getLicenseEvents({ licenseKey: props.license.licenseKey, limit: 50 })
    if (res.success) {
      events.value = res.events || []
    }
  } catch (e: any) {
    console.error(e)
  } finally {
    loadingEvents.value = false
  }
}

function switchTab(t: 'seats' | 'audit') {
  tab.value = t
  if (t === 'seats') loadSeats()
  else loadEvents()
}

async function handleDeactivate(seat: LicenseSeatItem) {
  if (!props.license) return
  if (seat.leaseActive) {
    if (!confirm('Perangkat ini masih memegang lease floating aktif. Lepas seat sekaligus melepas lease?')) return
  }
  emit('deactivateSeat', props.license.licenseKey, seat.hwidHash)
  await loadSeats()
}

watch(
  () => props.license,
  (val) => {
    if (!val) return
    errorMsg.value = null
    loadSeats()
  },
  { immediate: true }
)

onMounted(() => {
  if (props.license) loadSeats()
  pollTimer = setInterval(() => {
    if (props.license && tab.value === 'seats' && !document.hidden) loadSeats()
  }, 15000)
})

onUnmounted(() => {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
})

const EVENT_LABELS: Record<string, string> = {
  'license.issued': 'Lisensi diterbitkan',
  'license.activated': 'Perangkat diaktifkan',
  'license.deactivated': 'Seat perangkat dilepas',
  'license.seat_full': 'Seat penuh (aktivasi ditolak)',
  'license.revoked': 'Lisensi dicabut',
  'license.expired': 'Lisensi kadaluarsa',
  'license.renewed': 'Lisensi diperpanjang',
  'license.transferred': 'Lisensi dipindahkan',
}

function fmt(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })
}

function timeAgo(iso: string | null | undefined): string {
  if (!iso) return '—'
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return `${s}d lalu`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m lalu`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}j lalu`
  const d = Math.floor(h / 24)
  return `${d}h lalu`
}

function actorLabel(ev: LicenseEventItem): string {
  return ev.actorType === 'CLIENT'
    ? 'Perangkat klien'
    : ev.actorType === 'ADMIN'
      ? 'Admin'
      : ev.actorType === 'BUILDER'
        ? 'Builder'
        : ev.actorType
}
</script>

<template>
  <div v-if="license" class="fixed inset-0 bg-jetblack/50 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4">
    <div class="bg-white rounded-xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-xl border border-jetblack/10 animate-fadeIn overflow-hidden">
      <!-- Header -->
      <div class="px-4 py-3 bg-jetblack text-white flex items-center justify-between gap-2">
        <div class="min-w-0">
          <div class="flex items-center gap-2">
            <Activity class="w-4 h-4 text-gold shrink-0" />
            <h3 class="text-xs font-bold uppercase tracking-wider truncate">Detail Lisensi</h3>
          </div>
          <p class="font-mono text-[10px] text-white/60 mt-0.5 truncate">
            {{ license.licenseKey }} <span class="text-gold">•</span> {{ license.customerEmail }}
          </p>
        </div>
        <button @click="emit('close')" class="text-white/50 hover:text-white cursor-pointer p-1">
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Tabs -->
      <div class="flex border-b border-jetblack/10 px-4 gap-4">
        <button
          @click="switchTab('seats')"
          :class="['py-2 text-[11px] font-bold transition cursor-pointer relative', tab === 'seats' ? 'text-jetblack' : 'text-jetblack/40 hover:text-jetblack/70']"
        >
          <span class="inline-flex items-center gap-1">
            <Monitor class="w-3.5 h-3.5" /> Seat Perangkat
          </span>
          <span v-if="tab === 'seats'" class="absolute left-0 right-0 -bottom-px h-0.5 bg-gold" />
        </button>
        <button
          @click="switchTab('audit')"
          :class="['py-2 text-[11px] font-bold transition cursor-pointer relative', tab === 'audit' ? 'text-jetblack' : 'text-jetblack/40 hover:text-jetblack/70']"
        >
          <span class="inline-flex items-center gap-1">
            <Activity class="w-3.5 h-3.5" /> Audit Trail
          </span>
          <span v-if="tab === 'audit'" class="absolute left-0 right-0 -bottom-px h-0.5 bg-gold" />
        </button>
      </div>

      <!-- Body -->
      <div class="flex-1 overflow-y-auto p-4 space-y-3">
        <!-- Summary strip -->
        <div class="flex flex-wrap items-center gap-2 text-[10px] font-mono">
          <span class="px-2 py-0.5 rounded-full bg-forest/10 text-forest font-bold">{{ license.status }}</span>
          <span class="px-2 py-0.5 rounded-full bg-jetblack/5 text-jetblack/70">
            Seats: {{ seatsData?.seatsUsed ?? license.seatsUsed ?? 0 }} / {{ license.maxSeats }}
          </span>
          <span
            v-if="seatsData?.floating"
            class="px-2 py-0.5 rounded-full bg-gold/15 text-[#7a641a] font-bold"
          >
            <Wifi class="w-2.5 h-2.5 inline mr-0.5 -mt-0.5" /> Floating — TTL lease {{ seatsData.leaseTtlSeconds ?? '—' }}s
          </span>
          <span
            v-else
            class="px-2 py-0.5 rounded-full bg-jetblack/5 text-jetblack/50"
          >
            <WifiOff class="w-2.5 h-2.5 inline mr-0.5 -mt-0.5" /> Fixed seat (bukan floating)
          </span>
          <span class="text-jetblack/40">Masa aktif s/d {{ fmt(license.expiresAt) }}</span>
        </div>

        <div v-if="errorMsg" class="p-2.5 rounded-lg bg-crimson/10 border border-crimson/20 text-crimson text-[11px] font-bold flex items-center gap-1.5">
          <AlertTriangle class="w-3.5 h-3.5" /> {{ errorMsg }}
        </div>

        <div class="flex items-center justify-end">
          <button
            @click="tab === 'seats' ? loadSeats() : loadEvents()"
            title="Segarkan"
            class="p-1.5 rounded-md bg-jetblack/5 hover:bg-jetblack/10 text-jetblack cursor-pointer transition"
          >
            <RefreshCw class="w-3.5 h-3.5" :class="{ 'animate-spin': tab === 'seats' ? loadingSeats : loadingEvents }" />
          </button>
        </div>

        <!-- SEATS TAB -->
        <div v-if="tab === 'seats'">
          <div v-if="(seatsData?.seats?.length ?? 0) === 0 && !loadingSeats" class="text-center py-6">
            <Monitor class="w-6 h-6 mx-auto text-jetblack/20" />
            <p class="text-xs font-semibold text-jetblack/50 mt-2">Belum ada perangkat terikat.</p>
            <p class="text-[11px] text-jetblack/35 mt-0.5">Seat muncul saat klien melakukan aktivasi (bind hardware).</p>
          </div>

          <div v-for="seat in seatsData?.seats ?? []" :key="seat.hwidHash" class="rounded-lg border border-jetblack/10 p-3 space-y-1.5 mb-2">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div class="flex items-center gap-2 min-w-0">
                <span
                  class="w-2 h-2 rounded-full shrink-0"
                  :class="seat.leaseActive ? 'bg-forest animate-pulse' : 'bg-jetblack/25'"
                />
                <span class="text-xs font-bold text-jetblack truncate">{{ seat.deviceName || 'Perangkat tanpa nama' }}</span>
                <code class="text-[10px] text-jetblack/50 font-mono">{{ seat.hwidHash.substring(0, 10) }}…</code>
              </div>
              <div class="flex items-center gap-1.5">
                <span
                  :class="[
                    'px-2 py-0.5 rounded-full text-[9px] font-bold',
                    seat.leaseActive
                      ? 'bg-forest/10 text-forest'
                      : 'bg-jetblack/5 text-jetblack/50',
                  ]"
                >
                  {{ seat.leaseActive ? 'LEASE AKTIF' : 'IDLE' }}
                </span>
                <button
                  @click="handleDeactivate(seat)"
                  title="Lepas Seat"
                  class="p-1.5 rounded-md bg-crimson/10 hover:bg-crimson/20 text-crimson cursor-pointer"
                >
                  <LogOut class="w-3 h-3" />
                </button>
              </div>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-1 text-[10px] font-mono text-jetblack/60">
              <span class="inline-flex items-center gap-1"><Wifi class="w-3 h-3" /> Heartbeat: {{ timeAgo(seat.lastHeartbeatAt) }}</span>
              <span class="inline-flex items-center gap-1"><Box class="w-3 h-3" /> Terikat: {{ timeAgo(seat.createdAt) }}</span>
              <span class="inline-flex items-center gap-1"><Globe class="w-3 h-3" /> IP: {{ seat.ipAddress || '—' }}</span>
            </div>
            <div v-if="seat.leaseActive" class="text-[10px] font-mono text-[#7a641a]">
              Lease diperbarui {{ fmt(seat.lastValidatedAt) }} • berakhir {{ fmt(seat.leaseExpiresAt) }}
            </div>
            <div v-else class="text-[10px] font-mono text-jetblack/40">
              Validasi terakhir {{ fmt(seat.lastValidatedAt) }}
            </div>
          </div>
        </div>

        <!-- AUDIT TAB -->
        <div v-else>
          <div v-if="events.length === 0 && !loadingEvents" class="text-center py-6">
            <Activity class="w-6 h-6 mx-auto text-jetblack/20" />
            <p class="text-xs font-semibold text-jetblack/50 mt-2">Belum ada event.</p>
          </div>

          <ol class="relative border-l border-jetblack/15 ml-1.5 space-y-3">
            <li v-for="ev in events" :key="ev.id" class="pl-4 relative">
              <span class="absolute -left-[5px] top-1 w-2.5 h-2.5 rounded-full bg-gold" />
              <div class="flex flex-wrap items-center gap-1.5">
                <span class="px-1.5 py-0.5 rounded bg-jetblack/5 text-jetblack/80 text-[10px] font-mono font-bold">
                  {{ ev.event }}
                </span>
                <span class="text-[10px] text-jetblack/40 font-mono">{{ timeAgo(ev.createdAt) }}</span>
              </div>
              <p class="text-[11px] text-jetblack/70 mt-0.5">{{ EVENT_LABELS[ev.event] || ev.event }}</p>
              <p class="text-[10px] font-mono text-jetblack/40">
                <span class="inline-flex items-center gap-1"><KeyRound class="w-2.5 h-2.5" /> {{ actorLabel(ev) }}</span>
                <template v-if="ev.ipAddress"> <span>•</span> {{ ev.ipAddress }}</template>
                <template v-if="ev.payload">
                  <span>•</span>
                  <code class="text-[#7a641a]">{{ ev.payload }}</code>
                </template>
              </p>
            </li>
          </ol>
        </div>
      </div>

      <!-- Footer -->
      <div class="px-4 py-2.5 border-t border-jetblack/10 flex items-center justify-between">
        <span class="text-[10px] text-jetblack/40 inline-flex items-center gap-1">
          <Check class="w-3 h-3 text-forest" /> Refresh otomatis tiap 15 detik untuk tab Seat.
        </span>
        <button
          @click="emit('close')"
          class="px-3 py-1.5 rounded-lg bg-jetblack/5 hover:bg-jetblack/10 text-[11px] font-bold text-jetblack cursor-pointer"
        >
          Tutup
        </button>
      </div>
    </div>
  </div>
</template>