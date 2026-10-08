<script setup lang="ts">
import { CreditCard, KeyRound, Bot, Sparkles, ChevronRight } from "lucide-vue-next";
</script>

<template>
  <section id="solusi" class="py-16 md:py-24 bg-[#FAFAFA] border-y border-jetblack/10">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 space-y-12">
      <div class="text-center space-y-3 max-w-2xl mx-auto">
        <h2 class="text-xs font-bold uppercase tracking-widest text-gold font-mono">
          Solusi Menyeluruh
        </h2>
        <h3 class="text-2xl sm:text-3xl font-extrabold text-jetblack tracking-tight">
          Semua yang Dibutuhkan untuk Monetisasi Software
        </h3>
        <p class="text-xs sm:text-sm text-jetblack/65">
          Empat pilar terpadu yang dirancang khusus untuk kebutuhan bisnis developer, indie maker,
          dan tim software.
        </p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <!-- Pilar 1 -->
        <div
          class="luxury-card rounded-2xl p-6 space-y-4 border border-jetblack/10 hover:border-jetblack/30 transition group flex flex-col justify-between"
        >
          <div class="space-y-4">
            <div
              class="w-10 h-10 rounded-xl bg-jetblack/5 flex items-center justify-center text-jetblack group-hover:bg-jetblack group-hover:text-white transition"
            >
              <CreditCard class="w-5 h-5 text-forest" />
            </div>
            <div class="space-y-2">
              <span
                class="text-[10px] font-bold uppercase tracking-wider text-jetblack/50 font-mono"
                >Pilar 01</span
              >
              <h4 class="text-base font-bold text-jetblack">Merchant of Record &amp; Checkout</h4>
              <p class="text-xs text-jetblack/65 leading-relaxed">
                Terima QRIS semua e-wallet &amp; Virtual Account bank. Dilengkapi e-receipt resmi,
                faktur PPN, dukungan kupon diskon, dan proteksi anti-fraud.
              </p>
            </div>
          </div>
          <div
            class="pt-3 border-t border-jetblack/5 flex items-center justify-between text-xs font-semibold"
          >
            <span class="text-jetblack/60">Multi-Payment Rail</span>
            <span class="text-[10px] font-mono text-forest bg-forest/10 px-2 py-0.5 rounded"
              >QRIS + VA</span
            >
          </div>
        </div>

        <!-- Pilar 2 -->
        <div
          class="luxury-card rounded-2xl p-6 space-y-4 border border-jetblack/10 hover:border-jetblack/30 transition group flex flex-col justify-between"
        >
          <div class="space-y-4">
            <div
              class="w-10 h-10 rounded-xl bg-jetblack/5 flex items-center justify-center text-jetblack group-hover:bg-jetblack group-hover:text-white transition"
            >
              <KeyRound class="w-5 h-5 text-gold" />
            </div>
            <div class="space-y-2">
              <span
                class="text-[10px] font-bold uppercase tracking-wider text-jetblack/50 font-mono"
                >Pilar 02</span
              >
              <h4 class="text-base font-bold text-jetblack">
                Universal Licensing &amp; Seat Control
              </h4>
              <p class="text-xs text-jetblack/65 leading-relaxed">
                DRM untuk Tauri, Electron, Web &amp; CLI. Penguncian device hardware, offline token
                Ed25519 (hingga 30 hari), dan floating seat lease untuk lisensi tim.
              </p>
            </div>
          </div>
          <div
            class="pt-3 border-t border-jetblack/5 flex items-center justify-between text-xs font-semibold"
          >
            <router-link
              to="/dashboard/docs"
              class="text-forest hover:underline flex items-center gap-1"
            >
              <span>Pelajari DRM</span>
              <ChevronRight class="w-3.5 h-3.5" />
            </router-link>
            <span class="text-[10px] font-mono text-forest bg-forest/10 px-2 py-0.5 rounded"
              >Ed25519 DRM</span
            >
          </div>
        </div>

        <!-- Pilar 3 -->
        <div
          class="luxury-card rounded-2xl p-6 space-y-4 border border-jetblack/10 hover:border-jetblack/30 transition group flex flex-col justify-between"
        >
          <div class="space-y-4">
            <div
              class="w-10 h-10 rounded-xl bg-jetblack/5 flex items-center justify-center text-jetblack group-hover:bg-jetblack group-hover:text-white transition"
            >
              <Bot class="w-5 h-5 text-forest" />
            </div>
            <div class="space-y-2">
              <span
                class="text-[10px] font-bold uppercase tracking-wider text-jetblack/50 font-mono"
                >Pilar 03</span
              >
              <h4 class="text-base font-bold text-jetblack">AI Proxy Shield &amp; Metering</h4>
              <p class="text-xs text-jetblack/65 leading-relaxed">
                Gateway aman ke OpenAI, Claude &amp; Gemini. Enkripsi AES-256 di data store, rate
                limit 15 req/menit, daily token cap, dan Zero Prompt Retention.
              </p>
            </div>
          </div>
          <div
            class="pt-3 border-t border-jetblack/5 flex items-center justify-between text-xs font-semibold"
          >
            <router-link
              to="/dashboard/docs"
              class="text-forest hover:underline flex items-center gap-1"
            >
              <span>AI Gateway</span>
              <ChevronRight class="w-3.5 h-3.5" />
            </router-link>
            <span class="text-[10px] font-mono text-forest bg-forest/10 px-2 py-0.5 rounded"
              >Zero Leak</span
            >
          </div>
        </div>

        <!-- Pilar 4 -->
        <div
          class="luxury-card rounded-2xl p-6 space-y-4 border border-jetblack/10 hover:border-jetblack/30 transition group flex flex-col justify-between"
        >
          <div class="space-y-4">
            <div
              class="w-10 h-10 rounded-xl bg-jetblack/5 flex items-center justify-center text-jetblack group-hover:bg-jetblack group-hover:text-white transition"
            >
              <Sparkles class="w-5 h-5 text-gold" />
            </div>
            <div class="space-y-2">
              <span
                class="text-[10px] font-bold uppercase tracking-wider text-jetblack/50 font-mono"
                >Pilar 04</span
              >
              <h4 class="text-base font-bold text-jetblack">Launch Kit &amp; Trust Widget</h4>
              <p class="text-xs text-jetblack/65 leading-relaxed">
                Tingkatkan konversi penjualan hingga 40% dengan web component badge terverifikasi,
                sales counter, dan sistem kupon diskon terintegrasi.
              </p>
            </div>
          </div>
          <div
            class="pt-3 border-t border-jetblack/5 flex items-center justify-between text-xs font-semibold"
          >
            <router-link
              to="/dashboard/docs"
              class="text-forest hover:underline flex items-center gap-1"
            >
              <span>Widget Badge</span>
              <ChevronRight class="w-3.5 h-3.5" />
            </router-link>
            <span class="text-[10px] font-mono text-forest bg-forest/10 px-2 py-0.5 rounded"
              >Embeddable</span
            >
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
