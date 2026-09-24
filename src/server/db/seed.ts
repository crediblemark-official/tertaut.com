import { db } from "./index";
import {
  builders,
  apps,
  transactions,
  licenses,
  licenseActivations,
  licenseLeases,
  licenseEvents,
  webhookEndpoints,
  webhookDeliveries,
  revokedTokens,
  creditLedger,
  coupons,
  aiVaultCredentials,
  aiProxyLogs,
  aiProviderKeys,
  aiAppConfigs,
  aiUsageLogs,
} from "./schema";
import { user } from "./schema/auth";
import { auth } from "../auth";
import { eq } from "drizzle-orm";
import { CryptoService } from "../services/crypto";
import { LicenseService } from "../services/license";
import { DanaService } from "../services/dana";
import { randomBytes } from "crypto";
import { generateAppApiKey, generateBuilderSecretApiKey } from "../routes/apps/api-key";
import type { DeliveryConfig } from "../db/schema/apps";
import { config } from "../config";

/**
 * Satu-satunya akun default: milik pemilik platform.
 * - DB baru / fresh install: akun dibuat dengan password dari .env (atau random bila kosong).
 * - DB yang sudah memiliki akun ini: password TIDAK direset (tetap milik pemilik),
 *   hanya role dinaikkan ke "admin" + emailVerified:true.
 */
const ADMIN_CREDENTIALS = {
  name: "Platform Tertaut",
  email: (
    config.admin.email ||
    process.env.ADMIN_EMAIL ||
    "platformtertaut@gmail.com"
  ).toLowerCase(),
  password:
    config.admin.password ||
    (config.isTest ? "TestAdminPass123!" : `Sec_${randomBytes(16).toString("hex")}!Aa1`),
};

// Email akun default dari versi seed lama — dihapus agar tidak ada akun
// admin/builder sisa yang tidak diinginkan setelah migrasi default account.
const LEGACY_DEFAULT_EMAILS = ["admin@tertaut.com", "ahmad.builder@tertaut.com"];

const APPS = [
  {
    id: "app_fastmail_ai",
    name: "FastMail AI Summarizer",
    slug: "fastmail-ai",
    mode: "sandbox" as const,
    targetPrice: 49000,
    platform: "chrome_extension" as const,
    description:
      "Ekstensi Chrome untuk merangkum email penting secara otomatis menggunakan Gemini AI.",
    mediaUrl:
      "https://images.unsplash.com/photo-1557804506-669a67965ba0?auto=format&fit=crop&w=800&q=80",
    floating: false,
  },
  {
    id: "app_devdocs_pro",
    name: "DevDocs Desktop Pro",
    slug: "devdocs-desktop",
    mode: "live" as const,
    targetPrice: 149000,
    platform: "desktop" as const,
    description:
      "Aplikasi desktop offline-first untuk dokumentasi framework dengan pencarian instan dan lisensi seumur hidup.",
    mediaUrl:
      "https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=800&q=80",
    floating: true,
  },
  {
    id: "app_autoreels_ai",
    name: "AutoReels Video Maker",
    slug: "autoreels-ai",
    mode: "live" as const,
    targetPrice: 299000,
    platform: "general" as const,
    description:
      "Automasi pembuatan video TikTok & IG Reels bertenaga AI untuk digital marketer dan konten kreator.",
    mediaUrl:
      "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80",
    floating: false,
  },
];

const TXS = [
  {
    id: "tx_89a1c23f",
    appId: "app_devdocs_pro",
    xenditExternalId: "tt_devdocs_17180011",
    xenditInvoiceId: "inv_devdocs_001",
    customerEmail: "budi.santoso@startup.id",
    amount: 149000,
    channel: "QRIS",
    status: "PAID" as const,
    disbursementStatus: "COMPLETED" as const,
    grantDays: 365,
    paidAt: new Date(Date.now() - 2 * 86400 * 1000),
  },
  {
    id: "tx_45b3e71a",
    appId: "app_autoreels_ai",
    xenditExternalId: "tt_reels_17180022",
    xenditInvoiceId: "inv_reels_002",
    customerEmail: "siti.rahmawati@creator.co",
    amount: 299000,
    channel: "BCA_VA",
    status: "PAID" as const,
    disbursementStatus: "COMPLETED" as const,
    grantDays: 30,
    paidAt: new Date(Date.now() - 1 * 86400 * 1000),
  },
  {
    id: "tx_12f9d84c",
    appId: "app_devdocs_pro",
    xenditExternalId: "tt_devdocs_17180033",
    xenditInvoiceId: "inv_devdocs_003",
    customerEmail: "dendy.irawan@agency.net",
    amount: 149000,
    channel: "GOPAY",
    status: "PAID" as const,
    disbursementStatus: "PENDING" as const,
    grantDays: 365,
    paidAt: new Date(Date.now() - 3 * 3600 * 1000),
  },
  {
    id: "tx_77e2a90b",
    appId: "app_autoreels_ai",
    xenditExternalId: "tt_reels_17180044",
    xenditInvoiceId: "inv_reels_004",
    customerEmail: "kevin.chandra@corp.com",
    amount: 299000,
    channel: "MANDIRI_VA",
    status: "PENDING" as const,
    disbursementStatus: "PENDING" as const,
    grantDays: 30,
    paidAt: new Date(Date.now() - 30 * 60 * 1000),
  },
];

const LICENSES = [
  {
    id: "lic_devdocs_01",
    appId: "app_devdocs_pro",
    txId: "tx_89a1c23f",
    key: "TT-DEVD-9921-X8WQ",
    email: "budi.santoso@startup.id",
    hwidRaw: "CPU_INTEL_i9_13900K_SN_88219",
    platform: "desktop" as const,
    status: "ACTIVE" as const,
    days: 363,
    floating: true,
  },
  {
    id: "lic_reels_02",
    appId: "app_autoreels_ai",
    txId: "tx_45b3e71a",
    key: "TT-REEL-7734-P4KM",
    email: "siti.rahmawati@creator.co",
    hwidRaw: "APPLE_M3_MAX_SERIAL_C02G",
    platform: "desktop" as const,
    status: "ACTIVE" as const,
    days: 29,
    floating: false,
  },
  {
    id: "lic_devdocs_03",
    appId: "app_devdocs_pro",
    txId: "tx_12f9d84c",
    key: "TT-DEVD-3341-M9LQ",
    email: "dendy.irawan@agency.net",
    hwidRaw: null,
    platform: "desktop" as const,
    status: "ACTIVE" as const,
    days: 365,
    floating: false,
  },
  {
    id: "lic_fastmail_04",
    appId: "app_fastmail_ai",
    txId: null,
    key: "TT-FAST-8812-C7NV",
    email: "early.adopter@gmail.com",
    hwidRaw: null,
    platform: "chrome_extension" as const,
    status: "ACTIVE" as const,
    days: 180,
    floating: false,
  },
  {
    id: "lic_revoked_05",
    appId: "app_devdocs_pro",
    txId: null,
    key: "TT-DEVD-0000-VOID",
    email: "pirate.violator@blackhat.xyz",
    hwidRaw: "VMWARE_VIRTUAL_MACHINE_001",
    platform: "desktop" as const,
    status: "REVOKED" as const,
    days: 300,
    floating: false,
  },
];

const ACTIVATIONS = [
  {
    licenseId: "lic_devdocs_01",
    hwidRaw: "CPU_INTEL_i9_13900K_SN_88219",
    device: "Budi's MacBook Pro M3",
    ip: "103.28.12.90",
  },
  {
    licenseId: "lic_reels_02",
    hwidRaw: "APPLE_M3_MAX_SERIAL_C02G",
    device: "Siti's Mac Studio Workstation",
    ip: "182.253.44.12",
  },
];

const AI_VAULT = [
  { appId: "app_fastmail_ai", provider: "gemini" as const, budget: 500000, usage: 48500 },
  { appId: "app_autoreels_ai", provider: "openai" as const, budget: 1000000, usage: 182000 },
];

const AI_LOGS = [
  {
    appId: "app_fastmail_ai",
    licenseKey: "TT-FAST-8812-C7NV",
    provider: "gemini" as const,
    model: "gemini-1.5-flash",
    prompt: 340,
    completion: 120,
    latency: 38,
    agoMin: 35,
  },
  {
    appId: "app_autoreels_ai",
    licenseKey: "TT-REEL-7734-P4KM",
    provider: "openai" as const,
    model: "gpt-4o-mini",
    prompt: 520,
    completion: 280,
    latency: 44,
    agoMin: 15,
  },
];

export async function seed() {
  console.log("🌱 Mulai seeding database PostgreSQL tertautv2...");

  // 1. Bersihkan seluruh data tabel dalam urutan aman Foreign Key (Child -> Parent)
  console.log("🧹 Mengosongkan data lama...");
  await db.delete(webhookDeliveries);
  await db.delete(webhookEndpoints);
  await db.delete(licenseEvents);
  await db.delete(licenseLeases);
  await db.delete(revokedTokens);
  await db.delete(licenseActivations);
  await db.delete(creditLedger);
  await db.delete(aiUsageLogs);
  await db.delete(aiAppConfigs);
  await db.delete(aiProviderKeys);
  await db.delete(aiProxyLogs);
  await db.delete(aiVaultCredentials);
  await db.delete(coupons);
  await db.delete(licenses);
  await db.delete(transactions);
  await db.delete(apps);
  await db.delete(builders);

  // 2. Setup Super Admin — SATU-SATUNYA akun default
  // Hapus akun default lama (bila ada) agar tidak ada admin "hantu" yang tersisa.
  for (const legacyEmail of LEGACY_DEFAULT_EMAILS) {
    const [legacy] = await db.select().from(user).where(eq(user.email, legacyEmail));
    if (legacy) {
      await db.delete(user).where(eq(user.id, legacy.id));
      console.log(`🧹 Akun default lama dihapus: ${legacyEmail}`);
    }
  }

  let [adminUser] = await db.select().from(user).where(eq(user.email, ADMIN_CREDENTIALS.email));
  if (!adminUser) {
    await auth.api.signUpEmail({
      body: {
        email: ADMIN_CREDENTIALS.email,
        password: ADMIN_CREDENTIALS.password,
        name: ADMIN_CREDENTIALS.name,
      },
    });
    [adminUser] = await db.select().from(user).where(eq(user.email, ADMIN_CREDENTIALS.email));
  }
  // emailVerified: true + role admin — akun dibuat/dipromosikan langsung (bukan lewat
  // alur verifikasi email), sehingga selalu bisa login walau requireEmailVerification aktif.
  // CATATAN: password akun yang SUDAH ADA tidak pernah direset — tetap milik pemilik.
  await db
    .update(user)
    .set({ role: "admin", emailVerified: true })
    .where(eq(user.email, ADMIN_CREDENTIALS.email));
  console.log(`✅ Super Admin terverifikasi: ${ADMIN_CREDENTIALS.email} (role: admin)`);

  // 3. Profil Builder Utama (platformtertaut@gmail.com — dashboard langsung terisi)
  const [primaryBuilder] = await db
    .insert(builders)
    .values({
      userId: adminUser.id,
      name: "Tertaut Labs (Founder)",
      email: ADMIN_CREDENTIALS.email,
      apiKey: `tt_live_${randomBytes(16).toString("hex")}`,
      secretApiKey: generateBuilderSecretApiKey(),
      disbursementAccount: {
        bankCode: "BCA",
        accountNumber: "8830192847",
        accountHolderName: ADMIN_CREDENTIALS.name,
      },
    })
    .returning();
  console.log(`✅ Primary Builder: ${primaryBuilder.name} (${primaryBuilder.email})`);

  // 4. Aplikasi Unggulan (Flagship Showcase Apps)
  const seededApps = await db
    .insert(apps)
    .values(
      APPS.map((a) => ({
        id: a.id,
        builderId: primaryBuilder.id,
        apiKey: generateAppApiKey("live"),
        name: a.name,
        slug: a.slug,
        mode: a.mode,
        targetPrice: a.targetPrice,
        description: a.description,
        headline: a.name,
        subheadline: a.description.slice(0, 80),
        mediaUrl: a.mediaUrl,
        deliveryConfig:
          a.platform === "desktop"
            ? ({
                licenseKey: {
                  enabled: true,
                  description: "Lisensi Universal Tertaut",
                  expiresInDays: 365,
                  maxSeats: 3,
                  offlineGraceDays: 30,
                  floating: {
                    enabled: a.floating,
                    leaseTtlSeconds: 300,
                    heartbeatIntervalSeconds: 60,
                  },
                },
              } as DeliveryConfig)
            : a.platform === "chrome_extension"
              ? ({
                  licenseKey: {
                    enabled: true,
                    description: "Lisensi Universal Tertaut",
                    expiresInDays: 180,
                    maxSeats: 1,
                    offlineGraceDays: 7,
                  },
                } as DeliveryConfig)
              : ({
                  licenseKey: {
                    enabled: true,
                    description: "Lisensi Universal Tertaut",
                    expiresInDays: 30,
                    maxSeats: 1,
                  },
                } as DeliveryConfig),
      }))
    )
    .returning();
  console.log(
    `✅ ${seededApps.length} Aplikasi tersimpan:`,
    seededApps.map((a) => a.name)
  );

  // 5. Kupon Diskon (Coupons)
  const seededCoupons = await db
    .insert(coupons)
    .values([
      {
        id: "cpn_devdocs_50",
        code: "DISCOUNT50",
        appId: "app_devdocs_pro",
        discountPercent: 50,
        maxRedemptions: 100,
        redemptionCount: 12,
        isActive: true,
      },
      {
        id: "cpn_global_launch",
        code: "LAUNCH2026",
        appId: null, // Berlaku untuk semua aplikasi
        discountPercent: 20,
        maxRedemptions: 500,
        redemptionCount: 45,
        isActive: true,
      },
      {
        id: "cpn_fastmail_early",
        code: "EARLYBIRD",
        appId: "app_fastmail_ai",
        discountPercent: 30,
        maxRedemptions: 50,
        redemptionCount: 50,
        isActive: false, // Kupon sudah habis kuota
      },
    ])
    .returning();
  console.log(
    `✅ ${seededCoupons.length} Kupon diskon tersimpan:`,
    seededCoupons.map((c) => c.code)
  );

  // 6. Transaksi DANA
  await db.insert(transactions).values(
    TXS.map((t) => ({
      id: t.id,
      appId: t.appId,
      builderId: primaryBuilder.id,
      xenditExternalId: t.xenditExternalId,
      xenditInvoiceId: t.xenditInvoiceId,
      customerEmail: t.customerEmail,
      amount: t.amount,
      paymentProvider: "dana",
      providerReferenceId: `dana_inv_${t.id.slice(3)}`,
      paymentChannel: t.channel,
      paymentStatus: t.status,
      disbursementStatus: t.disbursementStatus,
      disbursementId: t.status === "PAID" ? `disb_dana_${t.id.slice(3)}` : null,
      mockOrder: false,
      grantDays: t.grantDays,
      ...DanaService.calculateMorBreakdown(t.amount),
      paidAt: t.paidAt,
      createdAt: t.paidAt,
    }))
  );
  console.log(`✅ ${TXS.length} Transaksi tersimpan.`);

  // 7. Lisensi Software & Ekstensi
  const licenseRows = await db
    .insert(licenses)
    .values(
      LICENSES.map((l) => ({
        id: l.id,
        appId: l.appId,
        transactionId: l.txId,
        licenseKey: l.key,
        customerEmail: l.email,
        hardwareId: l.hwidRaw ? LicenseService.hashHardwareId(l.hwidRaw) : null,
        platform: l.platform,
        status: l.status,
        licenseVersion: 2,
        maxSeats: l.floating ? 5 : 3,
        features: l.floating ? { floating: true } : {},
        expiresAt: new Date(Date.now() + l.days * 86400 * 1000),
        offlineJwtGraceToken: LicenseService.createOfflineGraceToken(
          l.key,
          l.appId,
          l.hwidRaw ? LicenseService.hashHardwareId(l.hwidRaw) : null,
          l.email
        ),
        lastValidatedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      }))
    )
    .returning();
  console.log(`✅ ${licenseRows.length} Lisensi tersimpan.`);

  // 8. Aktivasi Perangkat & Floating Leases
  const licMap = Object.fromEntries(licenseRows.map((l) => [l.id, l]));
  for (const a of ACTIVATIONS) {
    const lic = licMap[a.licenseId];
    if (!lic) continue;
    const hwidHash = LicenseService.hashHardwareId(a.hwidRaw!);
    await db.insert(licenseActivations).values({
      id: `act_${a.licenseId.split("_")[1]}`,
      licenseId: lic.id,
      hwidHash,
      deviceName: a.device,
      ipAddress: a.ip,
      lastValidatedAt: new Date(),
      createdAt: new Date(),
    });

    if (lic.features?.floating) {
      const leaseKey = `lk_${randomBytes(6).toString("hex")}`;
      await db.insert(licenseLeases).values({
        id: `lse_${a.licenseId.split("_")[1]}`,
        licenseId: lic.id,
        hwidHash,
        deviceName: a.device,
        leaseKey,
        ipAddress: a.ip,
        lastHeartbeatAt: new Date(),
        expiresAt: new Date(Date.now() + 300 * 1000),
        createdAt: new Date(),
      });
    }
  }
  console.log(`✅ Aktivasi perangkat & Floating Lease tersimpan.`);

  // 9. Blacklist JTI untuk Lisensi yang Direvoke (lic_revoked_05)
  const revokedLic = licenseRows.find((l) => l.id === "lic_revoked_05");
  if (revokedLic) {
    const token = LicenseService.createOfflineGraceToken(revokedLic.licenseKey, revokedLic.appId);
    const jti = token.split(".")[1] || "jti_revoked_demo";
    await db.insert(revokedTokens).values({
      jti,
      licenseId: revokedLic.id,
      licenseKey: revokedLic.licenseKey,
      reason: "REVOKED",
      revokedAt: new Date(),
      expiresAt: revokedLic.expiresAt,
    });
  }

  // 10. Ledger Kredit (Credits Ledger)
  await db.insert(creditLedger).values([
    {
      id: "crl_devdocs_grant_01",
      licenseId: "lic_devdocs_01",
      appId: "app_devdocs_pro",
      customerEmail: "budi.santoso@startup.id",
      type: "GRANT",
      delta: 1000,
      balanceAfter: 1000,
      reference: "tx_89a1c23f",
      description: "Bonus kredit awal lisensi DevDocs Pro",
      createdAt: new Date(Date.now() - 86400 * 1000),
    },
    {
      id: "crl_devdocs_debit_01",
      licenseId: "lic_devdocs_01",
      appId: "app_devdocs_pro",
      customerEmail: "budi.santoso@startup.id",
      type: "DEBIT",
      delta: -50,
      balanceAfter: 950,
      reference: "idx_query_sync_001",
      description: "DevDocs AI Framework Indexing",
      createdAt: new Date(Date.now() - 3600 * 1000),
    },
    {
      id: "crl_fastmail_grant_01",
      licenseId: "lic_fastmail_04",
      appId: "app_fastmail_ai",
      customerEmail: "early.adopter@gmail.com",
      type: "GRANT",
      delta: 500,
      balanceAfter: 500,
      reference: "early_signup_promo",
      description: "Alokasi awal perangkum email FastMail AI",
      createdAt: new Date(),
    },
  ]);
  console.log(`✅ Riwayat saldo credit ledger tersimpan.`);

  // 11. Webhook Endpoints & Deliveries (isActive: false agar outbox tidak melakukan retry loop ke domain dummy)
  const whEndpoints = await db
    .insert(webhookEndpoints)
    .values([
      {
        id: "whk_dashboard_demo",
        builderId: primaryBuilder.id,
        url: "https://api.tertaut.dev/webhook/demo",
        secret: "whsec_demo_" + randomBytes(8).toString("hex"),
        events: ["license.issued", "license.activated", "license.revoked", "license.expired"],
        isActive: false, // Tidak aktif secara default demi mencegah error DNS di background worker
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "whk_audit_slack",
        builderId: primaryBuilder.id,
        url: "https://hooks.slack.com/services/DEMO/AUDIT",
        secret: "whsec_audit_" + randomBytes(8).toString("hex"),
        events: [],
        isActive: false,
        createdAt: new Date(Date.now() - 86400000),
        updatedAt: new Date(Date.now() - 86400000),
      },
    ])
    .returning();

  await db.insert(webhookDeliveries).values([
    {
      id: "whd_demo_001",
      endpointId: whEndpoints[0].id,
      event: "license.issued",
      payload: {
        event: "license.issued",
        data: { licenseKey: "TT-DEVD-9921-X8WQ", customerEmail: "budi.santoso@startup.id" },
      },
      signature: "whsec_sig_demo_001",
      status: "SENT",
      attempts: 1,
      lastAttemptAt: new Date(),
      nextRetryAt: new Date(),
      createdAt: new Date(Date.now() - 3600000),
      updatedAt: new Date(),
    },
    {
      id: "whd_demo_002",
      endpointId: whEndpoints[0].id,
      event: "license.revoked",
      payload: {
        event: "license.revoked",
        data: { licenseKey: "TT-DEVD-0000-VOID", customerEmail: "pirate.violator@blackhat.xyz" },
      },
      signature: "whsec_sig_demo_002",
      status: "FAILED",
      attempts: 5,
      lastAttemptAt: new Date(),
      nextRetryAt: new Date(Date.now() - 300000),
      createdAt: new Date(Date.now() - 7200000),
      updatedAt: new Date(),
    },
    {
      id: "whd_demo_003",
      endpointId: whEndpoints[0].id,
      event: "license.activated",
      payload: {
        event: "license.activated",
        data: { licenseKey: "TT-REEL-7734-P4KM", customerEmail: "siti.rahmawati@creator.co" },
      },
      signature: "whsec_sig_demo_003",
      status: "SENT",
      attempts: 1,
      lastAttemptAt: new Date(),
      nextRetryAt: new Date(),
      createdAt: new Date(Date.now() - 1800000),
      updatedAt: new Date(),
    },
  ]);
  console.log(`✅ Webhook endpoints & riwayat outbox delivery tersimpan.`);

  // 12. License Events (Audit Log Trail)
  const evRows = await db
    .insert(licenseEvents)
    .values([
      {
        id: "evt_issued_01",
        licenseId: licenseRows[0].id,
        licenseKey: "TT-DEVD-9921-X8WQ",
        appId: "app_devdocs_pro",
        event: "license.issued",
        actorType: "S2S" as const,
        actorId: primaryBuilder.id,
        payload: { maxSeats: 5, floating: true },
        ipAddress: "103.28.12.90",
        createdAt: new Date(Date.now() - 3 * 86400000),
      },
      {
        id: "evt_activated_01",
        licenseId: licenseRows[0].id,
        licenseKey: "TT-DEVD-9921-X8WQ",
        appId: "app_devdocs_pro",
        event: "license.activated",
        actorType: "CLIENT" as const,
        payload: {
          hwidHash: LicenseService.hashHardwareId("CPU_INTEL_i9_13900K_SN_88219"),
          deviceName: "Budi's MacBook Pro M3",
        },
        ipAddress: "103.28.12.90",
        createdAt: new Date(Date.now() - 2 * 86400000),
      },
      {
        id: "evt_heartbeat_01",
        licenseId: licenseRows[0].id,
        licenseKey: "TT-DEVD-9921-X8WQ",
        appId: "app_devdocs_pro",
        event: "license.activated",
        actorType: "CLIENT" as const,
        payload: { leaseKey: "lk_demo", heartbeat: true },
        ipAddress: "103.28.12.90",
        createdAt: new Date(Date.now() - 1 * 86400000),
      },
      {
        id: "evt_issued_02",
        licenseId: licenseRows[1].id,
        licenseKey: "TT-REEL-7734-P4KM",
        appId: "app_autoreels_ai",
        event: "license.issued",
        actorType: "S2S" as const,
        actorId: primaryBuilder.id,
        payload: { maxSeats: 3 },
        ipAddress: "182.253.44.12",
        createdAt: new Date(Date.now() - 2 * 86400000),
      },
      {
        id: "evt_revoked_01",
        licenseId: licenseRows[4].id,
        licenseKey: "TT-DEVD-0000-VOID",
        appId: "app_devdocs_pro",
        event: "license.revoked",
        actorType: "ADMIN" as const,
        actorId: primaryBuilder.id,
        payload: { reason: "Piracy detected" },
        ipAddress: "192.168.1.1",
        createdAt: new Date(Date.now() - 5 * 86400000),
      },
      {
        id: "evt_issued_03",
        licenseId: licenseRows[2].id,
        licenseKey: "TT-DEVD-3341-M9LQ",
        appId: "app_devdocs_pro",
        event: "license.issued",
        actorType: "S2S" as const,
        actorId: primaryBuilder.id,
        payload: { maxSeats: 3 },
        ipAddress: "10.0.0.5",
        createdAt: new Date(Date.now() - 1 * 86400000),
      },
      {
        id: "evt_issued_04",
        licenseId: licenseRows[3].id,
        licenseKey: "TT-FAST-8812-C7NV",
        appId: "app_fastmail_ai",
        event: "license.issued",
        actorType: "S2S" as const,
        actorId: primaryBuilder.id,
        payload: { maxSeats: 1 },
        ipAddress: "172.16.0.2",
        createdAt: new Date(Date.now() - 10 * 86400000),
      },
    ])
    .returning();
  console.log(`✅ ${evRows.length} Audit event tersimpan.`);

  // 13. AI Vault Credentials & Provider Keys
  const geminiEnc = CryptoService.encrypt("AIzaSyB3-SAMPLE-REALISTIC-KEY-FOR-VAULT-TESTING");
  const openaiEnc = CryptoService.encrypt("sk-proj-sample-encrypted-key-secure-vault-12345");

  const [geminiKey] = await db
    .insert(aiProviderKeys)
    .values({
      id: "key_gemini_prod",
      builderId: primaryBuilder.id,
      providerName: "GEMINI",
      keyName: "Google Gemini Production",
      encryptedApiKey: geminiEnc.cipherText,
      ivVector: geminiEnc.iv,
      authTag: geminiEnc.authTag,
      isActive: true,
    })
    .returning();

  const [openaiKey] = await db
    .insert(aiProviderKeys)
    .values({
      id: "key_openai_prod",
      builderId: primaryBuilder.id,
      providerName: "OPENAI",
      keyName: "OpenAI GPT-4o Key",
      encryptedApiKey: openaiEnc.cipherText,
      ivVector: openaiEnc.iv,
      authTag: openaiEnc.authTag,
      isActive: true,
    })
    .returning();

  await db.insert(aiAppConfigs).values([
    {
      id: "cfg_fastmail_summary",
      appId: "app_fastmail_ai",
      providerKeyId: geminiKey.id,
      modelAlias: "fastmail-summary",
      targetModelName: "gemini-1.5-flash",
      maxRequestsPerMin: 30,
      dailyTokenLimit: 250000,
      monthlyBudgetIdr: 500000,
    },
    {
      id: "cfg_autoreels_script",
      appId: "app_autoreels_ai",
      providerKeyId: openaiKey.id,
      modelAlias: "autoreels-generator",
      targetModelName: "gpt-4o-mini",
      maxRequestsPerMin: 20,
      dailyTokenLimit: 500000,
      monthlyBudgetIdr: 1000000,
    },
  ]);

  await db.insert(aiVaultCredentials).values(
    AI_VAULT.map((v) => {
      const enc = v.provider === "gemini" ? geminiEnc : openaiEnc;
      return {
        appId: v.appId,
        provider: v.provider,
        encryptedApiKey: enc.cipherText,
        iv: enc.iv,
        authTag: enc.authTag,
        monthlyBudgetLimit: v.budget,
        currentMonthlyUsage: v.usage,
        isKillSwitchActive: false,
      };
    })
  );

  await db.insert(aiProxyLogs).values(
    AI_LOGS.map((l) => ({
      appId: l.appId,
      licenseKey: l.licenseKey,
      provider: l.provider,
      model: l.model,
      promptTokens: l.prompt,
      completionTokens: l.completion,
      totalTokens: l.prompt + l.completion,
      latencyMs: l.latency,
      createdAt: new Date(Date.now() - l.agoMin * 60 * 1000),
    }))
  );

  await db.insert(aiUsageLogs).values([
    {
      id: "log_usage_fastmail_01",
      licenseId: "lic_fastmail_04",
      appId: "app_fastmail_ai",
      modelAlias: "fastmail-summary",
      promptTokens: 340,
      completionTokens: 120,
      totalTokens: 460,
      responseTimeMs: 38,
      createdAt: new Date(Date.now() - 35 * 60 * 1000),
    },
    {
      id: "log_usage_autoreels_01",
      licenseId: "lic_reels_02",
      appId: "app_autoreels_ai",
      modelAlias: "autoreels-generator",
      promptTokens: 520,
      completionTokens: 280,
      totalTokens: 800,
      responseTimeMs: 44,
      createdAt: new Date(Date.now() - 15 * 60 * 1000),
    },
  ]);
  console.log("✅ Kredensial AI Vault, Model Configs, & Log Penggunaan Token tersimpan.");

  console.log("🎉 Seeding database Postgres selesai 100%!");
  if (process.env.NODE_ENV !== "production") {
    console.log(`📋 Dashboard Login: ${ADMIN_CREDENTIALS.email}`);
    if (!config.admin.password) {
      console.log(
        `📋 Admin Password: ${ADMIN_CREDENTIALS.password} (Generated acak, disarankan disetel di .env)`
      );
    }
    console.log(`📋 Builder Secret Key: [Tersedia di Dashboard -> Settings -> API Keys]`);
  }
}

if (import.meta.main) {
  seed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("❌ Gagal seeding database:", err);
      process.exit(1);
    });
}
