<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { BarChart3, TicketPercent } from "lucide-vue-next";
import { api } from "../../lib/api";
import { formatRupiah } from "../../lib/utils";

const props = defineProps<{
  filterAppId: string;
  couponsCount: number;
}>();

const statsDays = ref(7);
const statsLoading = ref(true);
const stats = ref<{
  totalRedemptions: number;
  totalDiscountIdr: number;
  daily: { day: string; redemptions: number; totalDiscount: number; totalGross: number }[];
  topCoupons: { code: string | null; redemptions: number; totalDiscount: number }[];
} | null>(null);

async function loadStats() {
  statsLoading.value = true;
  try {
    const res = await api.getCouponStats(statsDays.value, props.filterAppId || undefined);
    if (res.success) {
      stats.value = {
        totalRedemptions: res.totalRedemptions,
        totalDiscountIdr: res.totalDiscountIdr,
        daily: res.daily || [],
        topCoupons: res.topCoupons || [],
      };
    }
  } catch (e) {
    console.error("Failed to load coupon stats:", e);
  } finally {
    statsLoading.value = false;
  }
}

watch([statsDays, () => props.filterAppId], loadStats, { immediate: true });
watch(
  () => props.couponsCount,
  () => loadStats()
);

const maxDailyRedemptions = computed(() =>
  Math.max(1, ...(stats.value?.daily.map((d) => d.redemptions) || [1]))
);

function dayLabel(dayIso: string): string {
  const d = new Date(`${dayIso}T00:00:00`);
  return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short" });
}
</script>

<template>
  <div
    class="-mx-3.5 sm:-mx-4 md:-mx-6 bg-white border-b border-jetblack/15 divide-y divide-jetblack/10 animate-fadeIn"
  >
    <div
      class="px-3.5 sm:px-4 md:px-6 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-jetblack/[0.02]"
    >
      <div class="flex items-center gap-2">
        <BarChart3 class="w-4 h-4 text-gold shrink-0" />
        <h3 class="text-xs font-bold uppercase tracking-wider text-jetblack">Statistik Kupon</h3>
      </div>
      <div class="flex items-center gap-1">
        <button
          v-for="d in [7, 14, 30]"
          :key="d"
          type="button"
          @click="statsDays = d"
          :class="[
            'px-2.5 py-1 rounded-md font-bold transition cursor-pointer text-xs',
            statsDays === d
              ? 'bg-jetblack text-white'
              : 'bg-jetblack/5 text-jetblack/60 hover:bg-jetblack/10',
          ]"
        >
          {{ d }} Hari
        </button>
      </div>
    </div>

    <!-- Grid 2-Kolom Hairline: Kiri Ringkasan KPI & Top Kupon, Kanan Bar Chart Harian -->
    <div
      class="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-jetblack/10"
    >
      <div class="lg:col-span-5 divide-y divide-jetblack/10">
        <div class="grid grid-cols-2 divide-x divide-jetblack/10">
          <div class="px-3.5 sm:px-4 md:px-6 py-3">
            <div class="text-[10px] font-bold uppercase tracking-wider text-jetblack/50">
              Penebusan ({{ statsDays }}h)
            </div>
            <div
              v-if="statsLoading"
              class="h-6 w-14 bg-jetblack/10 rounded animate-pulse mt-1"
            ></div>
            <div v-else class="text-xl font-black font-mono tracking-wider text-jetblack mt-0.5">
              {{ stats?.totalRedemptions ?? 0
              }}<span class="text-xs font-normal text-jetblack/50">x</span>
            </div>
          </div>
          <div class="px-3.5 sm:px-4 md:px-6 py-3">
            <div class="text-[10px] font-bold uppercase tracking-wider text-jetblack/50">
              Total Diskon
            </div>
            <div
              v-if="statsLoading"
              class="h-6 w-24 bg-jetblack/10 rounded animate-pulse mt-1"
            ></div>
            <div v-else class="text-xl font-black font-mono tracking-wider text-crimson mt-0.5">
              {{ formatRupiah(stats?.totalDiscountIdr || 0) }}
            </div>
          </div>
        </div>

        <!-- Top Coupons -->
        <div v-if="statsLoading" class="px-3.5 sm:px-4 md:px-6 py-3 space-y-1.5">
          <div class="h-3 w-28 bg-jetblack/10 rounded animate-pulse"></div>
          <div class="flex gap-1.5">
            <div class="h-5 w-20 bg-gold/15 rounded animate-pulse"></div>
            <div class="h-5 w-20 bg-gold/15 rounded animate-pulse"></div>
          </div>
        </div>
        <div v-else-if="stats && stats.topCoupons.length > 0" class="px-3.5 sm:px-4 md:px-6 py-3">
          <div class="text-[10.5px] font-bold uppercase tracking-wider text-jetblack/55 mb-1.5">
            Kupon Populer
          </div>
          <div class="flex flex-wrap items-center gap-1.5">
            <span
              v-for="(tc, idx) in stats.topCoupons.slice(0, 3)"
              :key="tc.code || `idx-${idx}`"
              class="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-gold/15 border border-gold/35 text-[11px] font-bold text-jetblack font-mono tracking-wider"
            >
              <TicketPercent class="w-3 h-3 text-gold" />
              {{ tc.code }} · {{ tc.redemptions }}x
            </span>
          </div>
        </div>
      </div>

      <!-- Kanan: Bar Chart Harian -->
      <div class="lg:col-span-7 px-3.5 sm:px-4 md:px-6 py-3 flex flex-col justify-between">
        <div class="text-[10.5px] font-bold uppercase tracking-wider text-jetblack/55 mb-2">
          Tren Harian
        </div>

        <div v-if="statsLoading" class="flex items-end gap-2 h-24 pt-2 border-b border-jetblack/10">
          <div
            v-for="h in [28, 44, 20, 56, 36, 48, 64]"
            :key="`c-sk-${h}`"
            class="flex-1 flex flex-col items-center justify-end gap-1.5 h-full"
          >
            <div
              class="w-full max-w-[28px] rounded-t bg-jetblack/10 animate-pulse"
              :style="{ height: `${h}%` }"
            ></div>
            <div class="w-5 h-2 bg-jetblack/5 rounded animate-pulse"></div>
          </div>
        </div>

        <div
          v-else-if="stats && stats.daily.length > 0"
          class="flex items-end gap-1.5 h-24 pt-2 border-b border-jetblack/10 overflow-x-auto no-scrollbar"
        >
          <div
            v-for="d in stats.daily"
            :key="d.day"
            class="flex-1 min-w-[28px] flex flex-col items-center justify-end gap-1 group relative"
          >
            <div
              class="absolute bottom-full mb-1 hidden group-hover:block z-10 whitespace-nowrap px-2 py-0.5 rounded bg-jetblack text-white text-[9.5px] font-bold shadow-sm"
            >
              {{ dayLabel(d.day) }}: {{ d.redemptions }}x &bull; {{ formatRupiah(d.totalDiscount) }}
            </div>
            <div
              class="w-full max-w-[28px] rounded-t bg-gold/80 group-hover:bg-gold transition"
              :style="{ height: `${Math.max(4, (d.redemptions / maxDailyRedemptions) * 64)}px` }"
            ></div>
            <span class="text-[8.5px] text-jetblack/50 font-mono leading-none">{{
              dayLabel(d.day)
            }}</span>
          </div>
        </div>
        <div
          v-else
          class="h-24 flex items-center justify-center text-xs text-jetblack/40 border-y border-jetblack/10"
        >
          Belum ada penebusan kupon dalam {{ statsDays }} hari terakhir.
        </div>
      </div>
    </div>
  </div>
</template>
