<script setup lang="ts">
import { computed } from 'vue'
import type { AppItem, CatalogKPIStats } from '../../types/app'
import { dashboardEnv, envPath } from '../../lib/environment'
import { formatRupiah } from '../../lib/utils'
import {
  Plus,
  ExternalLink,
  ArrowUpRight,
  Search,
  Key,
  FileText,
  Lock,
  Zap,
  Sparkles,
  Wifi,
} from 'lucide-vue-next'

const props = defineProps<{
  apps: AppItem[]
  loading: boolean
  searchQuery: string
  stats?: CatalogKPIStats | null
}>()

const activeProductsCount = computed(() => props.stats?.activeProducts ?? props.apps.length)
const archivedProductsCount = computed(() => props.stats?.archivedProducts ?? 0)
const salesCount = computed(() => props.stats?.sales30d ?? 0)
const activeSubscriptionsCount = computed(() => props.stats?.activeSubscriptions ?? 0)
const acrossProductsCount = computed(() => props.stats?.acrossProducts ?? (props.apps.length > 0 ? 1 : 0))
const customersCount = computed(() => props.stats?.customers30d ?? 0)

const emit = defineEmits<{
  'update:searchQuery': [value: string]
  'open-create': []
  'toggle-mode': [app: AppItem]
}>()

const filteredApps = computed(() => {
  return props.apps.filter(app => {
    if (props.searchQuery.trim()) {
      const q = props.searchQuery.toLowerCase().trim()
      const matchName = app.name.toLowerCase().includes(q)
      const matchSlug = app.slug.toLowerCase().includes(q)
      if (!matchName && !matchSlug) return false
    }
    return true
  })
})

function getPricingBadge(app: AppItem): string {
  if (app.pricingType === 'free') return 'Gratis'
  if (app.pricingType === 'one_time') return 'Sekali'
  const period = app.billingPeriod
  if (period === 'daily') return 'Harian'
  if (period === 'weekly') return 'Mingguan'
  if (period === 'monthly') return 'Bulanan'
  if (period === 'every_3_months') return '3 Bulan'
  if (period === 'every_6_months') return '6 Bulan'
  if (period === 'yearly') return 'Tahunan'
  if (period === 'custom') return 'Kustom'
  return 'Berulang'
}
</script>

<template>
  <div>
    <!-- Unified Header & Toolbar -->
    <div class="-mx-3.5 sm:-mx-4 md:-mx-6 px-3.5 sm:px-4 md:px-6 min-h-[44px] py-1.5 sm:py-0 bg-jetblack text-white border-b border-jetblack flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-xs mb-3">
      <div class="flex items-center gap-2">
        <h1 class="text-xs font-bold uppercase tracking-wider text-white">Katalog Produk &amp; Monetisasi</h1>
        <span class="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white font-mono font-bold">
          {{ apps.length }} produk
        </span>
        <span
          class="px-2 py-0.5 rounded-md font-bold text-[10px]"
          :class="dashboardEnv === 'sandbox' ? 'bg-gold text-jetblack' : 'bg-forest text-white'"
        >
          {{ dashboardEnv === 'sandbox' ? 'Sandbox' : 'Live' }}
        </span>
      </div>

      <div class="flex items-center gap-2">
        <div class="relative w-full sm:w-60">
          <Search class="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" />
          <input
            :value="searchQuery"
            @input="emit('update:searchQuery', ($event.target as HTMLInputElement).value)"
            type="text"
            placeholder="Cari nama atau slug..."
            class="w-full pl-8 pr-2.5 py-1 rounded-lg bg-white/10 border border-white/15 text-xs text-white placeholder:text-white/40 focus:outline-none focus:bg-white/15 focus:border-gold transition"
          />
        </div>

        <button
          @click="emit('open-create')"
          class="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg btn-gold text-xs font-bold transition shadow-2xs cursor-pointer active:scale-95 shrink-0"
        >
          <Plus class="w-3.5 h-3.5 stroke-[3]" />
          <span>Produk Baru</span>
        </button>
      </div>
    </div>

    <!-- Product Catalog Stats KPI Bar (Flush Canvas, Creem/Polar style) -->
    <div class="-mx-3.5 sm:-mx-4 md:-mx-6 px-3.5 sm:px-4 md:px-6 grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 py-2.5 sm:py-3 border-b border-jetblack/15 mb-0">
      <div class="space-y-0.5">
        <div class="text-xs font-semibold text-jetblack/60">Active products</div>
        <div class="text-2xl font-bold text-jetblack font-mono tracking-tight">{{ activeProductsCount }}</div>
        <div class="text-[11px] text-jetblack/50 font-medium">
          {{ archivedProductsCount > 0 ? `${archivedProductsCount} diarsipkan` : (dashboardEnv === 'sandbox' ? 'Mode Sandbox' : 'Siap Jual') }}
        </div>
      </div>

      <div class="space-y-0.5 sm:border-l sm:border-jetblack/10 sm:pl-5">
        <div class="text-xs font-semibold text-jetblack/60">Sales</div>
        <div class="text-2xl font-bold text-jetblack font-mono tracking-tight">{{ salesCount }}</div>
        <div class="text-[11px] text-jetblack/50 font-medium">30 hari terakhir</div>
      </div>

      <div class="space-y-0.5 sm:border-l sm:border-jetblack/10 sm:pl-5">
        <div class="text-xs font-semibold text-jetblack/60">Active subscriptions</div>
        <div class="text-2xl font-bold text-jetblack font-mono tracking-tight">{{ activeSubscriptionsCount }}</div>
        <div class="text-[11px] text-jetblack/50 font-medium">across {{ acrossProductsCount }} {{ acrossProductsCount === 1 ? 'product' : 'products' }}</div>
      </div>

      <div class="space-y-0.5 sm:border-l sm:border-jetblack/10 sm:pl-5">
        <div class="text-xs font-semibold text-jetblack/60">Customers</div>
        <div class="text-2xl font-bold text-jetblack font-mono tracking-tight">{{ customersCount }}</div>
        <div class="text-[11px] text-jetblack/50 font-medium">30 hari terakhir</div>
      </div>
    </div>

    <!-- Table View -->
    <div class="-mx-3.5 sm:-mx-4 md:-mx-6 overflow-x-auto top-scrollbar">
      <table class="w-full min-w-full text-left text-xs whitespace-nowrap border-b border-jetblack/15">
        <thead class="border-b border-jetblack/20 text-xs font-semibold text-jetblack/70 bg-white">
          <tr>
            <th class="py-2 pr-3 pl-3.5 sm:pl-4 md:pl-6">Nama Produk</th>
            <th class="py-2 px-3">Tipe &amp; Harga</th>
            <th class="py-2 px-3">Benefits</th>
            <th class="py-2 px-3">Metering</th>
            <th class="py-2 px-3">Status Mode</th>
            <th class="py-2 px-3">Launch Link</th>
            <th class="py-2 pl-3 pr-3.5 sm:pr-4 md:pr-6 text-right">Aksi</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-jetblack/15">
          <tr v-if="filteredApps.length === 0">
            <td colspan="7" class="py-8 px-3.5 sm:px-4 md:px-6 text-center text-jetblack/40">
              <p class="font-semibold text-xs text-jetblack/60">Tidak ada produk ditemukan.</p>
              <p class="text-[11px] text-jetblack/40" v-if="searchQuery">
                Coba sesuaikan kata kunci pencarian.
              </p>
            </td>
          </tr>
          <tr v-for="app in filteredApps" :key="app.id" class="hover:bg-jetblack/[0.02] transition">
            <td class="py-2.5 pr-3 pl-3.5 sm:pl-4 md:pl-6 font-bold text-jetblack">
              <div class="flex items-center gap-2">
                <div class="w-7 h-7 rounded-md bg-jetblack/5 border border-jetblack/10 flex items-center justify-center shrink-0 overflow-hidden">
                  <img v-if="app.mediaUrl" :src="app.mediaUrl" class="w-full h-full object-cover" />
                  <span v-else class="text-[11px] font-mono font-bold text-jetblack/60">{{ app.name.charAt(0) }}</span>
                </div>
                <div>
                  <div class="font-bold text-jetblack leading-tight">{{ app.name }}</div>
                  <div class="text-[10px] text-jetblack/50 font-mono">{{ app.slug }}</div>
                </div>
              </div>
            </td>
            <td class="py-2.5 px-3">
              <div class="flex items-center gap-1.5">
                <span class="font-mono font-bold text-jetblack">
                  {{ app.pricingType === 'free' ? 'Gratis' : formatRupiah(app.targetPrice) }}
                </span>
                <span
                  class="text-[9px] px-1.5 py-0.5 rounded font-bold uppercase"
                  :class="app.pricingType === 'subscription' ? 'bg-forest/10 text-forest' : app.pricingType === 'free' ? 'bg-neutral-100 text-neutral-600' : 'bg-gold/15 text-[#8a6d1f]'"
                >
                  {{ getPricingBadge(app) }}
                </span>
              </div>
            </td>
            <td class="py-2.5 px-3">
              <div class="flex items-center gap-1">
                <span
                  v-if="app.deliveryConfig?.licenseKey?.enabled"
                  title="Lisensi Software"
                  class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-semibold"
                >
                  <Key class="w-2.5 h-2.5" />
                  <span>Lisensi</span>
                </span>
                <span
                  v-if="app.deliveryConfig?.licenseKey?.floating?.enabled"
                  title="Lisensi Floating: lease + heartbeat berkala"
                  class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-forest/10 text-forest border border-forest/25 text-[10px] font-semibold"
                >
                  <Wifi class="w-2.5 h-2.5" />
                  <span>Floating</span>
                </span>
                <span
                  v-if="app.deliveryConfig?.fileDownload?.enabled"
                  title="File Download"
                  class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200 text-[10px] font-semibold"
                >
                  <FileText class="w-2.5 h-2.5" />
                  <span>File</span>
                </span>
                <span
                  v-if="app.deliveryConfig?.apiAccess?.enabled"
                  title="Akses API & Token"
                  class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-semibold"
                >
                  <Zap class="w-2.5 h-2.5" />
                  <span>API</span>
                </span>
                <span
                  v-if="app.deliveryConfig?.privateNote?.enabled"
                  title="Catatan Akses Privat"
                  class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-purple-50 text-purple-800 border border-purple-200 text-[10px] font-semibold"
                >
                  <Lock class="w-2.5 h-2.5" />
                  <span>Note</span>
                </span>
                <span v-if="!app.deliveryConfig?.licenseKey?.enabled && !app.deliveryConfig?.fileDownload?.enabled && !app.deliveryConfig?.apiAccess?.enabled && !app.deliveryConfig?.privateNote?.enabled" class="text-jetblack/40 text-[10px]">
                  Standard
                </span>
              </div>
            </td>
            <td class="py-2.5 px-3">
              <span
                v-if="app.meteringConfig?.enabled"
                class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-mono font-bold"
              >
                <Sparkles class="w-2.5 h-2.5" />
                <span>{{ app.meteringConfig.name }}</span>
              </span>
              <span v-else class="text-jetblack/30 text-[10px] font-mono">—</span>
            </td>
            <td class="py-2.5 px-3">
              <button
                type="button"
                @click.stop="emit('toggle-mode', app)"
                class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold cursor-pointer hover:ring-2 hover:ring-gold/40 transition shadow-2xs active:scale-95"
                :class="app.mode === 'sandbox' ? 'bg-gold/15 text-[#8a6d1f] hover:bg-gold/25' : 'bg-forest/10 text-forest hover:bg-forest/20'"
                :title="`Klik untuk beralih ke mode ${app.mode === 'sandbox' ? 'LIVE' : 'SANDBOX'}`"
              >
                <span class="w-1.5 h-1.5 rounded-full" :class="app.mode === 'sandbox' ? 'bg-gold' : 'bg-forest'"></span>
                <span>{{ app.mode === 'sandbox' ? 'Sandbox' : 'Live' }}</span>
              </button>
            </td>
            <td class="py-2.5 px-3 font-mono text-[11px]">
              <a
                :href="`/pay/${app.slug}`"
                target="_blank"
                class="text-gold hover:underline inline-flex items-center gap-1.5"
              >
                <span>/pay/{{ app.slug }}</span>
                <span v-if="app.mode === 'sandbox'" class="text-[9px] font-sans font-semibold px-1 rounded bg-amber-500/10 text-amber-700 border border-amber-500/20">Test</span>
                <ExternalLink class="w-2.5 h-2.5" />
              </a>
            </td>
            <td class="py-2.5 pl-3 pr-3.5 sm:pr-4 md:pr-6 text-right">
              <a
                :href="`/pay/${app.slug}`"
                target="_blank"
                class="inline-flex items-center gap-1 text-[11px] font-bold text-jetblack hover:text-gold transition"
                title="Buka Halaman Kasir / Pembayaran"
              >
                <span>Buka Kasir</span>
                <ArrowUpRight class="w-3 h-3" />
              </a>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
