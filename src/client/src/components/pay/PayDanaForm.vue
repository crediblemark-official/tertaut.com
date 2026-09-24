<script setup lang="ts">
import { computed } from "vue";
import {
  QrCode,
  Building,
  Wallet,
  CreditCard,
  Lock,
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
  payableAmount: number;
  isSubmitting: boolean;
  errorMessage: string;
}>();

const emit = defineEmits<{
  "update:selectedPaymentRail": [value: "qris" | "va" | "ewallet" | "card" | "retail"];
  "update:selectedBank": [value: string];
  pay: [
    payload?: {
      paymentRail: "qris" | "va" | "ewallet" | "card" | "retail";
      vaBank: string;
      ewalletChannel: string;
      retailOutlet: string;
    },
  ];
}>();

const isHosted = computed(() => {
  return props.checkoutMode === "hosted" || props.product?.checkoutMode === "hosted";
});

// Bank yang didukung oleh DANA SNAP Virtual Account
const DANA_BANKS = [
  { id: "BCA", label: "BCA" },
  { id: "MANDIRI", label: "Mandiri" },
  { id: "BRI", label: "BRI" },
  { id: "BNI", label: "BNI" },
  { id: "CIMB", label: "CIMB" },
  { id: "PERMATA", label: "Permata" },
  { id: "BSI", label: "BSI" },
];

const currentBank = computed({
  get: () => props.selectedBank || "BCA",
  set: (val: string) => emit("update:selectedBank", val),
});

function onPayClicked() {
  emit("pay", {
    paymentRail: isHosted.value ? "ewallet" : props.selectedPaymentRail,
    vaBank: currentBank.value,
    ewalletChannel: "DANA",
    retailOutlet: "",
  });
}
</script>

<template>
  <!-- ======================================================== -->
  <!-- 1. DANA HOSTED CHECKOUT (Gapura Cashier Redirect)        -->
  <!-- ======================================================== -->
  <div v-if="isHosted" class="flex-1 flex flex-col justify-between space-y-4 animate-fadeIn">
    <div class="space-y-2.5">
      <label class="block text-xs font-bold text-slate-800 uppercase tracking-wider">
        Metode Pembayaran Tersedia
      </label>

      <!-- Vertical List of Payment Methods for DANA Gapura -->
      <div class="space-y-2">
        <!-- 1. Saldo DANA -->
        <div
          class="flex items-center justify-between p-3 rounded-xl border border-slate-200/90 bg-white shadow-2xs hover:border-slate-300 transition"
        >
          <div class="flex items-center gap-3 min-w-0">
            <div class="p-2 rounded-lg bg-blue-50 text-[#108EE9] shrink-0">
              <Wallet class="w-4 h-4" />
            </div>
            <div class="min-w-0">
              <div class="font-bold text-xs text-slate-900">Saldo DANA</div>
              <div class="text-[11px] text-slate-500 truncate">Debet saldo instan bebas repot</div>
            </div>
          </div>
          <span class="text-[11px] font-semibold text-emerald-600 shrink-0">Instan</span>
        </div>

        <!-- 2. DANA QRIS -->
        <div
          class="flex items-center justify-between p-3 rounded-xl border border-slate-200/90 bg-white shadow-2xs hover:border-slate-300 transition"
        >
          <div class="flex items-center gap-3 min-w-0">
            <div class="p-2 rounded-lg bg-emerald-50 text-emerald-600 shrink-0">
              <QrCode class="w-4 h-4" />
            </div>
            <div class="min-w-0">
              <div class="font-bold text-xs text-slate-900">DANA QRIS</div>
              <div class="text-[11px] text-slate-500 truncate">Scan semua m-Banking & E-Wallet</div>
            </div>
          </div>
          <span class="text-[11px] font-semibold text-emerald-600 shrink-0">Bebas Biaya</span>
        </div>

        <!-- 3. Virtual Account -->
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
                BCA, Mandiri, BRI, BNI & Bank Lainnya
              </div>
            </div>
          </div>
          <span class="text-[11px] font-medium text-slate-400 shrink-0">Otomatis</span>
        </div>

        <!-- 4. Kartu Bank / Direct Debit -->
        <div
          class="flex items-center justify-between p-3 rounded-xl border border-slate-200/90 bg-white shadow-2xs hover:border-slate-300 transition"
        >
          <div class="flex items-center gap-3 min-w-0">
            <div class="p-2 rounded-lg bg-amber-50 text-amber-600 shrink-0">
              <CreditCard class="w-4 h-4" />
            </div>
            <div class="min-w-0">
              <div class="font-bold text-xs text-slate-900">Direct Debit / Kartu Bank</div>
              <div class="text-[11px] text-slate-500 truncate">
                Kartu debit/kredit tersimpan di akun DANA
              </div>
            </div>
          </div>
          <span class="text-[11px] font-medium text-slate-400 shrink-0">3D Secure</span>
        </div>

        <!-- 5. DANA Protection -->
        <div
          class="flex items-center justify-between p-3 rounded-xl border border-slate-200/90 bg-white shadow-2xs hover:border-slate-300 transition"
        >
          <div class="flex items-center gap-3 min-w-0">
            <div class="p-2 rounded-lg bg-indigo-50 text-indigo-600 shrink-0">
              <ShieldCheck class="w-4 h-4" />
            </div>
            <div class="min-w-0">
              <div class="font-bold text-xs text-slate-900">DANA Protection</div>
              <div class="text-[11px] text-slate-500 truncate">
                Jaminan perlindungan transaksi aman 100%
              </div>
            </div>
          </div>
          <span class="text-[11px] font-semibold text-blue-600 shrink-0">Garansi 100%</span>
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

      <!-- Pay Button for DANA Hosted Redirect -->
      <div class="pt-1">
        <button
          @click="onPayClicked"
          :disabled="isSubmitting || !emailInput"
          class="w-full flex items-center justify-center gap-2 rounded-xl active:scale-[0.99] px-4 py-3 text-xs sm:text-sm font-extrabold text-white bg-[#108EE9] hover:bg-[#0c7ac9] shadow-md transition duration-150 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
        >
          <FlaskConical v-if="product.mode === 'sandbox'" class="w-4 h-4 shrink-0" />
          <ExternalLink v-else class="w-4 h-4 text-white shrink-0" />
          <span class="truncate">
            {{
              isSubmitting
                ? "Memproses..."
                : product.mode === "sandbox"
                  ? `Bayar Sandbox — ${formatRupiah(payableAmount || product.targetPrice)}`
                  : `Bayar Sekarang — ${formatRupiah(payableAmount || product.targetPrice)}`
            }}
          </span>
          <ArrowRight v-if="!isSubmitting" class="w-4 h-4 ml-0.5 text-white shrink-0" />
        </button>
        <p v-if="!emailInput" class="text-[11px] text-amber-600 font-semibold text-center mt-1.5">
          * Masukkan email penerima di kolom kiri untuk melanjutkan
        </p>
      </div>
    </div>
  </div>

  <!-- ======================================================== -->
  <!-- 2. DANA FULL CUSTOM UI (Native In-Page)                   -->
  <!-- ======================================================== -->
  <div v-else class="space-y-4 animate-fadeIn">
    <div class="space-y-2.5">
      <div class="flex items-center justify-between px-0.5">
        <label class="block text-xs font-bold text-slate-900 uppercase tracking-wider">
          Pilih Jalur Pembayaran DANA
        </label>
        <span
          class="text-[10px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200"
        >
          DANA SNAP API
        </span>
      </div>

      <div class="space-y-2">
        <!-- 1. DANA QRIS Instan -->
        <div
          @click="emit('update:selectedPaymentRail', 'qris')"
          class="rounded-xl border transition-all cursor-pointer overflow-hidden"
          :class="
            selectedPaymentRail === 'qris'
              ? 'border-[#108EE9] bg-blue-50/40 shadow-xs ring-1 ring-[#108EE9]/30'
              : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/40'
          "
        >
          <div class="p-3 flex items-center justify-between gap-3">
            <div class="flex items-center gap-2.5 min-w-0">
              <div
                class="w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition"
                :class="
                  selectedPaymentRail === 'qris'
                    ? 'border-[#108EE9] bg-[#108EE9]'
                    : 'border-slate-300 bg-white'
                "
              >
                <div
                  v-if="selectedPaymentRail === 'qris'"
                  class="w-1.5 h-1.5 rounded-full bg-white"
                />
              </div>
              <div class="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 shrink-0">
                <QrCode class="w-4 h-4" />
              </div>
              <div class="min-w-0">
                <div class="flex items-center gap-1.5 flex-wrap">
                  <span class="text-xs font-bold text-slate-900">QRIS Instan DANA</span>
                  <span
                    class="text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded bg-amber-100 text-amber-800"
                  >
                    Rekomendasi
                  </span>
                </div>
                <p class="text-[11px] text-slate-500 truncate">
                  Scan via DANA, BCA, Mandiri, BRI, GoPay, OVO
                </p>
              </div>
            </div>
            <span class="text-[11px] font-bold text-emerald-600 shrink-0">Bebas Admin</span>
          </div>
          <div
            v-if="selectedPaymentRail === 'qris'"
            class="px-3 pb-3 pt-1 border-t border-blue-100/70 text-[11px] text-slate-600 flex items-center gap-1.5"
          >
            <Check class="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>Kode QRIS dinamis langsung tampil di layar setelah menekan tombol bayar.</span>
          </div>
        </div>

        <!-- 2. Saldo DANA / E-Wallet -->
        <div
          @click="emit('update:selectedPaymentRail', 'ewallet')"
          class="rounded-xl border transition-all cursor-pointer overflow-hidden"
          :class="
            selectedPaymentRail === 'ewallet'
              ? 'border-[#108EE9] bg-blue-50/40 shadow-xs ring-1 ring-[#108EE9]/30'
              : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/40'
          "
        >
          <div class="p-3 flex items-center justify-between gap-3">
            <div class="flex items-center gap-2.5 min-w-0">
              <div
                class="w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition"
                :class="
                  selectedPaymentRail === 'ewallet'
                    ? 'border-[#108EE9] bg-[#108EE9]'
                    : 'border-slate-300 bg-white'
                "
              >
                <div
                  v-if="selectedPaymentRail === 'ewallet'"
                  class="w-1.5 h-1.5 rounded-full bg-white"
                />
              </div>
              <div class="p-1.5 rounded-lg bg-blue-50 text-[#108EE9] shrink-0">
                <Wallet class="w-4 h-4" />
              </div>
              <div class="min-w-0">
                <span class="text-xs font-bold text-slate-900">Saldo DANA (E-Wallet)</span>
                <p class="text-[11px] text-slate-500 truncate">
                  Pembayaran cepat langsung dari akun DANA Anda
                </p>
              </div>
            </div>
            <span class="text-[11px] font-bold text-slate-600 shrink-0">Akun DANA</span>
          </div>
          <div
            v-if="selectedPaymentRail === 'ewallet'"
            class="px-3 pb-3 pt-1 border-t border-blue-100/70 text-[11px] text-slate-600 flex items-center gap-1.5"
          >
            <Check class="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <span>Konfirmasi instan menggunakan nomor telepon akun DANA terdaftar.</span>
          </div>
        </div>

        <!-- 3. Virtual Account (DANA SNAP VA) -->
        <div
          @click="emit('update:selectedPaymentRail', 'va')"
          class="rounded-xl border transition-all cursor-pointer overflow-hidden"
          :class="
            selectedPaymentRail === 'va'
              ? 'border-[#108EE9] bg-blue-50/40 shadow-xs ring-1 ring-[#108EE9]/30'
              : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/40'
          "
        >
          <div class="p-3 flex items-center justify-between gap-3">
            <div class="flex items-center gap-2.5 min-w-0">
              <div
                class="w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition"
                :class="
                  selectedPaymentRail === 'va'
                    ? 'border-[#108EE9] bg-[#108EE9]'
                    : 'border-slate-300 bg-white'
                "
              >
                <div
                  v-if="selectedPaymentRail === 'va'"
                  class="w-1.5 h-1.5 rounded-full bg-white"
                />
              </div>
              <div class="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 shrink-0">
                <Building class="w-4 h-4" />
              </div>
              <div class="min-w-0">
                <div class="flex items-center gap-1.5 flex-wrap">
                  <span class="text-xs font-bold text-slate-900">Virtual Account</span>
                  <span
                    class="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-indigo-100 text-indigo-700"
                  >
                    DANA VA
                  </span>
                </div>
                <p class="text-[11px] text-slate-500 truncate">
                  BCA, Mandiri, BRI, BNI, CIMB, Permata, BSI
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
            class="px-3 pb-3 pt-2.5 border-t border-blue-100/70 space-y-2 animate-fadeIn"
            @click.stop
          >
            <label class="block text-[10px] font-bold text-slate-600 uppercase tracking-wider">
              Pilih Bank Virtual Account
            </label>
            <div class="grid grid-cols-3 sm:grid-cols-4 gap-2">
              <button
                v-for="bank in DANA_BANKS"
                :key="bank.id"
                type="button"
                @click="currentBank = bank.id"
                class="py-2 px-2.5 rounded-lg border text-xs font-bold transition text-center cursor-pointer flex items-center justify-center gap-1.5"
                :class="
                  currentBank === bank.id
                    ? 'border-[#108EE9] bg-[#108EE9] text-white shadow-xs'
                    : 'border-slate-200 bg-white hover:bg-slate-100 text-slate-700'
                "
              >
                <Check v-if="currentBank === bank.id" class="w-3.5 h-3.5 text-white" />
                <span>{{ bank.label }}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Footnote -->
      <div
        class="flex items-center justify-between text-[11px] font-semibold text-slate-600 px-1 pt-1"
      >
        <span>
          {{
            selectedPaymentRail === "va"
              ? `Nomor VA ${currentBank} otomatis diverifikasi tanpa upload struk`
              : selectedPaymentRail === "ewallet"
                ? "Konfirmasi mudah via aplikasi DANA"
                : "BCA, Mandiri, BRI, BNI, GoPay, OVO, DANA"
          }}
        </span>
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

    <!-- Pay Button for DANA Custom UI -->
    <div class="pt-1">
      <button
        @click="onPayClicked"
        :disabled="isSubmitting || !emailInput"
        class="w-full flex items-center justify-center gap-2 rounded-xl active:scale-[0.99] px-4 py-3 text-xs sm:text-sm font-extrabold text-white bg-[#108EE9] hover:bg-[#0c7ac9] shadow-md transition duration-150 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
      >
        <FlaskConical v-if="product.mode === 'sandbox'" class="w-4 h-4" />
        <Wallet v-else class="w-4 h-4 text-white" />
        <span>
          {{
            isSubmitting
              ? "Membuat kode pembayaran DANA..."
              : product.mode === "sandbox"
                ? `Mulai Sesi Sandbox DANA — ${formatRupiah(payableAmount || product.targetPrice)}`
                : `Bayar via DANA — ${formatRupiah(payableAmount || product.targetPrice)}`
          }}
        </span>
        <ArrowRight v-if="!isSubmitting" class="w-4 h-4 ml-0.5 text-white" />
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
