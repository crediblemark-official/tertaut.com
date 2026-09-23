import { Elysia, t } from "elysia";
import { authenticate } from "../../middleware/auth";
import {
  handleListApps,
  handleStatsOverview,
  handleStatsCatalog,
  handleCheckSlug,
  handleGetBySlug,
  handleGetBuilderMyself,
} from "./queries";
import {
  handleCreateApp,
  handleUpdateApp,
  handleDeleteApp,
  handleUpdateMode,
  handleRotateApiKey,
  handleRotateBuilderSecret,
} from "./mutations";
import { handleDisburse } from "./disburse";

const modeQuery = t.Object({
  mode: t.Optional(t.String()),
});

const appBodySchema = t.Object({
  name: t.String(),
  slug: t.String(),
  targetPrice: t.Number(),
  mode: t.Optional(t.Union([t.Literal("sandbox"), t.Literal("live")])),
  pricingType: t.Optional(
    t.Union([t.Literal("one_time"), t.Literal("subscription"), t.Literal("free"), t.Null()])
  ),
  billingPeriod: t.Optional(
    t.Union([
      t.Literal("daily"),
      t.Literal("weekly"),
      t.Literal("monthly"),
      t.Literal("every_3_months"),
      t.Literal("every_6_months"),
      t.Literal("yearly"),
      t.Literal("custom"),
      t.String(),
      t.Null(),
    ])
  ),
  trialPeriodDays: t.Optional(t.Union([t.Number(), t.Null()])),
  deliveryConfig: t.Optional(t.Any()),
  meteringConfig: t.Optional(t.Any()),
  description: t.Optional(t.Union([t.String(), t.Null()])),
  headline: t.Optional(t.Union([t.String(), t.Null()])),
  subheadline: t.Optional(t.Union([t.String(), t.Null()])),
  mediaUrl: t.Optional(t.Union([t.String(), t.Null()])),
  valueProps: t.Optional(t.Union([t.Array(t.String()), t.Null()])),
  ctaText: t.Optional(t.Union([t.String(), t.Null()])),
  customIntentMessage: t.Optional(t.Union([t.String(), t.Null()])),
  pageBlocks: t.Optional(t.Union([t.Array(t.Any()), t.Null()])),
  customHtml: t.Optional(t.Union([t.String(), t.Null()])),
  captureConfig: t.Optional(t.Any()),
  redirectUrl: t.Optional(t.Union([t.String(), t.Null()])),
});

export const appRoutes = new Elysia({ prefix: "/apps" })
  // Semua endpoint apps privat KECUALI halaman produk publik /apps/by-slug/:slug
  .onBeforeHandle(async ({ request: { headers }, status, path }) => {
    if (path.includes("by-slug")) return;
    const res = await authenticate(headers);
    if ("status" in res) return status(res.status, { error: res.error });
  })
  /**
   * Ambil daftar aplikasi (scoped ke builder pemilik kecuali admin)
   */
  .get("/", handleListApps, {
    query: modeQuery,
    detail: {
      tags: ["Apps"],
      summary: "List all apps",
      description:
        "Retrieves list of apps managed by the current builder, optionally filtered by environment mode",
    },
  })
  /**
   * Ambil ringkasan KPI Dashboard (GMV, Lisensi Aktif, Validasi Konversi)
   */
  .get("/stats/overview", handleStatsOverview, {
    query: modeQuery,
    detail: {
      tags: ["Apps"],
      summary: "Dashboard KPI Overview",
      description:
        "Aggregates GMV, Net Payouts, Active Licenses, and Validation Rates, optionally filtered by environment mode",
    },
  })
  /**
   * Ambil ringkasan KPI Katalog Produk riil (Active Products, Sales 30d, Subscriptions, Customers 30d)
   */
  .get("/stats/catalog", handleStatsCatalog, {
    query: modeQuery,
    detail: {
      tags: ["Apps"],
      summary: "Product Catalog KPI Stats",
      description:
        "Aggregates real-time active products, sales (30d), active subscriptions, and unique customers (30d)",
    },
  })
  .get("/check-slug/:slug", handleCheckSlug, {
    params: t.Object({
      slug: t.String({ description: "Vanity URL slug yang ingin dicek ketersediaannya" }),
    }),
    response: {
      200: t.Object(
        {
          slug: t.String({ description: "Slug yang diperiksa" }),
          available: t.Boolean({
            description: "True jika slug masih tersedia, false jika sudah digunakan",
          }),
        },
        { description: "Hasil pemeriksaan ketersediaan slug unik" }
      ),
    },
    detail: {
      tags: ["Apps"],
      summary: "Check Slug Availability",
      description: "Checks if a vanity URL slug is available for a new hosted campaign",
    },
  })
  /**
   * Buat Kampanye / Aplikasi Baru (FR-1.1 & FR-1.3)
   */
  .post("/", handleCreateApp, {
    body: appBodySchema,
    detail: {
      tags: ["Apps"],
      summary: "Create new App / Hosted Campaign",
      description: "Registers a new product or validation campaign with visual configuration",
    },
  })
  /**
   * Perbarui Konfigurasi Kampanye / Aplikasi (FR-1.1 & FR-1.3)
   */
  .patch("/:appId", handleUpdateApp, {
    params: t.Object({ appId: t.String() }),
    body: t.Partial(appBodySchema),
    detail: {
      tags: ["Apps"],
      summary: "Update Campaign Configuration",
    },
  })
  /**
   * Hapus Kampanye / Aplikasi (FR-1.1)
   */
  .delete("/:appId", handleDeleteApp, {
    params: t.Object({ appId: t.String() }),
    detail: {
      tags: ["Apps"],
      summary: "Delete Campaign",
    },
  })
  /**
   * Ambil detail publik aplikasi berdasarkan slug (URL /pay/:slug)
   */
  .get("/by-slug/:slug", handleGetBySlug, {
    params: t.Object({ slug: t.String() }),
    detail: {
      tags: ["Apps"],
      summary: "Get Public App by Slug",
      description: "Retrieves public metadata for tertaut.com/pay/:slug",
    },
  })
  /**
   * Profil builder saat ini (termasuk secret API key untuk S2S)
   */
  .get("/me", handleGetBuilderMyself, {
    detail: {
      tags: ["Apps"],
      summary: "Builder profile (self)",
      description:
        "Returns the current builder's profile including the server-to-server secret API key",
    },
  })
  /**
   * Rotasi secret API key builder (server-to-server) dari sesi dashboard
   */
  .post("/rotate-secret-api-key", handleRotateBuilderSecret, {
    detail: {
      tags: ["Apps"],
      summary: "Rotate Builder Secret API Key",
      description: "Regenerates the builder's server-to-server secret API key (tt_secret_...)",
    },
  })
  /**
   * Rotasi publishable API key aplikasi (pola publishable-key)
   */
  .post("/:appId/rotate-api-key", handleRotateApiKey, {
    params: t.Object({ appId: t.String() }),
    detail: {
      tags: ["Apps"],
      summary: "Rotate App API Key",
      description: "Regenerates the publishable API key for an app (tt_live_... / tt_test_...)",
    },
  })
  /**
   * Perbarui status mode aplikasi (sandbox <-> live)
   */
  .patch("/:appId/mode", handleUpdateMode, {
    params: t.Object({ appId: t.String() }),
    body: t.Object({
      mode: t.Union([t.Literal("sandbox"), t.Literal("live")]),
    }),
    detail: {
      tags: ["Apps"],
      summary: "Update App Mode",
      description: "Toggles app mode between sandbox and live",
    },
  })
  /**
   * Eksekusi Pencairan Otomatis (Disbursement 95% net) via Xendit
   */
  .post("/disburse/:transactionId", handleDisburse, {
    params: t.Object({ transactionId: t.String() }),
    detail: {
      tags: ["MoR Checkout"],
      summary: "Trigger Xendit Automated Disbursement",
      description: "Disburses 95% net revenue directly to builder bank or e-wallet account",
    },
  });
