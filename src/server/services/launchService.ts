import { db } from "../db";
import {
  apps,
  licenses,
} from "../db/schema";
import { eq } from "drizzle-orm";
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
  status: "LIVE" | "ARCHIVED";
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

    const couponCode = params.couponCode || `EARLY${discountPercent}`;
    const liveCheckoutUrl = `${config.publicAppUrl}/pay/${app.slug}`;

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
      status: app.mode === "live" ? "LIVE" : "ARCHIVED",
      verifiedBy: "tertaut.com",
      totalCustomers: activeLicenses.length,
      targetPrice: app.targetPrice,
      checkoutUrl: `${config.publicAppUrl}/pay/${app.slug}`,
    };
  }
}