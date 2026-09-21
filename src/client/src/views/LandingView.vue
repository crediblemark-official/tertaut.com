<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { authClient } from '../lib/auth'
import { useClipboard } from '../composables/useClipboard'
import {
  CreditCard,
  KeyRound,
  Bot,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Code2,
  Terminal,
  ExternalLink,
  Layers,
  Cpu,
  Lock,
  ChevronRight,
  Menu,
  X
} from 'lucide-vue-next'

const { copied: copiedSdk, copy: writeClipboard } = useClipboard()
const isMobileMenuOpen = ref(false)
const activeDemoTab = ref<'checkout' | 'badge'>('checkout')
const selectedDemoChannel = ref('QRIS Instan')
const selectedDemoBadge = ref('verified')
const router = useRouter()
const authSession = authClient.useSession()
const isLoggedIn = computed(() => !!authSession.value?.data?.user)

async function handleLogout() {
  try {
    await authClient.signOut()
  } catch {}
  router.push('/')
}

function copySdkInstall() {
  writeClipboard('npm install @tertaut/sdk')
}
</script>

<template>
  <div class="min-h-screen bg-white text-jetblack flex flex-col selection:bg-gold/20 selection:text-jetblack">
    <!-- Public Header -->
    <header class="border-b border-jetblack/10 sticky top-0 bg-white/90 backdrop-blur-md z-50">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <!-- Logo -->
        <router-link to="/" class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-lg bg-jetblack flex items-center justify-center font-bold text-white shadow-md relative overflow-hidden">
            <span class="text-sm font-black tracking-tighter">T</span>
            <span class="absolute bottom-1 right-1 w-1.5 h-1.5 rounded-full bg-gold shadow-[0_0_6px_#D4AF37]"></span>
          </div>
          <div>
            <div class="font-extrabold text-base tracking-tight text-jetblack flex items-center gap-0.5 font-mono">
              tertaut<span class="text-gold">.com</span>
            </div>
          </div>
        </router-link>

        <!-- Navigation Links -->
        <nav class="hidden md:flex items-center gap-6 text-xs font-semibold text-jetblack/70">
          <a href="#fitur" class="hover:text-jetblack transition">Fitur Utama</a>
          <a href="#arsitektur" class="hover:text-jetblack transition">Arsitektur</a>
          <router-link to="/dashboard/docs" class="hover:text-jetblack transition">SDK & Docs</router-link>
          <a href="/swagger" target="_blank" class="hover:text-jetblack flex items-center gap-1 transition">
            <span>Swagger API</span>
            <ExternalLink class="w-3 h-3 text-jetblack/40" />
          </a>
        </nav>

        <!-- Action CTAs -->
        <div class="flex items-center gap-2 sm:gap-3">
          <router-link
            to="/pay/fastmail-ai"
            class="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-jetblack/15 text-xs font-semibold text-jetblack hover:bg-jetblack/5 transition"
          >
            <span>Live Demo</span>
          </router-link>

          <router-link
            v-if="!isLoggedIn"
            to="/login"
            class="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-gold/40 text-xs font-bold text-gold hover:bg-gold/10 transition active:scale-95"
          >
            <span>Masuk</span>
          </router-link>

          <router-link
            to="/dashboard"
            class="inline-flex items-center gap-1.5 px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-lg bg-jetblack text-white text-xs font-bold shadow-sm hover:bg-jetblack-hover transition active:scale-95"
          >
            <span>Buka Dashboard</span>
            <ArrowRight class="w-3.5 h-3.5 text-gold" />
          </router-link>

          <button
            v-if="isLoggedIn"
            type="button"
            @click="handleLogout"
            class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-400/40 text-xs font-bold text-red-400 hover:bg-red-400/10 transition active:scale-95"
          >
            <span>Keluar</span>
          </button>

          <!-- Mobile Hamburger Toggle -->
          <button
            @click="isMobileMenuOpen = !isMobileMenuOpen"
            class="md:hidden p-1.5 rounded-lg border border-jetblack/15 text-jetblack hover:bg-jetblack/5 cursor-pointer"
            aria-label="Toggle Menu"
          >
            <X v-if="isMobileMenuOpen" class="w-4 h-4" />
            <Menu v-else class="w-4 h-4" />
          </button>
        </div>
      </div>

      <!-- Mobile Navigation Drawer -->
      <div v-if="isMobileMenuOpen" class="md:hidden border-t border-jetblack/10 bg-white px-4 py-3 space-y-2 text-xs font-semibold animate-fadeIn">
        <a href="#fitur" @click="isMobileMenuOpen = false" class="block py-1.5 text-jetblack/80 hover:text-jetblack">Fitur Utama</a>
        <a href="#arsitektur" @click="isMobileMenuOpen = false" class="block py-1.5 text-jetblack/80 hover:text-jetblack">Arsitektur</a>
        <router-link to="/dashboard/docs" @click="isMobileMenuOpen = false" class="block py-1.5 text-jetblack/80 hover:text-jetblack">SDK &amp; Docs</router-link>
        <router-link to="/pay/fastmail-ai" @click="isMobileMenuOpen = false" class="block py-1.5 text-jetblack/80 hover:text-jetblack">Coba Demo Paywall</router-link>
        <a href="/swagger" target="_blank" class="block py-1.5 text-jetblack/80 hover:text-jetblack">Swagger API Docs ↗</a>
      </div>
    </header>

    <!-- Hero Section -->
    <section class="relative overflow-hidden pt-12 pb-16 md:pt-20 md:pb-24 border-b border-jetblack/10 bg-gradient-to-b from-white via-[#FAFAFA] to-[#F5F5F5]">
      <div class="max-w-5xl mx-auto px-4 sm:px-6 text-center space-y-6">
        <!-- Top Pill Badge -->
        <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-jetblack/5 border border-jetblack/10 text-jetblack text-xs font-semibold">
          <span class="w-2 h-2 rounded-full bg-forest animate-pulse"></span>
          <span class="font-mono text-[11px] text-jetblack/80">Single Container Headless Engine v2.2</span>
          <span class="text-jetblack/30">•</span>
          <span class="text-gold font-bold">4 Modules Complete</span>
        </div>

        <!-- Main Headline -->
        <h1 class="text-3xl sm:text-5xl md:text-6xl font-black text-jetblack tracking-tight leading-[1.12]">
          Infrastruktur Monetisasi, Lisensi &amp; Proteksi AI untuk
          <span class="bg-gradient-to-r from-jetblack via-forest to-gold bg-clip-text text-transparent">
            Software Builder
          </span>
        </h1>

        <!-- Subtitle -->
        <p class="max-w-2xl mx-auto text-sm sm:text-base md:text-lg text-jetblack/70 leading-relaxed">
          Uji minat pasar sebelum coding, terima pembayaran instan via <strong>Merchant of Record DANA Enterprise</strong> (5% flat fee), lindungi software dengan <strong>Universal Licensing offline-first</strong>, dan amankan API AI Anda tanpa kebocoran kunci.
        </p>

        <!-- CTA Action Buttons -->
        <div class="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
          <router-link
            to="/dashboard"
            class="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-jetblack text-white text-sm font-bold shadow-lg shadow-jetblack/15 hover:bg-jetblack-hover transition active:scale-95"
          >
            <span>Masuk ke Dashboard</span>
            <ArrowRight class="w-4 h-4 text-gold" />
          </router-link>

          <router-link
            to="/pay/fastmail-ai"
            class="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-white border border-jetblack/15 text-jetblack text-sm font-bold shadow-sm hover:bg-[#F9F9F9] transition"
          >
            <CreditCard class="w-4 h-4 text-forest" />
            <span>Coba Demo Checkout</span>
          </router-link>

          <router-link
            to="/dashboard/docs"
            class="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl text-xs font-semibold text-jetblack/70 hover:text-jetblack transition"
          >
            <Code2 class="w-4 h-4 text-gold" />
            <span>Dokumentasi SDK</span>
          </router-link>
        </div>

        <!-- Quick Terminal Snippet -->
        <div class="pt-4 max-w-md mx-auto">
          <div
            @click="copySdkInstall"
            class="group cursor-pointer flex items-center justify-between px-4 py-2.5 rounded-xl bg-jetblack text-white font-mono text-xs border border-white/10 shadow-md hover:border-gold/50 transition"
          >
            <div class="flex items-center gap-2.5">
              <Terminal class="w-3.5 h-3.5 text-gold" />
              <span class="text-white/90">npm install @tertaut/sdk</span>
            </div>
            <span class="text-[10px] text-white/50 group-hover:text-gold font-sans font-medium transition">
              {{ copiedSdk ? 'Tersalin!' : 'Salin' }}
            </span>
          </div>
          <div class="mt-2 text-[11px] text-jetblack/45 flex items-center justify-center gap-2 font-mono">
            <span>Bundle size &lt; 15 KB</span>
            <span>•</span>
            <span>Zero Dependencies</span>
            <span>•</span>
            <span>Bun &amp; Node Ready</span>
          </div>
        </div>

        <!-- Interactive Live Product Showcase Preview -->
        <div class="pt-6 max-w-3xl mx-auto text-left">
          <div class="luxury-card rounded-2xl p-4 sm:p-6 border border-jetblack/12 shadow-luxury space-y-4 bg-white">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-jetblack/10">
              <div class="flex items-center gap-2">
                <span class="w-2.5 h-2.5 rounded-full bg-forest animate-pulse"></span>
                <span class="text-xs font-bold uppercase tracking-wider text-jetblack font-mono">Live Interactive Demo</span>
                <span class="text-xs text-jetblack/30">•</span>
                <span class="text-xs text-jetblack/50">Simulasi Tanpa Akun</span>
              </div>

              <!-- Tabs: Checkout vs Badge -->
              <div class="flex items-center rounded-lg bg-jetblack/5 p-0.5 text-xs font-semibold">
                <button
                  @click="activeDemoTab = 'checkout'"
                  :class="['px-2.5 py-1 rounded-md transition cursor-pointer text-xs', activeDemoTab === 'checkout' ? 'bg-white font-bold text-jetblack shadow-xs' : 'text-jetblack/60 hover:text-jetblack']"
                >
                  MoR Hosted Checkout
                </button>
                <button
                  @click="activeDemoTab = 'badge'"
                  :class="['px-2.5 py-1 rounded-md transition cursor-pointer text-xs', activeDemoTab === 'badge' ? 'bg-white font-bold text-jetblack shadow-xs' : 'text-jetblack/60 hover:text-jetblack']"
                >
                  Trust Badge Widget
                </button>
              </div>
            </div>

            <!-- Demo Content: Checkout -->
            <div v-if="activeDemoTab === 'checkout'" class="grid grid-cols-1 sm:grid-cols-12 gap-5 items-center">
              <div class="sm:col-span-7 space-y-3">
                <div class="flex items-center justify-between">
                  <div class="text-xs font-bold text-jetblack">Pilih Channel Pembayaran:</div>
                  <span class="text-[10px] text-forest font-bold bg-forest/10 px-2 py-0.5 rounded-full">QRIS / VA / E-Wallet</span>
                </div>
                <div class="grid grid-cols-3 gap-2">
                  <button
                    v-for="ch in ['QRIS Instan', 'BCA / Mandiri VA', 'GoPay / OVO']"
                    :key="ch"
                    @click="selectedDemoChannel = ch"
                    :class="['p-2.5 rounded-xl border text-center transition cursor-pointer text-[11px] font-bold', selectedDemoChannel === ch ? 'border-jetblack bg-jetblack text-white shadow-xs' : 'border-jetblack/15 bg-white text-jetblack hover:border-jetblack/30']"
                  >
                    {{ ch }}
                  </button>
                </div>
                <div class="p-3 rounded-xl bg-[#FAFAFA] border border-jetblack/10 text-xs space-y-1.5">
                  <div class="flex justify-between">
                    <span class="text-jetblack/60">Harga Produk:</span>
                    <span class="font-mono font-bold text-jetblack">Rp 49.000</span>
                  </div>
                  <div class="flex justify-between text-crimson">
                    <span>Merchant of Record Fee (5%):</span>
                    <span class="font-mono">-Rp 2.450</span>
                  </div>
                  <div class="pt-1.5 border-t border-jetblack/10 flex justify-between font-bold">
                    <span class="text-forest">Net Payout Builder (95%):</span>
                    <span class="font-mono text-sm text-forest">Rp 46.550</span>
                  </div>
                </div>
              </div>

              <div class="sm:col-span-5 p-4 rounded-xl bg-jetblack text-white space-y-2.5 shadow-xs">
                <div class="flex items-center gap-1.5 text-xs font-bold text-gold">
                  <CheckCircle2 class="w-4 h-4 shrink-0" />
                  <span>Nol Izin Perusahaan</span>
                </div>
                <p class="text-[11px] text-white/75 leading-relaxed">
                  Tidak perlu mendaftar PT/CV atau KYC Payment Gateway rumit. Uang masuk ke akun MoR dan dicairkan otomatis 95% ke rekening Anda.
                </p>
                <router-link
                  to="/pay/fastmail-ai"
                  class="inline-flex items-center gap-1 text-xs font-bold text-gold hover:underline pt-1"
                >
                  <span>Buka Halaman Bayar Penuh</span>
                  <ExternalLink class="w-3.5 h-3.5" />
                </router-link>
              </div>
            </div>

            <!-- Demo Content: Badge -->
            <div v-else class="grid grid-cols-1 sm:grid-cols-12 gap-5 items-center">
              <div class="sm:col-span-7 space-y-3">
                <div class="text-xs font-bold text-jetblack">Pilih Gaya Badge untuk Website Anda:</div>
                <div class="flex flex-wrap gap-2">
                  <button
                    v-for="bt in ['verified', 'sales_counter', 'status']"
                    :key="bt"
                    @click="selectedDemoBadge = bt"
                    :class="['px-2.5 py-1 rounded-lg border text-xs font-bold capitalize transition cursor-pointer', selectedDemoBadge === bt ? 'border-jetblack bg-jetblack text-white' : 'border-jetblack/15 bg-white text-jetblack hover:bg-jetblack/5']"
                  >
                    {{ bt.replace('_', ' ') }}
                  </button>
                </div>
                <div class="p-4 rounded-xl bg-[#FAFAFA] border border-jetblack/10 flex items-center justify-center min-h-[70px]">
                  <img :src="`/badge/fastmail-ai.svg`" alt="Badge Preview" class="h-6 shadow-xs" />
                </div>
              </div>

              <div class="sm:col-span-5 p-4 rounded-xl bg-jetblack text-white space-y-2.5 shadow-xs">
                <div class="flex items-center gap-1.5 text-xs font-bold text-gold">
                  <Sparkles class="w-4 h-4 shrink-0" />
                  <span>Shadow DOM Encapsulated</span>
                </div>
                <p class="text-[11px] text-white/75 leading-relaxed">
                  Pasang tag <code>&lt;tertaut-badge&gt;</code> di website manapun tanpa merusak gaya CSS host Anda.
                </p>
                <router-link
                  to="/dashboard/docs"
                  class="inline-flex items-center gap-1 text-xs font-bold text-gold hover:underline pt-1"
                >
                  <span>Lihat Kode Integrasi SDK</span>
                  <ExternalLink class="w-3.5 h-3.5" />
                </router-link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- 5 Pillars Section -->
    <section id="fitur" class="py-16 md:py-24 max-w-7xl mx-auto px-4 sm:px-6 space-y-12">
      <div class="text-center space-y-3 max-w-2xl mx-auto">
        <h2 class="text-xs font-bold uppercase tracking-widest text-forest font-mono">4 Modul Infrastruktur</h2>
        <h3 class="text-2xl sm:text-3xl font-extrabold text-jetblack tracking-tight">
          Semua yang Dibutuhkan Software Builder dari Ide Hingga Pendapatan
        </h3>
        <p class="text-xs sm:text-sm text-jetblack/60">
          Dirancang untuk dijalankan mandiri (self-hosted) di atas Bun &amp; PostgreSQL dengan efisiensi memori tinggi.
        </p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <!-- Modul 1 -->
        <div class="luxury-card rounded-2xl p-6 space-y-4 border border-jetblack/10 hover:border-jetblack/30 transition group">
          <div class="w-10 h-10 rounded-xl bg-jetblack/5 flex items-center justify-center text-jetblack group-hover:bg-jetblack group-hover:text-white transition">
            <CreditCard class="w-5 h-5 text-forest" />
          </div>
          <div class="space-y-1.5">
            <span class="text-[10px] font-bold uppercase tracking-wider text-jetblack/50 font-mono">Modul 01</span>
            <h4 class="text-base font-bold text-jetblack">Dynamic Checkout &amp; MoR DANA Enterprise</h4>
            <p class="text-xs text-jetblack/65 leading-relaxed">
              Terima pembayaran QRIS, Virtual Account (BCA, Mandiri, BRI), dan E-Wallet tanpa perlu izin PT/CV. Merchant of Record dengan potongan flat 5% dan pencairan net 95% otomatis.
            </p>
          </div>
          <div class="pt-2 border-t border-jetblack/5 flex items-center justify-between text-xs font-semibold text-jetblack">
            <router-link to="/dashboard/checkout" class="inline-flex items-center gap-1 hover:text-forest transition">
              <span>Simulasi Checkout</span>
              <ChevronRight class="w-3.5 h-3.5 text-gold" />
            </router-link>
            <span class="text-[11px] font-mono text-forest bg-forest/10 px-2 py-0.5 rounded-md">5% Flat Fee</span>
          </div>
        </div>

        <!-- Modul 2 -->
        <div class="luxury-card rounded-2xl p-6 space-y-4 border border-jetblack/10 hover:border-jetblack/30 transition group">
          <div class="w-10 h-10 rounded-xl bg-jetblack/5 flex items-center justify-center text-jetblack group-hover:bg-jetblack group-hover:text-white transition">
            <KeyRound class="w-5 h-5 text-gold" />
          </div>
          <div class="space-y-1.5">
            <span class="text-[10px] font-bold uppercase tracking-wider text-jetblack/50 font-mono">Modul 02</span>
            <h4 class="text-base font-bold text-jetblack">Universal Licensing &amp; Seat Quota</h4>
            <p class="text-xs text-jetblack/65 leading-relaxed">
              Sistem proteksi lisensi multi-platform (Desktop Tauri/Electron, Web, Mobile, CLI). Dukungan offline grace period 30 hari via signed JWT dan hardware fingerprinting binding.
            </p>
          </div>
          <div class="pt-2 border-t border-jetblack/5 flex items-center justify-between text-xs font-semibold text-jetblack">
            <router-link to="/dashboard/licensing" class="inline-flex items-center gap-1 hover:text-forest transition">
              <span>Kelola Lisensi</span>
              <ChevronRight class="w-3.5 h-3.5 text-gold" />
            </router-link>
            <span class="text-[11px] font-mono text-forest bg-forest/10 px-2 py-0.5 rounded-md">Offline JWT</span>
          </div>
        </div>

        <!-- Modul 3 -->
        <div class="luxury-card rounded-2xl p-6 space-y-4 border border-jetblack/10 hover:border-jetblack/30 transition group">
          <div class="w-10 h-10 rounded-xl bg-jetblack/5 flex items-center justify-center text-jetblack group-hover:bg-jetblack group-hover:text-white transition">
            <Bot class="w-5 h-5 text-forest" />
          </div>
          <div class="space-y-1.5">
            <span class="text-[10px] font-bold uppercase tracking-wider text-jetblack/50 font-mono">Modul 03</span>
            <h4 class="text-base font-bold text-jetblack">AI Proxy Shield &amp; Cost Guardrails</h4>
            <p class="text-xs text-jetblack/65 leading-relaxed">
              Gateway AI multi-provider (OpenAI, Anthropic, Gemini, DeepSeek) dengan enkripsi AES-256. Mencegah kebocoran API key, rate limit 15 req/min, daily token cap, dan Zero Prompt Retention.
            </p>
          </div>
          <div class="pt-2 border-t border-jetblack/5 flex items-center justify-between text-xs font-semibold text-jetblack">
            <router-link to="/dashboard/ai-proxy" class="inline-flex items-center gap-1 hover:text-forest transition">
              <span>Konfigurasi Shield</span>
              <ChevronRight class="w-3.5 h-3.5 text-gold" />
            </router-link>
            <span class="text-[11px] font-mono text-forest bg-forest/10 px-2 py-0.5 rounded-md">Zero Leak</span>
          </div>
        </div>

        <!-- Modul 4 -->
        <div class="luxury-card rounded-2xl p-6 space-y-4 border border-jetblack/10 hover:border-jetblack/30 transition group">
          <div class="w-10 h-10 rounded-xl bg-jetblack/5 flex items-center justify-center text-jetblack group-hover:bg-jetblack group-hover:text-white transition">
            <Sparkles class="w-5 h-5 text-gold" />
          </div>
          <div class="space-y-1.5">
            <span class="text-[10px] font-bold uppercase tracking-wider text-jetblack/50 font-mono">Modul 04</span>
            <h4 class="text-base font-bold text-jetblack">Launch Kit &amp; Developer SDK</h4>
            <p class="text-xs text-jetblack/65 leading-relaxed">
              Otomasi peluncuran produk: konversi live satu-klik, kupon early bird, dan embeddable web component badge.
            </p>
          </div>
          <div class="pt-2 border-t border-jetblack/5 flex items-center justify-between text-xs font-semibold text-jetblack">
            <router-link to="/dashboard/docs" class="inline-flex items-center gap-1 hover:text-forest transition">
              <span>Lihat Launch Kit</span>
              <ChevronRight class="w-3.5 h-3.5 text-gold" />
            </router-link>
            <span class="text-[11px] font-mono text-forest bg-forest/10 px-2 py-0.5 rounded-md">Badge &amp; SDK</span>
          </div>
        </div>

        <!-- Developer Dashboard Card -->
        <div class="rounded-2xl p-6 space-y-4 bg-jetblack text-white flex flex-col justify-between shadow-xl">
          <div class="space-y-2">
            <div class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/10 text-[10px] font-bold text-gold font-mono">
              <span>ADMIN PANEL</span>
            </div>
            <h4 class="text-lg font-bold">Developer Command Center</h4>
            <p class="text-xs text-white/70 leading-relaxed">
              Pantau revenue kotor &amp; bersih, terbitkan lisensi, dan pantau penggunaan kuota AI secara real-time dari satu dashboard terpadu.
            </p>
          </div>
          <router-link
            to="/dashboard"
            class="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white text-jetblack text-xs font-bold hover:bg-[#F0F0F0] transition active:scale-95"
          >
            <span>Buka Dashboard Developer</span>
            <ArrowRight class="w-3.5 h-3.5 text-forest" />
          </router-link>
        </div>
      </div>
    </section>

    <!-- Architecture Section -->
    <section id="arsitektur" class="py-16 bg-[#FAFAFA] border-y border-jetblack/10">
      <div class="max-w-5xl mx-auto px-4 sm:px-6 space-y-8">
        <div class="text-center space-y-2">
          <h2 class="text-xs font-bold uppercase tracking-widest text-gold font-mono">Arsitektur Monolith Modern</h2>
          <h3 class="text-2xl sm:text-3xl font-black text-jetblack tracking-tight">
            Satu Container Bun, Nol Kerumitan Operasional
          </h3>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div class="p-5 rounded-xl bg-white border border-jetblack/10 space-y-2 shadow-sm">
            <Cpu class="w-5 h-5 text-forest" />
            <h5 class="text-sm font-bold text-jetblack">Bun 1.3 + ElysiaJS</h5>
            <p class="text-xs text-jetblack/60 leading-relaxed">
              Eksekusi hingga 3-5x lebih cepat dibanding Node.js runtime dengan konsumsi RAM di bawah 80 MB saat idle.
            </p>
          </div>

          <div class="p-5 rounded-xl bg-white border border-jetblack/10 space-y-2 shadow-sm">
            <Layers class="w-5 h-5 text-gold" />
            <h5 class="text-sm font-bold text-jetblack">PostgreSQL + Drizzle ORM</h5>
            <p class="text-xs text-jetblack/60 leading-relaxed">
              Database relasional yang kuat untuk data transaksi, idempotency key, lisensi hardware, dan log token AI.
            </p>
          </div>

          <div class="p-5 rounded-xl bg-white border border-jetblack/10 space-y-2 shadow-sm">
            <Lock class="w-5 h-5 text-forest" />
            <h5 class="text-sm font-bold text-jetblack">AES-256-GCM + SHA-256</h5>
            <p class="text-xs text-jetblack/60 leading-relaxed">
              Kunci API penyedia AI dan token lisensi dienkripsi di level data store. Tanpa data teks polos tersimpan di log.
            </p>
          </div>
        </div>
      </div>
    </section>

    <!-- Public Footer -->
    <footer class="mt-auto border-t border-jetblack/10 bg-white py-10">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col md:flex-row items-center justify-between gap-6 text-xs text-jetblack/60">
        <div class="flex items-center gap-2">
          <div class="w-6 h-6 rounded-md bg-jetblack flex items-center justify-center font-bold text-white text-[11px]">T</div>
          <span class="font-extrabold text-jetblack font-mono">tertaut<span class="text-gold">.com</span></span>
          <span>— Headless Developer Engine v2.2</span>
        </div>

        <div class="flex flex-wrap items-center justify-center gap-4 sm:gap-6 font-medium">
          <router-link to="/dashboard" class="hover:text-jetblack transition">Dashboard Builder</router-link>
          <router-link to="/panel" class="hover:text-jetblack transition">Admin Panel</router-link>
          <router-link to="/dashboard/docs" class="hover:text-jetblack transition">Dokumentasi</router-link>
          <router-link to="/pay/fastmail-ai" class="hover:text-jetblack transition">Demo Checkout</router-link>
          <a href="/swagger" target="_blank" class="hover:text-jetblack transition">Swagger API</a>
        </div>

        <div class="flex items-center gap-2 font-mono text-[11px]">
          <span class="w-2 h-2 rounded-full bg-forest"></span>
          <span>Engine Online (v2.2 Production Monolith)</span>
        </div>
      </div>
    </footer>
  </div>
</template>
