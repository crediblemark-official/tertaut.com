<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute } from "vue-router";
import logoUrl from "@/assets/logo.svg";
import { dashboardEnv, envPath, SANDBOX_PREFIX, type DashboardEnv } from "../../lib/environment";
import {
  LayoutDashboard,
  Receipt,
  KeyRound,
  Boxes,
  BookOpen,
  Ticket,
  MoreHorizontal,
  ShieldAlert,
  X,
  LogOut,
  LogIn,
  Repeat,
  Wallet,
  Terminal,
  Search,
  User,
  RefreshCw,
} from "lucide-vue-next";

interface NavItem {
  name: string;
  key: string;
  path: string;
  icon: any;
}

const props = defineProps<{
  activeCouponCount: number;
  activeLicenseCount: number;
  hasPayoutAccount?: boolean | null;
  currentPage: { title: string; category: string };
  authUser: { name?: string; email?: string } | null | undefined;
  isMobileMoreOpen: boolean;
  switchingToEnv?: DashboardEnv | null;
}>();

const emit = defineEmits<{
  "switch-env": [target: DashboardEnv];
  "toggle-more": [];
  "close-more": [];
  logout: [];
}>();

import { authClient } from "../../lib/auth";

const authSession = authClient.useSession();
const isAdmin = computed(() => {
  const role = (authSession.value?.data?.user as { role?: string })?.role;
  return role === "admin";
});

const route = useRoute();
const env = dashboardEnv;

function pageKey(path: string): string {
  const stripped = path.startsWith(SANDBOX_PREFIX)
    ? path.slice(SANDBOX_PREFIX.length)
    : path.startsWith("/dashboard")
      ? path.slice("/dashboard".length)
      : path;
  if (stripped === "/apps") return "/projects";
  return stripped || "/";
}
const navKey = computed(() => pageKey(route.path));

const mobileNavItems = computed<NavItem[]>(() => {
  const e = env.value;
  return [
    { name: "Ringkasan", key: "/", path: envPath(e), icon: LayoutDashboard },
    { name: "Aplikasi", key: "/projects", path: envPath(e, "/projects"), icon: Boxes },
    { name: "Transaksi", key: "/payments", path: envPath(e, "/payments"), icon: Receipt },
    { name: "Lisensi", key: "/licensing", path: envPath(e, "/licensing"), icon: KeyRound },
  ];
});

const isMoreActive = computed(() =>
  ["/subscriptions", "/balances", "/coupons", "/developer", "/profile"].includes(navKey.value)
);
const moreBadgeCount = computed(() => props.activeCouponCount);

const isSearchOpen = ref(false);

const SEARCHABLE_NAV_KEYS = [
  "/projects",
  "/payments",
  "/licensing",
  "/coupons",
  "/subscriptions",
  "/balances",
];
const hasSearch = computed(() => SEARCHABLE_NAV_KEYS.includes(navKey.value));
const isSearchActive = computed(() => isSearchOpen.value && hasSearch.value);

watch(
  () => route.path,
  () => {
    isSearchOpen.value = false;
  }
);
</script>

<template>
  <!-- Mobile Top App Bar -->
  <header class="md:hidden bg-white border-b border-jetblack/10 sticky top-0 z-40 shadow-xs">
    <!-- Single Row Header (Standard 44px) -->
    <div class="flex items-center justify-between px-3.5 min-h-[44px] py-1.5 gap-2">
      <!-- Search Input Container (Always in DOM for Vue Teleport, active only when search is open and route has search) -->
      <div id="mobile-header-search" :class="isSearchActive ? 'flex-1 min-w-0' : 'hidden'"></div>

      <template v-if="isSearchActive">
        <!-- Close/Cancel Search Button -->
        <button
          type="button"
          @click="isSearchOpen = false"
          class="px-2.5 py-1 text-xs font-bold text-jetblack/70 hover:text-jetblack rounded-lg hover:bg-jetblack/5 shrink-0 transition cursor-pointer"
        >
          Batal
        </button>
      </template>

      <template v-else>
        <!-- Normal State: Left Brand Logo -->
        <router-link to="/" class="flex items-center gap-1.5 group shrink-0">
          <img :src="logoUrl" alt="tertaut.com" class="w-6 h-6 rounded-md shadow-xs shrink-0" />
          <span class="font-extrabold text-xs tracking-tight text-jetblack font-mono">
            tertaut<span class="text-gold">.com</span>
          </span>
        </router-link>

        <!-- Normal State: Right Actions -->
        <div class="flex items-center gap-1.5 shrink-0">
          <!-- Search Trigger Icon Button (Only shown on pages with search) -->
          <button
            v-if="hasSearch"
            type="button"
            @click="isSearchOpen = true"
            class="p-1.5 min-w-[32px] min-h-[32px] rounded-lg bg-jetblack/5 hover:bg-jetblack/10 text-jetblack/70 hover:text-jetblack text-xs flex items-center justify-center transition active:scale-95 cursor-pointer"
            title="Buka Pencarian"
          >
            <Search class="w-3.5 h-3.5" />
          </button>

          <!-- Environment Switcher -->
          <button
            type="button"
            :disabled="Boolean(switchingToEnv)"
            @click="emit('switch-env', env === 'sandbox' ? 'live' : 'sandbox')"
            class="px-2 py-1 min-h-[30px] rounded-lg text-[10px] font-bold uppercase tracking-wide border transition-all duration-300 flex items-center gap-1 active:scale-95 disabled:opacity-60 cursor-pointer"
            :class="
              env === 'sandbox'
                ? 'bg-gold/15 border-gold/50 text-[#8a6d1f]'
                : 'bg-forest/10 border-forest/40 text-forest'
            "
          >
            <RefreshCw v-if="switchingToEnv" class="w-3 h-3 animate-spin" />
            <span
              v-else
              class="w-1.5 h-1.5 rounded-full"
              :class="env === 'sandbox' ? 'bg-gold' : 'bg-forest'"
            ></span>
            <span>{{
              switchingToEnv ? "Beralih..." : env === "sandbox" ? "Sandbox" : "Live"
            }}</span>
          </button>

          <!-- Admin Panel Button -->
          <router-link
            v-if="isAdmin"
            to="/panel"
            class="p-1.5 min-w-[32px] min-h-[32px] rounded-lg bg-jetblack/5 hover:bg-jetblack/10 text-jetblack text-xs flex items-center justify-center transition"
            title="Super Admin Panel"
          >
            <ShieldAlert class="w-4 h-4 text-gold" />
          </router-link>

          <!-- Profile Shortcut -->
          <router-link
            v-if="authUser"
            :to="envPath(env, '/profile')"
            class="relative w-7 h-7 rounded-full flex items-center justify-center font-bold text-[11px] transition shrink-0 ring-1"
            :class="
              navKey === '/profile'
                ? 'bg-gold text-jetblack ring-gold'
                : 'bg-jetblack text-white ring-gold/40'
            "
            title="Profil Builder & Rekening Pencairan"
          >
            {{ (authUser.name || authUser.email || "B").charAt(0).toUpperCase() }}
            <span
              v-if="hasPayoutAccount === false"
              class="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-amber-500 ring-1 ring-white"
              title="Rekening pencairan belum diatur"
            ></span>
          </router-link>

          <!-- Logout Button -->
          <button
            v-if="authUser"
            type="button"
            @click="emit('logout')"
            class="p-1.5 min-w-[32px] min-h-[32px] rounded-lg bg-red-50 text-red-600 text-xs flex items-center justify-center transition active:scale-95 cursor-pointer"
            title="Keluar dari akun"
          >
            <LogOut class="w-3.5 h-3.5" />
          </button>
          <router-link
            v-else
            to="/login"
            class="px-2.5 py-1 min-h-[30px] rounded-lg bg-jetblack text-white text-[11px] font-bold flex items-center gap-1"
          >
            <LogIn class="w-3.5 h-3.5 text-gold" /><span>Masuk</span>
          </router-link>
        </div>
      </template>
    </div>
  </header>

  <!-- Mobile Bottom Nav -->
  <nav
    class="md:hidden fixed bottom-0 left-0 right-0 min-h-[4rem] h-[calc(4rem+env(safe-area-inset-bottom,0px))] pb-[env(safe-area-inset-bottom,0px)] bg-white/95 backdrop-blur-md border-t border-jetblack/10 flex items-center px-1 z-50 shadow-[0_-4px_20px_rgba(17,17,17,0.08)]"
  >
    <div class="flex items-center w-full justify-around px-0.5">
      <router-link
        v-for="item in mobileNavItems"
        :key="item.path"
        :to="item.path"
        :class="[
          'flex flex-col items-center justify-center flex-1 h-14 py-1 text-[10px] font-semibold transition relative rounded-lg active:scale-95',
          navKey === item.key ? 'text-jetblack font-bold' : 'text-jetblack/50 hover:text-jetblack',
        ]"
      >
        <component
          :is="item.icon"
          class="w-4 h-4 mb-1 transition-transform"
          :class="navKey === item.key ? 'text-gold scale-110' : ''"
        />
        <span
          v-if="item.key === '/licensing' && activeLicenseCount > 0"
          class="absolute top-1 right-[calc(50%-14px)] min-w-[15px] px-1 py-px rounded-full bg-forest text-white text-[8px] font-black leading-tight text-center shadow-xs"
          >{{ activeLicenseCount }}</span
        >
        <span class="truncate max-w-[55px] leading-tight text-[9.5px]">{{ item.name }}</span>
        <span
          v-if="navKey === item.key"
          class="absolute top-0.5 w-6 h-0.5 bg-gold rounded-full shadow-[0_0_4px_#D4AF37]"
        ></span>
      </router-link>

      <!-- Lainnya -->
      <button
        type="button"
        @click="emit('toggle-more')"
        :class="[
          'flex flex-col items-center justify-center flex-1 h-14 py-1 text-[10px] font-semibold transition relative rounded-lg active:scale-95 cursor-pointer',
          isMoreActive || isMobileMoreOpen
            ? 'text-jetblack font-bold'
            : 'text-jetblack/50 hover:text-jetblack',
        ]"
      >
        <MoreHorizontal
          class="w-4 h-4 mb-1 transition-transform"
          :class="isMoreActive || isMobileMoreOpen ? 'text-gold scale-110' : ''"
        />
        <span
          v-if="moreBadgeCount > 0 && navKey !== '/coupons'"
          class="absolute top-1 right-[calc(50%-14px)] min-w-[15px] px-1 py-px rounded-full bg-gold text-jetblack text-[8px] font-black leading-tight text-center shadow-xs"
          >{{ moreBadgeCount }}</span
        >
        <span class="truncate max-w-[55px] leading-tight text-[9.5px]">{{
          isMoreActive
            ? navKey === "/coupons"
              ? "Kupon"
              : navKey === "/balances"
                ? "Saldo"
                : navKey === "/subscriptions"
                  ? "Langganan"
                  : navKey === "/profile"
                    ? "Profil"
                    : "Docs"
            : "Lainnya"
        }}</span>
        <span
          v-if="isMoreActive || isMobileMoreOpen"
          class="absolute top-0.5 w-6 h-0.5 bg-gold rounded-full shadow-[0_0_4px_#D4AF37]"
        ></span>
      </button>
    </div>
  </nav>

  <!-- Mobile More Sheet (Full-Edge Hairline Grid) -->
  <div v-if="isMobileMoreOpen" class="md:hidden fixed inset-0 z-50 flex flex-col justify-end">
    <div
      class="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
      @click="emit('close-more')"
    ></div>
    <div
      class="relative bg-white rounded-t-xl border-t border-jetblack/15 shadow-[0_-8px_30px_rgba(0,0,0,0.12)] z-10 pb-[calc(env(safe-area-inset-bottom,0px)+72px)] animate-fadeIn"
    >
      <div class="pt-2.5 pb-2 px-4 border-b border-jetblack/10">
        <div class="w-10 h-1 rounded-full bg-jetblack/15 mx-auto mb-2"></div>
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="w-1.5 h-3.5 bg-gold"></span>
            <h3 class="text-xs font-bold text-jetblack uppercase tracking-wider">Menu Lainnya</h3>
          </div>
          <button
            type="button"
            @click="emit('close-more')"
            aria-label="Tutup menu"
            class="p-1 rounded-md text-jetblack/55 hover:text-jetblack hover:bg-jetblack/5 cursor-pointer"
          >
            <X class="w-4 h-4" />
          </button>
        </div>
      </div>

      <div>
        <div
          class="flex items-center justify-between px-4 py-2 bg-jetblack/[0.02] border-b border-jetblack/10"
        >
          <span class="text-[10px] font-bold text-jetblack/50 uppercase tracking-wider">
            Managed Payment
          </span>
          <span
            class="text-[9px] font-mono font-bold uppercase"
            :class="env === 'sandbox' ? 'text-[#8a6d1f]' : 'text-forest'"
          >
            {{ env === "sandbox" ? "Simulasi" : "Aktif" }}
          </span>
        </div>

        <div
          class="grid grid-cols-2 divide-x divide-y divide-jetblack/10 border-b border-jetblack/10"
        >
          <router-link
            :to="envPath(env, '/payments')"
            @click="emit('close-more')"
            class="flex items-center gap-2.5 px-4 py-3 transition text-left cursor-pointer active:bg-jetblack/[0.04]"
            :class="
              navKey === '/payments'
                ? 'bg-gold/10 text-jetblack font-bold'
                : 'bg-white text-jetblack/80'
            "
          >
            <Receipt class="w-4 h-4 text-gold shrink-0" />
            <div class="flex-1 min-w-0">
              <div class="text-xs font-bold leading-tight">Transaksi</div>
              <div class="text-[10px] text-jetblack/50 truncate">Riwayat Bayar</div>
            </div>
          </router-link>

          <router-link
            :to="envPath(env, '/subscriptions')"
            @click="emit('close-more')"
            class="flex items-center gap-2.5 px-4 py-3 transition text-left cursor-pointer active:bg-jetblack/[0.04]"
            :class="
              navKey === '/subscriptions'
                ? 'bg-gold/10 text-jetblack font-bold'
                : 'bg-white text-jetblack/80'
            "
          >
            <Repeat class="w-4 h-4 text-gold shrink-0" />
            <div class="flex-1 min-w-0">
              <div class="text-xs font-bold leading-tight">Langganan</div>
              <div class="text-[10px] text-jetblack/50 truncate">MRR &amp; Siklus</div>
            </div>
          </router-link>

          <router-link
            :to="envPath(env, '/balances')"
            @click="emit('close-more')"
            class="flex items-center gap-2.5 px-4 py-3 transition text-left cursor-pointer active:bg-jetblack/[0.04]"
            :class="
              navKey === '/balances'
                ? 'bg-forest/10 text-jetblack font-bold'
                : 'bg-white text-jetblack/80'
            "
          >
            <Wallet class="w-4 h-4 text-forest shrink-0" />
            <div class="flex-1 min-w-0">
              <div class="text-xs font-bold leading-tight">Saldo &amp; Payout</div>
              <div class="text-[10px] text-jetblack/50 truncate">Riwayat &amp; Tarik Dana</div>
            </div>
          </router-link>

          <router-link
            :to="envPath(env, '/coupons')"
            @click="emit('close-more')"
            class="flex items-center gap-2.5 px-4 py-3 transition text-left cursor-pointer active:bg-jetblack/[0.04]"
            :class="
              navKey === '/coupons'
                ? 'bg-gold/10 text-jetblack font-bold'
                : 'bg-white text-jetblack/80'
            "
          >
            <Ticket class="w-4 h-4 text-gold shrink-0" />
            <div class="flex-1 min-w-0">
              <div class="text-xs font-bold leading-tight">Kupon Promo</div>
              <div class="text-[10px] font-mono text-jetblack/50 truncate">
                {{ activeCouponCount }} aktif
              </div>
            </div>
          </router-link>
        </div>

        <div
          class="px-4 py-2 bg-jetblack/[0.02] border-b border-jetblack/10 text-[10px] font-bold text-jetblack/50 uppercase tracking-wider"
        >
          Developer &amp; Sistem
        </div>
        <div
          class="grid grid-cols-2 divide-x divide-y divide-jetblack/10 border-b border-jetblack/10"
        >
          <router-link
            :to="envPath(env, '/developer')"
            @click="emit('close-more')"
            class="flex items-center gap-2.5 px-4 py-3 transition text-left cursor-pointer active:bg-jetblack/[0.04]"
            :class="
              navKey === '/developer'
                ? 'bg-jetblack text-white font-bold'
                : 'bg-white text-jetblack/80'
            "
          >
            <Terminal class="w-4 h-4 text-gold shrink-0" />
            <div class="flex-1 min-w-0">
              <div class="text-xs font-bold leading-tight">Integrasi API</div>
              <div class="text-[10px] opacity-60 truncate">Key &amp; Webhook</div>
            </div>
          </router-link>

          <router-link
            :to="envPath(env, '/profile')"
            @click="emit('close-more')"
            class="flex items-center gap-2.5 px-4 py-3 transition text-left cursor-pointer active:bg-jetblack/[0.04]"
            :class="
              navKey === '/profile'
                ? 'bg-jetblack text-white font-bold'
                : 'bg-white text-jetblack/80'
            "
          >
            <User class="w-4 h-4 text-gold shrink-0" />
            <div class="flex-1 min-w-0">
              <div class="text-xs font-bold leading-tight">Profil Akun</div>
              <div class="text-[10px] opacity-60 truncate">Identitas &amp; Rekening</div>
            </div>
          </router-link>

          <router-link
            v-if="isAdmin"
            to="/panel"
            @click="emit('close-more')"
            class="flex items-center gap-2.5 px-4 py-3 bg-white text-jetblack/80 hover:bg-jetblack/[0.03] transition text-left cursor-pointer active:bg-jetblack/[0.04]"
          >
            <ShieldAlert class="w-4 h-4 text-gold shrink-0" />
            <div class="flex-1 min-w-0">
              <div class="text-xs font-bold leading-tight">Admin Panel</div>
              <div class="text-[10px] text-jetblack/50 truncate">Ledger Platform</div>
            </div>
          </router-link>
        </div>
      </div>
    </div>
  </div>
</template>
