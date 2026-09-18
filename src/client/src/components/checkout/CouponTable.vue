<script setup lang="ts">
import { computed } from 'vue'
import {
  Ticket,
  Plus,
  Power,
  Trash2,
  Search,
  TicketPercent,
  Clock
} from 'lucide-vue-next'
import type { AppItem } from '../../types/app'
import type { CouponItem } from '../../types/coupon'
import SearchPicker from '../common/SearchPicker.vue'

const props = defineProps<{
  appsList: AppItem[]
  couponsList: CouponItem[]
}>()

const emit = defineEmits<{
  (e: 'toggle', coupon: CouponItem): void
  (e: 'delete', coupon: CouponItem): void
  (e: 'open-create'): void
}>()

const searchQuery = defineModel<string>('searchQuery', { default: '' })
const filterAppId = defineModel<string>('filterAppId', { default: '' })

const filteredCoupons = computed(() => {
  return props.couponsList.filter(c => {
    if (filterAppId.value && c.appId !== filterAppId.value) return false
    if (searchQuery.value.trim()) {
      const q = searchQuery.value.toLowerCase().trim()
      return c.code.toLowerCase().includes(q)
    }
    return true
  })
})

function appLabel(appId: string | null): string {
  if (!appId) return 'Global (semua app)'
  const app = props.appsList.find(a => a.id === appId)
  return app ? app.name : appId
}

function remainingQuota(c: CouponItem): string {
  if (c.maxRedemptions === 0) return '∞'
  return `${Math.max(0, c.maxRedemptions - c.redemptionCount)}/${c.maxRedemptions}`
}

function isExpiringSoon(c: CouponItem): boolean {
  if (!c.expiresAt) return false
  const daysLeft = (new Date(c.expiresAt).getTime() - Date.now()) / 86_400_000
  return daysLeft > 0 && daysLeft <= 7
}
</script>

<template>
  <div class="space-y-3">
    <!-- Search & Filter Toolbar -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-[#111111]/10">
      <div class="relative flex-1 max-w-sm">
        <Search class="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#111111]/40" />
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Cari kode kupon..."
          class="w-full h-8 pl-8 pr-3 rounded-lg bg-white border border-slate-300/80 hover:border-slate-400 text-xs text-[#111111] placeholder:text-[#111111]/40 focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/20 focus:border-[#D4AF37] shadow-2xs transition"
        />
      </div>
      <SearchPicker
        v-model="filterAppId"
        :items="appsList"
        all-option-label="Semua Aplikasi"
        placeholder="Semua Aplikasi"
        search-placeholder="Cari software..."
        button-class="!h-8 !rounded-lg !min-w-[160px] bg-white border-slate-300/80 hover:border-slate-400 shadow-2xs text-xs"
      />
    </div>

    <!-- Coupons Table (Scrollable on mobile, edge-to-edge full width) -->
    <div class="-mx-3.5 sm:-mx-4 md:-mx-6 overflow-x-auto top-scrollbar">
      <table class="w-full min-w-full text-left text-xs whitespace-nowrap border-b border-[#111111]/15">
        <thead class="border-b border-[#111111]/20 text-xs font-semibold text-[#111111]/70 bg-white">
          <tr>
            <th class="py-2.5 pr-3 pl-3.5 sm:pl-4 md:pl-6">Kode</th>
            <th class="py-2.5 px-3">Aplikasi</th>
            <th class="py-2.5 px-3">Diskon</th>
            <th class="py-2.5 px-3">Terpakai</th>
            <th class="py-2.5 px-3">Kedaluwarsa</th>
            <th class="py-2.5 px-3">Status</th>
            <th class="py-2.5 pl-3 pr-3.5 sm:pr-4 md:pr-6 text-right">Aksi</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-[#111111]/15">
          <tr v-if="filteredCoupons.length === 0">
            <td colspan="7" class="py-12 px-3.5 sm:px-4 md:px-6 text-center text-[#111111]/40">
              <div class="space-y-1.5 max-w-xs mx-auto">
                <Ticket class="w-6 h-6 mx-auto opacity-30 text-[#111111]" />
                <p class="font-semibold text-xs text-[#111111]/70">Belum ada kupon ditemukan.</p>
                <p class="text-[11px] text-[#111111]/45">Terbitkan kupon diskon pertama untuk meningkatkan penjualan aplikasi Anda.</p>
                <div class="pt-2">
                  <button
                    type="button"
                    @click="emit('open-create')"
                    class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#111111] text-white text-xs font-bold hover:bg-[#111111]/90 transition cursor-pointer shadow-2xs"
                  >
                    <Plus class="w-3.5 h-3.5" />
                    <span>Buat Kupon Sekarang</span>
                  </button>
                </div>
              </div>
            </td>
          </tr>
          <tr v-for="c in filteredCoupons" :key="c.id" class="hover:bg-[#111111]/[0.02] transition-colors">
            <td class="py-2.5 pr-3 pl-3.5 sm:pl-4 md:pl-6">
              <span class="font-mono font-bold text-[#111111]">{{ c.code }}</span>
            </td>
            <td class="py-2.5 px-3 text-[#111111]/80">{{ appLabel(c.appId) }}</td>
            <td class="py-2.5 px-3">
              <span class="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full bg-[#D4AF37]/15 border border-[#D4AF37]/35 text-[#111111] text-[10px] font-bold">
                <TicketPercent class="w-2.5 h-2.5" />
                {{ c.discountPercent }}%
              </span>
            </td>
            <td class="py-2.5 px-3 font-mono text-[#111111]/80">
              {{ c.redemptionCount }} / {{ remainingQuota(c) }}
            </td>
            <td class="py-2.5 px-3 text-[11px]">
              <span v-if="c.expiresAt" class="inline-flex items-center gap-1" :class="isExpiringSoon(c) ? 'text-[#8B0000] font-bold' : 'text-[#111111]/60'">
                <Clock class="w-3 h-3" />
                {{ new Date(c.expiresAt).toLocaleDateString('id-ID') }}
              </span>
              <span v-else class="text-[#111111]/40">Tanpa batas</span>
            </td>
            <td class="py-2.5 px-3">
              <span
                class="px-2 py-0.5 rounded-full text-[10px] font-bold"
                :class="c.isActive ? 'bg-[#0F4C3A]/10 text-[#0F4C3A]' : 'bg-[#111111]/5 text-[#111111]/50'"
              >
                {{ c.isActive ? 'AKTIF' : 'NONAKTIF' }}
              </span>
            </td>
            <td class="py-2.5 pl-3 pr-3.5 sm:pr-4 md:pr-6 text-right">
              <div class="flex items-center justify-end gap-1">
                <button
                  @click="emit('toggle', c)"
                  :title="c.isActive ? 'Nonaktifkan kupon' : 'Aktifkan kupon'"
                  class="p-1 rounded-md transition cursor-pointer"
                  :class="c.isActive
                    ? 'bg-[#111111]/5 text-[#111111]/60 hover:bg-[#D4AF37]/20 hover:text-[#111111]'
                    : 'bg-[#0F4C3A]/10 text-[#0F4C3A] hover:bg-[#0F4C3A]/20'"
                >
                  <Power class="w-3.5 h-3.5" />
                </button>
                <button
                  @click="emit('delete', c)"
                  title="Hapus kupon"
                  class="p-1 rounded-md bg-[#8B0000]/10 text-[#8B0000] hover:bg-[#8B0000]/20 transition cursor-pointer"
                >
                  <Trash2 class="w-3.5 h-3.5" />
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
