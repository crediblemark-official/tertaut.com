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
    path: "/dashboard/projects",
    name: "projects",
    component: () => import("../views/AppsView.vue"),
    meta: { requiresAuth: true },
  },
  {
    path: "/dashboard/apps",
    redirect: "/dashboard/projects",
  },
  {
    path: "/dashboard/licensing",
    name: "licensing",
    component: () => import("../views/LicensingView.vue"),
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
    path: "/dashboard/developer",
    name: "developer",
    component: () => import("../views/DeveloperView.vue"),
    meta: { requiresAuth: true },
  },
  {
    path: "/dashboard/docs",
    redirect: "/dashboard/developer",
  },
];

// Duplikasi seluruh halaman dashboard untuk environment sandbox
// (/dashboard/sandbox, /dashboard/sandbox/checkout, dst).
const sandboxDashboardRoutes: RouteRecordRaw[] = liveDashboardRoutes.map((route) => {
  const newRoute: any = {
    ...route,
    path: (route.path as string).replace("/dashboard", SANDBOX_PREFIX),
    name: `sandbox-${String(route.name)}`,
  };
  if (typeof route.redirect === "string") {
    newRoute.redirect = route.redirect.replace("/dashboard", SANDBOX_PREFIX);
  }
  return newRoute;
});

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
    path: "/demo/checkout/:slug?",
    name: "demo-checkout",
    component: () => import("../views/PayView.vue"),
    props: { isDemo: true },
    meta: { public: true },
  },
  {
    path: "/invoice/:txId",
    name: "invoice-page",
    component: () => import("../views/InvoiceView.vue"),
    meta: { public: true, standalone: true },
  },
  {
    path: "/products",
    name: "products",
    component: () => import("../views/ProductsView.vue"),
    meta: { public: true },
  },
  {
    path: "/pricing",
    name: "pricing",
    component: () => import("../views/ProductsView.vue"),
    meta: { public: true },
  },
  {
    path: "/biaya",
    name: "biaya",
    component: () => import("../views/ProductsView.vue"),
    meta: { public: true },
  },
  {
    path: "/katalog",
    name: "catalog-alias",
    component: () => import("../views/ProductsView.vue"),
    meta: { public: true },
  },
  {
    path: "/contact",
    name: "contact",
    component: () => import("../views/ContactView.vue"),
    meta: { public: true },
  },
  {
    path: "/kontak",
    name: "contact-alias",
    component: () => import("../views/ContactView.vue"),
    meta: { public: true },
  },
  {
    path: "/terms",
    name: "terms",
    component: () => import("../views/TermsView.vue"),
    meta: { public: true },
  },
  {
    path: "/terms.html",
    name: "terms-html",
    component: () => import("../views/TermsView.vue"),
    meta: { public: true },
  },
  {
    path: "/syarat-ketentuan",
    name: "terms-alias",
    component: () => import("../views/TermsView.vue"),
    meta: { public: true },
  },
  {
    path: "/privacy",
    name: "privacy",
    component: () => import("../views/PrivacyView.vue"),
    meta: { public: true },
  },
  {
    path: "/privacy.html",
    name: "privacy-html",
    component: () => import("../views/PrivacyView.vue"),
    meta: { public: true },
  },
  {
    path: "/kebijakan-privasi",
    name: "privacy-alias",
    component: () => import("../views/PrivacyView.vue"),
    meta: { public: true },
  },
  {
    path: "/refund",
    name: "refund",
    component: () => import("../views/RefundView.vue"),
    meta: { public: true },
  },
  {
    path: "/kebijakan-pengembalian",
    name: "refund-alias",
    component: () => import("../views/RefundView.vue"),
    meta: { public: true },
  },
  {
    path: "/panel/:tab?",
    name: "admin-panel",
    component: () => import("../views/AdminPanelView.vue"),
    meta: { requiresAuth: true, standalone: true },
  },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
});

interface AuthUserData {
  role?: string | null;
  [key: string]: unknown;
}

interface ClientSessionPayload {
  user?: AuthUserData;
  [key: string]: unknown;
}

let cachedSessionData: ClientSessionPayload | null = null;
let lastSessionCheck = 0;
const SESSION_CACHE_TTL = 30_000; // 30 detik

export function clearClientSessionCache() {
  cachedSessionData = null;
  lastSessionCheck = 0;
}

router.beforeEach(async (to, from) => {
  applyEnvFromPath(to.path);

  const requiresAuth =
    !!to.meta.requiresAuth || to.path.startsWith("/dashboard") || to.path.startsWith("/panel");

  if (!requiresAuth) return;

  // Optimisasi Navigasi Cepat (0ms delay):
  // Jika berpindah sub-route / tab di dalam section yang sama (mis. antar tab /panel/*
  // atau antar tab /dashboard/*), tidak perlu memblokir transisi dengan network round-trip getSession().
  const isInternalPanelNav = from.path.startsWith("/panel") && to.path.startsWith("/panel");
  const isInternalDashboardNav =
    from.path.startsWith("/dashboard") && to.path.startsWith("/dashboard");

  if (isInternalPanelNav || isInternalDashboardNav) {
    return;
  }

  const now = Date.now();
  let sessionData = cachedSessionData;

  // Hanya request getSession ke server jika belum ada cache atau cache sudah lewat TTL (30s)
  if (!sessionData || now - lastSessionCheck > SESSION_CACHE_TTL) {
    try {
      const { data } = await authClient.getSession();
      sessionData = data as ClientSessionPayload | null;
      if (sessionData) {
        cachedSessionData = sessionData;
        lastSessionCheck = now;
      } else {
        cachedSessionData = null;
        lastSessionCheck = 0;
      }
    } catch {
      cachedSessionData = null;
      lastSessionCheck = 0;
      sessionData = null;
    }
  }

  if (!sessionData) {
    return { path: "/login", query: { redirect: to.fullPath } };
  }

  // /panel = Admin Panel yang EKSKLUSIF admin. Akun biasa (role != admin)
  // diarahkan ke dashboard pribadinya.
  if (to.path.startsWith("/panel")) {
    const role = sessionData.user?.role;
    if (role !== "admin") {
      return { path: "/dashboard" };
    }
  }
});
