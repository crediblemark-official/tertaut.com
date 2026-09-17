<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { api, type AppItem } from '../lib/api'
import { dashboardEnv, envPath } from '../lib/environment'
import { formatRupiah } from '../lib/utils'
import {
  Plus,
  X,
  ExternalLink,
  ArrowUpRight,
  Search,
  RefreshCw
} from 'lucide-vue-next'

const appsList = ref<AppItem[]>([])
const loading = ref(true)
const searchQuery = ref('')

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
    const appsRes = await api.getApps()
    appsList.value = appsRes.apps || []
  } catch (err) {
    console.error('Failed to load apps:', err)
  } finally {
    loading.value = false
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
        mode: dashboardEnv.value,
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

// Muat ulang saat environment Live/Sandbox berganti
watch(dashboardEnv, () => {
  loading.value = true
  loadData()
})
</script>

<template>
  <div class="space-y-5 animate-fadeIn">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1 border-b border-[#111111]/10">
      <div>
        <h1 class="text-base font-extrabold text-[#111111] tracking-tight">Katalog Aplikasi Builder</h1>
        <p class="text-xs text-[#111111]/60">Kelola status peluncuran, endpoint vanity slug, dan badge lisensi terverifikasi.</p>
      </div>
      <div class="flex items-center gap-2">
        <button
          @click="isCreateModalOpen = true"
          class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg btn-gold text-xs font-bold transition shadow-sm cursor-pointer active:scale-95"
        >
          <Plus class="w-3.5 h-3.5 stroke-[3]" />
          <span>Tambah Produk</span>
        </button>
        <span class="text-[10px] px-2 py-0.5 rounded-full bg-[#111111]/5 text-[#111111] font-bold">
          {{ appsList.length }} apps
        </span>
      </div>
    </div>

    <!-- Search & Environment Badge Toolbar -->
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

      <div class="flex items-center gap-2 text-xs">
        <span
          class="px-2.5 py-1 rounded-md font-bold text-[11px]"
          :class="dashboardEnv === 'sandbox' ? 'bg-[#D4AF37]/15 text-[#8a6d1f] border border-[#D4AF37]/35' : 'bg-[#0F4C3A]/10 text-[#0F4C3A] border border-[#0F4C3A]/25'"
        >
          {{ dashboardEnv === 'sandbox' ? 'Sandbox' : 'Live' }} ({{ appsList.length }})
        </span>
      </div>
    </div>

    <!-- Desktop Table -->
    <div class="hidden sm:block overflow-x-auto w-full top-scrollbar">
      <table class="w-full text-left text-xs whitespace-nowrap">
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
              <p class="text-[11px] text-[#111111]/40" v-if="searchQuery">
                Coba sesuaikan kata kunci pencarian.
              </p>
            </td>
          </tr>
          <tr v-for="app in filteredApps" :key="app.id" class="hover:bg-[#111111]/[0.02]">
            <td class="py-3 pr-3 pl-0">
              <div class="font-bold text-[#111111]">{{ app.name }}</div>
              <div class="text-[10px] text-[#111111]/50 font-mono">{{ app.id }}</div>
            </td>
            <td class="py-3 px-3">
              <span
                class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold"
                :class="app.mode === 'sandbox' ? 'bg-[#D4AF37]/15 text-[#8a6d1f] border border-[#D4AF37]/30' : 'bg-[#0F4C3A]/10 text-[#0F4C3A] border border-[#0F4C3A]/25'"
              >
                <span class="w-1.5 h-1.5 rounded-full" :class="app.mode === 'sandbox' ? 'bg-[#D4AF37]' : 'bg-[#0F4C3A]'"></span>
                <span>{{ app.mode === 'sandbox' ? 'Mode Sandbox' : 'Live Checkout' }}</span>
              </span>
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
                :to="envPath(dashboardEnv, '/checkout')"
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
      <div v-for="app in filteredApps" :key="app.id" class="py-3 space-y-2">
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
          <span
            class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold"
            :class="app.mode === 'sandbox' ? 'bg-[#D4AF37]/15 text-[#8a6d1f]' : 'bg-[#0F4C3A]/10 text-[#0F4C3A]'"
          >
            <span class="w-1.5 h-1.5 rounded-full" :class="app.mode === 'sandbox' ? 'bg-[#D4AF37]' : 'bg-[#0F4C3A]'"></span>
            <span>{{ app.mode === 'sandbox' ? 'Sandbox' : 'Live' }}</span>
          </span>

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
