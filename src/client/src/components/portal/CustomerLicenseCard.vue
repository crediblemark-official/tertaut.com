<script setup lang="ts">
import {
  Laptop,
  Chrome,
  Smartphone,
  Globe,
  Check,
  Copy,
  Download,
  Trash2
} from 'lucide-vue-next'
import type { PortalLicenseItem } from '../../types'

defineProps<{
  lic: PortalLicenseItem
  copiedKey: string | null
  deactivatingHwid: string | null
}>()

const emit = defineEmits<{
  (e: 'copy', text: string, id: string): void
  (e: 'deactivateDevice', licenseKey: string, hwidHash: string, deviceName: string | null): void
  (e: 'openJwtModal', lic: PortalLicenseItem): void
}>()
</script>

<template>
  <div class="bg-white rounded-2xl border border-[#111111]/10 p-5 md:p-6 space-y-5 shadow-xs hover:border-[#111111]/25 transition">
    <!-- Card Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#111111]/5 pb-4">
      <div class="space-y-1">
        <div class="flex items-center gap-2">
          <h3 class="font-bold text-base text-[#111111]">{{ lic.appName }}</h3>
          <span
            :class="[
              'px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider',
              lic.status === 'ACTIVE'
                ? 'bg-[#0F4C3A]/10 text-[#0F4C3A] border border-[#0F4C3A]/20'
                : lic.status === 'EXPIRED'
                ? 'bg-[#D4AF37]/10 text-[#996515] border border-[#D4AF37]/20'
                : 'bg-[#B91C1C]/10 text-[#B91C1C] border border-[#B91C1C]/20'
            ]"
          >
            {{ lic.status }}
          </span>
        </div>
        <div class="text-xs text-[#111111]/50 flex items-center gap-3">
          <span class="flex items-center gap-1">
            <Laptop v-if="lic.platform === 'desktop'" class="w-3 h-3" />
            <Chrome v-else-if="lic.platform === 'chrome_extension'" class="w-3 h-3" />
            <Smartphone v-else-if="lic.platform === 'android'" class="w-3 h-3" />
            <Globe v-else class="w-3 h-3" />
            Platform: <strong class="text-[#111111]/80">{{ lic.platform }}</strong>
          </span>
          <span>•</span>
          <span>Masa Berlaku: <strong class="text-[#111111]/80">{{ lic.expiresAt ? new Date(lic.expiresAt).toLocaleDateString('id-ID') : 'Lifetime / Selamanya' }}</strong></span>
        </div>
      </div>

      <!-- License Key Copy Box -->
      <div class="flex items-center gap-2 bg-[#111111]/5 px-3 py-2 rounded-xl border border-[#111111]/10">
        <span class="font-mono text-xs font-bold text-[#111111] tracking-wider select-all">
          {{ lic.licenseKey }}
        </span>
        <button
          @click="emit('copy', lic.licenseKey, lic.id)"
          class="p-1 text-[#111111]/60 hover:text-[#111111] transition cursor-pointer"
          title="Salin License Key"
        >
          <Check v-if="copiedKey === lic.id" class="w-3.5 h-3.5 text-[#0F4C3A]" />
          <Copy v-else class="w-3.5 h-3.5" />
        </button>
      </div>
    </div>

    <!-- Seat Utilization & Devices Management -->
    <div class="space-y-3">
      <div class="flex items-center justify-between text-xs">
        <div class="flex items-center gap-1.5 font-semibold text-[#111111]">
          <Laptop class="w-3.5 h-3.5 text-[#0F4C3A]" />
          <span>Perangkat Terdaftar:</span>
          <span class="text-[#0F4C3A] font-bold">{{ lic.seatsUsed }} / {{ lic.maxSeats }} Seat Digunakan</span>
        </div>
        <button
          v-if="lic.offlineJwt"
          @click="emit('openJwtModal', lic)"
          class="text-[11px] font-semibold text-[#111111]/75 hover:text-[#111111] flex items-center gap-1 hover:underline cursor-pointer"
        >
          <Download class="w-3 h-3 text-[#D4AF37]" />
          Token Lisensi Offline (JWT)
        </button>
      </div>

      <!-- Devices List -->
      <div v-if="lic.activations && lic.activations.length > 0" class="border border-[#111111]/10 rounded-xl overflow-hidden divide-y divide-[#111111]/5">
        <div
          v-for="act in lic.activations"
          :key="act.id"
          class="px-4 py-3 bg-[#FAFAFA] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
        >
          <div class="space-y-0.5">
            <div class="font-bold text-[#111111] flex items-center gap-2">
              <span>{{ act.deviceName || 'Perangkat Hardware' }}</span>
              <span class="text-[10px] font-mono text-[#111111]/50 font-normal">({{ act.hwidHash.slice(0, 12) }}...)</span>
            </div>
            <div class="text-[11px] text-[#111111]/50">
              Terakhir validasi: {{ new Date(act.lastValidatedAt).toLocaleString('id-ID') }}
            </div>
          </div>

          <button
            @click="emit('deactivateDevice', lic.licenseKey, act.hwidHash, act.deviceName)"
            :disabled="deactivatingHwid === act.hwidHash"
            class="px-3 py-1 rounded-lg text-rose-700 bg-rose-50 hover:bg-rose-100 font-semibold text-xs transition flex items-center gap-1.5 self-start sm:self-auto cursor-pointer disabled:opacity-50"
          >
            <span v-if="deactivatingHwid === act.hwidHash" class="w-3 h-3 border-2 border-rose-400 border-t-rose-700 rounded-full animate-spin"></span>
            <Trash2 v-else class="w-3 h-3" />
            <span>Lepas Perangkat Ini</span>
          </button>
        </div>
      </div>

      <div v-else class="p-4 rounded-xl bg-[#FAFAFA] border border-dashed border-[#111111]/15 text-center text-xs text-[#111111]/50">
        Belum ada perangkat yang mengaktifkan kunci ini. Pasang software dan masukkan license key saat pertama kali dijalankan.
      </div>
    </div>
  </div>
</template>
