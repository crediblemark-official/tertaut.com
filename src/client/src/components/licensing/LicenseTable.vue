<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  RefreshCw,
  Search,
  Copy,
  Monitor,
  Plus
} from 'lucide-vue-next'
import type { LicenseItem } from '../../types/licensing'

const props = defineProps<{
  licensesList: LicenseItem[]
  loading: boolean
}>()

const emit = defineEmits<{
  (e: 'refresh'): void
  (e: 'issue'): void
  (e: 'copy', key: string): void
  (e: 'unbindHardware', lic: LicenseItem): void
  (e: 'deactivateSeat', key: string, hwid: string): void
  (e: 'revoke', lic: LicenseItem): void
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
  <div>
    <!-- Unified Header & Toolbar (Edge-to-Edge Full Width & Standardized Height) -->
    <div class="-mx-3.5 sm:-mx-4 md:-mx-6 -mt-4 sm:-mt-5 md:-mt-6 px-3.5 sm:px-4 md:px-6 min-h-[44px] py-1.5 sm:py-0 bg-[#111111] text-white border-b border-[#111111] flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-xs mb-1">
      <div class="flex items-center gap-2">
        <h2 class="text-xs font-bold uppercase tracking-wider text-white">Daftar Lisensi</h2>
        <span class="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white font-mono font-bold">
          {{ licensesList.length }} keys
        </span>
      </div>

      <div class="flex items-center gap-2 overflow-x-auto no-scrollbar w-full sm:w-auto">
        <!-- Search Input -->
        <div class="relative w-full sm:w-52">
          <Search class="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Cari kunci, email, app..."
            class="w-full pl-8 pr-2.5 py-1 rounded-lg bg-white/10 border border-white/15 text-xs text-white placeholder:text-white/40 focus:outline-none focus:bg-white/15 focus:border-[#D4AF37] transition"
          />
        </div>

        <!-- Platform Filter -->
        <div class="flex items-center h-7 rounded-md bg-white/10 p-0.5 text-[10px] font-medium shrink-0">
          <button
            @click="platformFilter = 'ALL'"
            :class="['px-2 h-full rounded transition cursor-pointer flex items-center', platformFilter === 'ALL' ? 'bg-white font-bold text-[#111111]' : 'text-white/70 hover:text-white']"
          >
            Semua
          </button>
          <button
            @click="platformFilter = 'desktop'"
            :class="['px-2 h-full rounded transition cursor-pointer flex items-center', platformFilter === 'desktop' ? 'bg-white font-bold text-[#111111]' : 'text-white/70 hover:text-white']"
          >
            Desktop
          </button>
          <button
            @click="platformFilter = 'chrome_extension'"
            :class="['px-2 h-full rounded transition cursor-pointer flex items-center', platformFilter === 'chrome_extension' ? 'bg-white font-bold text-[#111111]' : 'text-white/70 hover:text-white']"
          >
            Chrome
          </button>
          <button
            @click="platformFilter = 'android'"
            :class="['px-2 h-full rounded transition cursor-pointer flex items-center', platformFilter === 'android' ? 'bg-white font-bold text-[#111111]' : 'text-white/70 hover:text-white']"
          >
            Android
          </button>
        </div>

        <button
          @click="emit('refresh')"
          title="Segarkan"
          class="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer transition shrink-0"
        >
          <RefreshCw class="w-3.5 h-3.5" :class="{ 'animate-spin': loading }" />
        </button>

        <button
          @click="emit('issue')"
          class="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg btn-gold text-xs font-bold transition shadow-2xs cursor-pointer active:scale-95 shrink-0"
        >
          <Plus class="w-3.5 h-3.5 stroke-[3]" />
          <span>Terbitkan</span>
        </button>
      </div>
    </div>

    <!-- License Table (Scrollable on mobile) -->
    <div class="-mx-3.5 sm:-mx-4 md:-mx-6 overflow-x-auto top-scrollbar">
      <table class="w-full min-w-full text-left text-xs whitespace-nowrap border-b border-[#111111]/15">
        <thead class="border-b border-[#111111]/20 text-xs font-semibold text-[#111111]/70 bg-white">
          <tr>
            <th class="py-2.5 pr-3 pl-3.5 sm:pl-4 md:pl-6">Kunci Lisensi</th>
            <th class="py-2.5 px-3">Aplikasi</th>
            <th class="py-2.5 px-3">Email Pemilik</th>
            <th class="py-2.5 px-3">Platform</th>
            <th class="py-2.5 px-3">Device Seats</th>
            <th class="py-2.5 px-3">Status</th>
            <th class="py-2.5 pl-3 pr-3.5 sm:pr-4 md:pr-6 text-right">Aksi</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-[#111111]/15">
          <tr v-if="filteredLicenses.length === 0">
            <td colspan="7" class="py-8 px-3.5 sm:px-4 md:px-6 text-center text-[#111111]/40">
              <div class="space-y-1">
                <p class="font-semibold text-xs text-[#111111]/60">Tidak ada kunci lisensi ditemukan.</p>
                <p class="text-[11px] text-[#111111]/40" v-if="searchQuery || platformFilter !== 'ALL' || statusFilter !== 'ALL'">
                  Coba sesuaikan kata kunci pencarian atau reset filter.
                </p>
              </div>
            </td>
          </tr>
          <tr v-for="lic in filteredLicenses" :key="lic.id" class="hover:bg-[#111111]/[0.02]">
            <td class="py-2.5 pr-3 pl-3.5 sm:pl-4 md:pl-6 font-mono">
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
            <td class="py-2.5 px-3 text-[#111111]/70 font-mono text-[11px]">{{ lic.appId }}</td>
            <td class="py-2.5 px-3 text-[#111111]/80">{{ lic.customerEmail }}</td>
            <td class="py-2.5 px-3 capitalize font-mono text-[11px] text-[#111111]/70">{{ lic.platform }}</td>
            <td class="py-2.5 px-3">
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
            <td class="py-2.5 px-3">
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
            <td class="py-2.5 pl-3 pr-3.5 sm:pr-4 md:pr-6 text-right space-x-1.5">
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
