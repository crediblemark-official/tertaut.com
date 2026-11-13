<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import logoUrl from "@/assets/logo.svg";
import { dashboardEnv, envPath, SANDBOX_PREFIX, type DashboardEnv } from "../../lib/environment";
import {
  LayoutDashboard,
  Boxes,
  KeyRound,
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
  Terminal,
  RefreshCw,
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

interface NavGroup {
  label: string;
  badge?: string;
  items: NavItem[];
}

const props = defineProps<{
  activeCouponCount: number;
  activeLicenseCount: number;
  hasPayoutAccount?: boolean | null;
  switchingToEnv?: DashboardEnv | null;
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

const navGroups = computed<NavGroup[]>(() => {
  const e = env.value;
  return [
    {
      label: "Utama",
      items: [
        { name: "Ringkasan", key: "/", path: envPath(e), icon: LayoutDashboard },
        { name: "Aplikasi", key: "/projects", path: envPath(e, "/projects"), icon: Boxes },
      ],
    },
    {
      label: "Managed Payment",
      badge: e === "sandbox" ? "Simulasi" : "Aktif",
      items: [
        { name: "Transaksi", key: "/payments", path: envPath(e, "/payments"), icon: Receipt },
        {
          name: "Langganan",
          key: "/subscriptions",
          path: envPath(e, "/subscriptions"),
          icon: Repeat,
        },
        { name: "Saldo & Payout", key: "/balances", path: envPath(e, "/balances"), icon: Wallet },
        { name: "Kupon Promo", key: "/coupons", path: envPath(e, "/coupons"), icon: Ticket },
      ],
    },
    {
      label: "Lisensi & Developer",
      items: [
        {
          name: "Kelola Lisensi",
          key: "/licensing",
          path: envPath(e, "/licensing"),
          icon: KeyRound,
        },
        {
          name: "Integrasi API",
          key: "/developer",
          path: envPath(e, "/developer"),
          icon: Terminal,
        },
      ],
    },
  ];
});

const emit = defineEmits<{ "switch-env": [target: DashboardEnv] }>();
</script>

<template>
  <aside
    class="hidden md:flex w-56 flex-col justify-between border-r border-jetblack/10 bg-white sticky top-0 h-screen shrink-0 z-30"
  >
    <div class="flex-1 flex flex-col min-h-0">
      <!-- Brand Header (Docked Edge-to-Edge) -->
      <router-link
        to="/"
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
          <div class="text-[10px] text-jetblack/50 font-medium leading-tight">Builder Console</div>
        </div>
      </router-link>

      <!-- Environment Switch (Docked Hairline Bar) -->
      <div
        class="grid grid-cols-2 border-b border-jetblack/10 divide-x divide-jetblack/10 shrink-0"
      >
        <button
          type="button"
          :disabled="Boolean(switchingToEnv)"
          @click="emit('switch-env', 'sandbox')"
          :class="
            env === 'sandbox'
              ? 'bg-gold text-jetblack font-extrabold'
              : 'bg-white text-jetblack/55 hover:text-jetblack hover:bg-jetblack/[0.03]'
          "
          class="py-2 text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all duration-300 active:scale-[0.98] disabled:opacity-60 disabled:cursor-wait focus-visible:outline-2 focus-visible:outline-gold cursor-pointer"
        >
          <RefreshCw v-if="switchingToEnv === 'sandbox'" class="w-3 h-3 animate-spin shrink-0" />
          <span
            v-else
            class="w-1.5 h-1.5 rounded-full"
            :class="env === 'sandbox' ? 'bg-jetblack' : 'bg-gold/60'"
          ></span>
          <span>{{ switchingToEnv === "sandbox" ? "Beralih..." : "Sandbox" }}</span>
        </button>
        <button
          type="button"
          :disabled="Boolean(switchingToEnv)"
          @click="emit('switch-env', 'live')"
          :class="
            env === 'live'
              ? 'bg-forest text-white font-extrabold'
              : 'bg-white text-jetblack/55 hover:text-jetblack hover:bg-jetblack/[0.03]'
          "
          class="py-2 text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all duration-300 active:scale-[0.98] disabled:opacity-60 disabled:cursor-wait focus-visible:outline-2 focus-visible:outline-gold cursor-pointer"
        >
          <RefreshCw v-if="switchingToEnv === 'live'" class="w-3 h-3 animate-spin shrink-0" />
          <span
            v-else
            class="w-1.5 h-1.5 rounded-full"
            :class="env === 'live' ? 'bg-emerald-300' : 'bg-forest/50'"
          ></span>
          <span>{{ switchingToEnv === "live" ? "Beralih..." : "Live" }}</span>
        </button>
      </div>

      <!-- Navigation Menu (Grouped with Hairline Dividers) -->
      <nav class="flex-1 overflow-y-auto divide-y divide-jetblack/10">
        <div v-for="group in navGroups" :key="group.label" class="py-2">
          <div class="flex items-center justify-between px-4 py-1.5">
            <span class="text-[9.5px] font-bold uppercase tracking-wider text-jetblack/45">
              {{ group.label }}
            </span>
            <span
              v-if="group.badge"
              class="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider font-mono"
              :class="env === 'sandbox' ? 'text-[#8a6d1f]' : 'text-forest'"
            >
              <span
                class="w-1.5 h-1.5 rounded-full"
                :class="env === 'sandbox' ? 'bg-gold' : 'bg-forest'"
              ></span>
              {{ group.badge }}
            </span>
          </div>

          <div v-for="item in group.items" :key="item.path">
            <router-link
              :to="item.path"
              :class="[
                'flex items-center justify-between px-4 py-2 text-xs font-semibold border-l-[3px] transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-gold',
                navKey === item.key
                  ? 'bg-jetblack text-white border-l-gold font-bold'
                  : 'border-l-transparent text-jetblack/75 hover:text-jetblack hover:bg-jetblack/[0.03]',
              ]"
            >
              <div class="flex items-center gap-2.5 min-w-0">
                <component
                  :is="item.icon"
                  class="w-4 h-4 transition shrink-0"
                  :class="navKey === item.key ? 'text-gold' : 'text-jetblack/55'"
                />
                <span class="truncate">{{ item.name }}</span>
              </div>
              <span
                v-if="item.key === '/coupons' && activeCouponCount > 0"
                class="px-1.5 min-w-[20px] text-center py-0.5 rounded-xs text-[9px] font-mono tracking-wider font-bold leading-none shrink-0"
                :class="navKey === item.key ? 'bg-gold text-jetblack' : 'bg-gold/20 text-[#8a6d1f]'"
                >{{ activeCouponCount }}</span
              >
              <span
                v-else-if="item.key === '/licensing' && activeLicenseCount > 0"
                class="px-1.5 min-w-[20px] text-center py-0.5 rounded-xs text-[9px] font-mono tracking-wider font-bold leading-none shrink-0"
                :class="navKey === item.key ? 'bg-gold text-jetblack' : 'bg-forest/15 text-forest'"
                >{{ activeLicenseCount }}</span
              >
            </router-link>
            <div
              v-if="item.children && route.path.startsWith(item.path)"
              class="pl-6 pr-3 py-1 space-y-0.5 border-l-2 border-gold/40 ml-5 my-1"
            >
              <router-link
                v-for="sub in item.children"
                :key="sub.path"
                :to="sub.path"
                :class="[
                  'block px-2.5 py-1.5 text-[11px] font-medium transition border-l-2',
                  route.path === sub.path
                    ? 'text-jetblack font-bold border-gold bg-gold/10'
                    : 'border-transparent text-jetblack/65 hover:text-jetblack hover:bg-jetblack/[0.03]',
                ]"
              >
                {{ sub.name }}
              </router-link>
            </div>
          </div>
        </div>
      </nav>
    </div>

    <!-- Bottom Docked Links (Hairline Grid) -->
    <div class="border-t border-jetblack/10 divide-y divide-jetblack/10 shrink-0">
      <router-link
        v-if="isAdmin"
        to="/panel"
        class="flex items-center justify-between px-4 py-2.5 hover:bg-jetblack/[0.03] text-xs font-semibold text-jetblack transition"
      >
        <div class="flex items-center gap-2">
          <ShieldAlert class="w-3.5 h-3.5 text-gold" /><span>Admin Panel</span>
        </div>
        <ChevronRight class="w-3 h-3 text-jetblack/40" />
      </router-link>
      <div class="grid grid-cols-2 divide-x divide-jetblack/10">
        <a
          href="/docs/"
          target="_blank"
          class="flex items-center justify-center gap-1.5 px-2 py-2.5 hover:bg-jetblack/[0.03] text-[11px] font-semibold text-jetblack/70 hover:text-jetblack transition"
          title="Buku Dokumentasi"
        >
          <BookOpen class="w-3.5 h-3.5 text-gold shrink-0" />
          <span>Docs</span>
          <ExternalLink class="w-2.5 h-2.5 text-jetblack/35 shrink-0" />
        </a>
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
