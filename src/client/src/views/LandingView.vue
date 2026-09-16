<script setup lang="ts">
import { ref } from 'vue'
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

const copiedSdk = ref(false)
const isMobileMenuOpen = ref(false)
const activeDemoTab = ref<'checkout' | 'badge'>('checkout')
const selectedDemoChannel = ref('QRIS Instan')
const selectedDemoBadge = ref('verified')

function copySdkInstall() {
  navigator.clipboard.writeText('npm install @tertaut/sdk')
  copiedSdk.value = true
  setTimeout(() => {
    copiedSdk.value = false
  }, 2000)
}
</script>

<template>
  <div class="min-h-screen bg-[#FFFFFF] text-[#111111] flex flex-col selection:bg-[#D4AF37]/20 selection:text-[#111111]">
    <!-- Public Header -->
    <header class="border-b border-[#111111]/10 sticky top-0 bg-[#FFFFFF]/90 backdrop-blur-md z-50">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <!-- Logo -->
        <router-link to="/" class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-lg bg-[#111111] flex items-center justify-center font-bold text-white shadow-md relative overflow-hidden">
            <span class="text-sm font-black tracking-tighter">T</span>
            <span class="absolute bottom-1 right-1 w-1.5 h-1.5 rounded-full bg-[#D4AF37] shadow-[0_0_6px_#D4AF37]"></span>
          </div>
          <div>
            <div class="font-extrabold text-base tracking-tight text-[#111111] flex items-center gap-0.5 font-mono">
              tertaut<span class="text-[#D4AF37]">.com</span>
            </div>
          </div>
        </router-link>

        <!-- Navigation Links -->
        <nav class="hidden md:flex items-center gap-6 text-xs font-semibold text-[#111111]/70">
          <a href="#fitur" class="hover:text-[#111111] transition">Fitur Utama</a>
          <a href="#arsitektur" class="hover:text-[#111111] transition">Arsitektur</a>
          <router-link to="/portal" class="hover:text-[#111111] transition">Portal Pembeli</router-link>
          <router-link to="/dashboard/docs" class="hover:text-[#111111] transition">SDK & Docs</router-link>
          <a href="/swagger" target="_blank" class="hover:text-[#111111] flex items-center gap-1 transition">
            <span>Swagger API</span>
            <ExternalLink class="w-3 h-3 text-[#111111]/40" />
          </a>
        </nav>

        <!-- Action CTAs -->
        <div class="flex items-center gap-2 sm:gap-3">
          <router-link
            to="/pay/fastmail-ai"
            class="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#111111]/15 text-xs font-semibold text-[#111111] hover:bg-[#111111]/5 transition"
          >
            <span>Live Demo</span>
          </router-link>

          <router-link
            to="/dashboard"
            class="inline-flex items-center gap-1.5 px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-lg bg-[#111111] text-white text-xs font-bold shadow-sm hover:bg-[#222222] transition active:scale-95"
          >
            <span>Buka Dashboard</span>
            <ArrowRight class="w-3.5 h-3.5 text-[#D4AF37]" />
          </router-link>

          <!-- Mobile Hamburger Toggle -->
          <button
            @click="isMobileMenuOpen = !isMobileMenuOpen"
            class="md:hidden p-1.5 rounded-lg border border-[#111111]/15 text-[#111111] hover:bg-[#111111]/5 cursor-pointer"
            aria-label="Toggle Menu"
          >
            <X v-if="isMobileMenuOpen" class="w-4 h-4" />
            <Menu v-else class="w-4 h-4" />
          </button>
        </div>
      </div>

      <!-- Mobile Navigation Drawer -->
      <div v-if="isMobileMenuOpen" class="md:hidden border-t border-[#111111]/10 bg-white px-4 py-3 space-y-2 text-xs font-semibold animate-fadeIn">
        <a href="#fitur" @click="isMobileMenuOpen = false" class="block py-1.5 text-[#111111]/80 hover:text-[#111111]">Fitur Utama</a>
        <a href="#arsitektur" @click="isMobileMenuOpen = false" class="block py-1.5 text-[#111111]/80 hover:text-[#111111]">Arsitektur</a>
        <router-link to="/portal" @click="isMobileMenuOpen = false" class="block py-1.5 text-[#111111]/80 hover:text-[#111111]">Portal Pembeli (Cek Lisensi)</router-link>
        <router-link to="/dashboard/docs" @click="isMobileMenuOpen = false" class="block py-1.5 text-[#111111]/80 hover:text-[#111111]">SDK &amp; Docs</router-link>
        <router-link to="/pay/fastmail-ai" @click="isMobileMenuOpen = false" class="block py-1.5 text-[#111111]/80 hover:text-[#111111]">Coba Demo Paywall</router-link>
        <a href="/swagger" target="_blank" class="block py-1.5 text-[#111111]/80 hover:text-[#111111]">Swagger API Docs ↗</a>
      </div>
    </header>

    <!-- Hero Section -->
    <section class="relative overflow-hidden pt-12 pb-16 md:pt-20 md:pb-24 border-b border-[#111111]/10 bg-gradient-to-b from-[#FFFFFF] via-[#FAFAFA] to-[#F5F5F5]">
      <div class="max-w-5xl mx-auto px-4 sm:px-6 text-center space-y-6">
        <!-- Top Pill Badge -->
        <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#111111]/5 border border-[#111111]/10 text-[#111111] text-xs font-semibold">
          <span class="w-2 h-2 rounded-full bg-[#0F4C3A] animate-pulse"></span>
          <span class="font-mono text-[11px] text-[#111111]/80">Single Container Headless Engine v2.2</span>
          <span class="text-[#111111]/30">•</span>
          <span class="text-[#D4AF37] font-bold">4 Modules Complete</span>
        </div>

        <!-- Main Headline -->
        <h1 class="text-3xl sm:text-5xl md:text-6xl font-black text-[#111111] tracking-tight leading-[1.12]">
          Infrastruktur Monetisasi, Lisensi &amp; Proteksi AI untuk
          <span class="bg-gradient-to-r from-[#111111] via-[#0F4C3A] to-[#D4AF37] bg-clip-text text-transparent">
            Software Builder
          </span>
        </h1>

        <!-- Subtitle -->
        <p class="max-w-2xl mx-auto text-sm sm:text-base md:text-lg text-[#111111]/70 leading-relaxed">
          Uji minat pasar sebelum coding, terima pembayaran instan via <strong>Merchant of Record Xendit</strong> (5% flat fee), lindungi software dengan <strong>Universal Licensing offline-first</strong>, dan amankan API AI Anda tanpa kebocoran kunci.
        </p>

        <!-- CTA Action Buttons -->
        <div class="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
          <router-link
            to="/dashboard"
            class="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-[#111111] text-white text-sm font-bold shadow-lg shadow-[#111111]/15 hover:bg-[#222222] transition active:scale-95"
          >
            <span>Masuk ke Dashboard</span>
            <ArrowRight class="w-4 h-4 text-[#D4AF37]" />
          </router-link>

          <router-link
            to="/pay/fastmail-ai"
            class="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-white border border-[#111111]/15 text-[#111111] text-sm font-bold shadow-sm hover:bg-[#F9F9F9] transition"
          >
            <CreditCard class="w-4 h-4 text-[#0F4C3A]" />
            <span>Coba Demo Checkout</span>
          </router-link>

          <router-link
            to="/dashboard/docs"
            class="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl text-xs font-semibold text-[#111111]/70 hover:text-[#111111] transition"
          >
            <Code2 class="w-4 h-4 text-[#D4AF37]" />
            <span>Dokumentasi SDK</span>
          </router-link>
        </div>

        <!-- Quick Terminal Snippet -->
        <div class="pt-4 max-w-md mx-auto">
          <div
            @click="copySdkInstall"
            class="group cursor-pointer flex items-center justify-between px-4 py-2.5 rounded-xl bg-[#111111] text-white font-mono text-xs border border-white/10 shadow-md hover:border-[#D4AF37]/50 transition"
          >
            <div class="flex items-center gap-2.5">
              <Terminal class="w-3.5 h-3.5 text-[#D4AF37]" />
              <span class="text-white/90">npm install @tertaut/sdk</span>
            </div>
            <span class="text-[10px] text-white/50 group-hover:text-[#D4AF37] font-sans font-medium transition">
              {{ copiedSdk ? 'Tersalin!' : 'Salin' }}
            </span>
          </div>
          <div class="mt-2 text-[11px] text-[#111111]/45 flex items-center justify-center gap-2 font-mono">
            <span>Bundle size &lt; 15 KB</span>
            <span>•</span>
            <span>Zero Dependencies</span>
            <span>•</span>
            <span>Bun &amp; Node Ready</span>
          </div>
        </div>

        <!-- Interactive Live Product Showcase Preview -->
        <div class="pt-6 max-w-3xl mx-auto text-left">
          <div class="luxury-card rounded-2xl p-4 sm:p-6 border border-[#111111]/12 shadow-luxury space-y-4 bg-white">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#111111]/10">
              <div class="flex items-center gap-2">
                <span class="w-2.5 h-2.5 rounded-full bg-[#0F4C3A] animate-pulse"></span>
                <span class="text-xs font-bold uppercase tracking-wider text-[#111111] font-mono">Live Interactive Demo</span>
                <span class="text-xs text-[#111111]/30">•</span>
                <span class="text-xs text-[#111111]/50">Simulasi Tanpa Akun</span>
              </div>

              <!-- Tabs: Checkout vs Badge -->
              <div class="flex items-center rounded-lg bg-[#111111]/5 p-0.5 text-xs font-semibold">
                <button
                  @click="activeDemoTab = 'checkout'"
                  :class="['px-2.5 py-1 rounded-md transition cursor-pointer text-xs', activeDemoTab === 'checkout' ? 'bg-white font-bold text-[#111111] shadow-xs' : 'text-[#111111]/60 hover:text-[#111111]']"
                >
                  MoR Hosted Checkout
                </button>
                <button
                  @click="activeDemoTab = 'badge'"
                  :class="['px-2.5 py-1 rounded-md transition cursor-pointer text-xs', activeDemoTab === 'badge' ? 'bg-white font-bold text-[#111111] shadow-xs' : 'text-[#111111]/60 hover:text-[#111111]']"
                >
                  Trust Badge Widget
                </button>
              </div>
            </div>

            <!-- Demo Content: Checkout -->
            <div v-if="activeDemoTab === 'checkout'" class="grid grid-cols-1 sm:grid-cols-12 gap-5 items-center">
              <div class="sm:col-span-7 space-y-3">
                <div class="flex items-center justify-between">
                  <div class="text-xs font-bold text-[#111111]">Pilih Channel Pembayaran:</div>
                  <span class="text-[10px] text-[#0F4C3A] font-bold bg-[#0F4C3A]/10 px-2 py-0.5 rounded-full">QRIS / VA / E-Wallet</span>
                </div>
                <div class="grid grid-cols-3 gap-2">
                  <button
                    v-for="ch in ['QRIS Instan', 'BCA / Mandiri VA', 'GoPay / OVO']"
                    :key="ch"
                    @click="selectedDemoChannel = ch"
                    :class="['p-2.5 rounded-xl border text-center transition cursor-pointer text-[11px] font-bold', selectedDemoChannel === ch ? 'border-[#111111] bg-[#111111] text-white shadow-xs' : 'border-[#111111]/15 bg-white text-[#111111] hover:border-[#111111]/30']"
                  >
                    {{ ch }}
                  </button>
                </div>
                <div class="p-3 rounded-xl bg-[#FAFAFA] border border-[#111111]/10 text-xs space-y-1.5">
                  <div class="flex justify-between">
                    <span class="text-[#111111]/60">Harga Produk:</span>
                    <span class="font-mono font-bold text-[#111111]">Rp 49.000</span>
                  </div>
                  <div class="flex justify-between text-[#8B0000]">
                    <span>Merchant of Record Fee (5%):</span>
                    <span class="font-mono">-Rp 2.450</span>
                  </div>
                  <div class="pt-1.5 border-t border-[#111111]/10 flex justify-between font-bold">
                    <span class="text-[#0F4C3A]">Net Payout Builder (95%):</span>
                    <span class="font-mono text-sm text-[#0F4C3A]">Rp 46.550</span>
                  </div>
                </div>
              </div>

              <div class="sm:col-span-5 p-4 rounded-xl bg-[#111111] text-white space-y-2.5 shadow-xs">
                <div class="flex items-center gap-1.5 text-xs font-bold text-[#D4AF37]">
                  <CheckCircle2 class="w-4 h-4 shrink-0" />
                  <span>Nol Izin Perusahaan</span>
                </div>
                <p class="text-[11px] text-white/75 leading-relaxed">
                  Tidak perlu mendaftar PT/CV atau KYC Payment Gateway rumit. Uang masuk ke akun MoR dan dicairkan otomatis 95% ke rekening Anda.
                </p>
                <router-link
                  to="/pay/fastmail-ai"
                  class="inline-flex items-center gap-1 text-xs font-bold text-[#D4AF37] hover:underline pt-1"
                >
                  <span>Buka Halaman Bayar Penuh</span>
                  <ExternalLink class="w-3.5 h-3.5" />
                </router-link>
              </div>
            </div>

            <!-- Demo Content: Badge -->
            <div v-else class="grid grid-cols-1 sm:grid-cols-12 gap-5 items-center">
              <div class="sm:col-span-7 space-y-3">
                <div class="text-xs font-bold text-[#111111]">Pilih Gaya Badge untuk Website Anda:</div>
                <div class="flex flex-wrap gap-2">
                  <button
                    v-for="bt in ['verified', 'sales_counter', 'status']"
                    :key="bt"
                    @click="selectedDemoBadge = bt"
                    :class="['px-2.5 py-1 rounded-lg border text-xs font-bold capitalize transition cursor-pointer', selectedDemoBadge === bt ? 'border-[#111111] bg-[#111111] text-white' : 'border-[#111111]/15 bg-white text-[#111111] hover:bg-[#111111]/5']"
                  >
                    {{ bt.replace('_', ' ') }}
                  </button>
                </div>
                <div class="p-4 rounded-xl bg-[#FAFAFA] border border-[#111111]/10 flex items-center justify-center min-h-[70px]">
                  <img :src="`/badge/fastmail-ai.svg`" alt="Badge Preview" class="h-6 shadow-xs" />
                </div>
              </div>

              <div class="sm:col-span-5 p-4 rounded-xl bg-[#111111] text-white space-y-2.5 shadow-xs">
                <div class="flex items-center gap-1.5 text-xs font-bold text-[#D4AF37]">
                  <Sparkles class="w-4 h-4 shrink-0" />
                  <span>Shadow DOM Encapsulated</span>
                </div>
                <p class="text-[11px] text-white/75 leading-relaxed">
                  Pasang tag <code>&lt;tertaut-badge&gt;</code> di website manapun tanpa merusak gaya CSS host Anda.
                </p>
                <router-link
                  to="/dashboard/docs"
                  class="inline-flex items-center gap-1 text-xs font-bold text-[#D4AF37] hover:underline pt-1"
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
        <h2 class="text-xs font-bold uppercase tracking-widest text-[#0F4C3A] font-mono">4 Modul Infrastruktur</h2>
        <h3 class="text-2xl sm:text-3xl font-extrabold text-[#111111] tracking-tight">
          Semua yang Dibutuhkan Software Builder dari Ide Hingga Pendapatan
        </h3>
        <p class="text-xs sm:text-sm text-[#111111]/60">
          Dirancang untuk dijalankan mandiri (self-hosted) di atas Bun &amp; PostgreSQL dengan efisiensi memori tinggi.
        </p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <!-- Modul 1 -->
        <div class="luxury-card rounded-2xl p-6 space-y-4 border border-[#111111]/10 hover:border-[#111111]/30 transition group">
          <div class="w-10 h-10 rounded-xl bg-[#111111]/5 flex items-center justify-center text-[#111111] group-hover:bg-[#111111] group-hover:text-white transition">
            <CreditCard class="w-5 h-5 text-[#0F4C3A]" />
          </div>
          <div class="space-y-1.5">
            <span class="text-[10px] font-bold uppercase tracking-wider text-[#111111]/50 font-mono">Modul 01</span>
            <h4 class="text-base font-bold text-[#111111]">Dynamic Checkout &amp; MoR Xendit</h4>
            <p class="text-xs text-[#111111]/65 leading-relaxed">
              Terima pembayaran QRIS, Virtual Account (BCA, Mandiri, BRI), dan E-Wallet tanpa perlu izin PT/CV. Merchant of Record dengan potongan flat 5% dan pencairan net 95% otomatis.
            </p>
          </div>
          <div class="pt-2 border-t border-[#111111]/5 flex items-center justify-between text-xs font-semibold text-[#111111]">
            <router-link to="/dashboard/checkout" class="inline-flex items-center gap-1 hover:text-[#0F4C3A] transition">
              <span>Simulasi Checkout</span>
              <ChevronRight class="w-3.5 h-3.5 text-[#D4AF37]" />
            </router-link>
            <span class="text-[11px] font-mono text-[#0F4C3A] bg-[#0F4C3A]/10 px-2 py-0.5 rounded-md">5% Flat Fee</span>
          </div>
        </div>

        <!-- Modul 2 -->
        <div class="luxury-card rounded-2xl p-6 space-y-4 border border-[#111111]/10 hover:border-[#111111]/30 transition group">
          <div class="w-10 h-10 rounded-xl bg-[#111111]/5 flex items-center justify-center text-[#111111] group-hover:bg-[#111111] group-hover:text-white transition">
            <KeyRound class="w-5 h-5 text-[#D4AF37]" />
          </div>
          <div class="space-y-1.5">
            <span class="text-[10px] font-bold uppercase tracking-wider text-[#111111]/50 font-mono">Modul 02</span>
            <h4 class="text-base font-bold text-[#111111]">Universal Licensing &amp; Seat Quota</h4>
            <p class="text-xs text-[#111111]/65 leading-relaxed">
              Sistem proteksi lisensi multi-platform (Desktop Tauri/Electron, Web, Mobile, CLI). Dukungan offline grace period 30 hari via signed JWT dan hardware fingerprinting binding.
            </p>
          </div>
          <div class="pt-2 border-t border-[#111111]/5 flex items-center justify-between text-xs font-semibold text-[#111111]">
            <router-link to="/dashboard/licensing" class="inline-flex items-center gap-1 hover:text-[#0F4C3A] transition">
              <span>Kelola Lisensi</span>
              <ChevronRight class="w-3.5 h-3.5 text-[#D4AF37]" />
            </router-link>
            <span class="text-[11px] font-mono text-[#0F4C3A] bg-[#0F4C3A]/10 px-2 py-0.5 rounded-md">Offline JWT</span>
          </div>
        </div>

        <!-- Modul 3 -->
        <div class="luxury-card rounded-2xl p-6 space-y-4 border border-[#111111]/10 hover:border-[#111111]/30 transition group">
          <div class="w-10 h-10 rounded-xl bg-[#111111]/5 flex items-center justify-center text-[#111111] group-hover:bg-[#111111] group-hover:text-white transition">
            <Bot class="w-5 h-5 text-[#0F4C3A]" />
          </div>
          <div class="space-y-1.5">
            <span class="text-[10px] font-bold uppercase tracking-wider text-[#111111]/50 font-mono">Modul 03</span>
            <h4 class="text-base font-bold text-[#111111]">AI Proxy Shield &amp; Cost Guardrails</h4>
            <p class="text-xs text-[#111111]/65 leading-relaxed">
              Gateway AI multi-provider (OpenAI, Anthropic, Gemini, DeepSeek) dengan enkripsi AES-256. Mencegah kebocoran API key, rate limit 15 req/min, daily token cap, dan Zero Prompt Retention.
            </p>
          </div>
          <div class="pt-2 border-t border-[#111111]/5 flex items-center justify-between text-xs font-semibold text-[#111111]">
            <router-link to="/dashboard/ai-proxy" class="inline-flex items-center gap-1 hover:text-[#0F4C3A] transition">
              <span>Konfigurasi Shield</span>
              <ChevronRight class="w-3.5 h-3.5 text-[#D4AF37]" />
            </router-link>
            <span class="text-[11px] font-mono text-[#0F4C3A] bg-[#0F4C3A]/10 px-2 py-0.5 rounded-md">Zero Leak</span>
          </div>
        </div>

        <!-- Modul 4 -->
        <div class="luxury-card rounded-2xl p-6 space-y-4 border border-[#111111]/10 hover:border-[#111111]/30 transition group">
          <div class="w-10 h-10 rounded-xl bg-[#111111]/5 flex items-center justify-center text-[#111111] group-hover:bg-[#111111] group-hover:text-white transition">
            <Sparkles class="w-5 h-5 text-[#D4AF37]" />
          </div>
          <div class="space-y-1.5">
            <span class="text-[10px] font-bold uppercase tracking-wider text-[#111111]/50 font-mono">Modul 04</span>
            <h4 class="text-base font-bold text-[#111111]">Launch Kit &amp; Developer SDK</h4>
            <p class="text-xs text-[#111111]/65 leading-relaxed">
              Otomasi peluncuran produk: konversi live satu-klik, kupon early bird, dan embeddable web component badge.
            </p>
          </div>
          <div class="pt-2 border-t border-[#111111]/5 flex items-center justify-between text-xs font-semibold text-[#111111]">
            <router-link to="/dashboard/docs" class="inline-flex items-center gap-1 hover:text-[#0F4C3A] transition">
              <span>Lihat Launch Kit</span>
              <ChevronRight class="w-3.5 h-3.5 text-[#D4AF37]" />
            </router-link>
            <span class="text-[11px] font-mono text-[#0F4C3A] bg-[#0F4C3A]/10 px-2 py-0.5 rounded-md">Badge &amp; SDK</span>
          </div>
        </div>

        <!-- Developer Dashboard Card -->
        <div class="rounded-2xl p-6 space-y-4 bg-[#111111] text-white flex flex-col justify-between shadow-xl">
          <div class="space-y-2">
            <div class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/10 text-[10px] font-bold text-[#D4AF37] font-mono">
              <span>ADMIN PANEL</span>
            </div>
            <h4 class="text-lg font-bold">Developer Command Center</h4>
            <p class="text-xs text-white/70 leading-relaxed">
              Pantau revenue kotor &amp; bersih, terbitkan lisensi, dan pantau penggunaan kuota AI secara real-time dari satu dashboard terpadu.
            </p>
          </div>
          <router-link
            to="/dashboard"
            class="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white text-[#111111] text-xs font-bold hover:bg-[#F0F0F0] transition active:scale-95"
          >
            <span>Buka Dashboard Developer</span>
            <ArrowRight class="w-3.5 h-3.5 text-[#0F4C3A]" />
          </router-link>
        </div>
      </div>
    </section>

    <!-- Architecture Section -->
    <section id="arsitektur" class="py-16 bg-[#FAFAFA] border-y border-[#111111]/10">
      <div class="max-w-5xl mx-auto px-4 sm:px-6 space-y-8">
        <div class="text-center space-y-2">
          <h2 class="text-xs font-bold uppercase tracking-widest text-[#D4AF37] font-mono">Arsitektur Monolith Modern</h2>
          <h3 class="text-2xl sm:text-3xl font-black text-[#111111] tracking-tight">
            Satu Container Bun, Nol Kerumitan Operasional
          </h3>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div class="p-5 rounded-xl bg-white border border-[#111111]/10 space-y-2 shadow-sm">
            <Cpu class="w-5 h-5 text-[#0F4C3A]" />
            <h5 class="text-sm font-bold text-[#111111]">Bun 1.3 + ElysiaJS</h5>
            <p class="text-xs text-[#111111]/60 leading-relaxed">
              Eksekusi hingga 3-5x lebih cepat dibanding Node.js runtime dengan konsumsi RAM di bawah 80 MB saat idle.
            </p>
          </div>

          <div class="p-5 rounded-xl bg-white border border-[#111111]/10 space-y-2 shadow-sm">
            <Layers class="w-5 h-5 text-[#D4AF37]" />
            <h5 class="text-sm font-bold text-[#111111]">PostgreSQL + Drizzle ORM</h5>
            <p class="text-xs text-[#111111]/60 leading-relaxed">
              Database relasional yang kuat untuk data transaksi, idempotency key, lisensi hardware, dan log token AI.
            </p>
          </div>

          <div class="p-5 rounded-xl bg-white border border-[#111111]/10 space-y-2 shadow-sm">
            <Lock class="w-5 h-5 text-[#0F4C3A]" />
            <h5 class="text-sm font-bold text-[#111111]">AES-256-GCM + SHA-256</h5>
            <p class="text-xs text-[#111111]/60 leading-relaxed">
              Kunci API penyedia AI dan token lisensi dienkripsi di level data store. Tanpa data teks polos tersimpan di log.
            </p>
          </div>
        </div>
      </div>
    </section>

    <!-- Public Footer -->
    <footer class="mt-auto border-t border-[#111111]/10 bg-white py-10">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col md:flex-row items-center justify-between gap-6 text-xs text-[#111111]/60">
        <div class="flex items-center gap-2">
          <div class="w-6 h-6 rounded-md bg-[#111111] flex items-center justify-center font-bold text-white text-[11px]">T</div>
          <span class="font-extrabold text-[#111111] font-mono">tertaut<span class="text-[#D4AF37]">.com</span></span>
          <span>— Headless Developer Engine v2.2</span>
        </div>

        <div class="flex flex-wrap items-center justify-center gap-4 sm:gap-6 font-medium">
          <router-link to="/dashboard" class="hover:text-[#111111] transition">Dashboard Builder</router-link>
          <router-link to="/portal" class="hover:text-[#111111] transition">Portal Pembeli</router-link>
          <router-link to="/panel" class="hover:text-[#111111] transition">Admin Panel</router-link>
          <router-link to="/dashboard/docs" class="hover:text-[#111111] transition">Dokumentasi</router-link>
          <router-link to="/pay/fastmail-ai" class="hover:text-[#111111] transition">Demo Checkout</router-link>
          <a href="/swagger" target="_blank" class="hover:text-[#111111] transition">Swagger API</a>
        </div>

        <div class="flex items-center gap-2 font-mono text-[11px]">
          <span class="w-2 h-2 rounded-full bg-[#0F4C3A]"></span>
          <span>Engine Online (Bun {{ '1.3' }})</span>
        </div>
      </div>
    </footer>
  </div>
</template>
