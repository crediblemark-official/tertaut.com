import { Elysia } from "elysia";
import { healthRoutes } from "./health";
import { appRoutes } from "./apps/router";
import { checkoutRoutes } from "./checkout/router";
import { webhookRoutes, webhooksPluralRoutes } from "./webhook/router";
import { payoutsRoutes } from "./payouts/router";
import { licensingRoutes, licenseLegacyRoutes } from "./licensing/router";
import { aiProxyRoutes, aiRoutes } from "./aiproxy/router";
import { badgeRoutes, widgetRoutes } from "./badge/router";
import { launchRoutes } from "./launch";
import { panelRoutes } from "./panel/router";
import { couponRoutes } from "./coupons/router";
import { meteringRoutes } from "./metering/router";
import { s2sRoutes } from "./s2s/router";
import { handleGetPublicAnnouncement } from "./panel/settings";
import { authMiddleware, authenticate } from "../middleware/auth";

const PUBLIC_PREFIXES = [
  "/api/v1/health",
  "/api/v1/s2s",
  "/api/v1/badge",
  "/api/v1/widgets",
  "/api/v1/webhook",
  "/api/v1/webhooks",
  "/api/v1/checkout/session",
  "/api/v1/checkout/status",
  "/api/v1/checkout/consult-pay",
  "/api/v1/checkout/preview-coupon",
  "/api/v1/checkout/dana/finish",
  "/api/v1/checkout/invoice",
  "/api/v1/checkout/simulate-paid",
  "/api/v1/announcement",
  "/api/v1/apps/by-slug",
  "/api/v1/licensing/verify",
  "/api/v1/licensing/validate",
  "/api/v1/licensing/verify-offline-token",
  "/api/v1/licensing/activate",
  "/api/v1/licensing/deactivate",
  "/api/v1/licensing/heartbeat",
  "/api/v1/license/heartbeat",
  "/api/v1/licensing/credits/",
  "/api/v1/licensing/api-key",
  "/api/v1/license/api-key",
  "/api/v1/metering/events",
  "/api/v1/metering/usage",
  "/api/v1/ai/chat",
  "/api/v1/ai/quota-status",
  "/api/v1/ai-proxy/chat",
  "/api/v1/ai-proxy/quota-status",
];

export const apiV1Routes = new Elysia({ prefix: "/api/v1" })
  .use(authMiddleware)
  .onBeforeHandle(async ({ request: { headers }, status, path }) => {
    if (PUBLIC_PREFIXES.some((p) => path.startsWith(p))) return;
    const res = await authenticate(headers);
    if ("status" in res) return status(res.status, { error: res.error });
  })
  .use(healthRoutes)
  .use(appRoutes)
  .use(checkoutRoutes)
  .use(payoutsRoutes)
  .use(webhookRoutes)
  .use(webhooksPluralRoutes)
  .use(licensingRoutes)
  .use(licenseLegacyRoutes)
  .use(aiProxyRoutes)
  .use(aiRoutes)
  .use(badgeRoutes)
  .use(widgetRoutes)
  .use(launchRoutes)
  .use(panelRoutes)
  .use(couponRoutes)
  .use(meteringRoutes)
  .use(s2sRoutes)
  .get("/announcement", handleGetPublicAnnouncement);
