<script setup lang="ts">
import { ref, computed } from "vue";
import { useRouter } from "vue-router";
import { authClient } from "../lib/auth";
import { useClipboard } from "../composables/useClipboard";
import {
  CreditCard,
  KeyRound,
  Bot,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Code2,
  Terminal,
  ExternalLink,
  ChevronRight,
  Menu,
  X,
  QrCode,
  FileText,
  Calculator,
  Laptop,
  Globe,
  Zap,
  HelpCircle,
  Copy,
  Check,
  TrendingUp,
  Lock,
} from "lucide-vue-next";

const { copied: copiedSdk, copy: writeClipboard } = useClipboard();
const isMobileMenuOpen = ref(false);
const router = useRouter();
const authSession = authClient.useSession();
const isLoggedIn = computed(() => !!authSession.value?.data?.user);

// Hero Interactive Tabs
const activeDemoTab = ref<"checkout" | "license" | "ai" | "badge">("checkout");
const selectedDemoChannel = ref("QRIS Instan");
const selectedDemoBadge = ref("verified");

// Interactive Code Showcase
const activeCodeTab = ref<"license" | "aiproxy" | "checkout" | "metering">("license");
const copiedCode = ref(false);

const codeSnippets = {
  license: `import { Tertaut } from "@tertaut/sdk";

const tertaut = new Tertaut({ appSlug: "desktop-pro" });

// Validasi lisensi dengan fallback Ed25519 token offline (hingga 30 hari tanpa internet)
const result = await tertaut.licensing.check({
  licenseKey: "TT-PRO-9821-4412",
  hwid: "macbook-pro-m2-hash",
});

if (result.valid) {
  console.log("Lisensi aktif untuk:", result.customerName);
  console.log("Device seat terpakai: 1 / 3");
}`,
  aiproxy: `import { Tertaut } from "@tertaut/sdk";

const tertaut = new Tertaut({ appSlug: "chat-ai-suite" });

// Kirim prompt ke AI tanpa mengekspos OpenAI / Anthropic API Key di klien!
const response = await tertaut.aiProxy.chat({
  licenseKey: "TT-AI-5512-8890",
  messages: [
    { role: "user", content: "Buat ringkasan laporan keuangan ini..." }
  ],
  model: "gpt-4o", // otomatis diproteksi rate limit & daily token cap
});

console.log("Hasil AI:", response.choices[0].message.content);`,
  checkout: `import { Tertaut } from "@tertaut/sdk";

const tertaut = new Tertaut({ appSlug: "desktop-pro" });

// Buka sesi checkout berbayar instan (QRIS & Virtual Account)
const session = await tertaut.checkout.createSession({
  productSlug: "lifetime-license",
  customerEmail: "pembeli@perusahaan.com",
  couponCode: "EARLYBIRD20",
});

// Arahkan pembeli ke halaman checkout aman Tertaut
window.location.href = session.checkoutUrl;`,
  metering: `import { Tertaut } from "@tertaut/sdk";

const tertaut = new Tertaut({ appSlug: "saas-automate" });

// Laporkan konsumsi kredit penggunaan (usage-based billing)
await tertaut.credits.reportUsage({
  licenseKey: "TT-PRO-9821-4412",
  units: 5,
  feature: "export_pdf_hd",
  metadata: { pages: 12 },
});

const balance = await tertaut.credits.balance("TT-PRO-9821-4412");
console.log("Sisa kredit lisensi:", balance.remainingCredits);`,
};

function copyActiveCode() {
  writeClipboard(codeSnippets[activeCodeTab.value]);
  copiedCode.value = true;
  setTimeout(() => {
    copiedCode.value = false;
  }, 2000);
}

// Calculator State
const calcProductPrice = ref(150000);
const calcSalesCount = ref(20);

const calcGrossRevenue = computed(() => calcProductPrice.value * calcSalesCount.value);
const calcPlatformFee = computed(() => Math.round(calcGrossRevenue.value * 0.05));
const calcNetPayout = computed(() => calcGrossRevenue.value - calcPlatformFee.value);

function formatIDR(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

// FAQ State
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

async function handleLogout() {
  try {
    await authClient.signOut();
  } catch {}
  router.push("/");
}

function copySdkInstall() {
  writeClipboard("npm install @tertaut/sdk");
}
</script>

<template>
  <div
    class="min-h-screen bg-white text-jetblack flex flex-col selection:bg-gold/20 selection:text-jetblack"
  >
    <!-- Public Header -->
    <header class="border-b border-jetblack/10 sticky top-0 bg-white/95 backdrop-blur-md z-50">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <!-- Logo -->
        <router-link to="/" class="flex items-center gap-2.5 group">
          <img
            src="/logo.svg"
            alt="tertaut.com"
            class="w-8 h-8 rounded-lg shadow-md group-hover:scale-105 transition"
          />
          <div>
            <div
              class="font-extrabold text-base tracking-tight text-jetblack flex items-center gap-0.5 font-mono"
            >
              tertaut<span class="text-gold">.com</span>
            </div>
          </div>
        </router-link>

        <!-- Navigation Links -->
        <nav class="hidden md:flex items-center gap-7 text-xs font-semibold text-jetblack/75">
          <a href="#solusi" class="hover:text-jetblack transition">Solusi Produk</a>
          <a href="#cara-kerja" class="hover:text-jetblack transition">Cara Kerja</a>
          <a href="#integrasi-sdk" class="hover:text-jetblack transition">Integrasi SDK</a>
          <a href="#kalkulator" class="hover:text-jetblack transition">Kalkulator Biaya</a>
          <a href="#faq" class="hover:text-jetblack transition">FAQ</a>
          <router-link to="/dashboard/docs" class="hover:text-jetblack transition"
            >Dokumentasi</router-link
          >
        </nav>

        <!-- Action CTAs -->
        <div class="flex items-center gap-2 sm:gap-3">
          <router-link
            to="/pay/fastmail-ai"
            class="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-jetblack/15 text-xs font-semibold text-jetblack hover:bg-jetblack/5 transition"
          >
            <QrCode class="w-3.5 h-3.5 text-forest" />
            <span>Demo Checkout</span>
          </router-link>

          <router-link
            v-if="!isLoggedIn"
            to="/login"
            class="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-jetblack text-white text-xs font-bold shadow-sm hover:bg-jetblack-hover transition active:scale-95"
          >
            <span>Mulai Gratis</span>
            <ArrowRight class="w-3.5 h-3.5 text-gold" />
          </router-link>

          <template v-else>
            <router-link
              to="/dashboard"
              class="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-jetblack text-white text-xs font-bold shadow-sm hover:bg-jetblack-hover transition active:scale-95"
            >
              <span>Buka Dashboard</span>
              <ArrowRight class="w-3.5 h-3.5 text-gold" />
            </router-link>

            <button
              type="button"
              @click="handleLogout"
              class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-400/40 text-xs font-bold text-red-400 hover:bg-red-400/10 transition active:scale-95"
            >
              <span>Keluar</span>
            </button>
          </template>

          <!-- Mobile Hamburger Toggle -->
          <button
            @click="isMobileMenuOpen = !isMobileMenuOpen"
            class="md:hidden p-1.5 rounded-lg border border-jetblack/15 text-jetblack hover:bg-jetblack/5 cursor-pointer"
            aria-label="Toggle Menu"
          >
            <X v-if="isMobileMenuOpen" class="w-4 h-4" />
            <Menu v-else class="w-4 h-4" />
          </button>
        </div>
      </div>

      <!-- Mobile Navigation Drawer -->
      <div
        v-if="isMobileMenuOpen"
        class="md:hidden border-t border-jetblack/10 bg-white px-4 py-4 space-y-3 text-xs font-semibold animate-fadeIn shadow-lg"
      >
        <a
          href="#solusi"
          @click="isMobileMenuOpen = false"
          class="block py-1.5 text-jetblack/80 hover:text-jetblack"
          >Solusi Produk</a
        >
        <a
          href="#cara-kerja"
          @click="isMobileMenuOpen = false"
          class="block py-1.5 text-jetblack/80 hover:text-jetblack"
          >Cara Kerja</a
        >
        <a
          href="#integrasi-sdk"
          @click="isMobileMenuOpen = false"
          class="block py-1.5 text-jetblack/80 hover:text-jetblack"
          >Integrasi SDK</a
        >
        <a
          href="#kalkulator"
          @click="isMobileMenuOpen = false"
          class="block py-1.5 text-jetblack/80 hover:text-jetblack"
          >Kalkulator Biaya</a
        >
        <a
          href="#faq"
          @click="isMobileMenuOpen = false"
          class="block py-1.5 text-jetblack/80 hover:text-jetblack"
          >FAQ</a
        >
        <router-link
          to="/dashboard/docs"
          @click="isMobileMenuOpen = false"
          class="block py-1.5 text-jetblack/80 hover:text-jetblack"
          >Dokumentasi SDK</router-link
        >
        <router-link
          to="/pay/fastmail-ai"
          @click="isMobileMenuOpen = false"
          class="block py-1.5 text-forest font-bold"
          >Coba Demo Checkout ↗</router-link
        >
        <div class="pt-3 border-t border-jetblack/10">
          <router-link
            v-if="!isLoggedIn"
            to="/login"
            @click="isMobileMenuOpen = false"
            class="block py-2.5 text-center rounded-lg bg-jetblack text-white font-bold"
          >
            Mulai Gratis Sekarang
          </router-link>
          <div v-else class="flex items-center gap-2">
            <router-link
              to="/dashboard"
              @click="isMobileMenuOpen = false"
              class="flex-1 py-2.5 text-center rounded-lg bg-jetblack text-white font-bold"
            >
              Buka Dashboard
            </router-link>
            <button
              type="button"
              @click="
                () => {
                  isMobileMenuOpen = false;
                  handleLogout();
                }
              "
              class="px-4 py-2.5 text-center rounded-lg border border-red-400/40 text-red-500 font-bold"
            >
              Keluar
            </button>
          </div>
        </div>
      </div>
    </header>

    <!-- Hero Section -->
    <section
      class="relative overflow-hidden pt-12 pb-16 md:pt-20 md:pb-24 border-b border-jetblack/10 bg-gradient-to-b from-white via-[#FCFCFC] to-[#F7F7F7]"
    >
      <div class="max-w-5xl mx-auto px-4 sm:px-6 text-center space-y-6">
        <!-- Top Pill Badge -->
        <div
          class="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-jetblack/5 border border-jetblack/10 text-jetblack text-xs font-semibold shadow-xs"
        >
          <span class="w-2 h-2 rounded-full bg-forest animate-pulse"></span>
          <span class="font-medium text-jetblack/90"
            >Merchant of Record &amp; Lisensi Software Indonesia</span
          >
          <span class="text-jetblack/30">•</span>
          <span class="text-forest font-bold">Flat 5% Fee • 0% Biaya Bulanan</span>
        </div>

        <!-- Main Headline -->
        <h1
          class="text-3xl sm:text-5xl md:text-6xl font-black text-jetblack tracking-tight leading-[1.12]"
        >
          Jual Software, SaaS &amp; AI di Indonesia.
          <br class="hidden sm:inline" />
          <span
            class="bg-gradient-to-r from-jetblack via-forest to-gold bg-clip-text text-transparent"
          >
            Tanpa Ribet PT/CV, Pajak, atau DRM.
          </span>
        </h1>

        <!-- Subtitle -->
        <p
          class="max-w-2xl mx-auto text-sm sm:text-base md:text-lg text-jetblack/70 leading-relaxed"
        >
          Tertaut menangani pembayaran <strong>QRIS &amp; Virtual Account</strong>, faktur pajak
          resmi (PPN 11%), <strong>lisensi offline-first Ed25519</strong>, hingga proteksi kuota AI.
          Anda cukup fokus menulis kode dan mencairkan pendapatan.
        </p>

        <!-- CTA Action Buttons -->
        <div class="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
          <router-link
            to="/login"
            class="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-jetblack text-white text-sm font-bold shadow-lg shadow-jetblack/15 hover:bg-jetblack-hover transition active:scale-95"
          >
            <span>Mulai Monetisasi — Gratis</span>
            <ArrowRight class="w-4 h-4 text-gold" />
          </router-link>

          <router-link
            to="/pay/fastmail-ai"
            class="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-white border border-jetblack/15 text-jetblack text-sm font-bold shadow-sm hover:bg-[#F9F9F9] transition"
          >
            <QrCode class="w-4 h-4 text-forest" />
            <span>Coba Demo Pembayaran</span>
          </router-link>

          <router-link
            to="/dashboard/docs"
            class="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl text-xs font-semibold text-jetblack/70 hover:text-jetblack transition"
          >
            <Code2 class="w-4 h-4 text-gold" />
            <span>Dokumentasi SDK</span>
          </router-link>
        </div>

        <!-- Quick Terminal Snippet -->
        <div class="pt-3 max-w-md mx-auto">
          <div
            @click="copySdkInstall"
            class="group cursor-pointer flex items-center justify-between px-4 py-2.5 rounded-xl bg-jetblack text-white font-mono text-xs border border-white/10 shadow-md hover:border-gold/50 transition"
          >
            <div class="flex items-center gap-2.5">
              <Terminal class="w-3.5 h-3.5 text-gold" />
              <span class="text-white/90">npm install @tertaut/sdk</span>
            </div>
            <span
              class="text-[10px] text-white/50 group-hover:text-gold font-sans font-medium transition"
            >
              {{ copiedSdk ? "Tersalin!" : "Salin" }}
            </span>
          </div>
          <div
            class="mt-2 text-[11px] text-jetblack/50 flex items-center justify-center gap-2 font-mono"
          >
            <span>v0.2.0 Live di NPM</span>
            <span>•</span>
            <span>Ukuran &lt; 15 KB</span>
            <span>•</span>
            <span>TypeScript Ready</span>
          </div>
        </div>

        <!-- Interactive Live Product Showcase Preview -->
        <div class="pt-8 max-w-3xl mx-auto text-left">
          <div
            class="luxury-card rounded-2xl p-4 sm:p-6 border border-jetblack/12 shadow-luxury space-y-4 bg-white"
          >
            <!-- Preview Header Tabs -->
            <div
              class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-jetblack/10"
            >
              <div class="flex items-center gap-2">
                <span class="w-2.5 h-2.5 rounded-full bg-forest animate-pulse"></span>
                <span class="text-xs font-bold uppercase tracking-wider text-jetblack font-mono"
                  >Simulasi Interaktif</span
                >
                <span class="text-xs text-jetblack/30">•</span>
                <span class="text-xs text-jetblack/50">Coba Fitur Utama Tertaut</span>
              </div>

              <!-- Interactive Tabs -->
              <div
                class="flex items-center rounded-lg bg-jetblack/5 p-0.5 text-xs font-semibold overflow-x-auto"
              >
                <button
                  @click="activeDemoTab = 'checkout'"
                  :class="[
                    'px-2.5 py-1 rounded-md transition cursor-pointer text-xs whitespace-nowrap',
                    activeDemoTab === 'checkout'
                      ? 'bg-white font-bold text-jetblack shadow-xs'
                      : 'text-jetblack/60 hover:text-jetblack',
                  ]"
                >
                  💳 MoR Checkout
                </button>
                <button
                  @click="activeDemoTab = 'license'"
                  :class="[
                    'px-2.5 py-1 rounded-md transition cursor-pointer text-xs whitespace-nowrap',
                    activeDemoTab === 'license'
                      ? 'bg-white font-bold text-jetblack shadow-xs'
                      : 'text-jetblack/60 hover:text-jetblack',
                  ]"
                >
                  🔑 Lisensi Ed25519
                </button>
                <button
                  @click="activeDemoTab = 'ai'"
                  :class="[
                    'px-2.5 py-1 rounded-md transition cursor-pointer text-xs whitespace-nowrap',
                    activeDemoTab === 'ai'
                      ? 'bg-white font-bold text-jetblack shadow-xs'
                      : 'text-jetblack/60 hover:text-jetblack',
                  ]"
                >
                  🤖 AI Gateway
                </button>
                <button
                  @click="activeDemoTab = 'badge'"
                  :class="[
                    'px-2.5 py-1 rounded-md transition cursor-pointer text-xs whitespace-nowrap',
                    activeDemoTab === 'badge'
                      ? 'bg-white font-bold text-jetblack shadow-xs'
                      : 'text-jetblack/60 hover:text-jetblack',
                  ]"
                >
                  ✨ Trust Badge
                </button>
              </div>
            </div>

            <!-- Tab 1: Checkout -->
            <div
              v-if="activeDemoTab === 'checkout'"
              class="grid grid-cols-1 sm:grid-cols-12 gap-5 items-center"
            >
              <div class="sm:col-span-7 space-y-3">
                <div class="flex items-center justify-between">
                  <div class="text-xs font-bold text-jetblack">Pilih Metode Pembayaran:</div>
                  <span
                    class="text-[10px] text-forest font-bold bg-forest/10 px-2 py-0.5 rounded-full"
                    >Konfirmasi Otomatis</span
                  >
                </div>
                <div class="grid grid-cols-3 gap-2">
                  <button
                    v-for="ch in ['QRIS Instan', 'BCA / Mandiri VA', 'GoPay / OVO']"
                    :key="ch"
                    @click="selectedDemoChannel = ch"
                    :class="[
                      'p-2.5 rounded-xl border text-center transition cursor-pointer text-[11px] font-bold',
                      selectedDemoChannel === ch
                        ? 'border-jetblack bg-jetblack text-white shadow-xs'
                        : 'border-jetblack/15 bg-white text-jetblack hover:border-jetblack/30',
                    ]"
                  >
                    {{ ch }}
                  </button>
                </div>
                <div
                  class="p-3 rounded-xl bg-[#FAFAFA] border border-jetblack/10 text-xs space-y-1.5"
                >
                  <div class="flex justify-between">
                    <span class="text-jetblack/60">Harga Lisensi Software:</span>
                    <span class="font-mono font-bold text-jetblack">Rp 100.000</span>
                  </div>
                  <div class="flex justify-between text-crimson">
                    <span>Merchant of Record Fee (5% flat):</span>
                    <span class="font-mono">-Rp 5.000</span>
                  </div>
                  <div class="pt-1.5 border-t border-jetblack/10 flex justify-between font-bold">
                    <span class="text-forest">Uang Bersih Builder (95%):</span>
                    <span class="font-mono text-sm text-forest">Rp 95.000</span>
                  </div>
                </div>
              </div>

              <div
                class="sm:col-span-5 p-4 rounded-xl bg-jetblack text-white space-y-2.5 shadow-xs"
              >
                <div class="flex items-center gap-1.5 text-xs font-bold text-gold">
                  <CheckCircle2 class="w-4 h-4 shrink-0" />
                  <span>Tanpa Izin Perusahaan</span>
                </div>
                <p class="text-[11px] text-white/75 leading-relaxed">
                  Tidak perlu mendaftar PT/CV atau KYC Payment Gateway yang rumit. Uang masuk via
                  MoR dan dicairkan 95% langsung ke rekening Anda.
                </p>
                <router-link
                  to="/pay/fastmail-ai"
                  class="inline-flex items-center gap-1 text-xs font-bold text-gold hover:underline pt-1"
                >
                  <span>Buka Halaman Checkout Penuh</span>
                  <ExternalLink class="w-3.5 h-3.5" />
                </router-link>
              </div>
            </div>

            <!-- Tab 2: Licensing -->
            <div
              v-else-if="activeDemoTab === 'license'"
              class="grid grid-cols-1 sm:grid-cols-12 gap-5 items-center"
            >
              <div class="sm:col-span-7 space-y-3">
                <div class="p-3 rounded-xl bg-[#FAFAFA] border border-jetblack/10 space-y-2">
                  <div class="flex items-center justify-between text-xs">
                    <span class="font-mono text-jetblack/70">Kunci: TT-PRO-9821-4412</span>
                    <span
                      class="px-2 py-0.5 rounded-full bg-forest/10 text-forest font-bold text-[10px]"
                      >STATUS: VALID</span
                    >
                  </div>
                  <div class="grid grid-cols-2 gap-2 text-[11px]">
                    <div class="p-2 rounded-lg bg-white border border-jetblack/5">
                      <div class="text-jetblack/50 text-[10px]">Device Seats</div>
                      <div class="font-bold text-jetblack">1 / 3 Laptop Aktif</div>
                    </div>
                    <div class="p-2 rounded-lg bg-white border border-jetblack/5">
                      <div class="text-jetblack/50 text-[10px]">Grace Period Offline</div>
                      <div class="font-bold text-forest">30 Hari Sisa</div>
                    </div>
                  </div>
                </div>
                <div class="text-[11px] text-jetblack/60 flex items-center gap-1.5 font-mono">
                  <Lock class="w-3 h-3 text-gold" />
                  <span>Kriptografi Ed25519 &amp; Hardware Fingerprint Binding</span>
                </div>
              </div>

              <div
                class="sm:col-span-5 p-4 rounded-xl bg-jetblack text-white space-y-2.5 shadow-xs"
              >
                <div class="flex items-center gap-1.5 text-xs font-bold text-gold">
                  <ShieldCheck class="w-4 h-4 shrink-0" />
                  <span>Anti-Pembajakan Klien</span>
                </div>
                <p class="text-[11px] text-white/75 leading-relaxed">
                  Cegah duplikasi software Anda. Lisensi dikunci ke hardware ID pengguna dan bisa
                  tetap berjalan offline saat di pesawat atau tanpa internet.
                </p>
                <router-link
                  to="/dashboard/docs"
                  class="inline-flex items-center gap-1 text-xs font-bold text-gold hover:underline pt-1"
                >
                  <span>Lihat Kode Integrasi SDK</span>
                  <ExternalLink class="w-3.5 h-3.5" />
                </router-link>
              </div>
            </div>

            <!-- Tab 3: AI Gateway -->
            <div
              v-else-if="activeDemoTab === 'ai'"
              class="grid grid-cols-1 sm:grid-cols-12 gap-5 items-center"
            >
              <div class="sm:col-span-7 space-y-3">
                <div
                  class="p-3 rounded-xl bg-[#FAFAFA] border border-jetblack/10 font-mono text-xs space-y-2"
                >
                  <div class="flex items-center justify-between text-[11px]">
                    <span class="text-jetblack/60">POST /api/v1/ai/chat/stream</span>
                    <span class="text-forest font-bold">200 OK</span>
                  </div>
                  <div
                    class="p-2.5 rounded-lg bg-white border border-jetblack/10 text-[11px] text-jetblack/80 space-y-1 font-sans"
                  >
                    <div class="font-bold text-jetblack text-xs">Proteksi API Terpasang:</div>
                    <div class="text-forest text-[11px]">✓ Kunci OpenAI tersembunyi di server</div>
                    <div class="text-forest text-[11px]">✓ Batas 15 permintaan per menit</div>
                    <div class="text-forest text-[11px]">
                      ✓ Kuota harian 50.000 token per lisensi
                    </div>
                  </div>
                </div>
              </div>

              <div
                class="sm:col-span-5 p-4 rounded-xl bg-jetblack text-white space-y-2.5 shadow-xs"
              >
                <div class="flex items-center gap-1.5 text-xs font-bold text-gold">
                  <Bot class="w-4 h-4 shrink-0" />
                  <span>Cegah Tagihan Boncos</span>
                </div>
                <p class="text-[11px] text-white/75 leading-relaxed">
                  Jual software berbasis AI tanpa takut pengguna mengekstrak API key OpenAI Anda
                  dari file binari atau browser.
                </p>
                <router-link
                  to="/dashboard/ai-proxy"
                  class="inline-flex items-center gap-1 text-xs font-bold text-gold hover:underline pt-1"
                >
                  <span>Pelajari AI Shield</span>
                  <ExternalLink class="w-3.5 h-3.5" />
                </router-link>
              </div>
            </div>

            <!-- Tab 4: Badge -->
            <div v-else class="grid grid-cols-1 sm:grid-cols-12 gap-5 items-center">
              <div class="sm:col-span-7 space-y-3">
                <div class="text-xs font-bold text-jetblack">
                  Pilih Gaya Badge untuk Website Anda:
                </div>
                <div class="flex flex-wrap gap-2">
                  <button
                    v-for="bt in ['verified', 'sales_counter', 'status']"
                    :key="bt"
                    @click="selectedDemoBadge = bt"
                    :class="[
                      'px-2.5 py-1 rounded-lg border text-xs font-bold capitalize transition cursor-pointer',
                      selectedDemoBadge === bt
                        ? 'border-jetblack bg-jetblack text-white'
                        : 'border-jetblack/15 bg-white text-jetblack hover:bg-jetblack/5',
                    ]"
                  >
                    {{ bt.replace("_", " ") }}
                  </button>
                </div>
                <div
                  class="p-4 rounded-xl bg-[#FAFAFA] border border-jetblack/10 flex items-center justify-center min-h-[70px]"
                >
                  <img :src="`/badge/fastmail-ai.svg`" alt="Badge Preview" class="h-6 shadow-xs" />
                </div>
              </div>

              <div
                class="sm:col-span-5 p-4 rounded-xl bg-jetblack text-white space-y-2.5 shadow-xs"
              >
                <div class="flex items-center gap-1.5 text-xs font-bold text-gold">
                  <Sparkles class="w-4 h-4 shrink-0" />
                  <span>Tingkatkan Konversi</span>
                </div>
                <p class="text-[11px] text-white/75 leading-relaxed">
                  Pasang tag <code>&lt;tertaut-badge&gt;</code> di website produk Anda. Buktikan
                  kepada calon pembeli bahwa produk Anda aktif, terverifikasi, dan bergaransi resmi.
                </p>
                <router-link
                  to="/dashboard/docs"
                  class="inline-flex items-center gap-1 text-xs font-bold text-gold hover:underline pt-1"
                >
                  <span>Cara Pasang Widget</span>
                  <ExternalLink class="w-3.5 h-3.5" />
                </router-link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Trust Metrics Bar -->
    <section class="border-b border-jetblack/10 bg-white py-6">
      <div class="max-w-7xl mx-auto px-4 sm:px-6">
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center divide-x divide-jetblack/10">
          <div class="space-y-0.5">
            <div class="text-xl sm:text-2xl font-black text-jetblack font-mono">0%</div>
            <div class="text-[11px] font-semibold text-jetblack/60">Biaya Langganan Bulanan</div>
          </div>
          <div class="space-y-0.5">
            <div class="text-xl sm:text-2xl font-black text-forest font-mono">5%</div>
            <div class="text-[11px] font-semibold text-jetblack/60">
              Flat Fee per Transaksi Sukses
            </div>
          </div>
          <div class="space-y-0.5">
            <div class="text-xl sm:text-2xl font-black text-jetblack font-mono">&lt; 15 KB</div>
            <div class="text-[11px] font-semibold text-jetblack/60">Ukuran SDK Zero-Dependency</div>
          </div>
          <div class="space-y-0.5">
            <div class="text-xl sm:text-2xl font-black text-gold font-mono">30 Hari</div>
            <div class="text-[11px] font-semibold text-jetblack/60">
              Grace Period Offline Kriptografis
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Problem vs Solution Section -->
    <section id="cara-kerja" class="py-16 md:py-24 max-w-7xl mx-auto px-4 sm:px-6 space-y-12">
      <div class="text-center space-y-3 max-w-2xl mx-auto">
        <h2 class="text-xs font-bold uppercase tracking-widest text-forest font-mono">
          Kenapa Butuh Merchant of Record?
        </h2>
        <h3 class="text-2xl sm:text-3xl font-extrabold text-jetblack tracking-tight">
          Menjual Software di Indonesia Seharusnya Tidak Sesulit Ini
        </h3>
        <p class="text-xs sm:text-sm text-jetblack/65">
          Lihat perbedaan antara cara tradisional yang melelahkan dengan alur modern bersama
          Tertaut.
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
              <p class="text-xs text-forest/70">
                Mulai berjualan hari ini, fokus hanya pada coding
              </p>
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

    <!-- 4 Core Product Pillars -->
    <section id="solusi" class="py-16 md:py-24 bg-[#FAFAFA] border-y border-jetblack/10">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 space-y-12">
        <div class="text-center space-y-3 max-w-2xl mx-auto">
          <h2 class="text-xs font-bold uppercase tracking-widest text-gold font-mono">
            Solusi Menyeluruh
          </h2>
          <h3 class="text-2xl sm:text-3xl font-extrabold text-jetblack tracking-tight">
            Semua yang Dibutuhkan untuk Monetisasi Software
          </h3>
          <p class="text-xs sm:text-sm text-jetblack/65">
            Empat pilar terpadu yang dirancang khusus untuk kebutuhan bisnis developer, indie maker,
            dan tim software.
          </p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <!-- Pilar 1 -->
          <div
            class="luxury-card rounded-2xl p-6 space-y-4 border border-jetblack/10 hover:border-jetblack/30 transition group flex flex-col justify-between"
          >
            <div class="space-y-4">
              <div
                class="w-10 h-10 rounded-xl bg-jetblack/5 flex items-center justify-center text-jetblack group-hover:bg-jetblack group-hover:text-white transition"
              >
                <CreditCard class="w-5 h-5 text-forest" />
              </div>
              <div class="space-y-2">
                <span
                  class="text-[10px] font-bold uppercase tracking-wider text-jetblack/50 font-mono"
                  >Pilar 01</span
                >
                <h4 class="text-base font-bold text-jetblack">Merchant of Record &amp; Checkout</h4>
                <p class="text-xs text-jetblack/65 leading-relaxed">
                  Terima QRIS semua e-wallet &amp; Virtual Account bank. Dilengkapi e-receipt resmi,
                  faktur PPN, dukungan kupon diskon, dan proteksi anti-fraud.
                </p>
              </div>
            </div>
            <div
              class="pt-3 border-t border-jetblack/5 flex items-center justify-between text-xs font-semibold"
            >
              <router-link
                to="/pay/fastmail-ai"
                class="text-forest hover:underline flex items-center gap-1"
              >
                <span>Coba Demo Pay</span>
                <ChevronRight class="w-3.5 h-3.5" />
              </router-link>
              <span class="text-[10px] font-mono text-forest bg-forest/10 px-2 py-0.5 rounded"
                >QRIS + VA</span
              >
            </div>
          </div>

          <!-- Pilar 2 -->
          <div
            class="luxury-card rounded-2xl p-6 space-y-4 border border-jetblack/10 hover:border-jetblack/30 transition group flex flex-col justify-between"
          >
            <div class="space-y-4">
              <div
                class="w-10 h-10 rounded-xl bg-jetblack/5 flex items-center justify-center text-jetblack group-hover:bg-jetblack group-hover:text-white transition"
              >
                <KeyRound class="w-5 h-5 text-gold" />
              </div>
              <div class="space-y-2">
                <span
                  class="text-[10px] font-bold uppercase tracking-wider text-jetblack/50 font-mono"
                  >Pilar 02</span
                >
                <h4 class="text-base font-bold text-jetblack">
                  Universal Licensing &amp; Seat Control
                </h4>
                <p class="text-xs text-jetblack/65 leading-relaxed">
                  DRM untuk Tauri, Electron, Web &amp; CLI. Penguncian device hardware, offline
                  token Ed25519 (hingga 30 hari), dan floating seat lease untuk lisensi tim.
                </p>
              </div>
            </div>
            <div
              class="pt-3 border-t border-jetblack/5 flex items-center justify-between text-xs font-semibold"
            >
              <router-link
                to="/dashboard/docs"
                class="text-forest hover:underline flex items-center gap-1"
              >
                <span>Pelajari DRM</span>
                <ChevronRight class="w-3.5 h-3.5" />
              </router-link>
              <span class="text-[10px] font-mono text-forest bg-forest/10 px-2 py-0.5 rounded"
                >Ed25519 DRM</span
              >
            </div>
          </div>

          <!-- Pilar 3 -->
          <div
            class="luxury-card rounded-2xl p-6 space-y-4 border border-jetblack/10 hover:border-jetblack/30 transition group flex flex-col justify-between"
          >
            <div class="space-y-4">
              <div
                class="w-10 h-10 rounded-xl bg-jetblack/5 flex items-center justify-center text-jetblack group-hover:bg-jetblack group-hover:text-white transition"
              >
                <Bot class="w-5 h-5 text-forest" />
              </div>
              <div class="space-y-2">
                <span
                  class="text-[10px] font-bold uppercase tracking-wider text-jetblack/50 font-mono"
                  >Pilar 03</span
                >
                <h4 class="text-base font-bold text-jetblack">AI Proxy Shield &amp; Metering</h4>
                <p class="text-xs text-jetblack/65 leading-relaxed">
                  Gateway aman ke OpenAI, Claude &amp; Gemini. Enkripsi AES-256 di data store, rate
                  limit 15 req/menit, daily token cap, dan Zero Prompt Retention.
                </p>
              </div>
            </div>
            <div
              class="pt-3 border-t border-jetblack/5 flex items-center justify-between text-xs font-semibold"
            >
              <router-link
                to="/dashboard/docs"
                class="text-forest hover:underline flex items-center gap-1"
              >
                <span>AI Gateway</span>
                <ChevronRight class="w-3.5 h-3.5" />
              </router-link>
              <span class="text-[10px] font-mono text-forest bg-forest/10 px-2 py-0.5 rounded"
                >Zero Leak</span
              >
            </div>
          </div>

          <!-- Pilar 4 -->
          <div
            class="luxury-card rounded-2xl p-6 space-y-4 border border-jetblack/10 hover:border-jetblack/30 transition group flex flex-col justify-between"
          >
            <div class="space-y-4">
              <div
                class="w-10 h-10 rounded-xl bg-jetblack/5 flex items-center justify-center text-jetblack group-hover:bg-jetblack group-hover:text-white transition"
              >
                <Sparkles class="w-5 h-5 text-gold" />
              </div>
              <div class="space-y-2">
                <span
                  class="text-[10px] font-bold uppercase tracking-wider text-jetblack/50 font-mono"
                  >Pilar 04</span
                >
                <h4 class="text-base font-bold text-jetblack">Launch Kit &amp; Trust Widget</h4>
                <p class="text-xs text-jetblack/65 leading-relaxed">
                  Tingkatkan konversi penjualan hingga 40% dengan web component badge terverifikasi,
                  sales counter, dan sistem kupon diskon terintegrasi.
                </p>
              </div>
            </div>
            <div
              class="pt-3 border-t border-jetblack/5 flex items-center justify-between text-xs font-semibold"
            >
              <router-link
                to="/dashboard/docs"
                class="text-forest hover:underline flex items-center gap-1"
              >
                <span>Widget Badge</span>
                <ChevronRight class="w-3.5 h-3.5" />
              </router-link>
              <span class="text-[10px] font-mono text-forest bg-forest/10 px-2 py-0.5 rounded"
                >Embeddable</span
              >
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Developer SDK Code Showcase -->
    <section id="integrasi-sdk" class="py-16 md:py-24 max-w-7xl mx-auto px-4 sm:px-6 space-y-12">
      <div class="text-center space-y-3 max-w-2xl mx-auto">
        <h2 class="text-xs font-bold uppercase tracking-widest text-forest font-mono">
          Developer First SDK
        </h2>
        <h3 class="text-2xl sm:text-3xl font-extrabold text-jetblack tracking-tight">
          Integrasi Selesai Hanya dalam Hitungan Menit
        </h3>
        <p class="text-xs sm:text-sm text-jetblack/65">
          SDK resmi <code>@tertaut/sdk</code> berbobot kurang dari 15 KB, tanpa external
          dependencies, dan siap dipakai di Node.js, Bun, Browser, Tauri, maupun Electron.
        </p>
      </div>

      <div class="max-w-4xl mx-auto">
        <div
          class="rounded-2xl bg-jetblack text-white border border-white/10 shadow-2xl overflow-hidden"
        >
          <!-- Code Tabs Header -->
          <div
            class="flex flex-wrap items-center justify-between px-4 py-3 border-b border-white/10 bg-[#161616]"
          >
            <div class="flex items-center gap-2 overflow-x-auto">
              <button
                @click="activeCodeTab = 'license'"
                :class="[
                  'px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition cursor-pointer',
                  activeCodeTab === 'license'
                    ? 'bg-white/15 text-white'
                    : 'text-white/60 hover:text-white',
                ]"
              >
                1. Validasi Lisensi
              </button>
              <button
                @click="activeCodeTab = 'aiproxy'"
                :class="[
                  'px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition cursor-pointer',
                  activeCodeTab === 'aiproxy'
                    ? 'bg-white/15 text-white'
                    : 'text-white/60 hover:text-white',
                ]"
              >
                2. Panggil AI Gateway
              </button>
              <button
                @click="activeCodeTab = 'checkout'"
                :class="[
                  'px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition cursor-pointer',
                  activeCodeTab === 'checkout'
                    ? 'bg-white/15 text-white'
                    : 'text-white/60 hover:text-white',
                ]"
              >
                3. Buka Sesi Checkout
              </button>
              <button
                @click="activeCodeTab = 'metering'"
                :class="[
                  'px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition cursor-pointer',
                  activeCodeTab === 'metering'
                    ? 'bg-white/15 text-white'
                    : 'text-white/60 hover:text-white',
                ]"
              >
                4. Metered Billing
              </button>
            </div>

            <button
              @click="copyActiveCode"
              class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 text-white text-xs font-mono hover:bg-white/20 transition cursor-pointer"
            >
              <Check v-if="copiedCode" class="w-3.5 h-3.5 text-forest" />
              <Copy v-else class="w-3.5 h-3.5 text-gold" />
              <span>{{ copiedCode ? "Tersalin!" : "Salin Kode" }}</span>
            </button>
          </div>

          <!-- Code Display -->
          <div
            class="p-5 sm:p-6 overflow-x-auto font-mono text-xs text-white/90 leading-relaxed bg-[#0F0F0F]"
          >
            <pre><code>{{ codeSnippets[activeCodeTab] }}</code></pre>
          </div>

          <!-- Code Footer Bar -->
          <div
            class="px-5 py-3 border-t border-white/10 bg-[#141414] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
          >
            <div class="flex items-center gap-2 text-white/60 font-mono text-[11px]">
              <span class="w-2 h-2 rounded-full bg-forest"></span>
              <span>npm install @tertaut/sdk</span>
              <span>•</span>
              <span>Full TypeScript Definition (.d.ts) included</span>
            </div>
            <router-link
              to="/dashboard/docs"
              class="text-gold font-bold hover:underline inline-flex items-center gap-1"
            >
              <span>Buka Dokumentasi API Penuh</span>
              <ExternalLink class="w-3.5 h-3.5" />
            </router-link>
          </div>
        </div>
      </div>
    </section>

    <!-- Revenue & Payout Calculator -->
    <section id="kalkulator" class="py-16 md:py-24 bg-[#FAFAFA] border-y border-jetblack/10">
      <div class="max-w-5xl mx-auto px-4 sm:px-6 space-y-12">
        <div class="text-center space-y-3 max-w-2xl mx-auto">
          <h2 class="text-xs font-bold uppercase tracking-widest text-forest font-mono">
            Transparansi Finansial
          </h2>
          <h3 class="text-2xl sm:text-3xl font-extrabold text-jetblack tracking-tight">
            Kalkulator Pendapatan Bersih Anda
          </h3>
          <p class="text-xs sm:text-sm text-jetblack/65">
            Tanpa biaya setup. Tanpa biaya langganan bulanan. Anda hanya membayar flat 5% jika
            berhasil menjual.
          </p>
        </div>

        <div
          class="luxury-card rounded-2xl p-6 sm:p-10 border border-jetblack/12 shadow-luxury bg-white"
        >
          <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <!-- Inputs -->
            <div class="lg:col-span-7 space-y-6">
              <!-- Slider 1: Product Price -->
              <div class="space-y-2">
                <div class="flex justify-between items-center text-xs font-bold text-jetblack">
                  <span>Harga Produk Anda:</span>
                  <span class="font-mono text-sm text-forest font-black">{{
                    formatIDR(calcProductPrice)
                  }}</span>
                </div>
                <input
                  type="range"
                  v-model.number="calcProductPrice"
                  min="25000"
                  max="1000000"
                  step="25000"
                  class="w-full accent-forest cursor-pointer"
                />
                <div class="flex justify-between text-[10px] text-jetblack/40 font-mono">
                  <span>Rp 25.000</span>
                  <span>Rp 500.000</span>
                  <span>Rp 1.000.000</span>
                </div>
              </div>

              <!-- Slider 2: Estimated Sales -->
              <div class="space-y-2">
                <div class="flex justify-between items-center text-xs font-bold text-jetblack">
                  <span>Estimasi Penjualan per Bulan:</span>
                  <span class="font-mono text-sm text-forest font-black"
                    >{{ calcSalesCount }} Pembeli</span
                  >
                </div>
                <input
                  type="range"
                  v-model.number="calcSalesCount"
                  min="5"
                  max="200"
                  step="5"
                  class="w-full accent-forest cursor-pointer"
                />
                <div class="flex justify-between text-[10px] text-jetblack/40 font-mono">
                  <span>5 lisensi</span>
                  <span>100 lisensi</span>
                  <span>200 lisensi</span>
                </div>
              </div>

              <div
                class="p-4 rounded-xl bg-forest/5 border border-forest/20 text-xs text-forest space-y-1"
              >
                <div class="font-bold flex items-center gap-1.5">
                  <CheckCircle2 class="w-4 h-4 shrink-0" />
                  <span>Termasuk Seluruh Urusan Pajak &amp; Perizinan</span>
                </div>
                <p class="text-[11px] text-forest/80 leading-relaxed">
                  Tertaut menerbitkan invoice resmi dengan rincian PPN 11% dan mencatatkan bukti
                  potong. Anda tidak perlu menyewa akuntan atau mendirikan PT.
                </p>
              </div>
            </div>

            <!-- Breakdown Output -->
            <div class="lg:col-span-5 p-6 rounded-2xl bg-jetblack text-white space-y-5 shadow-xl">
              <div class="text-xs font-bold text-gold uppercase tracking-wider font-mono">
                Ringkasan Pencairan
              </div>

              <div class="space-y-3 text-xs border-b border-white/10 pb-4">
                <div class="flex justify-between text-white/70">
                  <span>Omzet Kotor (Gross):</span>
                  <span class="font-mono text-white font-bold">{{
                    formatIDR(calcGrossRevenue)
                  }}</span>
                </div>
                <div class="flex justify-between text-crimson">
                  <span>Platform Fee (5%):</span>
                  <span class="font-mono font-bold">-{{ formatIDR(calcPlatformFee) }}</span>
                </div>
                <div class="flex justify-between text-white/50 text-[11px]">
                  <span>Biaya Bulanan Tertaut:</span>
                  <span class="font-mono text-forest font-bold">Rp 0 (Gratis)</span>
                </div>
              </div>

              <div class="space-y-1">
                <div class="text-[11px] text-white/60">Uang Bersih yang Anda Terima (95%):</div>
                <div class="text-2xl sm:text-3xl font-black text-forest font-mono">
                  {{ formatIDR(calcNetPayout) }}
                </div>
                <div class="text-[10px] text-white/40 pt-1">
                  Langsung dicairkan ke rekening bank lokal Anda.
                </div>
              </div>

              <router-link
                to="/login"
                class="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl bg-white text-jetblack text-xs font-bold hover:bg-[#F2F2F2] transition active:scale-95 shadow-md"
              >
                <span>Mulai Jual Sekarang</span>
                <ArrowRight class="w-3.5 h-3.5 text-forest" />
              </router-link>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- FAQ Accordion Section -->
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

    <!-- Final High-Impact CTA Banner -->
    <section class="py-16 md:py-20 bg-jetblack text-white relative overflow-hidden">
      <!-- Glow decoration -->
      <div
        class="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-forest/20 blur-3xl pointer-events-none"
      ></div>
      <div
        class="absolute -bottom-24 -left-24 w-96 h-96 rounded-full bg-gold/15 blur-3xl pointer-events-none"
      ></div>

      <div class="max-w-4xl mx-auto px-4 sm:px-6 text-center space-y-6 relative z-10">
        <div
          class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-gold text-xs font-bold font-mono"
        >
          <Sparkles class="w-3.5 h-3.5" />
          <span>MULAI DALAM 2 MENIT</span>
        </div>

        <h2 class="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight leading-tight">
          Siap Menghasilkan Uang dari Karya Software Anda?
        </h2>

        <p class="max-w-xl mx-auto text-xs sm:text-sm md:text-base text-white/70 leading-relaxed">
          Tinggalkan kerumitan mendirikan PT, mengurus izin payment gateway, dan membuat sistem
          lisensi sendiri. Mulai terima pembayaran QRIS dan Virtual Account pertama Anda hari ini.
        </p>

        <div class="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
          <router-link
            to="/login"
            class="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl bg-white text-jetblack text-sm font-bold shadow-lg hover:bg-[#F2F2F2] transition active:scale-95"
          >
            <span>Daftar Gratis Sekarang</span>
            <ArrowRight class="w-4 h-4 text-forest" />
          </router-link>

          <router-link
            to="/pay/fastmail-ai"
            class="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl border border-white/20 text-white text-xs font-bold hover:bg-white/10 transition"
          >
            <QrCode class="w-4 h-4 text-gold" />
            <span>Coba Alur Checkout Pembeli</span>
          </router-link>
        </div>

        <div class="text-[11px] text-white/40 pt-2 font-mono">
          Tanpa kartu kredit • Tanpa kontrak mengikat • Batal kapan saja
        </div>
      </div>
    </section>

    <!-- Public Footer -->
    <footer class="mt-auto border-t border-jetblack/10 bg-white py-12">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 space-y-8">
        <div class="grid grid-cols-1 md:grid-cols-4 gap-8">
          <!-- Column 1: Brand & Bio -->
          <div class="space-y-3 md:col-span-1">
            <div class="flex items-center gap-2">
              <img src="/logo.svg" alt="tertaut.com" class="w-7 h-7 rounded-md shadow-xs" />
              <span class="font-extrabold text-jetblack font-mono text-sm"
                >tertaut<span class="text-gold">.com</span></span
              >
            </div>
            <p class="text-xs text-jetblack/60 leading-relaxed">
              Platform Merchant of Record (MoR), proteksi lisensi kriptografis, dan monetisasi
              software nomor 1 untuk software builder Indonesia.
            </p>
            <div class="flex items-center gap-2 font-mono text-[11px] text-forest pt-1">
              <span class="w-2 h-2 rounded-full bg-forest animate-pulse"></span>
              <span>Platform Operasional &amp; Aktif</span>
            </div>
          </div>

          <!-- Column 2: Solusi Produk -->
          <div class="space-y-2.5">
            <div class="text-xs font-bold text-jetblack uppercase tracking-wider font-mono">
              Solusi Produk
            </div>
            <ul class="space-y-2 text-xs text-jetblack/70">
              <li>
                <a href="#solusi" class="hover:text-jetblack transition"
                  >Merchant of Record (MoR)</a
                >
              </li>
              <li>
                <a href="#solusi" class="hover:text-jetblack transition"
                  >Universal Licensing Ed25519</a
                >
              </li>
              <li>
                <a href="#solusi" class="hover:text-jetblack transition"
                  >AI Gateway &amp; Proxy Shield</a
                >
              </li>
              <li>
                <a href="#solusi" class="hover:text-jetblack transition"
                  >Web Component Trust Badge</a
                >
              </li>
            </ul>
          </div>

          <!-- Column 3: Developer & Integrasi -->
          <div class="space-y-2.5">
            <div class="text-xs font-bold text-jetblack uppercase tracking-wider font-mono">
              Developer
            </div>
            <ul class="space-y-2 text-xs text-jetblack/70">
              <li>
                <router-link to="/dashboard/docs" class="hover:text-jetblack transition"
                  >Dokumentasi SDK</router-link
                >
              </li>
              <li>
                <a
                  href="https://www.npmjs.com/package/@tertaut/sdk"
                  target="_blank"
                  class="hover:text-jetblack transition inline-flex items-center gap-1"
                >
                  <span>NPM: @tertaut/sdk</span>
                  <ExternalLink class="w-3 h-3 text-jetblack/40" />
                </a>
              </li>
              <li>
                <router-link to="/pay/fastmail-ai" class="hover:text-jetblack transition"
                  >Demo Checkout Live</router-link
                >
              </li>
              <li>
                <a
                  href="/swagger"
                  target="_blank"
                  class="hover:text-jetblack transition inline-flex items-center gap-1"
                >
                  <span>Swagger OpenAPI</span>
                  <ExternalLink class="w-3 h-3 text-jetblack/40" />
                </a>
              </li>
            </ul>
          </div>

          <!-- Column 4: Akun & Platform -->
          <div class="space-y-2.5">
            <div class="text-xs font-bold text-jetblack uppercase tracking-wider font-mono">
              Platform
            </div>
            <ul class="space-y-2 text-xs text-jetblack/70">
              <li>
                <router-link to="/dashboard" class="hover:text-jetblack transition"
                  >Dashboard Builder</router-link
                >
              </li>
              <li>
                <router-link to="/panel" class="hover:text-jetblack transition"
                  >Admin Panel</router-link
                >
              </li>
              <li>
                <a href="#kalkulator" class="hover:text-jetblack transition">Kalkulator Biaya</a>
              </li>
              <li>
                <a href="#faq" class="hover:text-jetblack transition">Bantuan &amp; FAQ</a>
              </li>
            </ul>
          </div>
        </div>

        <div
          class="pt-6 border-t border-jetblack/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-jetblack/50"
        >
          <div>&copy; {{ new Date().getFullYear() }} Tertaut. Seluruh hak cipta dilindungi.</div>
          <div class="flex items-center gap-4">
            <span class="hover:text-jetblack transition">Syarat &amp; Ketentuan</span>
            <span>•</span>
            <span class="hover:text-jetblack transition">Kebijakan Privasi</span>
            <span>•</span>
            <span class="hover:text-jetblack transition">Keamanan</span>
          </div>
        </div>
      </div>
    </footer>
  </div>
</template>
