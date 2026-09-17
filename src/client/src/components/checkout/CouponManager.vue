<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  Ticket,
  Plus,
  RefreshCw,
  Power,
  Trash2,
  Search,
  TicketPercent,
  Clock,
  BarChart3
} from 'lucide-vue-next'
import { api } from '../../lib/api'
import type { AppItem, CouponItem } from '../../types'
import { formatRupiah } from '../../lib/utils'
import SearchPicker from '../common/SearchPicker.vue'

const props = defineProps<{
  appsList: AppItem[]
  couponsList: CouponItem[]
  loading: boolean
}>()

const emit = defineEmits<{
  (e: 'refresh'): void
  (e: 'create', payload: {
    appId: string
    code: string
    discountPercent: number
    maxRedemptions: number
    expiresAt?: string
  }): void
  (e: 'toggle', coupon: CouponItem): void
  (e: 'delete', coupon: CouponItem): void
}>()

// Form state (create)
const form = defineModel<{
  appId: string
  code: string
  discountPercent: number
  maxRedemptions: number
  expiresAt: string
}>('form', { default: () => ({ appId: '', code: '', discountPercent: 50, maxRedemptions: 0, expiresAt: '' }) })

const isCreating = defineModel<boolean>('isCreating', { default: false })
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

// ===== Statistik Pemakaian Kupon (Redeem per Hari) =====
const statsDays = ref(7)
const statsLoading = ref(false)
const stats = ref<{
  totalRedemptions: number
  totalDiscountIdr: number
  daily: { day: string; redemptions: number; totalDiscount: number; totalGross: number }[]
  topCoupons: { code: string | null; redemptions: number; totalDiscount: number }[]
} | null>(null)

async function loadStats() {
  statsLoading.value = true
  try {
    const res = await api.getCouponStats(statsDays.value, filterAppId.value || undefined)
    if (res.success) {
      stats.value = {
        totalRedemptions: res.totalRedemptions,
        totalDiscountIdr: res.totalDiscountIdr,
        daily: res.daily || [],
        topCoupons: res.topCoupons || []
      }
    }
  } catch (e) {
    console.error('Failed to load coupon stats:', e)
  } finally {
    statsLoading.value = false
  }
}

// Muat ulang statistik saat filter app / rentang hari berubah,
// dan juga setiap kali daftar kupon di-refresh (indikasi ada penebusan baru).
watch([statsDays, filterAppId], loadStats)
watch(() => props.couponsList.length, () => { loadStats() })

// Grafik bar harian: tinggi bar proporsional terhadap redeem terbanyak
const maxDailyRedemptions = computed(() =>
  Math.max(1, ...(stats.value?.daily.map(d => d.redemptions) || [1]))
)

function dayLabel(dayIso: string): string {
  const d = new Date(`${dayIso}T00:00:00`)
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })
}

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

function submitCreate() {
  const f = form.value
  if (!f.appId || !f.code.trim()) return
  emit('create', {
    appId: f.appId,
    code: f.code.trim().toUpperCase(),
    discountPercent: f.discountPercent,
    maxRedemptions: f.maxRedemptions,
    expiresAt: f.expiresAt || undefined
  })
}
</script>

<template>
  <div class="space-y-6">
    <!-- Top 2-Column Split: Kiri Form Buat Kupon, Kanan Grafik & Statistik -->
    <div class="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-[#111111]/10 border-b border-[#111111]/10 pb-6 pt-1">
      <!-- Kolom Kiri: Form Buat Kupon Baru -->
      <div class="pb-6 lg:pb-0 pr-0 lg:pr-6 space-y-3.5">
        <div class="flex items-center gap-2">
          <Plus class="w-4 h-4 text-[#D4AF37]" />
          <h2 class="text-sm font-bold text-[#111111]">Buat Kupon Baru</h2>
        </div>

        <div class="space-y-3 text-xs">
          <div>
            <label class="block font-bold text-[#111111]/70 mb-1">Target Aplikasi</label>
            <SearchPicker
              v-model="form.appId"
              :items="appsList"
              placeholder="Pilih software..."
              search-placeholder="Cari software..."
              button-class="w-full !h-9 !rounded-lg !min-w-0 justify-between px-3 text-xs border-slate-300/80 hover:border-slate-400 bg-white shadow-2xs focus:ring-2 focus:ring-[#D4AF37]/20 focus:border-[#D4AF37]"
            />
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label class="block font-bold text-[#111111]/70 mb-1">Kode Kupon</label>
              <input
                v-model="form.code"
                type="text"
                placeholder="PROMO50"
                class="w-full h-9 bg-white border border-slate-300/80 hover:border-slate-400 rounded-lg px-3 text-xs font-mono font-bold uppercase text-[#111111] placeholder:normal-case placeholder:font-sans placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/20 focus:border-[#D4AF37] shadow-2xs transition"
              />
            </div>
            <div>
              <label class="block font-bold text-[#111111]/70 mb-1">Diskon (%)</label>
              <input
                v-model.number="form.discountPercent"
                type="number"
                min="1"
                max="100"
                class="w-full h-9 bg-white border border-slate-300/80 hover:border-slate-400 rounded-lg px-3 text-xs font-mono text-[#111111] focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/20 focus:border-[#D4AF37] shadow-2xs transition"
              />
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label class="block font-bold text-[#111111]/70 mb-1">Kuota Penebusan (0 = ∞)</label>
              <input
                v-model.number="form.maxRedemptions"
                type="number"
                min="0"
                placeholder="0 untuk tanpa batas"
                class="w-full h-9 bg-white border border-slate-300/80 hover:border-slate-400 rounded-lg px-3 text-xs font-mono text-[#111111] focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/20 focus:border-[#D4AF37] shadow-2xs transition"
              />
            </div>
            <div>
              <label class="block font-bold text-[#111111]/70 mb-1">Kedaluwarsa (Opsional)</label>
              <input
                v-model="form.expiresAt"
                type="datetime-local"
                class="w-full h-9 bg-white border border-slate-300/80 hover:border-slate-400 rounded-lg px-2 text-xs text-[#111111] focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/20 focus:border-[#D4AF37] shadow-2xs transition"
              />
            </div>
          </div>

          <div class="pt-1">
            <button
              @click="submitCreate"
              :disabled="isCreating || !form.appId || !form.code.trim()"
              class="w-full h-9 btn-gold rounded-lg text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 active:scale-95 transition shadow-2xs"
            >
              <Plus class="w-3.5 h-3.5 stroke-[3]" />
              <span>{{ isCreating ? 'Menyimpan...' : 'Terbitkan Kupon Diskon' }}</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Kolom Kanan: Statistik & Grafik Penebusan -->
      <div class="pt-6 lg:pt-0 pl-0 lg:pl-6 space-y-3.5 flex flex-col justify-between">
        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <BarChart3 class="w-4 h-4 text-[#D4AF37]" />
              <h2 class="text-sm font-bold text-[#111111]">Statistik Penebusan</h2>
            </div>
            <div class="flex items-center gap-1 text-[11px]">
              <button
                v-for="d in [7, 14, 30]"
                :key="d"
                @click="statsDays = d"
                :class="[
                  'px-2 py-0.5 rounded-md font-bold transition cursor-pointer text-[10px]',
                  statsDays === d ? 'bg-[#111111] text-white shadow-2xs' : 'bg-[#111111]/5 text-[#111111]/60 hover:bg-[#111111]/10'
                ]"
              >{{ d }} hari</button>
            </div>
          </div>

          <!-- Ringkasan Periode -->
          <div class="grid grid-cols-2 divide-x divide-[#111111]/10 py-1">
            <div class="pr-3 pl-0">
              <div class="text-[10px] font-bold uppercase text-[#111111]/50">Penebusan ({{ statsDays }} hari)</div>
              <div class="text-xl font-black font-mono text-[#111111]">{{ stats?.totalRedemptions ?? '—' }}</div>
            </div>
            <div class="pl-3 pr-0">
              <div class="text-[10px] font-bold uppercase text-[#111111]/50">Total Diskon Diberikan</div>
              <div class="text-xl font-black font-mono text-[#8B0000]">{{ stats ? formatRupiah(stats.totalDiscountIdr) : '—' }}</div>
            </div>
          </div>

          <!-- Bar Chart Harian (Scrollable on small mobile screens) -->
          <div v-if="stats && stats.daily.length > 0" class="flex items-end gap-1 h-20 px-0.5 pt-2 overflow-x-auto no-scrollbar">
            <div
              v-for="d in stats.daily"
              :key="d.day"
              class="flex-1 min-w-[24px] flex flex-col items-center justify-end gap-1 group relative"
            >
              <div class="absolute bottom-full mb-1 hidden group-hover:block z-10 whitespace-nowrap px-2 py-0.5 rounded bg-[#111111] text-white text-[9.5px] font-bold shadow-sm">
                {{ dayLabel(d.day) }}: {{ d.redemptions }}x — {{ formatRupiah(d.totalDiscount) }}
              </div>
              <div
                class="w-full max-w-[28px] rounded-t bg-[#D4AF37]/85 group-hover:bg-[#D4AF37] transition-colors"
                :style="{ height: `${Math.max(4, (d.redemptions / maxDailyRedemptions) * 56)}px` }"
              ></div>
              <span class="text-[8px] text-[#111111]/45 font-mono leading-none">{{ dayLabel(d.day) }}</span>
            </div>
          </div>
          <div v-else class="h-20 flex items-center justify-center text-[11px] text-[#111111]/40 border border-[#111111]/10 rounded-lg">
            Belum ada penebusan kupon dalam {{ statsDays }} hari terakhir.
          </div>
        </div>

        <!-- Kupon Teratas -->
        <div v-if="stats && stats.topCoupons.length > 0" class="flex flex-wrap items-center gap-1.5 pt-2 border-t border-[#111111]/10">
          <span class="text-[10px] font-bold uppercase text-[#111111]/50 mr-1">Teratas:</span>
          <span
            v-for="(tc, idx) in stats.topCoupons.slice(0, 3)"
            :key="tc.code || `idx-${idx}`"
            class="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full bg-[#D4AF37]/15 border border-[#D4AF37]/35 text-[10px] font-bold text-[#111111] font-mono"
          >
            <TicketPercent class="w-2.5 h-2.5" />
            {{ tc.code }} · {{ tc.redemptions }}x
          </span>
        </div>
      </div>
    </div>

    <!-- Bagian Bawah: Header Tabel & Toolbar -->
    <div class="space-y-3 pt-1">
      <div class="flex items-center justify-between gap-3 pb-1 border-b border-[#111111]/10">
        <div class="flex items-center gap-2">
          <h2 class="text-sm font-bold text-[#111111]">Daftar Kupon Diskon</h2>
          <span class="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#111111]/5 text-[#111111]/70">
            {{ couponsList.length }} kupon
          </span>
        </div>
        <button
          @click="emit('refresh'); loadStats()"
          class="inline-flex items-center gap-1.5 px-2.5 h-9 rounded-lg bg-[#111111]/5 hover:bg-[#111111]/10 text-xs font-bold text-[#111111] cursor-pointer transition shrink-0"
        >
          <RefreshCw class="w-3 h-3" :class="{ 'animate-spin': loading || statsLoading }" />
          <span>Segarkan</span>
        </button>
      </div>

      <!-- Search & Filter Toolbar -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-[#111111]/10">
        <div class="relative flex-1 max-w-sm">
          <Search class="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#111111]/40" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Cari kode kupon..."
            class="w-full h-9 pl-8 pr-3 rounded-lg bg-white border border-slate-300/80 hover:border-slate-400 text-xs text-[#111111] placeholder:text-[#111111]/40 focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/20 focus:border-[#D4AF37] shadow-2xs transition"
          />
        </div>
        <SearchPicker
          v-model="filterAppId"
          :items="appsList"
          all-option-label="Semua Aplikasi"
          placeholder="Semua Aplikasi"
          search-placeholder="Cari software..."
          button-class="!h-9 !rounded-lg !min-w-[160px] bg-white border-slate-300/80 hover:border-slate-400 shadow-2xs text-xs"
        />
      </div>

      <!-- Coupons Table (Scrollable on mobile) -->
      <div class="overflow-x-auto w-full top-scrollbar">
        <table class="w-full text-left text-xs whitespace-nowrap">
          <thead class="border-b border-[#111111]/10 text-[#111111]/60 font-bold uppercase text-[10px]">
            <tr>
              <th class="py-2 pr-3 pl-0">Kode</th>
              <th class="py-2 px-3">Aplikasi</th>
              <th class="py-2 px-3">Diskon</th>
              <th class="py-2 px-3">Terpakai</th>
              <th class="py-2 px-3">Kedaluwarsa</th>
              <th class="py-2 px-3">Status</th>
              <th class="py-2 pl-3 pr-0 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-[#111111]/5">
            <tr v-if="filteredCoupons.length === 0">
              <td colspan="7" class="py-6 text-center text-[#111111]/40">
                <div class="space-y-0.5">
                  <Ticket class="w-5 h-5 mx-auto opacity-30" />
                  <p class="font-semibold text-xs text-[#111111]/60">Belum ada kupon.</p>
                  <p class="text-[11px] text-[#111111]/40">Buat kupon pertama Anda lewat formulir di samping.</p>
                </div>
              </td>
            </tr>
            <tr v-for="c in filteredCoupons" :key="c.id" class="hover:bg-[#111111]/[0.02]">
              <td class="py-2 pr-3 pl-0">
                <span class="font-mono font-bold text-[#111111]">{{ c.code }}</span>
              </td>
              <td class="py-2 px-3 text-[#111111]/80">{{ appLabel(c.appId) }}</td>
              <td class="py-2 px-3">
                <span class="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full bg-[#D4AF37]/15 border border-[#D4AF37]/35 text-[#111111] text-[10px] font-bold">
                  <TicketPercent class="w-2.5 h-2.5" />
                  {{ c.discountPercent }}%
                </span>
              </td>
              <td class="py-2 px-3 font-mono text-[#111111]/80">
                {{ c.redemptionCount }} / {{ remainingQuota(c) }}
              </td>
              <td class="py-2 px-3 text-[11px]">
                <span v-if="c.expiresAt" class="inline-flex items-center gap-1" :class="isExpiringSoon(c) ? 'text-[#8B0000] font-bold' : 'text-[#111111]/60'">
                  <Clock class="w-3 h-3" />
                  {{ new Date(c.expiresAt).toLocaleDateString('id-ID') }}
                </span>
                <span v-else class="text-[#111111]/40">Tanpa batas</span>
              </td>
              <td class="py-2 px-3">
                <span
                  class="px-2 py-0.5 rounded-full text-[10px] font-bold"
                  :class="c.isActive ? 'bg-[#0F4C3A]/10 text-[#0F4C3A]' : 'bg-[#111111]/5 text-[#111111]/50'"
                >
                  {{ c.isActive ? 'AKTIF' : 'NONAKTIF' }}
                </span>
              </td>
              <td class="py-2 pl-3 pr-0 text-right">
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
  </div>
</template>
