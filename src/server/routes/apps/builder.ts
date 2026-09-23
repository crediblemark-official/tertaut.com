import { db } from "../../db";
import { builders, apps } from "../../db/schema";
import { eq } from "drizzle-orm";
import { randomBytes } from "crypto";
import { authenticate, isAdminUser } from "../../middleware/auth";
import { config as appConfig } from "../../config";
import { generateAppApiKey, generateBuilderSecretApiKey } from "./api-key";

export async function resolveCurrentBuilder(
  headers: Headers
): Promise<{ builder: typeof builders.$inferSelect | null; isAdmin: boolean }> {
  const authRes = await authenticate(headers);
  if ("status" in authRes) return { builder: null, isAdmin: false };
  const user = authRes.user;
  const isAdmin = isAdminUser(user);

  // 1. Cari builder berdasarkan userId
  if (user.id && user.id !== "dev-user") {
    const b = await db.query.builders.findFirst({
      where: eq(builders.userId, user.id),
    });
    if (b) return { builder: b, isAdmin };
  }

  // 2. Cari builder berdasarkan email
  if (user.email) {
    const b = await db.query.builders.findFirst({
      where: eq(builders.email, user.email),
    });
    if (b) return { builder: b, isAdmin };
  }

  // 3. Jika user login belum memiliki profil builder, buatkan profil spesifik untuk user ini
  if (user.id && user.id !== "dev-user") {
    try {
      const [created] = await db
        .insert(builders)
        .values({
          userId: user.id,
          email: user.email
            ? `${user.email}`
            : `builder_${randomBytes(4).toString("hex")}@tertaut.com`,
          name: user.name || "Vibe Builder",
          apiKey: `tt_${appConfig.isSandbox ? "test" : "live"}_${randomBytes(16).toString("hex")}`,
          secretApiKey: generateBuilderSecretApiKey(),
        })
        .returning();
      if (created) return { builder: created, isAdmin };
    } catch {
      // Abaikan jika unique constraint conflict (email sudah dipakai builder lain)
    }
  }

  // 4. Mode sandbox (development): SEMUA user login wajib mendapat builder milik
  //    dirinya sendiri — TIDAK BOLEH menumpang/membagikan builder user lain.
  //    (P0-AUTH: fallback lama memakai builder random pertama di DB → identitas
  //    tampak tercampur antar user di sandbox/UAT yang berisi data nyata.)
  if (appConfig.isSandbox) {
    try {
      const [created] = await db
        .insert(builders)
        .values({
          userId: user.id,
          // Email acak unik (jangan pakai email user — bisa bentrok dengan builder
          // yang sudah memakai email tersebut, dan konflik itu justru skenario yang
          // ingin kita cegah: identitas tercampur).
          email: `builder_${randomBytes(4).toString("hex")}@tertaut.com`,
          name: user.name || "Vibe Builder",
          apiKey: `tt_test_${randomBytes(16).toString("hex")}`,
          secretApiKey: generateBuilderSecretApiKey(),
        })
        .returning();
      if (created) return { builder: created, isAdmin };
    } catch {
      // Conflict unik tidak mungkin dengan email acak — abaikan jika ini terjadi.
    }
    return { builder: null, isAdmin };
  }

  return { builder: null, isAdmin };
}

/**
 * Seed demo builder & sample app untuk environment sandbox (development).
 * Tidak pernah dijalankan di production.
 */
export async function seedSandboxBuilderIfNeeded(): Promise<void> {
  let demoBuilder = await db.query.builders.findFirst();
  if (!demoBuilder) {
    const [createdBuilder] = await db
      .insert(builders)
      .values({
        email: "builder@tertaut.com",
        name: "Vibe Builder",
        apiKey: `tt_live_${randomBytes(16).toString("hex")}`,
        secretApiKey: generateBuilderSecretApiKey(),
      })
      .returning();
    demoBuilder = createdBuilder;

    // Buat sample app
    await db.insert(apps).values({
      id: "app_demo_123",
      builderId: demoBuilder.id,
      apiKey: generateAppApiKey("sandbox"),
      name: "FastMail AI Summarizer",
      slug: "fastmail-ai",
      mode: "sandbox",
      targetPrice: 49000,
      description: "Chrome extension untuk merangkum email penting secara instan menggunakan AI.",
      redirectUrl: "https://situsbisnis.com/@builder/success",
    });
  }
}
