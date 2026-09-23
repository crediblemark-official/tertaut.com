import { db } from "../../db";
import { builders, apps } from "../../db/schema";
import { eq } from "drizzle-orm";

/**
 * Toggle suspend builder oleh Super Admin
 */
export async function handleToggleSuspendBuilder({ params, set }: any) {
  const builderId = params.builderId;
  const builder = await db.query.builders.findFirst({
    where: eq(builders.id, builderId),
  });

  if (!builder) {
    set.status = 404;
    return { success: false, error: "Builder tidak ditemukan." };
  }

  const newSuspended = !builder.isSuspended;

  await db
    .update(builders)
    .set({ isSuspended: newSuspended, updatedAt: new Date() })
    .where(eq(builders.id, builder.id));

  return {
    success: true,
    builderId: builder.id,
    isSuspended: newSuspended,
    message: newSuspended
      ? `Builder ${builder.name} (${builder.email}) berhasil dibekukan (suspended).`
      : `Builder ${builder.name} (${builder.email}) telah diaktifkan kembali.`,
  };
}

/**
 * Toggle suspend aplikasi oleh Super Admin
 */
export async function handleToggleSuspendApp({ params, set }: any) {
  const appId = params.appId;
  const app = await db.query.apps.findFirst({
    where: eq(apps.id, appId),
  });

  if (!app) {
    set.status = 404;
    return { success: false, error: "Aplikasi tidak ditemukan." };
  }

  const newSuspended = !app.isSuspended;

  await db
    .update(apps)
    .set({ isSuspended: newSuspended, updatedAt: new Date() })
    .where(eq(apps.id, app.id));

  return {
    success: true,
    appId: app.id,
    isSuspended: newSuspended,
    message: newSuspended
      ? `Aplikasi ${app.name} (${app.slug}) berhasil dibekukan (suspended). Pembelian baru akan ditolak.`
      : `Aplikasi ${app.name} (${app.slug}) telah diaktifkan kembali untuk transaksi publik.`,
  };
}
