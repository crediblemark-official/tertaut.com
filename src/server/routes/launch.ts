import { Elysia, t } from "elysia";
import { LaunchService } from "../services/launchService";
import { authenticate } from "../middleware/auth";

export const launchRoutes = new Elysia({ prefix: "/launch" })
  .onBeforeHandle(async ({ request: { headers }, status }) => {
    const res = await authenticate(headers);
    if ("status" in res) return status(res.status, { error: res.error });
  })
  /**
   * One-Click Live Launch (PRD Modul 5: FR-1.1, FR-1.2, FR-1.3)
   */
  .post(
    "/convert-to-live",
    async ({ body, set }) => {
      try {
        const result = await LaunchService.convertToLiveLaunch({
          campaignId: body.campaignId,
          discountPercent: body.discountPercent ?? 50,
          couponCode: body.couponCode,
        });

        return {
          success: true,
          message: "Campaign converted to LIVE.",
          data: {
            campaignId: result.campaignId,
            appSlug: result.appSlug,
            appName: result.appName,
            liveCheckoutUrl: result.liveCheckoutUrl,
            couponCode: result.couponCode,
            discountPercent: result.discountPercent,
            status: result.status,
          },
        };
      } catch (err: any) {
        set.status = 400;
        return {
          success: false,
          error: "LAUNCH_CONVERT_FAILED",
          message: err.message || "Gagal mengonversi kampanye ke mode LIVE.",
        };
      }
    },
    {
      body: t.Object({
        campaignId: t.String(),
        discountPercent: t.Optional(t.Number({ default: 50 })),
        couponCode: t.Optional(t.String()),
      }),
      detail: {
        tags: ["Launch Kit"],
        summary: "Trigger One-Click Live Launch",
        description: "Mengonversi aplikasi ke mode live dan menghasilkan kupon early bird.",
      },
    }
  );