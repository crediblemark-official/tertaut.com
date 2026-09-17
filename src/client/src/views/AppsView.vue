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
    const data = await api.createCampaign({
      name: newAppName.value,
      slug: newAppSlug.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
      targetPrice: newAppPrice.value,
      mode: dashboardEnv.value,
      description: newAppDesc.value
    })
    if (data && (data.success || data.app)) {
      isCreateModalOpen.value = false
      newAppName.value = ''
      newAppSlug.value = ''
      newAppDesc.value = ''
      slugManuallyEdited.value = false
      await loadData()
    } else {
      createError.value = data?.error || 'Gagal membuat produk'
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
  <div class="animate-fadeIn pb-8">
    <!-- Unified Header & Toolbar (Edge-to-Edge Full Width & Standardized Height) -->
    <div class="-mx-3.5 sm:-mx-4 md:-mx-6 -mt-4 sm:-mt-5 md:-mt-6 px-3.5 sm:px-4 md:px-6 min-h-[44px] py-1.5 sm:py-0 bg-[#111111] text-white border-b border-[#111111] flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-xs mb-1">
      <div class="flex items-center gap-2">
        <h1 class="text-xs font-bold uppercase tracking-wider text-white">Katalog Aplikasi</h1>
        <span class="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white font-mono font-bold">
          {{ appsList.length }} apps
        </span>
        <span
          class="px-2 py-0.5 rounded-md font-bold text-[10px]"
          :class="dashboardEnv === 'sandbox' ? 'bg-[#D4AF37] text-[#111111]' : 'bg-[#0F4C3A] text-white'"
        >
          {{ dashboardEnv === 'sandbox' ? 'Sandbox' : 'Live' }}
        </span>
      </div>

      <div class="flex items-center gap-2">
        <div class="relative w-full sm:w-60">
          <Search class="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Cari nama atau slug..."
            class="w-full pl-8 pr-2.5 py-1 rounded-lg bg-white/10 border border-white/15 text-xs text-white placeholder:text-white/40 focus:outline-none focus:bg-white/15 focus:border-[#D4AF37] transition"
          />
        </div>

        <button
          @click="isCreateModalOpen = true"
          class="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg btn-gold text-xs font-bold transition shadow-2xs cursor-pointer active:scale-95 shrink-0"
        >
          <Plus class="w-3.5 h-3.5 stroke-[3]" />
          <span>Tambah</span>
        </button>
      </div>
    </div>

    <!-- Table View (Responsive Full-Width Table with Horizontal Scroll on Mobile) -->
    <div class="-mx-3.5 sm:-mx-4 md:-mx-6 overflow-x-auto top-scrollbar">
      <table class="w-full min-w-full text-left text-xs whitespace-nowrap border-b border-[#111111]/15">
        <thead class="border-b border-[#111111]/20 text-xs font-semibold text-[#111111]/70 bg-white">
          <tr>
            <th class="py-2.5 pr-3 pl-3.5 sm:pl-4 md:pl-6">Nama Produk</th>
            <th class="py-2.5 px-3">App ID</th>
            <th class="py-2.5 px-3">Status Mode</th>
            <th class="py-2.5 px-3">Target Harga</th>
            <th class="py-2.5 px-3">Launch Link</th>
            <th class="py-2.5 px-3">Badge</th>
            <th class="py-2.5 pl-3 pr-3.5 sm:pr-4 md:pr-6 text-right">Aksi</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-[#111111]/15">
          <tr v-if="filteredApps.length === 0">
            <td colspan="7" class="py-8 px-3.5 sm:px-4 md:px-6 text-center text-[#111111]/40">
              <p class="font-semibold text-xs text-[#111111]/60">Tidak ada aplikasi ditemukan.</p>
              <p class="text-[11px] text-[#111111]/40" v-if="searchQuery">
                Coba sesuaikan kata kunci pencarian.
              </p>
            </td>
          </tr>
          <tr v-for="app in filteredApps" :key="app.id" class="hover:bg-[#111111]/[0.02]">
            <td class="py-2.5 pr-3 pl-3.5 sm:pl-4 md:pl-6 font-bold text-[#111111] leading-tight">
              {{ app.name }}
            </td>
            <td class="py-2.5 px-3 font-mono text-[11px] text-[#111111]/60">
              {{ app.id }}
            </td>
            <td class="py-2.5 px-3">
              <span
                class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
                :class="app.mode === 'sandbox' ? 'bg-[#D4AF37]/15 text-[#8a6d1f]' : 'bg-[#0F4C3A]/10 text-[#0F4C3A]'"
              >
                <span class="w-1.5 h-1.5 rounded-full" :class="app.mode === 'sandbox' ? 'bg-[#D4AF37]' : 'bg-[#0F4C3A]'"></span>
                <span>{{ app.mode === 'sandbox' ? 'Sandbox' : 'Live' }}</span>
              </span>
            </td>
            <td class="py-2.5 px-3 font-mono font-bold text-[#111111]">
              {{ formatRupiah(app.targetPrice) }}
            </td>
            <td class="py-2.5 px-3 font-mono text-[11px]">
              <a
                :href="`/pay/${app.slug}`"
                target="_blank"
                class="text-[#D4AF37] hover:underline inline-flex items-center gap-1"
              >
                <span>/pay/{{ app.slug }}</span>
                <ExternalLink class="w-2.5 h-2.5" />
              </a>
            </td>
            <td class="py-2.5 px-3">
              <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#111111]/5 text-[#111111]/80 text-[10px] font-mono">
                tertaut-verified
              </span>
            </td>
            <td class="py-2.5 pl-3 pr-3.5 sm:pr-4 md:pr-6 text-right">
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
