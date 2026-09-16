<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { api, type DashboardStats, type AppItem } from '../lib/api'
import { formatRupiah } from '../lib/utils'
import {
  DollarSign,
  KeyRound,
  TrendingUp,
  ExternalLink,
  Zap,
  Plus,
  X,
  Sparkles,
  ArrowUpRight,
  Search,
  RefreshCw
} from 'lucide-vue-next'

const stats = ref<DashboardStats | null>(null)
const appsList = ref<AppItem[]>([])
const loading = ref(true)
const searchQuery = ref('')
const modeFilter = ref<'ALL' | 'live'>('ALL')

// Modal create app
const isCreateModalOpen = ref(false)
const newAppName = ref('')
const newAppSlug = ref('')
const slugManuallyEdited = ref(false)
const newAppPrice = ref(49000)
const newAppDesc = ref('')
const isCreating = ref(false)
const createError = ref<string | null>(null)

watch(newAppName, (val) => {
  if (!slugManuallyEdited.value) {
    newAppSlug.value = val.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  }
})

const filteredApps = computed(() => {
  return appsList.value.filter(app => {
    if (modeFilter.value === 'live' && app.mode !== 'live') return false
    if (searchQuery.value.trim()) {
      const q = searchQuery.value.toLowerCase().trim()
      const matchName = app.name.toLowerCase().includes(q)
      const matchSlug = app.slug.toLowerCase().includes(q)
      if (!matchName && !matchSlug) return false
    }
    return true
  })
})

async function loadData() {
  try {
    const [statsRes, appsRes] = await Promise.all([
      api.getStats(),
      api.getApps()
    ])
    stats.value = statsRes
    appsList.value = appsRes.apps
  } catch (err) {
    console.error('Failed to load dashboard data:', err)
  } finally {
    loading.value = false
  }
}

async function toggleAppMode(app: AppItem) {
  const nextMode = app.mode === 'live' ? 'archived' : 'live'
  try {
    const res = await fetch(`/api/v1/apps/${app.id}/mode`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: nextMode })
    })
    const data = await res.json()
    await loadData()
  } catch (e) {
    console.error('Failed to toggle mode:', e)
  }
}

async function createApp() {
  if (!newAppName.value || !newAppSlug.value) return
  isCreating.value = true
  createError.value = null
  try {
    const res = await fetch('/api/v1/apps', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newAppName.value,
        slug: newAppSlug.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
        targetPrice: newAppPrice.value,
        mode: 'live',
        description: newAppDesc.value
      })
    })
    const data = await res.json()
    if (res.ok && (data.success || data.app)) {
      isCreateModalOpen.value = false
      newAppName.value = ''
      newAppSlug.value = ''
      newAppDesc.value = ''
      slugManuallyEdited.value = false
      await loadData()
    } else {
      createError.value = data.error || 'Gagal membuat produk'
    }
  } catch (err: any) {
    createError.value = err.message || 'Terjadi kesalahan jaringan'
  } finally {
    isCreating.value = false
  }
}

onMounted(() => {
  loadData()
})
</script>

<template>
  <div class="space-y-5 animate-fadeIn">
    <!-- Compact Top Action Strip -->
    <div class="flex items-center justify-between gap-3 pb-1">
      <div class="flex items-center gap-2">
        <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#D4AF37]/15 border border-[#D4AF37]/35 text-[#111111] text-xs font-bold">
          <Sparkles class="w-3.5 h-3.5 text-[#D4AF37]" />
          <span>MoR Engine Active</span>
        </span>
        <span class="text-xs text-[#111111]/50 font-medium hidden sm:inline">
          5% Platform Fee • Automated Payout • Zero PT/CV
        </span>
      </div>

      <button
        @click="isCreateModalOpen = true"
        class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg btn-gold text-xs font-bold transition shadow-gold-glow active:scale-95 cursor-pointer"
      >
        <Plus class="w-3.5 h-3.5 stroke-[3]" />
        <span>Tambah Produk</span>
      </button>
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

    <!-- Developer Applications Ledger (Full Width, Frameless, Flush Left and Right) -->
    <div class="w-full space-y-3 pt-1">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 class="text-sm font-bold text-[#111111]">Katalog Aplikasi Builder</h2>
          <p class="text-xs text-[#111111]/60">Kelola status peluncuran, endpoint vanity slug, dan badge lisensi terverifikasi.</p>
        </div>
        <div class="flex items-center gap-2">
          <button
            @click="isCreateModalOpen = true"
            class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg btn-gold text-xs font-bold transition shadow-sm cursor-pointer"
          >
            <Plus class="w-3.5 h-3.5 stroke-[3]" />
            <span>Tambah Produk</span>
          </button>
          <span class="text-[10px] px-2 py-0.5 rounded-full bg-[#111111]/5 text-[#111111] font-bold">
            {{ appsList.length }} apps
          </span>
        </div>
      </div>

      <!-- Search & Filters Toolbar (Flush Left and Right) -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#111111]/10">
        <div class="relative flex-1 max-w-sm">
          <Search class="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#111111]/40" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Cari nama atau slug aplikasi..."
            class="w-full pl-8 pr-3 py-1.5 rounded-lg bg-[#111111]/5 border border-[#111111]/10 text-xs text-[#111111] placeholder:text-[#111111]/40 focus:outline-none focus:bg-white focus:border-[#D4AF37] transition"
          />
        </div>

        <div class="flex items-center gap-1 text-xs">
          <button
            @click="modeFilter = 'ALL'"
            :class="['px-2.5 py-1 rounded-md font-semibold transition cursor-pointer text-[11px]', modeFilter === 'ALL' ? 'bg-[#111111] text-white shadow-xs' : 'bg-[#111111]/5 text-[#111111]/70 hover:bg-[#111111]/10']"
          >
            Semua ({{ appsList.length }})
          </button>
          <button
            @click="modeFilter = 'live'"
            :class="['px-2.5 py-1 rounded-md font-semibold transition cursor-pointer text-[11px]', modeFilter === 'live' ? 'bg-[#0F4C3A] text-white shadow-xs' : 'bg-[#0F4C3A]/10 text-[#0F4C3A] hover:bg-[#0F4C3A]/20']"
          >
            Live Checkout ({{ appsList.filter(a => a.mode === 'live').length }})
          </button>
        </div>
      </div>

      <!-- Desktop Table (Flush Left and Right) -->
      <div class="hidden sm:block overflow-x-auto w-full">
        <table class="w-full text-left text-xs">
          <thead class="border-b border-[#111111]/10 text-[#111111]/60 font-bold uppercase text-[10px]">
            <tr>
              <th class="py-2.5 pr-3 pl-0">Nama Produk</th>
              <th class="py-2.5 px-3">Status Mode</th>
              <th class="py-2.5 px-3">Target Harga</th>
              <th class="py-2.5 px-3">Launch Link</th>
              <th class="py-2.5 px-3">Badge</th>
              <th class="py-2.5 pl-3 pr-0 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-[#111111]/5">
            <tr v-if="filteredApps.length === 0">
              <td colspan="6" class="py-8 text-center text-[#111111]/40">
                <p class="font-semibold text-xs text-[#111111]/60">Tidak ada aplikasi ditemukan.</p>
                <p class="text-[11px] text-[#111111]/40" v-if="searchQuery || modeFilter !== 'ALL'">
                  Coba sesuaikan kata kunci pencarian atau reset filter status.
                </p>
              </td>
            </tr>
            <tr v-for="app in filteredApps" :key="app.id" class="hover:bg-[#111111]/[0.02]">
              <td class="py-3 pr-3 pl-0">
                <div class="font-bold text-[#111111]">{{ app.name }}</div>
                <div class="text-[10px] text-[#111111]/50 font-mono">{{ app.id }}</div>
              </td>
              <td class="py-3 px-3">
                <button
                  @click="toggleAppMode(app)"
                  class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold transition cursor-pointer"
                  :class="app.mode === 'archived' ? 'bg-[#D4AF37]/15 text-[#997300] border border-[#D4AF37]/35' : 'bg-[#0F4C3A]/10 text-[#0F4C3A] border border-[#0F4C3A]/25'"
                  title="Klik untuk beralih live / arsip"
                >
                  <span class="w-1.5 h-1.5 rounded-full" :class="app.mode === 'archived' ? 'bg-[#D4AF37]' : 'bg-[#0F4C3A]'"></span>
                  <span>{{ app.mode === 'archived' ? 'Diarsipkan' : 'Live Checkout' }}</span>
                </button>
              </td>
              <td class="py-3 px-3 font-mono font-bold text-[#111111]">
                {{ formatRupiah(app.targetPrice) }}
              </td>
              <td class="py-3 px-3">
                <router-link
                  :to="`/pay/${app.slug}`"
                  target="_blank"
                  class="inline-flex items-center gap-1 text-[11px] font-mono text-[#D4AF37] hover:underline font-bold"
                >
                  /pay/{{ app.slug }}
                  <ExternalLink class="w-3 h-3" />
                </router-link>
              </td>
              <td class="py-3 px-3">
                <a :href="`/badge/${app.slug}.svg`" target="_blank">
                  <img :src="`/badge/${app.slug}.svg`" :alt="app.name" class="h-5" />
                </a>
              </td>
              <td class="py-3 pl-3 pr-0 text-right">
                <router-link
                  to="/dashboard/checkout"
                  class="inline-flex items-center gap-1 text-[11px] font-bold text-[#111111] hover:text-[#D4AF37] transition"
                >
                  Kelola
                  <ArrowUpRight class="w-3 h-3" />
                </router-link>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Mobile Cards View -->
      <div class="sm:hidden divide-y divide-[#111111]/10">
        <div v-for="app in appsList" :key="app.id" class="py-3 space-y-2">
          <div class="flex items-start justify-between">
            <div>
              <div class="font-bold text-xs text-[#111111]">{{ app.name }}</div>
              <div class="text-[10px] text-[#111111]/50 font-mono">{{ app.id }}</div>
            </div>
            <div class="font-mono font-extrabold text-xs text-[#111111]">
              {{ formatRupiah(app.targetPrice) }}
            </div>
          </div>

          <div class="flex items-center justify-between pt-1">
            <button
              @click="toggleAppMode(app)"
              class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold"
              :class="app.mode === 'archived' ? 'bg-[#D4AF37]/15 text-[#997300]' : 'bg-[#0F4C3A]/10 text-[#0F4C3A]'"
            >
              <span class="w-1.5 h-1.5 rounded-full" :class="app.mode === 'archived' ? 'bg-[#D4AF37]' : 'bg-[#0F4C3A]'"></span>
              <span>{{ app.mode === 'archived' ? 'Arsip' : 'Live' }}</span>
            </button>

            <router-link
              :to="`/pay/${app.slug}`"
              target="_blank"
              class="text-[11px] text-[#D4AF37] font-bold inline-flex items-center gap-1"
            >
              Buka Halaman
              <ExternalLink class="w-3 h-3" />
            </router-link>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal Tambah Aplikasi -->
    <div v-if="isCreateModalOpen" class="fixed inset-0 bg-[#111111]/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
      <div class="bg-[#FFFFFF] border border-[#111111]/15 rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-luxury-hover">
        <div class="flex items-center justify-between pb-2 border-b border-[#111111]/10">
          <div class="flex items-center gap-2">
            <div class="w-2 h-2 rounded-full bg-[#D4AF37]"></div>
            <h3 class="text-sm font-extrabold text-[#111111]">Daftarkan Produk Baru</h3>
          </div>
          <button @click="isCreateModalOpen = false" class="text-[#111111]/40 hover:text-[#111111]">
            <X class="w-4 h-4" />
          </button>
        </div>

        <div v-if="createError" class="p-2.5 rounded-lg bg-[#8B0000]/10 border border-[#8B0000]/30 text-[#8B0000] text-xs font-bold animate-fadeIn">
          {{ createError }}
        </div>

        <div class="space-y-3 text-xs">
          <div>
            <label class="block font-bold text-[#111111]/70 mb-1">Nama Produk</label>
            <input
              v-model="newAppName"
              placeholder="e.g. AI SEO Copilot"
              class="w-full bg-[#FFFFFF] border border-[#111111]/15 rounded-lg p-2 text-[#111111] focus:outline-none focus:border-[#D4AF37]"
            />
          </div>

          <div>
            <div class="flex items-center justify-between mb-1">
              <label class="font-bold text-[#111111]/70">Slug URL (/pay/:slug)</label>
              <span class="text-[10px] text-[#111111]/40 font-mono">auto-sync</span>
            </div>
            <input
              v-model="newAppSlug"
              @input="slugManuallyEdited = true"
              placeholder="ai-seo-copilot"
              class="w-full bg-[#FFFFFF] border border-[#111111]/15 rounded-lg p-2 font-mono text-[#D4AF37] font-bold focus:outline-none focus:border-[#D4AF37]"
            />
          </div>

          <div>
            <div class="flex items-center justify-between mb-1">
              <label class="font-bold text-[#111111]/70">Target Harga (IDR)</label>
              <span class="text-[11px] text-[#0F4C3A] font-mono font-bold">{{ formatRupiah(newAppPrice || 0) }}</span>
            </div>
            <input
              v-model.number="newAppPrice"
              type="number"
              step="1000"
              class="w-full bg-[#FFFFFF] border border-[#111111]/15 rounded-lg p-2 font-mono text-[#111111] focus:outline-none focus:border-[#D4AF37]"
            />
          </div>

          <div>
            <label class="block font-bold text-[#111111]/70 mb-1">Deskripsi Singkat</label>
            <textarea
              v-model="newAppDesc"
              rows="2"
              placeholder="Deskripsi singkat produk atau solusi..."
              class="w-full bg-[#FFFFFF] border border-[#111111]/15 rounded-lg p-2 text-[#111111] focus:outline-none focus:border-[#D4AF37]"
            ></textarea>
          </div>
        </div>

        <div class="pt-2 flex gap-2">
          <button
            @click="isCreateModalOpen = false"
            class="flex-1 py-2 rounded-lg bg-[#111111]/5 hover:bg-[#111111]/10 text-[#111111] text-xs font-bold transition cursor-pointer"
          >
            Batal
          </button>
          <button
            @click="createApp"
            :disabled="isCreating || !newAppName || !newAppSlug"
            class="flex-1 py-2 rounded-lg btn-gold text-xs font-bold transition shadow-sm disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1"
          >
            <RefreshCw v-if="isCreating" class="w-3.5 h-3.5 animate-spin" />
            <span>{{ isCreating ? 'Menyimpan...' : 'Simpan Produk' }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
