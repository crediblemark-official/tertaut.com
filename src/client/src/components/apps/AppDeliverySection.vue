<script setup lang="ts">
import { ref, watch } from 'vue'
import { KeyRound, Download, FileText, Zap, Wifi, Sparkles, Plus, Trash2 } from 'lucide-vue-next'
import type { DeliveryConfig } from '../../types/app'

const props = defineProps<{
  modelValue: DeliveryConfig
  meteringEnabled?: boolean
  meterName?: string
  meterAggregation?: string
  meteringUnitPrice?: string | number
  meteringMetricUnit?: string
  meteringFreeAllowance?: number
}>()

const emit = defineEmits<{
  'update:modelValue': [val: DeliveryConfig]
  openMeteringModal: []
  removeMetering: []
}>()

// Local reactive copies
const licenseEnabled = ref(props.modelValue.licenseKey?.enabled ?? true)
const maxSeats = ref(props.modelValue.licenseKey?.maxSeats ?? 3)
const expiresInDays = ref(props.modelValue.licenseKey?.expiresInDays ?? 365)
const offlineGraceDays = ref(props.modelValue.licenseKey?.offlineGraceDays ?? 30)
const floatingEnabled = ref(props.modelValue.licenseKey?.floating?.enabled ?? false)
const leaseTtlSeconds = ref(props.modelValue.licenseKey?.floating?.leaseTtlSeconds ?? 300)
const heartbeatIntervalSeconds = ref(props.modelValue.licenseKey?.floating?.heartbeatIntervalSeconds ?? 60)

const fileEnabled = ref(props.modelValue.fileDownload?.enabled ?? false)
const fileTitle = ref(props.modelValue.fileDownload?.title ?? 'Software Package')
const fileUrl = ref(props.modelValue.fileDownload?.fileUrl ?? '')
const fileName = ref(props.modelValue.fileDownload?.fileName ?? '')

const noteEnabled = ref(props.modelValue.privateNote?.enabled ?? false)
const noteTitle = ref(props.modelValue.privateNote?.title ?? 'Panduan Akses & Kredensial')
const noteContent = ref(props.modelValue.privateNote?.note ?? '')

const apiEnabled = ref(props.modelValue.apiAccess?.enabled ?? false)
const apiEndpoint = ref(props.modelValue.apiAccess?.endpointUrl ?? '')
const apiInstruction = ref(props.modelValue.apiAccess?.instruction ?? '')

function updateConfig() {
  const next: DeliveryConfig = {
    licenseKey: {
      enabled: licenseEnabled.value,
      description: 'Lisensi Universal Tertaut',
      maxSeats: Number(maxSeats.value) || 3,
      expiresInDays: Number(expiresInDays.value) || 365,
      offlineGraceDays: Number(offlineGraceDays.value) || 30,
      floating: floatingEnabled.value
        ? {
            enabled: true,
            leaseTtlSeconds: Number(leaseTtlSeconds.value) || 300,
            heartbeatIntervalSeconds: Number(heartbeatIntervalSeconds.value) || 60,
          }
        : undefined,
    },
    fileDownload: fileEnabled.value
      ? {
          enabled: true,
          title: fileTitle.value,
          fileUrl: fileUrl.value,
          fileName: fileName.value || undefined,
        }
      : undefined,
    privateNote: noteEnabled.value
      ? {
          enabled: true,
          title: noteTitle.value,
          note: noteContent.value,
        }
      : undefined,
    apiAccess: apiEnabled.value
      ? {
          enabled: true,
          endpointUrl: apiEndpoint.value,
          instruction: apiInstruction.value,
        }
      : undefined,
  }
  emit('update:modelValue', next)
}

watch([licenseEnabled, maxSeats, expiresInDays, offlineGraceDays, floatingEnabled, leaseTtlSeconds, heartbeatIntervalSeconds, fileEnabled, fileTitle, fileUrl, fileName, noteEnabled, noteTitle, noteContent, apiEnabled, apiEndpoint, apiInstruction], () => {
  updateConfig()
})
</script>

<template>
  <div class="space-y-4">
    <div class="border-b border-jetblack/10 pb-3">
      <div class="flex items-center gap-2">
        <div class="w-2 h-2 rounded-full bg-gold"></div>
        <h2 class="text-xs font-bold uppercase tracking-wider text-jetblack">Metode Pengiriman Digital (Delivery)</h2>
      </div>
      <p class="text-[11px] text-jetblack/60 mt-0.5">
        Tentukan apa yang diterima pelanggan secara instan via email &amp; dashboard setelah pembayaran berhasil.
      </p>
    </div>

    <!-- Delivery Channels Grid -->
    <div class="space-y-3">
      <!-- 1. License Key -->
      <div class="p-3.5 rounded-xl border transition" :class="licenseEnabled ? 'bg-white border-jetblack/20 shadow-xs' : 'bg-jetblack/[0.02] border-jetblack/10 opacity-70'">
        <label class="flex items-center justify-between cursor-pointer select-none">
          <div class="flex items-center gap-2.5">
            <div class="w-7 h-7 rounded-lg bg-gold/15 flex items-center justify-center text-jetblack shrink-0">
              <KeyRound class="w-3.5 h-3.5" />
            </div>
            <div>
              <div class="text-xs font-bold text-jetblack">Kunci Lisensi Software</div>
              <div class="text-[10px] text-jetblack/60">Kode aktivasi unik + token offline Ed25519 anti-pirasi</div>
            </div>
          </div>
          <div class="relative inline-flex items-center shrink-0">
            <input type="checkbox" v-model="licenseEnabled" class="sr-only peer" />
            <div class="w-9 h-5 bg-jetblack/15 rounded-full peer peer-checked:bg-forest transition-colors after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition peer-checked:after:translate-x-full shadow-xs"></div>
          </div>
        </label>

        <div v-if="licenseEnabled" class="mt-3 pt-3 border-t border-jetblack/10 space-y-3">
          <div class="grid grid-cols-3 gap-3">
            <div>
              <label class="block text-[10px] font-bold text-jetblack/70 mb-1">Batas Perangkat (Seats)</label>
              <input
                type="number"
                min="1"
                max="100"
                v-model="maxSeats"
                class="w-full px-2.5 py-1.5 rounded-lg bg-white border border-jetblack/15 text-xs font-mono font-bold text-jetblack focus:outline-none focus:border-gold"
              />
            </div>
            <div>
              <label class="block text-[10px] font-bold text-jetblack/70 mb-1">Masa Berlaku (Hari)</label>
              <input
                type="number"
                min="1"
                max="3650"
                v-model="expiresInDays"
                class="w-full px-2.5 py-1.5 rounded-lg bg-white border border-jetblack/15 text-xs font-mono font-bold text-jetblack focus:outline-none focus:border-gold"
              />
            </div>
            <div>
              <label class="block text-[10px] font-bold text-jetblack/70 mb-1">Offline Grace (Hari)</label>
              <input
                type="number"
                min="1"
                max="90"
                v-model="offlineGraceDays"
                title="Masa berlaku token offline (off-book) antar validasi online"
                class="w-full px-2.5 py-1.5 rounded-lg bg-white border border-jetblack/15 text-xs font-mono font-bold text-jetblack focus:outline-none focus:border-gold"
              />
            </div>
          </div>

          <!-- Floating License -->
          <div class="rounded-lg border p-2.5" :class="floatingEnabled ? 'bg-gold/5 border-gold/30' : 'bg-jetblack/[0.02] border-jetblack/10'">
            <label class="flex items-center justify-between cursor-pointer select-none">
              <div class="flex items-center gap-2">
                <div class="w-6 h-6 rounded-md bg-gold/15 flex items-center justify-center shrink-0">
                  <Wifi class="w-3 h-3 text-[#7a641a]" />
                </div>
                <div>
                  <div class="text-[11px] font-bold text-jetblack">Lisensi Floating (Lease &amp; Heartbeat)</div>
                  <div class="text-[10px] text-jetblack/60">Seat rolling: klien menyewa seat via lease TTL dan memperpanjang dengan heartbeat berkala</div>
                </div>
              </div>
              <div class="relative inline-flex items-center shrink-0">
                <input type="checkbox" v-model="floatingEnabled" class="sr-only peer" />
                <div class="w-9 h-5 bg-jetblack/15 rounded-full peer peer-checked:bg-gold transition-colors after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition peer-checked:after:translate-x-full shadow-xs"></div>
              </div>
            </label>

            <div v-if="floatingEnabled" class="grid grid-cols-2 gap-3 mt-2.5 pt-2.5 border-t border-gold/20">
              <div>
                <label class="block text-[10px] font-bold text-jetblack/70 mb-1">Lease TTL (Detik)</label>
                <input
                  type="number"
                  min="30"
                  max="86400"
                  v-model="leaseTtlSeconds"
                  class="w-full px-2.5 py-1.5 rounded-lg bg-white border border-jetblack/15 text-xs font-mono font-bold text-jetblack focus:outline-none focus:border-gold"
                />
              </div>
              <div>
                <label class="block text-[10px] font-bold text-jetblack/70 mb-1">Interval Heartbeat (Detik)</label>
                <input
                  type="number"
                  min="10"
                  max="3600"
                  v-model="heartbeatIntervalSeconds"
                  class="w-full px-2.5 py-1.5 rounded-lg bg-white border border-jetblack/15 text-xs font-mono font-bold text-jetblack focus:outline-none focus:border-gold"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 2. File Download -->
      <div class="p-3.5 rounded-xl border transition" :class="fileEnabled ? 'bg-white border-jetblack/20 shadow-xs' : 'bg-jetblack/[0.02] border-jetblack/10 opacity-70'">
        <label class="flex items-center justify-between cursor-pointer select-none">
          <div class="flex items-center gap-2.5">
            <div class="w-7 h-7 rounded-lg bg-blue-500/15 flex items-center justify-center text-blue-700 shrink-0">
              <Download class="w-3.5 h-3.5" />
            </div>
            <div>
              <div class="text-xs font-bold text-jetblack">Unduhan Berkas Digital (File Download)</div>
              <div class="text-[10px] text-jetblack/60">Tautan download aman untuk software installer, template, atau PDF</div>
            </div>
          </div>
          <div class="relative inline-flex items-center shrink-0">
            <input type="checkbox" v-model="fileEnabled" class="sr-only peer" />
            <div class="w-9 h-5 bg-jetblack/15 rounded-full peer peer-checked:bg-forest transition-colors after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition peer-checked:after:translate-x-full shadow-xs"></div>
          </div>
        </label>

        <div v-if="fileEnabled" class="space-y-2.5 mt-3 pt-3 border-t border-jetblack/10">
          <div>
            <label class="block text-[10px] font-bold text-jetblack/70 mb-1">Tautan URL Berkas</label>
            <input
              type="url"
              v-model="fileUrl"
              placeholder="https://storage.tertaut.com/releases/myapp-v1.zip"
              class="w-full px-2.5 py-1.5 rounded-lg bg-white border border-jetblack/15 text-xs text-jetblack placeholder:text-jetblack/30 focus:outline-none focus:border-gold"
            />
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-[10px] font-bold text-jetblack/70 mb-1">Label Tombol Unduh</label>
              <input
                type="text"
                v-model="fileTitle"
                placeholder="Unduh Software v1.0"
                class="w-full px-2.5 py-1.5 rounded-lg bg-white border border-jetblack/15 text-xs text-jetblack placeholder:text-jetblack/30 focus:outline-none focus:border-gold"
              />
            </div>
            <div>
              <label class="block text-[10px] font-bold text-jetblack/70 mb-1">Nama Berkas</label>
              <input
                type="text"
                v-model="fileName"
                placeholder="installer-windows.exe"
                class="w-full px-2.5 py-1.5 rounded-lg bg-white border border-jetblack/15 text-xs text-jetblack placeholder:text-jetblack/30 focus:outline-none focus:border-gold"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- 3. Private Note -->
      <div class="p-3.5 rounded-xl border transition" :class="noteEnabled ? 'bg-white border-jetblack/20 shadow-xs' : 'bg-jetblack/[0.02] border-jetblack/10 opacity-70'">
        <label class="flex items-center justify-between cursor-pointer select-none">
          <div class="flex items-center gap-2.5">
            <div class="w-7 h-7 rounded-lg bg-purple-500/15 flex items-center justify-center text-purple-700 shrink-0">
              <FileText class="w-3.5 h-3.5" />
            </div>
            <div>
              <div class="text-xs font-bold text-jetblack">Catatan Rahasia / Instruksi Onboarding</div>
              <div class="text-[10px] text-jetblack/60">Link Discord komunitas, kredensial demo, atau langkah setup awal</div>
            </div>
          </div>
          <div class="relative inline-flex items-center shrink-0">
            <input type="checkbox" v-model="noteEnabled" class="sr-only peer" />
            <div class="w-9 h-5 bg-jetblack/15 rounded-full peer peer-checked:bg-forest transition-colors after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition peer-checked:after:translate-x-full shadow-xs"></div>
          </div>
        </label>

        <div v-if="noteEnabled" class="space-y-2 mt-3 pt-3 border-t border-jetblack/10">
          <div>
            <label class="block text-[10px] font-bold text-jetblack/70 mb-1">Judul Catatan</label>
            <input
              type="text"
              v-model="noteTitle"
              placeholder="Instruksi Akses Komunitas VIP"
              class="w-full px-2.5 py-1.5 rounded-lg bg-white border border-jetblack/15 text-xs text-jetblack placeholder:text-jetblack/30 focus:outline-none focus:border-gold"
            />
          </div>
          <div>
            <label class="block text-[10px] font-bold text-jetblack/70 mb-1">Isi Catatan / Pesan Rahasia</label>
            <textarea
              v-model="noteContent"
              rows="3"
              placeholder="Tuliskan link grup privat, password, atau pesan sambutan untuk pembeli..."
              class="w-full px-2.5 py-2 rounded-lg bg-white border border-jetblack/15 text-xs text-jetblack placeholder:text-jetblack/30 focus:outline-none focus:border-gold"
            ></textarea>
          </div>
        </div>
      </div>

      <!-- 4. API Access -->
      <div class="p-3.5 rounded-xl border transition" :class="apiEnabled ? 'bg-white border-jetblack/20 shadow-xs' : 'bg-jetblack/[0.02] border-jetblack/10 opacity-70'">
        <label class="flex items-center justify-between cursor-pointer select-none">
          <div class="flex items-center gap-2.5">
            <div class="w-7 h-7 rounded-lg bg-emerald-500/15 flex items-center justify-center text-emerald-700 shrink-0">
              <Zap class="w-3.5 h-3.5" />
            </div>
            <div>
              <div class="text-xs font-bold text-jetblack">Akses API &amp; Auto-Provisioning Kunci</div>
              <div class="text-[10px] text-jetblack/60">Sistem menerbitkan API key unik untuk pelanggan memanggil API Anda</div>
            </div>
          </div>
          <div class="relative inline-flex items-center shrink-0">
            <input type="checkbox" v-model="apiEnabled" class="sr-only peer" />
            <div class="w-9 h-5 bg-jetblack/15 rounded-full peer peer-checked:bg-forest transition-colors after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition peer-checked:after:translate-x-full shadow-xs"></div>
          </div>
        </label>

        <div v-if="apiEnabled" class="space-y-2 mt-3 pt-3 border-t border-jetblack/10">
          <div>
            <label class="block text-[10px] font-bold text-jetblack/70 mb-1">Endpoint API Base URL</label>
            <input
              type="url"
              v-model="apiEndpoint"
              placeholder="https://api.yourdomain.com/v1"
              class="w-full px-2.5 py-1.5 rounded-lg bg-white border border-jetblack/15 text-xs text-jetblack placeholder:text-jetblack/30 focus:outline-none focus:border-gold"
            />
          </div>
          <div>
            <label class="block text-[10px] font-bold text-jetblack/70 mb-1">Panduan / Header Autentikasi</label>
            <input
              type="text"
              v-model="apiInstruction"
              placeholder="Kirimkan API key pada header: Authorization: Bearer <API_KEY>"
              class="w-full px-2.5 py-1.5 rounded-lg bg-white border border-jetblack/15 text-xs text-jetblack placeholder:text-jetblack/30 focus:outline-none focus:border-gold"
            />
          </div>

          <!-- Biaya Berbasis Penggunaan (Metered Billing) Block -->
          <div class="mt-2.5 p-3 rounded-xl bg-gold/5 border border-gold/25 space-y-2.5 animate-fadeIn">
            <div class="flex items-center justify-between">
              <div>
                <div class="flex items-center gap-1.5">
                  <Sparkles class="w-3.5 h-3.5 text-gold" />
                  <h4 class="text-xs font-bold text-jetblack">Biaya Berbasis Penggunaan (Metered Billing)</h4>
                </div>
                <p class="text-[10px] text-jetblack/60">Parameter batas pemakaian &amp; kuota kredit yang terhubung dengan SDK/AI Proxy Tertaut.</p>
              </div>
              <button
                v-if="!meteringEnabled"
                type="button"
                @click="emit('openMeteringModal')"
                class="px-2.5 py-1 rounded-lg btn-gold text-xs font-bold transition cursor-pointer flex items-center gap-1 shadow-2xs active:scale-95 shrink-0"
              >
                <Plus class="w-3 h-3 stroke-[3]" />
                <span>Tambah Meter</span>
              </button>
            </div>

            <div v-if="meteringEnabled" class="p-2.5 rounded-xl bg-white border border-gold/40 flex items-center justify-between shadow-2xs">
              <div class="flex items-center gap-2.5">
                <div class="w-7 h-7 rounded-lg bg-gold/15 text-[#8a6d1f] flex items-center justify-center shrink-0">
                  <Zap class="w-3.5 h-3.5" />
                </div>
                <div>
                  <div class="flex items-center gap-2">
                    <span class="text-xs font-bold text-jetblack">{{ meterName || 'Meter Kustom' }}</span>
                    <code class="text-[10px] text-[#8a6d1f] bg-gold/10 px-1.5 py-0.5 rounded border border-gold/30 font-mono font-bold">{{ meterAggregation }}</code>
                  </div>
                  <div class="text-[10px] text-jetblack/60 font-mono mt-0.5">
                    Rp {{ meteringUnitPrice }} / {{ meteringMetricUnit }}
                    <span v-if="meteringFreeAllowance" class="text-forest font-sans font-semibold ml-1.5">({{ meteringFreeAllowance }} gratis/siklus)</span>
                  </div>
                </div>
              </div>
              <div class="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  @click="emit('openMeteringModal')"
                  class="text-xs font-bold text-jetblack/70 hover:text-jetblack transition cursor-pointer px-2 py-0.5 rounded-md bg-jetblack/5 hover:bg-jetblack/10"
                >
                  Ubah
                </button>
                <button
                  type="button"
                  @click="emit('removeMetering')"
                  class="text-jetblack/40 hover:text-red-600 transition cursor-pointer p-1"
                >
                  <Trash2 class="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
