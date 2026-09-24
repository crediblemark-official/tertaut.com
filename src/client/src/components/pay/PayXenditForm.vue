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
  targetPrice: number;
}

const props = defineProps<{
  product: ProductData;
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
}>();

const isHosted = computed(() => {
  return props.checkoutMode === "hosted" || props.product?.checkoutMode === "hosted";
});

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
  <!-- ======================================================== -->
  <!-- 1. XENDIT HOSTED CHECKOUT (Invoice Redirect)             -->
  <!-- ======================================================== -->
  <div v-if="isHosted" class="flex-1 flex flex-col justify-between space-y-4 animate-fadeIn">
    <div class="space-y-2.5">
      <label class="block text-xs font-bold text-slate-800 uppercase tracking-wider">
        Metode Pembayaran Tersedia
      </label>

      <!-- Vertical List of Payment Methods -->
      <div class="space-y-2">
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
                  <span class="text-xs font-bold text-slate-900">QRIS Instan</span>
                  <span
                    class="text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded bg-amber-100 text-amber-800"
                  >
                    Populer
                  </span>
                </div>
                <p class="text-[11px] text-slate-500 truncate">
                  BCA, Mandiri, BRI, BNI, GoPay, OVO, ...
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
                    9 Bank
                  </span>
                </div>
                <p class="text-[11px] text-slate-500 truncate">
                  BCA, Mandiri, BNI, BRI, BSI, CIMB, Perma...
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
              Pilih Bank Tujuan Transfer
            </label>
            <div class="grid grid-cols-3 sm:grid-cols-4 gap-2">
              <button
                v-for="b in BANKS"
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
          @click="emit('update:selectedPaymentRail', 'ewallet')"
          class="rounded-xl border transition-all cursor-pointer overflow-hidden"
          :class="
            selectedPaymentRail === 'ewallet'
              ? 'border-slate-900 bg-slate-50/70 shadow-xs ring-1 ring-slate-900/10'
              : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/40'
          "
        >
          <div class="p-3 flex items-center justify-between gap-3">
            <div class="flex items-center gap-2.5 min-w-0">
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
                />
              </div>
              <div class="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 shrink-0">
                <Wallet class="w-4 h-4" />
              </div>
              <div class="min-w-0">
                <div class="flex items-center gap-1.5 flex-wrap">
                  <span class="text-xs font-bold text-slate-900">E-Wallet</span>
                  <span
                    class="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-700"
                  >
                    7 Aplikasi
                  </span>
                </div>
                <p class="text-[11px] text-slate-500 truncate">
                  DANA, OVO, ShopeePay, GoPay, Lin...
                </p>
              </div>
            </div>
            <span class="text-[11px] font-bold text-slate-600 shrink-0">
              {{
                selectedPaymentRail === "ewallet"
                  ? SUPPORTED_EWALLETS.find((w) => w.id === currentEwallet)?.label || currentEwallet
                  : "Pilih E-Wallet"
              }}
            </span>
          </div>

          <!-- Expanded E-Wallet Selector -->
          <div
            v-if="selectedPaymentRail === 'ewallet'"
            class="px-3 pb-3 pt-2.5 border-t border-slate-200/70 space-y-2 animate-fadeIn"
            @click.stop
          >
            <label class="block text-[10px] font-bold text-slate-600 uppercase tracking-wider">
              Pilih Layanan E-Wallet
            </label>
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <button
                v-for="ew in SUPPORTED_EWALLETS"
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
          @click="emit('update:selectedPaymentRail', 'card')"
          class="rounded-xl border transition-all cursor-pointer overflow-hidden"
          :class="
            selectedPaymentRail === 'card'
              ? 'border-slate-900 bg-slate-50/70 shadow-xs ring-1 ring-slate-900/10'
              : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/40'
          "
        >
          <div class="p-3 flex items-center justify-between gap-3">
            <div class="flex items-center gap-2.5 min-w-0">
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
                />
              </div>
              <div class="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 shrink-0">
                <CreditCard class="w-4 h-4" />
              </div>
              <div class="min-w-0">
                <div class="flex items-center gap-1.5 flex-wrap">
                  <span class="text-xs font-bold text-slate-900">Kartu Kredit / Debit</span>
                  <span
                    class="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-indigo-100 text-indigo-700"
                  >
                    3D Secure
                  </span>
                </div>
                <p class="text-[11px] text-slate-500 truncate">
                  Visa, Mastercard, JCB, American ...
                </p>
              </div>
            </div>
            <div class="flex items-center gap-1 shrink-0">
              <span
                class="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200"
                >VISA</span
              >
              <span
                class="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200"
                >MC</span
              >
              <span
                class="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200"
                >JCB</span
              >
            </div>
          </div>

          <!-- Expanded Card Inputs -->
          <div
            v-if="selectedPaymentRail === 'card'"
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
          @click="emit('update:selectedPaymentRail', 'retail')"
          class="rounded-xl border transition-all cursor-pointer overflow-hidden"
          :class="
            selectedPaymentRail === 'retail'
              ? 'border-slate-900 bg-slate-50/70 shadow-xs ring-1 ring-slate-900/10'
              : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/40'
          "
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
                    Tunai Kasir
                  </span>
                </div>
                <p class="text-[11px] text-slate-500 truncate">
                  Alfamart, Indomaret, Alfamidi, Dan+Dan
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
