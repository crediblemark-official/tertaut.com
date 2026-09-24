<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from "vue";
import { useRoute } from "vue-router";
import { api } from "../lib/api";
import { ShieldCheck, Lock, ArrowLeft, FlaskConical } from "lucide-vue-next";
import PayOrderSummary from "../components/pay/PayOrderSummary.vue";
import PayPaymentForm from "../components/pay/PayPaymentForm.vue";

const route = useRoute();

// Can be /pay/:slug or /pay?app_id=...&amount=...
const slug = computed(
  () =>
    (route.params.slug as string) ||
    (route.query.app_slug as string) ||
    (route.query.slug as string) ||
    ""
);
const queryAppId = computed(() => (route.query.app_id as string) || "");
const queryAmount = computed(() => (route.query.amount ? Number(route.query.amount) : null));
const queryProductName = computed(() => (route.query.product_name as string) || "");
const queryGrantDays = computed(() =>
  route.query.grant_days ? Number(route.query.grant_days) : 30
);
const queryRedirectUrl = computed(() => (route.query.redirect_url as string) || "");

const product = ref<{
  id: string;
  name: string;
  slug: string;
  mode: "sandbox" | "live";
  targetPrice: number;
  description: string | null;
  headline: string | null;
  subheadline: string | null;
  mediaUrl: string | null;
  valueProps: string[];
  redirectUrl: string | null;
} | null>(null);

const emailInput = ref("");
const couponInput = ref("");
const appliedCoupon = ref<{ code: string; discountPercent: number; discountAmount: number } | null>(
  null
);
const couponError = ref("");
const loading = ref(true);
const notFound = ref(false);
const isSubmitting = ref(false);
const errorMessage = ref("");
const selectedPaymentRail = ref<"qris" | "va" | "ewallet">("qris");
const selectedBank = ref("BCA");
const activeCustomOrder = ref<{
  transactionId: string;
  scenario?: string;
  paymentRail?: string;
  paymentCode?: string;
  qrDataUrl?: string;
  vaBank?: string;
  amount?: number;
  checkoutUrl?: string;
  ticket?: string;
} | null>(null);
const isPaid = ref(false);
const paidResult = ref<{ licenseKey?: string; message?: string } | null>(null);
let pollTimer: any = null;

// Poll ticket (BUG-5): bukti kepemilikan transaksi untuk polling status publik.
// Diterima dari respons createCheckoutSession atau dari redirect finish (?ticket=...).
let currentTicket = "";

const isMobileOrderExpanded = ref(false);

/** Estimasi diskon & total bayar untuk pratinjau langsung saat mengetik kupon. */
const estimatedDiscount = computed(() => {
  if (!product.value || !appliedCoupon.value) return 0;
  return Math.min(appliedCoupon.value.discountAmount, product.value.targetPrice);
});
const payableAmount = computed(() =>
  product.value ? Math.max(0, product.value.targetPrice - estimatedDiscount.value) : 0
);

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

function startPolling(txId: string) {
  stopPolling();
  pollTimer = setInterval(async () => {
    try {
      const res = await api.getPaymentStatus(txId, currentTicket);
      if (res && res.paymentStatus === "PAID") {
        stopPolling();
        isPaid.value = true;
        paidResult.value = {
          licenseKey: res.licenseKey || undefined,
          message: "Pembayaran DANA berhasil diverifikasi secara instan.",
        };
      } else if (res && (res.paymentStatus === "EXPIRED" || res.paymentStatus === "FAILED")) {
        stopPolling();
        errorMessage.value = "Sesi pembayaran ini telah kedaluwarsa atau gagal. Silakan coba lagi.";
        activeCustomOrder.value = null;
      }
    } catch {}
  }, 2500);
}

async function loadCheckoutData() {
  loading.value = true;
  errorMessage.value = "";
  try {
    const identifier = slug.value || queryAppId.value;
    if (!identifier) {
      notFound.value = true;
      return;
    }

    let loadedApp: any = null;
    try {
      const data = await api.getAppBySlug(identifier);
      if (data && data.id) {
        loadedApp = data;
      }
    } catch {
      try {
        const json = await api.getApps();
        if (json.apps) {
          const found = json.apps.find((a: any) => a.slug === identifier || a.id === identifier);
          if (found) {
            loadedApp = found;
          }
        }
      } catch {}
    }

    if (!loadedApp) {
      if (identifier === "fastmail-ai") {
        loadedApp = {
          id: "app_fastmail_ai",
          name: "FastMail AI Summarizer",
          slug: "fastmail-ai",
          mode: "sandbox",
          targetPrice: 49000,
          description:
            "Ekstensi Chrome & web app untuk merangkum email penting secara otomatis menggunakan Gemini AI.",
          headline: "FastMail AI Summarizer",
          subheadline: "Solusi software cerdas & lisensi otomatis resmi.",
          valueProps: [
            "Aktivasi instan dan otomatis via email",
            "Lisensi resmi terikat hardware / device",
            "Update versi & dukungan pelanggan langsung",
          ],
        };
      } else {
        notFound.value = true;
        return;
      }
    }

    setProductData(loadedApp);

    // Cek jika halaman dibuka dengan parameter externalId (misal dari redirect finish / link transaksi)
    const externalIdParam = (route.query.externalId as string) || "";
    if (externalIdParam) {
      // Ticket polling disematkan server saat redirect finish ke /pay (BUG-5)
      currentTicket = (route.query.ticket as string) || "";
      try {
        const statusRes = await api.getPaymentStatus(externalIdParam, currentTicket);
        if (statusRes && statusRes.success) {
          if (statusRes.paymentStatus === "PAID") {
            isPaid.value = true;
            paidResult.value = {
              licenseKey: statusRes.licenseKey || undefined,
              message: "Pembayaran DANA berhasil diverifikasi.",
            };
          } else if (statusRes.paymentStatus === "PENDING") {
            activeCustomOrder.value = {
              transactionId: statusRes.transactionId || externalIdParam,
              paymentRail: statusRes.channel?.toLowerCase().includes("va") ? "va" : "qris",
              paymentCode: statusRes.paymentCode,
              qrDataUrl: statusRes.qrDataUrl,
              amount: statusRes.amount || payableAmount.value,
              checkoutUrl: statusRes.checkoutUrl,
            };
            startPolling(statusRes.transactionId || externalIdParam);
          }
        }
      } catch {}
    }
  } catch (err: any) {
    errorMessage.value = err.message || "Gagal memuat produk pembayaran";
  } finally {
    loading.value = false;
  }
}

async function applyCoupon() {
  if (!product.value || !couponInput.value.trim()) return;
  couponError.value = "";
  appliedCoupon.value = null;

  try {
    const data = await api.previewCoupon({
      appId: product.value.id,
      couponCode: couponInput.value.trim(),
      amount: product.value.targetPrice,
    });
    if (!data.valid || !data.coupon) {
      couponError.value = data.message || data.error || "Kupon tidak valid";
      return;
    }
    appliedCoupon.value = {
      code: data.coupon.code,
      discountPercent: data.discountPercent || 0,
      discountAmount: data.discountAmount || 0,
    };
  } catch (err: any) {
    couponError.value = err.message || "Gagal memvalidasi kupon. Coba lagi.";
  }
}

function setProductData(app: any) {
  product.value = {
    id: app.id,
    name: queryProductName.value || app.name,
    slug: app.slug || "",
    mode: app.mode || "live",
    targetPrice: queryAmount.value || app.targetPrice || 0,
    description: app.description || "Solusi software premium otomatis & berlisensi resmi.",
    headline: app.headline || null,
    subheadline: app.subheadline || null,
    mediaUrl: app.mediaUrl || null,
    valueProps: Array.isArray(app.valueProps)
      ? app.valueProps
      : app.valueProps
        ? JSON.parse(app.valueProps)
        : [
            "Aktivasi instan dan otomatis via email",
            "Lisensi resmi terikat hardware / device",
            "Update versi & dukungan pelanggan langsung",
          ],
    redirectUrl: queryRedirectUrl.value || app.redirectUrl || null,
  };
}

async function handlePay() {
  if (!product.value || !emailInput.value) return;
  isSubmitting.value = true;
  errorMessage.value = "";
  isPaid.value = false;
  paidResult.value = null;

  try {
    const isCustomScenario =
      selectedPaymentRail.value === "qris" ||
      selectedPaymentRail.value === "va" ||
      selectedPaymentRail.value === "ewallet";
    const data = await api.createCheckoutSession({
      appId: product.value.id,
      customerEmail: emailInput.value,
      amount: product.value.targetPrice,
      preferredPaymentChannel: selectedPaymentRail.value,
      paymentRail: selectedPaymentRail.value,
      scenario: isCustomScenario ? "API" : "REDIRECT",
      vaBank: selectedBank.value,
      redirectUrl: product.value.redirectUrl || `${window.location.origin}/dashboard`,
      couponCode: appliedCoupon.value?.code || couponInput.value.trim() || undefined,
    });

    if (!data.success) {
      errorMessage.value = data.error || "Gagal menyiapkan sesi checkout";
      return;
    }

    const activeExtId =
      (data as any).externalId || (data as any).data?.externalId || data.transactionId;
    if (activeExtId && typeof window !== "undefined") {
      const currentUrl = new URL(window.location.href);
      currentUrl.searchParams.set("externalId", activeExtId);
      window.history.replaceState({}, "", currentUrl.toString());
    }

    // Simpan ticket polling (BUG-5) supaya licenseKey tidak bocor ke pemegang txId saja.
    currentTicket = data.ticket || (data as any).data?.ticket || "";

    if (data.scenario === "API" && (data.paymentCode || data.qrDataUrl)) {
      activeCustomOrder.value = {
        transactionId: data.transactionId || "",
        scenario: data.scenario,
        paymentRail: data.paymentRail || selectedPaymentRail.value,
        paymentCode: data.paymentCode,
        qrDataUrl: data.qrDataUrl,
        vaBank: data.vaBank || selectedBank.value,
        amount: data.amount || payableAmount.value,
        checkoutUrl: data.checkoutUrl,
        ticket: currentTicket,
      };
      if (data.transactionId) {
        startPolling(data.transactionId);
      }
    } else if (data.checkoutUrl) {
      window.location.href = data.checkoutUrl;
    }
  } catch (err: any) {
    errorMessage.value = err.message || "Terjadi kesalahan jaringan";
  } finally {
    isSubmitting.value = false;
  }
}

onMounted(() => {
  loadCheckoutData();
});

onUnmounted(() => {
  stopPolling();
});
</script>

<template>
  <div
    class="relative min-h-screen lg:h-screen lg:max-h-screen bg-[#090A0C] text-white flex flex-col justify-start lg:justify-center items-center p-3 sm:p-5 lg:p-6 overflow-y-auto lg:overflow-hidden selection:bg-gold/30 selection:text-white py-4 sm:py-6"
  >
    <!-- Ambient Lighting & Developer Grid Background -->
    <div class="fixed inset-0 pointer-events-none z-0">
      <div
        class="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:40px_40px]"
      ></div>
      <div
        class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[650px] h-[450px] bg-gradient-to-tr from-forest/20 via-gold/10 to-transparent rounded-full blur-[140px]"
      ></div>
    </div>

    <!-- Loading State -->
    <div
      v-if="loading"
      class="relative z-10 flex flex-col items-center justify-center text-white/70 text-xs gap-3 p-8 my-auto"
    >
      <div
        class="w-6 h-6 border-2 border-gold border-t-transparent rounded-full animate-spin"
      ></div>
      <span class="font-mono text-[11px]">Menyiapkan sesi checkout aman tertaut.com...</span>
    </div>

    <!-- Not Found State -->
    <div
      v-else-if="notFound"
      class="relative z-10 w-full max-w-md rounded-2xl border border-white/10 bg-[#111215]/95 backdrop-blur-2xl p-8 text-center space-y-4 shadow-2xl my-auto"
    >
      <div
        class="w-12 h-12 mx-auto rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400"
      >
        <Lock class="w-5 h-5" />
      </div>
      <div>
        <h1 class="text-base font-bold text-white">Produk Pembayaran Tidak Ditemukan</h1>
        <p class="text-xs text-white/50 mt-1 leading-relaxed">
          Tautan checkout tidak valid, kedaluwarsa, atau produk belum diluncurkan.
        </p>
      </div>
      <router-link
        to="/"
        class="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gold text-black text-xs font-bold hover:bg-gold-muted transition"
      >
        <span>Kembali ke Beranda</span>
      </router-link>
    </div>

    <!-- Active Checkout Master Container -->
    <template v-else-if="product">
      <!-- Top Navigation Bar (Aligned with Master Card width) -->
      <div
        class="relative z-10 w-full max-w-4xl mb-2 sm:mb-3 flex items-center justify-between px-1 shrink-0"
      >
        <router-link
          to="/"
          class="inline-flex items-center gap-1.5 text-xs font-semibold text-white/60 hover:text-white transition group"
        >
          <ArrowLeft class="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition" />
          <span>Kembali ke Beranda</span>
        </router-link>

        <div class="flex items-center gap-3 text-xs">
          <div
            v-if="product.mode === 'sandbox'"
            class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-400 text-[11px] font-mono"
          >
            <FlaskConical class="w-3 h-3" />
            <span>Sandbox Mode</span>
          </div>
          <div
            v-else
            class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-[11px] font-mono"
          >
            <ShieldCheck class="w-3 h-3" />
            <span>MoR Secured</span>
          </div>
          <span class="w-1 h-1 rounded-full bg-white/20"></span>
          <span class="text-[11px] text-white/40 font-mono">256-Bit MoR</span>
        </div>
      </div>

      <!-- Master Unified Luxury Card (50/50 Precision Split, High Contrast) -->
      <div
        class="relative z-10 w-full max-w-4xl h-auto lg:h-[560px] lg:max-h-[calc(100vh-4rem)] rounded-2xl border border-slate-200/90 bg-white text-slate-900 shadow-[0_25px_70px_rgba(0,0,0,0.6)] overflow-hidden grid grid-cols-1 lg:grid-cols-2 shrink-0 my-auto"
      >
        <!-- LEFT PANE: Order Summary & Product Details (Desktop & Mobile) -->
        <PayOrderSummary
          :product="product"
          :email-input="emailInput"
          :active-order="activeCustomOrder"
          :is-paid="isPaid"
          :applied-coupon="appliedCoupon"
          :coupon-input="couponInput"
          :coupon-error="couponError"
          :estimated-discount="estimatedDiscount"
          :payable-amount="payableAmount"
          :is-mobile-order-expanded="isMobileOrderExpanded"
          @update:email-input="emailInput = $event"
          @update:coupon-input="couponInput = $event"
          @update:is-mobile-order-expanded="isMobileOrderExpanded = $event"
          @apply-coupon="applyCoupon"
          @remove-coupon="
            appliedCoupon = null;
            couponInput = '';
          "
          @pay="handlePay"
        />

        <!-- RIGHT PANE: Payment Form & Multi-Rail Selection -->
        <div class="flex flex-col h-full overflow-hidden bg-white text-slate-900">
          <div
            class="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-7 xl:p-8 custom-scrollbar flex flex-col justify-between"
          >
            <PayPaymentForm
              :product="product"
              :email-input="emailInput"
              :selected-payment-rail="selectedPaymentRail"
              :selected-bank="selectedBank"
              :payable-amount="payableAmount"
              :is-submitting="isSubmitting"
              :error-message="errorMessage"
              :active-order="activeCustomOrder"
              :is-paid="isPaid"
              :paid-result="paidResult"
              @update:selected-payment-rail="selectedPaymentRail = $event"
              @update:selected-bank="selectedBank = $event"
              @reset-order="
                activeCustomOrder = null;
                stopPolling();
              "
              @pay="handlePay"
            />
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
/* Internal sleek scrollbar for container */
.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.12);
  border-radius: 9999px;
}

.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.25);
}

/* Light mode seamless autofill styling */
.auth-input:-webkit-autofill,
.auth-input:-webkit-autofill:hover,
.auth-input:-webkit-autofill:focus,
.auth-input:-webkit-autofill:active {
  -webkit-box-shadow: 0 0 0 30px #ffffff inset !important;
  -webkit-text-fill-color: #0f172a !important;
  caret-color: #0f172a !important;
  transition: background-color 5000s ease-in-out 0s;
}
</style>
