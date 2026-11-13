<script setup lang="ts">
import { ref, watch, computed } from "vue";
import logoUrl from "@/assets/logo.svg";
import { RefreshCw, Globe, Code2, LayoutDashboard, Search, LogOut } from "lucide-vue-next";

interface AdminNavItem {
  key: string;
  name: string;
  icon: any;
  badge?: number;
  category: string;
}

const props = defineProps<{
  currentNavItem: AdminNavItem;
  refreshing: boolean;
  adminName: string;
  adminEmail: string;
  adminInitial: string;
}>();

const emit = defineEmits<{
  refresh: [];
  logout: [];
}>();

const isSearchOpen = ref(false);

const SEARCHABLE_ADMIN_TABS = [
  "apps",
  "builders",
  "licenses",
  "ledger",
  "coupons",
  "users",
  "audit",
];
const hasSearch = computed(() => SEARCHABLE_ADMIN_TABS.includes(props.currentNavItem.key));
const isSearchActive = computed(() => isSearchOpen.value && hasSearch.value);

watch(
  () => props.currentNavItem.key,
  () => {
    isSearchOpen.value = false;
  }
);
</script>

<template>
  <!-- Admin Desktop Top Header (Aligned with DashboardTopHeader) -->
  <header
    class="hidden md:flex items-center justify-between px-6 py-3 border-b border-jetblack/10 bg-white/90 backdrop-blur-md shrink-0 z-20"
  >
    <!-- Left: Page Title -->
    <div class="flex items-center gap-3 shrink-0">
      <h2 class="text-sm font-bold text-jetblack tracking-tight flex items-center gap-2">
        <span>{{ currentNavItem.name }}</span>
        <span
          class="px-2 py-0.5 rounded-full bg-jetblack/5 text-jetblack/60 text-[10px] font-mono font-normal"
          >v2.3</span
        >
      </h2>
    </div>

    <!-- Center: Page-Level Search & Filters (Teleport Target for Super Admin Panel) -->
    <div
      id="admin-header-search"
      class="flex-1 max-w-2xl mx-4 flex items-center justify-start gap-2.5"
    ></div>

    <!-- Right: Status, Refresh & External Links -->
    <div class="flex items-center gap-3 shrink-0">
      <!-- Mode Pill -->
      <div
        class="flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-semibold bg-forest/10 border-forest/20 text-forest"
      >
        <span class="w-1.5 h-1.5 rounded-full bg-forest animate-pulse"></span>
        <span>Super Admin Rail</span>
      </div>

      <!-- Quick Links -->
      <div class="flex items-center gap-1 border-l border-r border-jetblack/10 px-2">
        <router-link
          to="/"
          target="_blank"
          class="p-1.5 rounded-md hover:bg-jetblack/5 text-jetblack/60 hover:text-jetblack transition"
          title="Kunjungi Beranda Publik"
        >
          <Globe class="w-4 h-4" />
        </router-link>
        <a
          href="/swagger"
          target="_blank"
          class="p-1.5 rounded-md hover:bg-jetblack/5 text-jetblack/60 hover:text-jetblack transition"
          title="Buka Swagger API Docs"
        >
          <Code2 class="w-4 h-4" />
        </a>
      </div>

      <!-- Refresh Button -->
      <button
        type="button"
        @click="emit('refresh')"
        :disabled="refreshing"
        class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-jetblack/15 bg-white hover:bg-jetblack/[0.03] text-xs font-bold text-jetblack/80 transition shadow-2xs disabled:opacity-50 cursor-pointer"
      >
        <RefreshCw class="w-3.5 h-3.5 text-gold" :class="{ 'animate-spin': refreshing }" />
        <span>Segarkan</span>
      </button>

      <!-- Admin Profile & Logout -->
      <div class="flex items-center gap-2 pl-2 border-l border-jetblack/10">
        <div class="flex items-center gap-2">
          <div
            class="w-7 h-7 rounded-full bg-jetblack text-white flex items-center justify-center font-bold text-xs shadow-sm ring-2 ring-gold/40 shrink-0"
          >
            {{ adminInitial }}
          </div>
          <div class="hidden xl:block text-left pr-0.5 max-w-[170px]">
            <div class="text-xs font-bold leading-none text-jetblack truncate">{{ adminName }}</div>
            <div class="text-[10px] font-medium mt-0.5 text-jetblack/50 truncate">
              {{ adminEmail }}
            </div>
          </div>
        </div>
        <button
          type="button"
          @click="emit('logout')"
          class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-jetblack/15 bg-white hover:border-red-500/30 hover:bg-red-50 hover:text-red-600 text-xs font-bold text-jetblack/70 transition shadow-xs cursor-pointer"
          title="Keluar dari sesi admin"
          aria-label="Keluar dari sesi admin"
        >
          <LogOut class="w-3.5 h-3.5 text-red-500" /><span>Keluar</span>
        </button>
      </div>
    </div>
  </header>

  <!-- Mobile Top Compact Bar (Aligned with MobileNav) -->
  <header class="md:hidden bg-white border-b border-jetblack/10 sticky top-0 z-40 shadow-xs">
    <div class="flex items-center justify-between px-3.5 py-1.5 min-h-[44px] gap-2">
      <!-- Search Input Container for Admin Mobile -->
      <div
        id="admin-mobile-header-search"
        :class="isSearchActive ? 'flex-1 min-w-0' : 'hidden'"
      ></div>

      <template v-if="isSearchActive">
        <button
          type="button"
          @click="isSearchOpen = false"
          class="px-2.5 py-1 text-xs font-bold text-jetblack/70 hover:text-jetblack rounded-lg hover:bg-jetblack/5 shrink-0 transition cursor-pointer"
        >
          Batal
        </button>
      </template>

      <template v-else>
        <router-link to="/panel" class="flex items-center gap-1.5 shrink-0">
          <img :src="logoUrl" alt="tertaut.com" class="w-6 h-6 rounded-md shadow-xs shrink-0" />
          <span class="font-extrabold text-xs tracking-tight text-jetblack font-mono">
            tertaut<span class="text-gold">.admin</span>
          </span>
        </router-link>

        <div class="flex items-center gap-1.5 shrink-0">
          <!-- Search Trigger Icon Button (Only shown if current tab has search) -->
          <button
            v-if="hasSearch"
            type="button"
            @click="isSearchOpen = true"
            class="p-1.5 min-w-[32px] min-h-[32px] rounded-lg bg-jetblack/5 hover:bg-jetblack/10 text-jetblack/70 hover:text-jetblack text-xs flex items-center justify-center transition active:scale-95 cursor-pointer"
            title="Buka Pencarian"
          >
            <Search class="w-3.5 h-3.5" />
          </button>

          <router-link
            to="/dashboard"
            class="px-2 py-1 min-h-[30px] rounded-lg border border-jetblack/15 bg-white hover:bg-jetblack/5 text-[10.5px] font-bold text-jetblack flex items-center gap-1 transition"
          >
            <LayoutDashboard class="w-3.5 h-3.5 text-gold" />
            <span>Builder</span>
          </router-link>

          <button
            type="button"
            @click="emit('refresh')"
            :disabled="refreshing"
            class="p-1.5 min-w-[32px] min-h-[32px] rounded-lg bg-jetblack/5 hover:bg-jetblack/10 text-jetblack/70 text-xs flex items-center justify-center cursor-pointer transition active:scale-95"
            title="Segarkan data admin"
          >
            <RefreshCw class="w-3.5 h-3.5" :class="{ 'animate-spin': refreshing }" />
          </button>

          <button
            type="button"
            @click="emit('logout')"
            class="p-1.5 min-w-[32px] min-h-[32px] rounded-lg border border-jetblack/15 bg-white hover:bg-red-50 text-red-500 text-xs flex items-center justify-center cursor-pointer transition active:scale-95"
            title="Keluar dari sesi admin"
            aria-label="Keluar dari sesi admin"
          >
            <LogOut class="w-3.5 h-3.5" />
          </button>
        </div>
      </template>
    </div>
  </header>
</template>
