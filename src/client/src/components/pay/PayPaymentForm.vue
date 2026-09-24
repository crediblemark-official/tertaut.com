<script setup lang="ts">
import { computed, ref } from "vue";
import {
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
import PayDanaForm from "./PayDanaForm.vue";
import PayXenditForm from "./PayXenditForm.vue";

interface ProductData {
  id: string;
  name: string;
  slug: string;
  mode: "sandbox" | "live";
  checkoutMode?: "custom" | "hosted";
  activePaymentGateway?: "dana" | "xendit";
  targetPrice: number;
}

const props = defineProps<{
  product: ProductData;
  checkoutMode?: "custom" | "hosted";
  activeGateway?: "dana" | "xendit";
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

const effectiveGateway = computed<"dana" | "xendit">(() => {
  return props.activeGateway || props.product?.activePaymentGateway || "dana";
});

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

      <div class="pt-3 border-t border-emerald-200/70 flex items-center justify-between text-xs">
        <span class="text-slate-600 font-medium">Status Pesanan:</span>
        <span class="font-bold text-emerald-700 flex items-center gap-1">
          <CheckCircle2 class="w-3.5 h-3.5" /> Lunas &amp; Aktif
        </span>
      </div>
    </div>

    <!-- ======================================================== -->
    <!-- 2. ACTIVE ORDER STATE (Custom Native UI Polling)         -->
    <!-- ======================================================== -->
    <div
      v-else-if="activeOrder"
      class="flex-1 flex flex-col justify-between space-y-4 animate-fadeIn"
    >
      <div class="space-y-4">
        <!-- 2A. QRIS Display -->
        <div
          v-if="activeOrder.paymentRail === 'qris'"
          class="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 text-center space-y-3.5 shadow-xs"
        >
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Scan QRIS untuk Bayar
            </span>
            <span
              class="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1"
            >
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Menunggu Pembayaran
            </span>
          </div>

          <!-- QR Container -->
          <div
            class="flex flex-col items-center justify-center p-3 bg-slate-50/70 rounded-xl border border-slate-200/80"
          >
            <div
              v-if="activeOrder.qrDataUrl"
              class="p-2 bg-white rounded-xl shadow-xs border border-slate-200"
            >
              <img
                :src="activeOrder.qrDataUrl"
                alt="QRIS Pembayaran"
                class="w-48 h-48 sm:w-56 sm:h-56 object-contain"
              />
            </div>
            <div
              v-else
              class="w-48 h-48 sm:w-56 sm:h-56 bg-slate-100 rounded-xl flex items-center justify-center text-slate-600 text-xs font-mono p-4 text-center border border-dashed border-slate-300"
            >
              QR Code sedang disiapkan...
            </div>

            <p class="text-[11px] text-slate-600 font-medium mt-2">
              Dapat di-scan dengan GoPay, OVO, DANA, BCA, Mandiri, BRI, dll.
            </p>
          </div>

          <!-- Simulator sandbox (jika mode sandbox) -->
          <div v-if="product.mode === 'sandbox'" class="pt-1.5">
            <button
              @click="handleSimulatePayment"
              :disabled="isSimulating"
              type="button"
              class="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shadow-xs"
            >
              <FlaskConical class="w-4 h-4 text-white" />
              <span>{{
                isSimulating ? "Memproses Pembayaran..." : "Simulasi Bayar QRIS (Sandbox)"
              }}</span>
            </button>
            <p v-if="simulationError" class="text-[11px] font-bold text-red-600 mt-1">
              {{ simulationError }}
            </p>
          </div>
        </div>

        <!-- 2B. Virtual Account Display -->
        <div
          v-else-if="activeOrder.paymentRail === 'va'"
          class="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 space-y-4 shadow-xs"
        >
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Nomor Virtual Account
            </span>
            <span
              class="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1"
            >
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Menunggu Transfer
            </span>
          </div>

          <div class="p-3.5 bg-slate-50/70 rounded-xl border border-slate-200/80 space-y-2">
            <div class="flex items-center justify-between text-xs text-slate-600 font-medium">
              <span>Bank Tujuan:</span>
              <span class="font-extrabold text-slate-900">{{
                activeOrder.vaBank || "Virtual Account"
              }}</span>
            </div>

            <div>
              <label
                class="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1"
              >
                Nomor Pembayaran VA:
              </label>
              <div class="flex items-center gap-2">
                <input
                  type="text"
                  readonly
                  :value="activeOrder.paymentCode || 'Membuat kode VA...'"
                  class="flex-1 font-mono font-bold text-slate-900 text-sm sm:text-base tracking-wider bg-white p-2.5 rounded-lg border border-slate-200 focus:outline-none select-all"
                />
                <button
                  @click="copyToClipboard(activeOrder.paymentCode || '')"
                  type="button"
                  class="px-3.5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs shrink-0"
                >
                  <Check v-if="copiedVa" class="w-3.5 h-3.5 text-emerald-400" />
                  <Copy v-else class="w-3.5 h-3.5" />
                  <span>{{ copiedVa ? "Tersalin!" : "Salin" }}</span>
                </button>
              </div>
            </div>

            <div class="flex items-center justify-between text-xs text-slate-600 font-medium pt-1">
              <span>Nominal yang Harus Ditransfer:</span>
              <span class="font-extrabold text-slate-900">
                {{ formatRupiah(activeOrder.amount || payableAmount) }}
              </span>
            </div>
          </div>

          <!-- Simulator sandbox VA -->
          <div v-if="product.mode === 'sandbox'" class="pt-1.5">
            <button
              @click="handleSimulatePayment"
              :disabled="isSimulating"
              type="button"
              class="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shadow-xs"
            >
              <FlaskConical class="w-4 h-4 text-white" />
              <span>{{
                isSimulating ? "Memproses Pembayaran..." : "Simulasi Bayar VA (Sandbox)"
              }}</span>
            </button>
            <p v-if="simulationError" class="text-[11px] font-bold text-red-600 mt-1">
              {{ simulationError }}
            </p>
          </div>
        </div>

        <!-- 2C. Retail Minimarket Display -->
        <div
          v-else-if="activeOrder.paymentRail === 'retail'"
          class="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 space-y-4 shadow-xs"
        >
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Kode Pembayaran Kasir
            </span>
            <span
              class="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1"
            >
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Menunggu Kasir
            </span>
          </div>

          <div class="p-3.5 bg-slate-50/70 rounded-xl border border-slate-200/80 space-y-2">
            <div class="flex items-center justify-between text-xs text-slate-600 font-medium">
              <span>Gerai Tujuan:</span>
              <span class="font-extrabold text-slate-900">{{
                activeOrder.retailOutlet === "INDOMARET" ? "Indomaret" : "Alfamart"
              }}</span>
            </div>

            <div>
              <label
                class="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1"
              >
                Kode Pembayaran:
              </label>
              <div class="flex items-center gap-2">
                <input
                  type="text"
                  readonly
                  :value="activeOrder.paymentCode || 'Membuat kode...'"
                  class="flex-1 font-mono font-bold text-slate-900 text-sm sm:text-base tracking-wider bg-white p-2.5 rounded-lg border border-slate-200 focus:outline-none select-all"
                />
                <button
                  @click="copyToClipboard(activeOrder.paymentCode || '')"
                  type="button"
                  class="px-3.5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs shrink-0"
                >
                  <Check v-if="copiedVa" class="w-3.5 h-3.5 text-emerald-400" />
                  <Copy v-else class="w-3.5 h-3.5" />
                  <span>{{ copiedVa ? "Tersalin!" : "Salin" }}</span>
                </button>
              </div>
            </div>

            <div class="flex items-center justify-between text-xs text-slate-600 font-medium pt-1">
              <span>Total Bayar di Kasir:</span>
              <span class="font-extrabold text-slate-900">
                {{ formatRupiah(activeOrder.amount || payableAmount) }}
              </span>
            </div>
          </div>

          <!-- Simulator sandbox Retail -->
          <div v-if="product.mode === 'sandbox'" class="pt-1.5">
            <button
              @click="handleSimulatePayment"
              :disabled="isSimulating"
              type="button"
              class="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shadow-xs"
            >
              <FlaskConical class="w-4 h-4 text-white" />
              <span>{{
                isSimulating ? "Memproses Pembayaran..." : "Simulasi Bayar Kasir (Sandbox)"
              }}</span>
            </button>
            <p v-if="simulationError" class="text-[11px] font-bold text-red-600 mt-1">
              {{ simulationError }}
            </p>
          </div>
        </div>

        <!-- 2D. E-Wallet Display -->
        <div
          v-else-if="activeOrder.paymentRail === 'ewallet'"
          class="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 space-y-4 shadow-xs"
        >
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Menunggu Konfirmasi E-Wallet
            </span>
            <span
              class="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200 flex items-center gap-1"
            >
              <span class="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
              Menunggu Aplikasi
            </span>
          </div>

          <div class="p-3.5 bg-slate-50/70 rounded-xl border border-slate-200/80 space-y-2 text-xs">
            <p class="text-slate-700 leading-relaxed">
              Silakan periksa notifikasi aplikasi e-wallet Anda untuk menyetujui transaksi senilai
              <span class="font-extrabold text-slate-900">{{
                formatRupiah(activeOrder.amount || payableAmount)
              }}</span
              >.
            </p>
          </div>

          <!-- Simulator sandbox E-Wallet -->
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
            <span class="font-semibold text-slate-700">Transfer / Bayar &gt; Virtual Account</span>
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

        <!-- Opsi Buka Invoice Eksternal jika ada -->
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
            <span>Buka di Halaman Pembayaran Gateway</span>
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
    <!-- 3. INITIAL PAYMENT SELECTION (Modular per Gateway)       -->
    <!-- ======================================================== -->
    <div v-else>
      <!-- Gateway DANA -->
      <PayDanaForm
        v-if="effectiveGateway === 'dana'"
        :product="product"
        :checkout-mode="checkoutMode"
        :email-input="emailInput"
        :selected-payment-rail="selectedPaymentRail"
        :selected-bank="selectedBank"
        :payable-amount="payableAmount"
        :is-submitting="isSubmitting"
        :error-message="errorMessage"
        @update:selected-payment-rail="emit('update:selectedPaymentRail', $event)"
        @update:selected-bank="emit('update:selectedBank', $event)"
        @pay="emit('pay', $event)"
      />

      <!-- Gateway XENDIT -->
      <PayXenditForm
        v-else
        :product="product"
        :checkout-mode="checkoutMode"
        :email-input="emailInput"
        :selected-payment-rail="selectedPaymentRail"
        :selected-bank="selectedBank"
        :selected-ewallet="selectedEwallet"
        :selected-retail="selectedRetail"
        :payable-amount="payableAmount"
        :is-submitting="isSubmitting"
        :error-message="errorMessage"
        @update:selected-payment-rail="emit('update:selectedPaymentRail', $event)"
        @update:selected-bank="emit('update:selectedBank', $event)"
        @update:selected-ewallet="emit('update:selectedEwallet', $event)"
        @update:selected-retail="emit('update:selectedRetail', $event)"
        @pay="emit('pay', $event)"
      />
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
