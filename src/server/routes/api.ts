import { Elysia } from "elysia";
import { healthRoutes } from "./health";
import { appRoutes } from "./apps";
import { checkoutRoutes } from "./checkout";
import { webhookRoutes, webhooksPluralRoutes } from "./webhook";
import { payoutsRoutes } from "./payouts";
import { licensingRoutes, licenseLegacyRoutes } from "./licensing";
import { aiProxyRoutes, aiRoutes } from "./aiproxy";
import { badgeRoutes, widgetRoutes } from "./badge";
import { launchRoutes } from "./launch";
import { panelRoutes } from "./panel";
import { couponRoutes } from "./coupons";
import { authMiddleware, authenticate } from "../middleware/auth";

const PUBLIC_PREFIXES = [
  "/api/v1/health",
  "/api/v1/badge",
  "/api/v1/widgets",
  "/api/v1/webhook",
  "/api/v1/webhooks",
  "/api/v1/checkout/session",
  "/api/v1/apps/by-slug",
  "/api/v1/licensing/verify",
  "/api/v1/licensing/validate",
  "/api/v1/licensing/verify-offline-token",
  "/api/v1/licensing/activate",
  "/api/v1/licensing/deactivate",
  "/api/v1/licensing/credits/",
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
  .use(couponRoutes);
