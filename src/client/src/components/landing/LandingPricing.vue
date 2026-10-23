<script setup lang="ts">
import { Sparkles, QrCode, ArrowRight } from "lucide-vue-next";
import { COMPANY_INFO } from "../../constants/company";
</script>

<template>
  <section
    id="biaya"
    class="py-16 md:py-24 max-w-7xl mx-auto px-4 sm:px-6 space-y-10 sm:space-y-12"
  >
    <!-- Section Header -->
    <div class="text-center space-y-3 max-w-2xl mx-auto">
      <div
        class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-forest/10 text-forest text-xs font-bold font-mono"
      >
        <Sparkles class="w-3.5 h-3.5" />
        <span>BIAYA LAYANAN TRANSPARAN</span>
      </div>
      <h2 class="text-2xl sm:text-4xl font-black text-slate-950 tracking-tight leading-tight">
        100% Gratis Digunakan.<br />
        <span class="text-forest">Hanya 5% Flat Fee Saat Terjadi Penjualan.</span>
      </h2>
      <p class="text-xs sm:text-sm text-slate-600 leading-relaxed">
        Platform Tertaut dioperasikan resmi oleh
        <strong class="text-slate-900">{{ COMPANY_INFO.legalName }}</strong
        >. Tanpa biaya pendaftaran, tanpa biaya bulanan, dan tanpa kontrak terikat.
      </p>
    </div>

    <!-- 3 Columns Highlights -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-5 lg:gap-6 items-stretch">
      <!-- Card 1: Pendaftaran & Akun -->
      <div
        class="flex flex-col justify-between p-6 sm:p-7 rounded-2xl bg-white border border-slate-200/90 shadow-2xs hover:border-slate-300 hover:shadow-xs transition-all duration-200"
      >
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <span class="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-400">
              01 • Akun &amp; Platform
            </span>
            <span
              class="px-2.5 py-0.5 rounded-full bg-slate-100 text-[10px] font-bold text-slate-600 font-mono"
            >
              Gratis
            </span>
          </div>
          <div>
            <div class="flex items-baseline gap-1.5 font-sans">
              <span class="text-3xl sm:text-4xl font-black text-slate-950 tracking-tight"
                >Rp 0</span
              >
              <span class="text-xs text-slate-500 font-medium">/ selamanya</span>
            </div>
          </div>
          <p class="text-xs sm:text-[13px] text-slate-600 leading-relaxed">
            Daftar dan gunakan seluruh fitur payment gateway, checkout modal, lisensi Ed25519, dan
            API secara gratis tanpa biaya awal.
          </p>
        </div>
        <div
          class="pt-4 border-t border-slate-100 text-[11px] text-slate-500 flex items-center gap-1.5 font-medium mt-4"
        >
          <span class="text-emerald-600 font-bold">✓</span> Tanpa biaya pendaftaran atau bulanan
        </div>
      </div>

      <!-- Card 2: Biaya Transaksi (Featured Card) -->
      <div
        class="flex flex-col justify-between p-6 sm:p-7 rounded-2xl bg-emerald-500/[0.04] border-2 border-forest/30 shadow-xs relative hover:border-forest/50 transition-all duration-200"
      >
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <span class="text-[11px] font-mono font-bold uppercase tracking-wider text-forest">
              02 • Biaya Transaksi
            </span>
            <span
              class="px-2.5 py-0.5 rounded-full bg-forest/15 text-[10px] font-bold text-forest font-mono"
            >
              Flat Fee
            </span>
          </div>
          <div>
            <div class="flex items-baseline gap-1.5 font-sans">
              <span class="text-3xl sm:text-4xl font-black text-forest tracking-tight">5%</span>
              <span class="text-xs text-forest/80 font-bold">Flat per transaksi</span>
            </div>
          </div>
          <p class="text-xs sm:text-[13px] text-forest/90 leading-relaxed">
            Hanya dipotong saat pembeli software Anda berhasil membayar via QRIS atau Virtual
            Account. Tanpa biaya jika tidak ada penjualan.
          </p>
        </div>
        <div
          class="pt-4 border-t border-forest/15 text-[11px] text-forest font-medium flex items-center gap-1.5 mt-4"
        >
          <span class="font-bold">✓</span> Sudah mencakup fee payment gateway &amp; PPN
        </div>
      </div>

      <!-- Card 3: Pencairan Bersih -->
      <div
        class="flex flex-col justify-between p-6 sm:p-7 rounded-2xl bg-white border border-slate-200/90 shadow-2xs hover:border-slate-300 hover:shadow-xs transition-all duration-200"
      >
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <span class="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-400">
              03 • Pencairan Dana
            </span>
            <span
              class="px-2.5 py-0.5 rounded-full bg-slate-100 text-[10px] font-bold text-slate-600 font-mono"
            >
              Otomatis
            </span>
          </div>
          <div>
            <div class="flex items-baseline gap-1.5 font-sans">
              <span class="text-3xl sm:text-4xl font-black text-slate-950 tracking-tight">95%</span>
              <span class="text-xs text-slate-500 font-medium">Uang bersih Anda</span>
            </div>
          </div>
          <p class="text-xs sm:text-[13px] text-slate-600 leading-relaxed">
            Dana bersih dicairkan langsung ke rekening bank lokal Anda. Faktur pajak resmi PPN 11%
            terbit otomatis untuk setiap transaksi.
          </p>
        </div>
        <div
          class="pt-4 border-t border-slate-100 text-[11px] text-slate-500 flex items-center gap-1.5 font-medium mt-4"
        >
          <span class="text-emerald-600 font-bold">✓</span> Settlement langsung ke rekening bank
          lokal
        </div>
      </div>
    </div>

    <!-- Live Demo Checkout Callout Card -->
    <div
      class="relative overflow-hidden p-6 sm:p-8 rounded-3xl bg-slate-950 text-white border border-slate-800 shadow-xl flex flex-col lg:flex-row items-center justify-between gap-6"
    >
      <!-- Background Ambient Glow -->
      <div
        class="absolute -top-20 -right-20 w-72 h-72 bg-forest/20 rounded-full blur-3xl pointer-events-none"
      ></div>
      <div
        class="absolute -bottom-20 -left-20 w-72 h-72 bg-gold/10 rounded-full blur-3xl pointer-events-none"
      ></div>

      <div class="relative z-10 space-y-1.5 max-w-2xl text-left">
        <div class="inline-flex items-center gap-2 text-xs font-bold text-gold font-mono">
          <QrCode class="w-4 h-4 text-gold" />
          <span>PRATINJAU ALUR PEMBAYARAN KONSUMEN</span>
        </div>
        <h3 class="text-xl sm:text-2xl font-black tracking-tight text-white">
          Coba Langsung Halaman Checkout Pembayaran
        </h3>
      </div>

      <div class="relative z-10 shrink-0 w-full sm:w-auto">
        <router-link
          to="/demo/checkout"
          class="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl bg-white text-slate-950 text-xs font-bold hover:bg-slate-100 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 active:scale-95 shadow-md cursor-pointer"
        >
          <span>Buka Simulasi Demo Checkout</span>
          <ArrowRight class="w-4 h-4 text-forest" />
        </router-link>
      </div>
    </div>
  </section>
</template>
