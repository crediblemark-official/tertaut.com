import { db } from "./index";
import { user, builders, apps, coupons, type DeliveryConfig, type MeteringConfig } from "./schema";
import { eq } from "drizzle-orm";
import { auth } from "../auth";
import { randomBytes } from "crypto";
import { config } from "../config";

export interface DemoAppSpec {
  id: string;
  name: string;
  slug: string;
  targetPrice: number;
  pricingType: "one_time" | "subscription" | "free";
  billingPeriod?: string;
  headline: string;
  subheadline: string;
  description: string;
  mediaUrl: string;
  ctaText: string;
  valueProps: string[];
  deliveryConfig: DeliveryConfig;
  meteringConfig?: MeteringConfig;
}

/**
 * 5 Demo Produk Resmi tertaut.com merepresentasikan 5 jenis produk:
 * 1. licenseKey      : FastMail AI Summarizer (Software License & Extension)
 * 2. fileDownload     : Next.js SaaS Enterprise Boilerplate (Digital Asset / Source Code)
 * 3. apiAccess        : IndoOCR Cloud Vision API (Developer API Access)
 * 4. privateNote      : VibeCoder VIP Community & Mastermind (Private Community / Secret)
 * 5. meteringConfig   : SmartAI LLM Proxy Gateway (Metered / Usage-Based Pricing)
 */
export const DEMO_APPS: DemoAppSpec[] = [
  // 1. Jenis: Lisensi Software (licenseKey)
  {
    id: "app_fastmail_ai",
    slug: "fastmail-ai",
    name: "FastMail AI Summarizer",
    targetPrice: 49000,
    pricingType: "one_time",
    headline: "FastMail AI Summarizer",
    subheadline: "Lisensi universal software dengan aktivasi Ed25519 terikat hardware.",
    description:
      "Ekstensi Chrome cerdas untuk merangkum email panjang dan menyusun draft balasan otomatis bertenaga Gemini AI.",
    mediaUrl:
      "https://images.unsplash.com/photo-1557804506-669a67965ba0?auto=format&fit=crop&w=800&q=80",
    ctaText: "Beli Lisensi Sekarang",
    valueProps: [
      "Aktivasi lisensi resmi terikat hardware (HWID)",
      "Masa berlaku 365 hari dengan offline grace token 30 hari",
      "Pembaruan versi otomatis & dukungan teknis langsung",
    ],
    deliveryConfig: {
      licenseKey: {
        enabled: true,
        description: "Lisensi Universal Tertaut (1 Seat / Perangkat)",
        expiresInDays: 365,
        maxSeats: 1,
        offlineGraceDays: 30,
      },
    },
  },

  // 2. Jenis: Unduhan Berkas / File Digital (fileDownload)
  {
    id: "app_saas_starter_kit",
    slug: "saas-starter-kit",
    name: "Next.js SaaS Enterprise Boilerplate",
    targetPrice: 149000,
    pricingType: "one_time",
    headline: "Next.js 15 SaaS Starter Kit (Full Source Code)",
    subheadline: "Unduhan source code lengkap siap deploy dengan database & autentikasi.",
    description:
      "Arsitektur SaaS production-ready berbasis Next.js 15, Drizzle ORM PostgreSQL, Better Auth, Tailwind CSS, dan integrasi MoR payment.",
    mediaUrl:
      "https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=800&q=80",
    ctaText: "Unduh Source Code ZIP",
    valueProps: [
      "Full source code ZIP siap deploy ke VPS / Dokploy / Vercel",
      "Multi-tenancy, RBAC role admin/user, & billing terintegrasi",
      "Termasuk dokumentasi panduan setup step-by-step",
    ],
    deliveryConfig: {
      fileDownload: {
        enabled: true,
        title: "Next.js SaaS Production Package (Full Source Code)",
        fileUrl: "https://dl.tertaut.com/releases/nextjs-saas-starter-v2.zip",
        fileName: "nextjs-saas-starter-v2.4.0.zip",
      },
    },
  },

  // 3. Jenis: Akses API & Kredensial Pengembang (apiAccess)
  {
    id: "app_indoocr_api",
    slug: "indoocr-api",
    name: "IndoOCR Cloud Vision API",
    targetPrice: 99000,
    pricingType: "subscription",
    billingPeriod: "monthly",
    headline: "IndoOCR Cloud Vision API Developer Access",
    subheadline: "Kredensial API instan untuk ekstraksi otomatis dokumen identitas Indonesia.",
    description:
      "API ekstraksi OCR presisi tinggi untuk KTP, SIM, NPWP, dan struk belanja Indonesia dengan latensi di bawah 200ms.",
    mediaUrl:
      "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80",
    ctaText: "Langganan Akses API",
    valueProps: [
      "Kredensial API token diterbitkan otomatis setelah pembayaran",
      "Endpoint HTTPS aman dengan SLA uptime 99.9%",
      "Termasuk SDK TypeScript/Node.js & Python",
    ],
    deliveryConfig: {
      apiAccess: {
        enabled: true,
        endpointUrl: "https://api.indoocr.id/v1/extract",
        scope: "ocr:read documents:extract batch:process",
        instruction:
          "Sertakan header `Authorization: Bearer <API_KEY>` pada setiap request. Dokumentasi lengkap: https://docs.indoocr.id",
      },
    },
  },

  // 4. Jenis: Catatan Rahasia & Komunitas VIP (privateNote)
  {
    id: "app_vibecoder_vip",
    slug: "vibecoder-vip",
    name: "VibeCoder VIP Community & Mastermind",
    targetPrice: 75000,
    pricingType: "one_time",
    headline: "VibeCoder VIP Inner Circle & Mastermind",
    subheadline: "Akses eksklusif komunitas builder, weekly office hours, & resource hub.",
    description:
      "Lingkaran dalam bagi para founder software indie dan vibe coder: review arsitektur aplikasi, strategi monetisasi, dan networking proyek.",
    mediaUrl:
      "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=800&q=80",
    ctaText: "Gabung Komunitas VIP",
    valueProps: [
      "Tautan undangan rahasia ke grup Telegram VIP Lounge",
      "Akses penuh ke Notion Resource Hub & database boilerplate",
      "Sesi konsultasi Weekly Office Hours setiap Kamis malam",
    ],
    deliveryConfig: {
      privateNote: {
        enabled: true,
        title: "Undangan Komunitas VIP & Panduan Akses Inner Circle",
        note:
          "Selamat bergabung di VibeCoder VIP Inner Circle!\n\n" +
          "1. Tautan Telegram Lounge: https://t.me/+VibeCoderVIPPrivateLounge\n" +
          "2. Notion Resource Hub: https://notion.so/tertaut-vibecoder-inner-circle\n" +
          "3. Jadwal Weekly Office Hours: Setiap Kamis pukul 20:00 WIB via Google Meet.\n\n" +
          "Harap simpan catatan rahasia ini dan jangan bagikan tautan kepada publik.",
      },
    },
  },

  // 5. Jenis: Metered / Usage-Based Pricing (meteringConfig)
  {
    id: "app_smartai_proxy",
    slug: "smartai-proxy",
    name: "SmartAI Gateway (Pay-As-You-Go)",
    targetPrice: 25000,
    pricingType: "one_time",
    headline: "SmartAI High-Performance LLM Proxy Gateway",
    subheadline: "Unified AI proxy dengan penagihan fleksibel berbasis pemakaian token riil.",
    description:
      "Gerbang proxy terpadu kompatibel OpenAI untuk Gemini 2.0 Flash dan Claude 3.5 Sonnet. Bayar hanya sebesar token yang Anda konsumsi.",
    mediaUrl:
      "https://images.unsplash.com/photo-1620712943543-bcc4688e7485?auto=format&fit=crop&w=800&q=80",
    ctaText: "Beli Kuota Awal",
    valueProps: [
      "Deposit kuota awal Rp 25.000 (Bonus 50.000 token gratis)",
      "Tarif transparan Rp 150 per 10.000 token LLM",
      "Dashboard audit log latensi & pemakaian token real-time",
    ],
    meteringConfig: {
      enabled: true,
      template: "llm_tokens",
      name: "Token AI Gemini 2.0 Flash",
      aggregation: "sum(tokens) on ai_usage",
      metricUnit: "tokens",
      unitLabel: "10K Token",
      unitPrice: 150,
      freeAllowance: 50000,
    },
    deliveryConfig: {
      apiAccess: {
        enabled: true,
        endpointUrl: "https://proxy.tertaut.com/v1/chat/completions",
        scope: "models:gemini-flash models:claude-3-5",
        instruction:
          "Ganti baseURL SDK OpenAI Anda ke `https://proxy.tertaut.com/v1` dan gunakan API key Anda pada header Authorization.",
      },
    },
  },
];

/**
 * Memastikan 5 demo produk standar tersedia di lingkungan development/sandbox:
 * Otomatis dilewati saat production (config.isProd).
 */
export async function ensureDemoData(): Promise<void> {
  if (config.isProd) {
    console.warn("[Demo] ensureDemoData dilewati di production.");
    return;
  }

  try {
    const adminEmail = config.admin.email;

    // 1. Pastikan Akun Super Admin
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
        console.log(`✅ [Demo] Akun Super Admin (${adminEmail}) berhasil dibuat.`);
      } catch (err: any) {
        console.warn("[Demo] Gagal membuat akun admin otomatis:", err?.message || err);
      }
    }

    if (adminUser && (adminUser.role !== "admin" || !adminUser.emailVerified)) {
      await db
        .update(user)
        .set({ role: "admin", emailVerified: true })
        .where(eq(user.id, adminUser.id));
    }

    if (!adminUser) {
      console.warn(`[Demo] Tidak dapat memuat akun Super Admin (${adminEmail}).`);
      return;
    }

    // 2. Pastikan Profil Primary Builder
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
          secretApiKey: `tt_secret_${randomBytes(24).toString("hex")}`,
          disbursementAccount: {
            bankCode: "BCA",
            accountNumber: "8830192847",
            accountHolderName: adminUser.name || "Ahmad Rizky",
          },
        })
        .returning();
      primaryBuilder = newB;
      console.log(`✅ [Demo] Primary Builder (${primaryBuilder.name}) berhasil disiapkan.`);
    }

    if (!primaryBuilder) {
      console.warn("[Demo] Gagal memastikan primary builder.");
      return;
    }

    // 3. Pastikan 5 Aplikasi Demo (1 untuk masing-masing jenis produk)
    for (const spec of DEMO_APPS) {
      const existing = await db.query.apps.findFirst({
        where: eq(apps.slug, spec.slug),
      });

      if (!existing) {
        await db.insert(apps).values({
          id: spec.id,
          builderId: primaryBuilder.id,
          apiKey: `tt_test_${randomBytes(16).toString("hex")}`,
          name: spec.name,
          slug: spec.slug,
          mode: "sandbox",
          targetPrice: spec.targetPrice,
          pricingType: spec.pricingType,
          billingPeriod: spec.billingPeriod,
          description: spec.description,
          headline: spec.headline,
          subheadline: spec.subheadline,
          mediaUrl: spec.mediaUrl,
          valueProps: spec.valueProps,
          ctaText: spec.ctaText,
          deliveryConfig: spec.deliveryConfig,
          meteringConfig: spec.meteringConfig,
        });
        console.log(`✅ [Demo] Aplikasi demo (${spec.slug}) berhasil disiapkan.`);
      } else if (existing.mode !== "sandbox") {
        await db.update(apps).set({ mode: "sandbox" }).where(eq(apps.id, existing.id));
      }
    }

    // 4. Pastikan 1 Kupon Diskon Demo (LAUNCH2026 - Diskon 20%)
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
      console.log("✅ [Demo] 1 Kupon demo LAUNCH2026 (20%) berhasil disiapkan.");
    }
  } catch (error: any) {
    console.warn("[Demo] Gagal inisialisasi demo data:", error?.message || error);
  }
}
