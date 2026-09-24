import { db } from "./index";
import { user, builders, apps, coupons, type DeliveryConfig } from "./schema";
import { eq } from "drizzle-orm";
import { auth } from "../auth";
import { randomBytes } from "crypto";
import { config } from "../config";

export async function ensureDemoData(): Promise<void> {
  try {
    const adminEmail = (
      config.admin.email ||
      process.env.ADMIN_EMAIL ||
      "platformtertaut@gmail.com"
    ).toLowerCase();

    // 1. Pastikan akun Super Admin resmi (platformtertaut@gmail.com) tersedia
    let adminUser = await db.query.user.findFirst({
      where: eq(user.email, adminEmail),
    });

    if (!adminUser) {
      const adminPassword =
        config.admin.password ||
        (config.isTest ? "TestAdminPass123!" : `Sec_${randomBytes(16).toString("hex")}!Aa1`);

      try {
        await auth.api.signUpEmail({
          body: {
            email: adminEmail,
            password: adminPassword,
            name: "Platform Tertaut",
          },
        });
        adminUser = await db.query.user.findFirst({
          where: eq(user.email, adminEmail),
        });
        console.log(`[Demo] Akun Super Admin (${adminEmail}) berhasil dibuat.`);
      } catch (err: any) {
        console.warn("[Demo] Gagal membuat akun platform otomatis:", err?.message || err);
      }
    }

    if (adminUser) {
      await db
        .update(user)
        .set({ role: "admin", emailVerified: true })
        .where(eq(user.id, adminUser.id));
    }

    if (!adminUser) {
      console.warn(`[Demo] Tidak dapat memuat akun Super Admin (${adminEmail}).`);
      return;
    }

    // 2. Pastikan profil Builder Utama tersedia
    let primaryBuilder = await db.query.builders.findFirst({
      where: eq(builders.userId, adminUser.id),
    });

    if (!primaryBuilder) {
      const [newB] = await db
        .insert(builders)
        .values({
          userId: adminUser.id,
          name: "Tertaut Labs (Founder)",
          email: adminUser.email,
          apiKey: `tt_live_${randomBytes(16).toString("hex")}`,
          secretApiKey: `tt_sec_${randomBytes(24).toString("hex")}`,
          disbursementAccount: {
            bankCode: "BCA",
            accountNumber: "8830192847",
            accountHolderName: adminUser.name || "Ahmad Rizky",
          },
        })
        .returning();
      primaryBuilder = newB;
    }

    if (!primaryBuilder) {
      console.warn("[Demo] Gagal memastikan primary builder.");
      return;
    }

    // 3. Pastikan Aplikasi Demo: FastMail AI Summarizer (fastmail-ai)
    const existingFastMail = await db.query.apps.findFirst({
      where: eq(apps.slug, "fastmail-ai"),
    });

    const fastMailDelivery: DeliveryConfig = {
      licenseKey: {
        enabled: true,
        description: "Lisensi Universal Tertaut",
        expiresInDays: 365,
        maxSeats: 1,
        offlineGraceDays: 30,
      },
    };

    if (!existingFastMail) {
      await db.insert(apps).values({
        id: "app_fastmail_ai",
        builderId: primaryBuilder.id,
        apiKey: `tt_test_${randomBytes(16).toString("hex")}`,
        name: "FastMail AI Summarizer",
        slug: "fastmail-ai",
        mode: "sandbox",
        targetPrice: 49000,
        pricingType: "one_time",
        description:
          "Ekstensi Chrome & web app untuk merangkum email penting secara otomatis menggunakan Gemini AI.",
        headline: "FastMail AI Summarizer",
        subheadline: "Solusi software cerdas & lisensi otomatis resmi.",
        mediaUrl:
          "https://images.unsplash.com/photo-1557804506-669a67965ba0?auto=format&fit=crop&w=800&q=80",
        valueProps: [
          "Aktivasi instan dan otomatis via email",
          "Lisensi resmi terikat hardware / device",
          "Update versi & dukungan pelanggan langsung",
        ],
        ctaText: "Coba Demo Checkout",
        deliveryConfig: fastMailDelivery,
      });
      console.log(
        "✅ [Demo] Aplikasi demo FastMail AI (fastmail-ai) berhasil disiapkan dalam mode Sandbox!"
      );
    } else if (existingFastMail.mode !== "sandbox") {
      await db
        .update(apps)
        .set({ mode: "sandbox", ctaText: "Coba Demo Checkout" })
        .where(eq(apps.id, existingFastMail.id));
      console.log("✅ [Demo] Mode aplikasi demo FastMail AI dipindahkan ke Sandbox.");
    }

    // 4. Pastikan Aplikasi Demo: DevDocs Desktop Pro (devdocs-desktop)
    const existingDevDocs = await db.query.apps.findFirst({
      where: eq(apps.slug, "devdocs-desktop"),
    });

    const devdocsDelivery: DeliveryConfig = {
      licenseKey: {
        enabled: true,
        description: "Lisensi Universal Tertaut",
        expiresInDays: 365,
        maxSeats: 3,
        offlineGraceDays: 30,
        floating: {
          enabled: true,
          leaseTtlSeconds: 300,
          heartbeatIntervalSeconds: 60,
        },
      },
    };

    if (!existingDevDocs) {
      await db.insert(apps).values({
        id: "app_devdocs_pro",
        builderId: primaryBuilder.id,
        apiKey: `tt_live_${randomBytes(16).toString("hex")}`,
        name: "DevDocs Desktop Pro",
        slug: "devdocs-desktop",
        mode: "live",
        targetPrice: 149000,
        pricingType: "one_time",
        description:
          "Aplikasi desktop offline-first untuk dokumentasi framework dengan pencarian instan dan lisensi seumur hidup.",
        headline: "DevDocs Desktop Pro",
        subheadline: "Dokumentasi offline super cepat untuk developer.",
        mediaUrl:
          "https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=800&q=80",
        valueProps: [
          "Akses 100+ dokumentasi framework offline",
          "Pencarian instan berkecepatan tinggi",
          "Lisensi seumur hidup tanpa biaya langganan",
        ],
        ctaText: "Beli Lisensi Pro",
        deliveryConfig: devdocsDelivery,
      });
      console.log("✅ [Demo] Aplikasi demo DevDocs Desktop (devdocs-desktop) berhasil disiapkan!");
    }

    // 5. Pastikan Kupon Diskon Demo (LAUNCH2026)
    const existingCoupon = await db.query.coupons.findFirst({
      where: eq(coupons.code, "LAUNCH2026"),
    });

    if (!existingCoupon) {
      await db.insert(coupons).values({
        id: "cpn_global_launch",
        code: "LAUNCH2026",
        appId: null, // Berlaku global
        discountPercent: 20,
        maxRedemptions: 500,
        redemptionCount: 0,
        isActive: true,
      });
      console.log("✅ [Demo] Kupon diskon demo LAUNCH2026 (20%) berhasil disiapkan!");
    }
  } catch (error: any) {
    console.warn("[Demo] Gagal inisialisasi demo data:", error?.message || error);
  }
}
