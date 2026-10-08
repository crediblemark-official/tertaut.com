<script setup lang="ts">
import { CheckCircle2 } from "lucide-vue-next";
</script>

<template>
  <section id="cara-kerja" class="py-16 md:py-24 max-w-7xl mx-auto px-4 sm:px-6 space-y-12">
    <div class="text-center space-y-3 max-w-2xl mx-auto">
      <h2 class="text-xs font-bold uppercase tracking-widest text-forest font-mono">
        Kenapa Butuh Merchant of Record?
      </h2>
      <h3 class="text-2xl sm:text-3xl font-extrabold text-jetblack tracking-tight">
        Menjual Software di Indonesia Seharusnya Tidak Sesulit Ini
      </h3>
      <p class="text-xs sm:text-sm text-jetblack/65">
        Lihat perbedaan antara cara tradisional yang melelahkan dengan alur modern bersama Tertaut.
      </p>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <!-- Cara Tradisional (Pain) -->
      <div class="rounded-2xl p-6 sm:p-8 bg-[#FFFBFB] border border-red-200/80 space-y-5">
        <div class="flex items-center gap-3">
          <div
            class="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center text-red-600 font-bold"
          >
            ✕
          </div>
          <div>
            <h4 class="text-base font-bold text-red-950">Cara Konvensional &amp; Manual</h4>
            <p class="text-xs text-red-800/70">Penuh kerumitan hukum, operasional, dan teknis</p>
          </div>
        </div>

        <ul class="space-y-3 text-xs text-red-900/80">
          <li class="flex items-start gap-2.5">
            <span class="text-red-500 font-bold">•</span>
            <span
              ><strong>Wajib Bikin PT/CV:</strong> Payment gateway tradisional mengharuskan
              legalitas badan usaha, SIUP, dan berbulan-bulan verifikasi KYC.</span
            >
          </li>
          <li class="flex items-start gap-2.5">
            <span class="text-red-500 font-bold">•</span>
            <span
              ><strong>Pusing Pajak &amp; PPN 11%:</strong> Harus menerbitkan faktur pajak manual,
              melapor SPT masa, dan menyewa konsultan pajak.</span
            >
          </li>
          <li class="flex items-start gap-2.5">
            <span class="text-red-500 font-bold">•</span>
            <span
              ><strong>Bikin DRM Lisensi Sendiri:</strong> Harus meng-coding backend lisensi,
              validasi device hardware, dan mekanisme seat binding dari nol.</span
            >
          </li>
          <li class="flex items-start gap-2.5">
            <span class="text-red-500 font-bold">•</span>
            <span
              ><strong>Resiko Kunci AI Bocor:</strong> Menaruh API Key OpenAI di app desktop/klien
              membuat saldo OpenAI Anda rentan dicuri pengguna.</span
            >
          </li>
        </ul>
      </div>

      <!-- Cara Tertaut (Gain) -->
      <div class="rounded-2xl p-6 sm:p-8 bg-[#F5FAF7] border border-forest/25 space-y-5">
        <div class="flex items-center gap-3">
          <div
            class="w-10 h-10 rounded-xl bg-forest/15 flex items-center justify-center text-forest font-bold"
          >
            ✓
          </div>
          <div>
            <h4 class="text-base font-bold text-forest">Bersama Tertaut (Merchant of Record)</h4>
            <p class="text-xs text-forest/70">Mulai berjualan hari ini, fokus hanya pada coding</p>
          </div>
        </div>

        <ul class="space-y-3 text-xs text-forest/90">
          <li class="flex items-start gap-2.5">
            <CheckCircle2 class="w-4 h-4 text-forest shrink-0 mt-0.5" />
            <span
              ><strong>Langsung Terima Pembayaran:</strong> Cukup akun individu. Kami bertindak
              sebagai penjual resmi (MoR) Anda di hadapan pembeli dan bank.</span
            >
          </li>
          <li class="flex items-start gap-2.5">
            <CheckCircle2 class="w-4 h-4 text-forest shrink-0 mt-0.5" />
            <span
              ><strong>Invoice &amp; Pajak Otomatis:</strong> E-receipt resmi dengan kalkulasi DPP
              &amp; PPN 11% terbit otomatis detik pembayaran berhasil.</span
            >
          </li>
          <li class="flex items-start gap-2.5">
            <CheckCircle2 class="w-4 h-4 text-forest shrink-0 mt-0.5" />
            <span
              ><strong>Universal Licensing Siap Pakai:</strong> Pasang `@tertaut/sdk`. Lisensi
              offline-first Ed25519 dan seat control langsung aktif dalam 5 menit.</span
            >
          </li>
          <li class="flex items-start gap-2.5">
            <CheckCircle2 class="w-4 h-4 text-forest shrink-0 mt-0.5" />
            <span
              ><strong>AI Proxy Terenkripsi:</strong> Master key tersimpan di server vault. Batasi
              token harian dan jual paket kredit tanpa kebocoran.</span
            >
          </li>
        </ul>
      </div>
    </div>
  </section>
</template>
