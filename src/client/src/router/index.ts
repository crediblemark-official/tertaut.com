import { createRouter, createWebHistory } from "vue-router";
import LandingView from "../views/LandingView.vue";
import OverviewView from "../views/OverviewView.vue";

const routes = [
  {
    path: "/",
    name: "home",
    component: LandingView,
    meta: { public: true },
  },
  {
    path: "/dashboard",
    name: "dashboard",
    component: OverviewView,
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
    path: "/dashboard/docs",
    name: "docs",
    component: () => import("../views/DocsView.vue"),
  },
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
