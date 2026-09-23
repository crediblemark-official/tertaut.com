<script setup lang="ts">
import {
  ShieldAlert,
  LayoutDashboard,
  Globe,
  ExternalLink,
  ChevronRight,
  LogOut,
} from "lucide-vue-next";

interface AdminNavItem {
  key: string;
  name: string;
  icon: any;
  badge?: number;
  category: string;
}

defineProps<{
  activeTab: string;
  adminNavItems: AdminNavItem[];
  adminName: string;
  adminEmail: string;
  adminInitial: string;
}>();

const emit = defineEmits<{
  "update:activeTab": [tab: string];
  logout: [];
}>();
</script>

<template>
  <aside
    class="hidden md:flex w-56 flex-col justify-between p-4 border-r border-jetblack/10 bg-white sticky top-0 h-screen shrink-0 z-30"
  >
    <div class="space-y-5">
      <!-- Brand Header with Super Admin Tag -->
      <router-link to="/panel" class="flex items-center gap-2.5 px-2 py-1 group">
        <img
          src="/logo.svg"
          alt="tertaut.com"
          class="w-8 h-8 rounded-lg shadow-md group-hover:scale-105 transition shrink-0"
        />
        <div>
          <div
            class="font-extrabold text-sm tracking-tight text-jetblack flex items-center gap-0.5 font-mono"
          >
            tertaut<span class="text-gold">.com</span>
          </div>
          <div class="text-[10px] text-jetblack/50 font-medium flex items-center gap-1">
            <ShieldAlert class="w-3 h-3 text-gold" />
            <span>Admin Console</span>
          </div>
        </div>
      </router-link>

      <!-- Access Scope Pill -->
      <div
        class="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-jetblack/5 border border-jetblack/10 text-xs"
      >
        <span class="text-[10px] font-bold uppercase tracking-wider text-jetblack/60"
          >Hak Akses</span
        >
        <span
          class="px-2 py-0.5 rounded-md bg-gold/20 text-[#8a6d1f] text-[10px] font-bold border border-gold/30"
        >
          Super Admin
        </span>
      </div>

      <!-- Dedicated Navigation Menu -->
      <nav class="space-y-1">
        <button
          v-for="item in adminNavItems"
          :key="item.key"
          @click="emit('update:activeTab', item.key)"
          type="button"
          :class="[
            'w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition duration-150 cursor-pointer',
            activeTab === item.key
              ? 'bg-jetblack text-white shadow-sm'
              : 'text-jetblack/75 hover:text-jetblack hover:bg-jetblack/5',
          ]"
        >
          <div class="flex items-center gap-2.5">
            <component
              :is="item.icon"
              class="w-4 h-4 shrink-0"
              :class="activeTab === item.key ? 'text-gold' : 'text-jetblack/50'"
            />
            <span>{{ item.name }}</span>
          </div>
          <div class="flex items-center gap-1.5">
            <span
              v-if="item.badge !== undefined"
              :class="[
                'px-1.5 py-0.2 rounded-full text-[10px] font-bold',
                activeTab === item.key
                  ? 'bg-white/20 text-white'
                  : 'bg-jetblack/5 text-jetblack/60',
              ]"
            >
              {{ item.badge }}
            </span>
            <span
              v-if="activeTab === item.key"
              class="w-1.5 h-1.5 rounded-full bg-gold shadow-[0_0_8px_#D4AF37]"
            ></span>
          </div>
        </button>
      </nav>
    </div>

    <!-- Bottom Sidebar Section -->
    <div class="space-y-2 pt-3 border-t border-jetblack/10">
      <!-- Switch to Builder Dashboard -->
      <router-link
        to="/dashboard"
        class="flex items-center justify-between px-3 py-1.5 rounded-lg bg-jetblack/5 hover:bg-jetblack/10 text-xs font-semibold text-jetblack transition border border-jetblack/10"
      >
        <div class="flex items-center gap-2">
          <LayoutDashboard class="w-3.5 h-3.5 text-gold" />
          <span>Builder Dashboard</span>
        </div>
        <ChevronRight class="w-3 h-3 text-jetblack/40" />
      </router-link>

      <router-link
        to="/"
        target="_blank"
        class="flex items-center justify-between px-3 py-1.5 rounded-lg hover:bg-jetblack/5 text-xs font-medium text-jetblack/70 transition"
      >
        <div class="flex items-center gap-2">
          <Globe class="w-3.5 h-3.5" />
          <span>Beranda Publik</span>
        </div>
        <ExternalLink class="w-3 h-3 text-jetblack/40" />
      </router-link>

      <!-- Engine Rail Info -->
      <div class="p-2.5 rounded-lg bg-jetblack text-white space-y-1 text-[11px] shadow-sm">
        <div class="flex items-center justify-between">
          <span class="text-[10px] font-bold uppercase tracking-wider text-gold">Admin Rail</span>
          <span
            class="w-1.5 h-1.5 rounded-full bg-emerald-400 ring-2 ring-emerald-400/40 animate-pulse"
          ></span>
        </div>
        <div class="text-[10px] text-white/75 font-mono">Bun + PostgreSQL Live</div>
      </div>

      <!-- Super Admin Profile & Logout -->
      <div class="pt-2 border-t border-jetblack/10 space-y-1.5">
        <div class="p-2 rounded-lg bg-jetblack/5 space-y-2">
          <div class="flex items-center gap-2 min-w-0">
            <div
              class="w-7 h-7 rounded-full bg-jetblack text-white flex items-center justify-center font-bold text-xs shrink-0 ring-1 ring-gold/40"
            >
              {{ adminInitial }}
            </div>
            <div class="min-w-0 text-left flex-1">
              <div class="text-xs font-bold text-jetblack truncate">{{ adminName }}</div>
              <div class="text-[10px] text-jetblack/50 font-medium truncate">{{ adminEmail }}</div>
            </div>
          </div>
          <button
            type="button"
            class="flex items-center justify-center gap-1.5 w-full py-1.5 px-2 rounded-md bg-white border border-jetblack/10 hover:border-red-500/30 hover:bg-red-50 hover:text-red-600 text-xs font-semibold text-jetblack/70 transition shadow-xs cursor-pointer"
            title="Keluar dari sesi admin"
            @click="emit('logout')"
          >
            <LogOut class="w-3.5 h-3.5" />
            <span>Keluar (Log Out)</span>
          </button>
        </div>
      </div>
    </div>
  </aside>
</template>
