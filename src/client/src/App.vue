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

const route = useRoute();
const router = useRouter();
const env = dashboardEnv;

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
      return { title: "Ringkasan Ekosistem", category: "Overview" };
    case "/apps":
      return { title: "Katalog Aplikasi Builder", category: "Apps" };
    case "/payments":
      return { title: "Pembayaran & Transaksi", category: "Payments" };
    case "/subscriptions":
      return { title: "Langganan & Nilai Siklus Hidup", category: "Subscriptions" };
    case "/balances":
      return { title: "Saldo & Permintaan Pencairan", category: "Balances" };
    case "/checkout":
      return { title: "Dynamic Checkout & MoR", category: "Checkout" };
    case "/coupons":
      return { title: "Kupon Diskon", category: "Checkout" };
    case "/licensing":
      return { title: "Lisensi & Anti-Piracy", category: "Lisensi" };
    case "/ai-proxy":
      return { title: "AI API Proxy Shield", category: "AI Shield" };
    case "/docs":
      return { title: "Dokumentasi & SDK", category: "Docs" };
    case "/panel":
      return { title: "Super Admin Panel", category: "Admin Panel" };
    default:
      return { title: "Workspace", category: "Dashboard" };
  }
});

function switchEnv(target: DashboardEnv) {
  if (target === env.value) return;
  const key = navKey.value;
  router.push(envPath(target, key === "/" ? "" : key));
}

const activeCouponCount = ref(0);
const activeLicenseCount = ref(0);
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

function loadSidebarBadges() {
  loadActiveCouponCount();
  loadActiveLicenseCount();
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

onMounted(() => {
  if (route.path.startsWith("/dashboard")) {
    loadSidebarBadges();
    ensureAuthUser();
  }
  window.addEventListener("tertaut:coupons-changed", onCouponsChanged);
  window.addEventListener("tertaut:licenses-changed", onLicensesChanged);
});

onUnmounted(() => {
  window.removeEventListener("tertaut:coupons-changed", onCouponsChanged);
  window.removeEventListener("tertaut:licenses-changed", onLicensesChanged);
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
      @switch-env="switchEnv"
    />

    <div class="flex-1 min-w-0 flex flex-col min-h-screen md:h-screen overflow-hidden">
      <DashboardTopHeader
        :current-page="currentPage"
        :auth-user="authUser"
        :auth-initial="authInitial"
        @logout="handleLogout"
      />

      <MobileNav
        :active-coupon-count="activeCouponCount"
        :active-license-count="activeLicenseCount"
        :current-page="currentPage"
        :auth-user="authUser"
        :is-mobile-more-open="isMobileMoreOpen"
        @switch-env="switchEnv"
        @toggle-more="isMobileMoreOpen = !isMobileMoreOpen"
        @close-more="isMobileMoreOpen = false"
        @logout="handleLogout"
      />

      <main class="flex-1 min-w-0 px-3.5 sm:px-4 md:px-6 pt-0 pb-20 md:pb-6 overflow-y-auto w-full">
        <router-view />
      </main>
    </div>

    <ConfirmModal />
  </div>
</template>
