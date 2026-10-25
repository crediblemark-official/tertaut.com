<script setup lang="ts">
import { Sparkles, ArrowRight } from "lucide-vue-next";
</script>

<template>
  <section class="py-12 sm:py-16 md:py-20 bg-jetblack text-white relative overflow-hidden">
    <!-- Glow decoration -->
    <div
      class="absolute -top-24 -right-24 w-72 sm:w-96 h-72 sm:h-96 rounded-full bg-forest/20 blur-3xl pointer-events-none"
    ></div>
    <div
      class="absolute -bottom-24 -left-24 w-72 sm:w-96 h-72 sm:h-96 rounded-full bg-gold/15 blur-3xl pointer-events-none"
    ></div>

    <div class="max-w-4xl mx-auto px-3.5 sm:px-6 text-center space-y-4 sm:space-y-6 relative z-10">
      <div
        class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-gold text-xs font-bold font-mono"
      >
        <Sparkles class="w-3.5 h-3.5" />
        <span>MULAI DALAM 2 MENIT</span>
      </div>

      <h2
        class="text-2xl sm:text-4xl md:text-5xl font-black tracking-tight leading-snug sm:leading-tight"
      >
        Siap Menghasilkan Uang dari Karya Software Anda?
      </h2>

      <p
        class="max-w-xl mx-auto text-xs sm:text-sm md:text-base text-white/75 leading-relaxed px-1 sm:px-0"
      >
        Tinggalkan kerumitan mendirikan PT, mengurus izin payment gateway, dan membuat sistem
        lisensi sendiri. Mulai terima pembayaran QRIS dan Virtual Account pertama Anda hari ini.
      </p>

      <div
        class="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 max-w-sm sm:max-w-none mx-auto"
      >
        <router-link
          to="/login"
          class="w-full sm:w-auto inline-flex items-center justify-center gap-2 min-h-[46px] px-7 py-3.5 rounded-xl bg-white text-jetblack text-sm font-bold shadow-lg hover:bg-[#F2F2F2] transition active:scale-95 cursor-pointer"
        >
          <span>Daftar Gratis Sekarang</span>
          <ArrowRight class="w-4 h-4 text-forest shrink-0" />
        </router-link>
      </div>

      <div
        class="text-[10px] sm:text-[11px] text-white/40 pt-1 sm:pt-2 font-mono flex flex-wrap justify-center gap-x-2 gap-y-1"
      >
        <span>Tanpa kartu kredit</span>
        <span>•</span>
        <span>Tanpa kontrak mengikat</span>
        <span>•</span>
        <span>Batal kapan saja</span>
      </div>
    </div>
  </section>
</template>
