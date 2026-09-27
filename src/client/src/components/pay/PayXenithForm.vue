<script setup lang="ts">
import { computed, onMounted, watch } from "vue";
import {
  QrCode,
  Building,
  ArrowRight,
  ExternalLink,
  FlaskConical,
  ShieldCheck,
  Check,
} from "lucide-vue-next";
import { formatRupiah } from "../../lib/utils";

interface ProductData {
  id: string;
  name: string;
  slug: string;
  mode: "sandbox" | "live";
  checkoutMode?: "custom" | "hosted";
  targetPrice: number;
}

const props = defineProps<{
  product: ProductData;
  checkoutMode?: "custom" | "hosted";
  emailInput: string;
  selectedPaymentRail: "qris" | "va" | "ewallet" | "card" | "retail";
  selectedBank?: string;
  selectedEwallet?: string;
  payableAmount: number;
  isSubmitting: boolean;
  errorMessage: string;
}>();

const emit = defineEmits<{
  "update:selectedPaymentRail": [value: "qris" | "va" | "ewallet" | "card" | "retail"];
  "update:selectedBank": [value: string];
  "update:selectedEwallet": [value: string];
  pay: [
    payload?: {
      paymentRail?: "qris" | "va" | "ewallet" | "card" | "retail";
      vaBank: string;
      ewalletChannel: string;
      retailOutlet: string;
    },
  ];
}>();

// Pastikan rail yang dipilih di XenithPay selalu valid (hanya QRIS atau VA yang aktif di API)
onMounted(() => {
  if (props.selectedPaymentRail !== "va" && props.selectedPaymentRail !== "qris") {
    emit("update:selectedPaymentRail", "qris");
  }
});

watch(
  () => props.selectedPaymentRail,
  (rail) => {
    if (rail !== "va" && rail !== "qris") {
      emit("update:selectedPaymentRail", "qris");
    }
  }
);

const isHosted = computed(() => {
  return (
    props.checkoutMode === "hosted" ||
    (props.checkoutMode !== "custom" && props.product?.checkoutMode === "hosted")
  );
});

/** Bank Resmi Virtual Account yang didukung XenithPay di Indonesia */
const XENITH_BANKS = [
  { id: "BNI", label: "BNI", fullName: "Bank Negara Indonesia" },
  { id: "MANDIRI", label: "Mandiri", fullName: "Bank Mandiri" },
  { id: "BRI", label: "BRI", fullName: "Bank Rakyat Indonesia" },
  { id: "PERMATA", label: "Permata", fullName: "Permata Bank" },
  { id: "CIMB", label: "CIMB Niaga", fullName: "Bank CIMB Niaga" },
  { id: "DANAMON", label: "Danamon", fullName: "Bank Danamon" },
  { id: "SAHABAT_SAMPOERNA", label: "BSS", fullName: "Bank Sahabat Sampoerna" },
  { id: "MAYBANK", label: "Maybank", fullName: "Maybank Indonesia" },
];

const currentBank = computed({
  get: () => props.selectedBank || "BNI",
  set: (val: string) => emit("update:selectedBank", val),
});

function onPayClicked() {
  emit("pay", {
    paymentRail: isHosted.value ? undefined : props.selectedPaymentRail,
    vaBank: currentBank.value,
    ewalletChannel: "",
    retailOutlet: "",
  });
}
</script>

<template>
  <!-- ======================================================== -->
  <!-- 1. XENITHPAY HOSTED CHECKOUT (Redirect ke Hosted Payment) -->
  <!-- ======================================================== -->
  <div v-if="isHosted" class="flex-1 flex flex-col justify-between space-y-4 animate-fadeIn">
    <div class="space-y-2.5">
      <label class="block text-xs font-bold text-slate-800 uppercase tracking-wider">
        Metode Pembayaran XenithPay
      </label>

      <div class="space-y-2">
        <p class="text-xs leading-relaxed text-slate-600 mb-1">
          Pilih metode pembayaran yang tersedia langsung di halaman aman XenithPay:
        </p>

        <!-- 1. Virtual Account -->
        <div
          class="flex items-center justify-between p-3 rounded-xl border border-slate-200/90 bg-white shadow-2xs hover:border-slate-300 transition"
        >
          <div class="flex items-center gap-3 min-w-0">
            <div class="p-2 rounded-lg bg-blue-50 text-blue-600 shrink-0">
              <Building class="w-4 h-4" />
            </div>
            <div class="min-w-0">
              <div class="font-bold text-xs text-slate-900">Virtual Account</div>
              <div class="text-[11px] text-slate-500 truncate">
                BNI, Mandiri, BRI, Permata, CIMB Niaga, Danamon, BSS, Maybank
              </div>
            </div>
          </div>
          <span class="text-[11px] font-medium text-slate-400 shrink-0">Otomatis</span>
        </div>

        <!-- 2. QRIS -->
        <div
          class="flex items-center justify-between p-3 rounded-xl border border-slate-200/90 bg-white shadow-2xs hover:border-slate-300 transition"
        >
          <div class="flex items-center gap-3 min-w-0">
            <div class="p-2 rounded-lg bg-emerald-50 text-emerald-600 shrink-0">
              <QrCode class="w-4 h-4" />
            </div>
            <div class="min-w-0">
              <div class="font-bold text-xs text-slate-900">QRIS Dinamis</div>
              <div class="text-[11px] text-slate-500 truncate">Semua m-Banking & E-Wallet</div>
            </div>
          </div>
          <span class="text-[11px] font-semibold text-emerald-600 shrink-0">Bebas Biaya</span>
        </div>
      </div>
    </div>

    <div>
      <div
        v-if="errorMessage"
        class="p-3 mb-2 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold"
      >
        {{ errorMessage }}
      </div>

      <div class="pt-1">
        <button
          @click="onPayClicked"
          :disabled="isSubmitting || !emailInput"
          class="w-full flex items-center justify-center gap-2 rounded-xl btn-gold active:scale-[0.99] px-4 py-3 text-xs sm:text-sm font-extrabold text-jetblack shadow-md transition duration-150 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
          :class="
            product.mode === 'sandbox'
              ? '!bg-blue-600 !text-white hover:!bg-blue-500 !border-transparent'
              : ''
          "
        >
          <FlaskConical v-if="product.mode === 'sandbox'" class="w-4 h-4 shrink-0" />
          <ExternalLink v-else class="w-4 h-4 text-jetblack shrink-0" />
          <span class="truncate">
            {{
              isSubmitting
                ? "Memproses..."
                : product.mode === "sandbox"
                  ? `Lanjutkan ke XenithPay (Sandbox) — ${formatRupiah(payableAmount || product.targetPrice)}`
                  : `Lanjutkan ke XenithPay — ${formatRupiah(payableAmount || product.targetPrice)}`
            }}
          </span>
          <ArrowRight v-if="!isSubmitting" class="w-4 h-4 ml-0.5 text-slate-950 shrink-0" />
        </button>
        <p v-if="!emailInput" class="text-[11px] text-amber-600 font-semibold text-center mt-1.5">
          * Masukkan email penerima di kolom kiri untuk melanjutkan
        </p>
      </div>
    </div>
  </div>

  <!-- ======================================================== -->
  <!-- 2. XENITHPAY FULL CUSTOM UI (In-Page Native Multi-Rail)   -->
  <!-- ======================================================== -->
  <div v-else class="space-y-4 animate-fadeIn">
    <div class="space-y-2.5">
      <div class="flex items-center justify-between px-0.5">
        <label class="block text-xs font-bold text-slate-900 uppercase tracking-wider">
          Pilih Jalur Pembayaran XenithPay
        </label>
        <span
          class="text-[10px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200"
        >
          XenithPay Gateway
        </span>
      </div>

      <div class="space-y-2">
        <!-- 1. Virtual Account Multi-Bank (Default Xenith) -->
        <div
          @click="emit('update:selectedPaymentRail', 'va')"
          class="rounded-xl border transition-all cursor-pointer overflow-hidden"
          :class="
            selectedPaymentRail === 'va'
              ? 'border-slate-900 bg-slate-50/70 shadow-xs ring-1 ring-slate-900/10'
              : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/40'
          "
        >
          <div class="p-3 flex items-center justify-between gap-3">
            <div class="flex items-center gap-2.5 min-w-0">
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
                />
              </div>
              <div class="p-1.5 rounded-lg bg-blue-50 text-blue-600 shrink-0">
                <Building class="w-4 h-4" />
              </div>
              <div class="min-w-0">
                <div class="flex items-center gap-1.5 flex-wrap">
                  <span class="text-xs font-bold text-slate-900">Virtual Account</span>
                  <span
                    class="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-blue-100 text-blue-700"
                  >
                    8 Bank
                  </span>
                </div>
                <p class="text-[11px] text-slate-500 truncate">
                  BNI, Mandiri, BRI, Permata, CIMB Niaga, Danamon...
                </p>
              </div>
            </div>
            <span class="text-[11px] font-bold text-slate-600 shrink-0">
              {{ selectedPaymentRail === "va" ? currentBank : "Pilih Bank" }}
            </span>
          </div>

          <!-- Expanded Bank Selector -->
          <div
            v-if="selectedPaymentRail === 'va'"
            class="px-3 pb-3 pt-2.5 border-t border-slate-200/70 space-y-2 animate-fadeIn"
            @click.stop
          >
            <label class="block text-[10px] font-bold text-slate-600 uppercase tracking-wider">
              Pilih Bank Tujuan Transfer (XenithPay)
            </label>
            <div class="grid grid-cols-3 sm:grid-cols-4 gap-2">
              <button
                v-for="b in XENITH_BANKS"
                :key="b.id"
                type="button"
                @click="currentBank = b.id"
                class="py-2 px-2.5 rounded-lg border text-xs font-bold transition text-center cursor-pointer flex items-center justify-center gap-1.5"
                :class="
                  currentBank === b.id
                    ? 'border-slate-900 bg-slate-900 text-white shadow-xs'
                    : 'border-slate-200 bg-white hover:bg-slate-100 text-slate-700'
                "
              >
                <Check v-if="currentBank === b.id" class="w-3.5 h-3.5 text-emerald-400" />
                <span>{{ b.label }}</span>
              </button>
            </div>
          </div>
        </div>

        <!-- 2. QRIS Dinamis Instan -->
        <div
          @click="emit('update:selectedPaymentRail', 'qris')"
          class="rounded-xl border transition-all cursor-pointer overflow-hidden"
          :class="
            selectedPaymentRail === 'qris'
              ? 'border-slate-900 bg-slate-50/70 shadow-xs ring-1 ring-slate-900/10'
              : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/40'
          "
        >
          <div class="p-3 flex items-center justify-between gap-3">
            <div class="flex items-center gap-2.5 min-w-0">
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
                />
              </div>
              <div class="p-1.5 rounded-lg bg-amber-50 text-amber-600 shrink-0">
                <QrCode class="w-4 h-4" />
              </div>
              <div class="min-w-0">
                <div class="flex items-center gap-1.5 flex-wrap">
                  <span class="text-xs font-bold text-slate-900">QRIS Dinamis</span>
                  <span
                    class="text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded bg-amber-100 text-amber-800"
                  >
                    Populer
                  </span>
                </div>
                <p class="text-[11px] text-slate-500 truncate">
                  Semua m-Banking &amp; E-Wallet nasional
                </p>
              </div>
            </div>
            <span class="text-[11px] font-bold text-emerald-600 shrink-0">Bebas Admin</span>
          </div>
          <div
            v-if="selectedPaymentRail === 'qris'"
            class="px-3 pb-3 pt-1 border-t border-slate-200/70 text-[11px] text-slate-600 flex items-center gap-1.5"
          >
            <Check class="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>Kode QRIS dinamis XenithPay langsung tampil di layar setelah menekan bayar.</span>
          </div>
        </div>
      </div>

      <!-- Footnote Info -->
      <div
        class="flex items-center justify-between text-[11px] font-semibold text-slate-600 px-1 pt-1"
      >
        <span>{{
          selectedPaymentRail === "va"
            ? "Nomor VA XenithPay otomatis diverifikasi instan"
            : "Scan QRIS dengan BCA, Mandiri, BRI, BNI, GoPay, OVO, DANA, ShopeePay"
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
        <Building v-else-if="selectedPaymentRail === 'va'" class="w-4 h-4 text-jetblack" />
        <QrCode v-else class="w-4 h-4 text-jetblack" />
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
