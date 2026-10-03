<script setup lang="ts">
import PublicHeader from "../components/common/PublicHeader.vue";
import PublicFooter from "../components/common/PublicFooter.vue";
import { COMPANY_INFO } from "../constants/company";
import { Shield, Lock, CheckCircle2 } from "lucide-vue-next";
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
            <Shield class="w-3.5 h-3.5" />
            <span>PERLINDUNGAN DATA PRIBADI</span>
          </div>
          <h1 class="text-3xl sm:text-4xl font-black text-jetblack tracking-tight">
            Kebijakan Privasi
          </h1>
          <p class="text-xs sm:text-sm text-jetblack/60">
            Terakhir diperbarui: 4 Oktober 2026 • Kepatuhan terhadap UU No. 27 Tahun 2022 tentang
            Perlindungan Data Pribadi (UU PDP).
          </p>
        </div>

        <!-- Document Body -->
        <div
          class="prose prose-sm max-w-none text-jetblack/80 space-y-6 text-xs sm:text-sm leading-relaxed"
        >
          <div class="p-4 rounded-xl bg-[#FAFAFA] border border-jetblack/10 space-y-1.5 font-sans">
            <div class="font-bold text-jetblack text-xs">Pengendali Data Pribadi:</div>
            <p class="text-xs text-jetblack/70">
              Pengendali data pribadi atas situs ini adalah
              <strong>{{ COMPANY_INFO.legalName }}</strong
              >, berkedudukan di {{ COMPANY_INFO.address.full }}. Kami berkomitmen penuh menjaga
              kerahasiaan dan keamanan data seluruh pengunjung serta pembeli.
            </p>
          </div>

          <section class="space-y-2">
            <h2 class="text-base font-bold text-jetblack">1. Data yang Kami Kumpulkan</h2>
            <p>
              Saat Anda menggunakan layanan atau membeli lisensi perangkat lunak di situs kami, kami
              dapat mengumpulkan informasi berikut:
            </p>
            <ul class="list-disc list-inside space-y-1 pl-2">
              <li>
                <strong>Informasi Transaksi:</strong> Nama, alamat email aktif (untuk pengiriman
                kunci lisensi), nomor kontak/WhatsApp, dan riwayat pesanan.
              </li>
              <li>
                <strong>Data Pembayaran:</strong> Kanal pembayaran yang dipilih, status transaksi,
                dan ID transaksi. Perlu diperhatikan bahwa kami
                <em>tidak pernah menyimpan nomor kartu kredit atau PIN perbankan Anda</em>, karena
                transaksi diproses secara langsung oleh payment gateway resmi.
              </li>
              <li>
                <strong>Data Teknis Aktivasi Lisensi:</strong> Hardware ID hash perangkat (digunakan
                untuk memvalidasi batas seat lisensi software secara kriptografis).
              </li>
            </ul>
          </section>

          <section class="space-y-2">
            <h2 class="text-base font-bold text-jetblack">2. Tujuan Penggunaan Data</h2>
            <p>Data pribadi yang dikumpulkan dipergunakan semata-mata untuk:</p>
            <ul class="list-disc list-inside space-y-1 pl-2">
              <li>Memproses transaksi pembayaran dan menerbitkan lisensi serta invoice resmi.</li>
              <li>Mengirimkan kunci lisensi dan tautan pembaruan software ke email pembeli.</li>
              <li>Memberikan layanan purna jual, dukungan teknis, dan verifikasi garansi.</li>
              <li>Mencegah tindakan penipuan (fraud prevention) dan pembajakan lisensi digital.</li>
            </ul>
          </section>

          <section class="space-y-2">
            <h2 class="text-base font-bold text-jetblack">3. Keamanan Data &amp; Enkripsi</h2>
            <p>
              Seluruh transmisi data pada situs tertaut.com dilindungi protokol enkripsi modern
              Transport Layer Security (TLS 1.3 / SSL 256-bit). Data API key dan kredensial sensitif
              disimpan menggunakan enkripsi AES-256 tingkat perbankan di vault server yang
              terisolasi.
            </p>
          </section>

          <section class="space-y-2">
            <h2 class="text-base font-bold text-jetblack">4. Hak Pengguna</h2>
            <p>
              Sesuai dengan ketentuan undang-undang perlindungan data pribadi, Anda berhak meminta
              akses, perbaikan, atau penghapusan data pribadi Anda dari sistem kami dengan
              menghubungi kontak resmi kami di bawah ini.
            </p>
          </section>

          <section class="space-y-2">
            <h2 class="text-base font-bold text-jetblack">5. Informasi Kontak Pengendali Data</h2>
            <p>Untuk pertanyaan atau permintaan terkait data pribadi, hubungi kami di:</p>
            <ul class="list-disc list-inside space-y-1 pl-2">
              <li><strong>Nama Perusahaan:</strong> {{ COMPANY_INFO.legalName }}</li>
              <li><strong>Alamat Kantor:</strong> {{ COMPANY_INFO.address.full }}</li>
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
