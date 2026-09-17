import { db } from "./index";
import {
  builders,
  apps,
  transactions,
  licenses,
  licenseActivations,
  aiVaultCredentials,
  aiProxyLogs,
} from "./schema";
import { user } from "./schema/auth";
import { auth } from "../auth";
import { eq } from "drizzle-orm";
import { CryptoService } from "../services/crypto";
import { LicenseService } from "../services/license";
import { XenditService } from "../services/xendit";
import { randomBytes } from "crypto";

export async function seed() {
  console.log("🌱 Mulai seeding database PostgreSQL tertautv2...");

  // 1. Pastikan akun Super Admin default tersedia
  try {
    const existingAdmin = await db.select().from(user).where(eq(user.email, "admin@tertaut.com"));
    if (existingAdmin.length === 0) {
      await auth.api.signUpEmail({
        body: {
          email: "admin@tertaut.com",
          password: "AdminPassword123!",
          name: "Super Admin",
        },
      });
    }
    await db.update(user).set({ role: "admin" }).where(eq(user.email, "admin@tertaut.com"));
    console.log("✅ Super Admin terverifikasi: admin@tertaut.com (role: admin)");
  } catch (err: any) {
    console.warn("⚠️ Info Super Admin:", err?.message);
  }

  // 2. Bersihkan data lama jika ada (urutan child ke parent)
  await db.delete(licenseActivations);
  await db.delete(aiProxyLogs);
  await db.delete(aiVaultCredentials);
  await db.delete(licenses);
  await db.delete(transactions);
  await db.delete(apps);
  await db.delete(builders);

  console.log("🧹 Database bersih. Memasukkan data awal...");

  // 2. Seed Builder
  const [builder] = await db
    .insert(builders)
    .values({
      name: "Ahmad Rizky (Solo Founder)",
      email: "ahmad.builder@tertaut.com",
      apiKey: `tt_live_${randomBytes(16).toString("hex")}`,
      disbursementAccount: {
        bankCode: "BCA",
        accountNumber: "8830192847",
        accountHolderName: "Ahmad Rizky",
      },
    })
    .returning();

  console.log(`✅ Builder tersimpan: ${builder.name} (${builder.email})`);

  // 3. Seed 3 Aplikasi Riil (Kategori Vibe Coding)
  const appData = [
    {
      id: "app_fastmail_ai",
      builderId: builder.id,
      name: "FastMail AI Summarizer",
      slug: "fastmail-ai",
      mode: "live" as const,
      targetPrice: 49000,
      description: "Ekstensi Chrome untuk merangkum email penting secara otomatis menggunakan Gemini AI.",
      headline: "Ringkas Email Kerja Panjang dalam 3 Detik",
      subheadline: "Hemat hingga 2 jam setiap pagi tanpa perlu membaca email berbelit-belit.",
      mediaUrl: "https://images.unsplash.com/photo-1557804506-669a67965ba0?auto=format&fit=crop&w=800&q=80",
      valueProps: [
        "Rangkuman 3 poin inti otomatis di inbox Gmail & Outlook",
        "Deteksi aksi dan deadline penting seketika",
        "Privasi terjamin: Zero-data training & enkripsi lokal",
        "Hemat waktu 10+ jam per minggu untuk tim sibuk",
      ],
      ctaText: "Beli Akses Early Bird - Rp 49.000",
      customIntentMessage: "Aplikasi sedang tahap finalisasi rilis. Amankan diskon 50% dan jadilah yang pertama mencoba!",
      redirectUrl: "https://situsbisnis.com/@ahmad/fastmail-success",
    },
    {
      id: "app_devdocs_pro",
      builderId: builder.id,
      name: "DevDocs Desktop Pro",
      slug: "devdocs-desktop",
      mode: "live" as const,
      targetPrice: 149000,
      description: "Aplikasi desktop offline-first untuk dokumentasi framework dengan pencarian instan dan lisensi seumur hidup.",
      headline: "Dokumentasi Developer Offline Tanpa Lag",
      subheadline: "Cari API docs 100+ bahasa pemrograman secara instan tanpa koneksi internet.",
      mediaUrl: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=800&q=80",
      valueProps: [
        "Akses offline ke 100+ API docs populer (Rust, Go, Vue, Python)",
        "Pencarian instan sub-10ms berbasis Rust/Tauri engine",
        "Lisensi seumur hidup (Lifetime) tanpa biaya langganan bulanan",
      ],
      ctaText: "Beli Lisensi Pro - Rp 149.000",
      customIntentMessage: "Aktivasi instan otomatis begitu pembayaran berhasil diverifikasi.",
      redirectUrl: "https://situsbisnis.com/@ahmad/devdocs-success",
    },
    {
      id: "app_autoreels_ai",
      builderId: builder.id,
      name: "AutoReels Video Maker",
      slug: "autoreels-ai",
      mode: "live" as const,
      targetPrice: 299000,
      description: "Automasi pembuatan video TikTok & IG Reels bertenaga AI untuk digital marketer dan konten kreator.",
      headline: "Bikin 30 Video TikTok & Reels dalam 5 Menit",
      subheadline: "Generate script, voiceover natural, dan dynamic caption otomatis dengan satu klik.",
      mediaUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80",
      valueProps: [
        "Generator script viral berbasis AI niche target",
        "Voiceover Bahasa Indonesia natural bersuara jernih",
        "Auto-caption warna-warni dinamis ala kreator top",
      ],
      ctaText: "Beli Lisensi Kreator - Rp 299.000",
      customIntentMessage: "Aktivasi instan dan dapatkan bonus 50 template video premium.",
      redirectUrl: "https://situsbisnis.com/@ahmad/autoreels-success",
    },
  ];

  const seededApps = await db.insert(apps).values(appData).returning();
  console.log(`✅ ${seededApps.length} Aplikasi berhasil di-seed:`, seededApps.map((a) => a.name));

  // 4. Seed Transaksi Riil dengan Kalkulasi MoR 5% Platform Fee & 95% Net Disbursement
  const txSeeds = [
    {
      id: "tx_89a1c23f",
      appId: "app_devdocs_pro",
      builderId: builder.id,
      xenditInvoiceId: "inv_devdocs_001",
      xenditExternalId: "tt_devdocs_17180011",
      customerEmail: "budi.santoso@startup.id",
      ...XenditService.calculateMorBreakdown(149000),
      paymentChannel: "QRIS",
      paymentStatus: "PAID" as const,
      disbursementStatus: "COMPLETED" as const,
      disbursementId: "disb_xnd_8829104",
      grantDays: 365,
      paidAt: new Date(Date.now() - 2 * 86400 * 1000),
      createdAt: new Date(Date.now() - 2 * 86400 * 1000),
    },
    {
      id: "tx_45b3e71a",
      appId: "app_autoreels_ai",
      builderId: builder.id,
      xenditInvoiceId: "inv_reels_002",
      xenditExternalId: "tt_reels_17180022",
      customerEmail: "siti.rahmawati@creator.co",
      ...XenditService.calculateMorBreakdown(299000),
      paymentChannel: "BCA_VA",
      paymentStatus: "PAID" as const,
      disbursementStatus: "COMPLETED" as const,
      disbursementId: "disb_xnd_8829105",
      grantDays: 30,
      paidAt: new Date(Date.now() - 1 * 86400 * 1000),
      createdAt: new Date(Date.now() - 1 * 86400 * 1000),
    },
    {
      id: "tx_12f9d84c",
      appId: "app_devdocs_pro",
      builderId: builder.id,
      xenditInvoiceId: "inv_devdocs_003",
      xenditExternalId: "tt_devdocs_17180033",
      customerEmail: "dendy.irawan@agency.net",
      ...XenditService.calculateMorBreakdown(149000),
      paymentChannel: "GOPAY",
      paymentStatus: "PAID" as const,
      disbursementStatus: "PENDING" as const, // Menunggu builder klik tombol cairkan
      grantDays: 365,
      paidAt: new Date(Date.now() - 3 * 3600 * 1000),
      createdAt: new Date(Date.now() - 4 * 3600 * 1000),
    },
    {
      id: "tx_77e2a90b",
      appId: "app_autoreels_ai",
      builderId: builder.id,
      xenditInvoiceId: "inv_reels_004",
      xenditExternalId: "tt_reels_17180044",
      customerEmail: "kevin.chandra@corp.com",
      ...XenditService.calculateMorBreakdown(299000),
      paymentChannel: "MANDIRI_VA",
      paymentStatus: "PENDING" as const,
      disbursementStatus: "PENDING" as const,
      grantDays: 30,
      createdAt: new Date(Date.now() - 30 * 60 * 1000),
    },
  ];

  await db.insert(transactions).values(txSeeds);
  console.log(`✅ ${txSeeds.length} Transaksi riil tersimpan.`);

  // 5. Seed Kunci Lisensi Riil
  const licenseSeeds = [
    {
      id: "lic_devdocs_01",
      appId: "app_devdocs_pro",
      transactionId: "tx_89a1c23f",
      licenseKey: "TT-DEVD-9921-X8WQ",
      customerEmail: "budi.santoso@startup.id",
      hardwareId: LicenseService.hashHardwareId("CPU_INTEL_i9_13900K_SN_88219"),
      platform: "desktop" as const,
      status: "ACTIVE" as const,
      expiresAt: new Date(Date.now() + 363 * 86400 * 1000),
      offlineJwtGraceToken: LicenseService.createOfflineGraceToken("TT-DEVD-9921-X8WQ", "app_devdocs_pro", LicenseService.hashHardwareId("CPU_INTEL_i9_13900K_SN_88219")),
      lastValidatedAt: new Date(),
    },
    {
      id: "lic_reels_02",
      appId: "app_autoreels_ai",
      transactionId: "tx_45b3e71a",
      licenseKey: "TT-REEL-7734-P4KM",
      customerEmail: "siti.rahmawati@creator.co",
      hardwareId: LicenseService.hashHardwareId("APPLE_M3_MAX_SERIAL_C02G"),
      platform: "desktop" as const,
      status: "ACTIVE" as const,
      expiresAt: new Date(Date.now() + 29 * 86400 * 1000),
      offlineJwtGraceToken: LicenseService.createOfflineGraceToken("TT-REEL-7734-P4KM", "app_autoreels_ai", LicenseService.hashHardwareId("APPLE_M3_MAX_SERIAL_C02G")),
      lastValidatedAt: new Date(),
    },
    {
      id: "lic_devdocs_03",
      appId: "app_devdocs_pro",
      transactionId: "tx_12f9d84c",
      licenseKey: "TT-DEVD-3341-M9LQ",
      customerEmail: "dendy.irawan@agency.net",
      hardwareId: null, // Belum terikat hardware (pengguna baru beli)
      platform: "desktop" as const,
      status: "ACTIVE" as const,
      expiresAt: new Date(Date.now() + 365 * 86400 * 1000),
    },
    {
      id: "lic_fastmail_04",
      appId: "app_fastmail_ai",
      licenseKey: "TT-FAST-8812-C7NV",
      customerEmail: "early.adopter@gmail.com",
      platform: "chrome_extension" as const,
      status: "ACTIVE" as const,
      expiresAt: new Date(Date.now() + 180 * 86400 * 1000),
    },
    {
      id: "lic_revoked_05",
      appId: "app_devdocs_pro",
      licenseKey: "TT-DEVD-0000-VOID",
      customerEmail: "pirate.violator@blackhat.xyz",
      hardwareId: LicenseService.hashHardwareId("VMWARE_VIRTUAL_MACHINE_001"),
      platform: "desktop" as const,
      status: "REVOKED" as const,
      expiresAt: new Date(Date.now() + 300 * 86400 * 1000),
    },
  ];

  await db.insert(licenses).values(licenseSeeds);
  console.log(`✅ ${licenseSeeds.length} Kunci Lisensi riil tersimpan.`);

  // 5B. Seed Aktivasi Perangkat (Device Seats) Riil
  const activationSeeds = [
    {
      id: "act_devdocs_01",
      licenseId: "lic_devdocs_01",
      hwidHash: LicenseService.hashHardwareId("CPU_INTEL_i9_13900K_SN_88219"),
      deviceName: "Budi's MacBook Pro M3",
      ipAddress: "103.28.12.90",
      lastValidatedAt: new Date(),
    },
    {
      id: "act_reels_02",
      licenseId: "lic_reels_02",
      hwidHash: LicenseService.hashHardwareId("APPLE_M3_MAX_SERIAL_C02G"),
      deviceName: "Siti's Mac Studio Workstation",
      ipAddress: "182.253.44.12",
      lastValidatedAt: new Date(),
    },
  ];

  await db.insert(licenseActivations).values(activationSeeds);
  console.log(`✅ ${activationSeeds.length} Aktivasi Device Seats riil tersimpan.`);

  // 6. Seed AI Vault Credentials (AES-256-GCM Encrypted) & Historical Logs
  const geminiEncrypted = CryptoService.encrypt("AIzaSyB3-SAMPLE-REALISTIC-KEY-FOR-VAULT-TESTING");
  const openaiEncrypted = CryptoService.encrypt("sk-proj-sample-encrypted-key-secure-vault-12345");

  await db.insert(aiVaultCredentials).values([
    {
      appId: "app_fastmail_ai",
      provider: "gemini",
      encryptedApiKey: geminiEncrypted.cipherText,
      iv: geminiEncrypted.iv,
      authTag: geminiEncrypted.authTag,
      monthlyBudgetLimit: 500000,
      currentMonthlyUsage: 48500,
      isKillSwitchActive: false,
    },
    {
      appId: "app_autoreels_ai",
      provider: "openai",
      encryptedApiKey: openaiEncrypted.cipherText,
      iv: openaiEncrypted.iv,
      authTag: openaiEncrypted.authTag,
      monthlyBudgetLimit: 1000000,
      currentMonthlyUsage: 182000,
      isKillSwitchActive: false,
    },
  ]);

  // Seed AI Proxy Logs
  await db.insert(aiProxyLogs).values([
    {
      appId: "app_fastmail_ai",
      licenseKey: "TT-FAST-8812-C7NV",
      provider: "gemini",
      model: "gemini-1.5-flash",
      promptTokens: 340,
      completionTokens: 120,
      totalTokens: 460,
      latencyMs: 38,
      createdAt: new Date(Date.now() - 35 * 60 * 1000),
    },
    {
      appId: "app_autoreels_ai",
      licenseKey: "TT-REEL-7734-P4KM",
      provider: "openai",
      model: "gpt-4o-mini",
      promptTokens: 520,
      completionTokens: 280,
      totalTokens: 800,
      latencyMs: 44,
      createdAt: new Date(Date.now() - 15 * 60 * 1000),
    },
  ]);

  console.log("✅ Kredensial AI Vault & Proxy Audit Logs berhasil di-seed.");
  console.log("🎉 Seeding database Postgres selesai 100%!");
}

// Jalankan jika dieksekusi langsung
if (import.meta.main) {
  seed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("❌ Gagal seeding database:", err);
      process.exit(1);
    });
}
