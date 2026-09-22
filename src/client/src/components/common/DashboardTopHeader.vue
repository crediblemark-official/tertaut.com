<script setup lang="ts">
import { computed } from 'vue'
import { Globe, Code2, LogOut, LogIn } from 'lucide-vue-next'
import { dashboardEnv } from '../../lib/environment'

const props = defineProps<{
  currentPage: { title: string; category: string }
  authUser: { name?: string; email?: string } | null | undefined
  authInitial: string
}>()

const emit = defineEmits<{ logout: [] }>()
const env = dashboardEnv
</script>

<template>
  <!-- Desktop Top Header -->
  <header class="hidden md:flex items-center justify-between px-6 py-3 border-b border-jetblack/10 bg-white/90 backdrop-blur-md shrink-0 z-20">
    <!-- Left: Page Title -->
    <div class="flex items-center gap-3">
      <h2 class="text-sm font-bold text-jetblack tracking-tight flex items-center gap-2">
        <span>{{ currentPage.title }}</span>
        <span class="px-2 py-0.5 rounded-full bg-jetblack/5 text-jetblack/60 text-[10px] font-mono font-normal">v2.2</span>
      </h2>
    </div>

    <!-- Right: Actions & Profile -->
    <div class="flex items-center gap-3">

      <!-- Environment Status Pill -->
      <div class="flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-semibold" :class="env === 'sandbox' ? 'bg-gold/15 border-gold/30 text-[#8a6d1f]' : 'bg-forest/10 border-forest/20 text-forest'" :title="env === 'sandbox' ? 'Environment Sandbox: pembayaran disimulasikan' : 'Environment Live: DANA produksi aktif'">
        <span class="w-1.5 h-1.5 rounded-full animate-pulse" :class="env === 'sandbox' ? 'bg-gold' : 'bg-forest'"></span>
        <span>{{ env === 'sandbox' ? 'Sandbox Mode' : 'MoR Live' }}</span>
      </div>

      <!-- Quick Action Buttons -->
      <div class="flex items-center gap-1 border-l border-r border-jetblack/10 px-2">
        <router-link to="/" target="_blank" class="p-1.5 rounded-md hover:bg-jetblack/5 text-jetblack/60 hover:text-jetblack transition" title="Kunjungi Beranda Publik"><Globe class="w-4 h-4" /></router-link>
        <a href="/swagger" target="_blank" class="p-1.5 rounded-md hover:bg-jetblack/5 text-jetblack/60 hover:text-jetblack transition" title="Buka Swagger API Docs"><Code2 class="w-4 h-4" /></a>
      </div>

      <!-- Profile & Auth -->
      <div class="flex items-center gap-2 pl-1">
        <div class="w-7 h-7 rounded-full bg-jetblack text-white flex items-center justify-center font-bold text-xs shadow-sm ring-2 ring-gold/40">{{ authInitial }}</div>
        <div class="hidden xl:block text-left pr-1">
          <div class="text-xs font-bold text-jetblack leading-none">{{ authUser?.name || 'Builder' }}</div>
          <div class="text-[10px] text-jetblack/50 font-medium">{{ authUser?.email || 'Belum login' }}</div>
        </div>
        <button v-if="authUser" type="button" @click="emit('logout')" class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-jetblack/15 bg-white hover:border-red-500/30 hover:bg-red-50 hover:text-red-600 text-xs font-bold text-jetblack/70 transition shadow-xs" title="Keluar dari akun (Log Out)">
          <LogOut class="w-3.5 h-3.5 text-red-500" /><span>Keluar</span>
        </button>
        <div v-else class="flex items-center gap-1.5">
          <router-link to="/login" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gold hover:bg-gold-muted text-xs font-bold text-jetblack transition shadow-xs"><LogIn class="w-3.5 h-3.5" /><span>Masuk</span></router-link>
          <button type="button" class="p-1.5 rounded-md hover:bg-red-50 text-jetblack/40 hover:text-red-600 transition" title="Reset Sesi" @click="emit('logout')"><LogOut class="w-3.5 h-3.5" /></button>
        </div>
      </div>
    </div>
  </header>
</template>
