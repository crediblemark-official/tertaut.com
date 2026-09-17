import { createRouter, createWebHistory, type RouteRecordRaw } from "vue-router";
import LandingView from "../views/LandingView.vue";
import OverviewView from "../views/OverviewView.vue";
import { applyEnvFromPath, SANDBOX_PREFIX } from "../lib/environment";

const liveDashboardRoutes: RouteRecordRaw[] = [
  {
    path: "/dashboard",
    name: "dashboard",
    component: OverviewView,
  },
  {
    path: "/dashboard/apps",
    name: "apps",
    component: () => import("../views/AppsView.vue"),
  },
  {
    path: "/dashboard/checkout",
    name: "checkout",
    component: () => import("../views/CheckoutView.vue"),
  },
  {
    path: "/dashboard/licensing",
    name: "licensing",
    component: () => import("../views/LicensingView.vue"),
  },
  {
    path: "/dashboard/ai-proxy",
    name: "ai-proxy",
    component: () => import("../views/AiProxyView.vue"),
  },
  {
    path: "/dashboard/coupons",
    name: "coupons",
    component: () => import("../views/CouponView.vue"),
  },
  {
    path: "/dashboard/docs",
    name: "docs",
    component: () => import("../views/DocsView.vue"),
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

  ...liveDashboardRoutes,
  ...sandboxDashboardRoutes,

  {
    path: "/pay/:slug?",
    name: "pay-page",
    component: () => import("../views/PayView.vue"),
    meta: { public: true },
  },
  {
    path: "/portal",
    name: "customer-portal",
    component: () => import("../views/CustomerPortalView.vue"),
    meta: { public: true },
  },
  {
    path: "/panel",
    name: "admin-panel",
    component: () => import("../views/AdminPanelView.vue"),
    meta: { public: true },
  },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach((to) => {
  applyEnvFromPath(to.path);
});
