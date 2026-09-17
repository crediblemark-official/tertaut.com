<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { api, type DashboardStats } from '../lib/api'
import { dashboardEnv, envPath } from '../lib/environment'
import { formatRupiah } from '../lib/utils'
import {
  DollarSign,
  KeyRound,
  TrendingUp,
  Zap,
  Boxes
} from 'lucide-vue-next'

const stats = ref<DashboardStats | null>(null)
const loading = ref(true)

async function loadData() {
  try {
    stats.value = await api.getStats()
  } catch (err) {
    console.error('Failed to load dashboard stats:', err)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadData()
})

// Muat ulang saat environment Live/Sandbox berganti
watch(dashboardEnv, () => {
  loading.value = true
  loadData()
})
</script>

<template>
  <div class="space-y-5 animate-fadeIn">
    <!-- Top Action Strip -->
    <div class="flex items-center justify-between gap-3 pb-1 border-b border-[#111111]/10">
      <h1 class="text-base font-extrabold text-[#111111]">Ringkasan Bisnis</h1>

      <router-link
        :to="envPath(dashboardEnv, '/apps')"
        class="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg btn-gold text-xs font-bold transition shadow-gold-glow active:scale-95 cursor-pointer"
      >
        <Boxes class="w-3.5 h-3.5 stroke-[3]" />
        <span>Kelola Aplikasi</span>
      </router-link>
    </div>

    <!-- Overview Stats (Full Width with Horizontal & Vertical Dividers, Flush Left and Right) -->
    <div class="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-[#111111]/10 border-b border-[#111111]/10 pb-6 pt-1">
      <div class="py-2 pr-4 pl-0 space-y-1">
        <div class="flex items-center justify-between text-[#111111]/50 text-xs font-semibold">
          <span>Gross Volume (MoR)</span>
          <DollarSign class="w-4 h-4 text-[#111111]" />
        </div>
        <div class="text-2xl font-black text-[#111111] font-mono">
          {{ formatRupiah(stats?.totalGMV || 0) }}
        </div>
        <div class="text-[11px] text-[#111111]/50">
          Sebelum potongan flat fee 5%
        </div>
      </div>

      <div class="py-2 px-4 space-y-1">
        <div class="flex items-center justify-between text-[#111111]/50 text-xs font-semibold">
          <span>Net Builder Payout (95%)</span>
          <TrendingUp class="w-4 h-4 text-[#0F4C3A]" />
        </div>
        <div class="text-2xl font-black text-[#0F4C3A] font-mono">
          {{ formatRupiah(stats?.netEarnings || 0) }}
        </div>
        <div class="text-[11px] text-[#0F4C3A] font-medium flex items-center gap-1">
          <span>Pencairan otomatis ke rekening</span>
        </div>
      </div>

      <div class="py-2 px-4 space-y-1">
        <div class="flex items-center justify-between text-[#111111]/50 text-xs font-semibold">
          <span>Lisensi Aktif Terbit</span>
          <KeyRound class="w-4 h-4 text-[#D4AF37]" />
        </div>
        <div class="text-2xl font-black text-[#111111] font-mono">
          {{ stats?.activeLicenses || 0 }}
        </div>
        <div class="text-[11px] text-[#111111]/50">
          Hardware bound &amp; Multi-platform
        </div>
      </div>

      <div class="py-2 pl-4 pr-0 space-y-1">
        <div class="flex items-center justify-between text-[#111111]/50 text-xs font-semibold">
          <span>Total Transaksi</span>
          <Zap class="w-4 h-4 text-[#D4AF37]" />
        </div>
        <div class="text-2xl font-black text-[#111111] font-mono">
          {{ stats?.totalTransactions || 0 }}
        </div>
        <div class="text-[11px] text-[#111111]/50">
          Seluruh pembayaran tervalidasi
        </div>
      </div>
    </div>
  </div>
</template>