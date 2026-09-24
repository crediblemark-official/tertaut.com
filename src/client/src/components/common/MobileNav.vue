<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import logoUrl from "@/assets/logo.svg";
import { dashboardEnv, envPath, SANDBOX_PREFIX, type DashboardEnv } from "../../lib/environment";
import {
  LayoutDashboard,
  Receipt,
  KeyRound,
  Boxes,
  Bot,
  BookOpen,
  Ticket,
  MoreHorizontal,
  ShieldAlert,
  X,
  LogOut,
  LogIn,
  Repeat,
  Wallet,
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
  currentPage: { title: string; category: string };
  authUser: { name?: string; email?: string } | null | undefined;
  isMobileMoreOpen: boolean;
}>();

const emit = defineEmits<{
  "switch-env": [target: DashboardEnv];
  "toggle-more": [];
  "close-more": [];
  logout: [];
}>();

const route = useRoute();
const env = dashboardEnv;

function pageKey(path: string): string {
  const stripped = path.startsWith(SANDBOX_PREFIX)
    ? path.slice(SANDBOX_PREFIX.length)
    : path.startsWith("/dashboard")
      ? path.slice("/dashboard".length)
      : path;
  return stripped || "/";
}
const navKey = computed(() => pageKey(route.path));

const mobileNavItems = computed<NavItem[]>(() => {
  const e = env.value;
  return [
    { name: "Ringkasan", key: "/", path: envPath(e), icon: LayoutDashboard },
    { name: "Aplikasi", key: "/apps", path: envPath(e, "/apps"), icon: Boxes },
    { name: "Payments", key: "/payments", path: envPath(e, "/payments"), icon: Receipt },
    { name: "Lisensi", key: "/licensing", path: envPath(e, "/licensing"), icon: KeyRound },
  ];
});

const isMoreActive = computed(() =>
  ["/subscriptions", "/balances", "/coupons", "/ai-proxy", "/docs"].includes(navKey.value)
);
const moreBadgeCount = computed(() => props.activeCouponCount);
</script>

<template>
  <!-- Mobile Top App Bar -->
  <header class="md:hidden bg-white border-b border-jetblack/10 sticky top-0 z-40 shadow-xs">
    <div class="flex items-center justify-between px-3.5 py-2">
      <router-link to="/" class="flex items-center gap-2 group">
        <img :src="logoUrl" alt="tertaut.com" class="w-7 h-7 rounded-md shadow-xs shrink-0" />
        <span class="font-extrabold text-xs tracking-tight text-jetblack font-mono"
          >tertaut<span class="text-gold">.com</span></span
        >
      </router-link>

      <div class="flex items-center gap-1.5">
        <button
          type="button"
          @click="emit('switch-env', env === 'sandbox' ? 'live' : 'sandbox')"
          class="px-2.5 py-1 min-h-[30px] rounded-lg text-[10.5px] font-bold uppercase tracking-wide border transition flex items-center gap-1 active:scale-95"
          :class="
            env === 'sandbox'
              ? 'bg-gold/15 border-gold/50 text-[#8a6d1f]'
              : 'bg-forest/10 border-forest/40 text-forest'
          "
        >
          <span
            class="w-1.5 h-1.5 rounded-full"
            :class="env === 'sandbox' ? 'bg-gold' : 'bg-forest'"
          ></span>
          <span>{{ env === "sandbox" ? "Sandbox" : "Live" }}</span>
        </button>
        <router-link
          to="/panel"
          class="p-1.5 min-w-[32px] min-h-[32px] rounded-lg bg-jetblack/5 hover:bg-jetblack/10 text-jetblack text-xs flex items-center justify-center transition"
          title="Super Admin Panel"
          ><ShieldAlert class="w-4 h-4 text-gold"
        /></router-link>
        <button
          v-if="authUser"
          type="button"
          @click="emit('logout')"
          class="p-1.5 min-w-[32px] min-h-[32px] rounded-lg bg-red-50 text-red-600 text-xs flex items-center justify-center transition active:scale-95"
          title="Keluar dari akun"
        >
          <LogOut class="w-3.5 h-3.5" />
        </button>
        <router-link
          v-else
          to="/login"
          class="px-2.5 py-1 min-h-[30px] rounded-lg bg-jetblack text-white text-[11px] font-bold flex items-center gap-1"
          ><LogIn class="w-3.5 h-3.5 text-gold" /><span>Masuk</span></router-link
        >
      </div>
    </div>
    <div
      class="px-3.5 py-1.5 bg-jetblack/[0.02] border-t border-jetblack/5 flex items-center justify-between text-[11px]"
    >
      <div class="flex items-center gap-1.5 font-medium text-jetblack/60 truncate">
        <span class="text-gold font-bold">{{ currentPage.category }}</span>
        <span>•</span>
        <span class="text-jetblack font-semibold truncate">{{ currentPage.title }}</span>
      </div>
      <span class="text-[9.5px] font-mono text-jetblack/40 shrink-0">v2.2</span>
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
              : navKey === "/ai-proxy"
                ? "AI Shield"
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

  <!-- Mobile More Sheet -->
  <div v-if="isMobileMoreOpen" class="md:hidden fixed inset-0 z-50 flex flex-col justify-end">
    <div
      class="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
      @click="emit('close-more')"
    ></div>
    <div
      class="relative bg-white rounded-t-2xl p-4 border-t border-jetblack/10 shadow-[0_-8px_30px_rgba(0,0,0,0.12)] z-10 space-y-3 pb-[calc(env(safe-area-inset-bottom,0px)+76px)] animate-fadeIn"
    >
      <div class="flex items-center justify-between pb-2 border-b border-jetblack/10">
        <div class="flex items-center gap-2">
          <span class="w-1.5 h-4 bg-gold rounded-full"></span>
          <h3 class="text-xs font-bold text-jetblack uppercase tracking-wider">Menu Tambahan</h3>
        </div>
        <button
          @click="emit('close-more')"
          class="p-1 rounded-md text-jetblack/50 hover:bg-jetblack/5 cursor-pointer"
        >
          <X class="w-4 h-4" />
        </button>
      </div>
      <div class="grid grid-cols-2 gap-2">
        <router-link
          :to="envPath(env, '/payments')"
          @click="emit('close-more')"
          class="flex items-center gap-2.5 p-3 rounded-xl border transition text-left cursor-pointer active:scale-95"
          :class="
            navKey === '/payments'
              ? 'bg-gold/10 border-gold/40 text-jetblack font-bold'
              : 'bg-jetblack/[0.02] border-jetblack/10 text-jetblack/80 hover:bg-jetblack/5'
          "
        >
          <div
            class="w-8 h-8 rounded-lg bg-gold/20 flex items-center justify-center text-jetblack shrink-0"
          >
            <Receipt class="w-4 h-4" />
          </div>
          <div class="flex-1 min-w-0">
            <div class="text-xs font-bold leading-tight">Payments</div>
            <div class="text-[10px] text-jetblack/50 truncate">Transaksi &amp; Pembayaran</div>
          </div>
        </router-link>
        <router-link
          :to="envPath(env, '/subscriptions')"
          @click="emit('close-more')"
          class="flex items-center gap-2.5 p-3 rounded-xl border transition text-left cursor-pointer active:scale-95"
          :class="
            navKey === '/subscriptions'
              ? 'bg-gold/10 border-gold/40 text-jetblack font-bold'
              : 'bg-jetblack/[0.02] border-jetblack/10 text-jetblack/80 hover:bg-jetblack/5'
          "
        >
          <div
            class="w-8 h-8 rounded-lg bg-gold/20 flex items-center justify-center text-jetblack shrink-0"
          >
            <Repeat class="w-4 h-4" />
          </div>
          <div class="flex-1 min-w-0">
            <div class="text-xs font-bold leading-tight">Subscriptions</div>
            <div class="text-[10px] text-jetblack/50 truncate">MRR &amp; Lifetime Value</div>
          </div>
        </router-link>
        <router-link
          :to="envPath(env, '/balances')"
          @click="emit('close-more')"
          class="flex items-center gap-2.5 p-3 rounded-xl border transition text-left cursor-pointer active:scale-95"
          :class="
            navKey === '/balances'
              ? 'bg-forest/10 border-forest/40 text-jetblack font-bold'
              : 'bg-jetblack/[0.02] border-jetblack/10 text-jetblack/80 hover:bg-jetblack/5'
          "
        >
          <div
            class="w-8 h-8 rounded-lg bg-forest/15 flex items-center justify-center text-forest shrink-0"
          >
            <Wallet class="w-4 h-4" />
          </div>
          <div class="flex-1 min-w-0">
            <div class="text-xs font-bold leading-tight">Balances</div>
            <div class="text-[10px] text-jetblack/50 truncate">Saldo &amp; Payouts</div>
          </div>
        </router-link>
        <router-link
          :to="envPath(env, '/coupons')"
          @click="emit('close-more')"
          class="flex items-center gap-2.5 p-3 rounded-xl border transition text-left cursor-pointer active:scale-95"
          :class="
            navKey === '/coupons'
              ? 'bg-gold/10 border-gold/40 text-jetblack font-bold'
              : 'bg-jetblack/[0.02] border-jetblack/10 text-jetblack/80 hover:bg-jetblack/5'
          "
        >
          <div
            class="w-8 h-8 rounded-lg bg-gold/20 flex items-center justify-center text-jetblack shrink-0"
          >
            <Ticket class="w-4 h-4" />
          </div>
          <div class="flex-1 min-w-0">
            <div class="text-xs font-bold leading-tight">Kupon Diskon</div>
            <div class="text-[10px] text-jetblack/50 truncate">{{ activeCouponCount }} Aktif</div>
          </div>
        </router-link>
        <router-link
          :to="envPath(env, '/ai-proxy')"
          @click="emit('close-more')"
          class="flex items-center gap-2.5 p-3 rounded-xl border transition text-left cursor-pointer active:scale-95"
          :class="
            navKey === '/ai-proxy'
              ? 'bg-forest/10 border-forest/40 text-jetblack font-bold'
              : 'bg-jetblack/[0.02] border-jetblack/10 text-jetblack/80 hover:bg-jetblack/5'
          "
        >
          <div
            class="w-8 h-8 rounded-lg bg-forest/15 flex items-center justify-center text-forest shrink-0"
          >
            <Bot class="w-4 h-4" />
          </div>
          <div class="flex-1 min-w-0">
            <div class="text-xs font-bold leading-tight">AI Proxy Shield</div>
            <div class="text-[10px] text-jetblack/50 truncate">Audit &amp; Guard</div>
          </div>
        </router-link>
        <router-link
          :to="envPath(env, '/docs')"
          @click="emit('close-more')"
          class="flex items-center gap-2.5 p-3 rounded-xl border transition text-left cursor-pointer active:scale-95"
          :class="
            navKey === '/docs'
              ? 'bg-jetblack/10 border-jetblack/30 text-jetblack font-bold'
              : 'bg-jetblack/[0.02] border-jetblack/10 text-jetblack/80 hover:bg-jetblack/5'
          "
        >
          <div
            class="w-8 h-8 rounded-lg bg-jetblack/10 flex items-center justify-center text-jetblack shrink-0"
          >
            <BookOpen class="w-4 h-4" />
          </div>
          <div class="flex-1 min-w-0">
            <div class="text-xs font-bold leading-tight">Dokumentasi</div>
            <div class="text-[10px] text-jetblack/50 truncate">SDK &amp; API</div>
          </div>
        </router-link>
        <router-link
          to="/panel"
          @click="emit('close-more')"
          class="flex items-center gap-2.5 p-3 rounded-xl border border-jetblack/10 bg-jetblack/[0.02] text-jetblack/80 hover:bg-jetblack/5 transition text-left cursor-pointer active:scale-95"
        >
          <div
            class="w-8 h-8 rounded-lg bg-jetblack/10 flex items-center justify-center text-jetblack shrink-0"
          >
            <ShieldAlert class="w-4 h-4" />
          </div>
          <div class="flex-1 min-w-0">
            <div class="text-xs font-bold leading-tight">Admin Panel</div>
            <div class="text-[10px] text-jetblack/50 truncate">Super Admin Ledger</div>
          </div>
        </router-link>
      </div>
    </div>
  </div>
</template>
