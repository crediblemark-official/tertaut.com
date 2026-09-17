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
  ShieldAlert,
  ChevronRight,
  Search,
  Ticket,
  LogOut,
  LogIn,
  MoreHorizontal,
  X
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

const isStandaloneLayout = computed(() => !!route.meta.public || !!route.meta.standalone || route.path.startsWith('/panel'))

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
    case '/panel': return { title: 'Super Admin Panel', category: 'Admin Panel' }
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

// Menu Navigasi Mobile: Dibatasi maksimal 5 item (4 utama + 1 Lainnya/More)
const mobileNavItems = computed<NavItem[]>(() => {
  const e = env.value
  return [
    { name: 'Ringkasan', key: '/', path: envPath(e), icon: LayoutDashboard },
    { name: 'Aplikasi', key: '/apps', path: envPath(e, '/apps'), icon: Boxes },
    { name: 'Checkout', key: '/checkout', path: envPath(e, '/checkout'), icon: CreditCard },
    { name: 'Lisensi', key: '/licensing', path: envPath(e, '/licensing'), icon: KeyRound },
  ]
})

const isMobileMoreOpen = ref(false)

const isMoreActive = computed(() => {
  return ['/coupons', '/ai-proxy', '/docs'].includes(navKey.value)
})

const moreBadgeCount = computed(() => {
  return activeCouponCount.value
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
    isMobileMoreOpen.value = false
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
  <!-- Standalone Full-Width Layout (for /, /login, /pay/:slug, /panel) -->
  <div v-if="isStandaloneLayout" class="min-h-screen bg-white text-[#111111] font-sans">
    <router-view />
  </div>

  <!-- Developer Dashboard Layout (with luxury sidebar, top header, bottom bar) -->
  <div v-else class="min-h-screen bg-[#FFFFFF] text-[#111111] flex flex-col md:flex-row font-sans pb-24 md:pb-0">
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
      <div class="space-y-1.5 pt-3 border-t border-[#111111]/10">
        <router-link
          to="/panel"
          class="flex items-center justify-between px-3 py-1.5 rounded-lg bg-[#111111]/5 hover:bg-[#111111]/10 text-xs font-semibold text-[#111111] transition border border-[#111111]/10"
        >
          <div class="flex items-center gap-2">
            <ShieldAlert class="w-3.5 h-3.5 text-[#D4AF37]" />
            <span>Admin Panel</span>
          </div>
          <ChevronRight class="w-3 h-3 text-[#111111]/40" />
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
            <Search class="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Cari fitur, aplikasi, dokumen..."
              class="w-60 xl:w-72 pl-9 pr-10 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200/60 focus:bg-white border border-slate-200/80 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 text-xs font-medium text-slate-900 placeholder:text-slate-400 transition-all outline-none"
            />
            <kbd class="absolute right-2.5 top-1/2 -translate-y-1/2 text-[9.5px] font-mono text-slate-400 bg-white px-1.5 py-0.5 rounded-md border border-slate-200/90 shadow-2xs pointer-events-none">⌘K</kbd>
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

          <!-- Builder Profile Snippet & Prominent Log Out / Log In -->
          <div class="flex items-center gap-2 pl-1">
            <div class="w-7 h-7 rounded-full bg-[#111111] text-white flex items-center justify-center font-bold text-xs shadow-sm ring-2 ring-[#D4AF37]/40">
              {{ authInitial }}
            </div>
            <div class="hidden xl:block text-left pr-1">
              <div class="text-xs font-bold text-[#111111] leading-none">{{ authUser?.name || 'Builder' }}</div>
              <div class="text-[10px] text-[#111111]/50 font-medium">{{ authUser?.email || 'Belum login' }}</div>
            </div>

            <!-- Clear Action Buttons -->
            <button
              v-if="authUser"
              type="button"
              class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[#111111]/15 bg-white hover:border-red-500/30 hover:bg-red-50 hover:text-red-600 text-xs font-bold text-[#111111]/70 transition shadow-xs"
              title="Keluar dari akun (Log Out)"
              @click="handleLogout"
            >
              <LogOut class="w-3.5 h-3.5 text-red-500" />
              <span>Keluar</span>
            </button>
            <div v-else class="flex items-center gap-1.5">
              <router-link
                to="/login"
                class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#D4AF37] hover:bg-[#C5A059] text-xs font-bold text-[#111111] transition shadow-xs"
              >
                <LogIn class="w-3.5 h-3.5" />
                <span>Masuk</span>
              </router-link>
              <button
                type="button"
                class="p-1.5 rounded-md hover:bg-red-50 text-[#111111]/40 hover:text-red-600 transition"
                title="Reset Sesi"
                @click="handleLogout"
              >
                <LogOut class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <!-- Mobile Top Compact App Bar (Two-Tier Contextual Bar) -->
      <header class="md:hidden bg-[#FFFFFF] border-b border-[#111111]/10 sticky top-0 z-40 shadow-xs">
        <!-- Top Row: Brand & Quick Switches -->
        <div class="flex items-center justify-between px-3.5 py-2">
          <router-link to="/" class="flex items-center gap-2 group">
            <div class="w-7 h-7 rounded-md bg-[#111111] flex items-center justify-center font-bold text-white text-xs relative shadow-xs">
              T
              <span class="absolute bottom-0.5 right-0.5 w-1 h-1 rounded-full bg-[#D4AF37]"></span>
            </div>
            <span class="font-extrabold text-xs tracking-tight text-[#111111] font-mono">
              tertaut<span class="text-[#D4AF37]">.com</span>
            </span>
          </router-link>

          <div class="flex items-center gap-1.5">
            <!-- Sandbox / Live Switch Button -->
            <button
              type="button"
              @click="switchEnv(env === 'sandbox' ? 'live' : 'sandbox')"
              class="px-2.5 py-1 min-h-[30px] rounded-lg text-[10.5px] font-bold uppercase tracking-wide border transition flex items-center gap-1 active:scale-95"
              :class="env === 'sandbox' ? 'bg-[#D4AF37]/15 border-[#D4AF37]/50 text-[#8a6d1f]' : 'bg-[#0F4C3A]/10 border-[#0F4C3A]/40 text-[#0F4C3A]'"
              :title="env === 'sandbox' ? 'Beralih ke Live' : 'Beralih ke Sandbox'"
            >
              <span class="w-1.5 h-1.5 rounded-full" :class="env === 'sandbox' ? 'bg-[#D4AF37]' : 'bg-[#0F4C3A]'"></span>
              <span>{{ env === 'sandbox' ? 'Sandbox' : 'Live' }}</span>
            </button>

            <!-- Admin Link Quick Pill -->
            <router-link
              to="/panel"
              class="p-1.5 min-w-[32px] min-h-[32px] rounded-lg bg-[#111111]/5 hover:bg-[#111111]/10 text-[#111111] text-xs flex items-center justify-center transition"
              title="Super Admin Panel"
            >
              <ShieldAlert class="w-4 h-4 text-[#D4AF37]" />
            </router-link>

            <!-- Auth Quick Profile or Login -->
            <button
              v-if="authUser"
              type="button"
              @click="handleLogout"
              class="p-1.5 min-w-[32px] min-h-[32px] rounded-lg bg-red-50 text-red-600 text-xs flex items-center justify-center transition active:scale-95"
              title="Keluar dari akun"
            >
              <LogOut class="w-3.5 h-3.5" />
            </button>
            <router-link
              v-else
              to="/login"
              class="px-2.5 py-1 min-h-[30px] rounded-lg bg-[#111111] text-white text-[11px] font-bold flex items-center gap-1"
            >
              <LogIn class="w-3.5 h-3.5 text-[#D4AF37]" />
              <span>Masuk</span>
            </router-link>
          </div>
        </div>

        <!-- Bottom Row Context Bar: Category & Active Title -->
        <div class="px-3.5 py-1.5 bg-[#111111]/[0.02] border-t border-[#111111]/5 flex items-center justify-between text-[11px]">
          <div class="flex items-center gap-1.5 font-medium text-[#111111]/60 truncate">
            <span class="text-[#D4AF37] font-bold">{{ currentPage.category }}</span>
            <span>•</span>
            <span class="text-[#111111] font-semibold truncate">{{ currentPage.title }}</span>
          </div>
          <span class="text-[9.5px] font-mono text-[#111111]/40 shrink-0">v2.2</span>
        </div>
      </header>

      <!-- Main Workspace Container (Full Width, Thumb Friendly Padding) -->
      <main class="flex-1 min-w-0 px-3.5 py-4 sm:px-4 sm:py-5 md:px-6 md:py-6 overflow-y-auto w-full pb-28 md:pb-6">
        <router-view />
      </main>
    </div>

    <!-- Mobile Bottom Navigation Bar (Maksimal 5 Item: Ringkasan, Aplikasi, Checkout, Lisensi, Lainnya) -->
    <nav class="md:hidden fixed bottom-0 left-0 right-0 h-16 pb-[env(safe-area-inset-bottom,0px)] bg-[#FFFFFF]/95 backdrop-blur-md border-t border-[#111111]/10 flex items-center px-1 z-50 shadow-[0_-4px_20px_rgba(17,17,17,0.08)]">
      <div class="flex items-center w-full justify-around px-0.5">
        <!-- 4 Item Utama -->
        <router-link
          v-for="item in mobileNavItems"
          :key="item.path"
          :to="item.path"
          :class="[
            'flex flex-col items-center justify-center flex-1 h-14 py-1 text-[10px] font-semibold transition-all relative rounded-lg active:scale-95',
            navKey === item.key
              ? 'text-[#111111] font-bold'
              : 'text-[#111111]/50 hover:text-[#111111]'
          ]"
        >
          <component
            :is="item.icon"
            class="w-4 h-4 mb-1 transition-transform"
            :class="navKey === item.key ? 'text-[#D4AF37] scale-110' : ''"
          />
          <!-- Badge mobile lisensi aktif -->
          <span
            v-if="item.key === '/licensing' && activeLicenseCount > 0"
            class="absolute top-1 right-[calc(50%-14px)] min-w-[15px] px-1 py-px rounded-full bg-[#0F4C3A] text-white text-[8px] font-black leading-tight text-center shadow-xs"
          >{{ activeLicenseCount }}</span>
          <span class="truncate max-w-[55px] leading-tight text-[9.5px]">{{ item.name }}</span>
          <span
            v-if="navKey === item.key"
            class="absolute top-0.5 w-6 h-0.5 bg-[#D4AF37] rounded-full shadow-[0_0_4px_#D4AF37]"
          ></span>
        </router-link>

        <!-- Item ke-5: Lainnya (Membuka Bottom Sheet untuk Kupon, AI Shield, Docs, dll) -->
        <button
          type="button"
          @click="isMobileMoreOpen = !isMobileMoreOpen"
          :class="[
            'flex flex-col items-center justify-center flex-1 h-14 py-1 text-[10px] font-semibold transition-all relative rounded-lg active:scale-95 cursor-pointer',
            isMoreActive || isMobileMoreOpen
              ? 'text-[#111111] font-bold'
              : 'text-[#111111]/50 hover:text-[#111111]'
          ]"
        >
          <MoreHorizontal
            class="w-4 h-4 mb-1 transition-transform"
            :class="(isMoreActive || isMobileMoreOpen) ? 'text-[#D4AF37] scale-110' : ''"
          />
          <!-- Badge kupon aktif pada tombol Lainnya jika belum membuka kupon -->
          <span
            v-if="moreBadgeCount > 0 && navKey !== '/coupons'"
            class="absolute top-1 right-[calc(50%-14px)] min-w-[15px] px-1 py-px rounded-full bg-[#D4AF37] text-[#111111] text-[8px] font-black leading-tight text-center shadow-xs"
          >{{ moreBadgeCount }}</span>
          <span class="truncate max-w-[55px] leading-tight text-[9.5px]">
            {{ isMoreActive ? (navKey === '/coupons' ? 'Kupon' : navKey === '/ai-proxy' ? 'AI Shield' : 'Docs') : 'Lainnya' }}
          </span>
          <span
            v-if="isMoreActive || isMobileMoreOpen"
            class="absolute top-0.5 w-6 h-0.5 bg-[#D4AF37] rounded-full shadow-[0_0_4px_#D4AF37]"
          ></span>
        </button>
      </div>
    </nav>

    <!-- Mobile 'Lainnya' Menu Sheet (Backdrop + Bottom Sheet) -->
    <div
      v-if="isMobileMoreOpen"
      class="md:hidden fixed inset-0 z-50 flex flex-col justify-end"
    >
      <!-- Backdrop -->
      <div
        class="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
        @click="isMobileMoreOpen = false"
      ></div>

      <!-- Sheet Container -->
      <div class="relative bg-white rounded-t-2xl p-4 border-t border-[#111111]/10 shadow-[0_-8px_30px_rgba(0,0,0,0.12)] z-10 space-y-3 pb-[calc(env(safe-area-inset-bottom,0px)+76px)] animate-fadeIn">
        <!-- Header -->
        <div class="flex items-center justify-between pb-2 border-b border-[#111111]/10">
          <div class="flex items-center gap-2">
            <span class="w-1.5 h-4 bg-[#D4AF37] rounded-full"></span>
            <h3 class="text-xs font-bold text-[#111111] uppercase tracking-wider">Menu Tambahan</h3>
          </div>
          <button
            @click="isMobileMoreOpen = false"
            class="p-1 rounded-md text-[#111111]/50 hover:bg-[#111111]/5 cursor-pointer"
          >
            <X class="w-4 h-4" />
          </button>
        </div>

        <!-- Sheet Items Grid -->
        <div class="grid grid-cols-2 gap-2">
          <!-- Kupon Diskon -->
          <router-link
            :to="envPath(env, '/coupons')"
            @click="isMobileMoreOpen = false"
            class="flex items-center gap-2.5 p-3 rounded-xl border transition-all text-left cursor-pointer active:scale-95"
            :class="navKey === '/coupons' ? 'bg-[#D4AF37]/10 border-[#D4AF37]/40 text-[#111111] font-bold' : 'bg-[#111111]/[0.02] border-[#111111]/10 text-[#111111]/80 hover:bg-[#111111]/5'"
          >
            <div class="w-8 h-8 rounded-lg bg-[#D4AF37]/20 flex items-center justify-center text-[#111111] shrink-0">
              <Ticket class="w-4 h-4" />
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-xs font-bold leading-tight">Kupon Diskon</div>
              <div class="text-[10px] text-[#111111]/50 truncate">{{ activeCouponCount }} Aktif</div>
            </div>
          </router-link>

          <!-- AI Proxy Shield -->
          <router-link
            :to="envPath(env, '/ai-proxy')"
            @click="isMobileMoreOpen = false"
            class="flex items-center gap-2.5 p-3 rounded-xl border transition-all text-left cursor-pointer active:scale-95"
            :class="navKey === '/ai-proxy' ? 'bg-[#0F4C3A]/10 border-[#0F4C3A]/40 text-[#111111] font-bold' : 'bg-[#111111]/[0.02] border-[#111111]/10 text-[#111111]/80 hover:bg-[#111111]/5'"
          >
            <div class="w-8 h-8 rounded-lg bg-[#0F4C3A]/15 flex items-center justify-center text-[#0F4C3A] shrink-0">
              <Bot class="w-4 h-4" />
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-xs font-bold leading-tight">AI Proxy Shield</div>
              <div class="text-[10px] text-[#111111]/50 truncate">Audit & Guard</div>
            </div>
          </router-link>

          <!-- Dokumentasi & SDK -->
          <router-link
            :to="envPath(env, '/docs')"
            @click="isMobileMoreOpen = false"
            class="flex items-center gap-2.5 p-3 rounded-xl border transition-all text-left cursor-pointer active:scale-95"
            :class="navKey === '/docs' ? 'bg-[#111111]/10 border-[#111111]/30 text-[#111111] font-bold' : 'bg-[#111111]/[0.02] border-[#111111]/10 text-[#111111]/80 hover:bg-[#111111]/5'"
          >
            <div class="w-8 h-8 rounded-lg bg-[#111111]/10 flex items-center justify-center text-[#111111] shrink-0">
              <BookOpen class="w-4 h-4" />
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-xs font-bold leading-tight">Dokumentasi</div>
              <div class="text-[10px] text-[#111111]/50 truncate">SDK & API</div>
            </div>
          </router-link>

          <!-- Super Admin Panel -->
          <router-link
            to="/panel"
            @click="isMobileMoreOpen = false"
            class="flex items-center gap-2.5 p-3 rounded-xl border border-[#111111]/10 bg-[#111111]/[0.02] text-[#111111]/80 hover:bg-[#111111]/5 transition-all text-left cursor-pointer active:scale-95"
          >
            <div class="w-8 h-8 rounded-lg bg-[#111111]/10 flex items-center justify-center text-[#111111] shrink-0">
              <ShieldAlert class="w-4 h-4" />
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-xs font-bold leading-tight">Admin Panel</div>
              <div class="text-[10px] text-[#111111]/50 truncate">Super Admin Ledger</div>
            </div>
          </router-link>
        </div>
      </div>
    </div>
  </div>
</template>
