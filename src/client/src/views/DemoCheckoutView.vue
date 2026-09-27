<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { api } from "../lib/api";
import { Lock, ArrowLeft, FlaskConical, CheckCircle2 } from "lucide-vue-next";
import PayOrderSummary from "../components/pay/PayOrderSummary.vue";
import PayPaymentForm from "../components/pay/PayPaymentForm.vue";

const route = useRoute();
const router = useRouter();

/** Slug produk demo (default: fastmail-ai jika tidak dispesifikasikan) */
const slug = computed(
  () =>
    (route.params.slug as string) ||
    (route.query.app_slug as string) ||
    (route.query.slug as string) ||
    "fastmail-ai"
);

const queryAppId = computed(() => (route.query.app_id as string) || "");
const queryAmount = computed(() => (route.query.amount ? Number(route.query.amount) : null));
const queryProductName = computed(() => (route.query.product_name as string) || "");
const queryRedirectUrl = computed(() => (route.query.redirect_url as string) || "");

/** Resolusi Payment Gateway dari query parameter (?gateway=xenith | dana | xendit) */
const queryPaymentGateway = computed<"xenithpay" | "dana" | "xendit">(() => {
  const g = String(route.query.gateway || route.query.payment_gateway || "")
    .toLowerCase()
    .trim();
  if (g === "xenith" || g === "xenithpay") return "xenithpay";
  if (g === "xendit") return "xendit";
  if (g === "dana") return "dana";
  return "xenithpay"; // Default untuk pengajuan audit
});

const activeGateway = ref<"xenithpay" | "dana" | "xendit">(queryPaymentGateway.value);

watch(queryPaymentGateway, (newG) => {
  activeGateway.value = newG;
  if (
    newG === "xenithpay" &&
    selectedPaymentRail.value !== "va" &&
    selectedPaymentRail.value !== "qris"
  ) {
    selectedPaymentRail.value = "va";
    selectedBank.value = "BNI";
  }
});

function switchGateway(gw: "xenithpay" | "dana" | "xendit") {
  activeGateway.value = gw;
  const q = { ...route.query, gateway: gw === "xenithpay" ? "xenith" : gw };
  router.replace({ query: q });
  if (gw === "xenithpay") {
    selectedPaymentRail.value = "va";
    selectedBank.value = "BNI";
  } else if (gw === "dana") {
    selectedPaymentRail.value = "qris";
    selectedEwallet.value = "DANA";
  } else {
    selectedPaymentRail.value = "va";
    selectedBank.value = "BCA";
  }
}

const queryPaymentRail = computed(() => {
  const rail = String(route.query.rail || route.query.payment_rail || "").toLowerCase();
  return (["qris", "va", "ewallet", "card", "retail"].includes(rail) ? rail : "") as
    "qris" | "va" | "ewallet" | "card" | "retail" | "";
});

const queryBank = computed(() =>
  String(route.query.bank || route.query.va_bank || "").toUpperCase()
);
const queryEwallet = computed(() => String(route.query.ewallet || "").toUpperCase());
const queryRetailOutlet = computed(() => String(route.query.outlet || "").toUpperCase());

const product = ref<{
  id: string;
  name: string;
  slug: string;
  mode: "sandbox" | "live";
  checkoutMode: "custom" | "hosted";
  activePaymentGateway: "dana" | "xendit" | "xenithpay";
  targetPrice: number;
  description: string | null;
  headline: string | null;
  subheadline: string | null;
  mediaUrl: string | null;
  valueProps: string[];
  redirectUrl: string | null;
} | null>(null);

const emailInput = ref("auditor.mitra@xenithpay.com");
const couponInput = ref("");
const appliedCoupon = ref<{ code: string; discountPercent: number; discountAmount: number } | null>(
  null
);
const couponError = ref("");
const loading = ref(true);
const notFound = ref(false);
const isSubmitting = ref(false);
const errorMessage = ref("");

const selectedPaymentRail = ref<"qris" | "va" | "ewallet" | "card" | "retail">(
  queryPaymentRail.value || (activeGateway.value === "xenithpay" ? "va" : "qris")
);
const selectedBank = ref(queryBank.value || (activeGateway.value === "xenithpay" ? "BNI" : "BCA"));
const selectedEwallet = ref(queryEwallet.value || "DANA");
const selectedRetail = ref(queryRetailOutlet.value || "ALFAMART");

const activeCustomOrder = ref<{
  transactionId: string;
  scenario?: string;
  paymentRail?: string;
  paymentCode?: string;
  qrDataUrl?: string;
  vaBank?: string;
  ewalletChannel?: string;
  retailOutlet?: string;
  amount?: number;
  checkoutUrl?: string;
  ticket?: string;
} | null>(null);

const isPaid = ref(false);
const paidResult = ref<{ licenseKey?: string; message?: string } | null>(null);
let pollTimer: any = null;
let currentTicket = "";
const isMobileOrderExpanded = ref(false);

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
          message: "Pembayaran berhasil diverifikasi secara instan pada mode demo.",
        };
      } else if (res && (res.paymentStatus === "EXPIRED" || res.paymentStatus === "FAILED")) {
        stopPolling();
        errorMessage.value = "Sesi pembayaran ini telah kedaluwarsa atau gagal. Silakan coba lagi.";
        activeCustomOrder.value = null;
      }
    } catch {}
  }, 2500);
}

function resetCheckoutOrder() {
  activeCustomOrder.value = null;
  isPaid.value = false;
  paidResult.value = null;
  stopPolling();
  const query = { ...route.query };
  delete query.externalId;
  delete query.ticket;
  router.replace({ query });
}

/** Fallback produk resmi FastMail AI untuk demo audit mandiri */
const DEFAULT_DEMO_PRODUCT = {
  id: "app_fastmail_ai",
  name: "FastMail AI Summarizer",
  slug: "fastmail-ai",
  mode: "sandbox" as const,
  checkoutMode: "custom" as const,
  activePaymentGateway: activeGateway.value,
  targetPrice: 49000,
  description:
    "Ekstensi Chrome & web app untuk merangkum email penting secara otomatis menggunakan Gemini AI.",
  headline: "FastMail AI Summarizer",
  subheadline: "Lisensi universal software dengan aktivasi Ed25519 terikat hardware.",
  mediaUrl:
    "https://images.unsplash.com/photo-1557804506-669a67965ba0?auto=format&fit=crop&w=800&q=80",
  valueProps: [
    "Aktivasi lisensi resmi terikat hardware (HWID)",
    "Masa berlaku 365 hari dengan offline grace token 30 hari",
    "Pembaruan versi otomatis & dukungan teknis langsung",
  ],
  redirectUrl: null,
};

async function loadCheckoutData() {
  loading.value = true;
  errorMessage.value = "";
  try {
    const identifier = slug.value || queryAppId.value || "fastmail-ai";
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
          if (found) loadedApp = found;
        }
      } catch {}
    }

    // Jika app tidak ada di database, gunakan default produk demo
    if (!loadedApp) {
      loadedApp = { ...DEFAULT_DEMO_PRODUCT, slug: identifier };
    }

    setProductData(loadedApp);

    const externalIdParam = (route.query.externalId as string) || "";
    if (externalIdParam) {
      currentTicket = (route.query.ticket as string) || "";
      try {
        const statusRes = await api.getPaymentStatus(externalIdParam, currentTicket);
        if (statusRes && statusRes.success) {
          if (statusRes.paymentStatus === "PAID") {
            isPaid.value = true;
            paidResult.value = {
              licenseKey: statusRes.licenseKey || undefined,
              message: "Pembayaran berhasil diverifikasi.",
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
    errorMessage.value = err.message || "Gagal memuat produk demo";
  } finally {
    loading.value = false;
  }
}

function setProductData(app: any) {
  product.value = {
    id: app.id || "app_fastmail_ai",
    name: queryProductName.value || app.name || "FastMail AI Summarizer",
    slug: app.slug || "fastmail-ai",
    mode: "sandbox",
    checkoutMode: "custom",
    activePaymentGateway: activeGateway.value,
    targetPrice: queryAmount.value || app.targetPrice || 49000,
    description: app.description || "Solusi software premium otomatis & berlisensi resmi.",
    headline: app.headline || "FastMail AI Summarizer",
    subheadline: app.subheadline || "Lisensi universal software dengan aktivasi Ed25519.",
    mediaUrl: app.mediaUrl || DEFAULT_DEMO_PRODUCT.mediaUrl,
    valueProps:
      Array.isArray(app.valueProps) && app.valueProps.length > 0
        ? app.valueProps
        : DEFAULT_DEMO_PRODUCT.valueProps,
    redirectUrl: queryRedirectUrl.value || app.redirectUrl || null,
  };
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

async function handlePay(payload?: {
  paymentRail?: "qris" | "va" | "ewallet" | "card" | "retail";
  vaBank?: string;
  ewalletChannel?: string;
  retailOutlet?: string;
}) {
  if (!product.value || !emailInput.value) return;
  isSubmitting.value = true;
  errorMessage.value = "";
  isPaid.value = false;
  paidResult.value = null;

  const rail = payload?.paymentRail || selectedPaymentRail.value;
  const bank = payload?.vaBank || selectedBank.value;
  const ewallet = payload?.ewalletChannel || selectedEwallet.value;
  const retail = payload?.retailOutlet || selectedRetail.value;

  try {
    const data = await api.createCheckoutSession({
      appId: product.value.id,
      paymentGateway: activeGateway.value,
      demoMode: true,
      customerEmail: emailInput.value,
      amount: product.value.targetPrice,
      preferredPaymentChannel: rail,
      paymentRail: rail,
      vaBank: bank,
      ewalletChannel: ewallet,
      retailOutlet: retail,
      redirectUrl: product.value.redirectUrl || `${window.location.origin}/dashboard`,
      couponCode: appliedCoupon.value?.code || couponInput.value.trim() || undefined,
    });

    if (!data.success) {
      const rawErr = (data as any).error;
      errorMessage.value =
        typeof rawErr === "string"
          ? rawErr
          : typeof rawErr?.message === "string"
            ? rawErr.message
            : typeof (data as any).message === "string"
              ? (data as any).message
              : "Gagal menyiapkan sesi checkout demo";
      return;
    }

    const activeExtId =
      (data as any).externalId || (data as any).data?.externalId || data.transactionId;
    if (activeExtId && typeof window !== "undefined") {
      const currentUrl = new URL(window.location.href);
      currentUrl.searchParams.set("externalId", activeExtId);
      window.history.replaceState({}, "", currentUrl.toString());
    }

    currentTicket = data.ticket || (data as any).data?.ticket || "";

    const orderResult = (data as any).data || data;
    const txId = orderResult.transactionId || orderResult.externalId || data.transactionId;

    activeCustomOrder.value = {
      transactionId: txId,
      scenario: orderResult.scenario || "API",
      paymentRail: rail,
      paymentCode: orderResult.paymentCode || orderResult.externalId || txId,
      qrDataUrl: orderResult.qrDataUrl,
      vaBank: bank,
      ewalletChannel: ewallet,
      retailOutlet: retail,
      amount: payableAmount.value,
      checkoutUrl: orderResult.checkoutUrl,
      ticket: currentTicket,
    };

    if (txId) {
      startPolling(txId);
    }
  } catch (err: any) {
    errorMessage.value = err.message || "Gagal menghubungkan ke payment gateway demo";
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
    class="min-h-screen w-full bg-[#0a0b0d] text-white flex flex-col items-center justify-start lg:justify-center p-3 sm:p-5 lg:p-6 relative overflow-x-hidden selection:bg-gold selection:text-black"
  >
    <!-- Background Radial Aura -->
    <div
      class="fixed inset-0 pointer-events-none bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,rgba(217,119,6,0.12),transparent_70%)]"
    ></div>

    <!-- Loading State -->
    <div
      v-if="loading"
      class="relative z-10 flex flex-col items-center justify-center text-white/70 text-xs gap-3 p-8 my-auto"
    >
      <div
        class="w-6 h-6 border-2 border-amber-400 border-t-transparent rounded-full animate-spin"
      ></div>
      <span class="font-mono text-[11px]">Menyiapkan Sesi Demo Checkout Partner Audit...</span>
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
        <h1 class="text-base font-bold text-white">Produk Demo Tidak Ditemukan</h1>
      </div>
      <router-link
        to="/"
        class="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-400 text-black text-xs font-bold hover:bg-amber-300 transition"
      >
        <span>Kembali ke Beranda</span>
      </router-link>
    </div>

    <!-- Active Demo Checkout Master Container -->
    <template v-else-if="product">
      <!-- Top Demo Banner & Partner Switcher Bar -->
      <div
        class="relative z-10 w-full max-w-4xl mb-3 flex flex-wrap items-center justify-between gap-3 px-1 shrink-0"
      >
        <router-link
          to="/"
          class="inline-flex items-center gap-1.5 text-xs font-semibold text-white/60 hover:text-white transition group"
        >
          <ArrowLeft class="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition" />
          <span>Kembali ke Beranda</span>
        </router-link>

        <!-- Gateway Switcher Pills -->
        <div
          class="flex items-center gap-1.5 bg-white/5 border border-white/10 p-1 rounded-xl text-xs"
        >
          <span class="text-[11px] font-mono text-white/50 px-2 flex items-center gap-1">
            <FlaskConical class="w-3.5 h-3.5 text-amber-400" />
            Gateway:
          </span>
          <button
            type="button"
            @click="switchGateway('xenithpay')"
            :class="[
              'px-2.5 py-1 rounded-lg text-[11px] font-semibold transition flex items-center gap-1.5',
              activeGateway === 'xenithpay'
                ? 'bg-amber-400 text-black shadow-sm'
                : 'text-white/60 hover:text-white hover:bg-white/5',
            ]"
          >
            <span>XenithPay</span>
            <CheckCircle2 v-if="activeGateway === 'xenithpay'" class="w-3 h-3" />
          </button>
          <button
            type="button"
            @click="switchGateway('dana')"
            :class="[
              'px-2.5 py-1 rounded-lg text-[11px] font-semibold transition flex items-center gap-1.5',
              activeGateway === 'dana'
                ? 'bg-blue-500 text-white shadow-sm'
                : 'text-white/60 hover:text-white hover:bg-white/5',
            ]"
          >
            <span>DANA</span>
            <CheckCircle2 v-if="activeGateway === 'dana'" class="w-3 h-3" />
          </button>
          <button
            type="button"
            @click="switchGateway('xendit')"
            :class="[
              'px-2.5 py-1 rounded-lg text-[11px] font-semibold transition flex items-center gap-1.5',
              activeGateway === 'xendit'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-white/60 hover:text-white hover:bg-white/5',
            ]"
          >
            <span>Xendit</span>
            <CheckCircle2 v-if="activeGateway === 'xendit'" class="w-3 h-3" />
          </button>
        </div>
      </div>

      <!-- Master Unified Card -->
      <div
        class="relative z-10 w-full max-w-4xl h-auto lg:h-[560px] lg:max-h-[calc(100vh-4rem)] rounded-2xl border border-slate-200/90 bg-white text-slate-900 shadow-[0_25px_70px_rgba(0,0,0,0.6)] overflow-hidden grid grid-cols-1 lg:grid-cols-2 shrink-0 my-auto"
      >
        <!-- LEFT PANE: Order Summary -->
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
              checkout-mode="custom"
              :active-gateway="activeGateway"
              :demo-mode="true"
              :email-input="emailInput"
              :selected-payment-rail="selectedPaymentRail"
              :selected-bank="selectedBank"
              :selected-ewallet="selectedEwallet"
              :selected-retail="selectedRetail"
              :payable-amount="payableAmount"
              :is-submitting="isSubmitting"
              :error-message="errorMessage"
              :active-order="activeCustomOrder"
              :is-paid="isPaid"
              :paid-result="paidResult"
              @update:selected-payment-rail="selectedPaymentRail = $event"
              @update:selected-bank="selectedBank = $event"
              @update:selected-ewallet="selectedEwallet = $event"
              @update:selected-retail="selectedRetail = $event"
              @reset-order="resetCheckoutOrder"
              @pay="handlePay"
            />
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.1);
  border-radius: 9999px;
}
</style>
