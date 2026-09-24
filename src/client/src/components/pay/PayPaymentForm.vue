<script setup lang="ts">
import { computed, ref } from "vue";
import {
  QrCode,
  Building,
  Wallet,
  CreditCard,
  Store,
  Lock,
  ArrowRight,
  CheckCircle2,
  Copy,
  Check,
  RotateCcw,
  Clock,
  ShieldCheck,
  ExternalLink,
  FlaskConical,
} from "lucide-vue-next";
import { formatRupiah } from "../../lib/utils";
import { api } from "../../lib/api";
import { SUPPORTED_BANKS as BANKS, SUPPORTED_EWALLETS, SUPPORTED_RETAILS } from "../../constants";

interface ProductData {
  id: string;
  name: string;
  slug: string;
  mode: "sandbox" | "live";
  targetPrice: number;
}

const props = defineProps<{
  product: ProductData;
  emailInput: string;
  selectedPaymentRail: "qris" | "va" | "ewallet" | "card" | "retail";
  selectedBank?: string;
  selectedEwallet?: string;
  selectedRetail?: string;
  payableAmount: number;
  isSubmitting: boolean;
  errorMessage: string;
  activeOrder?: {
    transactionId: string;
    scenario?: string;
    paymentRail?: string;
    paymentCode?: string;
    qrDataUrl?: string;
    vaBank?: string;
    ewalletChannel?: string;
    retailOutlet?: string;
    cardDetails?: {
      last4?: string;
      brand?: string;
    };
    amount?: number;
    checkoutUrl?: string;
    ticket?: string;
  } | null;
  isPaid?: boolean;
  paidResult?: { licenseKey?: string; message?: string } | null;
}>();

const emit = defineEmits<{
  "update:emailInput": [value: string];
  "update:selectedPaymentRail": [value: "qris" | "va" | "ewallet" | "card" | "retail"];
  "update:selectedBank": [value: string];
  "update:selectedEwallet": [value: string];
  "update:selectedRetail": [value: string];
  pay: [
    payload?: {
      paymentRail: "qris" | "va" | "ewallet" | "card" | "retail";
      vaBank: string;
      ewalletChannel: string;
      retailOutlet: string;
      cardDetails?: {
        cardNumber: string;
        cardExpiry: string;
        cardCvv: string;
        cardHolderName: string;
      };
    },
  ];
  resetOrder: [];
}>();

const currentBank = computed({
  get: () => props.selectedBank || "BCA",
  set: (val: string) => emit("update:selectedBank", val),
});

const currentEwallet = computed({
  get: () => props.selectedEwallet || "DANA",
  set: (val: string) => emit("update:selectedEwallet", val),
});

const currentRetail = computed({
  get: () => props.selectedRetail || "ALFAMART",
  set: (val: string) => emit("update:selectedRetail", val),
});

const cardNumber = ref("");
const cardExpiry = ref("");
const cardCvv = ref("");
const cardHolderName = ref("");

function handleCardNumberInput(e: any) {
  const raw = e.target.value.replace(/\D/g, "").slice(0, 16);
  cardNumber.value = raw.replace(/(.{4})/g, "$1 ").trim();
}

function handleExpiryInput(e: any) {
  const raw = e.target.value.replace(/\D/g, "").slice(0, 4);
  if (raw.length >= 2) {
    cardExpiry.value = `${raw.slice(0, 2)}/${raw.slice(2)}`;
  } else {
    cardExpiry.value = raw;
  }
}

const copiedVa = ref(false);
const copiedLicense = ref(false);

function copyToClipboard(text: string, isLicense = false) {
  if (!text) return;
  navigator.clipboard.writeText(text);
  if (isLicense) {
    copiedLicense.value = true;
    setTimeout(() => {
      copiedLicense.value = false;
    }, 2500);
  } else {
    copiedVa.value = true;
    setTimeout(() => {
      copiedVa.value = false;
    }, 2500);
  }
}

// Sandbox Simulation State & Action
const isSimulating = ref(false);
const simulationError = ref("");
const sandboxOtp = ref("123456");

async function handleSimulatePayment() {
  if (!props.activeOrder?.transactionId) return;
  isSimulating.value = true;
  simulationError.value = "";
  try {
    const res = await api.simulatePaid(props.activeOrder.transactionId, props.activeOrder.ticket);
    if (!res.success) {
      simulationError.value = res.error || "Gagal mensimulasikan pembayaran.";
    }
  } catch (err: any) {
    simulationError.value = err?.message || "Terjadi kesalahan saat simulasi pembayaran.";
  } finally {
    isSimulating.value = false;
  }
}

function onPayClicked() {
  const cardData =
    props.selectedPaymentRail === "card"
      ? {
          cardNumber: cardNumber.value,
          cardExpiry: cardExpiry.value,
          cardCvv: cardCvv.value,
          cardHolderName: cardHolderName.value,
        }
      : undefined;

  emit("pay", {
    paymentRail: props.selectedPaymentRail,
    vaBank: currentBank.value,
    ewalletChannel: currentEwallet.value,
    retailOutlet: currentRetail.value,
    cardDetails: cardData,
  });
}
</script>

<template>
  <div class="flex-1 flex flex-col justify-between">
    <!-- ======================================================== -->
    <!-- 1. PAID SUCCESS STATE (Real-time Confirmed via Webhook)  -->
    <!-- ======================================================== -->
    <div
      v-if="isPaid"
      class="space-y-4 p-4 sm:p-5 rounded-2xl bg-emerald-50/80 border border-emerald-200"
    >
      <div class="flex items-start gap-3">
        <div class="p-2 rounded-xl bg-emerald-500 text-white shadow-xs shrink-0 mt-0.5">
          <CheckCircle2 class="w-5 h-5" />
        </div>
        <div class="space-y-1 w-full">
          <p class="text-xs sm:text-sm font-extrabold text-emerald-950">
            Pembayaran Berhasil Diverifikasi!
          </p>
          <p class="text-xs text-slate-700 leading-relaxed">
            Terima kasih! Pembayaran Anda telah terkonfirmasi resmi. Lisensi software Anda sudah
            aktif.
          </p>
        </div>
      </div>

      <div v-if="paidResult?.licenseKey" class="pt-3 border-t border-emerald-200 space-y-2">
        <div class="flex items-center justify-between">
          <span class="text-xs font-bold text-slate-800">Kunci Lisensi Resmi Anda</span>
          <span class="text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
            <ShieldCheck class="w-3.5 h-3.5" /> Terproteksi Ed25519
          </span>
        </div>
        <div class="relative group">
          <div
            class="p-3 bg-slate-900 rounded-xl border border-slate-700 font-mono font-bold text-emerald-400 text-xs sm:text-sm tracking-wider break-all select-all text-center shadow-inner"
          >
            {{ paidResult?.licenseKey }}
          </div>
          <button
            @click="copyToClipboard(paidResult?.licenseKey || '', true)"
            type="button"
            class="mt-2 w-full py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Check v-if="copiedLicense" class="w-3.5 h-3.5" />
            <Copy v-else class="w-3.5 h-3.5" />
            <span>{{ copiedLicense ? "Kunci Lisensi Tersalin!" : "Salin Kunci Lisensi" }}</span>
          </button>
        </div>
        <p class="text-[11px] text-slate-600 text-center pt-1">
          Kunci lisensi ini juga telah dikirimkan ke email
          <span class="font-bold text-slate-900">{{ emailInput }}</span
          >.
        </p>
      </div>
    </div>

    <!-- ======================================================== -->
    <!-- 2. GAPURA CUSTOM CHECKOUT ACTIVE ORDER (QRIS / VA)       -->
    <!-- ======================================================== -->
    <div v-else-if="activeOrder" class="flex-1 flex flex-col justify-between space-y-6">
      <!-- TOP SECTION: Status, QR / VA details, Sandbox controls -->
      <div class="space-y-4">
        <!-- Status Pulse Header (Clean Divider Line, No Card) -->
        <div class="flex items-center justify-between pb-3 border-b border-slate-200">
          <div class="flex items-center gap-2">
            <span class="relative flex h-2.5 w-2.5">
              <span
                class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"
              ></span>
              <span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span class="text-xs font-bold text-slate-800">Menunggu Pembayaran...</span>
          </div>
          <span class="text-sm font-black text-slate-900 font-mono">
            {{ formatRupiah(activeOrder.amount || payableAmount) }}
          </span>
        </div>

        <!-- A. QRIS VIEW -->
        <div v-if="activeOrder.paymentRail === 'qris'" class="space-y-3 py-1">
          <div class="text-center flex flex-col items-center justify-center">
            <!-- QRIS Badge Header -->
            <div
              class="flex items-center gap-1.5 mb-3 px-3 py-1 rounded-full bg-slate-100 text-slate-800 text-[11px] font-bold"
            >
              <QrCode class="w-3.5 h-3.5 text-gold-hover" />
              <span>QRIS Dinamis Instan</span>
            </div>

            <!-- QR Code Image -->
            <div class="p-2 bg-white rounded-xl border border-slate-200 shadow-xs inline-block">
              <img
                v-if="activeOrder.qrDataUrl"
                :src="activeOrder.qrDataUrl"
                alt="QRIS Code"
                class="w-52 h-52 object-contain mx-auto"
              />
              <div
                v-else
                class="w-52 h-52 flex items-center justify-center bg-slate-100 text-xs font-mono text-slate-500"
              >
                Menyiapkan QR Code...
              </div>
            </div>

            <p class="text-xs font-bold text-slate-900 mt-3">
              Scan dengan Aplikasi Pembayaran Apa Saja
            </p>
            <p class="text-[11px] text-slate-600 mt-1 max-w-xs leading-relaxed">
              Dukung BCA Mobile, Livin' Mandiri, GoPay, DANA, OVO, ShopeePay, LinkAja, & semua
              aplikasi perbankan.
            </p>

            <!-- Sandbox Simulator Button for QRIS -->
            <div v-if="product.mode === 'sandbox'" class="pt-3 w-full max-w-xs">
              <button
                @click="handleSimulatePayment"
                :disabled="isSimulating"
                type="button"
                class="w-full py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 active:scale-95 text-white text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shadow-xs"
              >
                <FlaskConical class="w-4 h-4 text-emerald-400" />
                <span>{{
                  isSimulating ? "Memverifikasi QRIS..." : "Simulasi Scan & Bayar QRIS (Sandbox)"
                }}</span>
              </button>
              <p v-if="simulationError" class="text-[11px] font-bold text-red-600 text-center mt-1">
                {{ simulationError }}
              </p>
            </div>
          </div>
        </div>

        <!-- B. VIRTUAL ACCOUNT VIEW (Flat Layout, No Card Container) -->
        <div v-else-if="activeOrder.paymentRail === 'va'" class="space-y-3.5 py-0.5">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <Building class="w-4 h-4 text-cyan-700" />
              <span class="text-xs font-bold text-slate-900"
                >Virtual Account {{ activeOrder.vaBank || "Bank" }}</span
              >
            </div>
            <span class="text-[11px] font-semibold text-slate-500">Otomatis Terverifikasi</span>
          </div>

          <div class="space-y-1.5">
            <label class="text-[11px] font-bold text-slate-600 uppercase tracking-wider"
              >Nomor Rekening Virtual Account</label
            >
            <div class="flex items-center gap-2">
              <div
                class="flex-1 p-3 bg-slate-100 rounded-xl border border-slate-200 font-mono font-bold text-sm sm:text-base text-slate-900 tracking-wider select-all"
              >
                {{ activeOrder.paymentCode }}
              </div>
              <button
                @click="copyToClipboard(activeOrder.paymentCode || '')"
                type="button"
                class="px-4 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition flex items-center gap-1.5 shrink-0 cursor-pointer shadow-xs active:scale-95"
              >
                <Check v-if="copiedVa" class="w-3.5 h-3.5 text-emerald-400" />
                <Copy v-else class="w-3.5 h-3.5" />
                <span>{{ copiedVa ? "Tersalin" : "Salin" }}</span>
              </button>
            </div>
          </div>

          <!-- Sandbox Simulator Button for VA -->
          <div v-if="product.mode === 'sandbox'" class="pt-1.5">
            <button
              @click="handleSimulatePayment"
              :disabled="isSimulating"
              type="button"
              class="w-full py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 active:scale-95 text-white text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shadow-xs"
            >
              <FlaskConical class="w-4 h-4 text-emerald-400" />
              <span>{{
                isSimulating
                  ? "Memproses Transfer..."
                  : "Simulasi Transfer Virtual Account (Sandbox)"
              }}</span>
            </button>
            <p v-if="simulationError" class="text-[11px] font-bold text-red-600 mt-1">
              {{ simulationError }}
            </p>
          </div>
        </div>

        <!-- C. KARTU KREDIT / DEBIT (3D Secure View) -->
        <div v-else-if="activeOrder.paymentRail === 'card'" class="space-y-3.5 py-1">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <CreditCard class="w-4 h-4 text-blue-600" />
              <span class="text-xs font-bold text-slate-900">Kartu Kredit / Debit</span>
            </div>
            <span class="text-[11px] font-semibold text-emerald-600 flex items-center gap-1">
              <ShieldCheck class="w-3.5 h-3.5" /> 3D-Secure Proteksi Bank
            </span>
          </div>

          <!-- Card Info Banner -->
          <div
            class="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200"
          >
            <div class="flex items-center gap-2">
              <CreditCard class="w-4 h-4 text-slate-700" />
              <span class="text-xs font-mono font-bold text-slate-900">
                {{ activeOrder.cardDetails?.brand || "Kartu" }} ••••
                {{ activeOrder.cardDetails?.last4 || "2151" }}
              </span>
            </div>
            <span
              class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-100 text-emerald-800"
            >
              Valid
            </span>
          </div>

          <!-- Sandbox 3DS OTP Simulator -->
          <div
            v-if="product.mode === 'sandbox'"
            class="p-4 bg-blue-50/80 rounded-xl border border-blue-200 text-xs text-slate-800 space-y-3"
          >
            <div class="flex items-center justify-between">
              <span class="font-bold flex items-center gap-1.5 text-blue-900">
                <ShieldCheck class="w-4 h-4 text-blue-600" />
                Otentikasi 3D-Secure Bank (Sandbox)
              </span>
              <span
                class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-200 text-blue-800"
              >
                OTP Simulator
              </span>
            </div>
            <p class="text-[11px] text-slate-600 leading-relaxed">
              Kode OTP resmi telah disimulasikan oleh bank penerbit. Klik tombol di bawah untuk
              verifikasi instan:
            </p>
            <div class="flex items-center gap-2">
              <div class="relative flex-1">
                <input
                  v-model="sandboxOtp"
                  type="text"
                  maxlength="6"
                  class="w-full h-10 px-3 text-center font-mono font-bold text-sm tracking-widest rounded-lg border border-blue-300 bg-white text-slate-900 focus:outline-none focus:border-blue-600"
                  placeholder="123456"
                />
              </div>
              <button
                @click="handleSimulatePayment"
                :disabled="isSimulating"
                type="button"
                class="h-10 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-bold text-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-xs"
              >
                <CheckCircle2 v-if="!isSimulating" class="w-4 h-4" />
                <span>{{ isSimulating ? "Memverifikasi..." : "Verifikasi OTP Sekarang" }}</span>
              </button>
            </div>
            <p v-if="simulationError" class="text-[11px] font-bold text-red-600">
              {{ simulationError }}
            </p>
          </div>

          <!-- Live 3DS Authentication View -->
          <div
            v-else
            class="p-3 bg-blue-50/60 rounded-xl border border-blue-200 text-xs text-slate-700 space-y-2"
          >
            <p class="font-semibold text-slate-800">
              Transaksi Anda memerlukan otentikasi resmi 3D-Secure dari bank penerbit kartu.
            </p>
            <a
              v-if="activeOrder.checkoutUrl"
              :href="activeOrder.checkoutUrl"
              target="_blank"
              class="w-full py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
            >
              <span>Lanjutkan ke Otentikasi Bank</span>
              <ExternalLink class="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        <!-- D. GERAI RETAIL / MINIMARKET VIEW -->
        <div v-else-if="activeOrder.paymentRail === 'retail'" class="space-y-3.5 py-0.5">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <Store class="w-4 h-4 text-amber-600" />
              <span class="text-xs font-bold text-slate-900">Pembayaran Gerai Retail</span>
            </div>
            <span class="text-[11px] font-semibold text-slate-500">Alfamart / Indomaret</span>
          </div>

          <div class="space-y-1.5">
            <label class="text-[11px] font-bold text-slate-600 uppercase tracking-wider"
              >Kode Pembayaran Kasir</label
            >
            <div class="flex items-center gap-2">
              <div
                class="flex-1 p-3 bg-slate-100 rounded-xl border border-slate-200 font-mono font-bold text-sm sm:text-base text-slate-900 tracking-wider select-all"
              >
                {{ activeOrder.paymentCode || "Tampilkan di Invoice" }}
              </div>
              <button
                v-if="activeOrder.paymentCode"
                @click="copyToClipboard(activeOrder.paymentCode || '')"
                type="button"
                class="px-4 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition flex items-center gap-1.5 shrink-0 cursor-pointer shadow-xs active:scale-95"
              >
                <Check v-if="copiedVa" class="w-3.5 h-3.5 text-emerald-400" />
                <Copy v-else class="w-3.5 h-3.5" />
                <span>{{ copiedVa ? "Tersalin" : "Salin" }}</span>
              </button>
            </div>
          </div>

          <!-- Sandbox Simulator Button for Retail -->
          <div v-if="product.mode === 'sandbox'" class="pt-1.5">
            <button
              @click="handleSimulatePayment"
              :disabled="isSimulating"
              type="button"
              class="w-full py-2.5 px-3 rounded-xl bg-amber-600 hover:bg-amber-500 active:scale-95 text-white text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shadow-xs"
            >
              <FlaskConical class="w-4 h-4 text-white" />
              <span>{{
                isSimulating ? "Memproses Kasir..." : "Simulasi Bayar di Kasir (Sandbox)"
              }}</span>
            </button>
            <p v-if="simulationError" class="text-[11px] font-bold text-red-600 mt-1">
              {{ simulationError }}
            </p>
          </div>
        </div>

        <!-- E. E-WALLET REDIRECT VIEW -->
        <div v-else-if="activeOrder.paymentRail === 'ewallet'" class="space-y-3.5 py-1">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <Wallet class="w-4 h-4 text-emerald-600" />
              <span class="text-xs font-bold text-slate-900">E-Wallet Apps</span>
            </div>
            <span class="text-[11px] font-semibold text-slate-500"
              >GoPay / OVO / DANA / ShopeePay</span
            >
          </div>
          <div
            class="p-3 bg-emerald-50/60 rounded-xl border border-emerald-200 text-xs text-slate-700 space-y-2"
          >
            <p class="font-semibold text-slate-800">
              Selesaikan pembayaran langsung melalui aplikasi e-wallet Anda.
            </p>
            <a
              v-if="activeOrder.checkoutUrl"
              :href="activeOrder.checkoutUrl"
              target="_blank"
              class="w-full py-2.5 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
            >
              <span>Buka Pembayaran E-Wallet</span>
              <ExternalLink class="w-3.5 h-3.5" />
            </a>
          </div>

          <!-- Sandbox Simulator Button for E-Wallet -->
          <div v-if="product.mode === 'sandbox'" class="pt-1.5">
            <button
              @click="handleSimulatePayment"
              :disabled="isSimulating"
              type="button"
              class="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shadow-xs"
            >
              <FlaskConical class="w-4 h-4 text-white" />
              <span>{{
                isSimulating ? "Memproses Pembayaran..." : "Simulasi Bayar E-Wallet (Sandbox)"
              }}</span>
            </button>
            <p v-if="simulationError" class="text-[11px] font-bold text-red-600 mt-1">
              {{ simulationError }}
            </p>
          </div>
        </div>
      </div>

      <!-- BOTTOM SECTION: Petunjuk Pembayaran & Ganti Metode / Berlaku 30 Menit -->
      <div class="pt-4 mt-auto space-y-3">
        <!-- Petunjuk Pembayaran -->
        <div
          v-if="activeOrder.paymentRail === 'va'"
          class="pt-3 border-t border-slate-200 text-[11px] text-slate-600 space-y-1.5"
        >
          <p class="font-bold text-slate-800">Petunjuk Pembayaran:</p>
          <p>1. Buka m-Banking atau ATM {{ activeOrder.vaBank || "Bank Anda" }}</p>
          <p>
            2. Pilih menu
            <span class="font-semibold text-slate-700">Transfer / Bayar > Virtual Account</span>
          </p>
          <p>
            3. Masukkan nomor VA di atas dan konfirmasi nominal tepat
            <span class="font-bold text-slate-900">{{
              formatRupiah(activeOrder.amount || payableAmount)
            }}</span>
          </p>
        </div>

        <div
          v-else-if="activeOrder.paymentRail === 'qris'"
          class="pt-3 border-t border-slate-200 text-[11px] text-slate-600 space-y-1.5"
        >
          <p class="font-bold text-slate-800">Petunjuk Pembayaran:</p>
          <p>1. Buka m-Banking atau e-Wallet pilihan Anda (BCA, Mandiri, GoPay, OVO, DANA, dll.)</p>
          <p>2. Pilih menu <span class="font-semibold text-slate-700">Scan / Bayar QRIS</span></p>
          <p>
            3. Scan QR code di atas dan konfirmasi nominal tepat
            <span class="font-bold text-slate-900">{{
              formatRupiah(activeOrder.amount || payableAmount)
            }}</span>
          </p>
        </div>

        <div
          v-else-if="activeOrder.paymentRail === 'retail'"
          class="pt-3 border-t border-slate-200 text-[11px] text-slate-600 space-y-1.5"
        >
          <p class="font-bold text-slate-800">Petunjuk Pembayaran Kasir:</p>
          <p>1. Kunjungi kasir Alfamart, Alfamidi, Dan+Dan, atau Indomaret terdekat.</p>
          <p>2. Tunjukkan kode pembayaran di atas ke kasir dan sebutkan pembayaran tagihan.</p>
          <p>3. Simpan struk bukti pembayaran yang diberikan kasir.</p>
        </div>

        <!-- Opsi Buka Invoice Eksternal (Xendit) jika tersedia -->
        <div
          v-if="
            activeOrder.checkoutUrl &&
            activeOrder.paymentRail !== 'card' &&
            activeOrder.paymentRail !== 'ewallet'
          "
          class="text-center pt-1"
        >
          <a
            :href="activeOrder.checkoutUrl"
            target="_blank"
            class="text-[11px] font-semibold text-slate-500 hover:text-slate-800 inline-flex items-center gap-1 transition"
          >
            <span>Buka di Halaman Pembayaran Xendit</span>
            <ExternalLink class="w-3 h-3" />
          </a>
        </div>

        <!-- Footer Bar: Ganti Metode / Batal & Berlaku 30 Menit -->
        <div class="pt-3 border-t border-slate-200 flex items-center justify-between text-xs">
          <button
            @click="emit('resetOrder')"
            type="button"
            class="inline-flex items-center gap-1.5 text-slate-600 hover:text-slate-900 font-semibold transition cursor-pointer"
          >
            <RotateCcw class="w-3.5 h-3.5" />
            <span>Ganti Metode / Batal</span>
          </button>
          <span class="text-[11px] text-slate-500 font-medium flex items-center gap-1">
            <Clock class="w-3 h-3 text-slate-400" />
            <span>Berlaku 30 Menit</span>
          </span>
        </div>
      </div>
    </div>

    <!-- ======================================================== -->
    <!-- 3. INITIAL PAYMENT SELECTION FORM                        -->
    <!-- ======================================================== -->
    <div v-else class="space-y-4">
      <!-- Vertical Selectable List Group (Gaya List Daftar) -->
      <div class="space-y-2.5">
        <div class="flex items-center justify-between px-0.5">
          <label class="block text-xs font-bold text-slate-900 uppercase tracking-wider">
            Pilih Jalur Pembayaran Resmi
          </label>
          <span
            class="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200"
          >
            Terverifikasi Otomatis
          </span>
        </div>

        <div class="space-y-2">
          <!-- 1. QRIS Instan -->
          <div
            @click="emit('update:selectedPaymentRail', 'qris')"
            class="rounded-xl border transition-all cursor-pointer overflow-hidden"
            :class="
              selectedPaymentRail === 'qris'
                ? 'border-slate-900 bg-slate-50/70 shadow-xs ring-1 ring-slate-900/10'
                : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/40'
            "
          >
            <!-- Header Row -->
            <div class="p-3 flex items-center justify-between gap-3">
              <div class="flex items-center gap-2.5 min-w-0">
                <!-- Radio indicator -->
                <div
                  class="w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition"
                  :class="
                    selectedPaymentRail === 'qris'
                      ? 'border-slate-900 bg-slate-900'
                      : 'border-slate-300 bg-white'
                  "
                >
                  <div
                    v-if="selectedPaymentRail === 'qris'"
                    class="w-1.5 h-1.5 rounded-full bg-white"
                  ></div>
                </div>

                <!-- Icon Box -->
                <div
                  class="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-200/50"
                >
                  <QrCode class="w-4 h-4" />
                </div>

                <!-- Text -->
                <div class="min-w-0">
                  <div class="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <span>QRIS Instan</span>
                    <span
                      class="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-100 text-amber-800"
                    >
                      Populer
                    </span>
                  </div>
                  <p class="text-[11px] text-slate-500 truncate">
                    BCA, Mandiri, BRI, BNI, GoPay, OVO, DANA, ShopeePay
                  </p>
                </div>
              </div>

              <!-- Right badge -->
              <span class="text-[11px] font-bold text-emerald-600 shrink-0"> Bebas Admin </span>
            </div>

            <!-- Expanded Info (when selected) -->
            <div
              v-if="selectedPaymentRail === 'qris'"
              class="px-3 pb-3 pt-1 border-t border-slate-200/70 text-[11px] text-slate-600 animate-fadeIn flex items-center gap-1.5"
            >
              <CheckCircle2 class="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>Kode QRIS dinamis langsung tampil di layar setelah menekan tombol bayar.</span>
            </div>
          </div>

          <!-- 2. Virtual Account (9 Bank) -->
          <div
            @click="emit('update:selectedPaymentRail', 'va')"
            class="rounded-xl border transition-all cursor-pointer overflow-hidden"
            :class="
              selectedPaymentRail === 'va'
                ? 'border-slate-900 bg-slate-50/70 shadow-xs ring-1 ring-slate-900/10'
                : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/40'
            "
          >
            <!-- Header Row -->
            <div class="p-3 flex items-center justify-between gap-3">
              <div class="flex items-center gap-2.5 min-w-0">
                <!-- Radio indicator -->
                <div
                  class="w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition"
                  :class="
                    selectedPaymentRail === 'va'
                      ? 'border-slate-900 bg-slate-900'
                      : 'border-slate-300 bg-white'
                  "
                >
                  <div
                    v-if="selectedPaymentRail === 'va'"
                    class="w-1.5 h-1.5 rounded-full bg-white"
                  ></div>
                </div>

                <!-- Icon Box -->
                <div
                  class="w-8 h-8 rounded-lg bg-cyan-50 text-cyan-700 flex items-center justify-center shrink-0 border border-cyan-200/50"
                >
                  <Building class="w-4 h-4" />
                </div>

                <!-- Text -->
                <div class="min-w-0">
                  <div class="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <span>Virtual Account</span>
                    <span
                      class="px-1.5 py-0.2 rounded text-[10px] font-bold bg-cyan-100 text-cyan-800"
                    >
                      9 Bank
                    </span>
                  </div>
                  <p class="text-[11px] text-slate-500 truncate">
                    BCA, Mandiri, BNI, BRI, BSI, CIMB, Permata, BJB, Sampoerna
                  </p>
                </div>
              </div>

              <!-- Right badge -->
              <span class="text-[11px] font-bold text-slate-600 shrink-0">
                {{ selectedPaymentRail === "va" ? currentBank : "Pilih Bank" }}
              </span>
            </div>

            <!-- Expanded Bank Selector (when selected) -->
            <div
              v-if="selectedPaymentRail === 'va'"
              class="px-3 pb-3 pt-2.5 border-t border-slate-200/70 space-y-2 animate-fadeIn"
              @click.stop
            >
              <label class="block text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                Pilih Bank Virtual Account
              </label>
              <div class="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
                <button
                  v-for="b in BANKS"
                  :key="b.id"
                  type="button"
                  @click="currentBank = b.id"
                  class="py-2 px-2 rounded-lg border text-xs font-bold transition text-center cursor-pointer flex items-center justify-center gap-1"
                  :class="
                    currentBank === b.id
                      ? 'border-slate-900 bg-slate-900 text-white shadow-xs'
                      : 'border-slate-200 bg-white hover:bg-slate-100 text-slate-700'
                  "
                >
                  <Check v-if="currentBank === b.id" class="w-3 h-3 text-emerald-400 shrink-0" />
                  <span>{{ b.label }}</span>
                </button>
              </div>
            </div>
          </div>

          <!-- 3. E-Wallet (7 Provider) -->
          <div
            @click="emit('update:selectedPaymentRail', 'ewallet')"
            class="rounded-xl border transition-all cursor-pointer overflow-hidden"
            :class="
              selectedPaymentRail === 'ewallet'
                ? 'border-slate-900 bg-slate-50/70 shadow-xs ring-1 ring-slate-900/10'
                : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/40'
            "
          >
            <!-- Header Row -->
            <div class="p-3 flex items-center justify-between gap-3">
              <div class="flex items-center gap-2.5 min-w-0">
                <!-- Radio indicator -->
                <div
                  class="w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition"
                  :class="
                    selectedPaymentRail === 'ewallet'
                      ? 'border-slate-900 bg-slate-900'
                      : 'border-slate-300 bg-white'
                  "
                >
                  <div
                    v-if="selectedPaymentRail === 'ewallet'"
                    class="w-1.5 h-1.5 rounded-full bg-white"
                  ></div>
                </div>

                <!-- Icon Box -->
                <div
                  class="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-200/50"
                >
                  <Wallet class="w-4 h-4" />
                </div>

                <!-- Text -->
                <div class="min-w-0">
                  <div class="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <span>E-Wallet</span>
                    <span
                      class="px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800"
                    >
                      7 Aplikasi
                    </span>
                  </div>
                  <p class="text-[11px] text-slate-500 truncate">
                    DANA, OVO, ShopeePay, GoPay, LinkAja, AstraPay, JeniusPay
                  </p>
                </div>
              </div>

              <!-- Right badge -->
              <span class="text-[11px] font-bold text-slate-600 shrink-0">
                {{ selectedPaymentRail === "ewallet" ? currentEwallet : "Pilih E-Wallet" }}
              </span>
            </div>

            <!-- Expanded E-Wallet Selector (when selected) -->
            <div
              v-if="selectedPaymentRail === 'ewallet'"
              class="px-3 pb-3 pt-2.5 border-t border-slate-200/70 space-y-2 animate-fadeIn"
              @click.stop
            >
              <label class="block text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                Pilih Aplikasi E-Wallet
              </label>
              <div class="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                <button
                  v-for="ew in SUPPORTED_EWALLETS"
                  :key="ew.id"
                  type="button"
                  @click="currentEwallet = ew.id"
                  class="py-2 px-2.5 rounded-lg border text-xs font-bold transition text-center cursor-pointer flex items-center justify-center gap-1"
                  :class="
                    currentEwallet === ew.id
                      ? 'border-slate-900 bg-slate-900 text-white shadow-xs'
                      : 'border-slate-200 bg-white hover:bg-slate-100 text-slate-700'
                  "
                >
                  <Check
                    v-if="currentEwallet === ew.id"
                    class="w-3 h-3 text-emerald-400 shrink-0"
                  />
                  <span>{{ ew.label }}</span>
                </button>
              </div>
            </div>
          </div>

          <!-- 4. Kartu Kredit / Debit -->
          <div
            @click="emit('update:selectedPaymentRail', 'card')"
            class="rounded-xl border transition-all cursor-pointer overflow-hidden"
            :class="
              selectedPaymentRail === 'card'
                ? 'border-slate-900 bg-slate-50/70 shadow-xs ring-1 ring-slate-900/10'
                : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/40'
            "
          >
            <!-- Header Row -->
            <div class="p-3 flex items-center justify-between gap-3">
              <div class="flex items-center gap-2.5 min-w-0">
                <!-- Radio indicator -->
                <div
                  class="w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition"
                  :class="
                    selectedPaymentRail === 'card'
                      ? 'border-slate-900 bg-slate-900'
                      : 'border-slate-300 bg-white'
                  "
                >
                  <div
                    v-if="selectedPaymentRail === 'card'"
                    class="w-1.5 h-1.5 rounded-full bg-white"
                  ></div>
                </div>

                <!-- Icon Box -->
                <div
                  class="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-200/50"
                >
                  <CreditCard class="w-4 h-4" />
                </div>

                <!-- Text -->
                <div class="min-w-0">
                  <div class="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <span>Kartu Kredit / Debit</span>
                    <span
                      class="px-1.5 py-0.2 rounded text-[10px] font-bold bg-blue-100 text-blue-800"
                    >
                      3D Secure
                    </span>
                  </div>
                  <p class="text-[11px] text-slate-500 truncate">
                    Visa, Mastercard, JCB, American Express
                  </p>
                </div>
              </div>

              <!-- Brand Badges -->
              <div
                class="flex items-center gap-1 text-[9px] text-slate-500 font-mono font-bold shrink-0"
              >
                <span class="px-1 py-0.5 rounded bg-slate-100 border border-slate-200">VISA</span>
                <span class="px-1 py-0.5 rounded bg-slate-100 border border-slate-200">MC</span>
                <span class="px-1 py-0.5 rounded bg-slate-100 border border-slate-200">JCB</span>
              </div>
            </div>

            <!-- Expanded Card Form (when selected) -->
            <div
              v-if="selectedPaymentRail === 'card'"
              class="px-3 pb-3 pt-2.5 border-t border-slate-200/70 space-y-2.5 animate-fadeIn"
              @click.stop
            >
              <div class="space-y-2">
                <!-- Card Number -->
                <div class="relative">
                  <input
                    v-model="cardNumber"
                    @input="handleCardNumberInput"
                    type="text"
                    placeholder="5200 0000 0000 2151"
                    maxlength="19"
                    class="w-full h-10 px-3 pl-9 rounded-xl border border-slate-300 bg-white font-mono text-xs font-bold text-slate-900 tracking-wider focus:border-slate-900 focus:outline-hidden"
                  />
                  <CreditCard class="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                </div>

                <div class="grid grid-cols-2 gap-2">
                  <!-- Expiry -->
                  <div>
                    <input
                      v-model="cardExpiry"
                      @input="handleExpiryInput"
                      type="text"
                      placeholder="MM / YY"
                      maxlength="5"
                      class="w-full h-10 px-3 rounded-xl border border-slate-300 bg-white font-mono text-xs font-bold text-slate-900 tracking-wider text-center focus:border-slate-900 focus:outline-hidden"
                    />
                  </div>

                  <!-- CVV -->
                  <div class="relative">
                    <input
                      v-model="cardCvv"
                      type="password"
                      placeholder="CVV / CVC"
                      maxlength="4"
                      class="w-full h-10 px-3 pl-8 rounded-xl border border-slate-300 bg-white font-mono text-xs font-bold text-slate-900 tracking-wider text-center focus:border-slate-900 focus:outline-hidden"
                    />
                    <Lock class="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3.5" />
                  </div>
                </div>

                <!-- Cardholder Name -->
                <input
                  v-model="cardHolderName"
                  type="text"
                  placeholder="Nama di Kartu (sesuai kartu fisik)"
                  class="w-full h-10 px-3 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-900 focus:border-slate-900 focus:outline-hidden"
                />
              </div>
            </div>
          </div>

          <!-- 5. Minimarket / Gerai Retail -->
          <div
            @click="emit('update:selectedPaymentRail', 'retail')"
            class="rounded-xl border transition-all cursor-pointer overflow-hidden"
            :class="
              selectedPaymentRail === 'retail'
                ? 'border-slate-900 bg-slate-50/70 shadow-xs ring-1 ring-slate-900/10'
                : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/40'
            "
          >
            <!-- Header Row -->
            <div class="p-3 flex items-center justify-between gap-3">
              <div class="flex items-center gap-2.5 min-w-0">
                <!-- Radio indicator -->
                <div
                  class="w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition"
                  :class="
                    selectedPaymentRail === 'retail'
                      ? 'border-slate-900 bg-slate-900'
                      : 'border-slate-300 bg-white'
                  "
                >
                  <div
                    v-if="selectedPaymentRail === 'retail'"
                    class="w-1.5 h-1.5 rounded-full bg-white"
                  ></div>
                </div>

                <!-- Icon Box -->
                <div
                  class="w-8 h-8 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center shrink-0 border border-orange-200/50"
                >
                  <Store class="w-4 h-4" />
                </div>

                <!-- Text -->
                <div class="min-w-0">
                  <div class="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <span>Minimarket (Retail)</span>
                    <span
                      class="px-1.5 py-0.2 rounded text-[10px] font-bold bg-orange-100 text-orange-800"
                    >
                      Tunai Kasir
                    </span>
                  </div>
                  <p class="text-[11px] text-slate-500 truncate">
                    Alfamart, Indomaret, Alfamidi, Dan+Dan
                  </p>
                </div>
              </div>

              <!-- Right badge -->
              <span class="text-[11px] font-bold text-slate-600 shrink-0">
                {{
                  selectedPaymentRail === "retail"
                    ? currentRetail === "ALFAMART"
                      ? "Alfamart"
                      : "Indomaret"
                    : "Pilih Gerai"
                }}
              </span>
            </div>

            <!-- Expanded Retail Selector (when selected) -->
            <div
              v-if="selectedPaymentRail === 'retail'"
              class="px-3 pb-3 pt-2.5 border-t border-slate-200/70 space-y-2 animate-fadeIn"
              @click.stop
            >
              <label class="block text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                Pilih Gerai Minimarket
              </label>
              <div class="grid grid-cols-2 gap-2">
                <button
                  v-for="ret in SUPPORTED_RETAILS"
                  :key="ret.id"
                  type="button"
                  @click="currentRetail = ret.id"
                  class="py-2.5 px-3 rounded-lg border text-xs font-bold transition text-center cursor-pointer flex items-center justify-center gap-2"
                  :class="
                    currentRetail === ret.id
                      ? 'border-slate-900 bg-slate-900 text-white shadow-xs'
                      : 'border-slate-200 bg-white hover:bg-slate-100 text-slate-700'
                  "
                >
                  <Check v-if="currentRetail === ret.id" class="w-3.5 h-3.5 text-emerald-400" />
                  <Store v-else class="w-3.5 h-3.5 text-amber-500" />
                  <span>{{ ret.label }}</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Footnote Info -->
        <div
          class="flex items-center justify-between text-[11px] font-semibold text-slate-600 px-1 pt-1"
        >
          <span>{{
            selectedPaymentRail === "va"
              ? "Nomor VA otomatis terverifikasi tanpa upload struk"
              : selectedPaymentRail === "ewallet"
                ? "Buka aplikasi e-wallet Anda untuk konfirmasi"
                : selectedPaymentRail === "card"
                  ? "Verifikasi aman via 3D-Secure OTP Bank"
                  : selectedPaymentRail === "retail"
                    ? "Bayar tunai di kasir gerai terdekat"
                    : "BCA, Mandiri, BRI, BNI, BSI, GoPay, OVO, DANA"
          }}</span>
          <span class="text-emerald-700 font-bold">Tanpa Biaya Admin</span>
        </div>
      </div>

      <!-- Error Alert -->
      <div
        v-if="errorMessage"
        class="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold"
      >
        {{ errorMessage }}
      </div>

      <!-- Pay Button -->
      <div class="pt-1">
        <button
          @click="onPayClicked"
          :disabled="isSubmitting || !emailInput"
          class="w-full flex items-center justify-center gap-2 rounded-xl btn-gold active:scale-[0.99] px-4 py-3 text-xs sm:text-sm font-extrabold text-jetblack shadow-md transition duration-150 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          :class="
            product.mode === 'sandbox'
              ? '!bg-blue-600 !text-white hover:!bg-blue-500 !border-transparent'
              : ''
          "
        >
          <FlaskConical v-if="product.mode === 'sandbox'" class="w-4 h-4" />
          <CreditCard v-else class="w-4 h-4 text-jetblack" />
          <span>
            {{
              isSubmitting
                ? "Membuat kode pembayaran..."
                : product.mode === "sandbox"
                  ? `Mulai Sesi Sandbox — ${formatRupiah(payableAmount || product.targetPrice)}`
                  : `Bayar Sekarang — ${formatRupiah(payableAmount || product.targetPrice)}`
            }}
          </span>
          <ArrowRight v-if="!isSubmitting" class="w-4 h-4 ml-0.5 text-slate-950" />
        </button>
        <p v-if="!emailInput" class="text-[11px] text-amber-600 font-semibold text-center mt-1.5">
          * Masukkan email penerima di kolom kiri untuk melanjutkan
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
.animate-fadeIn {
  animation: fadeIn 0.2s ease-out;
}
</style>
