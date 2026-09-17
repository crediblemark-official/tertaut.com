import { db } from "../../db";
import { builders, apps } from "../../db/schema";
import { eq } from "drizzle-orm";
import { randomBytes } from "crypto";
import { authenticate } from "../../middleware/auth";
import { config as appConfig } from "../../config";

export async function resolveCurrentBuilder(
  headers: Headers
): Promise<{ builder: typeof builders.$inferSelect | null; isAdmin: boolean }> {
  const authRes = await authenticate(headers);
  if ("status" in authRes) return { builder: null, isAdmin: false };
  const user = authRes.user;
  const isAdmin = user.role === "admin";

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

  // 3. Fallback dev/sandbox: cari demo builder atau buatkan
  let fallback = await db.query.builders.findFirst();
  if (!fallback && appConfig.isSandbox) {
    const [created] = await db
      .insert(builders)
      .values({
        email: user.email || "builder@tertaut.com",
        name: user.name || "Vibe Builder",
        apiKey: `tt_live_${randomBytes(16).toString("hex")}`,
      })
      .returning();
    fallback = created;
  }
  return { builder: fallback || null, isAdmin };
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
      })
      .returning();
    demoBuilder = createdBuilder;

    // Buat sample app
    await db.insert(apps).values({
      id: "app_demo_123",
      builderId: demoBuilder.id,
      name: "FastMail AI Summarizer",
      slug: "fastmail-ai",
      mode: "sandbox",
      targetPrice: 49000,
      description: "Chrome extension untuk merangkum email penting secara instan menggunakan AI.",
      redirectUrl: "https://situsbisnis.com/@builder/success",
    });
  }
}
