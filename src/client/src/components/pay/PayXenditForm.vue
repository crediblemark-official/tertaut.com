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
  ExternalLink,
  FlaskConical,
  ShieldCheck,
  Check,
} from "lucide-vue-next";
import { formatRupiah } from "../../lib/utils";
import { SUPPORTED_BANKS as BANKS, SUPPORTED_EWALLETS, SUPPORTED_RETAILS } from "../../constants";

interface ProductData {
  id: string;
  name: string;
  slug: string;
  mode: "sandbox" | "live";
  checkoutMode?: "custom" | "hosted";
  availableChannels?: import("../../types/app").AvailableChannels;
  targetPrice: number;
}

const props = defineProps<{
  product: ProductData;
  activeGateway?: "xendit" | "xenithpay";
  checkoutMode?: "custom" | "hosted";
  emailInput: string;
  selectedPaymentRail: "qris" | "va" | "ewallet" | "card" | "retail";
  selectedBank?: string;
  selectedEwallet?: string;
  selectedRetail?: string;
  payableAmount: number;
  isSubmitting: boolean;
  errorMessage: string;
}>();

const emit = defineEmits<{
  "update:selectedPaymentRail": [value: "qris" | "va" | "ewallet" | "card" | "retail"];
  "update:selectedBank": [value: string];
  "update:selectedEwallet": [value: string];
  "update:selectedRetail": [value: string];
  pay: [
    payload?: {
      paymentRail?: "qris" | "va" | "ewallet" | "card" | "retail";
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
}>();

const isHosted = computed(() => {
  return (
    props.checkoutMode === "hosted" ||
    (props.checkoutMode !== "custom" && props.product?.checkoutMode === "hosted")
  );
});
const isXenithPay = computed(() => props.activeGateway === "xenithpay");

const availableChannels = computed(() => props.product?.availableChannels);

// 1. Ketersediaan QRIS
const isQrisActive = computed(() => {
  if (!availableChannels.value) return true;
  return availableChannels.value.qrisEnabled;
});

// 2. Ketersediaan Bank Virtual Account
const activeBankList = computed(() => {
  if (!availableChannels.value || !availableChannels.value.activeBanks?.length) {
    return BANKS;
  }
  const allowed = new Set(availableChannels.value.activeBanks);
  return BANKS.filter((b) => allowed.has(b.id));
});
const isVaActive = computed(() => activeBankList.value.length > 0);

// 3. Ketersediaan E-Wallet
const activeEwalletList = computed(() => {
  if (!availableChannels.value || !availableChannels.value.activeEwallets?.length) {
    return SUPPORTED_EWALLETS;
  }
  const allowed = new Set(availableChannels.value.activeEwallets);
  return SUPPORTED_EWALLETS.filter((e) => allowed.has(e.id));
});
const isEwalletActive = computed(() => {
  if (!availableChannels.value) return true;
  return availableChannels.value.activeEwallets.length > 0;
});

// 4. Ketersediaan Retail Minimarket
const activeRetailList = computed(() => {
  if (!availableChannels.value || !availableChannels.value.activeRetails?.length) {
    return SUPPORTED_RETAILS;
  }
  const allowed = new Set(availableChannels.value.activeRetails);
  return SUPPORTED_RETAILS.filter((r) => allowed.has(r.id));
});
const isRetailActive = computed(() => {
  if (!availableChannels.value) return true;
  return availableChannels.value.activeRetails.length > 0;
});

// 5. Ketersediaan Kartu Kredit (3D Secure memerlukan mode live & channel aktif di gateway)
const isCardActive = computed(() => {
  if (props.product?.mode === "sandbox") return false;
  if (!availableChannels.value) return false;
  return Boolean(
    availableChannels.value.cardEnabled || availableChannels.value.activeRails?.includes("card")
  );
});

const currentBank = computed({
  get: () => {
    if (activeBankList.value.some((b) => b.id === props.selectedBank)) {
      return props.selectedBank || "BCA";
    }
    return activeBankList.value[0]?.id || "BCA";
  },
  set: (val: string) => emit("update:selectedBank", val),
});

const currentEwallet = computed({
  get: () => {
    if (activeEwalletList.value.some((e) => e.id === props.selectedEwallet)) {
      return props.selectedEwallet || "DANA";
    }
    return activeEwalletList.value[0]?.id || "DANA";
  },
  set: (val: string) => emit("update:selectedEwallet", val),
});

const currentRetail = computed({
  get: () => {
    if (activeRetailList.value.some((r) => r.id === props.selectedRetail)) {
      return props.selectedRetail || "ALFAMART";
    }
    return activeRetailList.value[0]?.id || "ALFAMART";
  },
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
    paymentRail: isHosted.value ? undefined : props.selectedPaymentRail,
    vaBank: currentBank.value,
    ewalletChannel: currentEwallet.value,
    retailOutlet: currentRetail.value,
    cardDetails: cardData,
  });
}
</script>

<template>
  <!-- ======================================================== -->
  <!-- 1. XENDIT HOSTED CHECKOUT (Invoice Redirect)             -->
  <!-- ======================================================== -->
  <div v-if="isHosted" class="flex-1 flex flex-col justify-between space-y-4 animate-fadeIn">
    <div class="space-y-2.5">
      <label class="block text-xs font-bold text-slate-800 uppercase tracking-wider">
        Metode Pembayaran Tersedia
      </label>

      <!-- XenithPay manages available channels on its hosted checkout. -->
      <div v-if="isXenithPay" class="space-y-2">
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
                BCA, Mandiri, BRI, BNI, Permata, CIMB, BSI
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
              <div class="font-bold text-xs text-slate-900">QRIS</div>
              <div class="text-[11px] text-slate-500 truncate">Semua m-Banking & E-Wallet</div>
            </div>
          </div>
          <span class="text-[11px] font-semibold text-emerald-600 shrink-0">Bebas Biaya</span>
        </div>
      </div>
      <div v-else class="space-y-2">
        <!-- 1. QRIS -->
        <div
          class="flex items-center justify-between p-3 rounded-xl border border-slate-200/90 bg-white shadow-2xs hover:border-slate-300 transition"
        >
          <div class="flex items-center gap-3 min-w-0">
            <div class="p-2 rounded-lg bg-emerald-50 text-emerald-600 shrink-0">
              <QrCode class="w-4 h-4" />
            </div>
            <div class="min-w-0">
              <div class="font-bold text-xs text-slate-900">QRIS</div>
              <div class="text-[11px] text-slate-500 truncate">Semua m-Banking & E-Wallet</div>
            </div>
          </div>
          <span class="text-[11px] font-semibold text-emerald-600 shrink-0">Bebas Biaya</span>
        </div>

        <!-- 2. Virtual Account -->
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
                BCA, Mandiri, BRI, BNI, Permata, CIMB
              </div>
            </div>
          </div>
          <span class="text-[11px] font-medium text-slate-400 shrink-0">Otomatis</span>
        </div>

        <!-- 3. E-Wallet -->
        <div
          class="flex items-center justify-between p-3 rounded-xl border border-slate-200/90 bg-white shadow-2xs hover:border-slate-300 transition"
        >
          <div class="flex items-center gap-3 min-w-0">
            <div class="p-2 rounded-lg bg-indigo-50 text-indigo-600 shrink-0">
              <Wallet class="w-4 h-4" />
            </div>
            <div class="min-w-0">
              <div class="font-bold text-xs text-slate-900">E-Wallet</div>
              <div class="text-[11px] text-slate-500 truncate">DANA, OVO, ShopeePay, GoPay</div>
            </div>
          </div>
          <span class="text-[11px] font-medium text-slate-400 shrink-0">Instan</span>
        </div>

        <!-- 4. Kartu Kredit / Debit -->
        <div
          class="flex items-center justify-between p-3 rounded-xl border border-slate-200/90 bg-white shadow-2xs hover:border-slate-300 transition"
        >
          <div class="flex items-center gap-3 min-w-0">
            <div class="p-2 rounded-lg bg-amber-50 text-amber-600 shrink-0">
              <CreditCard class="w-4 h-4" />
            </div>
            <div class="min-w-0">
              <div class="font-bold text-xs text-slate-900">Kartu Kredit / Debit</div>
              <div class="text-[11px] text-slate-500 truncate">Visa & Mastercard 3D Secure</div>
            </div>
          </div>
          <span class="text-[11px] font-medium text-slate-400 shrink-0">3D Secure</span>
        </div>

        <!-- 5. Gerai Retail -->
        <div
          class="flex items-center justify-between p-3 rounded-xl border border-slate-200/90 bg-white shadow-2xs hover:border-slate-300 transition"
        >
          <div class="flex items-center gap-3 min-w-0">
            <div class="p-2 rounded-lg bg-rose-50 text-rose-600 shrink-0">
              <Store class="w-4 h-4" />
            </div>
            <div class="min-w-0">
              <div class="font-bold text-xs text-slate-900">Gerai Retail</div>
              <div class="text-[11px] text-slate-500 truncate">Indomaret & Alfamart</div>
            </div>
          </div>
          <span class="text-[11px] font-medium text-slate-400 shrink-0">Tunai</span>
        </div>
      </div>
    </div>

    <div>
      <!-- Error Alert -->
      <div
        v-if="errorMessage"
        class="p-3 mb-2 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold"
      >
        {{ errorMessage }}
      </div>

      <!-- Pay Button for Xendit Hosted Redirect -->
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
                : isXenithPay
                  ? product.mode === "sandbox"
                    ? `Lanjutkan ke XenithPay (Sandbox) — ${formatRupiah(payableAmount || product.targetPrice)}`
                    : `Lanjutkan ke XenithPay — ${formatRupiah(payableAmount || product.targetPrice)}`
                  : product.mode === "sandbox"
                    ? `Bayar Sandbox — ${formatRupiah(payableAmount || product.targetPrice)}`
                    : `Bayar Sekarang — ${formatRupiah(payableAmount || product.targetPrice)}`
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
  <!-- 2. XENDIT FULL CUSTOM UI (Native In-Page)                -->
  <!-- ======================================================== -->
  <div v-else class="space-y-4 animate-fadeIn">
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

      <!-- Sandbox Live-Sync Notice -->
      <div
        v-if="product.mode === 'sandbox'"
        class="p-2.5 rounded-xl bg-blue-50/80 border border-blue-200/70 text-xs text-blue-900 flex items-start gap-2"
      >
        <FlaskConical class="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
        <div class="text-[11px] leading-relaxed">
          <span class="font-bold">Mode Sandbox Xendit:</span>
          Channel disinkronkan real-time dari API Xendit.
          <span class="font-medium text-blue-800">
            Jalur aktif:
            <strong>Virtual Account ({{ activeBankList.map((b) => b.label).join(", ") }})</strong> &
            <strong>Minimarket ({{ activeRetailList.map((r) => r.label).join(", ") }})</strong>.
          </span>
        </div>
      </div>

      <div class="space-y-2">
        <!-- 1. QRIS Instan -->
        <div
          @click="isQrisActive ? emit('update:selectedPaymentRail', 'qris') : null"
          class="rounded-xl border transition-all overflow-hidden"
          :class="[
            !isQrisActive
              ? 'opacity-65 bg-slate-50/60 border-slate-200 cursor-not-allowed'
              : selectedPaymentRail === 'qris'
                ? 'border-slate-900 bg-slate-50/70 shadow-xs ring-1 ring-slate-900/10 cursor-pointer'
                : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/40 cursor-pointer',
          ]"
        >
          <div class="p-3 flex items-center justify-between gap-3">
            <div class="flex items-center gap-2.5 min-w-0">
              <div
                class="w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition"
                :class="
                  !isQrisActive
                    ? 'border-slate-300 bg-slate-100'
                    : selectedPaymentRail === 'qris'
                      ? 'border-slate-900 bg-slate-900'
                      : 'border-slate-300 bg-white'
                "
              >
                <div
                  v-if="selectedPaymentRail === 'qris' && isQrisActive"
                  class="w-1.5 h-1.5 rounded-full bg-white"
                />
              </div>
              <div
                class="p-1.5 rounded-lg shrink-0"
                :class="isQrisActive ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-400'"
              >
                <QrCode class="w-4 h-4" />
              </div>
              <div class="min-w-0">
                <div class="flex items-center gap-1.5 flex-wrap">
                  <span
                    class="text-xs font-bold"
                    :class="isQrisActive ? 'text-slate-900' : 'text-slate-500'"
                  >
                    QRIS Instan
                  </span>
                  <span
                    v-if="!isQrisActive"
                    class="text-[9px] font-bold uppercase px-1.5 py-0.2 rounded bg-slate-200 text-slate-600"
                  >
                    Nonaktif
                  </span>
                  <span
                    v-else
                    class="text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded bg-amber-100 text-amber-800"
                  >
                    Populer
                  </span>
                </div>
                <p class="text-[11px] text-slate-500 truncate">
                  {{
                    isQrisActive
                      ? "BCA, Mandiri, BRI, BNI, GoPay, OVO, ..."
                      : "Metode QRIS belum aktif pada akun gateway pembayaran ini"
                  }}
                </p>
              </div>
            </div>
            <span
              class="text-[11px] font-bold shrink-0"
              :class="isQrisActive ? 'text-emerald-600' : 'text-slate-400 font-medium'"
            >
              {{ isQrisActive ? "Bebas Admin" : "Belum Aktif" }}
            </span>
          </div>
          <div
            v-if="selectedPaymentRail === 'qris' && isQrisActive"
            class="px-3 pb-3 pt-1 border-t border-slate-200/70 text-[11px] text-slate-600 flex items-center gap-1.5"
          >
            <Check class="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>Kode QRIS dinamis langsung tampil di layar setelah menekan tombol bayar.</span>
          </div>
        </div>

        <!-- 2. Virtual Account Multi-Bank -->
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
                    {{ activeBankList.length }} Bank Aktif
                  </span>
                </div>
                <p class="text-[11px] text-slate-500 truncate">
                  {{ activeBankList.map((b) => b.label).join(", ") }}
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
              Pilih Bank Tujuan Transfer (Aktif di Xendit)
            </label>
            <div class="grid grid-cols-3 sm:grid-cols-4 gap-2">
              <button
                v-for="b in activeBankList"
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

        <!-- 3. E-Wallet Multi-Platform -->
        <div
          @click="isEwalletActive ? emit('update:selectedPaymentRail', 'ewallet') : null"
          class="rounded-xl border transition-all overflow-hidden"
          :class="[
            !isEwalletActive
              ? 'opacity-65 bg-slate-50/60 border-slate-200 cursor-not-allowed'
              : selectedPaymentRail === 'ewallet'
                ? 'border-slate-900 bg-slate-50/70 shadow-xs ring-1 ring-slate-900/10 cursor-pointer'
                : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/40 cursor-pointer',
          ]"
        >
          <div class="p-3 flex items-center justify-between gap-3">
            <div class="flex items-center gap-2.5 min-w-0">
              <div
                class="w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition"
                :class="
                  !isEwalletActive
                    ? 'border-slate-300 bg-slate-100'
                    : selectedPaymentRail === 'ewallet'
                      ? 'border-slate-900 bg-slate-900'
                      : 'border-slate-300 bg-white'
                "
              >
                <div
                  v-if="selectedPaymentRail === 'ewallet' && isEwalletActive"
                  class="w-1.5 h-1.5 rounded-full bg-white"
                />
              </div>
              <div
                class="p-1.5 rounded-lg shrink-0"
                :class="
                  isEwalletActive ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'
                "
              >
                <Wallet class="w-4 h-4" />
              </div>
              <div class="min-w-0">
                <div class="flex items-center gap-1.5 flex-wrap">
                  <span
                    class="text-xs font-bold"
                    :class="isEwalletActive ? 'text-slate-900' : 'text-slate-500'"
                  >
                    E-Wallet
                  </span>
                  <span
                    v-if="!isEwalletActive"
                    class="text-[9px] font-bold uppercase px-1.5 py-0.2 rounded bg-slate-200 text-slate-600"
                  >
                    Nonaktif
                  </span>
                  <span
                    v-else
                    class="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-700"
                  >
                    {{ activeEwalletList.length }} Aplikasi
                  </span>
                </div>
                <p class="text-[11px] text-slate-500 truncate">
                  {{
                    isEwalletActive
                      ? activeEwalletList.map((e) => e.label).join(", ")
                      : "E-Wallet belum aktif pada akun gateway pembayaran ini"
                  }}
                </p>
              </div>
            </div>
            <span
              class="text-[11px] font-bold shrink-0"
              :class="isEwalletActive ? 'text-slate-600' : 'text-slate-400 font-medium'"
            >
              {{
                !isEwalletActive
                  ? "Belum Aktif"
                  : selectedPaymentRail === "ewallet"
                    ? SUPPORTED_EWALLETS.find((w) => w.id === currentEwallet)?.label ||
                      currentEwallet
                    : "Pilih E-Wallet"
              }}
            </span>
          </div>

          <!-- Expanded E-Wallet Selector -->
          <div
            v-if="selectedPaymentRail === 'ewallet' && isEwalletActive"
            class="px-3 pb-3 pt-2.5 border-t border-slate-200/70 space-y-2 animate-fadeIn"
            @click.stop
          >
            <label class="block text-[10px] font-bold text-slate-600 uppercase tracking-wider">
              Pilih Layanan E-Wallet
            </label>
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <button
                v-for="ew in activeEwalletList"
                :key="ew.id"
                type="button"
                @click="currentEwallet = ew.id"
                class="py-2.5 px-3 rounded-lg border text-xs font-bold transition text-left cursor-pointer flex items-center justify-between"
                :class="
                  currentEwallet === ew.id
                    ? 'border-slate-900 bg-slate-900 text-white shadow-xs'
                    : 'border-slate-200 bg-white hover:bg-slate-100 text-slate-700'
                "
              >
                <span>{{ ew.label }}</span>
                <Check v-if="currentEwallet === ew.id" class="w-3.5 h-3.5 text-emerald-400" />
              </button>
            </div>
          </div>
        </div>

        <!-- 4. Kartu Kredit / Debit -->
        <div
          @click="isCardActive ? emit('update:selectedPaymentRail', 'card') : null"
          class="rounded-xl border transition-all overflow-hidden"
          :class="[
            !isCardActive
              ? 'opacity-65 bg-slate-50/60 border-slate-200 cursor-not-allowed'
              : selectedPaymentRail === 'card'
                ? 'border-slate-900 bg-slate-50/70 shadow-xs ring-1 ring-slate-900/10 cursor-pointer'
                : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/40 cursor-pointer',
          ]"
        >
          <div class="p-3 flex items-center justify-between gap-3">
            <div class="flex items-center gap-2.5 min-w-0">
              <div
                class="w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition"
                :class="
                  !isCardActive
                    ? 'border-slate-300 bg-slate-100'
                    : selectedPaymentRail === 'card'
                      ? 'border-slate-900 bg-slate-900'
                      : 'border-slate-300 bg-white'
                "
              >
                <div
                  v-if="selectedPaymentRail === 'card' && isCardActive"
                  class="w-1.5 h-1.5 rounded-full bg-white"
                />
              </div>
              <div
                class="p-1.5 rounded-lg shrink-0"
                :class="
                  isCardActive ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-400'
                "
              >
                <CreditCard class="w-4 h-4" />
              </div>
              <div class="min-w-0">
                <div class="flex items-center gap-1.5 flex-wrap">
                  <span
                    class="text-xs font-bold"
                    :class="isCardActive ? 'text-slate-900' : 'text-slate-500'"
                  >
                    Kartu Kredit / Debit
                  </span>
                  <span
                    v-if="!isCardActive"
                    class="text-[9px] font-bold uppercase px-1.5 py-0.2 rounded bg-slate-200 text-slate-600"
                  >
                    {{ product?.mode === "sandbox" ? "Hanya Mode Live" : "Nonaktif" }}
                  </span>
                  <span
                    v-else
                    class="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-indigo-100 text-indigo-700"
                  >
                    3D Secure
                  </span>
                </div>
                <p class="text-[11px] text-slate-500 truncate">
                  {{
                    isCardActive
                      ? "Visa, Mastercard, JCB, American Express"
                      : product?.mode === "sandbox"
                        ? "Pembayaran kartu memerlukan akun live"
                        : "Metode kartu kredit/debit belum aktif pada akun gateway pembayaran ini"
                  }}
                </p>
              </div>
            </div>
            <div class="flex items-center gap-1 shrink-0">
              <span v-if="!isCardActive" class="text-[11px] font-medium text-slate-400 mr-1">
                Belum Aktif
              </span>
              <span
                class="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200"
                >VISA</span
              >
              <span
                class="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200"
                >MC</span
              >
            </div>
          </div>

          <!-- Expanded Card Inputs -->
          <div
            v-if="selectedPaymentRail === 'card' && isCardActive"
            class="px-3 pb-3 pt-2.5 border-t border-slate-200/70 space-y-3 animate-fadeIn"
            @click.stop
          >
            <div>
              <label
                class="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1"
              >
                Nomor Kartu (16 Digit)
              </label>
              <input
                type="text"
                :value="cardNumber"
                @input="handleCardNumberInput"
                placeholder="4000 1234 5678 9010"
                maxlength="19"
                class="w-full text-xs font-mono p-2.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-slate-900 text-slate-900"
              />
            </div>
            <div class="grid grid-cols-2 gap-2">
              <div>
                <label
                  class="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1"
                >
                  Masa Berlaku (MM/YY)
                </label>
                <input
                  type="text"
                  :value="cardExpiry"
                  @input="handleExpiryInput"
                  placeholder="12/28"
                  maxlength="5"
                  class="w-full text-xs font-mono p-2.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-slate-900 text-slate-900"
                />
              </div>
              <div>
                <label
                  class="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1"
                >
                  CVV / CVC (3-4 Digit)
                </label>
                <input
                  type="password"
                  v-model="cardCvv"
                  placeholder="•••"
                  maxlength="4"
                  class="w-full text-xs font-mono p-2.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-slate-900 text-slate-900"
                />
              </div>
            </div>
            <div>
              <label
                class="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1"
              >
                Nama Pemegang Kartu
              </label>
              <input
                type="text"
                v-model="cardHolderName"
                placeholder="NAMA LENGKAP PADA KARTU"
                class="w-full text-xs p-2.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-slate-900 text-slate-900 uppercase"
              />
            </div>
          </div>
        </div>

        <!-- 5. Minimarket Retail -->
        <div
          @click="isRetailActive ? emit('update:selectedPaymentRail', 'retail') : null"
          class="rounded-xl border transition-all overflow-hidden"
          :class="[
            !isRetailActive
              ? 'opacity-65 bg-slate-50/60 border-slate-200 cursor-not-allowed'
              : selectedPaymentRail === 'retail'
                ? 'border-slate-900 bg-slate-50/70 shadow-xs ring-1 ring-slate-900/10 cursor-pointer'
                : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/40 cursor-pointer',
          ]"
        >
          <div class="p-3 flex items-center justify-between gap-3">
            <div class="flex items-center gap-2.5 min-w-0">
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
                />
              </div>
              <div class="p-1.5 rounded-lg bg-rose-50 text-rose-600 shrink-0">
                <Store class="w-4 h-4" />
              </div>
              <div class="min-w-0">
                <div class="flex items-center gap-1.5 flex-wrap">
                  <span class="text-xs font-bold text-slate-900">Minimarket (Retail)</span>
                  <span
                    class="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800"
                  >
                    {{ activeRetailList.length }} Gerai Aktif
                  </span>
                </div>
                <p class="text-[11px] text-slate-500 truncate">
                  {{ activeRetailList.map((r) => r.label).join(", ") }}
                </p>
              </div>
            </div>
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

          <!-- Expanded Retail Selector -->
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
                v-for="ret in activeRetailList"
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
            ? "Nomor VA otomatis terverifikasi"
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
