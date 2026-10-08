<script setup lang="ts">
import { Sparkles, QrCode, ArrowRight } from "lucide-vue-next";
import { COMPANY_INFO } from "../../constants/company";
</script>

<template>
  <section id="biaya" class="py-16 md:py-24 max-w-7xl mx-auto px-4 sm:px-6 space-y-12">
    <div class="text-center space-y-3 max-w-2xl mx-auto">
      <div
        class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-forest/10 text-forest text-xs font-bold font-mono"
      >
        <Sparkles class="w-3.5 h-3.5" />
        <span>BIAYA LAYANAN TRANSPARAN</span>
      </div>
      <h2 class="text-2xl sm:text-4xl font-black text-jetblack tracking-tight">
        100% Gratis Digunakan.<br />
        <span class="text-forest">Hanya 5% Flat Fee Saat Terjadi Penjualan.</span>
      </h2>
      <p class="text-xs sm:text-sm text-jetblack/65">
        Platform Tertaut dioperasikan resmi oleh <strong>{{ COMPANY_INFO.legalName }}</strong
        >. Tanpa biaya pendaftaran, tanpa biaya bulanan, dan tanpa kontrak terikat.
      </p>
    </div>

    <!-- 3 Columns Highlights -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div class="p-6 rounded-2xl bg-[#FAFAFA] border border-jetblack/10 space-y-3">
        <div class="text-xs font-mono font-bold uppercase text-forest">
          01 • Pendaftaran &amp; Akun
        </div>
        <div class="text-3xl font-black text-jetblack font-mono">Rp 0</div>
        <p class="text-xs text-jetblack/70 leading-relaxed">
          Daftar dan gunakan seluruh fitur payment gateway, dynamic checkout modal, lisensi Ed25519,
          dan API secara gratis selamanya.
        </p>
      </div>

      <div class="p-6 rounded-2xl bg-[#F5FAF7] border border-forest/30 space-y-3">
        <div class="text-xs font-mono font-bold uppercase text-forest">02 • Platform MoR Fee</div>
        <div class="text-3xl font-black text-forest font-mono">5% Flat Fee</div>
        <p class="text-xs text-forest/90 leading-relaxed">
          Hanya dipotong saat pembeli software Anda berhasil membayar via QRIS atau Virtual Account.
          Tanpa biaya jika tidak ada penjualan.
        </p>
      </div>

      <div class="p-6 rounded-2xl bg-[#FAFAFA] border border-jetblack/10 space-y-3">
        <div class="text-xs font-mono font-bold uppercase text-forest">03 • Pencairan Bersih</div>
        <div class="text-3xl font-black text-jetblack font-mono">95% Uang Bersih</div>
        <p class="text-xs text-jetblack/70 leading-relaxed">
          95% dana bersih dicairkan langsung ke rekening bank lokal Anda. Faktur pajak resmi PPN 11%
          terbit otomatis.
        </p>
      </div>
    </div>

    <!-- Live Demo Checkout Callout Card -->
    <div
      class="p-6 sm:p-8 rounded-2xl bg-jetblack text-white shadow-xl flex flex-col md:flex-row items-center justify-between gap-6"
    >
      <div class="space-y-2 max-w-xl">
        <div class="flex items-center gap-2 text-xs font-bold text-gold font-mono">
          <QrCode class="w-4 h-4" />
          <span>PRATINJAU ALUR PEMBAYARAN KONSUMEN</span>
        </div>
        <h3 class="text-xl sm:text-2xl font-black tracking-tight">
          Coba Langsung Halaman Checkout Pembayaran
        </h3>
        <p class="text-xs text-white/70 leading-relaxed">
          Lihat bagaimana alur checkout resmi Tertaut memproses pembayaran QRIS &amp; Virtual
          Account dengan verifikasi otomatis detik itu juga.
        </p>
      </div>

      <div class="shrink-0 w-full md:w-auto">
        <router-link
          to="/demo/checkout"
          class="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-white text-jetblack text-xs font-bold hover:bg-[#F2F2F2] transition active:scale-95 shadow-md"
        >
          <span>Buka Simulasi Demo Checkout</span>
          <ArrowRight class="w-3.5 h-3.5 text-forest" />
        </router-link>
      </div>
    </div>
  </section>
</template>
