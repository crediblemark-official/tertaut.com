import { db } from "../db";
import {
  apps,
  licenses,
  coupons,
} from "../db/schema";
import { eq, and } from "drizzle-orm";
import { randomBytes } from "crypto";
import { config } from "../config";

export interface ConvertToLiveParams {
  campaignId: string;
  discountPercent?: number;
  couponCode?: string;
  builderId?: string;
}

export interface ConvertToLiveResult {
  campaignId: string;
  appSlug: string;
  appName: string;
  liveCheckoutUrl: string;
  couponCode: string;
  discountPercent: number;
  status: string;
}

export interface WidgetDataResult {
  appName: string;
  slug: string;
  status: "LIVE" | "SANDBOX";
  verifiedBy: string;
  totalCustomers: number;
  targetPrice: number;
  checkoutUrl: string;
}

export class LaunchService {
  /**
   * Pemicu Sekali Klik untuk Beralih ke Mode LIVE (FR-1.1, FR-1.2, FR-1.3)
   */
  static async convertToLiveLaunch(params: ConvertToLiveParams): Promise<ConvertToLiveResult> {
    const { campaignId, discountPercent = 50 } = params;

    // 1. Cari app berdasarkan ID atau slug
    const app =
      (await db.query.apps.findFirst({ where: eq(apps.id, campaignId) })) ||
      (await db.query.apps.findFirst({ where: eq(apps.slug, campaignId) }));

    if (!app) {
      throw new Error(`Aplikasi dengan ID / slug '${campaignId}' tidak ditemukan.`);
    }

    // 2. Ubah mode aplikasi ke 'live'
    await db
      .update(apps)
      .set({
        mode: "live",
        updatedAt: new Date(),
      })
      .where(eq(apps.id, app.id));

    const couponCode = (params.couponCode || `EARLY${discountPercent}`).trim().toUpperCase();
    const liveCheckoutUrl = `${config.publicAppUrl}/pay/${app.slug}`;

    // Persist kupon agar benar-benar dapat ditebus di checkout (sebelumnya hanya
    // dikembalikan ke client tanpa pernah disimpan — kupon kosong).
    const existingCoupon = await db.query.coupons.findFirst({
      where: and(eq(coupons.code, couponCode), eq(coupons.appId, app.id)),
    });

    if (existingCoupon) {
      // Reaktivasi & sinkronkan diskon bila kupon sudah ada untuk app ini
      await db
        .update(coupons)
        .set({
          discountPercent,
          isActive: true,
          updatedAt: new Date(),
        })
        .where(eq(coupons.id, existingCoupon.id));
    } else {
      await db.insert(coupons).values({
        id: `cpn_${randomBytes(8).toString("hex")}`,
        code: couponCode,
        appId: app.id,
        discountPercent,
        isActive: true,
      });
    }

    return {
      campaignId: app.id,
      appSlug: app.slug,
      appName: app.name,
      liveCheckoutUrl,
      couponCode,
      discountPercent,
      status: "LIVE",
    };
  }

  /**
   * Ambil data status widget & badge embed (FR-2.1 & FR-2.2)
   */
  static async getWidgetData(appSlug: string): Promise<WidgetDataResult | null> {
    const cleanSlug = appSlug.replace(/\.svg$/i, "").trim();

    const app =
      (await db.query.apps.findFirst({ where: eq(apps.slug, cleanSlug) })) ||
      (await db.query.apps.findFirst({ where: eq(apps.id, cleanSlug) }));

    if (!app) {
      return null;
    }

    // Hitung total lisensi aktif / terjual sebagai social proof
    const activeLicenses = await db.query.licenses.findMany({
      where: eq(licenses.appId, app.id),
    });

    return {
      appName: app.name,
      slug: app.slug,
      status: app.mode === "live" ? "LIVE" : "SANDBOX",
      verifiedBy: "tertaut.com",
      totalCustomers: activeLicenses.length,
      targetPrice: app.targetPrice,
      checkoutUrl: `${config.publicAppUrl}/pay/${app.slug}`,
    };
  }
}