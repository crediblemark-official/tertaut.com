<script setup lang="ts">
import {
  Search,
  Monitor,
  CheckCircle2,
  Trash2,
  RefreshCw,
  KeyRound,
  ShieldAlert
} from 'lucide-vue-next'
import type { AppItem } from '../../types'

defineProps<{
  appsList: AppItem[]
  loadingValidation: boolean
  validationResult: any
}>()

const licenseKey = defineModel<string>('licenseKey', { default: '' })
const hardwareId = defineModel<string>('hardwareId', { default: '' })
const deviceName = defineModel<string>('deviceName', { default: '' })
const appId = defineModel<string>('appId', { default: '' })

const emit = defineEmits<{
  (e: 'activateSeat'): void
  (e: 'verifyOnline'): void
  (e: 'deactivateSeat'): void
  (e: 'validateStandard'): void
}>()
</script>

<template>
  <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
    <!-- Input Form Card -->
    <div class="luxury-card p-4 md:p-5 rounded-xl space-y-4">
      <div class="flex items-center gap-2">
        <Search class="w-4 h-4 text-[#D4AF37]" />
        <h2 class="text-sm font-bold text-[#111111]">Verifikasi &amp; Diagnostic Lisensi (Engine Validator)</h2>
      </div>

      <div class="space-y-3 text-xs">
        <div>
          <label class="block font-bold text-[#111111]/70 mb-1">Pilih Aplikasi Terkait</label>
          <select
            v-model="appId"
            class="w-full bg-[#FFFFFF] border border-[#111111]/15 rounded-lg p-2 text-[#111111] font-bold focus:outline-none focus:border-[#D4AF37]"
          >
            <option v-for="app in appsList" :key="app.id" :value="app.id">
              {{ app.name }} ({{ app.id }})
            </option>
          </select>
        </div>

        <div>
          <label class="block font-bold text-[#111111]/70 mb-1">Kunci Lisensi</label>
          <input
            v-model="licenseKey"
            placeholder="TT-XXXX-XXXX-XXXX"
            class="w-full bg-[#FFFFFF] border border-[#111111]/15 rounded-lg p-2 text-[#111111] font-mono font-bold focus:outline-none focus:border-[#D4AF37]"
          />
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div>
            <label class="block font-bold text-[#111111]/70 mb-1">Hardware ID (HWID)</label>
            <input
              v-model="hardwareId"
              placeholder="Contoh: hash HWID perangkat (mis. sha256...)"
              class="w-full bg-[#FFFFFF] border border-[#111111]/15 rounded-lg p-2 text-[#111111] font-mono focus:outline-none focus:border-[#D4AF37]"
            />
          </div>
          <div>
            <label class="block font-bold text-[#111111]/70 mb-1">Nama Perangkat</label>
            <input
              v-model="deviceName"
              placeholder="Contoh: work-mac-pro (opsional)"
              class="w-full bg-[#FFFFFF] border border-[#111111]/15 rounded-lg p-2 text-[#111111] focus:outline-none focus:border-[#D4AF37]"
            />
          </div>
        </div>

        <!-- Action Buttons Grid -->
        <div class="grid grid-cols-2 gap-2 pt-1">
          <button
            @click="emit('activateSeat')"
            :disabled="loadingValidation || !licenseKey"
            class="w-full py-2.5 rounded-lg btn-gold text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm active:scale-95 cursor-pointer disabled:opacity-50"
          >
            <Monitor class="w-3.5 h-3.5" />
            <span>Aktifkan Perangkat (FR-2.1)</span>
          </button>

          <button
            @click="emit('verifyOnline')"
            :disabled="loadingValidation || !licenseKey"
            class="w-full py-2.5 rounded-lg bg-[#111111] hover:bg-[#222222] text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm active:scale-95 cursor-pointer disabled:opacity-50"
          >
            <CheckCircle2 class="w-3.5 h-3.5 text-[#D4AF37]" />
            <span>Verifikasi Online (FR-3.3)</span>
          </button>

          <button
            @click="emit('deactivateSeat')"
            :disabled="loadingValidation || !licenseKey"
            class="w-full py-2 rounded-lg border border-[#8B0000]/30 hover:bg-[#8B0000]/10 text-[#8B0000] text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Trash2 class="w-3 h-3" />
            <span>Lepas Perangkat (FR-2.3)</span>
          </button>

          <button
            @click="emit('validateStandard')"
            :disabled="loadingValidation || !licenseKey"
            class="w-full py-2 rounded-lg border border-[#111111]/20 hover:bg-[#111111]/5 text-[#111111] text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw class="w-3 h-3" :class="{ 'animate-spin': loadingValidation }" />
            <span>Validasi SDK Standar</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Result Terminal Card -->
    <div class="luxury-card p-4 md:p-5 rounded-xl space-y-4">
      <h2 class="text-sm font-bold text-[#111111]">Hasil Respon Engine</h2>

      <div v-if="validationResult" class="p-3.5 rounded-xl bg-[#111111] text-white font-mono text-xs space-y-2">
        <div
          class="flex items-center gap-1.5 font-bold"
          :class="validationResult.valid ? 'text-[#0F4C3A] bg-[#0F4C3A]/20 px-2 py-1 rounded inline-flex' : 'text-[#8B0000]'"
        >
          <CheckCircle2 v-if="validationResult.valid" class="w-4 h-4" />
          <ShieldAlert v-else class="w-4 h-4" />
          <span>{{ validationResult.valid ? 'LISENSI VALID & TERIKAT' : 'VALIDASI GAGAL: ' + (validationResult.reason || validationResult.error) }}</span>
        </div>

        <pre class="text-[11px] text-white/80 overflow-x-auto whitespace-pre-wrap">{{ JSON.stringify(validationResult, null, 2) }}</pre>

        <div v-if="validationResult.offlineJwtGraceToken" class="border-t border-white/10 pt-2 text-[10px] text-[#D4AF37]">
          🔒 30-Day Offline JWT Fallback Token aktif untuk autentikasi tanpa internet.
        </div>
      </div>

      <div v-else class="h-48 flex flex-col items-center justify-center text-center text-[#111111]/40 p-4 border border-dashed border-[#111111]/15 rounded-xl">
        <KeyRound class="w-8 h-8 mb-1.5 opacity-30" />
        <p class="text-xs">Klik tombol "Eksekusi Validasi Lisensi" atau pilih salah satu lisensi dari tabel di atas.</p>
      </div>
    </div>
  </div>
</template>
