import { Elysia, t } from "elysia";
import { db } from "../db";
import { apps, builders, transactions, licenses } from "../db/schema";
import { eq, desc, count, sql, and, inArray } from "drizzle-orm";
import { randomBytes } from "crypto";
import { config as appConfig } from "../config";
import { authenticate } from "../middleware/auth";

const modeQuery = t.Object({
  mode: t.Optional(t.Union([t.Literal("sandbox"), t.Literal("live")])),
});

export const appRoutes = new Elysia({ prefix: "/apps" })
  // Semua endpoint apps privat KECUALI halaman produk publik /apps/by-slug/:slug
  .onBeforeHandle(async ({ request: { headers }, status, path }) => {
    if (path.includes("by-slug")) return;
    const res = await authenticate(headers);
    if ("status" in res) return status(res.status, { error: res.error });
  })
  /**
   * Ambil daftar seluruh aplikasi yang terdaftar
   */
  .get(
    "/",
    async ({ query }) => {
      // Auto-seed builder & sample app HANYA di mode sandbox (development)
      if (appConfig.isSandbox) {
        // Pastikan ada builder demo jika DB baru diinisialisasi
        let demoBuilder = await db.query.builders.findFirst();
        if (!demoBuilder) {
          const [createdBuilder] = await db
            .insert(builders)
            .values({
              email: "builder@tertaut.com",
              name: "Vibe Builder",
              apiKey: `tt_live_${randomBytes(16).toString("hex")}`,
            })
            .returning();
          demoBuilder = createdBuilder;

          // Buat sample app
          await db.insert(apps).values({
            id: "app_demo_123",
            builderId: demoBuilder.id,
            name: "FastMail AI Summarizer",
            slug: "fastmail-ai",
            mode: "sandbox",
            targetPrice: 49000,
            description: "Chrome extension untuk merangkum email penting secara instan menggunakan AI.",
            redirectUrl: "https://situsbisnis.com/@builder/success",
          });
        }
      }

      const allApps = await db.query.apps.findMany({
        where: query.mode ? eq(apps.mode, query.mode) : undefined,
        orderBy: [desc(apps.createdAt)],
      });

      return { apps: allApps };
    },
    {
      query: modeQuery,
      detail: {
        tags: ["Apps"],
        summary: "List all apps",
        description: "Retrieves list of apps managed by the current builder, optionally filtered by environment mode",
      },
    }
  )

  /**
   * Ambil ringkasan KPI Dashboard (GMV, Lisensi Aktif, Validasi Konversi)
   */
  .get(
    "/stats/overview",
    async ({ query }) => {
      const emptyStats = {
        totalGMV: 0,
        netEarnings: 0,
        platformFeeCollected: 0,
        activeLicenses: 0,
        totalTransactions: 0,
      };

      let appIds: string[] | null = null;
      if (query.mode) {
        const rows = await db
          .select({ id: apps.id })
          .from(apps)
          .where(eq(apps.mode, query.mode));
        appIds = rows.map((r) => r.id);
        if (appIds.length === 0) return emptyStats;
      }

      const txScope = appIds ? inArray(transactions.appId, appIds) : undefined;
      const licenseScope = appIds ? inArray(licenses.appId, appIds) : undefined;

      const [allTxCount] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(transactions)
        .where(txScope);

      const [paidTxAgg] = await db
        .select({
          totalGMV: sql<number>`COALESCE(SUM(${transactions.grossAmount}), 0)::int`,
          netEarnings: sql<number>`COALESCE(SUM(${transactions.netAmount}), 0)::int`,
        })
        .from(transactions)
        .where(txScope ? and(eq(transactions.paymentStatus, "PAID"), txScope) : eq(transactions.paymentStatus, "PAID"));

      const [activeLicensesCount] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(licenses)
        .where(licenseScope ? and(eq(licenses.status, "ACTIVE"), licenseScope) : eq(licenses.status, "ACTIVE"));

      const totalGMV = paidTxAgg?.totalGMV || 0;
      const netEarnings = paidTxAgg?.netEarnings || 0;
      const activeLicenses = activeLicensesCount?.count || 0;

      return {
        totalGMV,
        netEarnings,
        platformFeeCollected: totalGMV - netEarnings,
        activeLicenses,
        totalTransactions: allTxCount?.count || 0,
      };
    },
    {
      query: modeQuery,
      detail: {
        tags: ["Apps"],
        summary: "Dashboard KPI Overview",
        description: "Aggregates GMV, Net Payouts, Active Licenses, and Validation Rates, optionally filtered by environment mode",
      },
    }
  )

  /**
   * Cek ketersediaan slug unik secara real-time (FR-1.2)
   */
  .get(
    "/check-slug/:slug",
    async ({ params: { slug } }) => {
      const existing = await db.query.apps.findFirst({
        where: eq(apps.slug, slug),
      });

      return {
        slug,
        available: !existing,
      };
    },
    {
      params: t.Object({ slug: t.String() }),
      detail: {
        tags: ["Apps"],
        summary: "Check Slug Availability",
        description: "Checks if a vanity URL slug is available for a new hosted campaign",
      },
    }
  )

  /**
   * Buat Kampanye / Aplikasi Baru (FR-1.1 & FR-1.3)
   */
  .post(
    "/",
    async ({ body, set }) => {
      const {
        name,
        slug,
        targetPrice,
        mode = "sandbox",
        description,
        headline,
        subheadline,
        mediaUrl,
        valueProps,
        ctaText = "Beli Sekarang",
        customIntentMessage,
        captureConfig,
        redirectUrl,
      } = body;

      const builder = await db.query.builders.findFirst();
      if (!builder) {
        set.status = 400;
        return { error: "No builder found in database" };
      }

      // Pastikan slug unik
      const existingApp = await db.query.apps.findFirst({
        where: eq(apps.slug, slug),
      });
      if (existingApp) {
        set.status = 409;
        return { error: `Slug "${slug}" sudah digunakan. Gunakan slug lain.` };
      }

      const appId = `app_${randomBytes(6).toString("hex")}`;

      const [newApp] = await db
        .insert(apps)
        .values({
          id: appId,
          builderId: builder.id,
          name,
          slug,
          targetPrice,
          mode,
          description: description || null,
          headline: headline || name,
          subheadline: subheadline || description || null,
          mediaUrl: mediaUrl || null,
          valueProps: valueProps || [],
          ctaText: ctaText || "Beli Sekarang",
          customIntentMessage: customIntentMessage || null,
          captureConfig: captureConfig || null,
          redirectUrl: redirectUrl || null,
        })
        .returning();

      return { success: true, app: newApp };
    },
    {
      body: t.Object({
        name: t.String(),
        slug: t.String(),
        targetPrice: t.Number(),
        mode: t.Optional(t.Union([t.Literal("sandbox"), t.Literal("live")])),
        description: t.Optional(t.String()),
        headline: t.Optional(t.String()),
        subheadline: t.Optional(t.String()),
        mediaUrl: t.Optional(t.String()),
        valueProps: t.Optional(t.Array(t.String())),
        ctaText: t.Optional(t.String()),
        customIntentMessage: t.Optional(t.String()),
        pageBlocks: t.Optional(t.Array(t.Any())),
        customHtml: t.Optional(t.String()),
        captureConfig: t.Optional(t.Any()),
        redirectUrl: t.Optional(t.String()),
      }),
      detail: {
        tags: ["Apps"],
        summary: "Create new App / Hosted Campaign",
        description: "Registers a new product or validation campaign with visual configuration",
      },
    }
  )

  /**
   * Perbarui Konfigurasi Kampanye / Aplikasi (FR-1.1 & FR-1.3)
   */
  .patch(
    "/:appId",
    async ({ params: { appId }, body, set }) => {
      const existing = await db.query.apps.findFirst({
        where: eq(apps.id, appId),
      });

      if (!existing) {
        set.status = 404;
        return { error: "App not found" };
      }

      // Jika ada perubahan slug, pastikan slug tidak bentrok dengan app lain
      if (body.slug && body.slug !== existing.slug) {
        const slugClash = await db.query.apps.findFirst({
          where: eq(apps.slug, body.slug),
        });
        if (slugClash) {
          set.status = 409;
          return { error: `Slug "${body.slug}" sudah digunakan.` };
        }
      }

      // Explicit allowlist to prevent mass-assignment/field pollution
      const {
        name, slug, targetPrice, mode, description, headline, subheadline,
        mediaUrl, valueProps, ctaText, customIntentMessage, redirectUrl,
        pageBlocks, customHtml, captureConfig
      } = body as Record<string, any>;

      const updateData: Record<string, any> = { updatedAt: new Date() };
      if (name !== undefined) updateData.name = name;
      if (slug !== undefined) updateData.slug = slug;
      if (targetPrice !== undefined) updateData.targetPrice = targetPrice;
      if (mode !== undefined) updateData.mode = mode;
      if (description !== undefined) updateData.description = description;
      if (headline !== undefined) updateData.headline = headline;
      if (subheadline !== undefined) updateData.subheadline = subheadline;
      if (mediaUrl !== undefined) updateData.mediaUrl = mediaUrl;
      if (valueProps !== undefined) updateData.valueProps = valueProps;
      if (ctaText !== undefined) updateData.ctaText = ctaText;
      if (customIntentMessage !== undefined) updateData.customIntentMessage = customIntentMessage;
      if (redirectUrl !== undefined) updateData.redirectUrl = redirectUrl;
      if (pageBlocks !== undefined) updateData.pageBlocks = pageBlocks;
      if (customHtml !== undefined) updateData.customHtml = customHtml;
      if (captureConfig !== undefined) updateData.captureConfig = captureConfig;

      const [updated] = await db
        .update(apps)
        .set(updateData)
        .where(eq(apps.id, appId))
        .returning();

      return { success: true, app: updated };
    },
    {
      params: t.Object({ appId: t.String() }),
      body: t.Partial(
        t.Object({
          name: t.String(),
          slug: t.String(),
          targetPrice: t.Number(),
          mode: t.Union([t.Literal("sandbox"), t.Literal("live")]),
          description: t.String(),
          headline: t.String(),
          subheadline: t.String(),
          mediaUrl: t.String(),
          valueProps: t.Array(t.String()),
          ctaText: t.String(),
          customIntentMessage: t.String(),
          pageBlocks: t.Array(t.Any()),
          customHtml: t.String(),
          captureConfig: t.Any(),
          redirectUrl: t.String(),
        })
      ),
      detail: {
        tags: ["Apps"],
        summary: "Update Campaign Configuration",
      },
    }
  )

  /**
   * Hapus Kampanye / Aplikasi (FR-1.1)
   */
  .delete(
    "/:appId",
    async ({ params: { appId }, set }) => {
      const existing = await db.query.apps.findFirst({
        where: eq(apps.id, appId),
      });

      if (!existing) {
        set.status = 404;
        return { error: "App not found" };
      }

      await db.delete(apps).where(eq(apps.id, appId));

      return { success: true, message: `Kampanye "${existing.name}" berhasil dihapus.` };
    },
    {
      params: t.Object({ appId: t.String() }),
      detail: {
        tags: ["Apps"],
        summary: "Delete Campaign",
      },
    }
  )

  /**
   * Ambil detail publik aplikasi berdasarkan slug (URL /pay/:slug)
   */
  .get(
    "/by-slug/:slug",
    async ({ params: { slug }, set }) => {
      const app = await db.query.apps.findFirst({
        where: eq(apps.slug, slug),
      });

      if (!app) {
        set.status = 404;
        return { error: "Product not found" };
      }

      return {
        id: app.id,
        name: app.name,
        slug: app.slug,
        mode: app.mode,
        targetPrice: app.targetPrice,
        description: app.description,
        headline: app.headline || app.name,
        subheadline: app.subheadline || app.description,
        mediaUrl: app.mediaUrl,
        valueProps: app.valueProps || [],
        ctaText: app.ctaText || "Beli Sekarang",
        customIntentMessage: app.customIntentMessage || "Aplikasi dalam persiapan rilis. Masukkan email untuk diskon 50%!",
        pageBlocks: app.pageBlocks || null,
        redirectUrl: app.redirectUrl,
      };
    },
    {
      params: t.Object({ slug: t.String() }),
      detail: {
        tags: ["Apps"],
        summary: "Get Public App by Slug",
        description: "Retrieves public metadata for tertaut.com/pay/:slug",
      },
    }
  )

  /**
   * Perbarui status mode aplikasi (sandbox <-> live)
   */
  .patch(
    "/:appId/mode",
    async ({ params: { appId }, body: { mode }, set }) => {
      const currentApp = await db.query.apps.findFirst({
        where: eq(apps.id, appId),
      });

      if (!currentApp) {
        set.status = 404;
        return { error: "App not found" };
      }

      const [updated] = await db
        .update(apps)
        .set({ mode, updatedAt: new Date() })
        .where(eq(apps.id, appId))
        .returning();

      return {
        success: true,
        app: updated,
      };
    },
    {
      params: t.Object({ appId: t.String() }),
      body: t.Object({
        mode: t.Union([t.Literal("sandbox"), t.Literal("live")]),
      }),
      detail: {
        tags: ["Apps"],
        summary: "Update App Mode",
        description: "Toggles app mode between sandbox and live",
      },
    }
  )

  /**
   * Eksekusi Pencairan Otomatis (Disbursement 95% net) via Xendit
   */
  .post(
    "/disburse/:transactionId",
    async ({ params: { transactionId }, set }) => {
      const tx = await db.query.transactions.findFirst({
        where: eq(transactions.id, transactionId),
      });

      if (!tx) {
        set.status = 404;
        return { error: "Transaction not found" };
      }

      if (tx.paymentStatus !== "PAID") {
        set.status = 400;
        return { error: "Cannot disburse unpaid transaction" };
      }

      if (tx.disbursementStatus === "COMPLETED" || tx.disbursementStatus === "PROCESSING") {
        set.status = 400;
        return { error: "Pencairan sudah selesai atau sedang dalam proses" };
      }

      // Transaksi dari aplikasi sandbox hanyalah simulasi — tidak boleh dicairkan ke rekening asli.
      const txApp = await db.query.apps.findFirst({ where: eq(apps.id, tx.appId) });
      if (txApp?.mode === "sandbox") {
        set.status = 400;
        return { error: "Transaksi sandbox (simulasi) tidak dapat dicairkan. Cairkan hanya transaksi live." };
      }

      // Atomic lock using conditional UPDATE to prevent double disbursement race condition
      const locked = await db
        .update(transactions)
        .set({
          disbursementStatus: "PROCESSING",
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(transactions.id, tx.id),
            eq(transactions.paymentStatus, "PAID"),
            eq(transactions.disbursementStatus, "PENDING")
          )
        )
        .returning();

      if (!locked.length) {
        set.status = 409;
        return { error: "Pencairan sedang diproses oleh permintaan lain" };
      }

      const builder = await db.query.builders.findFirst({
        where: eq(builders.id, tx.builderId),
      });

      const { XenditService } = await import("../services/xendit");
      const recipient = XenditService.resolveDisbursementAccount(builder);

      // Production TANPA rekening tersimpan → tolak pencairan (jangan pakai data palsu)
      if (!recipient) {
        set.status = 400;
        return {
          error:
            "Builder belum menyimpan rekening penerima disbursement. Lengkapi profil bank/e-wallet terlebih dahulu.",
        };
      }

      try {
        const payoutResult = await XenditService.createDisbursement({
          externalId: `disb_${tx.id}_${Date.now()}`,
          amount: tx.netAmount,
          ...recipient,
          description: `Pencairan 95% Net Transaksi ${tx.id}`,
        });

        const finalStatus =
          payoutResult.status === "FAILED"
            ? "FAILED"
            : payoutResult.status === "PENDING"
              ? "PROCESSING"
              : "COMPLETED";

        await db
          .update(transactions)
          .set({
            disbursementStatus: finalStatus,
            disbursementId: payoutResult.id,
            updatedAt: new Date(),
          })
          .where(eq(transactions.id, tx.id));

        return {
          success: true,
          transactionId: tx.id,
          disbursedAmount: tx.netAmount,
          payoutDetails: payoutResult,
        };
      } catch (err: any) {
        // Rollback status to PENDING on unhandled exception so builder can retry
        await db
          .update(transactions)
          .set({
            disbursementStatus: "PENDING",
            updatedAt: new Date(),
          })
          .where(eq(transactions.id, tx.id));

        set.status = 500;
        return { error: err.message || "Gagal memproses pencairan dana" };
      }
    },
    {
      params: t.Object({ transactionId: t.String() }),
      detail: {
        tags: ["MoR Checkout"],
        summary: "Trigger Xendit Automated Disbursement",
        description: "Disburses 95% net revenue directly to builder bank or e-wallet account",
      },
    }
  );
