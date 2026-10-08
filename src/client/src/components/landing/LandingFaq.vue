<script setup lang="ts">
import { ref } from "vue";

const faqs = [
  {
    q: "Apakah saya harus memiliki PT atau CV untuk mulai berjualan?",
    a: "Tidak perlu. Tertaut beroperasi sebagai Merchant of Record (MoR) resmi. Anda dapat mendaftar sebagai developer individual cukup dengan KTP dan nomor rekening bank lokal. Kami menangani seluruh perizinan pembayaran dan faktur pajak penjualan.",
  },
  {
    q: "Jenis software apa saja yang bisa saya monetisasi dengan Tertaut?",
    a: "Hampir semua jenis produk perangkat lunak: aplikasi desktop (Windows, macOS, Linux via Tauri, Electron, Flutter, C#), web SaaS, extension browser, AI wrapper apps, skrip otomasi, plugin, hingga akses API.",
  },
  {
    q: "Bagaimana cara kerja lisensi jika pengguna tidak memiliki internet konstan?",
    a: "SDK Tertaut dilengkapi cryptographic offline licensing berbasis Ed25519 token. Saat pertama kali aktivasi, perangkat menerima token terenkripsi yang memungkinkan aplikasi tetap berjalan normal secara offline hingga 30 hari tanpa perlu koneksi internet berulang.",
  },
  {
    q: "Bagaimana sistem pembayaran dan pencairan dana (payout)?",
    a: "Pembeli Anda dapat membayar instan melalui QRIS (GoPay, OVO, ShopeePay, BCA Mobile, Dana, dsb) atau Virtual Account bank utama. Setelah transaksi berhasil, 95% dana bersih langsung masuk ke saldo Anda dan dapat dicairkan kapan saja ke rekening bank Anda.",
  },
  {
    q: "Apakah API Key AI (OpenAI / Claude / Gemini) saya aman?",
    a: "Sangat aman. API Key master Anda disimpan dengan enkripsi AES-256 di vault server Tertaut dan tidak pernah dikirim ke aplikasi klien pengguna. Sistem AI Proxy kami juga memberlakukan rate limit 15 req/menit dan daily token cap agar terhindar dari tagihan membengkak.",
  },
  {
    q: "Bagaimana kebijakan pengembalian dana (refund) dan pembatalan lisensi?",
    a: "Admin dan builder memiliki akses satu-klik ke mesin refund. Saat refund dieksekusi, lisensi perangkat otomatis dicabut (REVOKED) dan token offline langsung dimasukkan ke denylist, sehingga akses pengguna dibatalkan secara instan.",
  },
];

const openFaqIndex = ref<number | null>(0);

function toggleFaq(index: number) {
  openFaqIndex.value = openFaqIndex.value === index ? null : index;
}
</script>

<template>
  <section id="faq" class="py-16 md:py-24 max-w-4xl mx-auto px-4 sm:px-6 space-y-12">
    <div class="text-center space-y-3">
      <h2 class="text-xs font-bold uppercase tracking-widest text-forest font-mono">
        Pertanyaan Umum
      </h2>
      <h3 class="text-2xl sm:text-3xl font-extrabold text-jetblack tracking-tight">
        Semua yang Perlu Anda Ketahui
      </h3>
      <p class="text-xs sm:text-sm text-jetblack/65">
        Punya pertanyaan sebelum mulai? Temukan jawabannya di bawah ini.
      </p>
    </div>

    <div class="space-y-3">
      <div
        v-for="(faq, idx) in faqs"
        :key="idx"
        class="luxury-card rounded-xl border border-jetblack/10 overflow-hidden transition"
      >
        <button
          @click="toggleFaq(idx)"
          class="w-full px-5 py-4 text-left flex items-center justify-between gap-4 cursor-pointer hover:bg-jetblack/5 transition"
        >
          <span class="text-sm font-bold text-jetblack">{{ faq.q }}</span>
          <span
            :class="[
              'w-6 h-6 rounded-full flex items-center justify-center border text-xs font-bold transition transform shrink-0',
              openFaqIndex === idx
                ? 'rotate-180 bg-jetblack text-white border-jetblack'
                : 'bg-white text-jetblack/60 border-jetblack/20',
            ]"
          >
            ↓
          </span>
        </button>
        <div
          v-if="openFaqIndex === idx"
          class="px-5 pb-5 text-xs text-jetblack/70 leading-relaxed border-t border-jetblack/5 pt-3 animate-fadeIn"
        >
          {{ faq.a }}
        </div>
      </div>
    </div>
  </section>
</template>
