<script setup lang="ts">
import { ref } from "vue";
import { useClipboard } from "../../composables/useClipboard";
import {
  ArrowRight,
  Code2,
  Terminal,
  CheckCircle2,
  ShieldCheck,
  Bot,
  Sparkles,
  Lock,
  ExternalLink,
} from "lucide-vue-next";

const { copied: copiedSdk, copy: writeClipboard } = useClipboard();

// Hero Interactive Tabs
const activeDemoTab = ref<"checkout" | "license" | "ai" | "badge">("checkout");
const selectedDemoChannel = ref("QRIS Instan");
const selectedDemoBadge = ref("verified");

function copySdkInstall() {
  writeClipboard("npm install @tertaut/sdk");
}
</script>

<template>
  <section
    class="relative overflow-hidden pt-12 pb-16 md:pt-20 md:pb-24 border-b border-jetblack/10 bg-gradient-to-b from-white via-[#FCFCFC] to-[#F7F7F7]"
  >
    <div class="max-w-5xl mx-auto px-4 sm:px-6 text-center space-y-6">
      <!-- Top Pill Badge -->
      <div
        class="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-jetblack/5 border border-jetblack/10 text-jetblack text-xs font-semibold shadow-xs"
      >
        <span class="w-2 h-2 rounded-full bg-forest animate-pulse"></span>
        <span class="font-medium text-jetblack/90"
          >Merchant of Record &amp; Lisensi Software Indonesia</span
        >
        <span class="text-jetblack/30">•</span>
        <span class="text-forest font-bold">Flat 5% Fee • 0% Biaya Bulanan</span>
      </div>

      <!-- Main Headline -->
      <h1
        class="text-3xl sm:text-5xl md:text-6xl font-black text-jetblack tracking-tight leading-[1.12]"
      >
        Jual Software, SaaS &amp; AI di Indonesia.
        <br class="hidden sm:inline" />
        <span
          class="bg-gradient-to-r from-jetblack via-forest to-gold bg-clip-text text-transparent"
        >
          Tanpa Ribet PT/CV, Pajak, atau DRM.
        </span>
      </h1>

      <!-- Subtitle -->
      <p class="max-w-2xl mx-auto text-sm sm:text-base md:text-lg text-jetblack/70 leading-relaxed">
        Tertaut menangani pembayaran <strong>QRIS &amp; Virtual Account</strong>, faktur pajak resmi
        (PPN 11%), <strong>lisensi offline-first Ed25519</strong>, hingga proteksi kuota AI. Anda
        cukup fokus menulis kode dan mencairkan pendapatan.
      </p>

      <!-- CTA Action Buttons -->
      <div class="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
        <router-link
          to="/login"
          class="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-jetblack text-white text-sm font-bold shadow-lg shadow-jetblack/15 hover:bg-jetblack-hover transition active:scale-95"
        >
          <span>Mulai Monetisasi — Gratis</span>
          <ArrowRight class="w-4 h-4 text-gold" />
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
      <div class="pt-3 max-w-md mx-auto">
        <div
          @click="copySdkInstall"
          class="group cursor-pointer flex items-center justify-between px-4 py-2.5 rounded-xl bg-jetblack text-white font-mono text-xs border border-white/10 shadow-md hover:border-gold/50 transition"
        >
          <div class="flex items-center gap-2.5">
            <Terminal class="w-3.5 h-3.5 text-gold" />
            <span class="text-white/90">npm install @tertaut/sdk</span>
          </div>
          <span
            class="text-[10px] text-white/50 group-hover:text-gold font-sans font-medium transition"
          >
            {{ copiedSdk ? "Tersalin!" : "Salin" }}
          </span>
        </div>
        <div
          class="mt-2 text-[11px] text-jetblack/50 flex items-center justify-center gap-2 font-mono"
        >
          <span>v0.2.0 Live di NPM</span>
          <span>•</span>
          <span>Ukuran &lt; 15 KB</span>
          <span>•</span>
          <span>TypeScript Ready</span>
        </div>
      </div>

      <!-- Interactive Live Product Showcase Preview -->
      <div class="pt-8 max-w-3xl mx-auto text-left">
        <div
          class="luxury-card rounded-2xl p-4 sm:p-6 border border-jetblack/12 shadow-luxury space-y-4 bg-white"
        >
          <!-- Preview Header Tabs -->
          <div
            class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-jetblack/10"
          >
            <div class="flex items-center gap-2">
              <span class="w-2.5 h-2.5 rounded-full bg-forest animate-pulse"></span>
              <span class="text-xs font-bold uppercase tracking-wider text-jetblack font-mono"
                >Simulasi Interaktif</span
              >
              <span class="text-xs text-jetblack/30">•</span>
              <span class="text-xs text-jetblack/50">Coba Fitur Utama Tertaut</span>
            </div>

            <!-- Interactive Tabs -->
            <div
              class="flex items-center rounded-lg bg-jetblack/5 p-0.5 text-xs font-semibold overflow-x-auto"
            >
              <button
                @click="activeDemoTab = 'checkout'"
                :class="[
                  'px-2.5 py-1 rounded-md transition cursor-pointer text-xs whitespace-nowrap',
                  activeDemoTab === 'checkout'
                    ? 'bg-white font-bold text-jetblack shadow-xs'
                    : 'text-jetblack/60 hover:text-jetblack',
                ]"
              >
                💳 MoR Checkout
              </button>
              <button
                @click="activeDemoTab = 'license'"
                :class="[
                  'px-2.5 py-1 rounded-md transition cursor-pointer text-xs whitespace-nowrap',
                  activeDemoTab === 'license'
                    ? 'bg-white font-bold text-jetblack shadow-xs'
                    : 'text-jetblack/60 hover:text-jetblack',
                ]"
              >
                🔑 Lisensi Ed25519
              </button>
              <button
                @click="activeDemoTab = 'ai'"
                :class="[
                  'px-2.5 py-1 rounded-md transition cursor-pointer text-xs whitespace-nowrap',
                  activeDemoTab === 'ai'
                    ? 'bg-white font-bold text-jetblack shadow-xs'
                    : 'text-jetblack/60 hover:text-jetblack',
                ]"
              >
                🤖 AI Gateway
              </button>
              <button
                @click="activeDemoTab = 'badge'"
                :class="[
                  'px-2.5 py-1 rounded-md transition cursor-pointer text-xs whitespace-nowrap',
                  activeDemoTab === 'badge'
                    ? 'bg-white font-bold text-jetblack shadow-xs'
                    : 'text-jetblack/60 hover:text-jetblack',
                ]"
              >
                ✨ Trust Badge
              </button>
            </div>
          </div>

          <!-- Tab 1: Checkout -->
          <div
            v-if="activeDemoTab === 'checkout'"
            class="grid grid-cols-1 sm:grid-cols-12 gap-5 items-center"
          >
            <div class="sm:col-span-7 space-y-3">
              <div class="flex items-center justify-between">
                <div class="text-xs font-bold text-jetblack">Pilih Metode Pembayaran:</div>
                <span
                  class="text-[10px] text-forest font-bold bg-forest/10 px-2 py-0.5 rounded-full"
                  >Konfirmasi Otomatis</span
                >
              </div>
              <div class="grid grid-cols-3 gap-2">
                <button
                  v-for="ch in ['QRIS Instan', 'BCA / Mandiri VA', 'GoPay / OVO']"
                  :key="ch"
                  @click="selectedDemoChannel = ch"
                  :class="[
                    'p-2.5 rounded-xl border text-center transition cursor-pointer text-[11px] font-bold',
                    selectedDemoChannel === ch
                      ? 'border-jetblack bg-jetblack text-white shadow-xs'
                      : 'border-jetblack/15 bg-white text-jetblack hover:border-jetblack/30',
                  ]"
                >
                  {{ ch }}
                </button>
              </div>
              <div
                class="p-3 rounded-xl bg-[#FAFAFA] border border-jetblack/10 text-xs space-y-1.5"
              >
                <div class="flex justify-between">
                  <span class="text-jetblack/60">Harga Lisensi Software:</span>
                  <span class="font-mono font-bold text-jetblack">Rp 100.000</span>
                </div>
                <div class="flex justify-between text-crimson">
                  <span>Merchant of Record Fee (5% flat):</span>
                  <span class="font-mono">-Rp 5.000</span>
                </div>
                <div class="pt-1.5 border-t border-jetblack/10 flex justify-between font-bold">
                  <span class="text-forest">Uang Bersih Builder (95%):</span>
                  <span class="font-mono text-sm text-forest">Rp 95.000</span>
                </div>
              </div>
            </div>

            <div class="sm:col-span-5 p-4 rounded-xl bg-jetblack text-white space-y-2.5 shadow-xs">
              <div class="flex items-center gap-1.5 text-xs font-bold text-gold">
                <CheckCircle2 class="w-4 h-4 shrink-0" />
                <span>Tanpa Izin Perusahaan</span>
              </div>
              <p class="text-[11px] text-white/75 leading-relaxed">
                Tidak perlu mendaftar PT/CV atau KYC Payment Gateway yang rumit. Uang masuk via MoR
                dan dicairkan 95% langsung ke rekening Anda.
              </p>
            </div>
          </div>

          <!-- Tab 2: Licensing -->
          <div
            v-else-if="activeDemoTab === 'license'"
            class="grid grid-cols-1 sm:grid-cols-12 gap-5 items-center"
          >
            <div class="sm:col-span-7 space-y-3">
              <div class="p-3 rounded-xl bg-[#FAFAFA] border border-jetblack/10 space-y-2">
                <div class="flex items-center justify-between text-xs">
                  <span class="font-mono text-jetblack/70">Kunci: TT-PRO-9821-4412</span>
                  <span
                    class="px-2 py-0.5 rounded-full bg-forest/10 text-forest font-bold text-[10px]"
                    >STATUS: VALID</span
                  >
                </div>
                <div class="grid grid-cols-2 gap-2 text-[11px]">
                  <div class="p-2 rounded-lg bg-white border border-jetblack/5">
                    <div class="text-jetblack/50 text-[10px]">Device Seats</div>
                    <div class="font-bold text-jetblack">1 / 3 Laptop Aktif</div>
                  </div>
                  <div class="p-2 rounded-lg bg-white border border-jetblack/5">
                    <div class="text-jetblack/50 text-[10px]">Grace Period Offline</div>
                    <div class="font-bold text-forest">30 Hari Sisa</div>
                  </div>
                </div>
              </div>
              <div class="text-[11px] text-jetblack/60 flex items-center gap-1.5 font-mono">
                <Lock class="w-3 h-3 text-gold" />
                <span>Kriptografi Ed25519 &amp; Hardware Fingerprint Binding</span>
              </div>
            </div>

            <div class="sm:col-span-5 p-4 rounded-xl bg-jetblack text-white space-y-2.5 shadow-xs">
              <div class="flex items-center gap-1.5 text-xs font-bold text-gold">
                <ShieldCheck class="w-4 h-4 shrink-0" />
                <span>Anti-Pembajakan Klien</span>
              </div>
              <p class="text-[11px] text-white/75 leading-relaxed">
                Cegah duplikasi software Anda. Lisensi dikunci ke hardware ID pengguna dan bisa
                tetap berjalan offline saat di pesawat atau tanpa internet.
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

          <!-- Tab 3: AI Gateway -->
          <div
            v-else-if="activeDemoTab === 'ai'"
            class="grid grid-cols-1 sm:grid-cols-12 gap-5 items-center"
          >
            <div class="sm:col-span-7 space-y-3">
              <div
                class="p-3 rounded-xl bg-[#FAFAFA] border border-jetblack/10 font-mono text-xs space-y-2"
              >
                <div class="flex items-center justify-between text-[11px]">
                  <span class="text-jetblack/60">POST /api/v1/ai/chat/stream</span>
                  <span class="text-forest font-bold">200 OK</span>
                </div>
                <div
                  class="p-2.5 rounded-lg bg-white border border-jetblack/10 text-[11px] text-jetblack/80 space-y-1 font-sans"
                >
                  <div class="font-bold text-jetblack text-xs">Proteksi API Terpasang:</div>
                  <div class="text-forest text-[11px]">✓ Kunci OpenAI tersembunyi di server</div>
                  <div class="text-forest text-[11px]">✓ Batas 15 permintaan per menit</div>
                  <div class="text-forest text-[11px]">✓ Kuota harian 50.000 token per lisensi</div>
                </div>
              </div>
            </div>

            <div class="sm:col-span-5 p-4 rounded-xl bg-jetblack text-white space-y-2.5 shadow-xs">
              <div class="flex items-center gap-1.5 text-xs font-bold text-gold">
                <Bot class="w-4 h-4 shrink-0" />
                <span>Cegah Tagihan Boncos</span>
              </div>
              <p class="text-[11px] text-white/75 leading-relaxed">
                Jual software berbasis AI tanpa takut pengguna mengekstrak API key OpenAI Anda dari
                file binari atau browser.
              </p>
              <router-link
                to="/dashboard/ai-proxy"
                class="inline-flex items-center gap-1 text-xs font-bold text-gold hover:underline pt-1"
              >
                <span>Pelajari AI Shield</span>
                <ExternalLink class="w-3.5 h-3.5" />
              </router-link>
            </div>
          </div>

          <!-- Tab 4: Badge -->
          <div v-else class="grid grid-cols-1 sm:grid-cols-12 gap-5 items-center">
            <div class="sm:col-span-7 space-y-3">
              <div class="text-xs font-bold text-jetblack">
                Pilih Gaya Badge untuk Website Anda:
              </div>
              <div class="flex flex-wrap gap-2">
                <button
                  v-for="bt in ['verified', 'sales_counter', 'status']"
                  :key="bt"
                  @click="selectedDemoBadge = bt"
                  :class="[
                    'px-2.5 py-1 rounded-lg border text-xs font-bold capitalize transition cursor-pointer',
                    selectedDemoBadge === bt
                      ? 'border-jetblack bg-jetblack text-white'
                      : 'border-jetblack/15 bg-white text-jetblack hover:bg-jetblack/5',
                  ]"
                >
                  {{ bt.replace("_", " ") }}
                </button>
              </div>
              <div
                class="p-4 rounded-xl bg-[#FAFAFA] border border-jetblack/10 flex items-center justify-center min-h-[70px]"
              >
                <img :src="`/badge/fastmail-ai.svg`" alt="Badge Preview" class="h-6 shadow-xs" />
              </div>
            </div>

            <div class="sm:col-span-5 p-4 rounded-xl bg-jetblack text-white space-y-2.5 shadow-xs">
              <div class="flex items-center gap-1.5 text-xs font-bold text-gold">
                <Sparkles class="w-4 h-4 shrink-0" />
                <span>Tingkatkan Konversi</span>
              </div>
              <p class="text-[11px] text-white/75 leading-relaxed">
                Pasang tag <code>&lt;tertaut-badge&gt;</code> di website produk Anda. Buktikan
                kepada calon pembeli bahwa produk Anda aktif, terverifikasi, dan bergaransi resmi.
              </p>
              <router-link
                to="/dashboard/docs"
                class="inline-flex items-center gap-1 text-xs font-bold text-gold hover:underline pt-1"
              >
                <span>Cara Pasang Widget</span>
                <ExternalLink class="w-3.5 h-3.5" />
              </router-link>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
