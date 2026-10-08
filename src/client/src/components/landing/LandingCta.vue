<script setup lang="ts">
import { Sparkles, ArrowRight } from "lucide-vue-next";
</script>

<template>
  <section class="py-16 md:py-20 bg-jetblack text-white relative overflow-hidden">
    <!-- Glow decoration -->
    <div
      class="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-forest/20 blur-3xl pointer-events-none"
    ></div>
    <div
      class="absolute -bottom-24 -left-24 w-96 h-96 rounded-full bg-gold/15 blur-3xl pointer-events-none"
    ></div>

    <div class="max-w-4xl mx-auto px-4 sm:px-6 text-center space-y-6 relative z-10">
      <div
        class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-gold text-xs font-bold font-mono"
      >
        <Sparkles class="w-3.5 h-3.5" />
        <span>MULAI DALAM 2 MENIT</span>
      </div>

      <h2 class="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight leading-tight">
        Siap Menghasilkan Uang dari Karya Software Anda?
      </h2>

      <p class="max-w-xl mx-auto text-xs sm:text-sm md:text-base text-white/70 leading-relaxed">
        Tinggalkan kerumitan mendirikan PT, mengurus izin payment gateway, dan membuat sistem
        lisensi sendiri. Mulai terima pembayaran QRIS dan Virtual Account pertama Anda hari ini.
      </p>

      <div class="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
        <router-link
          to="/login"
          class="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl bg-white text-jetblack text-sm font-bold shadow-lg hover:bg-[#F2F2F2] transition active:scale-95"
        >
          <span>Daftar Gratis Sekarang</span>
          <ArrowRight class="w-4 h-4 text-forest" />
        </router-link>
      </div>

      <div class="text-[11px] text-white/40 pt-2 font-mono">
        Tanpa kartu kredit • Tanpa kontrak mengikat • Batal kapan saja
      </div>
    </div>
  </section>
</template>
