<script setup lang="ts">
import { CheckCircle2, XCircle, X, Check } from "lucide-vue-next";
</script>

<template>
  <section
    id="cara-kerja"
    class="py-10 sm:py-16 md:py-24 max-w-7xl mx-auto px-3.5 sm:px-6 space-y-8 sm:space-y-12 w-full min-w-0"
  >
    <div class="text-center space-y-2.5 sm:space-y-3 max-w-2xl mx-auto px-1 sm:px-0">
      <h2 class="text-xs font-bold uppercase tracking-widest text-forest font-mono">
        Kenapa Butuh Managed Payment &amp; Licensing?
      </h2>
      <h3
        class="text-xl sm:text-2xl md:text-3xl font-extrabold text-jetblack tracking-tight leading-snug"
      >
        Menjual Software di Indonesia Seharusnya Tidak Sesulit Ini
      </h3>
      <p class="text-xs sm:text-sm text-jetblack/65">
        Lihat perbedaan antara cara tradisional yang melelahkan dengan alur modern bersama Tertaut.
      </p>
    </div>

    <!-- Comparison Cards (Mobile Swipeable Horizontal Scroll / Desktop 2-Col Grid) -->
    <div
      class="flex md:grid md:grid-cols-2 gap-4 sm:gap-6 overflow-x-auto md:overflow-visible pb-4 md:pb-0 snap-x snap-mandatory md:snap-none scroll-smooth no-scrollbar w-full min-w-0"
    >
      <!-- Cara Tradisional (Pain) -->
      <div
        class="w-[85vw] max-w-[360px] md:max-w-none md:w-auto shrink-0 md:shrink snap-center md:snap-align-none rounded-2xl p-5 sm:p-7 md:p-8 bg-white border border-red-200/90 shadow-xs space-y-4 sm:space-y-5 flex flex-col justify-between"
      >
        <div class="space-y-4">
          <div class="flex items-center gap-3">
            <div
              class="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center text-red-600 font-bold shrink-0 shadow-2xs"
            >
              <X class="w-5 h-5 text-red-600" />
            </div>
            <div>
              <h4 class="text-sm sm:text-base font-bold text-slate-950">
                Cara Konvensional &amp; Manual
              </h4>
              <p class="text-[11px] sm:text-xs text-red-600/80 font-medium">
                Penuh kerumitan hukum, operasional, dan teknis
              </p>
            </div>
          </div>

          <ul
            class="space-y-3 sm:space-y-3.5 text-xs sm:text-[13px] text-slate-600 leading-relaxed"
          >
            <li class="flex items-start gap-2.5">
              <XCircle class="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <span
                ><strong class="text-slate-900 font-semibold">Wajib Bikin PT/CV:</strong> Payment
                gateway tradisional mengharuskan legalitas badan usaha, SIUP, dan berbulan-bulan
                verifikasi KYC.</span
              >
            </li>
            <li class="flex items-start gap-2.5">
              <XCircle class="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <span
                ><strong class="text-slate-900 font-semibold">Pusing Pajak &amp; PPN 11%:</strong>
                Harus menerbitkan faktur pajak manual, melapor SPT masa, dan menyewa konsultan
                pajak.</span
              >
            </li>
            <li class="flex items-start gap-2.5">
              <XCircle class="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <span
                ><strong class="text-slate-900 font-semibold">Bikin DRM Lisensi Sendiri:</strong>
                Harus meng-coding backend lisensi, validasi device hardware, dan mekanisme seat
                binding dari nol.</span
              >
            </li>
            <li class="flex items-start gap-2.5">
              <XCircle class="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <span
                ><strong class="text-slate-900 font-semibold"
                  >Bikin Frontend Checkout Sendiri:</strong
                >
                Harus merancang UI kasir, integrasi gateway per metode bayar, dan meng-coding mesin
                kupon diskon secara manual.</span
              >
            </li>
          </ul>
        </div>

        <div
          class="pt-3 border-t border-red-100 text-[11px] text-red-600/80 font-medium flex items-center gap-1.5"
        >
          <span>✕ Menghabiskan berminggu-minggu waktu coding &amp; birokrasi</span>
        </div>
      </div>

      <!-- Cara Tertaut (Gain) -->
      <div
        class="w-[85vw] max-w-[360px] md:max-w-none md:w-auto shrink-0 md:shrink snap-center md:snap-align-none rounded-2xl p-5 sm:p-7 md:p-8 bg-gradient-to-b from-forest/[0.04] to-white border-2 border-forest/30 shadow-xs space-y-4 sm:space-y-5 flex flex-col justify-between"
      >
        <div class="space-y-4">
          <div class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-3">
              <div
                class="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-forest/10 border border-forest/20 flex items-center justify-center text-forest font-bold shrink-0 shadow-2xs"
              >
                <Check class="w-5 h-5 text-forest" />
              </div>
              <div>
                <h4 class="text-sm sm:text-base font-bold text-slate-950">Bersama Tertaut</h4>
                <p class="text-[11px] sm:text-xs text-forest font-medium">
                  Fokus hanya pada coding produk
                </p>
              </div>
            </div>
            <span
              class="px-2 py-0.5 rounded-full bg-forest/10 text-forest font-mono text-[10px] font-bold shrink-0"
            >
              Managed MoR
            </span>
          </div>

          <ul
            class="space-y-3 sm:space-y-3.5 text-xs sm:text-[13px] text-slate-700 leading-relaxed"
          >
            <li class="flex items-start gap-2.5">
              <CheckCircle2 class="w-4 h-4 text-forest shrink-0 mt-0.5" />
              <span
                ><strong class="text-slate-950 font-semibold">Langsung Terima Pembayaran:</strong>
                Cukup akun individu. Sistem Managed Payment mengurus pemrosesan transaksi dan
                penerbitan faktur secara otomatis.</span
              >
            </li>
            <li class="flex items-start gap-2.5">
              <CheckCircle2 class="w-4 h-4 text-forest shrink-0 mt-0.5" />
              <span
                ><strong class="text-slate-950 font-semibold">Invoice &amp; Pajak Otomatis:</strong>
                E-receipt resmi dengan kalkulasi DPP &amp; PPN 11% terbit otomatis detik pembayaran
                berhasil.</span
              >
            </li>
            <li class="flex items-start gap-2.5">
              <CheckCircle2 class="w-4 h-4 text-forest shrink-0 mt-0.5" />
              <span
                ><strong class="text-slate-950 font-semibold"
                  >Universal Licensing Siap Pakai:</strong
                >
                Pasang `@tertaut/sdk`. Lisensi offline-first Ed25519 dan seat control langsung aktif
                dalam 5 menit.</span
              >
            </li>
            <li class="flex items-start gap-2.5">
              <CheckCircle2 class="w-4 h-4 text-forest shrink-0 mt-0.5" />
              <span
                ><strong class="text-slate-950 font-semibold">Hosted Checkout &amp; Kupon:</strong>
                Halaman pembayaran instan, kupon diskon, dan faktur pajak PPN 11% otomatis tanpa
                perlu bikin frontend billing sendiri.</span
              >
            </li>
          </ul>
        </div>

        <div
          class="pt-3 border-t border-forest/15 text-[11px] text-forest font-medium flex items-center gap-1.5"
        >
          <span>✓ Mulai monetisasi software hari ini juga</span>
        </div>
      </div>
    </div>

    <!-- Mobile Swipe Hint -->
    <div
      class="flex md:hidden items-center justify-center gap-1.5 text-slate-400 font-mono text-[10px]"
    >
      <span>← Geser kartu untuk melihat perbandingan →</span>
    </div>
  </section>
</template>
