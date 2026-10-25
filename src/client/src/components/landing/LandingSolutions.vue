<script setup lang="ts">
import { CreditCard, KeyRound, Webhook, Tag, ChevronRight } from "lucide-vue-next";
</script>

<template>
  <section
    id="solusi"
    class="py-10 sm:py-16 md:py-24 bg-[#FAFAFA] border-y border-jetblack/10 w-full min-w-0"
  >
    <div class="max-w-7xl mx-auto px-3.5 sm:px-6 space-y-8 sm:space-y-12 w-full min-w-0">
      <div class="text-center space-y-2.5 sm:space-y-3 max-w-2xl mx-auto px-1 sm:px-0">
        <h2 class="text-xs font-bold uppercase tracking-widest text-gold font-mono">
          Solusi Menyeluruh
        </h2>
        <h3
          class="text-xl sm:text-2xl md:text-3xl font-extrabold text-jetblack tracking-tight leading-snug"
        >
          Semua yang Dibutuhkan untuk Monetisasi Software
        </h3>
        <p class="text-xs sm:text-sm text-jetblack/65">
          Empat pilar terpadu yang dirancang khusus untuk kebutuhan bisnis developer, indie maker,
          dan tim software.
        </p>
      </div>

      <!-- Solutions Cards (Mobile Swipeable Horizontal Scroll / Desktop 4-Col Grid) -->
      <div
        class="flex lg:grid lg:grid-cols-4 gap-3.5 sm:gap-5 lg:gap-6 overflow-x-auto lg:overflow-visible pb-4 lg:pb-0 snap-x snap-mandatory lg:snap-none scroll-smooth no-scrollbar w-full min-w-0"
      >
        <!-- Pilar 1 -->
        <div
          class="w-[82vw] max-w-[300px] lg:max-w-none lg:w-auto shrink-0 lg:shrink snap-center lg:snap-align-none rounded-2xl p-5 sm:p-6 bg-white border border-slate-200/90 shadow-2xs hover:shadow-card hover:border-slate-300 transition-all duration-200 group flex flex-col justify-between space-y-4"
        >
          <div class="space-y-3.5 sm:space-y-4">
            <div
              class="w-10 h-10 rounded-xl bg-forest/10 border border-forest/15 flex items-center justify-center text-forest group-hover:bg-forest group-hover:text-white transition-colors duration-200 shadow-2xs"
            >
              <CreditCard class="w-5 h-5" />
            </div>
            <div class="space-y-1.5 sm:space-y-2">
              <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono"
                >Pilar 01</span
              >
              <h4 class="text-sm sm:text-base font-bold text-slate-950">
                Merchant of Record &amp; Checkout
              </h4>
              <p class="text-xs text-slate-600 leading-relaxed">
                Terima QRIS semua e-wallet &amp; Virtual Account bank. Dilengkapi e-receipt resmi,
                faktur PPN, dukungan kupon diskon, dan proteksi anti-fraud.
              </p>
            </div>
          </div>
          <div
            class="pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-semibold"
          >
            <span class="text-slate-500 text-[11px]">Multi-Payment Rail</span>
            <span
              class="text-[10px] font-mono text-forest bg-forest/10 px-2 py-0.5 rounded-full font-bold"
              >QRIS + VA</span
            >
          </div>
        </div>

        <!-- Pilar 2 -->
        <div
          class="w-[82vw] max-w-[300px] lg:max-w-none lg:w-auto shrink-0 lg:shrink snap-center lg:snap-align-none rounded-2xl p-5 sm:p-6 bg-white border border-slate-200/90 shadow-2xs hover:shadow-card hover:border-slate-300 transition-all duration-200 group flex flex-col justify-between space-y-4"
        >
          <div class="space-y-3.5 sm:space-y-4">
            <div
              class="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 group-hover:bg-amber-600 group-hover:text-white transition-colors duration-200 shadow-2xs"
            >
              <KeyRound class="w-5 h-5" />
            </div>
            <div class="space-y-1.5 sm:space-y-2">
              <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono"
                >Pilar 02</span
              >
              <h4 class="text-sm sm:text-base font-bold text-slate-950">
                Universal Licensing &amp; Seat Control
              </h4>
              <p class="text-xs text-slate-600 leading-relaxed">
                DRM untuk Tauri, Electron, Web &amp; CLI. Penguncian device hardware, offline token
                Ed25519 (hingga 30 hari), dan floating seat lease untuk lisensi tim.
              </p>
            </div>
          </div>
          <div
            class="pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-semibold"
          >
            <router-link
              to="/dashboard/docs"
              class="text-forest hover:underline flex items-center gap-1 text-[11px]"
            >
              <span>Pelajari DRM</span>
              <ChevronRight class="w-3.5 h-3.5" />
            </router-link>
            <span
              class="text-[10px] font-mono text-forest bg-forest/10 px-2 py-0.5 rounded-full font-bold"
              >Ed25519 DRM</span
            >
          </div>
        </div>

        <!-- Pilar 3 -->
        <div
          class="w-[82vw] max-w-[300px] lg:max-w-none lg:w-auto shrink-0 lg:shrink snap-center lg:snap-align-none rounded-2xl p-5 sm:p-6 bg-white border border-slate-200/90 shadow-2xs hover:shadow-card hover:border-slate-300 transition-all duration-200 group flex flex-col justify-between space-y-4"
        >
          <div class="space-y-3.5 sm:space-y-4">
            <div
              class="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors duration-200 shadow-2xs"
            >
              <Webhook class="w-5 h-5" />
            </div>
            <div class="space-y-1.5 sm:space-y-2">
              <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono"
                >Pilar 03</span
              >
              <h4 class="text-sm sm:text-base font-bold text-slate-950">
                Developer API &amp; Webhooks
              </h4>
              <p class="text-xs text-slate-600 leading-relaxed">
                Integrasi pembayaran dinamis dari kode backend SaaS. Dilengkapi verifikasi tanda
                tangan HMAC-SHA256 dan modal kasir in-app zero-redirect.
              </p>
            </div>
          </div>
          <div
            class="pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-semibold"
          >
            <router-link
              to="/dashboard/docs"
              class="text-forest hover:underline flex items-center gap-1 text-[11px]"
            >
              <span>Developer API</span>
              <ChevronRight class="w-3.5 h-3.5" />
            </router-link>
            <span
              class="text-[10px] font-mono text-forest bg-forest/10 px-2 py-0.5 rounded-full font-bold"
              >HMAC Signed</span
            >
          </div>
        </div>

        <!-- Pilar 4: Hosted Pay Link & Kupon Diskon (Replacing deprecated Trust Badge) -->
        <div
          class="w-[82vw] max-w-[300px] lg:max-w-none lg:w-auto shrink-0 lg:shrink snap-center lg:snap-align-none rounded-2xl p-5 sm:p-6 bg-white border border-slate-200/90 shadow-2xs hover:shadow-card hover:border-slate-300 transition-all duration-200 group flex flex-col justify-between space-y-4"
        >
          <div class="space-y-3.5 sm:space-y-4">
            <div
              class="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-600 group-hover:bg-purple-600 group-hover:text-white transition-colors duration-200 shadow-2xs"
            >
              <Tag class="w-5 h-5" />
            </div>
            <div class="space-y-1.5 sm:space-y-2">
              <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono"
                >Pilar 04</span
              >
              <h4 class="text-sm sm:text-base font-bold text-slate-950">
                Hosted Pay Link &amp; Kupon
              </h4>
              <p class="text-xs text-slate-600 leading-relaxed">
                Mulai berjualan instan tanpa perlu bikin website toko sendiri. Bagikan link
                pembayaran siap pakai dengan mesin kupon diskon persentase dan nominal.
              </p>
            </div>
          </div>
          <div
            class="pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-semibold"
          >
            <router-link
              to="/demo/checkout"
              class="text-forest hover:underline flex items-center gap-1 text-[11px]"
            >
              <span>Simulasi Pay Link</span>
              <ChevronRight class="w-3.5 h-3.5" />
            </router-link>
            <span
              class="text-[10px] font-mono text-forest bg-forest/10 px-2 py-0.5 rounded-full font-bold"
              >Hosted Pay</span
            >
          </div>
        </div>
      </div>

      <!-- Mobile Swipe Hint -->
      <div
        class="flex lg:hidden items-center justify-center gap-1.5 text-slate-400 font-mono text-[10px]"
      >
        <span>← Geser untuk melihat 4 pilar solusi →</span>
      </div>
    </div>
  </section>
</template>
