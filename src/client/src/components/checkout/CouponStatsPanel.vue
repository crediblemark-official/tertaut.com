<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { BarChart3, TicketPercent } from 'lucide-vue-next'
import { api } from '../../lib/api'
import { formatRupiah } from '../../lib/utils'

const props = defineProps<{
  filterAppId: string
  couponsCount: number
}>()

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
    const res = await api.getCouponStats(statsDays.value, props.filterAppId || undefined)
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

watch([statsDays, () => props.filterAppId], loadStats, { immediate: true })
watch(() => props.couponsCount, () => loadStats())

const maxDailyRedemptions = computed(() =>
  Math.max(1, ...(stats.value?.daily.map(d => d.redemptions) || [1]))
)

function dayLabel(dayIso: string): string {
  const d = new Date(`${dayIso}T00:00:00`)
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })
}
</script>

<template>
  <div class="mb-3 p-4 sm:p-5 rounded-xl bg-white border border-jetblack/15 shadow-xs space-y-4 animate-fadeIn">
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-jetblack/10 pb-3">
      <div class="flex items-center gap-2">
        <div class="p-1.5 rounded-lg bg-gold/15 text-jetblack">
          <BarChart3 class="w-4 h-4 text-gold" />
        </div>
        <div>
          <h3 class="text-xs font-bold text-jetblack">Statistik Penebusan Kupon</h3>
          <p class="text-[11px] text-jetblack/60">Pantau performa penggunaan kupon dan total potongan diskon yang diberikan.</p>
        </div>
      </div>
      <div class="flex items-center gap-1.5">
        <button
          v-for="d in [7, 14, 30]"
          :key="d"
          type="button"
          @click="statsDays = d"
          :class="[
            'px-2.5 py-1 rounded-lg font-bold transition cursor-pointer text-xs',
            statsDays === d ? 'bg-jetblack text-white shadow-2xs' : 'bg-jetblack/5 text-jetblack/60 hover:bg-jetblack/10'
          ]"
        >
          {{ d }} Hari
        </button>
      </div>
    </div>

    <!-- Grid 2-Kolom: Kiri Ringkasan KPI & Top Kupon, Kanan Bar Chart Harian -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
      <div class="lg:col-span-5 space-y-3">
        <div class="grid grid-cols-2 gap-2">
          <div class="p-3 rounded-xl bg-jetblack/[0.02] border border-jetblack/10">
            <div class="text-[10px] font-bold uppercase tracking-wider text-jetblack/50">Penebusan ({{ statsDays }} hari)</div>
            <div class="text-xl font-black font-mono text-jetblack mt-0.5">{{ stats?.totalRedemptions ?? '—' }} <span class="text-xs font-normal text-jetblack/50">x</span></div>
          </div>
          <div class="p-3 rounded-xl bg-jetblack/[0.02] border border-jetblack/10">
            <div class="text-[10px] font-bold uppercase tracking-wider text-jetblack/50">Total Diskon Diberikan</div>
            <div class="text-xl font-black font-mono text-crimson mt-0.5">{{ stats ? formatRupiah(stats.totalDiscountIdr) : '—' }}</div>
          </div>
        </div>

        <!-- Top Coupons -->
        <div v-if="stats && stats.topCoupons.length > 0" class="pt-1">
          <div class="text-[11px] font-bold text-jetblack/70 mb-1.5">Kupon Paling Populer:</div>
          <div class="flex flex-wrap items-center gap-1.5">
            <span
              v-for="(tc, idx) in stats.topCoupons.slice(0, 3)"
              :key="tc.code || `idx-${idx}`"
              class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-gold/15 border border-gold/35 text-[11px] font-bold text-jetblack font-mono"
            >
              <TicketPercent class="w-3 h-3 text-gold" />
              {{ tc.code }} · {{ tc.redemptions }}x
            </span>
          </div>
        </div>
      </div>

      <!-- Kanan: Bar Chart Harian -->
      <div class="lg:col-span-7 flex flex-col justify-between">
        <div class="text-[11px] font-bold text-jetblack/70 mb-1">Tren Penebusan Harian</div>
        <div v-if="stats && stats.daily.length > 0" class="flex items-end gap-1.5 h-24 px-2 pt-3 pb-1 bg-jetblack/[0.01] border border-jetblack/10 rounded-xl overflow-x-auto no-scrollbar">
          <div
            v-for="d in stats.daily"
            :key="d.day"
            class="flex-1 min-w-[28px] flex flex-col items-center justify-end gap-1 group relative"
          >
            <div class="absolute bottom-full mb-1 hidden group-hover:block z-10 whitespace-nowrap px-2 py-0.5 rounded bg-jetblack text-white text-[9.5px] font-bold shadow-sm">
              {{ dayLabel(d.day) }}: {{ d.redemptions }}x &bull; {{ formatRupiah(d.totalDiscount) }}
            </div>
            <div
              class="w-full max-w-[28px] rounded-t bg-gold/80 group-hover:bg-gold transition"
              :style="{ height: `${Math.max(4, (d.redemptions / maxDailyRedemptions) * 64)}px` }"
            ></div>
            <span class="text-[8.5px] text-jetblack/50 font-mono leading-none">{{ dayLabel(d.day) }}</span>
          </div>
        </div>
        <div v-else class="h-24 flex items-center justify-center text-xs text-jetblack/40 border border-jetblack/10 rounded-xl">
          Belum ada penebusan kupon dalam {{ statsDays }} hari terakhir.
        </div>
      </div>
    </div>
  </div>
</template>
