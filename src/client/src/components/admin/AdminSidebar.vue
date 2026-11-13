<script setup lang="ts">
import logoUrl from "@/assets/logo.svg";
import {
  ShieldAlert,
  LayoutDashboard,
  Globe,
  Code2,
  ExternalLink,
  ChevronRight,
} from "lucide-vue-next";

import { computed } from "vue";

interface AdminNavItem {
  key: string;
  name: string;
  icon: any;
  badge?: number;
  category: string;
}

const props = defineProps<{
  activeTab: string;
  adminNavItems: AdminNavItem[];
}>();

const emit = defineEmits<{
  "update:activeTab": [tab: string];
}>();

const categorizedNav = computed(() => {
  const groups: { name: string; items: AdminNavItem[] }[] = [];
  for (const item of props.adminNavItems) {
    let g = groups.find((x) => x.name === item.category);
    if (!g) {
      g = { name: item.category, items: [] };
      groups.push(g);
    }
    g.items.push(item);
  }
  return groups;
});
</script>

<template>
  <aside
    class="hidden md:flex w-56 flex-col justify-between border-r border-jetblack/10 bg-white sticky top-0 h-screen shrink-0 z-30"
  >
    <div class="flex-1 flex flex-col min-h-0">
      <!-- Brand Header (Docked Edge-to-Edge) -->
      <router-link
        to="/panel"
        class="flex items-center gap-2.5 px-4 py-3.5 border-b border-jetblack/10 group shrink-0"
      >
        <img
          :src="logoUrl"
          alt="tertaut.com"
          class="w-7 h-7 rounded-md group-hover:scale-105 transition shrink-0"
        />
        <div class="min-w-0">
          <div
            class="font-extrabold text-sm tracking-tight text-jetblack flex items-center gap-0.5 font-mono"
          >
            tertaut<span class="text-gold">.com</span>
          </div>
          <div
            class="text-[10px] text-jetblack/50 font-medium leading-tight flex items-center gap-1"
          >
            <ShieldAlert class="w-3 h-3 text-gold shrink-0" />
            <span>Admin Console</span>
          </div>
        </div>
      </router-link>

      <!-- Access Scope Hairline Strip -->
      <div
        class="flex items-center justify-between px-4 py-2 border-b border-jetblack/10 bg-jetblack/[0.02] text-xs shrink-0"
      >
        <span class="text-[9.5px] font-bold uppercase tracking-wider text-jetblack/50"
          >Hak Akses</span
        >
        <span class="text-[10px] font-mono font-bold text-[#8a6d1f] uppercase tracking-wider">
          Super Admin
        </span>
      </div>

      <!-- Navigation Menu (Grouped with Hairline Dividers) -->
      <nav class="flex-1 overflow-y-auto divide-y divide-jetblack/10 select-none">
        <div v-for="group in categorizedNav" :key="group.name" class="py-2">
          <div class="text-[9.5px] font-bold uppercase tracking-wider text-jetblack/45 px-4 py-1.5">
            {{ group.name }}
          </div>
          <button
            v-for="item in group.items"
            :key="item.key"
            @click="emit('update:activeTab', item.key)"
            type="button"
            :class="[
              'w-full flex items-center justify-between px-4 py-2 text-xs font-semibold border-l-[3px] transition-colors duration-150 cursor-pointer focus-visible:outline-2 focus-visible:outline-gold',
              activeTab === item.key
                ? 'bg-jetblack text-white border-l-gold font-bold'
                : 'border-l-transparent text-jetblack/75 hover:text-jetblack hover:bg-jetblack/[0.03]',
            ]"
          >
            <div class="flex items-center gap-2.5 min-w-0">
              <component
                :is="item.icon"
                class="w-3.5 h-3.5 shrink-0"
                :class="activeTab === item.key ? 'text-gold' : 'text-jetblack/55'"
              />
              <span class="truncate">{{ item.name }}</span>
            </div>
            <span
              v-if="item.badge !== undefined"
              :class="[
                'px-1.5 py-0.2 rounded-xs text-[9.5px] font-mono tracking-wider font-bold shrink-0',
                activeTab === item.key ? 'bg-gold text-jetblack' : 'bg-jetblack/5 text-jetblack/65',
              ]"
            >
              {{ item.badge }}
            </span>
          </button>
        </div>
      </nav>
    </div>

    <!-- Bottom Docked Links (Hairline Grid) -->
    <div class="border-t border-jetblack/10 divide-y divide-jetblack/10 shrink-0">
      <router-link
        to="/dashboard"
        class="flex items-center justify-between px-4 py-2.5 hover:bg-jetblack/[0.03] text-xs font-semibold text-jetblack transition"
      >
        <div class="flex items-center gap-2">
          <LayoutDashboard class="w-3.5 h-3.5 text-gold" />
          <span>Builder Dashboard</span>
        </div>
        <ChevronRight class="w-3 h-3 text-jetblack/40" />
      </router-link>

      <div class="grid grid-cols-2 divide-x divide-jetblack/10">
        <router-link
          to="/"
          target="_blank"
          class="flex items-center justify-center gap-1.5 px-2 py-2.5 hover:bg-jetblack/[0.03] text-[11px] font-semibold text-jetblack/70 hover:text-jetblack transition"
          title="Beranda Publik"
        >
          <Globe class="w-3.5 h-3.5 text-gold shrink-0" />
          <span>Beranda</span>
          <ExternalLink class="w-2.5 h-2.5 text-jetblack/35 shrink-0" />
        </router-link>
        <a
          href="/swagger"
          target="_blank"
          class="flex items-center justify-center gap-1.5 px-2 py-2.5 hover:bg-jetblack/[0.03] text-[11px] font-semibold text-jetblack/70 hover:text-jetblack transition"
          title="API Playground (Swagger)"
        >
          <Code2 class="w-3.5 h-3.5 text-gold shrink-0" />
          <span>API Spec</span>
          <ExternalLink class="w-2.5 h-2.5 text-jetblack/35 shrink-0" />
        </a>
      </div>
    </div>
  </aside>
</template>
