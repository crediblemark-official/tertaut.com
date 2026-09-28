import { db } from "../../db";
import { user } from "../../db/schema/auth";
import { eq, desc } from "drizzle-orm";

/**
 * Daftar Seluruh Akun Pengguna Platform (Super Admin)
 */
export async function handlePanelUsers({ query }: any) {
  const limit = Math.min(Number(query?.limit) || 100, 500);

  const users = await db.query.user.findMany({
    orderBy: [desc(user.createdAt)],
    limit,
  });

  return {
    success: true,
    total: users.length,
    users: users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role === "admin" ? "admin" : "builder",
      emailVerified: u.emailVerified,
      banned: u.banned ?? false,
      banReason: u.banReason || null,
      createdAt: u.createdAt,
    })),
  };
}

/**
 * Ubah Hak Akses / Role Pengguna (Super Admin)
 */
export async function handleUpdateUserRole({ params, body, set }: any) {
  const userId = params.userId;
  const newRole = (body?.role || "").trim().toLowerCase();

  if (!["admin", "builder", "user"].includes(newRole)) {
    set.status = 400;
    return { success: false, error: "Role harus bernilai 'admin' atau 'builder'." };
  }

  const target = await db.query.user.findFirst({
    where: eq(user.id, userId),
  });

  if (!target) {
    set.status = 404;
    return { success: false, error: "Pengguna tidak ditemukan." };
  }

  const dbRole = newRole === "admin" ? "admin" : "user";

  await db.update(user).set({ role: dbRole, updatedAt: new Date() }).where(eq(user.id, target.id));

  return {
    success: true,
    userId: target.id,
    role: dbRole === "admin" ? "admin" : "builder",
    message: `Role ${target.name} (${target.email}) berhasil diubah menjadi ${dbRole === "admin" ? "Super Admin" : "Builder"}.`,
  };
}

/**
 * Bekukan / Buka Blokir Pengguna (Super Admin)
 */
export async function handleToggleUserBan({ params, body, set }: any) {
  const userId = params.userId;
  const reason = body?.reason || "Dibekukan oleh Super Admin";

  const target = await db.query.user.findFirst({
    where: eq(user.id, userId),
  });

  if (!target) {
    set.status = 404;
    return { success: false, error: "Pengguna tidak ditemukan." };
  }

  const newBanned = !target.banned;
  await db
    .update(user)
    .set({
      banned: newBanned,
      banReason: newBanned ? reason : null,
      updatedAt: new Date(),
    })
    .where(eq(user.id, target.id));

  return {
    success: true,
    userId: target.id,
    banned: newBanned,
    message: newBanned
      ? `Pengguna ${target.name} (${target.email}) berhasil diblokir.`
      : `Blokir pengguna ${target.name} (${target.email}) berhasil dibuka.`,
  };
}
