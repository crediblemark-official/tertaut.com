import { createRouter, createWebHistory, type RouteRecordRaw } from "vue-router";
import LandingView from "../views/LandingView.vue";
import OverviewView from "../views/OverviewView.vue";
import { applyEnvFromPath, SANDBOX_PREFIX } from "../lib/environment";
import { authClient } from "../lib/auth";

const liveDashboardRoutes: RouteRecordRaw[] = [
  {
    path: "/dashboard",
    name: "dashboard",
    component: OverviewView,
    meta: { requiresAuth: true },
  },
  {
    path: "/dashboard/apps",
    name: "apps",
    component: () => import("../views/AppsView.vue"),
    meta: { requiresAuth: true },
  },
  {
    path: "/dashboard/licensing",
    name: "licensing",
    component: () => import("../views/LicensingView.vue"),
    meta: { requiresAuth: true },
  },
  {
    path: "/dashboard/ai-proxy",
    name: "ai-proxy",
    component: () => import("../views/AiProxyView.vue"),
    meta: { requiresAuth: true },
  },
  {
    path: "/dashboard/coupons",
    name: "coupons",
    component: () => import("../views/CouponView.vue"),
    meta: { requiresAuth: true },
  },
  {
    path: "/dashboard/payments",
    name: "payments",
    component: () => import("../views/PaymentsView.vue"),
    meta: { requiresAuth: true },
  },
  {
    path: "/dashboard/checkout",
    name: "checkout",
    component: () => import("../views/CheckoutView.vue"),
    meta: { requiresAuth: true },
  },
  {
    path: "/dashboard/subscriptions",
    name: "subscriptions",
    component: () => import("../views/SubscriptionsView.vue"),
    meta: { requiresAuth: true },
  },
  {
    path: "/dashboard/balances",
    name: "balances",
    component: () => import("../views/BalancesView.vue"),
    meta: { requiresAuth: true },
  },
  {
    path: "/dashboard/docs",
    name: "docs",
    component: () => import("../views/DocsView.vue"),
    meta: { requiresAuth: true },
  },
];

// Duplikasi seluruh halaman dashboard untuk environment sandbox
// (/dashboard/sandbox, /dashboard/sandbox/checkout, dst).
const sandboxDashboardRoutes: RouteRecordRaw[] = liveDashboardRoutes.map((route) => ({
  ...route,
  path: (route.path as string).replace("/dashboard", SANDBOX_PREFIX),
  name: `sandbox-${String(route.name)}`,
}));

const routes: RouteRecordRaw[] = [
  {
    path: "/",
    name: "home",
    component: LandingView,
    meta: { public: true },
  },
  {
    path: "/login",
    name: "login",
    component: () => import("../views/LoginView.vue"),
    meta: { public: true },
  },

  ...liveDashboardRoutes,
  ...sandboxDashboardRoutes,

  {
    path: "/checkout/success",
    name: "checkout-success",
    component: () => import("../views/InvoiceView.vue"),
    meta: { public: true, standalone: true },
  },
  {
    path: "/pay/:slug?",
    name: "pay-page",
    component: () => import("../views/PayView.vue"),
    meta: { public: true },
  },
  {
    path: "/invoice/:txId",
    name: "invoice-page",
    component: () => import("../views/InvoiceView.vue"),
    meta: { public: true, standalone: true },
  },
  {
    path: "/panel",
    name: "admin-panel",
    component: () => import("../views/AdminPanelView.vue"),
    meta: { requiresAuth: true, standalone: true },
  },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach(async (to) => {
  applyEnvFromPath(to.path);

  const requiresAuth =
    !!to.meta.requiresAuth || to.path.startsWith("/dashboard") || to.path.startsWith("/panel");

  // Wajib login untuk halaman beranda dashboard & panel.
  // Di dev sekalipun; server juga menegakkan authenticate() (DEV_USER hanya safety net).
  if (requiresAuth) {
    const { data } = await authClient.getSession();
    if (!data) {
      return { path: "/login", query: { redirect: to.fullPath } };
    }

    // /panel = Admin Panel yang EKSKLUSIF admin. Akun biasa (role != admin)
    // diarahkan ke dashboard pribadinya — sebelumnya mereka bisa membuka kerangka
    // panel dan hanya melihat error "Forbidden" dari API (bocor UI shell + UX buruk).
    if (to.path.startsWith("/panel")) {
      const role = (data.user as { role?: string | null } | undefined)?.role;
      if (role !== "admin") {
        return { path: "/dashboard" };
      }
    }
  }
});
