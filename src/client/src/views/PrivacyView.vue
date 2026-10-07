<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import {
  Shield,
  BookOpen,
  ChevronRight,
  X,
  ExternalLink,
  Lock,
  CheckCircle2,
  AlertCircle,
  FileText,
  Mail,
  Building2,
  Phone,
} from "lucide-vue-next";
import PublicHeader from "../components/common/PublicHeader.vue";
import PublicFooter from "../components/common/PublicFooter.vue";
import { COMPANY_INFO } from "../constants/company";

const isDrawerOpen = ref(false);
const activeChapterId = ref("pasal-1");

const chapters = [
  { id: "pasal-1", num: "1", title: "Landasan Hukum & Identitas Pengendali Data" },
  { id: "pasal-2", num: "2", title: "Kategori Data Pribadi yang Dikumpulkan" },
  { id: "pasal-3", num: "3", title: "Tujuan & Dasar Pemrosesan Data Pribadi" },
  { id: "pasal-4", num: "4", title: "Cookie, Sesi & Pelacakan Sistem" },
  { id: "pasal-5", num: "5", title: "Pembagian Pihak Ketiga & Garansi Bebas Jual Data" },
  { id: "pasal-6", num: "6", title: "Standar Keamanan, Kriptografi & Isolasi Data" },
  { id: "pasal-7", num: "7", title: "Ketentuan Khusus Google Sign-In (ID & EN)" },
  { id: "pasal-8", num: "8", title: "Hak-Hak Subjek Data Pribadi (Pengguna)" },
  { id: "pasal-9", num: "9", title: "Masa Retensi & Prosedur Hapus Data" },
  { id: "pasal-10", num: "10", title: "Pembaruan Kebijakan & Saluran Kontak DPO" },
];

function scrollToChapter(id: string) {
  activeChapterId.value = id;
  const target = document.getElementById(id);
  if (target) {
    target.scrollIntoView({ behavior: "smooth" });
  }
}

function handleMobileChapterSelect(id: string) {
  isDrawerOpen.value = false;
  setTimeout(() => {
    scrollToChapter(id);
  }, 150);
}

let observer: IntersectionObserver | null = null;

onMounted(() => {
  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          activeChapterId.value = entry.target.id;
        }
      }
    },
    {
      rootMargin: "-100px 0px -65% 0px",
      threshold: 0,
    }
  );

  chapters.forEach((ch) => {
    const el = document.getElementById(ch.id);
    if (el) observer?.observe(el);
  });
});

onUnmounted(() => {
  observer?.disconnect();
});
</script>

<template>
  <div
    class="min-h-screen bg-[#FDFDFD] text-slate-900 font-sans selection:bg-amber-500 selection:text-white flex flex-col relative"
  >
    <PublicHeader />

    <!-- Top Header Container -->
    <div
      class="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 w-full pt-10 sm:pt-14 pb-8 border-b border-slate-200/80"
    >
      <div class="max-w-4xl space-y-3">
        <div
          class="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-700 font-bold text-xs"
        >
          <span>🔒</span>
          <span>Dokumen Resmi Hukum &amp; Pelindungan Data Pribadi</span>
        </div>

        <h1
          class="text-2xl sm:text-3xl md:text-4xl font-black text-slate-950 tracking-tight leading-tight"
        >
          Kebijakan Privasi (Privacy Policy)
        </h1>

        <div
          class="flex flex-wrap items-center gap-2.5 text-xs sm:text-sm text-slate-500 font-medium"
        >
          <span>Terakhir diperbarui &amp; berlaku efektif: 7 Oktober 2026</span>
          <span>•</span>
          <span>Versi Regulasi: 1.0.0</span>
          <span>•</span>
          <span class="text-emerald-700 font-semibold"
            >Kepatuhan UU No. 27/2022 (UU PDP) &amp; Google API Policy</span
          >
        </div>
      </div>
    </div>

    <!-- Main Container: 2-Column Desktop Layout (Sidebar + Content) -->
    <div class="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 w-full pt-8 sm:pt-10 flex-1">
      <div
        class="lg:grid lg:grid-cols-[320px_1fr] xl:grid-cols-[340px_1fr] gap-10 xl:gap-14 items-start"
      >
        <!-- DESKTOP STICKY SIDEBAR -->
        <aside class="hidden lg:block sticky top-24 self-start space-y-4">
          <div
            class="p-4.5 rounded-2xl bg-slate-50/90 border border-slate-200/80 space-y-3.5 shadow-2xs"
          >
            <div class="flex items-center justify-between px-1">
              <h2
                class="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5"
              >
                <BookOpen class="w-3.5 h-3.5 text-forest" />
                <span>Daftar Isi Kebijakan</span>
              </h2>
              <span
                class="px-2 py-0.5 rounded-full bg-slate-200/80 text-[10px] font-bold text-slate-600"
              >
                10 Pasal
              </span>
            </div>

            <nav
              class="space-y-1 max-h-[calc(100vh-14rem)] overflow-y-auto pr-1 text-xs sm:text-[13px] font-medium"
            >
              <button
                v-for="ch in chapters"
                :key="ch.id"
                type="button"
                @click="scrollToChapter(ch.id)"
                class="w-full text-left px-3 py-2 rounded-xl transition-all flex items-start gap-2.5 group cursor-pointer"
                :class="
                  activeChapterId === ch.id
                    ? 'bg-forest/10 text-forest-dark font-bold border border-forest/20 shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                "
              >
                <span
                  class="w-5 text-[11px] font-black shrink-0 transition-colors pt-0.5"
                  :class="
                    activeChapterId === ch.id
                      ? 'text-forest'
                      : 'text-slate-400 group-hover:text-slate-600'
                  "
                >
                  {{ ch.num }}.
                </span>
                <span class="leading-snug">
                  {{ ch.title }}
                </span>
              </button>
            </nav>
          </div>

          <!-- Quick Assistance Box in Sidebar -->
          <div
            class="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/15 space-y-2 text-xs"
          >
            <div class="font-bold text-slate-900 flex items-center gap-1.5">
              <span>🛡️</span>
              <span>Hak Data Pribadi &amp; DPO</span>
            </div>
            <p class="text-slate-600 text-[11px] leading-relaxed">
              Untuk pertanyaan privasi, permintaan akses data, atau permohonan penghapusan akun,
              hubungi Pejabat Pelindungan Data (DPO) kami.
            </p>
            <a
              href="mailto:platformtertaut@gmail.com"
              class="inline-block font-bold text-emerald-800 hover:underline text-[11px]"
            >
              platformtertaut@gmail.com ↗
            </a>
          </div>
        </aside>

        <!-- MOBILE TRIGGER -->
        <div class="lg:hidden mb-6">
          <button
            type="button"
            @click="isDrawerOpen = true"
            class="w-full p-3.5 rounded-2xl bg-slate-50 border border-slate-200/90 text-slate-900 flex items-center justify-between text-xs font-bold shadow-2xs hover:bg-slate-100 active:scale-99 transition-all cursor-pointer"
          >
            <div class="flex items-center gap-2">
              <BookOpen class="w-4 h-4 text-forest" />
              <span>Daftar Isi Kebijakan (10 Pasal)</span>
            </div>
            <div class="flex items-center gap-1 text-slate-500 font-semibold">
              <span>Buka Menu</span>
              <ChevronRight class="w-4 h-4" />
            </div>
          </button>
        </div>

        <!-- MAIN POLICY CONTENT ARTICLES -->
        <main
          class="space-y-12 sm:space-y-16 text-slate-800 text-sm sm:text-base leading-relaxed sm:leading-loose"
        >
          <!-- Summary Banner -->
          <div class="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
            <h2 class="text-sm font-bold text-slate-950 flex items-center gap-2">
              <span>📋</span>
              <span>Prinsip Utama Pelindungan Data Pengguna di Tertaut</span>
            </h2>
            <p class="text-xs sm:text-[13px] text-slate-600 leading-relaxed">
              Tertaut (dikelola oleh <strong>{{ COMPANY_INFO.legalName }}</strong
              >) memegang komitmen penuh untuk melindungi privasi setiap pengguna, baik Pengembang
              (Software Builder/Kreator) maupun Pembeli Lisensi. Kami
              <strong
                >tidak pernah dan tidak akan pernah menjual, menyewakan, atau
                memperdagangkan</strong
              >
              data pribadi Anda kepada pihak ketiga untuk kepentingan komersial tanpa persetujuan
              sah Anda.
            </p>
          </div>

          <!-- PASAL 1 -->
          <article
            id="pasal-1"
            class="space-y-4 pt-4 scroll-mt-24 border-t border-slate-100 first:border-0 first:pt-0"
          >
            <div
              class="inline-flex items-center gap-1 text-xs font-black uppercase tracking-wider text-forest bg-forest/10 px-2.5 py-0.5 rounded-md"
            >
              Pasal 1
            </div>
            <h2 class="text-xl sm:text-2xl font-black text-slate-950 tracking-tight">
              Landasan Hukum &amp; Identitas Pengendali Data
            </h2>
            <div class="space-y-3.5 text-slate-700 text-xs sm:text-sm leading-relaxed">
              <p>
                Kebijakan Privasi ini disusun sebagai pedoman baku pelaksanaan pelindungan data
                pribadi yang tunduk pada ketentuan peraturan perundang-undangan di Negara Kesatuan
                Republik Indonesia, termasuk namun tidak terbatas pada:
              </p>
              <ul class="list-disc list-outside pl-5 space-y-1.5">
                <li>
                  <strong>Undang-Undang No. 27 Tahun 2022</strong> tentang Pelindungan Data Pribadi
                  (UU PDP).
                </li>
                <li>
                  <strong>Undang-Undang No. 1 Tahun 2024</strong> tentang Perubahan Kedua atas UU
                  No. 11/2008 tentang Informasi dan Transaksi Elektronik (UU ITE).
                </li>
                <li>
                  <strong>Peraturan Pemerintah No. 71 Tahun 2019</strong> tentang Penyelenggaraan
                  Sistem dan Transaksi Elektronik (PP PSTE).
                </li>
                <li>
                  Ketentuan regulator terkait sistem pembayaran digital Bank Indonesia (BI) dan
                  Kementerian Komunikasi dan Digital (Komdigi).
                </li>
              </ul>
              <p>
                Pihak yang bertindak sebagai
                <strong>Pengendali Data Pribadi (Data Controller)</strong>
                adalah:
              </p>
              <div
                class="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1 font-mono"
              >
                <div><strong>Nama Badan Hukum:</strong> {{ COMPANY_INFO.legalName }}</div>
                <div><strong>Merek Platform:</strong> Tertaut ({{ COMPANY_INFO.websiteUrl }})</div>
                <div><strong>Alamat Operasional:</strong> {{ COMPANY_INFO.address.full }}</div>
                <div>
                  <strong>Kontak Telepon / WhatsApp:</strong> {{ COMPANY_INFO.contact.phone }}
                </div>
                <div>
                  <strong>Email Privasi &amp; DPO:</strong>
                  <a
                    :href="`mailto:${COMPANY_INFO.contact.email}`"
                    class="text-forest font-bold hover:underline"
                  >
                    {{ COMPANY_INFO.contact.email }}
                  </a>
                </div>
              </div>
            </div>
          </article>

          <!-- PASAL 2 -->
          <article id="pasal-2" class="space-y-4 pt-4 scroll-mt-24 border-t border-slate-100">
            <div
              class="inline-flex items-center gap-1 text-xs font-black uppercase tracking-wider text-forest bg-forest/10 px-2.5 py-0.5 rounded-md"
            >
              Pasal 2
            </div>
            <h2 class="text-xl sm:text-2xl font-black text-slate-950 tracking-tight">
              Kategori Data Pribadi yang Dikumpulkan
            </h2>
            <div class="space-y-3.5 text-slate-700 text-xs sm:text-sm leading-relaxed">
              <p>
                Untuk memfasilitasi infrastruktur Merchant of Record (MoR), validasi lisensi
                offline-first kriptografis, dan layanan AI proxy shield, kami mengumpulkan kategori
                data berikut:
              </p>
              <div class="grid sm:grid-cols-2 gap-3.5">
                <div class="p-4 rounded-xl border border-slate-200/90 bg-white space-y-2">
                  <div class="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                    <span>👤</span>
                    <span>1. Data Akun &amp; Identitas Pengembang</span>
                  </div>
                  <p class="text-slate-600 text-xs leading-relaxed">
                    Nama lengkap, alamat email aktif, nomor kontak WhatsApp, kata sandi terenkripsi
                    (salted cryptographic hash), serta rincian rekening bank atau e-wallet untuk
                    pencairan pendapatan (settlement/payout).
                  </p>
                </div>
                <div class="p-4 rounded-xl border border-slate-200/90 bg-white space-y-2">
                  <div class="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                    <span>🛒</span>
                    <span>2. Data Transaksi Pembeli Software</span>
                  </div>
                  <p class="text-slate-600 text-xs leading-relaxed">
                    Nama pembeli, alamat email penerima kunci lisensi dan faktur pajak PPN 11%,
                    nomor kontak notifikasi transaksi, rincian produk software yang dibeli, serta
                    nomor invoice pesanan.
                  </p>
                </div>
                <div class="p-4 rounded-xl border border-slate-200/90 bg-white space-y-2">
                  <div class="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                    <span>🔑</span>
                    <span>3. Data Validasi Lisensi &amp; Hardware ID</span>
                  </div>
                  <p class="text-slate-600 text-xs leading-relaxed">
                    Hash kriptografis satu arah yang di-salt (salted HMAC-SHA256) dari Hardware ID
                    perangkat untuk memverifikasi alokasi seat lisensi Ed25519. Kami
                    <strong>tidak pernah mengakses file pribadi atau dokumen</strong> pada perangkat
                    pengguna.
                  </p>
                </div>
                <div class="p-4 rounded-xl border border-slate-200/90 bg-white space-y-2">
                  <div class="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                    <span>🛡️</span>
                    <span>4. Data AI Proxy Shield &amp; Metering</span>
                  </div>
                  <p class="text-slate-600 text-xs leading-relaxed">
                    Volume konsumsi token LLM (input/output), timestamp permintaan, dan status kuota
                    rate limit. Master API key pengembang disimpan di vault terenkripsi tingkat
                    tinggi AES-256 GCM.
                  </p>
                </div>
              </div>
              <div
                class="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-950"
              >
                <strong>Catatan Kepatuhan Finansial:</strong> Tertaut
                <strong>tidak pernah menyimpan</strong>
                data sensitif instrumen kartu kredit (seperti 16 digit nomor kartu penuh atau kode
                otentikasi CVV/CVC) maupun PIN perbankan. Seluruh pemrosesan pembayaran dilakukan
                secara langsung dan terenkripsi melalui gerbang pembayaran resmi berizin Bank
                Indonesia.
              </div>
            </div>
          </article>

          <!-- PASAL 3 -->
          <article id="pasal-3" class="space-y-4 pt-4 scroll-mt-24 border-t border-slate-100">
            <div
              class="inline-flex items-center gap-1 text-xs font-black uppercase tracking-wider text-forest bg-forest/10 px-2.5 py-0.5 rounded-md"
            >
              Pasal 3
            </div>
            <h2 class="text-xl sm:text-2xl font-black text-slate-950 tracking-tight">
              Tujuan &amp; Dasar Pemrosesan Data Pribadi (Legal Basis)
            </h2>
            <div class="space-y-3.5 text-slate-700 text-xs sm:text-sm leading-relaxed">
              <p>
                Tertaut memproses data pribadi Anda berdasarkan dasar pemrosesan yang sah (*legal
                basis*) sesuai Pasal 20 UU PDP, yaitu:
              </p>
              <ul class="list-disc list-outside pl-5 space-y-2">
                <li>
                  <strong>Pemenuhan Kewajiban Perjanjian Layanan:</strong> Untuk memverifikasi akun
                  pengembang, menerbitkan token lisensi Ed25519 yang dapat diverifikasi secara
                  offline, mengonfirmasi status pembayaran dari payment gateway, menerbitkan faktur
                  pajak resmi, dan memproses settlement dana.
                </li>
                <li>
                  <strong>Komunikasi &amp; Layanan Pelanggan:</strong> Mengirimkan invoice
                  transaksi, notifikasi keberhasilan pembayaran, instruksi aktivasi lisensi
                  software, dan merespons pertanyaan teknis.
                </li>
                <li>
                  <strong>Keamanan &amp; Pencegahan Fraud:</strong> Memantau aktivitas anomali pada
                  sistem checkout, mencegah pembajakan lisensi digital, dan melindungi akun dari
                  pengambilalihan (*account takeover*).
                </li>
                <li>
                  <strong>Kepatuhan Regulasi &amp; Perpajakan:</strong> Memenuhi kewajiban pelaporan
                  dan pencatatan transaksi keuangan sesuai regulasi perpajakan dan perbankan Negara
                  Republik Indonesia.
                </li>
              </ul>
            </div>
          </article>

          <!-- PASAL 4 -->
          <article id="pasal-4" class="space-y-4 pt-4 scroll-mt-24 border-t border-slate-100">
            <div
              class="inline-flex items-center gap-1 text-xs font-black uppercase tracking-wider text-forest bg-forest/10 px-2.5 py-0.5 rounded-md"
            >
              Pasal 4
            </div>
            <h2 class="text-xl sm:text-2xl font-black text-slate-950 tracking-tight">
              Penggunaan Cookie, Sesi &amp; Pelacakan Sistem
            </h2>
            <div class="space-y-3.5 text-slate-700 text-xs sm:text-sm leading-relaxed">
              <p>
                Platform kami menggunakan teknologi cookies dan local storage dengan klasifikasi
                berikut:
              </p>
              <div class="space-y-2.5">
                <div class="p-3.5 rounded-xl border border-slate-200 bg-white">
                  <div class="font-bold text-slate-900 text-xs mb-1">
                    A. Cookie Esensial (Wajib Aktif)
                  </div>
                  <p class="text-slate-600 text-xs leading-relaxed">
                    Dibutuhkan untuk menjaga sesi login aman pengguna (Better Auth session token),
                    proteksi CSRF, dan integritas saat transaksi checkout berlangsung.
                  </p>
                </div>
                <div class="p-3.5 rounded-xl border border-slate-200 bg-white">
                  <div class="font-bold text-slate-900 text-xs mb-1">
                    B. Analitik Platform Teragregasi
                  </div>
                  <p class="text-slate-600 text-xs leading-relaxed">
                    Mengukur lalu lintas kunjungan dan keandalan sistem server secara teragregasi
                    tanpa mengidentifikasi profil individu pengguna.
                  </p>
                </div>
              </div>
              <p class="text-xs text-slate-500">
                Pengguna memiliki hak penuh untuk menolak atau menghapus cookie melalui menu setelan
                browser masing-masing.
              </p>
            </div>
          </article>

          <!-- PASAL 5 -->
          <article id="pasal-5" class="space-y-4 pt-4 scroll-mt-24 border-t border-slate-100">
            <div
              class="inline-flex items-center gap-1 text-xs font-black uppercase tracking-wider text-forest bg-forest/10 px-2.5 py-0.5 rounded-md"
            >
              Pasal 5
            </div>
            <h2 class="text-xl sm:text-2xl font-black text-slate-950 tracking-tight">
              Pembagian Data kepada Pihak Ketiga &amp; Garansi Bebas Jual Data
            </h2>
            <div class="space-y-3.5 text-slate-700 text-xs sm:text-sm leading-relaxed">
              <p>
                Tertaut hanya membagikan data pribadi Anda kepada pihak ketiga dalam batas-batas
                yang sangat ketat demi operasional layanan:
              </p>
              <ul class="list-disc list-outside pl-5 space-y-2">
                <li>
                  <strong>Penyedia Gerbang Pembayaran (Payment Gateway):</strong> Meneruskan
                  parameter tagihan untuk pembuatan QRIS dan Virtual Account bank resmi yang berizin
                  Bank Indonesia.
                </li>
                <li>
                  <strong>Penyedia Infrastruktur Cloud &amp; Database:</strong> Penyimpanan data
                  terenkripsi di server yang memenuhi sertifikasi standar keamanan ISO/IEC 27001 dan
                  SOC 2.
                </li>
                <li>
                  <strong>Aparat Penegak Hukum &amp; Pengadilan:</strong> Jika diwajibkan secara
                  tegas oleh surat perintah resmi atau penetapan pengadilan yang sah berdasarkan
                  hukum Republik Indonesia.
                </li>
              </ul>
              <div
                class="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-950 font-medium"
              >
                ✅ <strong>Garansi Bebas Penjualan Data:</strong> Kami
                <strong>tidak pernah menjual, menyewakan, meminjamkan, atau memperdagangkan</strong>
                data pribadi pengguna kepada pihak ketiga mana pun, pialang data (*data brokers*),
                atau biro periklanan untuk keperluan pemasaran tanpa hubungan langsung dengan
                transaksi Anda.
              </div>
            </div>
          </article>

          <!-- PASAL 6 -->
          <article id="pasal-6" class="space-y-4 pt-4 scroll-mt-24 border-t border-slate-100">
            <div
              class="inline-flex items-center gap-1 text-xs font-black uppercase tracking-wider text-forest bg-forest/10 px-2.5 py-0.5 rounded-md"
            >
              Pasal 6
            </div>
            <h2 class="text-xl sm:text-2xl font-black text-slate-950 tracking-tight">
              Standar Keamanan, Kriptografi &amp; Isolasi Data
            </h2>
            <div class="space-y-3.5 text-slate-700 text-xs sm:text-sm leading-relaxed">
              <p>
                Kami menerapkan standar pengamanan teknis dan organisasi berlapis untuk mencegah
                akses tidak sah, kebocoran, atau perusakan data pribadi:
              </p>
              <ul class="list-disc list-outside pl-5 space-y-1.5">
                <li>
                  <strong>Enkripsi Transportasi:</strong> Seluruh komunikasi antar-klien dan server
                  dilindungi protokol enkripsi <strong>TLS 1.3 / HTTPS</strong> dengan sertifikat
                  SSL terverifikasi.
                </li>
                <li>
                  <strong>Kriptografi Asimetris Ed25519:</strong> Validasi lisensi software
                  dilakukan secara offline-first hingga 30 hari tanpa perlu mengirimkan identitas
                  sensitif pengguna ke jaringan publik.
                </li>
                <li>
                  <strong>Vault Enkripsi AES-256 GCM:</strong> Penyimpanan kredensial master API key
                  pengembang dilindungi enkripsi berstandar perbankan di vault terisolasi.
                </li>
                <li>
                  <strong>Hashing Kata Sandi:</strong> Password disimpan dengan algoritma hash satu
                  arah yang kuat (Argon2 / bcrypt) dengan salt kriptografis unik.
                </li>
                <li>
                  <strong>Isolasi Multi-Tenant:</strong> Setiap data aplikasi, transaksi, dan saldo
                  pengembang dipisahkan secara logikal dengan kontrol otorisasi bertingkat
                  (anti-IDOR) serta prinsip hak akses terkecil (*Least Privilege*).
                </li>
              </ul>
            </div>
          </article>

          <!-- PASAL 7: GOOGLE OAUTH COMPLIANCE (BILINGUAL ID & EN) -->
          <article id="pasal-7" class="space-y-4 pt-4 scroll-mt-24 border-t border-slate-100">
            <div
              class="inline-flex items-center gap-1 text-xs font-black uppercase tracking-wider text-blue-700 bg-blue-500/10 px-2.5 py-0.5 rounded-md"
            >
              Pasal 7
            </div>
            <h2 class="text-xl sm:text-2xl font-black text-slate-950 tracking-tight">
              Ketentuan Khusus Google Sign-In &amp; Kepatuhan Google API Services User Data Policy
            </h2>
            <div class="p-5 rounded-2xl bg-blue-50/70 border border-blue-200/90 space-y-4">
              <div class="space-y-2">
                <h3 class="text-sm font-bold text-blue-950 flex items-center gap-2">
                  <span>🔐</span>
                  <span>Integrasi Google Sign-In (OAuth 2.0)</span>
                </h3>
                <p class="text-xs text-blue-900 leading-relaxed">
                  Tertaut menyediakan opsi masuk menggunakan Google Sign-In untuk kenyamanan
                  otentikasi satu klik. Bagian ini menjelaskan secara transparan bagaimana data
                  pengguna Google diakses, digunakan, dan disimpan:
                </p>
              </div>

              <div class="grid sm:grid-cols-2 gap-3 text-xs">
                <div class="p-3.5 rounded-xl bg-white border border-blue-200 space-y-1">
                  <div class="font-bold text-blue-950">
                    A. Data Google yang Kami Akses (Scopes):
                  </div>
                  <ul class="list-disc pl-4 space-y-1 text-slate-600">
                    <li><code>openid</code>: ID unik pengguna untuk verifikasi login aman.</li>
                    <li><code>email</code>: Alamat email primer sebagai identitas akun builder.</li>
                    <li><code>profile</code>: Nama tampilan dan foto profil publik.</li>
                  </ul>
                </div>
                <div class="p-3.5 rounded-xl bg-white border border-blue-200 space-y-1">
                  <div class="font-bold text-blue-950">B. Tujuan Penggunaan Data Google:</div>
                  <ul class="list-disc pl-4 space-y-1 text-slate-600">
                    <li>Otentikasi login satu klik ke dashboard builder Tertaut.</li>
                    <li>Mengaitkan lisensi software dan aplikasi milik pengembang.</li>
                    <li>Mengirimkan notifikasi teknis dan keamanan terkait akun.</li>
                  </ul>
                </div>
              </div>

              <div class="text-xs text-slate-700 space-y-1.5 leading-relaxed">
                <p>
                  <strong>Larangan Penggunaan:</strong> Data pengguna Google
                  <strong>TIDAK PERNAH</strong> dijual, dialihkan kepada pihak ketiga, digunakan
                  untuk penargetan iklan, atau digunakan untuk melatih model kecerdasan buatan (AI).
                </p>
                <p>
                  <strong>Pencabutan Akses Mandiri:</strong> Pengguna dapat mencabut otorisasi akses
                  Tertaut kapan saja melalui tautan resmi:
                  <a
                    href="https://myaccount.google.com/permissions"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="text-blue-800 font-bold hover:underline"
                  >
                    Google Account Permissions (https://myaccount.google.com/permissions) ↗ </a
                  >.
                </p>
              </div>

              <!-- English Statement for Google Trust & Safety Review -->
              <div class="p-4 rounded-xl bg-white border border-blue-300 space-y-2 text-xs">
                <div class="font-bold text-blue-950 flex items-center justify-between">
                  <span>Google API Services User Data Policy Compliance Statement (English)</span>
                  <span
                    class="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-bold"
                  >
                    Official Verification Clause
                  </span>
                </div>
                <p class="text-slate-800 font-medium leading-relaxed">
                  <strong
                    >Tertaut's use and transfer to any other app of information received from Google
                    APIs will adhere to the
                    <a
                      href="https://developers.google.com/terms/api-services-user-data-policy"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="text-blue-700 hover:underline"
                    >
                      Google API Services User Data Policy </a
                    >, including the Limited Use requirements.</strong
                  >
                </p>
                <ul class="list-disc pl-4 space-y-1 text-slate-600 text-[11.5px]">
                  <li>
                    <strong>Scopes Requested:</strong> <code>openid</code>, <code>email</code>, and
                    <code>profile</code> strictly for user identity authentication.
                  </li>
                  <li>
                    <strong>No Data Brokerage:</strong> Google user data is never sold, licensed, or
                    shared with third-party advertisers or external data brokers.
                  </li>
                  <li>
                    <strong>User Revocation:</strong> Users can revoke app access at any time via
                    <a
                      href="https://myaccount.google.com/permissions"
                      target="_blank"
                      class="text-blue-700 underline"
                      >Google Account Permissions</a
                    >.
                  </li>
                </ul>
              </div>
            </div>
          </article>

          <!-- PASAL 8 -->
          <article id="pasal-8" class="space-y-4 pt-4 scroll-mt-24 border-t border-slate-100">
            <div
              class="inline-flex items-center gap-1 text-xs font-black uppercase tracking-wider text-forest bg-forest/10 px-2.5 py-0.5 rounded-md"
            >
              Pasal 8
            </div>
            <h2 class="text-xl sm:text-2xl font-black text-slate-950 tracking-tight">
              Hak-Hak Subjek Data Pribadi (Pengguna) sesuai UU PDP
            </h2>
            <div class="space-y-3.5 text-slate-700 text-xs sm:text-sm leading-relaxed">
              <p>
                Sesuai dengan ketentuan Undang-Undang No. 27 Tahun 2022 tentang Pelindungan Data
                Pribadi (UU PDP), Anda memiliki hak-hak berikut:
              </p>
              <div class="grid sm:grid-cols-2 gap-3.5">
                <div class="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                  <div class="font-bold text-slate-900">1. Hak Akses (Right of Access)</div>
                  <div class="text-slate-600">
                    Meminta konfirmasi dan salinan data pribadi yang kami simpan mengenai akun Anda.
                  </div>
                </div>
                <div class="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                  <div class="font-bold text-slate-900">
                    2. Hak Koreksi (Right to Rectification)
                  </div>
                  <div class="text-slate-600">
                    Memperbarui atau memperbaiki ketidakakuratan data profil atau rekening melalui
                    dashboard.
                  </div>
                </div>
                <div class="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                  <div class="font-bold text-slate-900">3. Hak Penarikan Persetujuan</div>
                  <div class="text-slate-600">
                    Menarik kembali izin pemrosesan data untuk keperluan tertentu yang bersifat
                    opsional.
                  </div>
                </div>
                <div class="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                  <div class="font-bold text-slate-900">4. Hak Penghapusan (Erasure)</div>
                  <div class="text-slate-600">
                    Meminta penutupan akun dan pemusnahan data pribadi sesuai syarat retensi
                    regulasi yang berlaku.
                  </div>
                </div>
              </div>
            </div>
          </article>

          <!-- PASAL 9 -->
          <article id="pasal-9" class="space-y-4 pt-4 scroll-mt-24 border-t border-slate-100">
            <div
              class="inline-flex items-center gap-1 text-xs font-black uppercase tracking-wider text-forest bg-forest/10 px-2.5 py-0.5 rounded-md"
            >
              Pasal 9
            </div>
            <h2 class="text-xl sm:text-2xl font-black text-slate-950 tracking-tight">
              Masa Retensi &amp; Prosedur Permintaan Penghapusan Data
            </h2>
            <div class="space-y-3.5 text-slate-700 text-xs sm:text-sm leading-relaxed">
              <p>
                Data pribadi Anda akan disimpan selama akun Anda aktif di platform Tertaut atau
                selama diperlukan untuk menyediakan layanan yang Anda minta.
              </p>
              <p>
                <strong>Ketentuan Retensi Khusus Pembukuan Keuangan:</strong> Catatan transaksi
                keuangan, riwayat settlement, dan faktur pajak wajib disimpan selama
                <strong>minimal 5 (lima) hingga 10 (sepuluh) tahun</strong>
                sesuai amanat Undang-Undang Ketentuan Umum dan Tata Cara Perpajakan (UU KUP) serta
                peraturan Bank Indonesia mengenai audit finansial.
              </p>
              <div class="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-2">
                <div class="font-bold text-slate-900">
                  Prosedur Pengajuan Permohonan Penghapusan Akun &amp; Data:
                </div>
                <ol class="list-decimal list-outside pl-4 space-y-1 text-slate-600">
                  <li>
                    Kirimkan permohonan melalui email terdaftar Anda ke
                    <a
                      :href="`mailto:${COMPANY_INFO.contact.email}`"
                      class="text-forest font-bold hover:underline"
                    >
                      {{ COMPANY_INFO.contact.email }}
                    </a>
                    dengan subjek
                    <em>"Permohonan Penghapusan Data Pribadi - [Nama/Email Akun]"</em>.
                  </li>
                  <li>Sertakan bukti verifikasi kepemilikan akun yang sah.</li>
                  <li>
                    Tim DPO kami akan memproses validasi, menyelesaikan seluruh kewajiban saldo yang
                    masih berjalan, dan melakukan pemusnahan data sesuai SLA maksimal 30 hari
                    kalender.
                  </li>
                </ol>
              </div>
            </div>
          </article>

          <!-- PASAL 10 -->
          <article id="pasal-10" class="space-y-4 pt-4 scroll-mt-24 border-t border-slate-100">
            <div
              class="inline-flex items-center gap-1 text-xs font-black uppercase tracking-wider text-forest bg-forest/10 px-2.5 py-0.5 rounded-md"
            >
              Pasal 10
            </div>
            <h2 class="text-xl sm:text-2xl font-black text-slate-950 tracking-tight">
              Pembaruan Kebijakan &amp; Kontak Resmi Pejabat DPO
            </h2>
            <div class="space-y-3.5 text-slate-700 text-xs sm:text-sm leading-relaxed">
              <p>
                Tertaut berhak memperbarui Kebijakan Privasi ini dari waktu ke waktu untuk
                menyesuaikan perkembangan teknologi, penambahan fitur platform, maupun perubahan
                regulasi pemerintah Republik Indonesia. Pembaruan materiil akan diberitahukan
                melalui notifikasi platform atau email sebelum tanggal berlakunya.
              </p>
              <div class="p-4 rounded-xl border border-slate-200 bg-white space-y-2 text-xs">
                <div class="font-bold text-slate-900 text-sm">
                  Saluran Komunikasi Resmi Perlindungan Data:
                </div>
                <ul class="space-y-1 text-slate-600">
                  <li><strong>Badan Hukum Pengelola:</strong> {{ COMPANY_INFO.legalName }}</li>
                  <li><strong>Merek Platform:</strong> Tertaut (tertaut.com)</li>
                  <li>
                    <strong>Email Khusus Privasi &amp; DPO:</strong>
                    <a
                      :href="`mailto:${COMPANY_INFO.contact.email}`"
                      class="text-forest font-bold hover:underline"
                    >
                      {{ COMPANY_INFO.contact.email }}
                    </a>
                  </li>
                  <li><strong>Telepon / WhatsApp:</strong> {{ COMPANY_INFO.contact.phone }}</li>
                  <li><strong>Alamat Kantor:</strong> {{ COMPANY_INFO.address.full }}</li>
                </ul>
              </div>
            </div>
          </article>
        </main>
      </div>
    </div>

    <!-- MOBILE DRAWER -->
    <div
      v-if="isDrawerOpen"
      class="fixed inset-0 z-50 lg:hidden flex flex-col justify-end bg-slate-950/40 backdrop-blur-xs animate-fade-in"
      @click.self="isDrawerOpen = false"
    >
      <div
        class="bg-white rounded-t-3xl max-h-[80vh] flex flex-col p-6 shadow-2xl border-t border-slate-200 animate-slide-up"
      >
        <div class="flex items-center justify-between pb-4 border-b border-slate-100">
          <div class="flex items-center gap-2">
            <BookOpen class="w-4 h-4 text-forest" />
            <h3 class="text-sm font-black text-slate-900">Daftar Isi Kebijakan Privasi</h3>
          </div>
          <button
            type="button"
            @click="isDrawerOpen = false"
            class="p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
            aria-label="Tutup"
          >
            <X class="w-5 h-5" />
          </button>
        </div>

        <nav class="space-y-1.5 overflow-y-auto py-4 text-xs font-semibold">
          <button
            v-for="ch in chapters"
            :key="ch.id"
            type="button"
            @click="handleMobileChapterSelect(ch.id)"
            class="w-full text-left px-3.5 py-2.5 rounded-xl transition-all flex items-center justify-between cursor-pointer"
            :class="
              activeChapterId === ch.id
                ? 'bg-forest/10 text-forest-dark font-bold border border-forest/20'
                : 'text-slate-600 hover:bg-slate-50'
            "
          >
            <div class="flex items-center gap-2.5">
              <span class="w-5 text-[11px] font-black text-slate-400">{{ ch.num }}.</span>
              <span>{{ ch.title }}</span>
            </div>
            <ChevronRight class="w-3.5 h-3.5 text-slate-400" />
          </button>
        </nav>
      </div>
    </div>

    <PublicFooter />
  </div>
</template>
