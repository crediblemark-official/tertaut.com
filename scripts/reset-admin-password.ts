/**
 * Script: Reset/Set Platform Admin Password
 *
 * Berguna jika password admin lupa atau belum sinkron di production.
 *
 * Jalankan:
 *   bun scripts/reset-admin-password.ts
 * atau:
 *   bun scripts/reset-admin-password.ts "PasswordBaru123@"
 */

import { db } from "../src/server/db";
import { user, account } from "../src/server/db/schema";
import { eq, and } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";
import { config } from "../src/server/config";

const adminEmail = (
  process.argv[3] ||
  config.admin.email ||
  process.env.ADMIN_EMAIL ||
  "platformtertaut@gmail.com"
)
  .toLowerCase()
  .trim();

const targetPassword =
  process.argv[2] ||
  config.admin.password ||
  process.env.ADMIN_PASSWORD ||
  "BismillahKayaRaya@Tertaut";

console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("🔐 Sinkronisasi Password Super Admin Tertaut");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
console.log(`   Email Admin : ${adminEmail}`);
console.log(`   Password    : ${targetPassword.replace(/./g, "*")}`);

try {
  let existingUser = await db.query.user.findFirst({
    where: eq(user.email, adminEmail),
  });

  const hashedPassword = await hashPassword(targetPassword);

  if (!existingUser) {
    console.log("\n⚠️  User belum ada di database, membuat user baru...");
    const userId = `usr_admin_${Date.now()}`;
    await db.insert(user).values({
      id: userId,
      name: "Platform Tertaut",
      email: adminEmail,
      emailVerified: true,
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await db.insert(account).values({
      id: `acc_${Date.now()}`,
      accountId: userId,
      providerId: "credential",
      userId: userId,
      password: hashedPassword,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    console.log("✅ User admin baru berhasil dibuat dengan hak akses Super Admin!");
  } else {
    console.log(`\n🔍 User ditemukan (ID: ${existingUser.id}). Mengupdate status & password...`);

    // Pastikan role admin & emailVerified true
    await db
      .update(user)
      .set({ role: "admin", emailVerified: true, updatedAt: new Date() })
      .where(eq(user.id, existingUser.id));

    const existingAccount = await db.query.account.findFirst({
      where: and(eq(account.userId, existingUser.id), eq(account.providerId, "credential")),
    });

    if (existingAccount) {
      await db
        .update(account)
        .set({ password: hashedPassword, updatedAt: new Date() })
        .where(eq(account.id, existingAccount.id));
      console.log("✅ Password berhasil di-update!");
    } else {
      await db.insert(account).values({
        id: `acc_${Date.now()}`,
        accountId: existingUser.id,
        providerId: "credential",
        userId: existingUser.id,
        password: hashedPassword,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      console.log("✅ Kredensial akun berhasil di-generate!");
    }
  }

  console.log("\n🎉 SELESAI! Silakan login di browser dengan:");
  console.log(`   Email    : ${adminEmail}`);
  console.log(`   Password : ${targetPassword}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  process.exit(0);
} catch (err: any) {
  console.error("\n❌ Gagal mereset password:", err?.message || err);
  process.exit(1);
}
