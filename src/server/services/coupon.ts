import { db } from "../db";
import { coupons, type Coupon } from "../db/schema";
import { and, eq, isNull, sql } from "drizzle-orm";

export interface CouponValidationResult {
  valid: boolean;
  errorCode?:
    | "COUPON_NOT_FOUND"
    | "COUPON_INACTIVE"
    | "COUPON_EXPIRED"
    | "COUPON_EXHAUSTED"
    | "COUPON_APP_MISMATCH";
  message?: string;
  coupon?: Coupon;
  discountPercent?: number;
  /** Nominal IDR yang dipotong dari harga list (grossAmount sebelum diskon) */
  discountAmount?: number;
}

export class CouponService {
  /**
   * Validasi kode kupon terhadap app & harga tertentu (tanpa mutasi state).
   * Kupon terikat app (coupon.appId = app.id) atau global (appId = null) keduanya sah.
   */
  static async validate(
    code: string,
    appId: string,
    listPrice: number
  ): Promise<CouponValidationResult> {
    const normalized = (code || "").trim().toUpperCase();
    if (!normalized) {
      return { valid: false, errorCode: "COUPON_NOT_FOUND", message: "Kode kupon tidak boleh kosong." };
    }

    // Kupon dengan code unik global; cek app-scope dulu, lalu fallback global (appId null)
    let coupon =
      (await db.query.coupons.findFirst({
        where: and(eq(coupons.code, normalized), eq(coupons.appId, appId)),
      })) ||
      (await db.query.coupons.findFirst({
        where: and(eq(coupons.code, normalized), isNull(coupons.appId)),
      }));

    if (!coupon) {
      return { valid: false, errorCode: "COUPON_NOT_FOUND", message: `Kupon "${normalized}" tidak ditemukan.` };
    }

    if (!coupon.isActive) {
      return { valid: false, errorCode: "COUPON_INACTIVE", message: "Kupon sedang tidak aktif." };
    }

    if (coupon.expiresAt && coupon.expiresAt.getTime() < Date.now()) {
      return { valid: false, errorCode: "COUPON_EXPIRED", message: "Kupon sudah kedaluwarsa." };
    }

    if (coupon.maxRedemptions > 0 && coupon.redemptionCount >= coupon.maxRedemptions) {
      return {
        valid: false,
        errorCode: "COUPON_EXHAUSTED",
        message: "Kuota penebusan kupon telah habis.",
      };
    }

    const discountPercent = Math.min(100, Math.max(1, coupon.discountPercent));
    const discountAmount = Math.round((listPrice * discountPercent) / 100);

    return { valid: true, coupon, discountPercent, discountAmount };
  }

  /**
   * Redeem atomik: increment redemptionCount hanya jika masih ada kuota.
   * Mengembalikan null jika kupon kehabisan kuota di antara validasi dan penebusan (race).
   */
  static async redeem(couponId: string): Promise<boolean> {
    const claimed = await db
      .update(coupons)
      .set({ redemptionCount: sql`${coupons.redemptionCount} + 1`, updatedAt: new Date() })
      .where(
        and(
          eq(coupons.id, couponId),
          eq(coupons.isActive, true),
          // 0 = unlimited; kalau ada kuota, hanya increment saat redemptionCount < maxRedemptions
          sql`(${coupons.maxRedemptions} = 0 OR ${coupons.redemptionCount} < ${coupons.maxRedemptions})`
        )
      )
      .returning({ id: coupons.id });

    return claimed.length > 0;
  }
}
