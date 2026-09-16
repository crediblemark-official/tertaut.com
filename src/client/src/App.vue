<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import {
  LayoutDashboard,
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
  Search
} from 'lucide-vue-next'

const route = useRoute()

const isPublicPage = computed(() => !!route.meta.public || !!route.meta.fullscreen)

const currentPage = computed(() => {
  if (route.path === '/dashboard') return { title: 'Ringkasan Ekosistem', category: 'Overview' }
  if (route.path.startsWith('/dashboard/checkout')) return { title: 'Dynamic Checkout & MoR', category: 'Checkout' }
  if (route.path.startsWith('/dashboard/licensing')) return { title: 'Lisensi & Anti-Piracy', category: 'Lisensi' }
  if (route.path.startsWith('/dashboard/ai-proxy')) return { title: 'AI API Proxy Shield', category: 'AI Shield' }
  if (route.path.startsWith('/dashboard/docs')) return { title: 'Dokumentasi & SDK', category: 'Docs' }
  return { title: 'Workspace', category: 'Dashboard' }
})

interface NavSubItem {
  name: string
  path: string
}

interface NavItem {
  name: string
  path: string
  icon: any
  children?: NavSubItem[]
}

const navItems: NavItem[] = [
  { name: 'Ringkasan', path: '/dashboard', icon: LayoutDashboard },

  { name: 'Checkout', path: '/dashboard/checkout', icon: CreditCard },
  { name: 'Lisensi', path: '/dashboard/licensing', icon: KeyRound },
  { name: 'AI Shield', path: '/dashboard/ai-proxy', icon: Bot },
  { name: 'Docs', path: '/dashboard/docs', icon: BookOpen },
]
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

        <!-- Navigation Menu -->
        <nav class="space-y-1">
          <div v-for="item in navItems" :key="item.path" class="space-y-0.5">
            <router-link
              :to="item.path"
              :class="[
                'flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-150',
                route.path === item.path || (item.children && route.path.startsWith(item.path))
                  ? 'bg-[#111111] text-white shadow-sm'
                  : 'text-[#111111]/75 hover:text-[#111111] hover:bg-[#111111]/5'
              ]"
            >
              <div class="flex items-center gap-2.5">
                <component
                  :is="item.icon"
                  class="w-4 h-4 transition"
                  :class="route.path === item.path || (item.children && route.path.startsWith(item.path)) ? 'text-[#D4AF37]' : 'text-[#111111]/60'"
                />
                <span>{{ item.name }}</span>
              </div>
              <span
                v-if="route.path === item.path || (item.children && route.path.startsWith(item.path))"
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

          <!-- Live Network Status Pill -->
          <div class="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#0F4C3A]/10 border border-[#0F4C3A]/20 text-[11px] font-semibold text-[#0F4C3A]" title="Semua service Xendit MoR & Relay beroperasi normal">
            <span class="w-1.5 h-1.5 rounded-full bg-[#0F4C3A] animate-pulse"></span>
            <span>MoR Live</span>
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
              B
            </div>
            <div class="hidden xl:block text-left">
              <div class="text-xs font-bold text-[#111111] leading-none">Solo Builder</div>
              <div class="text-[10px] text-[#111111]/50 font-medium">Developer Tier</div>
            </div>
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
          route.path === item.path
            ? 'text-[#111111]'
            : 'text-[#111111]/50 hover:text-[#111111]'
        ]"
      >
        <component
          :is="item.icon"
          class="w-4 h-4 mb-0.5"
          :class="route.path === item.path ? 'text-[#D4AF37]' : ''"
        />
        <span class="truncate max-w-[56px] leading-tight">{{ item.name }}</span>
        <span
          v-if="route.path === item.path"
          class="absolute top-0 w-8 h-0.5 bg-[#D4AF37] rounded-full"
        ></span>
      </router-link>
    </nav>
  </div>
</template>
