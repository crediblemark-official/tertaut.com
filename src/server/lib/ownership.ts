import { db } from "../db";
import { apps, licenses, coupons } from "../db/schema";
import { eq, or } from "drizzle-orm";
import type { App } from "../db/schema/apps";
import type { License } from "../db/schema/licenses";
import type { Coupon } from "../db/schema/coupons";

export interface OwnershipError {
  status: 403 | 404;
  error: string;
}

/**
 * Memastikan builder terautentikasi memiliki akses ke aplikasi (appId).
 * Admin platform (`isAdmin = true`) selalu diizinkan bypass.
 */
export async function verifyOwnedApp(
  builderId: string,
  appId: string,
  isAdmin = false
): Promise<{ app: App } | OwnershipError> {
  if (!appId) {
    return { status: 404, error: "App not found" };
  }
  const app = await db.query.apps.findFirst({
    where: eq(apps.id, appId.trim()),
  });
  if (!app) {
    return { status: 404, error: "App not found" };
  }
  if (!isAdmin && (!builderId || app.builderId !== builderId)) {
    return { status: 403, error: "Forbidden: Anda bukan pemilik aplikasi ini" };
  }
  return { app };
}

/**
 * Memastikan builder terautentikasi memiliki lisensi (berdasarkan licenseId atau licenseKey).
 * Lisensi diverifikasi melalui kepemilikan builder terhadap appId terkait.
 * Admin platform (`isAdmin = true`) selalu diizinkan bypass.
 */
export async function verifyOwnedLicense(
  builderId: string,
  licenseKeyOrId: string,
  isAdmin = false
): Promise<{ license: License; app: App } | OwnershipError> {
  if (!licenseKeyOrId) {
    return { status: 404, error: "License not found" };
  }
  const trimmed = licenseKeyOrId.trim();
  const lic = await db.query.licenses.findFirst({
    where: or(eq(licenses.id, trimmed), eq(licenses.licenseKey, trimmed)),
  });
  if (!lic) {
    return { status: 404, error: "License not found" };
  }
  const app = await db.query.apps.findFirst({
    where: eq(apps.id, lic.appId),
  });
  if (!app) {
    return { status: 404, error: "Aplikasi terkait lisensi tidak ditemukan" };
  }
  if (!isAdmin && (!builderId || app.builderId !== builderId)) {
    return { status: 403, error: "Forbidden: Anda bukan pemilik lisensi ini" };
  }
  return { license: lic, app };
}

/**
 * Memastikan builder terautentikasi memiliki kupon diskon (berdasarkan couponId).
 * Kupon diverifikasi melalui kepemilikan builder terhadap appId terkait.
 * Admin platform (`isAdmin = true`) selalu diizinkan bypass.
 */
export async function verifyOwnedCoupon(
  builderId: string,
  couponId: string,
  isAdmin = false
): Promise<{ coupon: Coupon; app: App } | OwnershipError> {
  if (!couponId) {
    return { status: 404, error: "Coupon not found" };
  }
  const trimmed = couponId.trim();
  const cpn = await db.query.coupons.findFirst({
    where: eq(coupons.id, trimmed),
  });
  if (!cpn) {
    return { status: 404, error: "Coupon not found" };
  }
  if (!cpn.appId) {
    if (!isAdmin) {
      return { status: 403, error: "Forbidden: Kupon platform hanya dapat dikelola oleh admin" };
    }
    return { status: 404, error: "Kupon platform tidak terikat pada aplikasi spesifik" };
  }
  const app = await db.query.apps.findFirst({
    where: eq(apps.id, cpn.appId),
  });
  if (!app) {
    return { status: 404, error: "Aplikasi terkait kupon tidak ditemukan" };
  }
  if (!isAdmin && (!builderId || app.builderId !== builderId)) {
    return { status: 403, error: "Forbidden: Anda bukan pemilik kupon ini" };
  }
  return { coupon: cpn, app };
}
