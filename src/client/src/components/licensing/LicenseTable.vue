<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  RefreshCw,
  Search,
  Copy,
  Monitor
} from 'lucide-vue-next'
import type { LicenseItem } from '../../types'

const props = defineProps<{
  licensesList: LicenseItem[]
  loading: boolean
}>()

const emit = defineEmits<{
  (e: 'refresh'): void
  (e: 'copy', key: string): void
  (e: 'selectTest', lic: LicenseItem): void
  (e: 'unbindHardware', lic: LicenseItem): void
  (e: 'revoke', lic: LicenseItem): void
  (e: 'deactivateSeat', key: string, hwid: string): void
}>()

const searchQuery = ref('')
const platformFilter = ref<'ALL' | 'desktop' | 'chrome_extension' | 'android' | 'web' | 'general'>('ALL')
const statusFilter = ref<'ALL' | 'ACTIVE' | 'REVOKED' | 'EXPIRED'>('ALL')

const filteredLicenses = computed(() => {
  return props.licensesList.filter(lic => {
    if (platformFilter.value !== 'ALL' && lic.platform !== platformFilter.value) {
      return false
    }
    if (statusFilter.value !== 'ALL' && lic.status !== statusFilter.value) {
      return false
    }
    if (searchQuery.value.trim()) {
      const q = searchQuery.value.toLowerCase().trim()
      const matchKey = lic.licenseKey.toLowerCase().includes(q)
      const matchEmail = (lic.customerEmail || '').toLowerCase().includes(q)
      const matchApp = (lic.appId || '').toLowerCase().includes(q)
      if (!matchKey && !matchEmail && !matchApp) return false
    }
    return true
  })
})
</script>

<template>
  <div class="luxury-card p-4 md:p-5 rounded-xl space-y-4">
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div>
        <h2 class="text-sm font-bold text-[#111111]">Daftar Kunci Lisensi Aktif</h2>
        <p class="text-xs text-[#111111]/60">Daftar kunci lisensi yang diterbitkan di database, status hardware binding, dan kuota perangkat.</p>
      </div>
      <div class="flex items-center gap-2">
        <button
          @click="emit('refresh')"
          class="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#111111]/5 hover:bg-[#111111]/10 text-xs font-bold text-[#111111] cursor-pointer"
        >
          <RefreshCw class="w-3 h-3" :class="{ 'animate-spin': loading }" />
          <span>Segarkan</span>
        </button>
      </div>
    </div>

    <!-- Search & Filters Toolbar -->
    <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-1 border-t border-[#111111]/10">
      <!-- Search Input -->
      <div class="relative flex-1 max-w-sm">
        <Search class="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#111111]/40" />
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Cari Kunci (TT-...), Email, atau App ID..."
          class="w-full pl-8 pr-3 py-1.5 rounded-lg bg-white border border-[#111111]/15 text-xs text-[#111111] placeholder:text-[#111111]/40 focus:outline-none focus:border-[#D4AF37]"
        />
      </div>

      <!-- Platform & Status Filter Tabs -->
      <div class="flex flex-wrap items-center gap-1.5 text-xs">
        <!-- Platform Filter -->
        <div class="flex items-center rounded-lg bg-[#111111]/5 p-0.5 text-[11px] font-medium">
          <button
            @click="platformFilter = 'ALL'"
            :class="['px-2 py-0.5 rounded-md transition cursor-pointer', platformFilter === 'ALL' ? 'bg-white font-bold shadow-xs text-[#111111]' : 'text-[#111111]/60 hover:text-[#111111]']"
          >
            Semua Platform
          </button>
          <button
            @click="platformFilter = 'desktop'"
            :class="['px-2 py-0.5 rounded-md transition cursor-pointer', platformFilter === 'desktop' ? 'bg-white font-bold shadow-xs text-[#111111]' : 'text-[#111111]/60 hover:text-[#111111]']"
          >
            Desktop
          </button>
          <button
            @click="platformFilter = 'chrome_extension'"
            :class="['px-2 py-0.5 rounded-md transition cursor-pointer', platformFilter === 'chrome_extension' ? 'bg-white font-bold shadow-xs text-[#111111]' : 'text-[#111111]/60 hover:text-[#111111]']"
          >
            Chrome
          </button>
          <button
            @click="platformFilter = 'android'"
            :class="['px-2 py-0.5 rounded-md transition cursor-pointer', platformFilter === 'android' ? 'bg-white font-bold shadow-xs text-[#111111]' : 'text-[#111111]/60 hover:text-[#111111]']"
          >
            Android
          </button>
        </div>

        <!-- Status Filter -->
        <div class="flex items-center rounded-lg bg-[#111111]/5 p-0.5 text-[11px] font-medium">
          <button
            @click="statusFilter = 'ALL'"
            :class="['px-2 py-0.5 rounded-md transition cursor-pointer', statusFilter === 'ALL' ? 'bg-white font-bold shadow-xs text-[#111111]' : 'text-[#111111]/60 hover:text-[#111111]']"
          >
            Semua Status
          </button>
          <button
            @click="statusFilter = 'ACTIVE'"
            :class="['px-2 py-0.5 rounded-md transition cursor-pointer', statusFilter === 'ACTIVE' ? 'bg-[#0F4C3A] font-bold text-white shadow-xs' : 'text-[#0F4C3A] hover:bg-[#0F4C3A]/10']"
          >
            Active
          </button>
          <button
            @click="statusFilter = 'REVOKED'"
            :class="['px-2 py-0.5 rounded-md transition cursor-pointer', statusFilter === 'REVOKED' ? 'bg-[#8B0000] font-bold text-white shadow-xs' : 'text-[#8B0000] hover:bg-[#8B0000]/10']"
          >
            Revoked
          </button>
        </div>
      </div>
    </div>

    <div class="overflow-x-auto">
      <table class="w-full text-left text-xs">
        <thead>
          <tr class="border-b border-[#111111]/10 text-[#111111]/60 font-bold uppercase text-[10px]">
            <th class="pb-2">Kunci Lisensi</th>
            <th class="pb-2">Aplikasi</th>
            <th class="pb-2">Email Pemilik</th>
            <th class="pb-2">Platform</th>
            <th class="pb-2">Device Seats</th>
            <th class="pb-2">Status</th>
            <th class="pb-2 text-right">Aksi</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-[#111111]/5">
          <tr v-if="filteredLicenses.length === 0">
            <td colspan="7" class="py-8 text-center text-[#111111]/40">
              <div class="space-y-1">
                <p class="font-semibold text-xs text-[#111111]/60">Tidak ada kunci lisensi ditemukan.</p>
                <p class="text-[11px] text-[#111111]/40" v-if="searchQuery || platformFilter !== 'ALL' || statusFilter !== 'ALL'">
                  Coba sesuaikan kata kunci pencarian atau reset filter.
                </p>
              </div>
            </td>
          </tr>
          <tr v-for="lic in filteredLicenses" :key="lic.id" class="hover:bg-[#111111]/[0.02]">
            <td class="py-2.5 font-mono">
              <div class="inline-flex items-center gap-1.5 font-bold text-[#111111]">
                <span>{{ lic.licenseKey }}</span>
                <button
                  @click="emit('copy', lic.licenseKey)"
                  title="Salin Kunci"
                  class="text-[#111111]/40 hover:text-[#D4AF37] cursor-pointer"
                >
                  <Copy class="w-3 h-3" />
                </button>
              </div>
            </td>
            <td class="py-2.5 text-[#111111]/70 font-mono text-[11px]">{{ lic.appId }}</td>
            <td class="py-2.5 text-[#111111]/80">{{ lic.customerEmail }}</td>
            <td class="py-2.5 capitalize font-mono text-[11px] text-[#111111]/70">{{ lic.platform }}</td>
            <td class="py-2.5">
              <div
                class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
                :class="lic.seatsUsed && lic.seatsUsed >= (lic.maxSeats || 3) ? 'bg-[#8B0000]/10 text-[#8B0000]' : 'bg-[#111111]/5 text-[#111111]'"
              >
                <Monitor class="w-2.5 h-2.5" />
                <span>{{ lic.seatsUsed || 0 }} / {{ lic.maxSeats || 3 }} Seats</span>
              </div>
              <div v-if="lic.activations && lic.activations.length > 0" class="mt-1 space-y-0.5">
                <div
                  v-for="act in lic.activations"
                  :key="act.id"
                  class="flex items-center gap-1 text-[9px] text-[#111111]/70 font-mono"
                >
                  <span>• {{ act.deviceName || 'Device' }} ({{ act.hwidHash.substring(0, 6) }}...)</span>
                  <button
                    @click="emit('deactivateSeat', lic.licenseKey, act.hwidHash)"
                    title="Lepas Seat Perangkat Ini"
                    class="text-[#8B0000] hover:underline cursor-pointer"
                  >
                    [Lepas]
                  </button>
                </div>
              </div>
              <div v-else-if="lic.hardwareId" class="mt-1 text-[9px] text-[#0F4C3A] font-mono">
                Primary HWID: {{ lic.hardwareId.substring(0, 8) }}...
              </div>
            </td>
            <td class="py-2.5">
              <span
                class="px-2 py-0.5 rounded-full text-[10px] font-bold"
                :class="{
                  'bg-[#0F4C3A]/10 text-[#0F4C3A]': lic.status === 'ACTIVE',
                  'bg-[#8B0000]/10 text-[#8B0000]': lic.status === 'REVOKED',
                  'bg-[#111111]/10 text-[#111111]/60': lic.status === 'EXPIRED',
                }"
              >
                {{ lic.status }}
              </span>
            </td>
            <td class="py-2.5 text-right space-x-1.5">
              <button
                @click="emit('selectTest', lic)"
                title="Gunakan untuk uji validasi"
                class="px-2 py-0.5 rounded bg-[#D4AF37]/15 hover:bg-[#D4AF37]/30 text-[10px] font-bold text-[#111111] transition cursor-pointer"
              >
                Uji di Validator
              </button>
              <button
                v-if="lic.hardwareId || (lic.seatsUsed && lic.seatsUsed > 0)"
                @click="emit('unbindHardware', lic)"
                title="Reset Seluruh Device Seats"
                class="px-2 py-0.5 rounded bg-[#111111]/5 hover:bg-[#111111]/10 text-[10px] font-bold text-[#111111] transition cursor-pointer"
              >
                Reset Seats
              </button>
              <button
                v-if="lic.status === 'ACTIVE'"
                @click="emit('revoke', lic)"
                title="Cabut Lisensi"
                class="px-2 py-0.5 rounded bg-[#8B0000]/10 hover:bg-[#8B0000]/20 text-[10px] font-bold text-[#8B0000] transition cursor-pointer"
              >
                Revoke
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
