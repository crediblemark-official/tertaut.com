<script setup lang="ts">
import {
  RefreshCw,
  ChevronRight,
  Globe,
  Code2,
  LayoutDashboard
} from 'lucide-vue-next'

interface AdminNavItem {
  key: string
  name: string
  icon: any
  badge?: number
  category: string
}

defineProps<{
  currentNavItem: AdminNavItem
  refreshing: boolean
}>()

const emit = defineEmits<{
  'refresh': []
}>()
</script>

<template>
  <!-- Admin Desktop Top Header -->
  <header class="hidden md:flex items-center justify-between px-6 min-h-[44px] py-1.5 sm:py-0 border-b border-[#111111] bg-[#111111] text-white shrink-0 z-20">
    <!-- Left: Breadcrumb / Category / Title -->
    <div class="flex items-center gap-3">
      <div class="flex items-center gap-1.5 text-xs text-white/50 font-medium">
        <span class="hover:text-white transition cursor-default">Super Admin</span>
        <ChevronRight class="w-3 h-3 text-white/30" />
        <span class="text-[#D4AF37] font-semibold">{{ currentNavItem.category }}</span>
        <ChevronRight class="w-3 h-3 text-white/30" />
      </div>
      <h2 class="text-sm font-bold text-white tracking-tight flex items-center gap-2">
        <span>{{ currentNavItem.name }}</span>
        <span class="px-2 py-0.5 rounded-full bg-white/10 text-white text-[10px] font-mono font-normal">v2.2</span>
      </h2>
    </div>

    <!-- Right: Status, Refresh & External Links -->
    <div class="flex items-center gap-3">
      <!-- Mode Pill -->
      <div class="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[11px] font-semibold bg-[#0F4C3A]/30 border-[#0F4C3A]/50 text-emerald-300">
        <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
        <span>Super Admin Rail</span>
      </div>

      <!-- Refresh Button -->
      <button
        @click="emit('refresh')"
        :disabled="refreshing"
        class="h-8 px-3 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold transition flex items-center gap-1.5 text-xs disabled:opacity-50 cursor-pointer shadow-xs"
      >
        <RefreshCw class="w-3.5 h-3.5" :class="{ 'animate-spin': refreshing }" />
        <span>Segarkan</span>
      </button>

      <div class="flex items-center gap-1 border-l border-white/15 pl-2">
        <router-link
          to="/"
          target="_blank"
          class="p-1.5 rounded-md hover:bg-white/10 text-white/60 hover:text-white transition"
          title="Kunjungi Beranda Publik"
        >
          <Globe class="w-4 h-4" />
        </router-link>
        <a
          href="/swagger"
          target="_blank"
          class="p-1.5 rounded-md hover:bg-white/10 text-white/60 hover:text-white transition"
          title="Buka Swagger API Docs"
        >
          <Code2 class="w-4 h-4" />
        </a>
      </div>
    </div>
  </header>

  <!-- Mobile Top Compact Bar -->
  <header class="md:hidden bg-[#111111] text-white border-b border-[#111111] sticky top-0 z-40 shadow-xs min-h-[44px]">
    <div class="flex items-center justify-between px-3.5 py-1.5">
      <router-link to="/panel" class="flex items-center gap-2">
        <div class="w-7 h-7 rounded-md bg-white/10 flex items-center justify-center font-bold text-white text-xs relative shadow-xs">
          T
          <span class="absolute bottom-0.5 right-0.5 w-1 h-1 rounded-full bg-[#D4AF37]"></span>
        </div>
        <span class="font-extrabold text-xs tracking-tight text-white font-mono">
          tertaut<span class="text-[#D4AF37]">.admin</span>
        </span>
      </router-link>

      <div class="flex items-center gap-2">
        <router-link
          to="/dashboard"
          class="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[10.5px] font-bold text-white flex items-center gap-1 transition"
        >
          <LayoutDashboard class="w-3.5 h-3.5 text-[#D4AF37]" />
          <span>Builder</span>
        </router-link>

        <button
          @click="emit('refresh')"
          :disabled="refreshing"
          class="p-1.5 min-w-[32px] min-h-[32px] rounded-lg bg-white/10 text-white text-xs flex items-center justify-center cursor-pointer transition active:scale-95"
          title="Segarkan data admin"
        >
          <RefreshCw class="w-3.5 h-3.5" :class="{ 'animate-spin': refreshing }" />
        </button>
      </div>
    </div>

    <!-- Context Sub-bar -->
    <div class="px-3.5 py-1.5 bg-[#111111]/[0.02] border-t border-[#111111]/5 flex items-center justify-between text-[11px]">
      <div class="flex items-center gap-1.5 font-medium text-[#111111]/60 truncate">
        <span class="text-[#D4AF37] font-bold">{{ currentNavItem.category }}</span>
        <span>•</span>
        <span class="text-[#111111] font-semibold truncate">{{ currentNavItem.name }}</span>
      </div>
      <span class="text-[9.5px] font-mono text-[#111111]/40 shrink-0">Super Admin</span>
    </div>
  </header>
</template>
