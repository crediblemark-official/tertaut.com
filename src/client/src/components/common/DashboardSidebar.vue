<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import { dashboardEnv, envPath, SANDBOX_PREFIX, type DashboardEnv } from "../../lib/environment";
import {
  LayoutDashboard,
  Boxes,
  KeyRound,
  Bot,
  BookOpen,
  Code2,
  ExternalLink,
  Globe,
  ShieldAlert,
  ChevronRight,
  Ticket,
  Receipt,
  Repeat,
  Wallet,
} from "lucide-vue-next";

interface NavSubItem {
  name: string;
  path: string;
}
interface NavItem {
  name: string;
  key: string;
  path: string;
  icon: any;
  children?: NavSubItem[];
}

const props = defineProps<{
  activeCouponCount: number;
  activeLicenseCount: number;
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

const navItems = computed<NavItem[]>(() => {
  const e = env.value;
  return [
    { name: "Ringkasan", key: "/", path: envPath(e), icon: LayoutDashboard },
    { name: "Aplikasi", key: "/apps", path: envPath(e, "/apps"), icon: Boxes },
    { name: "Payments", key: "/payments", path: envPath(e, "/payments"), icon: Receipt },
    {
      name: "Subscription",
      key: "/subscriptions",
      path: envPath(e, "/subscriptions"),
      icon: Repeat,
    },
    { name: "Balances", key: "/balances", path: envPath(e, "/balances"), icon: Wallet },
    { name: "Kupon", key: "/coupons", path: envPath(e, "/coupons"), icon: Ticket },
    { name: "Lisensi", key: "/licensing", path: envPath(e, "/licensing"), icon: KeyRound },
    { name: "AI Shield", key: "/ai-proxy", path: envPath(e, "/ai-proxy"), icon: Bot },
    { name: "Dashboard Docs", key: "/docs", path: envPath(e, "/docs"), icon: BookOpen },
  ];
});

const emit = defineEmits<{ "switch-env": [target: DashboardEnv] }>();
</script>

<template>
  <aside
    class="hidden md:flex w-56 flex-col justify-between p-4 border-r border-jetblack/10 bg-white sticky top-0 h-screen shrink-0 z-30"
  >
    <div class="space-y-5">
      <!-- Brand Header -->
      <router-link to="/" class="flex items-center gap-2.5 px-2 py-1 group">
        <div
          class="w-8 h-8 rounded-lg bg-jetblack flex items-center justify-center font-bold text-white shadow-md relative overflow-hidden group-hover:scale-105 transition"
        >
          <span class="text-sm font-black tracking-tighter">T</span>
          <span
            class="absolute bottom-1 right-1 w-1.5 h-1.5 rounded-full bg-gold shadow-[0_0_6px_#D4AF37]"
          ></span>
        </div>
        <div>
          <div
            class="font-extrabold text-sm tracking-tight text-jetblack flex items-center gap-0.5 font-mono"
          >
            tertaut<span class="text-gold">.com</span>
          </div>
          <div class="text-[10px] text-jetblack/50 font-medium">Builder MoR Console</div>
        </div>
      </router-link>

      <!-- Environment Switch -->
      <div class="grid grid-cols-2 gap-1 p-1 rounded-lg bg-jetblack/5 border border-jetblack/10">
        <button
          type="button"
          @click="emit('switch-env', 'sandbox')"
          :class="
            env === 'sandbox'
              ? 'bg-gold text-jetblack shadow-sm'
              : 'text-jetblack/60 hover:text-jetblack'
          "
          class="py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wide transition"
        >
          Sandbox
        </button>
        <button
          type="button"
          @click="emit('switch-env', 'live')"
          :class="
            env === 'live'
              ? 'bg-forest text-white shadow-sm'
              : 'text-jetblack/60 hover:text-jetblack'
          "
          class="py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wide transition"
        >
          Live
        </button>
      </div>

      <!-- Navigation Menu -->
      <nav class="space-y-1">
        <div v-for="item in navItems" :key="item.path" class="space-y-0.5">
          <router-link
            :to="item.path"
            :class="[
              'flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition duration-150',
              navKey === item.key
                ? 'bg-jetblack text-white shadow-sm'
                : 'text-jetblack/75 hover:text-jetblack hover:bg-jetblack/5',
            ]"
          >
            <div class="flex items-center gap-2.5">
              <component
                :is="item.icon"
                class="w-4 h-4 transition"
                :class="navKey === item.key ? 'text-gold' : 'text-jetblack/60'"
              />
              <span>{{ item.name }}</span>
            </div>
            <span
              v-if="item.key === '/coupons' && activeCouponCount > 0"
              class="px-1.5 min-w-[18px] text-center py-0.5 rounded-full text-[9px] font-black leading-none"
              :class="navKey === item.key ? 'bg-gold text-jetblack' : 'bg-gold/20 text-gold'"
              >{{ activeCouponCount }}</span
            >
            <span
              v-else-if="item.key === '/licensing' && activeLicenseCount > 0"
              class="px-1.5 min-w-[18px] text-center py-0.5 rounded-full text-[9px] font-black leading-none"
              :class="navKey === item.key ? 'bg-gold text-jetblack' : 'bg-forest/15 text-forest'"
              >{{ activeLicenseCount }}</span
            >
            <span
              v-else-if="navKey === item.key"
              class="w-1.5 h-1.5 rounded-full bg-gold shadow-[0_0_8px_#D4AF37]"
            ></span>
          </router-link>
          <div
            v-if="item.children && route.path.startsWith(item.path)"
            class="pl-4 pr-1 py-1 space-y-1 border-l-2 border-gold/30 ml-4 my-1 animate-in fade-in duration-200"
          >
            <router-link
              v-for="sub in item.children"
              :key="sub.path"
              :to="sub.path"
              :class="[
                'block px-2.5 py-1.5 rounded-md text-[11px] font-medium transition',
                route.path === sub.path
                  ? 'text-jetblack font-bold bg-gold/20 border border-gold/40'
                  : 'text-jetblack/65 hover:text-jetblack hover:bg-jetblack/5',
              ]"
            >
              {{ sub.name }}
            </router-link>
          </div>
        </div>
      </nav>
    </div>

    <!-- Bottom Card & Status -->
    <div class="space-y-1.5 pt-3 border-t border-jetblack/10">
      <router-link
        to="/panel"
        class="flex items-center justify-between px-3 py-1.5 rounded-lg bg-jetblack/5 hover:bg-jetblack/10 text-xs font-semibold text-jetblack transition border border-jetblack/10"
      >
        <div class="flex items-center gap-2">
          <ShieldAlert class="w-3.5 h-3.5 text-gold" /><span>Admin Panel</span>
        </div>
        <ChevronRight class="w-3 h-3 text-jetblack/40" />
      </router-link>
      <a
        href="/docs/"
        target="_blank"
        class="flex items-center justify-between px-3 py-1.5 rounded-lg hover:bg-jetblack/5 text-xs font-medium text-jetblack/70 transition"
      >
        <div class="flex items-center gap-2">
          <BookOpen class="w-3.5 h-3.5 text-gold" /><span>Developer Docs</span>
        </div>
        <ExternalLink class="w-3 h-3 text-jetblack/40" />
      </a>
      <a
        href="/swagger"
        target="_blank"
        class="flex items-center justify-between px-3 py-1.5 rounded-lg hover:bg-jetblack/5 text-xs font-medium text-jetblack/70 transition"
      >
        <div class="flex items-center gap-2">
          <Code2 class="w-3.5 h-3.5 text-gold" /><span>API Docs</span>
        </div>
        <ExternalLink class="w-3 h-3 text-jetblack/40" />
      </a>
    </div>
  </aside>
</template>
