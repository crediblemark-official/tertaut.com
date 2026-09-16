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
import { portalRoutes } from "./portal";
import { panelRoutes } from "./panel";

export const apiV1Routes = new Elysia({ prefix: "/api/v1" })
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
  .use(portalRoutes)
  .use(panelRoutes);
