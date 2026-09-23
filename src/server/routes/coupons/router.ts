import { Elysia, t } from "elysia";
import { db } from "../../db";
import { coupons, apps, transactions } from "../../db/schema";
import { eq, and, desc, gte, isNotNull, sql, inArray } from "drizzle-orm";
import { randomBytes } from "crypto";
import { authenticate } from "../../middleware/auth";
import { resolveCurrentBuilder } from "../apps/builder";
import { verifyOwnedApp, verifyOwnedCoupon } from "../../lib/ownership";

/**
 * Manajemen Kupon Diskon (Modul 1: Monetization)
 * Kupon yang dibuat di sini bisa langsung ditebus di POST /checkout/session
 * melalui body.couponCode.
 */
export const couponRoutes = new Elysia({ prefix: "/coupons" })
  .onBeforeHandle(async ({ request: { headers }, status }) => {
    const res = await authenticate(headers);
    if ("status" in res) return status(res.status, { error: res.error });
  })
  /**
   * Daftar kupon (opsional filter per app, scoped ke builder login)
   */
  .get(
    "/",
    async ({ query, request: { headers } }) => {
      const { builder, isAdmin } = await resolveCurrentBuilder(headers);
      const conditions: any[] = [];

      if (!isAdmin && builder) {
        const builderApps = await db
          .select({ id: apps.id })
          .from(apps)
          .where(eq(apps.builderId, builder.id));
        if (builderApps.length === 0) {
          return { success: true, count: 0, coupons: [] };
        }
        conditions.push(
          inArray(
            coupons.appId,
            builderApps.map((a) => a.id)
          )
        );
      }

      if (query.appId) {
        conditions.push(eq(coupons.appId, query.appId));
      } else if (query.mode) {
        const appRows = await db
          .select({ id: apps.id })
          .from(apps)
          .where(eq(apps.mode, query.mode));
        if (appRows.length === 0) {
          return { success: true, count: 0, coupons: [] };
        }
        conditions.push(
          inArray(
            coupons.appId,
            appRows.map((a) => a.id)
          )
        );
      }

      const rows = await db.query.coupons.findMany({
        where: conditions.length > 0 ? and(...conditions) : undefined,
        orderBy: (c, { desc: d }) => [d(c.createdAt)],
        limit: 200,
      });

      return { success: true, count: rows.length, coupons: rows };
    },
    {
      query: t.Object({
        appId: t.Optional(t.String()),
        mode: t.Optional(t.Union([t.Literal("sandbox"), t.Literal("live")])),
      }),
      detail: {
        tags: ["MoR Checkout"],
        summary: "List Discount Coupons",
      },
    }
  )

  /**
   * Statistik pemakaian kupon: agregat redeem per hari + total diskon diberikan.
   * Sumber: transactions yang mencatat coupon_code (dibuat saat penebusan checkout).
   */
  .get(
    "/stats",
    async ({ query, request: { headers } }) => {
      const days = Math.min(90, Math.max(1, Number(query.days) || 7));
      const since = new Date(Date.now() - days * 86_400_000);
      const { builder, isAdmin } = await resolveCurrentBuilder(headers);

      let builderAppIds: string[] | null = null;
      if (!isAdmin && builder) {
        const bApps = await db
          .select({ id: apps.id })
          .from(apps)
          .where(eq(apps.builderId, builder.id));
        builderAppIds = bApps.map((a) => a.id);
        if (builderAppIds.length === 0) {
          return {
            success: true,
            days,
            totalRedemptions: 0,
            totalDiscountIdr: 0,
            daily: [],
            topCoupons: [],
          };
        }
      }

      const scopeFilters: any[] = [
        isNotNull(transactions.couponCode),
        gte(transactions.createdAt, since),
      ];

      if (builderAppIds) {
        scopeFilters.push(inArray(transactions.appId, builderAppIds));
      }

      if (query.appId) {
        scopeFilters.push(eq(transactions.appId, query.appId));
      } else if (query.mode) {
        const appRows = await db
          .select({ id: apps.id })
          .from(apps)
          .where(eq(apps.mode, query.mode));
        if (appRows.length === 0) {
          return {
            success: true,
            days,
            totalRedemptions: 0,
            totalDiscountIdr: 0,
            daily: [],
            topCoupons: [],
          };
        }
        scopeFilters.push(
          inArray(
            transactions.appId,
            appRows.map((a) => a.id)
          )
        );
      }

      const txFilter = and(...scopeFilters);

      // 1. Agregat harian: jumlah redeem & total diskon yang diberikan
      const daily = await db
        .select({
          day: sql<string>`to_char(date_trunc('day', ${transactions.createdAt}), 'YYYY-MM-DD')`,
          redemptions: sql<number>`count(*)::int`,
          totalDiscount: sql<number>`COALESCE(SUM(${transactions.discountAmount}), 0)::int`,
          totalGross: sql<number>`COALESCE(SUM(${transactions.grossAmount}), 0)::int`,
        })
        .from(transactions)
        .where(txFilter)
        .groupBy(sql`date_trunc('day', ${transactions.createdAt})`)
        .orderBy(sql`date_trunc('day', ${transactions.createdAt})`);

      // 2. Total periode
      const [totals] = await db
        .select({
          totalRedemptions: sql<number>`count(*)::int`,
          totalDiscount: sql<number>`COALESCE(SUM(${transactions.discountAmount}), 0)::int`,
        })
        .from(transactions)
        .where(txFilter);

      // 3. Kupon paling sering ditebus dalam periode
      const topCoupons = await db
        .select({
          code: transactions.couponCode,
          redemptions: sql<number>`count(*)::int`,
          totalDiscount: sql<number>`COALESCE(SUM(${transactions.discountAmount}), 0)::int`,
        })
        .from(transactions)
        .where(txFilter)
        .groupBy(transactions.couponCode)
        .orderBy(sql`count(*) DESC`)
        .limit(5);

      return {
        success: true,
        days,
        totalRedemptions: totals?.totalRedemptions || 0,
        totalDiscountIdr: totals?.totalDiscount || 0,
        daily,
        topCoupons,
      };
    },
    {
      query: t.Object({
        days: t.Optional(t.Numeric({ default: 7 })),
        appId: t.Optional(t.String()),
        mode: t.Optional(t.Union([t.Literal("sandbox"), t.Literal("live")])),
      }),
      detail: {
        tags: ["MoR Checkout"],
        summary: "Coupon Redemption Stats",
        description:
          "Daily redemption counts, total discount granted, and top coupons over the last N days.",
      },
    }
  )

  /**
   * Buat kupon baru untuk sebuah app
   */
  .post(
    "/",
    async ({ body, request: { headers }, set }) => {
      const { appId, code, discountPercent, maxRedemptions = 0, expiresAt } = body;
      const { builder, isAdmin } = await resolveCurrentBuilder(headers);

      if (!isAdmin && !builder) {
        set.status = 401;
        return { success: false, error: "Unauthorized" };
      }

      // IDOR-5: Validasi kepemilikan appId oleh builder
      if (!isAdmin && builder) {
        const owned = await verifyOwnedApp(builder.id, appId, isAdmin);
        if ("error" in owned) {
          set.status = owned.status;
          return { success: false, error: owned.error };
        }
      }

      const app = await db.query.apps.findFirst({ where: eq(apps.id, appId) });
      if (!app) {
        set.status = 404;
        return { success: false, error: "App not found" };
      }

      const normalizedCode = code.trim().toUpperCase();
      if (!/^[A-Z0-9_-]{3,32}$/.test(normalizedCode)) {
        set.status = 400;
        return {
          success: false,
          error:
            "Kode kupon hanya boleh huruf, angka, tanda hubung, atau underscore (3-32 karakter).",
        };
      }

      if (discountPercent < 1 || discountPercent > 100) {
        set.status = 400;
        return { success: false, error: "discountPercent harus antara 1 dan 100." };
      }

      const clash = await db.query.coupons.findFirst({
        where: and(eq(coupons.code, normalizedCode), eq(coupons.appId, appId)),
      });
      if (clash) {
        set.status = 409;
        return { success: false, error: `Kupon "${normalizedCode}" sudah ada untuk app ini.` };
      }

      const [created] = await db
        .insert(coupons)
        .values({
          id: `cpn_${randomBytes(8).toString("hex")}`,
          code: normalizedCode,
          appId,
          discountPercent,
          maxRedemptions,
          expiresAt: expiresAt ? new Date(expiresAt) : null,
          isActive: true,
        })
        .returning();

      return { success: true, coupon: created };
    },
    {
      body: t.Object({
        appId: t.String(),
        code: t.String({ minLength: 3, maxLength: 32 }),
        discountPercent: t.Number({ minimum: 1, maximum: 100 }),
        maxRedemptions: t.Optional(t.Number({ minimum: 0 })),
        expiresAt: t.Optional(t.String()),
      }),
      detail: {
        tags: ["MoR Checkout"],
        summary: "Create Discount Coupon",
        description: "Creates a redeemable discount coupon scoped to one app.",
      },
    }
  )

  /**
   * Aktifkan / nonaktifkan kupon
   */
  .patch(
    "/:couponId",
    async ({ params: { couponId }, body, request: { headers }, set }) => {
      const { builder, isAdmin } = await resolveCurrentBuilder(headers);

      if (!isAdmin && !builder) {
        set.status = 401;
        return { success: false, error: "Unauthorized" };
      }

      // IDOR-5: Validasi kepemilikan kupon oleh builder
      if (!isAdmin && builder) {
        const owned = await verifyOwnedCoupon(builder.id, couponId, isAdmin);
        if ("error" in owned) {
          set.status = owned.status;
          return { success: false, error: owned.error };
        }
      }

      const updateData: Record<string, unknown> = { updatedAt: new Date() };
      if (body.isActive !== undefined) updateData.isActive = body.isActive;
      if (body.maxRedemptions !== undefined) updateData.maxRedemptions = body.maxRedemptions;

      const [updated] = await db
        .update(coupons)
        .set(updateData)
        .where(eq(coupons.id, couponId))
        .returning();

      if (!updated) {
        set.status = 404;
        return { success: false, error: "Coupon not found" };
      }

      return { success: true, coupon: updated };
    },
    {
      params: t.Object({ couponId: t.String() }),
      body: t.Object({
        isActive: t.Optional(t.Boolean()),
        maxRedemptions: t.Optional(t.Number({ minimum: 0 })),
      }),
      detail: {
        tags: ["MoR Checkout"],
        summary: "Update Coupon (toggle active / quota)",
      },
    }
  )

  /**
   * Hapus kupon
   */
  .delete(
    "/:couponId",
    async ({ params: { couponId }, request: { headers }, set }) => {
      const { builder, isAdmin } = await resolveCurrentBuilder(headers);

      if (!isAdmin && !builder) {
        set.status = 401;
        return { success: false, error: "Unauthorized" };
      }

      // IDOR-5: Validasi kepemilikan kupon oleh builder
      if (!isAdmin && builder) {
        const owned = await verifyOwnedCoupon(builder.id, couponId, isAdmin);
        if ("error" in owned) {
          set.status = owned.status;
          return { success: false, error: owned.error };
        }
      }

      const [deleted] = await db.delete(coupons).where(eq(coupons.id, couponId)).returning();

      if (!deleted) {
        set.status = 404;
        return { success: false, error: "Coupon not found" };
      }

      return { success: true, message: `Kupon ${deleted.code} dihapus.` };
    },
    {
      params: t.Object({ couponId: t.String() }),
      detail: {
        tags: ["MoR Checkout"],
        summary: "Delete Coupon",
      },
    }
  );
