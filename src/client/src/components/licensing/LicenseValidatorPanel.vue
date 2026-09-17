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
import SearchPicker from '../common/SearchPicker.vue'

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
  <div class="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-[#111111]/10 border-t border-b border-[#111111]/10 py-6">
    <!-- Input Form Section -->
    <div class="pb-6 lg:pb-0 pr-0 lg:pr-6 space-y-3.5">
      <div class="flex items-center gap-2">
        <Search class="w-4 h-4 text-[#D4AF37]" />
        <h2 class="text-sm font-bold text-[#111111]">Verifikasi &amp; Diagnostic Lisensi</h2>
      </div>

      <div class="space-y-3 text-xs">
        <div>
          <label class="block font-bold text-[#111111]/70 mb-1">Pilih Aplikasi Terkait</label>
          <SearchPicker
            v-model="appId"
            :items="appsList"
            placeholder="Pilih aplikasi..."
            search-placeholder="Cari software..."
            button-class="w-full !h-9 !rounded-lg"
          />
        </div>

        <div>
          <label class="block font-bold text-[#111111]/70 mb-1">Kunci Lisensi</label>
          <input
            v-model="licenseKey"
            placeholder="TT-XXXX-XXXX-XXXX"
            class="w-full h-9 bg-white border border-slate-300/80 hover:border-slate-400 rounded-lg px-3 text-xs shadow-2xs focus:ring-2 focus:ring-[#D4AF37]/20 focus:border-[#D4AF37] focus:outline-none text-[#111111] font-mono font-bold transition"
          />
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div>
            <label class="block font-bold text-[#111111]/70 mb-1">Hardware ID (HWID)</label>
            <input
              v-model="hardwareId"
              placeholder="Hash HWID perangkat"
              class="w-full h-9 bg-white border border-slate-300/80 hover:border-slate-400 rounded-lg px-3 text-xs shadow-2xs focus:ring-2 focus:ring-[#D4AF37]/20 focus:border-[#D4AF37] focus:outline-none text-[#111111] font-mono transition"
            />
          </div>
          <div>
            <label class="block font-bold text-[#111111]/70 mb-1">Nama Perangkat</label>
            <input
              v-model="deviceName"
              placeholder="work-mac-pro (opsional)"
              class="w-full h-9 bg-white border border-slate-300/80 hover:border-slate-400 rounded-lg px-3 text-xs shadow-2xs focus:ring-2 focus:ring-[#D4AF37]/20 focus:border-[#D4AF37] focus:outline-none text-[#111111] transition"
            />
          </div>
        </div>

        <!-- Action Buttons Grid -->
        <div class="grid grid-cols-2 gap-2 pt-1">
          <button
            @click="emit('activateSeat')"
            :disabled="loadingValidation || !licenseKey"
            class="w-full h-9 rounded-lg btn-gold text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm active:scale-95 cursor-pointer disabled:opacity-50"
          >
            <Monitor class="w-3.5 h-3.5" />
            <span>Aktifkan Perangkat</span>
          </button>

          <button
            @click="emit('verifyOnline')"
            :disabled="loadingValidation || !licenseKey"
            class="w-full h-9 rounded-lg bg-[#111111] hover:bg-[#222222] text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm active:scale-95 cursor-pointer disabled:opacity-50"
          >
            <CheckCircle2 class="w-3.5 h-3.5 text-[#D4AF37]" />
            <span>Verifikasi Online</span>
          </button>

          <button
            @click="emit('deactivateSeat')"
            :disabled="loadingValidation || !licenseKey"
            class="w-full h-9 rounded-lg border border-[#8B0000]/30 hover:bg-[#8B0000]/10 text-[#8B0000] text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Trash2 class="w-3 h-3" />
            <span>Lepas Perangkat</span>
          </button>

          <button
            @click="emit('validateStandard')"
            :disabled="loadingValidation || !licenseKey"
            class="w-full h-9 rounded-lg border border-[#111111]/20 hover:bg-[#111111]/5 text-[#111111] text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw class="w-3 h-3" :class="{ 'animate-spin': loadingValidation }" />
            <span>Validasi Standar</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Result Terminal Section -->
    <div class="pt-6 lg:pt-0 pl-0 lg:pl-6 space-y-3.5">
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

      <div v-else class="h-44 flex flex-col items-center justify-center text-center text-[#111111]/40 p-4 border border-[#111111]/10 rounded-lg">
        <KeyRound class="w-7 h-7 mb-1.5 opacity-25" />
        <p class="text-xs">Pilih salah satu lisensi dari tabel di atas atau masukkan kunci untuk menguji.</p>
      </div>
    </div>
  </div>
</template>
