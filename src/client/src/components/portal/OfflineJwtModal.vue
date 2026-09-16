<script setup lang="ts">
import { ShieldCheck, Copy } from 'lucide-vue-next'
import type { PortalLicenseItem } from '../../types'

defineProps<{
  show: boolean
  lic: PortalLicenseItem | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'copy', text: string, id: string): void
}>()
</script>

<template>
  <div
    v-if="show && lic"
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
  >
    <div class="bg-white rounded-2xl max-w-lg w-full border border-[#111111]/15 p-6 space-y-4 shadow-xl">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <ShieldCheck class="w-5 h-5 text-[#0F4C3A]" />
          <h3 class="font-bold text-sm text-[#111111]">Token Lisensi Offline (JWT)</h3>
        </div>
        <button @click="emit('close')" class="text-xs p-1 opacity-60 hover:opacity-100 cursor-pointer">✕</button>
      </div>

      <p class="text-xs text-[#111111]/70 leading-relaxed">
        Token ini ditandatangani secara kriptografis oleh server tertaut.com. Software Anda dapat memverifikasi masa aktif secara offline tanpa koneksi internet.
      </p>

      <div class="bg-[#111111] text-white p-3 rounded-xl font-mono text-[11px] break-all max-h-40 overflow-y-auto">
        {{ lic.offlineJwt }}
      </div>

      <div class="flex items-center justify-end gap-2 pt-2">
        <button
          @click="emit('copy', lic.offlineJwt || '', 'jwt_token')"
          class="px-4 py-2 rounded-xl bg-[#111111] text-white hover:bg-black text-xs font-semibold flex items-center gap-1.5 shadow-sm cursor-pointer"
        >
          <Copy class="w-3.5 h-3.5" />
          <span>Salin JWT Token</span>
        </button>
        <button
          @click="emit('close')"
          class="px-4 py-2 rounded-xl border border-[#111111]/20 hover:bg-[#111111]/5 text-xs font-semibold text-[#111111] cursor-pointer"
        >
          Tutup
        </button>
      </div>
    </div>
  </div>
</template>
