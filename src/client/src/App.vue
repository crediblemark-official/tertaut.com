<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { api } from "./lib/api";
import { authClient } from "./lib/auth";
import { dashboardEnv, envPath, SANDBOX_PREFIX, type DashboardEnv } from "./lib/environment";
import DashboardSidebar from "./components/common/DashboardSidebar.vue";
import DashboardTopHeader from "./components/common/DashboardTopHeader.vue";
import MobileNav from "./components/common/MobileNav.vue";
import ConfirmModal from "./components/common/ConfirmModal.vue";
import { useConfirm } from "./composables/useConfirm";
import { RefreshCw } from "lucide-vue-next";

const route = useRoute();
const router = useRouter();
const env = dashboardEnv;
const { confirm, handleCancel: cancelConfirm } = useConfirm();

const isPageNavigating = ref(false);
let navigationTimeout: ReturnType<typeof setTimeout> | null = null;

router.beforeEach((to, from) => {
  if (to.path !== from.path) {
    cancelConfirm();
    if (navigationTimeout) clearTimeout(navigationTimeout);
    isPageNavigating.value = true;
  }
});

router.afterEach(() => {
  navigationTimeout = setTimeout(() => {
    isPageNavigating.value = false;
  }, 200);
});

const authSession = authClient.useSession();
const fallbackUser = ref<{ name?: string; email?: string } | null>(null);
const authUser = computed(() => authSession.value?.data?.user || fallbackUser.value);
const authInitial = computed(() =>
  (authUser.value?.name || authUser.value?.email || "B").charAt(0).toUpperCase()
);

async function ensureAuthUser() {
  if (authSession.value?.data?.user) return;
  try {
    const res = await api.getBuilderMyself();
    if (res?.builder) {
      fallbackUser.value = {
        name: res.builder.name,
        email: res.builder.email,
      };
    }
  } catch {}
}

async function handleLogout() {
  try {
    await authClient.signOut();
  } catch {}
  fallbackUser.value = null;
  window.location.href = "/login";
}

const isStandaloneLayout = computed(
  () => !!route.meta.public || !!route.meta.standalone || route.path.startsWith("/panel")
);

function pageKey(path: string): string {
  const stripped = path.startsWith(SANDBOX_PREFIX)
    ? path.slice(SANDBOX_PREFIX.length)
    : path.startsWith("/dashboard")
      ? path.slice("/dashboard".length)
      : path;
  return stripped || "/";
}
const navKey = computed(() => pageKey(route.path));

const currentPage = computed(() => {
  switch (navKey.value) {
    case "/":
      return { title: "Ringkasan", category: "Overview" };
    case "/projects":
    case "/apps":
      return { title: "Aplikasi", category: "Utama" };
    case "/payments":
      return { title: "Transaksi", category: "Managed Payment" };
    case "/subscriptions":
      return { title: "Langganan", category: "Managed Payment" };
    case "/balances":
      return { title: "Saldo & Payout", category: "Managed Payment" };
    case "/checkout":
      return { title: "Checkout", category: "Managed Payment" };
    case "/coupons":
      return { title: "Kupon Promo", category: "Managed Payment" };
    case "/licensing":
      return { title: "Kelola Lisensi", category: "Lisensi & Developer" };
    case "/developer":
    case "/docs":
      return { title: "Integrasi API", category: "Lisensi & Developer" };
    case "/profile":
      return { title: "Profil Builder", category: "Akun" };
    case "/panel":
      return { title: "Super Admin Panel", category: "Admin Panel" };
    default:
      return { title: "Workspace", category: "Dashboard" };
  }
});

const switchingToEnv = ref<DashboardEnv | null>(null);

async function switchEnv(target: DashboardEnv) {
  if (target === env.value || switchingToEnv.value) return;

  const isToLive = target === "live";
  const ok = await confirm({
    title: isToLive ? "Beralih ke Mode Live?" : "Beralih ke Mode Sandbox?",
    message: isToLive
      ? "Anda akan masuk ke environment produksi. Pembayaran pelanggan, lisensi, dan penarikan saldo di mode ini menggunakan transaksi nyata."
      : "Anda akan masuk ke environment simulasi. Data transaksi dan checkout di mode ini hanya bersifat uji coba dan tidak memproses dana asli.",
    confirmText: isToLive ? "Masuk Mode Live" : "Masuk Sandbox",
    cancelText: "Batal",
    variant: isToLive ? "warning" : "info",
  });
  if (!ok) return;

  switchingToEnv.value = target;
  try {
    await new Promise((resolve) => setTimeout(resolve, 550));
    const key = navKey.value;
    await router.push(envPath(target, key === "/" ? "" : key));
    await new Promise((resolve) => setTimeout(resolve, 150));
  } finally {
    switchingToEnv.value = null;
  }
}

const activeCouponCount = ref(0);
const activeLicenseCount = ref(0);
const hasPayoutAccount = ref<boolean | null>(null);
const isMobileMoreOpen = ref(false);

async function loadActiveCouponCount() {
  try {
    const res = await api.getCoupons();
    activeCouponCount.value = (res.coupons || []).filter((c) => c.isActive).length;
  } catch {}
}

async function loadActiveLicenseCount() {
  try {
    const res = await api.getLicenses();
    activeLicenseCount.value = (res.licenses || []).filter((l) => l.status === "ACTIVE").length;
  } catch {}
}

async function loadPayoutAccountStatus() {
  try {
    const res = await api.getPayoutAccount();
    if (res?.success) {
      hasPayoutAccount.value = Boolean(res.disbursementAccount?.accountNumber);
    }
  } catch {}
}

function loadSidebarBadges() {
  loadActiveCouponCount();
  loadActiveLicenseCount();
  loadPayoutAccountStatus();
}

watch(
  () => route.path,
  (path) => {
    isMobileMoreOpen.value = false;
    if (path.startsWith("/dashboard")) {
      loadSidebarBadges();
      ensureAuthUser();
    }
  }
);

function onCouponsChanged() {
  loadActiveCouponCount();
}
function onLicensesChanged() {
  loadActiveLicenseCount();
}
function onPayoutAccountChanged() {
  loadPayoutAccountStatus();
}

onMounted(() => {
  if (route.path.startsWith("/dashboard")) {
    loadSidebarBadges();
    ensureAuthUser();
  }
  window.addEventListener("tertaut:coupons-changed", onCouponsChanged);
  window.addEventListener("tertaut:licenses-changed", onLicensesChanged);
  window.addEventListener("tertaut:payout-account-changed", onPayoutAccountChanged);
});

onUnmounted(() => {
  if (navigationTimeout) clearTimeout(navigationTimeout);
  window.removeEventListener("tertaut:coupons-changed", onCouponsChanged);
  window.removeEventListener("tertaut:licenses-changed", onLicensesChanged);
  window.removeEventListener("tertaut:payout-account-changed", onPayoutAccountChanged);
});
</script>

<template>
  <!-- Standalone Layout (public pages, /panel) -->
  <div v-if="isStandaloneLayout" class="min-h-screen bg-white text-jetblack font-sans">
    <router-view />
  </div>

  <!-- Dashboard Layout -->
  <div v-else class="min-h-screen bg-white text-jetblack flex flex-col md:flex-row font-sans">
    <DashboardSidebar
      :active-coupon-count="activeCouponCount"
      :active-license-count="activeLicenseCount"
      :has-payout-account="hasPayoutAccount"
      :switching-to-env="switchingToEnv"
      @switch-env="switchEnv"
    />

    <div class="flex-1 min-w-0 flex flex-col min-h-screen md:h-screen overflow-hidden relative">
      <!-- Top Navigation Loading Bar -->
      <div
        v-if="isPageNavigating"
        class="absolute top-0 left-0 right-0 h-[2px] bg-gold/20 z-50 overflow-hidden pointer-events-none"
      >
        <div class="h-full bg-gold animate-pulse w-full"></div>
      </div>

      <DashboardTopHeader
        :current-page="currentPage"
        :auth-user="authUser"
        :auth-initial="authInitial"
        :has-payout-account="hasPayoutAccount"
        @logout="handleLogout"
      />

      <MobileNav
        :active-coupon-count="activeCouponCount"
        :active-license-count="activeLicenseCount"
        :has-payout-account="hasPayoutAccount"
        :current-page="currentPage"
        :auth-user="authUser"
        :is-mobile-more-open="isMobileMoreOpen"
        :switching-to-env="switchingToEnv"
        @switch-env="switchEnv"
        @toggle-more="isMobileMoreOpen = !isMobileMoreOpen"
        @close-more="isMobileMoreOpen = false"
        @logout="handleLogout"
      />

      <main class="flex-1 min-w-0 px-3.5 sm:px-4 md:px-6 pt-0 pb-20 md:pb-6 overflow-y-auto w-full">
        <router-view />
      </main>

      <!-- Environment Transition Overlay (Memastikan perpindahan Live <-> Sandbox terasa disengaja) -->
      <Transition
        enter-active-class="transition duration-200 ease-out"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition duration-200 ease-in"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div
          v-if="switchingToEnv"
          class="fixed inset-0 z-[90] bg-white/85 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div
            class="w-full max-w-xs border border-jetblack/15 bg-white shadow-lg divide-y divide-jetblack/10"
          >
            <div class="px-4 py-3 bg-jetblack text-white flex items-center gap-2.5">
              <RefreshCw class="w-4 h-4 text-gold animate-spin shrink-0" />
              <span class="text-xs font-bold uppercase tracking-wider">
                {{ switchingToEnv === "live" ? "Mengaktifkan Mode Live" : "Mengaktifkan Sandbox" }}
              </span>
            </div>
            <div class="px-4 py-3.5 space-y-2.5">
              <p class="text-xs text-jetblack/70 leading-relaxed">
                {{
                  switchingToEnv === "live"
                    ? "Memuat workspace produksi, ledger transaksi nyata, dan konfigurasi pembayaran aktif..."
                    : "Memuat workspace simulasi, data uji coba, dan gateway sandbox..."
                }}
              </p>
              <div class="h-1 w-full bg-jetblack/10 overflow-hidden">
                <div
                  class="h-full w-2/3 animate-pulse"
                  :class="switchingToEnv === 'live' ? 'bg-forest' : 'bg-gold'"
                ></div>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </div>
  </div>

  <!-- Global Confirm Modal (aktif di semua rute termasuk /panel) -->
  <ConfirmModal />
</template>
