<script setup lang="ts">
import PublicHeader from "../components/common/PublicHeader.vue";
import PublicFooter from "../components/common/PublicFooter.vue";
import LandingCalculator from "../components/landing/LandingCalculator.vue";
import { COMPANY_INFO, PLATFORM_PRICING } from "../constants/company";
import { useSeo } from "../composables/useSeo";
import { STATIC_PAGES_META, createJsonLd } from "../constants/seo";

useSeo(STATIC_PAGES_META.pricing, [
  createJsonLd("breadcrumb", {
    items: [
      { name: "Beranda", url: "/" },
      { name: "Biaya & Skema", url: "/pricing" },
    ],
  }),
  createJsonLd("faq"),
]);
import {
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  Zap,
  Lock,
  Sparkles,
  QrCode,
  Building2,
  FileText,
  ExternalLink,
  Laptop,
} from "lucide-vue-next";
</script>

<template>
  <div
    class="min-h-screen bg-white text-jetblack flex flex-col font-sans selection:bg-gold/20 selection:text-jetblack"
  >
    <PublicHeader />

    <main class="flex-1">
      <!-- Top Hero Section -->
      <section
        class="border-b border-jetblack/10 bg-gradient-to-b from-[#FCFCFC] via-white to-[#F8F8F8] py-14 md:py-20"
      >
        <div class="max-w-5xl mx-auto px-4 sm:px-6 text-center space-y-4">
          <div
            class="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-forest/10 border border-forest/20 text-forest text-xs font-bold font-mono"
          >
            <Sparkles class="w-3.5 h-3.5" />
            <span>HARGA &amp; BIAYA LAYANAN TRANSPARAN</span>
          </div>

          <h1 class="text-3xl sm:text-5xl font-black text-jetblack tracking-tight leading-tight">
            100% Gratis Digunakan.<br />
            <span
              class="bg-gradient-to-r from-jetblack via-forest to-gold bg-clip-text text-transparent"
            >
              Hanya Bayar 5% Saat Anda Berhasil Menjual.
            </span>
          </h1>

          <p class="max-w-2xl mx-auto text-sm sm:text-base text-jetblack/70 leading-relaxed">
            <strong>Tertaut</strong> (dioperasikan resmi oleh
            <strong>{{ COMPANY_INFO.legalName }}</strong
            >) adalah platform Merchant of Record (MoR) untuk developer dan software builder
            Indonesia. Tidak ada biaya langganan, tanpa biaya setup.
          </p>

          <div
            class="pt-2 flex flex-wrap items-center justify-center gap-4 text-xs text-jetblack/60 font-mono"
          >
            <span class="flex items-center gap-1.5"
              ><CheckCircle2 class="w-4 h-4 text-forest" /> Rp 0 Biaya Pendaftaran / Akun</span
            >
            <span>•</span>
            <span class="flex items-center gap-1.5"
              ><CheckCircle2 class="w-4 h-4 text-forest" /> 5% Flat Fee per Transaksi Sukses</span
            >
            <span>•</span>
            <span class="flex items-center gap-1.5"
              ><CheckCircle2 class="w-4 h-4 text-forest" /> 95% Bersih ke Rekening Anda</span
            >
          </div>
        </div>
      </section>

      <!-- Main Pricing Card & Breakdown -->
      <section class="py-14 md:py-20 max-w-5xl mx-auto px-4 sm:px-6 space-y-12">
        <div
          class="rounded-3xl border-2 border-jetblack bg-white shadow-2xl p-6 sm:p-10 space-y-8 relative overflow-hidden"
        >
          <!-- Top Badge -->
          <div
            class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-jetblack/10 pb-6"
          >
            <div class="space-y-1">
              <span
                class="inline-block px-3 py-1 rounded-full bg-forest text-white text-[11px] font-extrabold uppercase tracking-wider font-mono"
              >
                {{ PLATFORM_PRICING.badge }}
              </span>
              <h2 class="text-2xl sm:text-3xl font-black text-jetblack">
                {{ PLATFORM_PRICING.name }}
              </h2>
              <p class="text-xs sm:text-sm text-jetblack/65">
                {{ PLATFORM_PRICING.description }}
              </p>
            </div>

            <div class="text-left sm:text-right shrink-0">
              <div class="text-3xl sm:text-4xl font-black text-jetblack font-mono">
                {{ PLATFORM_PRICING.priceLabel }}
              </div>
              <div class="text-xs font-bold text-forest font-mono">
                {{ PLATFORM_PRICING.periodLabel }}
              </div>
            </div>
          </div>

          <!-- Fee Callout Box -->
          <div
            class="p-4 sm:p-5 rounded-2xl bg-[#F5FAF7] border border-forest/25 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          >
            <div class="space-y-1">
              <div class="text-xs font-bold text-forest uppercase tracking-wider font-mono">
                Biaya Pemrosesan Transaksi (MoR Fee)
              </div>
              <div class="text-sm font-bold text-jetblack">
                Flat 5% hanya jika Anda berhasil menerima pembayaran dari pelanggan.
              </div>
              <div class="text-xs text-jetblack/60">
                Jika belum ada penjualan di bulan tersebut, biaya yang Anda bayarkan adalah
                <strong>Rp 0 (Murni Gratis)</strong>.
              </div>
            </div>
            <div class="shrink-0 text-center sm:text-right">
              <div class="text-2xl font-black text-forest font-mono">5%</div>
              <div class="text-[10px] text-forest/80 font-mono">Flat Fee per Transaksi</div>
            </div>
          </div>

          <!-- Features Grid -->
          <div class="space-y-4">
            <div class="text-xs font-bold text-jetblack uppercase tracking-wider font-mono">
              Seluruh Fitur Platform Termasuk Tanpa Batas:
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-jetblack/80">
              <div
                v-for="(f, idx) in PLATFORM_PRICING.features"
                :key="idx"
                class="flex items-start gap-2.5 p-2 rounded-xl hover:bg-jetblack/5 transition"
              >
                <CheckCircle2 class="w-4 h-4 text-forest shrink-0 mt-0.5" />
                <span class="leading-relaxed">{{ f }}</span>
              </div>
            </div>
          </div>

          <!-- Action Buttons -->
          <div
            class="pt-4 border-t border-jetblack/10 flex flex-col sm:flex-row items-center gap-4"
          >
            <router-link
              to="/login"
              class="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-jetblack text-white text-sm font-bold shadow-lg hover:bg-jetblack-hover transition active:scale-95"
            >
              <span>Mulai Pakai Gratis</span>
              <ArrowRight class="w-4 h-4 text-gold" />
            </router-link>

            <router-link
              to="/demo/checkout"
              class="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-4 rounded-xl border border-forest/30 bg-forest/5 text-forest text-sm font-bold hover:bg-forest/10 transition"
            >
              <QrCode class="w-4 h-4" />
              <span>Coba Demo Checkout Pembayaran</span>
            </router-link>
          </div>
        </div>
      </section>

      <!-- Live Checkout Preview / Verification Section (Xendit Checkout) -->
      <section class="py-14 md:py-20 bg-[#FAFAFA] border-y border-jetblack/10">
        <div class="max-w-5xl mx-auto px-4 sm:px-6 space-y-10">
          <div class="text-center space-y-3">
            <div
              class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-forest/10 text-forest text-xs font-bold font-mono"
            >
              <QrCode class="w-3.5 h-3.5" />
              <span>SIMULASI ALUR PEMBAYARAN KONSUMEN</span>
            </div>
            <h2 class="text-2xl sm:text-3xl font-extrabold text-jetblack tracking-tight">
              Pratinjau Halaman Checkout Interaktif
            </h2>
            <p class="text-xs sm:text-sm text-jetblack/65 max-w-xl mx-auto">
              Inilah halaman pembayaran yang akan dilihat oleh calon pembeli produk software Anda.
              Mendukung QRIS instan dan Virtual Account dengan penerbitan lisensi otomatis.
            </p>
          </div>

          <!-- Checkout Demo Card -->
          <div
            class="p-6 sm:p-8 rounded-2xl bg-white border border-jetblack/12 shadow-luxury flex flex-col md:flex-row items-center justify-between gap-6"
          >
            <div class="space-y-3 max-w-xl">
              <div class="flex items-center gap-2 text-xs font-bold text-forest">
                <ShieldCheck class="w-4 h-4" />
                <span>Alur Pembayaran Teruji &amp; Terintegrasi</span>
              </div>
              <h3 class="text-xl font-black text-jetblack">
                Halaman Pembayaran Hosted &amp; Custom Checkout
              </h3>
              <p class="text-xs text-jetblack/70 leading-relaxed">
                Peninjau payment gateway maupun calon pembeli dapat melihat alur pemilihan metode
                pembayaran (QRIS, VA Bank), konfirmasi email penerima lisensi, serta kalkulasi PPN
                11% secara transparan.
              </p>
              <div class="flex flex-wrap gap-2 text-[11px] font-mono text-jetblack/60 pt-1">
                <span class="bg-jetblack/5 px-2 py-0.5 rounded">QRIS Dinamis</span>
                <span class="bg-jetblack/5 px-2 py-0.5 rounded">BCA / Mandiri / BNI VA</span>
                <span class="bg-jetblack/5 px-2 py-0.5 rounded">Validasi Ed25519</span>
              </div>
            </div>

            <div class="shrink-0 w-full md:w-auto text-center space-y-2">
              <router-link
                to="/demo/checkout"
                class="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-jetblack text-white text-xs font-bold shadow-md hover:bg-jetblack-hover transition active:scale-95"
              >
                <span>Buka Demo Checkout Live</span>
                <ArrowRight class="w-3.5 h-3.5 text-gold" />
              </router-link>
              <div class="text-[10px] text-jetblack/50 font-mono">
                Bisa diuji coba tanpa kartu kredit
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Calculator Section -->
      <LandingCalculator />
    </main>

    <PublicFooter />
  </div>
</template>
