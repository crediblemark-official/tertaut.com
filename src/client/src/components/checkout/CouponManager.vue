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
  <div class="luxury-card p-4 md:p-5 rounded-xl space-y-4">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div class="flex items-center gap-2">
        <div class="p-1.5 rounded-lg bg-[#D4AF37]/15 border border-[#D4AF37]/35">
          <Ticket class="w-4 h-4 text-[#D4AF37]" />
        </div>
        <div>
          <h2 class="text-sm font-bold text-[#111111]">Kupon Diskon</h2>
          <p class="text-xs text-[#111111]/60">Kupon yang dibuat di sini langsung bisa ditebus pembeli di halaman checkout.</p>
        </div>
      </div>
      <button
        @click="emit('refresh'); loadStats()"
        class="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#111111]/5 hover:bg-[#111111]/10 text-xs font-bold text-[#111111] cursor-pointer self-start sm:self-auto"
      >
        <RefreshCw class="w-3 h-3" :class="{ 'animate-spin': loading || statsLoading }" />
        <span>Segarkan</span>
      </button>
    </div>

    <!-- Create Form -->
    <div class="p-3.5 rounded-xl bg-[#111111]/[0.03] border border-[#111111]/10 space-y-3">
      <div class="flex items-center gap-1.5 text-[11px] font-bold text-[#111111]/70 uppercase tracking-wide">
        <Plus class="w-3.5 h-3.5 text-[#D4AF37]" />
        <span>Buat Kupon Baru</span>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
        <div class="lg:col-span-2">
          <label class="block text-[10px] font-bold text-[#111111]/60 mb-1">Aplikasi</label>
          <select
            v-model="form.appId"
            class="w-full bg-white border border-[#111111]/15 rounded-lg px-2.5 py-1.5 text-xs font-bold text-[#111111] focus:outline-none focus:border-[#D4AF37]"
          >
            <option value="" disabled>Pilih aplikasi...</option>
            <option v-for="app in appsList" :key="app.id" :value="app.id">
              {{ app.name }}
            </option>
          </select>
        </div>

        <div>
          <label class="block text-[10px] font-bold text-[#111111]/60 mb-1">Kode Kupon</label>
          <input
            v-model="form.code"
            type="text"
            placeholder="EARLY50"
            class="w-full bg-white border border-[#111111]/15 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold uppercase text-[#111111] placeholder:normal-case placeholder:font-sans placeholder:text-[#111111]/35 focus:outline-none focus:border-[#D4AF37]"
          />
        </div>

        <div>
          <label class="block text-[10px] font-bold text-[#111111]/60 mb-1">Diskon (%)</label>
          <input
            v-model.number="form.discountPercent"
            type="number"
            min="1"
            max="100"
            class="w-full bg-white border border-[#111111]/15 rounded-lg px-2.5 py-1.5 text-xs font-mono text-[#111111] focus:outline-none focus:border-[#D4AF37]"
          />
        </div>

        <div>
          <label class="block text-[10px] font-bold text-[#111111]/60 mb-1">Kuota (0 = ∞)</label>
          <input
            v-model.number="form.maxRedemptions"
            type="number"
            min="0"
            class="w-full bg-white border border-[#111111]/15 rounded-lg px-2.5 py-1.5 text-xs font-mono text-[#111111] focus:outline-none focus:border-[#D4AF37]"
          />
        </div>
      </div>

      <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
        <div class="sm:w-56">
          <label class="block text-[10px] font-bold text-[#111111]/60 mb-1">Kedaluwarsa (opsional)</label>
          <input
            v-model="form.expiresAt"
            type="datetime-local"
            class="w-full bg-white border border-[#111111]/15 rounded-lg px-2.5 py-1.5 text-xs text-[#111111] focus:outline-none focus:border-[#D4AF37]"
          />
        </div>

        <button
          @click="submitCreate"
          :disabled="isCreating || !form.appId || !form.code.trim()"
          class="btn-gold px-3.5 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50 active:scale-95 transition shadow-sm self-start sm:self-auto"
        >
          <TicketPercent class="w-3.5 h-3.5" />
          <span>{{ isCreating ? 'Membuat...' : 'Buat Kupon' }}</span>
        </button>
      </div>
    </div>

    <!-- Statistik Pemakaian (Redeem per Hari) -->
    <div class="p-3.5 rounded-xl bg-[#111111]/[0.03] border border-[#111111]/10 space-y-3">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div class="flex items-center gap-1.5 text-[11px] font-bold text-[#111111]/70 uppercase tracking-wide">
          <BarChart3 class="w-3.5 h-3.5 text-[#D4AF37]" />
          <span>Statistik Penebusan</span>
        </div>
        <div class="flex items-center gap-1 text-[11px]">
          <button
            v-for="d in [7, 14, 30]"
            :key="d"
            @click="statsDays = d"
            :class="[
              'px-2 py-0.5 rounded-md font-bold transition cursor-pointer',
              statsDays === d ? 'bg-[#111111] text-white' : 'bg-[#111111]/5 text-[#111111]/60 hover:bg-[#111111]/10'
            ]"
          >{{ d }} hari</button>
        </div>
      </div>

      <!-- Ringkasan Periode -->
      <div class="grid grid-cols-2 gap-2">
        <div class="p-2.5 rounded-lg bg-white border border-[#111111]/10">
          <div class="text-[10px] font-bold uppercase text-[#111111]/50">Penebusan ({{ statsDays }} hari)</div>
          <div class="text-lg font-black font-mono text-[#111111]">{{ stats?.totalRedemptions ?? '—' }}</div>
        </div>
        <div class="p-2.5 rounded-lg bg-white border border-[#111111]/10">
          <div class="text-[10px] font-bold uppercase text-[#111111]/50">Total Diskon Diberikan</div>
          <div class="text-lg font-black font-mono text-[#8B0000]">{{ stats ? formatRupiah(stats.totalDiscountIdr) : '—' }}</div>
        </div>
      </div>

      <!-- Bar Chart Harian -->
      <div v-if="stats && stats.daily.length > 0" class="flex items-end gap-1 h-24 px-0.5">
        <div
          v-for="d in stats.daily"
          :key="d.day"
          class="flex-1 flex flex-col items-center justify-end gap-1 group relative"
        >
          <!-- Tooltip saat hover -->
          <div class="absolute bottom-full mb-1 hidden group-hover:block z-10 whitespace-nowrap px-2 py-1 rounded-md bg-[#111111] text-white text-[10px] font-bold">
            {{ dayLabel(d.day) }}: {{ d.redemptions }}x — diskon {{ formatRupiah(d.totalDiscount) }}
          </div>
          <div
            class="w-full max-w-[28px] rounded-t-md bg-[#D4AF37]/85 group-hover:bg-[#D4AF37] transition-colors"
            :style="{ height: `${Math.max(6, (d.redemptions / maxDailyRedemptions) * 72)}px` }"
          ></div>
          <span class="text-[8px] text-[#111111]/45 font-mono leading-none">{{ dayLabel(d.day) }}</span>
        </div>
      </div>
      <p v-else class="text-[11px] text-[#111111]/40 text-center py-2">
        Belum ada penebusan kupon dalam {{ statsDays }} hari terakhir.
      </p>

      <!-- Kupon Teratas -->
      <div v-if="stats && stats.topCoupons.length > 0" class="flex flex-wrap items-center gap-1.5 pt-1 border-t border-[#111111]/10">
        <span class="text-[10px] font-bold uppercase text-[#111111]/50 mr-1">Teratas:</span>
        <span
          v-for="(tc, idx) in stats.topCoupons.slice(0, 3)"
          :key="tc.code || `idx-${idx}`"
          class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#D4AF37]/15 border border-[#D4AF37]/35 text-[10px] font-bold text-[#111111] font-mono"
        >
          <TicketPercent class="w-2.5 h-2.5" />
          {{ tc.code }} · {{ tc.redemptions }}x
        </span>
      </div>
    </div>

    <!-- Search & Filter -->
    <div class="flex flex-col sm:flex-row sm:items-center gap-2 pt-1 border-t border-[#111111]/10">
      <div class="relative flex-1 max-w-xs">
        <Search class="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#111111]/40" />
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Cari kode kupon..."
          class="w-full pl-8 pr-3 py-1.5 rounded-lg bg-white border border-[#111111]/15 text-xs text-[#111111] placeholder:text-[#111111]/40 focus:outline-none focus:border-[#D4AF37]"
        />
      </div>
      <select
        v-model="filterAppId"
        class="bg-white border border-[#111111]/15 rounded-lg px-2.5 py-1.5 text-xs font-bold text-[#111111] focus:outline-none focus:border-[#D4AF37]"
      >
        <option value="">Semua Aplikasi</option>
        <option v-for="app in appsList" :key="app.id" :value="app.id">
          {{ app.name }}
        </option>
      </select>
    </div>

    <!-- Coupons Table -->
    <div class="overflow-x-auto">
      <table class="w-full text-left text-xs">
        <thead>
          <tr class="border-b border-[#111111]/10 text-[#111111]/60 font-bold uppercase text-[10px]">
            <th class="pb-2">Kode</th>
            <th class="pb-2">Aplikasi</th>
            <th class="pb-2">Diskon</th>
            <th class="pb-2">Terpakai</th>
            <th class="pb-2">Kedaluwarsa</th>
            <th class="pb-2">Status</th>
            <th class="pb-2 text-right">Aksi</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-[#111111]/5">
          <tr v-if="filteredCoupons.length === 0">
            <td colspan="7" class="py-8 text-center text-[#111111]/40">
              <div class="space-y-1">
                <Ticket class="w-6 h-6 mx-auto opacity-40" />
                <p class="font-semibold text-xs text-[#111111]/60">Belum ada kupon.</p>
                <p class="text-[11px] text-[#111111]/40">Buat kupon pertama Anda lewat formulir di atas, atau gunakan One-Click Live Launch.</p>
              </div>
            </td>
          </tr>
          <tr v-for="c in filteredCoupons" :key="c.id" class="hover:bg-[#111111]/[0.02]">
            <td class="py-2.5">
              <span class="font-mono font-bold text-[#111111]">{{ c.code }}</span>
            </td>
            <td class="py-2.5 text-[#111111]/80">{{ appLabel(c.appId) }}</td>
            <td class="py-2.5">
              <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#D4AF37]/15 border border-[#D4AF37]/35 text-[#111111] text-[10px] font-bold">
                <TicketPercent class="w-2.5 h-2.5" />
                {{ c.discountPercent }}%
              </span>
            </td>
            <td class="py-2.5 font-mono text-[#111111]/80">
              {{ c.redemptionCount }} / {{ remainingQuota(c) }}
            </td>
            <td class="py-2.5 text-[11px]">
              <span v-if="c.expiresAt" class="inline-flex items-center gap-1" :class="isExpiringSoon(c) ? 'text-[#8B0000] font-bold' : 'text-[#111111]/60'">
                <Clock class="w-3 h-3" />
                {{ new Date(c.expiresAt).toLocaleDateString('id-ID') }}
              </span>
              <span v-else class="text-[#111111]/40">Tanpa batas</span>
            </td>
            <td class="py-2.5">
              <span
                class="px-2 py-0.5 rounded-full text-[10px] font-bold"
                :class="c.isActive ? 'bg-[#0F4C3A]/10 text-[#0F4C3A]' : 'bg-[#111111]/5 text-[#111111]/50'"
              >
                {{ c.isActive ? 'AKTIF' : 'NONAKTIF' }}
              </span>
            </td>
            <td class="py-2.5 text-right">
              <div class="flex items-center justify-end gap-1.5">
                <button
                  @click="emit('toggle', c)"
                  :title="c.isActive ? 'Nonaktifkan kupon' : 'Aktifkan kupon'"
                  class="p-1.5 rounded-lg transition cursor-pointer"
                  :class="c.isActive
                    ? 'bg-[#111111]/5 text-[#111111]/60 hover:bg-[#D4AF37]/20 hover:text-[#111111]'
                    : 'bg-[#0F4C3A]/10 text-[#0F4C3A] hover:bg-[#0F4C3A]/20'"
                >
                  <Power class="w-3.5 h-3.5" />
                </button>
                <button
                  @click="emit('delete', c)"
                  title="Hapus kupon"
                  class="p-1.5 rounded-lg bg-[#8B0000]/10 text-[#8B0000] hover:bg-[#8B0000]/20 transition cursor-pointer"
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
