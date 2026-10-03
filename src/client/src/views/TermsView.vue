<script setup lang="ts">
import PublicHeader from "../components/common/PublicHeader.vue";
import PublicFooter from "../components/common/PublicFooter.vue";
import { COMPANY_INFO } from "../constants/company";
import { FileText, ShieldCheck, CheckCircle2 } from "lucide-vue-next";
</script>

<template>
  <div
    class="min-h-screen bg-white text-jetblack flex flex-col font-sans selection:bg-gold/20 selection:text-jetblack"
  >
    <PublicHeader />

    <main class="flex-1 py-12 md:py-16">
      <div class="max-w-4xl mx-auto px-4 sm:px-6 space-y-8">
        <!-- Header -->
        <div class="space-y-3 border-b border-jetblack/10 pb-6">
          <div
            class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-forest/10 border border-forest/20 text-forest text-xs font-bold font-mono"
          >
            <FileText class="w-3.5 h-3.5" />
            <span>DOKUMEN KEPATUHAN HUKUM</span>
          </div>
          <h1 class="text-3xl sm:text-4xl font-black text-jetblack tracking-tight">
            Syarat dan Ketentuan Layanan
          </h1>
          <p class="text-xs sm:text-sm text-jetblack/60">
            Terakhir diperbarui: 4 Oktober 2026 • Berlaku efektif untuk seluruh pengguna situs
            <strong>tertaut.com</strong> dan produk <strong>{{ COMPANY_INFO.legalName }}</strong
            >.
          </p>
        </div>

        <!-- Document Body -->
        <div
          class="prose prose-sm max-w-none text-jetblack/80 space-y-6 text-xs sm:text-sm leading-relaxed"
        >
          <div class="p-4 rounded-xl bg-[#FAFAFA] border border-jetblack/10 space-y-1.5 font-sans">
            <div class="font-bold text-jetblack text-xs">
              Penyelenggara Layanan &amp; Penjual Resmi:
            </div>
            <p class="text-xs text-jetblack/70">
              Situs dan seluruh alur transaksi pada <strong>tertaut.com</strong> dimiliki dan
              dioperasikan secara sah oleh <strong>{{ COMPANY_INFO.legalName }}</strong
              >, beralamat di {{ COMPANY_INFO.address.full }}.
            </p>
          </div>

          <section class="space-y-2">
            <h2 class="text-base font-bold text-jetblack">1. Definisi dan Ketentuan Umum</h2>
            <p>
              Dengan mengakses, menelusuri, mendaftar, atau melakukan pembelian lisensi produk pada
              situs ini, Anda menyatakan telah membaca, memahami, dan menyetujui untuk terikat
              dengan Syarat dan Ketentuan ini.
            </p>
            <p>
              "Tertaut" adalah platform Merchant of Record (MoR), perlindungan lisensi perangkat
              lunak, dan fasilitasi pembayaran digital milik {{ COMPANY_INFO.legalName }}.
              "Pengguna" atau "Pembeli" adalah setiap individu atau entitas yang memanfaatkan
              platform atau membeli produk digital kami.
            </p>
          </section>

          <section class="space-y-2">
            <h2 class="text-base font-bold text-jetblack">2. Produk, Jasa, dan Lisensi Software</h2>
            <p>
              Seluruh layanan yang disediakan di situs ini (mencakup layanan Merchant of Record,
              deposit kuota AI Vault, dan lisensi pengembang SDK Tertaut) merupakan layanan dan
              perangkat lunak berlisensi sah dari {{ COMPANY_INFO.legalName }}. Pembelian memberikan
              hak akses atau lisensi penggunaan non-eksklusif kepada pengguna sesuai dengan
              ketentuan paket yang dipilih.
            </p>
            <p>
              Pembeli dilarang merekayasa balik (reverse-engineering), membongkar, menjual kembali
              kunci lisensi tanpa izin tertulis dari {{ COMPANY_INFO.legalName }}.
            </p>
          </section>

          <section class="space-y-2">
            <h2 class="text-base font-bold text-jetblack">
              3. Alur Transaksi, Harga, dan Pembayaran
            </h2>
            <p>
              Seluruh harga yang dicantumkan menggunakan mata uang Rupiah Indonesia (IDR) dan telah
              mencakup Pajak Pertambahan Nilai (PPN 11%) sesuai regulasi perpajakan Republik
              Indonesia yang berlaku.
            </p>
            <p>
              Pembayaran diproses secara instan melalui kanal resmi payment gateway berizin Bank
              Indonesia, mencakup QRIS (Quick Response Code Indonesian Standard) dan Virtual Account
              bank terkemuka di Indonesia. Transaksi diverifikasi secara otomatis dalam hitungan
              detik.
            </p>
          </section>

          <section class="space-y-2">
            <h2 class="text-base font-bold text-jetblack">
              4. Pengiriman Lisensi dan Bukti Pembelian
            </h2>
            <p>
              Setelah pembayaran berhasil diverifikasi oleh sistem, kunci lisensi digital dan
              petunjuk aktivasi akan ditampilkan langsung pada halaman konfirmasi (invoice) dan
              salinan resminya dikirimkan ke alamat email yang Anda cantumkan saat checkout.
            </p>
          </section>

          <section class="space-y-2">
            <h2 class="text-base font-bold text-jetblack">
              5. Kebijakan Pengembalian Dana (Refund)
            </h2>
            <p>
              Kami menyediakan jaminan pengembalian dana 100% apabila produk digital yang dibeli
              terbukti mengalami cacat fungsional fatal atau lisensi tidak dapat diaktifkan setelah
              mendapat bantuan dari tim teknis kami dalam waktu 7 (tujuh) hari kalender sejak
              tanggal transaksi. Rincian selengkapnya dapat dibaca pada halaman Kebijakan
              Pengembalian Dana.
            </p>
          </section>

          <section class="space-y-2">
            <h2 class="text-base font-bold text-jetblack">6. Kontak &amp; Penyelesaian Masalah</h2>
            <p>
              Apabila Anda memiliki pertanyaan, kendala pembayaran, atau membutuhkan faktur resmi,
              Anda dapat menghubungi kami melalui:
            </p>
            <ul class="list-disc list-inside space-y-1 pl-2">
              <li><strong>Entitas:</strong> {{ COMPANY_INFO.legalName }}</li>
              <li><strong>Alamat:</strong> {{ COMPANY_INFO.address.full }}</li>
              <li><strong>Telepon/WhatsApp:</strong> {{ COMPANY_INFO.contact.phone }}</li>
              <li><strong>Email:</strong> {{ COMPANY_INFO.contact.email }}</li>
            </ul>
          </section>
        </div>
      </div>
    </main>

    <PublicFooter />
  </div>
</template>
