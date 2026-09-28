import { db } from "../../db";
import { coupons, apps } from "../../db/schema";
import { eq, desc } from "drizzle-orm";

/**
 * Daftar Kupon Diskon (Global & Seluruh Aplikasi)
 */
export async function handlePanelCoupons() {
  const allCoupons = await db.query.coupons.findMany({
    orderBy: [desc(coupons.createdAt)],
  });

  const appIds = allCoupons.map((c) => c.appId).filter(Boolean) as string[];
  const appRows = appIds.length
    ? await db.query.apps.findMany({
        where: (a, { inArray }) => inArray(a.id, appIds),
      })
    : [];

  const appMap = new Map(appRows.map((a) => [a.id, a]));

  const enriched = allCoupons.map((c) => {
    const targetApp = c.appId ? appMap.get(c.appId) : null;
    return {
      id: c.id,
      code: c.code,
      appId: c.appId,
      appName: c.appId ? targetApp?.name || c.appId : "Global (Seluruh Platform)",
      appSlug: targetApp?.slug || null,
      isGlobal: !c.appId,
      discountPercent: c.discountPercent,
      maxRedemptions: c.maxRedemptions,
      redemptionCount: c.redemptionCount,
      isActive: c.isActive,
      expiresAt: c.expiresAt,
      createdAt: c.createdAt,
    };
  });

  return {
    success: true,
    total: enriched.length,
    coupons: enriched,
  };
}

/**
 * Buat Kupon Diskon Global Platform (Super Admin)
 */
export async function handleCreateGlobalCoupon({ body, set }: any) {
  const code = (body?.code || "").trim().toUpperCase();
  const discountPercent = Number(body?.discountPercent);
  const maxRedemptions = Number(body?.maxRedemptions) || 0;
  const expiresAt = body?.expiresAt ? new Date(body.expiresAt) : null;
  const appId = body?.appId || null; // null = global

  if (!code || code.length < 3) {
    set.status = 400;
    return { success: false, error: "Kode kupon minimal 3 karakter." };
  }

  if (isNaN(discountPercent) || discountPercent < 1 || discountPercent > 100) {
    set.status = 400;
    return { success: false, error: "Diskon kupon harus antara 1% hingga 100%." };
  }

  // Cek apakah kode sudah digunakan
  const existing = await db.query.coupons.findFirst({
    where: eq(coupons.code, code),
  });

  if (existing) {
    set.status = 409;
    return { success: false, error: `Kupon dengan kode '${code}' sudah ada.` };
  }

  const id = `cpn_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const [newCoupon] = await db
    .insert(coupons)
    .values({
      id,
      code,
      appId,
      discountPercent,
      maxRedemptions,
      redemptionCount: 0,
      isActive: true,
      expiresAt,
    })
    .returning();

  return {
    success: true,
    message: `Kupon '${code}' (${discountPercent}%) berhasil dibuat!`,
    coupon: newCoupon,
  };
}

/**
 * Toggle Status Aktif Kupon (Super Admin)
 */
export async function handleToggleCoupon({ params, set }: any) {
  const couponId = params.id;
  const target = await db.query.coupons.findFirst({
    where: eq(coupons.id, couponId),
  });

  if (!target) {
    set.status = 404;
    return { success: false, error: "Kupon tidak ditemukan." };
  }

  const updatedActive = !target.isActive;
  await db
    .update(coupons)
    .set({ isActive: updatedActive, updatedAt: new Date() })
    .where(eq(coupons.id, target.id));

  return {
    success: true,
    isActive: updatedActive,
    message: updatedActive
      ? `Kupon ${target.code} berhasil diaktifkan.`
      : `Kupon ${target.code} dinonaktifkan.`,
  };
}

/**
 * Hapus Kupon (Super Admin)
 */
export async function handleDeleteCoupon({ params, set }: any) {
  const couponId = params.id;
  const target = await db.query.coupons.findFirst({
    where: eq(coupons.id, couponId),
  });

  if (!target) {
    set.status = 404;
    return { success: false, error: "Kupon tidak ditemukan." };
  }

  await db.delete(coupons).where(eq(coupons.id, couponId));

  return {
    success: true,
    message: `Kupon ${target.code} berhasil dihapus.`,
  };
}
