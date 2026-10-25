<script setup lang="ts">
import { ref, watch, computed } from "vue";
import { RefreshCw, Globe, Code2, LayoutDashboard, Search } from "lucide-vue-next";

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
}>();

const emit = defineEmits<{
  refresh: [];
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
  <!-- Admin Desktop Top Header -->
  <header
    class="hidden md:flex items-center justify-between px-6 min-h-[44px] py-1.5 sm:py-0 border-b border-jetblack bg-jetblack text-white shrink-0 z-20"
  >
    <!-- Left: Page Title -->
    <div class="flex items-center gap-2 shrink-0">
      <h2 class="text-sm font-bold text-white tracking-tight flex items-center gap-2">
        <span>{{ currentNavItem.name }}</span>
        <span
          class="px-2 py-0.5 rounded-full bg-white/10 text-white text-[10px] font-mono font-normal"
          >v2.2</span
        >
      </h2>
    </div>

    <!-- Center: Page-Level Search & Filters (Teleport Target for Super Admin Panel) -->
    <div
      id="admin-header-search"
      class="flex-1 max-w-xl mx-4 flex items-center justify-start gap-2.5"
    ></div>

    <!-- Right: Status, Refresh & External Links -->
    <div class="flex items-center gap-3 shrink-0">
      <!-- Mode Pill -->
      <div
        class="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[11px] font-semibold bg-forest/30 border-forest/50 text-emerald-300"
      >
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
  <header
    class="md:hidden bg-jetblack text-white border-b border-jetblack sticky top-0 z-40 shadow-xs min-h-[44px]"
  >
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
          class="px-2.5 py-1 text-xs font-bold text-white/70 hover:text-white rounded-lg hover:bg-white/10 shrink-0 transition cursor-pointer"
        >
          Batal
        </button>
      </template>

      <template v-else>
        <router-link to="/panel" class="flex items-center gap-2 shrink-0">
          <div
            class="w-7 h-7 rounded-md bg-white/10 flex items-center justify-center font-bold text-white text-xs relative shadow-xs"
          >
            T
            <span class="absolute bottom-0.5 right-0.5 w-1 h-1 rounded-full bg-gold"></span>
          </div>
          <span class="font-extrabold text-xs tracking-tight text-white font-mono">
            tertaut<span class="text-gold">.admin</span>
          </span>
        </router-link>

        <div class="flex items-center gap-1.5 shrink-0">
          <!-- Search Trigger Icon Button (Only shown if current tab has search) -->
          <button
            v-if="hasSearch"
            type="button"
            @click="isSearchOpen = true"
            class="p-1.5 min-w-[32px] min-h-[32px] rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs flex items-center justify-center transition active:scale-95 cursor-pointer"
            title="Buka Pencarian"
          >
            <Search class="w-3.5 h-3.5 text-gold" />
          </button>

          <router-link
            to="/dashboard"
            class="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[10.5px] font-bold text-white flex items-center gap-1 transition"
          >
            <LayoutDashboard class="w-3.5 h-3.5 text-gold" />
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
      </template>
    </div>
  </header>
</template>
