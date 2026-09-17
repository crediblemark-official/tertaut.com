<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import {
  api,
  type DashboardStats,
  type TransactionItem,
  type LicenseItem
} from '../lib/api'
import { dashboardEnv, envPath } from '../lib/environment'
import { formatRupiah } from '../lib/utils'
import {
  DollarSign,
  KeyRound,
  TrendingUp,
  Zap,
  Plus,
  TicketPercent,
  CheckCircle2,
  RefreshCw,
  Monitor,
  BarChart3
} from 'lucide-vue-next'

const stats = ref<DashboardStats | null>(null)
const allTransactions = ref<TransactionItem[]>([])
const allLicenses = ref<LicenseItem[]>([])
const loading = ref(true)
const statsDays = ref<7 | 14 | 30>(7)
const hoveredDay = ref<{ date: string; label: string; count: number; gross: number } | null>(null)

async function loadData() {
  loading.value = true
  try {
    const [statsRes, txsRes, licsRes] = await Promise.all([
      api.getStats(),
      api.getTransactions(),
      api.getLicenses()
    ])
    stats.value = statsRes
    allTransactions.value = txsRes.transactions || []
    allLicenses.value = licsRes.licenses || []
  } catch (err) {
    console.error('Failed to load dashboard overview data:', err)
  } finally {
    loading.value = false
  }
}

// Deep analytics metrics
const analyticsStats = computed(() => {
  const txs = allTransactions.value
  const paidTxs = txs.filter(t => t.paymentStatus === 'PAID')

  const totalPaidCount = paidTxs.length
  const totalGross = paidTxs.reduce((sum, t) => sum + (t.grossAmount || 0), 0)
  const aov = totalPaidCount > 0 ? Math.round(totalGross / totalPaidCount) : 0
  const conversionRate = txs.length > 0 ? Math.round((totalPaidCount / txs.length) * 100) : 0

  const totalDiscount = txs.reduce((sum, t) => sum + (t.discountAmount || 0), 0)

  const lics = allLicenses.value
  const totalSeatsUsed = lics.reduce((sum, l) => sum + (l.seatsUsed || 0), 0)
  const totalMaxSeats = lics.reduce((sum, l) => sum + (l.maxSeats || 3), 0)

  return {
    aov,
    conversionRate,
    totalDiscount,
    totalPaidCount,
    totalSeatsUsed,
    totalMaxSeats
  }
})

// Daily chart data for 7, 14, or 30 days
const dailyChartData = computed(() => {
  const days = statsDays.value
  const result: { date: string; label: string; count: number; gross: number }[] = []

  const now = new Date()
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const dateKey = d.toISOString().split('T')[0]
    const label = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' }).format(d)
    result.push({ date: dateKey, label, count: 0, gross: 0 })
  }

  for (const tx of allTransactions.value) {
    if (tx.paymentStatus !== 'PAID') continue
    const txDate = tx.createdAt ? tx.createdAt.split('T')[0] : ''
    const item = result.find(r => r.date === txDate)
    if (item) {
      item.count++
      item.gross += tx.grossAmount || 0
    }
  }

  return result
})

const maxDailyGross = computed(() => {
  const max = Math.max(...dailyChartData.value.map(d => d.gross), 1)
  return max
})

const periodTotalGross = computed(() => {
  return dailyChartData.value.reduce((sum, d) => sum + d.gross, 0)
})

interface ChartPoint {
  date: string
  label: string
  count: number
  gross: number
  x: number
  y: number
}

const lineChartPoints = computed<ChartPoint[]>(() => {
  const data = dailyChartData.value
  if (data.length === 0) return []

  const width = 360
  const height = 90
  const padX = 14
  const padTop = 14
  const padBottom = 16
  const graphWidth = width - padX * 2
  const graphHeight = height - padTop - padBottom

  const maxVal = maxDailyGross.value || 1

  return data.map((d, i) => {
    const x = padX + (i / Math.max(1, data.length - 1)) * graphWidth
    const ratio = d.gross / maxVal
    const y = (height - padBottom) - (ratio * graphHeight)
    return {
      ...d,
      x: Math.round(x * 10) / 10,
      y: Math.round(y * 10) / 10
    }
  })
})

const linePath = computed(() => {
  const pts = lineChartPoints.value
  if (pts.length === 0) return ''
  return pts.map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`)).join(' ')
})

const areaPath = computed(() => {
  const pts = lineChartPoints.value
  if (pts.length === 0) return ''
  const first = pts[0]
  const last = pts[pts.length - 1]
  const baseline = 90 - 16
  return `${linePath.value} L ${last.x} ${baseline} L ${first.x} ${baseline} Z`
})

const hoveredPoint = computed(() => {
  if (!hoveredDay.value) return null
  return lineChartPoints.value.find(p => p.date === hoveredDay.value?.date) || null
})

onMounted(() => {
  loadData()
})

// Muat ulang saat environment Live/Sandbox berganti
watch(dashboardEnv, () => {
  loadData()
})
</script>

<template>
  <div class="space-y-5 animate-fadeIn pb-12">
    <!-- Unified Header & Toolbar (Edge-to-Edge Full Width & Standardized Height) -->
    <div class="-mx-3.5 sm:-mx-4 md:-mx-6 -mt-4 sm:-mt-5 md:-mt-6 px-3.5 sm:px-4 md:px-6 min-h-[44px] py-1.5 sm:py-0 bg-[#111111] text-white border-b border-[#111111] flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-xs mb-3">
      <div class="flex items-center gap-2">
        <h1 class="text-xs font-bold uppercase tracking-wider text-white">Ringkasan Bisnis</h1>
        <span
          class="px-2 py-0.5 rounded-md font-bold text-[10px]"
          :class="dashboardEnv === 'sandbox' ? 'bg-[#D4AF37] text-[#111111]' : 'bg-[#0F4C3A] text-white'"
        >
          {{ dashboardEnv === 'sandbox' ? 'Sandbox Mode' : 'Live Mode' }}
        </span>
      </div>

      <div class="flex items-center gap-2">
        <button
          @click="loadData"
          :disabled="loading"
          class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-bold transition cursor-pointer disabled:opacity-50"
          title="Segarkan Data"
        >
          <RefreshCw class="w-3 h-3" :class="{ 'animate-spin': loading }" />
          <span class="hidden sm:inline">Segarkan</span>
        </button>

        <router-link
          :to="envPath(dashboardEnv, '/apps')"
          class="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg btn-gold text-xs font-bold transition shadow-2xs active:scale-95 cursor-pointer shrink-0"
        >
          <Plus class="w-3.5 h-3.5 stroke-[3]" />
          <span>Tambah Software</span>
        </router-link>
      </div>
    </div>

    <!-- Overview Stats KPI (Horizontal Scroll on Mobile, Grid on Tablet/Desktop) -->
    <div class="w-full flex overflow-x-auto sm:grid sm:grid-cols-2 lg:grid-cols-4 divide-x divide-[#111111]/10 border-b border-[#111111]/10 pb-4 pt-1 top-scrollbar">
      <div class="min-w-[220px] sm:min-w-0 flex-1 shrink-0 py-2 pr-4 pl-0 space-y-1">
        <div class="flex items-center justify-between text-[#111111]/50 text-xs font-semibold">
          <span>Gross Volume (MoR)</span>
          <DollarSign class="w-4 h-4 text-[#111111]" />
        </div>
        <div class="text-2xl font-black text-[#111111] font-mono">
          {{ formatRupiah(stats?.totalGMV || 0) }}
        </div>
        <div class="text-[11px] text-[#111111]/50">
          Total omzet bruto terverifikasi
        </div>
      </div>

      <div class="min-w-[220px] sm:min-w-0 flex-1 shrink-0 py-2 px-4 space-y-1">
        <div class="flex items-center justify-between text-[#111111]/50 text-xs font-semibold">
          <span>Net Builder Payout (95%)</span>
          <TrendingUp class="w-4 h-4 text-[#0F4C3A]" />
        </div>
        <div class="text-2xl font-black text-[#0F4C3A] font-mono">
          {{ formatRupiah(stats?.netEarnings || 0) }}
        </div>
        <div class="text-[11px] text-[#0F4C3A] font-medium flex items-center gap-1">
          <span>Hak bersih siap cair ke rekening</span>
        </div>
      </div>

      <div class="min-w-[220px] sm:min-w-0 flex-1 shrink-0 py-2 px-4 space-y-1">
        <div class="flex items-center justify-between text-[#111111]/50 text-xs font-semibold">
          <span>Lisensi Aktif Terbit</span>
          <KeyRound class="w-4 h-4 text-[#D4AF37]" />
        </div>
        <div class="text-2xl font-black text-[#111111] font-mono">
          {{ stats?.activeLicenses || 0 }}
        </div>
        <div class="text-[11px] text-[#111111]/50">
          Hardware-bound &amp; multi-seat
        </div>
      </div>

      <div class="min-w-[220px] sm:min-w-0 flex-1 shrink-0 py-2 px-4 sm:pl-4 sm:pr-0 space-y-1">
        <div class="flex items-center justify-between text-[#111111]/50 text-xs font-semibold">
          <span>Total Transaksi</span>
          <Zap class="w-4 h-4 text-[#D4AF37]" />
        </div>
        <div class="text-2xl font-black text-[#111111] font-mono">
          {{ stats?.totalTransactions || 0 }}
        </div>
        <div class="text-[11px] text-[#111111]/50">
          Pembayaran QRIS &amp; Virtual Account
        </div>
      </div>
    </div>

    <!-- Analitik & Performa Penjualan (Flat, Seamless - Tanpa Card Container) -->
    <div class="space-y-3 pt-1 border-b border-[#111111]/10 pb-5">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div class="flex items-center gap-2">
          <BarChart3 class="w-4 h-4 text-[#D4AF37]" />
          <h2 class="text-xs font-bold uppercase tracking-wider text-[#111111]">Tren &amp; Performa Penjualan</h2>
          <span class="text-[11px] text-[#111111]/40 hidden sm:inline">• Pantau omzet MoR &amp; transaksi harian</span>
        </div>

        <div class="flex items-center gap-1">
          <button
            v-for="d in ([7, 14, 30] as const)"
            :key="d"
            type="button"
            @click="statsDays = d"
            :class="[
              'px-2.5 py-0.5 rounded-md font-bold transition cursor-pointer text-xs',
              statsDays === d ? 'bg-[#111111] text-white' : 'bg-[#111111]/5 text-[#111111]/60 hover:bg-[#111111]/10'
            ]"
          >
            {{ d }} Hari
          </button>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center pt-1">
        <!-- 4 Sub-KPIs (Left 5 cols - Flat layout) -->
        <div class="lg:col-span-5 grid grid-cols-2 gap-3">
          <div class="space-y-0.5">
            <div class="flex items-center justify-between text-[#111111]/50 text-[10px] font-bold uppercase tracking-wider">
              <span>Rata-Rata Order</span>
              <DollarSign class="w-3.5 h-3.5 text-[#111111]" />
            </div>
            <div class="text-lg font-black font-mono text-[#111111]">
              {{ formatRupiah(analyticsStats.aov) }}
            </div>
            <div class="text-[10px] text-[#111111]/50">Per transaksi berhasil</div>
          </div>

          <div class="space-y-0.5 pl-3 border-l border-[#111111]/10">
            <div class="flex items-center justify-between text-[#111111]/50 text-[10px] font-bold uppercase tracking-wider">
              <span>Sukses Bayar</span>
              <TrendingUp class="w-3.5 h-3.5 text-[#0F4C3A]" />
            </div>
            <div class="text-lg font-black font-mono text-[#0F4C3A]">
              {{ analyticsStats.conversionRate }}%
            </div>
            <div class="text-[10px] text-[#0F4C3A] font-medium">{{ analyticsStats.totalPaidCount }} lunas</div>
          </div>

          <div class="space-y-0.5 pt-2 border-t border-[#111111]/10">
            <div class="flex items-center justify-between text-[#111111]/50 text-[10px] font-bold uppercase tracking-wider">
              <span>Diskon Kupon</span>
              <TicketPercent class="w-3.5 h-3.5 text-[#D4AF37]" />
            </div>
            <div class="text-lg font-black font-mono text-[#111111]">
              {{ formatRupiah(analyticsStats.totalDiscount) }}
            </div>
            <div class="text-[10px] text-[#111111]/50">Total insentif kupon</div>
          </div>

          <div class="space-y-0.5 pt-2 pl-3 border-t border-l border-[#111111]/10">
            <div class="flex items-center justify-between text-[#111111]/50 text-[10px] font-bold uppercase tracking-wider">
              <span>Aktivasi Seat</span>
              <Monitor class="w-3.5 h-3.5 text-[#111111]" />
            </div>
            <div class="text-lg font-black font-mono text-[#111111]">
              {{ analyticsStats.totalSeatsUsed }} <span class="text-xs font-normal text-[#111111]/50">/ {{ analyticsStats.totalMaxSeats }}</span>
            </div>
            <div class="text-[10px] text-[#111111]/50">Device terikat HWID</div>
          </div>
        </div>

        <!-- Interactive Line Chart (Right 7 cols - Seamless Flat) -->
        <div class="lg:col-span-7 flex flex-col justify-between lg:pl-5 lg:border-l lg:border-[#111111]/10">
          <div class="flex items-center justify-between text-[11px] font-bold text-[#111111]/70 mb-1 min-h-[22px]">
            <span>Tren Omzet ({{ statsDays }} Hari)</span>
            <div v-if="hoveredDay" class="font-mono text-xs text-[#111111] flex items-center gap-1.5 animate-fadeIn">
              <span class="text-[#111111]/60 font-medium">{{ hoveredDay.label }}:</span>
              <span class="font-bold text-[#D4AF37]">{{ formatRupiah(hoveredDay.gross) }}</span>
              <span class="text-[10px] text-[#111111]/50 font-normal">({{ hoveredDay.count }} tx)</span>
            </div>
            <div v-else class="font-mono text-xs text-[#111111]">
              <span class="text-[#111111]/50 font-medium text-[11px]">Total: </span>
              <span class="font-bold text-[#0F4C3A]">{{ formatRupiah(periodTotalGross) }}</span>
            </div>
          </div>

          <!-- SVG Line / Area Chart -->
          <div class="relative w-full pt-1 pb-1 select-none">
            <svg
              viewBox="0 0 360 90"
              class="w-full h-22 overflow-visible"
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id="omzetGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stop-color="#D4AF37" stop-opacity="0.35" />
                  <stop offset="100%" stop-color="#D4AF37" stop-opacity="0.0" />
                </linearGradient>
              </defs>

              <!-- Subtle horizontal grid lines -->
              <line x1="14" y1="14" x2="346" y2="14" stroke="#111111" stroke-opacity="0.05" stroke-dasharray="3 3" />
              <line x1="14" y1="44" x2="346" y2="44" stroke="#111111" stroke-opacity="0.05" stroke-dasharray="3 3" />
              <line x1="14" y1="74" x2="346" y2="74" stroke="#111111" stroke-opacity="0.12" />

              <!-- Gradient Area Fill -->
              <path
                :d="areaPath"
                fill="url(#omzetGradient)"
                class="transition-all duration-300"
              />

              <!-- Active Hover Vertical Guideline -->
              <line
                v-if="hoveredPoint"
                :x1="hoveredPoint.x"
                :y1="14"
                :x2="hoveredPoint.x"
                :y2="74"
                stroke="#111111"
                stroke-opacity="0.3"
                stroke-dasharray="2 2"
              />

              <!-- Crisp Line Stroke -->
              <path
                :d="linePath"
                fill="none"
                stroke="#D4AF37"
                stroke-width="2.5"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="transition-all duration-300"
              />

              <!-- Interactive Data Points / Dots -->
              <g v-for="pt in lineChartPoints" :key="pt.date">
                <!-- Large hover area -->
                <circle
                  :cx="pt.x"
                  :cy="pt.y"
                  r="14"
                  fill="transparent"
                  class="cursor-pointer"
                  @mouseenter="hoveredDay = pt"
                  @mouseleave="hoveredDay = null"
                />

                <!-- Point dot -->
                <circle
                  :cx="pt.x"
                  :cy="pt.y"
                  :r="hoveredDay?.date === pt.date ? 5 : (pt.gross > 0 ? 3.5 : 2.5)"
                  :class="[
                    hoveredDay?.date === pt.date
                      ? 'fill-[#111111] stroke-[#D4AF37] stroke-[2.5]'
                      : pt.gross > 0
                        ? 'fill-[#D4AF37] stroke-white stroke-2'
                        : 'fill-white stroke-[#111111]/30 stroke-1.5'
                  ]"
                  class="transition-all duration-150 pointer-events-none"
                />
              </g>
            </svg>
          </div>

          <!-- Date Labels Under Line Chart -->
          <div class="flex items-center justify-between px-2 pt-0.5">
            <span
              v-for="pt in lineChartPoints"
              :key="pt.date"
              class="text-[9px] font-mono leading-none transition-colors"
              :class="hoveredDay?.date === pt.date ? 'font-bold text-[#111111]' : 'text-[#111111]/50'"
            >
              {{ pt.label.split(' ')[0] }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>