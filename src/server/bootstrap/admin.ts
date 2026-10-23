import { db } from "../db";
import { user, account } from "../db/schema";
import { eq, and } from "drizzle-orm";
import { config } from "../config";
import { auth } from "../auth";
import { randomBytes } from "crypto";
import { hashPassword } from "better-auth/crypto";

/**
 * Pastikan akun admin platform (platformtertaut@gmail.com atau ADMIN_EMAIL)
 * memiliki role "admin" dan emailVerified: true.
 * Akun lain tidak boleh dipromosikan otomatis hanya karena terdaftar pertama.
 */
export async function ensurePlatformAdmin(): Promise<void> {
  try {
    const adminEmail = (
      config.admin.email ||
      process.env.ADMIN_EMAIL ||
      "platformtertaut@gmail.com"
    ).toLowerCase();

    let platformUser = await db.query.user.findFirst({
      where: eq(user.email, adminEmail),
    });

    if (!platformUser) {
      const adminPassword =
        config.admin.password ||
        (config.isTest ? "TestAdminPass123!" : `Sec_${randomBytes(16).toString("hex")}!Aa1`);

      if (!config.admin.password && !config.isTest) {
        console.warn(
          `[Auth] PERINGATAN: ADMIN_PASSWORD tidak disetel di environment. Password awal yang di-generate: ${adminPassword}`
        );
      }

      try {
        await auth.api.signUpEmail({
          body: {
            email: adminEmail,
            password: adminPassword,
            name: "Platform Tertaut",
          },
        });
        platformUser = await db.query.user.findFirst({
          where: eq(user.email, adminEmail),
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn("[Auth] Gagal inisialisasi akun platform admin:", msg);
      }
    }

    if (platformUser && (platformUser.role !== "admin" || !platformUser.emailVerified)) {
      await db
        .update(user)
        .set({ role: "admin", emailVerified: true })
        .where(eq(user.id, platformUser.id));
      console.log(`[Auth] Akun platform (${adminEmail}) dipastikan sebagai admin.`);
    }

    if (platformUser && config.admin.password) {
      const hashedPassword = await hashPassword(config.admin.password);
      const existingAccount = await db.query.account.findFirst({
        where: and(eq(account.userId, platformUser.id), eq(account.providerId, "credential")),
      });

      if (existingAccount) {
        await db
          .update(account)
          .set({ password: hashedPassword, updatedAt: new Date() })
          .where(eq(account.id, existingAccount.id));
      } else {
        await db.insert(account).values({
          id: `acc_admin_${Date.now()}`,
          accountId: platformUser.id,
          providerId: "credential",
          userId: platformUser.id,
          password: hashedPassword,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
      console.log(
        `[Auth] Password akun platform (${adminEmail}) berhasil disinkronkan dari environment.`
      );
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.warn("[Auth] Gagal memeriksa status admin platform:", msg);
  }
}

export const ensureFirstUserIsAdmin = ensurePlatformAdmin;
