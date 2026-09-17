<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api } from './lib/api'
import { authClient } from './lib/auth'
import { dashboardEnv, envPath, SANDBOX_PREFIX, type DashboardEnv } from './lib/environment'
import {
  LayoutDashboard,
  Boxes,
  CreditCard,
  KeyRound,
  Bot,
  BookOpen,
  Code2,
  ExternalLink,
  Globe,
  ShieldCheck,
  ShieldAlert,
  ChevronRight,
  Search,
  Ticket,
  LogOut
} from 'lucide-vue-next'

const route = useRoute()
const router = useRouter()
const env = dashboardEnv

const authSession = authClient.useSession()
const authUser = computed(() => authSession.value?.data?.user)
const authInitial = computed(() => (authUser.value?.name || authUser.value?.email || 'B').charAt(0).toUpperCase())

async function handleLogout() {
  try {
    await authClient.signOut()
  } catch {}
  router.push('/login')
}

const isPublicPage = computed(() => !!route.meta.public || !!route.meta.fullscreen)

// Kunci halaman tanpa prefix environment, mis. '/dashboard/sandbox/checkout' -> '/checkout'
function pageKey(path: string): string {
  const stripped = path.startsWith(SANDBOX_PREFIX)
    ? path.slice(SANDBOX_PREFIX.length)
    : path.startsWith('/dashboard')
      ? path.slice('/dashboard'.length)
      : path
  return stripped || '/'
}

const navKey = computed(() => pageKey(route.path))

const currentPage = computed(() => {
  switch (navKey.value) {
    case '/': return { title: 'Ringkasan Ekosistem', category: 'Overview' }
    case '/apps': return { title: 'Katalog Aplikasi Builder', category: 'Apps' }
    case '/checkout': return { title: 'Dynamic Checkout & MoR', category: 'Checkout' }
    case '/coupons': return { title: 'Kupon Diskon', category: 'Checkout' }
    case '/licensing': return { title: 'Lisensi & Anti-Piracy', category: 'Lisensi' }
    case '/ai-proxy': return { title: 'AI API Proxy Shield', category: 'AI Shield' }
    case '/docs': return { title: 'Dokumentasi & SDK', category: 'Docs' }
    default: return { title: 'Workspace', category: 'Dashboard' }
  }
})

interface NavSubItem {
  name: string
  path: string
}

interface NavItem {
  name: string
  key: string
  path: string
  icon: any
  children?: NavSubItem[]
}

const navItems = computed<NavItem[]>(() => {
  const e = env.value
  return [
    { name: 'Ringkasan', key: '/', path: envPath(e), icon: LayoutDashboard },
    { name: 'Aplikasi', key: '/apps', path: envPath(e, '/apps'), icon: Boxes },
    { name: 'Checkout', key: '/checkout', path: envPath(e, '/checkout'), icon: CreditCard },
    { name: 'Kupon', key: '/coupons', path: envPath(e, '/coupons'), icon: Ticket },
    { name: 'Lisensi', key: '/licensing', path: envPath(e, '/licensing'), icon: KeyRound },
    { name: 'AI Shield', key: '/ai-proxy', path: envPath(e, '/ai-proxy'), icon: Bot },
    { name: 'Docs', key: '/docs', path: envPath(e, '/docs'), icon: BookOpen },
  ]
})

function switchEnv(target: DashboardEnv) {
  if (target === env.value) return
  const key = navKey.value
  router.push(envPath(target, key === '/' ? '' : key))
}

// ===== Badge jumlah item aktif di sidebar (Kupon & Lisensi) =====
const activeCouponCount = ref(0)
const activeLicenseCount = ref(0)

async function loadActiveCouponCount() {
  try {
    const res = await api.getCoupons()
    activeCouponCount.value = (res.coupons || []).filter((c) => c.isActive).length
  } catch {
    // Badge hanya penanda — kegagalan fetch tidak boleh merusak layout
  }
}

async function loadActiveLicenseCount() {
  try {
    const res = await api.getLicenses()
    activeLicenseCount.value = (res.licenses || []).filter((l) => l.status === 'ACTIVE').length
  } catch {
    // Sama seperti kupon: badge tidak boleh merusak layout
  }
}

function loadSidebarBadges() {
  loadActiveCouponCount()
  loadActiveLicenseCount()
}

// Muat saat pertama masuk dashboard & segarkan setiap pindah halaman dashboard
watch(
  () => route.path,
  (path) => {
    if (path.startsWith('/dashboard')) loadSidebarBadges()
  }
)

// Segarkan instan saat kupon dibuat/diubah/dihapus (event dari CouponView)
function onCouponsChanged() {
  loadActiveCouponCount()
}

// Segarkan instan saat lisensi diterbitkan/dicabut (event dari LicensingView)
function onLicensesChanged() {
  loadActiveLicenseCount()
}

onMounted(() => {
  if (route.path.startsWith('/dashboard')) loadSidebarBadges()
  window.addEventListener('tertaut:coupons-changed', onCouponsChanged)
  window.addEventListener('tertaut:licenses-changed', onLicensesChanged)
})

onUnmounted(() => {
  window.removeEventListener('tertaut:coupons-changed', onCouponsChanged)
  window.removeEventListener('tertaut:licenses-changed', onLicensesChanged)
})
</script>

<template>
  <!-- Public Full-Width Layout (for /, /pay/:slug, /portal, /panel) -->
  <div v-if="isPublicPage" class="min-h-screen bg-white text-[#111111] font-sans">
    <router-view />
  </div>

  <!-- Developer Dashboard Layout (with luxury sidebar, top header, bottom bar) -->
  <div v-else class="min-h-screen bg-[#FFFFFF] text-[#111111] flex flex-col md:flex-row font-sans pb-16 md:pb-0">
    <!-- Desktop Compact Luxury Sidebar -->
    <aside class="hidden md:flex w-56 flex-col justify-between p-4 border-r border-[#111111]/10 bg-[#FFFFFF] sticky top-0 h-screen shrink-0 z-30">
      <div class="space-y-5">
        <!-- Brand Header -->
        <router-link to="/" class="flex items-center gap-2.5 px-2 py-1 group">
          <div class="w-8 h-8 rounded-lg bg-[#111111] flex items-center justify-center font-bold text-white shadow-md relative overflow-hidden group-hover:scale-105 transition">
            <span class="text-sm font-black tracking-tighter">T</span>
            <span class="absolute bottom-1 right-1 w-1.5 h-1.5 rounded-full bg-[#D4AF37] shadow-[0_0_6px_#D4AF37]"></span>
          </div>
          <div>
            <div class="font-extrabold text-sm tracking-tight text-[#111111] flex items-center gap-0.5 font-mono">
              tertaut<span class="text-[#D4AF37]">.com</span>
            </div>
            <div class="text-[10px] text-[#111111]/50 font-medium">Developer Engine</div>
          </div>
        </router-link>

        <!-- Environment Switch (global) -->
        <div class="grid grid-cols-2 gap-1 p-1 rounded-lg bg-[#111111]/5 border border-[#111111]/10">
          <button
            type="button"
            @click="switchEnv('sandbox')"
            :class="env === 'sandbox' ? 'bg-[#D4AF37] text-[#111111] shadow-sm' : 'text-[#111111]/60 hover:text-[#111111]'"
            class="py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wide transition"
          >
            Sandbox
          </button>
          <button
            type="button"
            @click="switchEnv('live')"
            :class="env === 'live' ? 'bg-[#0F4C3A] text-white shadow-sm' : 'text-[#111111]/60 hover:text-[#111111]'"
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
                'flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-150',
                navKey === item.key
                  ? 'bg-[#111111] text-white shadow-sm'
                  : 'text-[#111111]/75 hover:text-[#111111] hover:bg-[#111111]/5'
              ]"
            >
              <div class="flex items-center gap-2.5">
                <component
                  :is="item.icon"
                  class="w-4 h-4 transition"
                  :class="navKey === item.key ? 'text-[#D4AF37]' : 'text-[#111111]/60'"
                />
                <span>{{ item.name }}</span>
              </div>
              <!-- Badge jumlah item aktif (Kupon & Lisensi) -->
              <span
                v-if="item.key === '/coupons' && activeCouponCount > 0"
                class="px-1.5 min-w-[18px] text-center py-0.5 rounded-full text-[9px] font-black leading-none"
                :class="
                  navKey === item.key
                    ? 'bg-[#D4AF37] text-[#111111]'
                    : 'bg-[#D4AF37]/20 text-[#D4AF37]'
                "
              >{{ activeCouponCount }}</span>
              <span
                v-else-if="item.key === '/licensing' && activeLicenseCount > 0"
                class="px-1.5 min-w-[18px] text-center py-0.5 rounded-full text-[9px] font-black leading-none"
                :class="
                  navKey === item.key
                    ? 'bg-[#D4AF37] text-[#111111]'
                    : 'bg-[#0F4C3A]/15 text-[#0F4C3A]'
                "
              >{{ activeLicenseCount }}</span>
              <span
                v-else-if="navKey === item.key"
                class="w-1.5 h-1.5 rounded-full bg-[#D4AF37] shadow-[0_0_8px_#D4AF37]"
              ></span>
            </router-link>

            <!-- Sub-menu navigation items -->
            <div
              v-if="item.children && route.path.startsWith(item.path)"
              class="pl-4 pr-1 py-1 space-y-1 border-l-2 border-[#D4AF37]/30 ml-4 my-1 animate-in fade-in duration-200"
            >
              <router-link
                v-for="sub in item.children"
                :key="sub.path"
                :to="sub.path"
                :class="[
                  'block px-2.5 py-1.5 rounded-md text-[11px] font-medium transition',
                  route.path === sub.path
                    ? 'text-[#111111] font-bold bg-[#D4AF37]/20 border border-[#D4AF37]/40'
                    : 'text-[#111111]/65 hover:text-[#111111] hover:bg-[#111111]/5'
                ]"
              >
                {{ sub.name }}
              </router-link>
            </div>
          </div>
        </nav>
      </div>

      <!-- Bottom Card & Status -->
      <div class="space-y-2 pt-3 border-t border-[#111111]/10">
        <router-link
          to="/portal"
          class="flex items-center justify-between px-3 py-1.5 rounded-lg bg-[#111111]/5 hover:bg-[#111111]/10 text-xs font-semibold text-[#111111] transition border border-[#111111]/10"
        >
          <div class="flex items-center gap-2">
            <ShieldCheck class="w-3.5 h-3.5 text-[#0F4C3A]" />
            <span>Portal Pembeli</span>
          </div>
          <ExternalLink class="w-3 h-3 text-[#111111]/40" />
        </router-link>

        <router-link
          to="/panel"
          class="flex items-center justify-between px-3 py-1.5 rounded-lg bg-[#111111]/5 hover:bg-[#111111]/10 text-xs font-semibold text-[#111111] transition border border-[#111111]/10"
        >
          <div class="flex items-center gap-2">
            <ShieldAlert class="w-3.5 h-3.5 text-[#D4AF37]" />
            <span>Admin Panel</span>
          </div>
          <ExternalLink class="w-3 h-3 text-[#111111]/40" />
        </router-link>

        <router-link
          to="/"
          class="flex items-center justify-between px-3 py-1.5 rounded-lg hover:bg-[#111111]/5 text-xs font-medium text-[#111111]/70 transition"
        >
          <div class="flex items-center gap-2">
            <Globe class="w-3.5 h-3.5" />
            <span>Beranda Publik</span>
          </div>
          <ExternalLink class="w-3 h-3 text-[#111111]/40" />
        </router-link>

        <a
          href="/swagger"
          target="_blank"
          class="flex items-center justify-between px-3 py-1.5 rounded-lg hover:bg-[#111111]/5 text-xs font-medium text-[#111111]/70 transition"
        >
          <div class="flex items-center gap-2">
            <Code2 class="w-3.5 h-3.5 text-[#D4AF37]" />
            <span>API Docs</span>
          </div>
          <ExternalLink class="w-3 h-3 text-[#111111]/40" />
        </a>

        <div class="p-2.5 rounded-lg bg-[#111111] text-white space-y-1 text-[11px] shadow-sm">
          <div class="flex items-center justify-between">
            <span class="text-[10px] font-bold uppercase tracking-wider text-[#D4AF37]">MoR Engine</span>
            <span class="w-1.5 h-1.5 rounded-full bg-[#0F4C3A] ring-2 ring-[#0F4C3A]/40 animate-pulse"></span>
          </div>
          <div class="text-[10px] text-white/75 font-mono">Bun + Xendit Rail</div>
        </div>
      </div>
    </aside>

    <!-- Right Area: Header + Main Content -->
    <div class="flex-1 min-w-0 flex flex-col min-h-screen md:h-screen overflow-hidden">
      <!-- Desktop Dashboard Top Header -->
      <header class="hidden md:flex items-center justify-between px-6 py-3 border-b border-[#111111]/10 bg-white/90 backdrop-blur-md shrink-0 z-20">
        <!-- Left: Breadcrumb / Category / Title -->
        <div class="flex items-center gap-3">
          <div class="flex items-center gap-1.5 text-xs text-[#111111]/50 font-medium">
            <span class="hover:text-[#111111] transition cursor-default">Dashboard</span>
            <ChevronRight class="w-3 h-3 text-[#111111]/30" />
            <span class="text-[#D4AF37] font-semibold">{{ currentPage.category }}</span>
            <ChevronRight class="w-3 h-3 text-[#111111]/30" />
          </div>
          <h2 class="text-sm font-bold text-[#111111] tracking-tight flex items-center gap-2">
            <span>{{ currentPage.title }}</span>
            <span class="px-2 py-0.5 rounded-full bg-[#111111]/5 text-[#111111]/60 text-[10px] font-mono font-normal">v2.2</span>
          </h2>
        </div>

        <!-- Right: Actions, Live Status, Search Bar & Profile -->
        <div class="flex items-center gap-3">
          <!-- Quick Search Bar -->
          <div class="relative hidden lg:block">
            <Search class="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#111111]/40" />
            <input
              type="text"
              placeholder="Cari kampanye, token, webhook..."
              class="w-52 pl-8 pr-8 py-1.5 rounded-lg bg-[#111111]/5 hover:bg-[#111111]/8 focus:bg-white border border-[#111111]/10 focus:border-[#D4AF37] text-xs text-[#111111] placeholder:text-[#111111]/40 transition outline-none"
            />
            <kbd class="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-mono text-[#111111]/40 bg-white px-1.5 py-0.5 rounded border border-[#111111]/10">⌘K</kbd>
          </div>

          <!-- Environment Status Pill -->
          <div
            class="flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-semibold"
            :class="env === 'sandbox' ? 'bg-[#D4AF37]/15 border-[#D4AF37]/30 text-[#8a6d1f]' : 'bg-[#0F4C3A]/10 border-[#0F4C3A]/20 text-[#0F4C3A]'"
            :title="env === 'sandbox' ? 'Environment Sandbox: pembayaran disimulasikan' : 'Environment Live: Xendit produksi aktif'"
          >
            <span class="w-1.5 h-1.5 rounded-full animate-pulse" :class="env === 'sandbox' ? 'bg-[#D4AF37]' : 'bg-[#0F4C3A]'"></span>
            <span>{{ env === 'sandbox' ? 'Sandbox Mode' : 'MoR Live' }}</span>
          </div>

          <!-- Quick Action Buttons -->
          <div class="flex items-center gap-1 border-l border-r border-[#111111]/10 px-2">
            <router-link
              to="/"
              target="_blank"
              class="p-1.5 rounded-md hover:bg-[#111111]/5 text-[#111111]/60 hover:text-[#111111] transition"
              title="Kunjungi Beranda Publik"
            >
              <Globe class="w-4 h-4" />
            </router-link>
            <a
              href="/swagger"
              target="_blank"
              class="p-1.5 rounded-md hover:bg-[#111111]/5 text-[#111111]/60 hover:text-[#111111] transition"
              title="Buka Swagger API Docs"
            >
              <Code2 class="w-4 h-4" />
            </a>
          </div>

          <!-- Builder Profile Snippet -->
          <div class="flex items-center gap-2 pl-1">
            <div class="w-7 h-7 rounded-full bg-[#111111] text-white flex items-center justify-center font-bold text-xs shadow-sm ring-2 ring-[#D4AF37]/40">
              {{ authInitial }}
            </div>
            <div class="hidden xl:block text-left">
              <div class="text-xs font-bold text-[#111111] leading-none">{{ authUser?.name || 'Builder' }}</div>
              <div class="text-[10px] text-[#111111]/50 font-medium">{{ authUser?.email || 'Belum login' }}</div>
            </div>
            <button
              v-if="authUser"
              type="button"
              class="p-1.5 rounded-md hover:bg-[#111111]/5 text-[#111111]/50 hover:text-red-500 transition"
              title="Keluar"
              @click="handleLogout"
            >
              <LogOut class="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <!-- Mobile Top Compact App Bar -->
      <header class="md:hidden flex items-center justify-between px-4 py-2.5 bg-[#FFFFFF] border-b border-[#111111]/10 sticky top-0 z-40">
        <router-link to="/" class="flex items-center gap-2">
          <div class="w-7 h-7 rounded-md bg-[#111111] flex items-center justify-center font-bold text-white text-xs relative">
            T
            <span class="absolute bottom-0.5 right-0.5 w-1 h-1 rounded-full bg-[#D4AF37]"></span>
          </div>
          <span class="font-extrabold text-xs tracking-tight text-[#111111] font-mono">
            tertaut<span class="text-[#D4AF37]">.com</span>
          </span>
        </router-link>

        <div class="flex items-center gap-2">
          <button
            type="button"
            @click="switchEnv(env === 'sandbox' ? 'live' : 'sandbox')"
            class="px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide border"
            :class="env === 'sandbox' ? 'bg-[#D4AF37]/15 border-[#D4AF37]/40 text-[#8a6d1f]' : 'bg-[#0F4C3A]/10 border-[#0F4C3A]/30 text-[#0F4C3A]'"
            :title="env === 'sandbox' ? 'Beralih ke Live' : 'Beralih ke Sandbox'"
          >
            {{ env === 'sandbox' ? 'Sandbox' : 'Live' }}
          </button>
          <router-link
            to="/"
            class="p-1.5 rounded-md bg-[#111111]/5 text-[#111111] text-xs flex items-center gap-1"
            title="Ke Halaman Publik"
          >
            <Globe class="w-3.5 h-3.5 text-[#0F4C3A]" />
          </router-link>
          <a
            href="/swagger"
            target="_blank"
            class="p-1.5 rounded-md bg-[#111111]/5 text-[#111111] text-xs"
          >
            <Code2 class="w-3.5 h-3.5 text-[#D4AF37]" />
          </a>
        </div>
      </header>

      <!-- Main Workspace Container (Full Width & Aligned with Header) -->
      <main class="flex-1 min-w-0 px-4 py-5 md:px-6 md:py-6 overflow-y-auto w-full">
        <router-view />
      </main>
    </div>

    <!-- Mobile Bottom Navigation Bar (Mobile First Thumb Reachable) -->
    <nav class="md:hidden fixed bottom-0 left-0 right-0 h-14 bg-[#FFFFFF]/95 backdrop-blur-md border-t border-[#111111]/10 flex items-center justify-around px-2 z-50 shadow-[0_-4px_16px_rgba(17,17,17,0.06)]">
      <router-link
        v-for="item in navItems"
        :key="item.path"
        :to="item.path"
          :class="[
            'flex flex-col items-center justify-center flex-1 h-full py-1 text-[10px] font-semibold transition-all relative',
            navKey === item.key
              ? 'text-[#111111]'
              : 'text-[#111111]/50 hover:text-[#111111]'
          ]"
        >
          <component
            :is="item.icon"
            class="w-4 h-4 mb-0.5"
            :class="navKey === item.key ? 'text-[#D4AF37]' : ''"
          />
          <!-- Badge mobile: jumlah item aktif di pojok ikon (Kupon & Lisensi) -->
          <span
            v-if="item.key === '/coupons' && activeCouponCount > 0"
            class="absolute top-1 right-[calc(50%-15px)] min-w-[14px] px-1 py-px rounded-full bg-[#D4AF37] text-[#111111] text-[8px] font-black leading-tight text-center shadow-sm"
          >{{ activeCouponCount }}</span>
          <span
            v-else-if="item.key === '/licensing' && activeLicenseCount > 0"
            class="absolute top-1 right-[calc(50%-15px)] min-w-[14px] px-1 py-px rounded-full bg-[#0F4C3A] text-white text-[8px] font-black leading-tight text-center shadow-sm"
          >{{ activeLicenseCount }}</span>
          <span class="truncate max-w-[56px] leading-tight">{{ item.name }}</span>
          <span
            v-if="navKey === item.key"
            class="absolute top-0 w-8 h-0.5 bg-[#D4AF37] rounded-full"
          ></span>
      </router-link>
    </nav>
  </div>
</template>
