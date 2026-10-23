<script setup lang="ts">
import { useClipboard } from "../../composables/useClipboard";
import { ArrowRight, Code2, Terminal } from "lucide-vue-next";

const { copied: copiedSdk, copy: writeClipboard } = useClipboard();

function copySdkInstall() {
  writeClipboard("npm install @tertaut/sdk");
}
</script>

<template>
  <section
    class="relative overflow-hidden pt-12 pb-16 md:pt-20 md:pb-24 border-b border-jetblack/10 bg-[#FCFCFD]"
  >
    <!-- Background Ambient Glow & Tech Grid Pattern -->
    <div
      class="absolute top-0 left-1/2 -translate-x-1/2 w-[720px] h-[360px] bg-gradient-to-b from-forest/10 via-emerald-500/5 to-transparent blur-3xl pointer-events-none rounded-full"
    ></div>
    <div
      class="absolute inset-0 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:24px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none opacity-60"
    ></div>

    <div class="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 text-center space-y-6">
      <!-- Top Pill Badge -->
      <div class="inline-flex items-center">
        <div
          class="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-white/90 backdrop-blur-md border border-slate-200/90 text-jetblack text-xs font-semibold shadow-xs hover:border-forest/40 transition-all duration-200"
        >
          <span class="relative flex h-2 w-2">
            <span
              class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"
            ></span>
            <span class="relative inline-flex rounded-full h-2 w-2 bg-forest"></span>
          </span>
          <span class="font-medium text-slate-800">Managed Payment &amp; Universal Licensing</span>
          <span class="text-slate-300">•</span>
          <span
            class="text-forest font-bold font-mono text-[11px] bg-forest/10 px-2 py-0.5 rounded-full"
            >Flat 5% • 0% Bulanan</span
          >
        </div>
      </div>

      <!-- Main Headline: Besar, Bold, Presisi 2 Baris -->
      <h1
        class="text-4xl sm:text-6xl md:text-7xl lg:text-[76px] font-black text-slate-950 tracking-tight leading-[1.08] font-sans"
      >
        Monetisasi Software
        <br />
        <span
          class="bg-gradient-to-r from-forest via-emerald-600 to-amber-600 bg-clip-text text-transparent"
        >
          Jadi Lebih Sederhana.
        </span>
      </h1>

      <!-- Subtitle: Menggabungkan Pembayaran Otomatis & Lisensi Siap Pakai -->
      <p
        class="max-w-2xl mx-auto text-base sm:text-lg md:text-xl text-slate-600 leading-relaxed font-normal"
      >
        <span class="font-bold text-slate-900">Pembayaran otomatis &amp; lisensi siap pakai.</span>
        Terima
        <strong class="text-slate-900 font-semibold">QRIS &amp; Virtual Account</strong> instan,
        kelola lisensi digital aman, dan cairkan pendapatan langsung ke rekening Anda tanpa setup
        yang rumit.
      </p>

      <!-- CTA Action Buttons -->
      <div class="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
        <router-link
          to="/login"
          class="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl bg-jetblack text-white text-sm font-bold shadow-lg shadow-jetblack/20 hover:bg-jetblack-hover hover:-translate-y-0.5 hover:shadow-xl hover:shadow-jetblack/25 transition-all duration-200 active:scale-98 cursor-pointer"
        >
          <span>Mulai Monetisasi — Gratis</span>
          <ArrowRight class="w-4 h-4 text-gold" />
        </router-link>

        <router-link
          to="/dashboard/docs"
          class="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl text-xs font-bold text-slate-700 bg-white border border-slate-200/90 shadow-2xs hover:bg-slate-50 hover:text-slate-950 hover:border-slate-300 transition-all duration-200 cursor-pointer"
        >
          <Code2 class="w-4 h-4 text-forest" />
          <span>Dokumentasi SDK</span>
        </router-link>
      </div>

      <!-- Quick Terminal Snippet -->
      <div class="pt-3 max-w-md mx-auto">
        <div
          @click="copySdkInstall"
          class="group cursor-pointer flex items-center justify-between px-4 py-2.5 rounded-xl bg-jetblack text-white font-mono text-xs border border-white/10 shadow-md hover:border-gold/50 hover:shadow-lg transition-all duration-200"
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
          class="mt-2.5 text-[11px] text-slate-500 flex items-center justify-center gap-2.5 font-mono"
        >
          <span class="inline-flex items-center gap-1.5">
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            v0.2.0 NPM
          </span>
          <span class="text-slate-300">•</span>
          <span>&lt; 15 KB</span>
          <span class="text-slate-300">•</span>
          <span>TypeScript Ready</span>
        </div>
      </div>
    </div>
  </section>
</template>
