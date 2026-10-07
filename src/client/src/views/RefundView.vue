<script setup lang="ts">
import PublicHeader from "../components/common/PublicHeader.vue";
import PublicFooter from "../components/common/PublicFooter.vue";
import { COMPANY_INFO } from "../constants/company";
import { RefreshCcw, ShieldCheck, CheckCircle2, AlertTriangle, ArrowRight } from "lucide-vue-next";
import { useSeo } from "../composables/useSeo";
import { STATIC_PAGES_META } from "../constants/seo";

useSeo(STATIC_PAGES_META.refund);
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
            <RefreshCcw class="w-3.5 h-3.5" />
            <span>GARANSI KEPUASAN KONSUMEN</span>
          </div>
          <h1 class="text-3xl sm:text-4xl font-black text-jetblack tracking-tight">
            Kebijakan Pengembalian Dana (Refund Policy)
          </h1>
          <p class="text-xs sm:text-sm text-jetblack/60">
            Terakhir diperbarui: 4 Oktober 2026 • Komitmen transparansi dan perlindungan konsumen
            <strong>{{ COMPANY_INFO.legalName }}</strong
            >.
          </p>
        </div>

        <!-- Document Body -->
        <div
          class="prose prose-sm max-w-none text-jetblack/80 space-y-6 text-xs sm:text-sm leading-relaxed"
        >
          <div
            class="p-4 rounded-xl bg-forest/5 border border-forest/20 text-forest space-y-1 font-sans"
          >
            <div class="font-bold flex items-center gap-1.5 text-xs text-forest">
              <ShieldCheck class="w-4 h-4 shrink-0" />
              <span>Garansi 7 Hari Pengembalian Dana Penuh (100%)</span>
            </div>
            <p class="text-xs text-forest/90">
              Kami menjamin kepuasan pelanggan atas setiap produk digital yang dibeli di
              <strong>tertaut.com</strong>. Jika produk tidak dapat dioperasikan karena kendala
              teknis yang tidak dapat diselesaikan oleh tim dukungan kami, Anda berhak menerima
              pengembalian dana 100%.
            </p>
          </div>

          <section class="space-y-2">
            <h2 class="text-base font-bold text-jetblack">
              1. Syarat dan Ketentuan Pengajuan Pengembalian Dana
            </h2>
            <p>Pengembalian dana dapat disetujui apabila memenuhi kriteria berikut:</p>
            <ul class="list-disc list-inside space-y-1 pl-2">
              <li>
                Permohonan diajukan dalam jangka waktu maksimal
                <strong>7 (tujuh) hari kalender</strong> sejak transaksi pembayaran berhasil
                dilakukan.
              </li>
              <li>
                Terdapat kegagalan teknis fatal pada lisensi software yang membuat aplikasi tidak
                dapat digunakan dan tidak terselesaikan oleh tim bantuan teknis kami.
              </li>
              <li>
                Terjadi duplikasi pembayaran atas nomor pesanan atau invoice yang sama akibat
                kendala jaringan perbankan.
              </li>
            </ul>
          </section>

          <section class="space-y-2">
            <h2 class="text-base font-bold text-jetblack">
              2. Pengecualian (Kondisi yang Tidak Dapat Direfund)
            </h2>
            <p>Pengembalian dana tidak dapat diproses dalam kondisi:</p>
            <ul class="list-disc list-inside space-y-1 pl-2">
              <li>Permohonan diajukan setelah melewati batas 7 hari sejak transaksi.</li>
              <li>
                Perangkat pengguna tidak memenuhi spesifikasi minimum sistem yang telah dicantumkan
                pada deskripsi produk.
              </li>
              <li>
                Pelanggaran terhadap syarat lisensi, seperti penyebaran kunci lisensi ke pihak
                ketiga tanpa izin atau modifikasi ilegal.
              </li>
            </ul>
          </section>

          <section class="space-y-2">
            <h2 class="text-base font-bold text-jetblack">3. Prosedur Pengajuan Refund</h2>
            <p>Untuk mengajukan pengembalian dana, ikuti langkah mudah berikut:</p>
            <ol class="list-decimal list-inside space-y-1.5 pl-2">
              <li>
                Kirimkan email ke <strong>{{ COMPANY_INFO.contact.email }}</strong> atau hubungi
                WhatsApp <strong>{{ COMPANY_INFO.contact.phone }}</strong> dengan subjek:
                <code>Pengajuan Refund - [ID Transaksi/Invoice]</code>.
              </li>
              <li>
                Lampirkan bukti pembayaran resmi, alamat email yang digunakan saat checkout, dan
                penjelasan singkat mengenai kendala yang dialami.
              </li>
              <li>
                Tim verifikasi <strong>{{ COMPANY_INFO.legalName }}</strong> akan meninjau pengajuan
                dalam 1x24 jam kerja.
              </li>
              <li>
                Setelah disetujui, dana akan dikembalikan ke rekening bank asal atau e-wallet Anda
                dalam waktu 1-3 hari kerja, dan status kunci lisensi terkait akan dicabut (REVOKED).
              </li>
            </ol>
          </section>

          <section class="space-y-2">
            <h2 class="text-base font-bold text-jetblack">4. Layanan Pelanggan &amp; Bantuan</h2>
            <p>
              Jika Anda memerlukan klarifikasi lebih lanjut mengenai status transaksi atau
              pengembalian dana, silakan hubungi kami:
            </p>
            <div class="p-4 rounded-xl bg-[#FAFAFA] border border-jetblack/10 space-y-1">
              <div><strong>Badan Usaha:</strong> {{ COMPANY_INFO.legalName }}</div>
              <div><strong>Alamat:</strong> {{ COMPANY_INFO.address.full }}</div>
              <div>
                <strong>WhatsApp:</strong>
                <a
                  :href="COMPANY_INFO.contact.whatsappUrl"
                  target="_blank"
                  class="text-forest font-bold hover:underline"
                  >{{ COMPANY_INFO.contact.phone }}</a
                >
              </div>
              <div>
                <strong>Email:</strong>
                <a
                  :href="`mailto:${COMPANY_INFO.contact.email}`"
                  class="text-forest font-bold hover:underline"
                  >{{ COMPANY_INFO.contact.email }}</a
                >
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>

    <PublicFooter />
  </div>
</template>
