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
  aiVaultCredentials,
  aiProxyLogs,
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

const BUILDER = {
  name: "Ahmad Rizky (Solo Founder)",
  email: "ahmad.builder@tertaut.com",
  password: "AdminPassword123!",
};

const APPS = [
  {
    id: "app_fastmail_ai",
    name: "FastMail AI Summarizer",
    slug: "fastmail-ai",
    mode: "live" as const,
    targetPrice: 49000,
    platform: "chrome_extension" as const,
    description: "Ekstensi Chrome untuk merangkum email penting secara otomatis menggunakan Gemini AI.",
    mediaUrl: "https://images.unsplash.com/photo-1557804506-669a67965ba0?auto=format&fit=crop&w=800&q=80",
    floating: false,
  },
  {
    id: "app_devdocs_pro",
    name: "DevDocs Desktop Pro",
    slug: "devdocs-desktop",
    mode: "live" as const,
    targetPrice: 149000,
    platform: "desktop" as const,
    description: "Aplikasi desktop offline-first untuk dokumentasi framework dengan pencarian instan dan lisensi seumur hidup.",
    mediaUrl: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=800&q=80",
    floating: true,
  },
  {
    id: "app_autoreels_ai",
    name: "AutoReels Video Maker",
    slug: "autoreels-ai",
    mode: "live" as const,
    targetPrice: 299000,
    platform: "general" as const,
    description: "Automasi pembuatan video TikTok & IG Reels bertenaga AI untuk digital marketer dan konten kreator.",
    mediaUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80",
    floating: false,
  },
];

const TXS = [
  { id: "tx_89a1c23f", appId: "app_devdocs_pro", builderId: "", xenditInvoiceId: "inv_devdocs_001", xenditExternalId: "tt_devdocs_17180011", customerEmail: "budi.santoso@startup.id", amount: 149000, channel: "QRIS" as const, status: "PAID" as const, disbursementStatus: "COMPLETED" as const, grantDays: 365, paidAt: new Date(Date.now() - 2 * 86400 * 1000) },
  { id: "tx_45b3e71a", appId: "app_autoreels_ai", builderId: "", xenditInvoiceId: "inv_reels_002", xenditExternalId: "tt_reels_17180022", customerEmail: "siti.rahmawati@creator.co", amount: 299000, channel: "BCA_VA" as const, status: "PAID" as const, disbursementStatus: "COMPLETED" as const, grantDays: 30, paidAt: new Date(Date.now() - 1 * 86400 * 1000) },
  { id: "tx_12f9d84c", appId: "app_devdocs_pro", builderId: "", xenditInvoiceId: "inv_devdocs_003", xenditExternalId: "tt_devdocs_17180033", customerEmail: "dendy.irawan@agency.net", amount: 149000, channel: "GOPAY" as const, status: "PAID" as const, disbursementStatus: "PENDING" as const, grantDays: 365, paidAt: new Date(Date.now() - 3 * 3600 * 1000) },
  { id: "tx_77e2a90b", appId: "app_autoreels_ai", builderId: "", xenditInvoiceId: "inv_reels_004", xenditExternalId: "tt_reels_17180044", customerEmail: "kevin.chandra@corp.com", amount: 299000, channel: "MANDIRI_VA" as const, status: "PENDING" as const, disbursementStatus: "PENDING" as const, grantDays: 30, paidAt: new Date(Date.now() - 30 * 60 * 1000) },
];

const LICENSES = [
  { id: "lic_devdocs_01", appId: "app_devdocs_pro", txId: "tx_89a1c23f", key: "TT-DEVD-9921-X8WQ", email: "budi.santoso@startup.id", hwidRaw: "CPU_INTEL_i9_13900K_SN_88219", platform: "desktop" as const, status: "ACTIVE" as const, days: 363, floating: true },
  { id: "lic_reels_02", appId: "app_autoreels_ai", txId: "tx_45b3e71a", key: "TT-REEL-7734-P4KM", email: "siti.rahmawati@creator.co", hwidRaw: "APPLE_M3_MAX_SERIAL_C02G", platform: "desktop" as const, status: "ACTIVE" as const, days: 29, floating: false },
  { id: "lic_devdocs_03", appId: "app_devdocs_pro", txId: "tx_12f9d84c", key: "TT-DEVD-3341-M9LQ", email: "dendy.irawan@agency.net", hwidRaw: null, platform: "desktop" as const, status: "ACTIVE" as const, days: 365, floating: false },
  { id: "lic_fastmail_04", appId: "app_fastmail_ai", txId: null, key: "TT-FAST-8812-C7NV", email: "early.adopter@gmail.com", hwidRaw: null, platform: "chrome_extension" as const, status: "ACTIVE" as const, days: 180, floating: false },
  { id: "lic_revoked_05", appId: "app_devdocs_pro", txId: null, key: "TT-DEVD-0000-VOID", email: "pirate.violator@blackhat.xyz", hwidRaw: "VMWARE_VIRTUAL_MACHINE_001", platform: "desktop" as const, status: "REVOKED" as const, days: 300, floating: false },
];

const ACTIVATIONS = [
  { licenseId: "lic_devdocs_01", hwidRaw: "CPU_INTEL_i9_13900K_SN_88219", device: "Budi's MacBook Pro M3", ip: "103.28.12.90" },
  { licenseId: "lic_reels_02", hwidRaw: "APPLE_M3_MAX_SERIAL_C02G", device: "Siti's Mac Studio Workstation", ip: "182.253.44.12" },
];

const AI_VAULT = [
  { appId: "app_fastmail_ai", provider: "gemini" as const, budget: 500000, usage: 48500 },
  { appId: "app_autoreels_ai", provider: "openai" as const, budget: 1000000, usage: 182000 },
];

const AI_LOGS = [
  { appId: "app_fastmail_ai", licenseKey: "TT-FAST-8812-C7NV", provider: "gemini" as const, model: "gemini-1.5-flash", prompt: 340, completion: 120, latency: 38, agoMin: 35 },
  { appId: "app_autoreels_ai", licenseKey: "TT-REEL-7734-P4KM", provider: "openai" as const, model: "gpt-4o-mini", prompt: 520, completion: 280, latency: 44, agoMin: 15 },
];

export async function seed() {
  console.log("🌱 Mulai seeding database PostgreSQL tertautv2...");

  // 1. Super Admin
  try {
    const existingAdmin = await db.select().from(user).where(eq(user.email, "admin@tertaut.com"));
    if (existingAdmin.length === 0) {
      await auth.api.signUpEmail({ body: { email: "admin@tertaut.com", password: BUILDER.password, name: "Super Admin" } });
    }
    await db.update(user).set({ role: "admin" }).where(eq(user.email, "admin@tertaut.com"));
    console.log("✅ Super Admin terverifikasi: admin@tertaut.com (role: admin)");
  } catch (err: any) {
    console.warn("⚠️ Info Super Admin:", err?.message);
  }

  // 2. Bersihkan semua data (urutan child → parent, FK-safe)
  await db.delete(webhookDeliveries);
  await db.delete(webhookEndpoints);
  await db.delete(licenseEvents);
  await db.delete(licenseLeases);
  await db.delete(revokedTokens);
  await db.delete(licenseActivations);
  await db.delete(licenses);
  await db.delete(transactions);
  await db.delete(apps);
  await db.delete(builders);
  await db.delete(aiProxyLogs);
  await db.delete(aiVaultCredentials);

  console.log("🧹 Database bersih. Memasukkan data awal...");

  // 3. Builder (jika belum ada, buat akun admin juga jadi builder)
  let [builder] = await db.select().from(builders).where(eq(builders.email, BUILDER.email));
  if (!builder) {
    // Pastikan user admin ada (untuk userId builder)
    const existingUser = await db.select().from(user).where(eq(user.email, BUILDER.email));
    if (existingUser.length === 0) {
      await auth.api.signUpEmail({ body: { email: BUILDER.email, password: BUILDER.password, name: BUILDER.name } });
    }
    await db.update(user).set({ role: "admin" }).where(eq(user.email, BUILDER.email));
    const [u] = await db.select().from(user).where(eq(user.email, BUILDER.email));
    [builder] = await db.insert(builders).values({
      userId: (u as any).id,
      name: BUILDER.name,
      email: BUILDER.email,
      apiKey: `tt_live_${randomBytes(16).toString("hex")}`,
      secretApiKey: generateBuilderSecretApiKey(),
      disbursementAccount: { bankCode: "BCA", accountNumber: "8830192847", accountHolderName: BUILDER.name },
    }).returning();
  }
  console.log(`✅ Builder: ${builder.name} (${builder.email})`);

  // 4. Apps
  const seededApps = await db.insert(apps).values(APPS.map((a, i) => ({
    id: a.id,
    builderId: builder.id,
    apiKey: generateAppApiKey("live"),
    name: a.name,
    slug: a.slug,
    mode: a.mode,
    targetPrice: a.targetPrice,
    description: a.description,
    headline: a.name,
    subheadline: a.description.slice(0, 80),
    mediaUrl: a.mediaUrl,
    deliveryConfig: a.platform === "desktop"
      ? ({ licenseKey: { enabled: true, description: "Lisensi Universal Tertaut", expiresInDays: 365, maxSeats: 3, offlineGraceDays: 30, floating: { enabled: a.floating, leaseTtlSeconds: 300, heartbeatIntervalSeconds: 60 } } } as DeliveryConfig)
      : a.platform === "chrome_extension"
        ? ({ licenseKey: { enabled: true, description: "Lisensi Universal Tertaut", expiresInDays: 180, maxSeats: 1, offlineGraceDays: 7 } } as DeliveryConfig)
        : ({ licenseKey: { enabled: true, description: "Lisensi Universal Tertaut", expiresInDays: 30, maxSeats: 1 } } as DeliveryConfig),
  }))).returning();
  console.log(`✅ ${seededApps.length} Aplikasi di-seed:`, seededApps.map((a) => a.name));

  // Seed sample apps untuk builder lain yang terdaftar di sistem jika belum punya app
  const otherBuilders = await db.select().from(builders);
  for (const ob of otherBuilders) {
    if (ob.id !== builder.id) {
      const existing = await db.select().from(apps).where(eq(apps.builderId, ob.id));
      if (existing.length === 0) {
        await db.insert(apps).values([
          {
            id: `app_${ob.id.slice(0, 8)}_pro`,
            builderId: ob.id,
            apiKey: generateAppApiKey("live"),
            name: "Desktop License Manager Pro",
            slug: `license-manager-${ob.id.slice(0, 6)}`,
            mode: "live" as const,
            targetPrice: 99999,
            description: "Solusi lisensi desktop offline-first & online sync dengan integrasi DANA Enterprise.",
            headline: "Desktop License Manager Pro",
            subheadline: "Solusi lisensi software terdepan",
            mediaUrl: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=800&q=80",
            deliveryConfig: { licenseKey: { enabled: true, description: "Lisensi Universal Tertaut", expiresInDays: 31, maxSeats: 3 } } as DeliveryConfig,
          },
          {
            id: `app_${ob.id.slice(0, 8)}_ai`,
            builderId: ob.id,
            apiKey: generateAppApiKey("live"),
            name: "FastAI Code Assistant",
            slug: `fastai-code-${ob.id.slice(0, 6)}`,
            mode: "live" as const,
            targetPrice: 149000,
            description: "AI coding assistant dengan proxy streaming anti-leak.",
            headline: "FastAI Code Assistant",
            subheadline: "Asisten AI untuk developer",
            mediaUrl: "https://images.unsplash.com/photo-1557804506-669a67965ba0?auto=format&fit=crop&w=800&q=80",
            deliveryConfig: { licenseKey: { enabled: true, description: "Lisensi Universal Tertaut", expiresInDays: 30, maxSeats: 1 } } as DeliveryConfig,
          }
        ]);
        console.log(`✅ Aplikasi contoh berhasil dibuat untuk builder: ${ob.email}`);
      }
    }
  }

  // 5. Transactions
  await db.insert(transactions).values(TXS.map((t) => ({
    ...t,
    builderId: builder.id,
    paymentProvider: "dana",
    providerReferenceId: t.xenditInvoiceId,
    ...DanaService.calculateMorBreakdown(t.amount),
    paymentChannel: t.channel,
    paymentStatus: t.status,
    disbursementStatus: t.disbursementStatus,
    disbursementId: t.status === "PAID" ? `disb_dana_${t.id.slice(0, 6)}` : null,
    paidAt: t.paidAt,
    createdAt: t.paidAt,
  })));
  console.log(`✅ ${TXS.length} Transaksi tersimpan.`);

  // 6. Licenses
  const licenseRows = await db.insert(licenses).values(LICENSES.map((l) => ({
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
    offlineJwtGraceToken: LicenseService.createOfflineGraceToken(l.key, l.appId, l.hwidRaw ? LicenseService.hashHardwareId(l.hwidRaw) : null, l.email),
    lastValidatedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  }))).returning();
  console.log(`✅ ${licenseRows.length} Lisensi tersimpan.`);

  // 7. License Activations + Leases (floating)
  const licMap = Object.fromEntries(licenseRows.map((l) => [l.licenseKey, l]));
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
    // Floating lease untuk lisensi floating
    if (lic.features?.floating) {
      const leaseKey = `lk_${randomBytes(6).toString("hex")}`;
      const ttlSeconds = 300;
      await db.insert(licenseLeases).values({
        id: `lse_${a.licenseId.split("_")[1]}`,
        licenseId: lic.id,
        hwidHash,
        deviceName: a.device,
        leaseKey,
        ipAddress: a.ip,
        lastHeartbeatAt: new Date(),
        expiresAt: new Date(Date.now() + ttlSeconds * 1000),
        createdAt: new Date(),
      });
    }
  }
  console.log(`✅ Aktivasi + Floating Lease tersimpan.`);

  // 8. Revoked token (untuk lic_revoked_05)
  const revokedLic = licMap["TT-DEVD-0000-VOID"];
  if (revokedLic) {
    const token = LicenseService.createOfflineGraceToken("TT-DEVD-0000-VOID", revokedLic.appId);
    const jti = token.split(".")[1];
    await db.insert(revokedTokens).values({ jti, licenseId: revokedLic.id, licenseKey: "TT-DEVD-0000-VOID", reason: "REVOKED", revokedAt: new Date(), expiresAt: revokedLic.expiresAt });
  }

  // 9. Webhook endpoints contoh (untuk dashboard Webhooks tab)
  const whActive = await db.insert(webhookEndpoints).values([
    { id: "whk_dashboard_demo", builderId: builder.id, url: "https://api.tertaut.dev/webhook/demo", secret: "whsec_demo_" + randomBytes(8).toString("hex"), events: ["license.issued", "license.activated", "license.revoked", "license.expired"], isActive: true, createdAt: new Date(), updatedAt: new Date() },
    { id: "whk_audit_log", builderId: builder.id, url: "https://hooks.slack.com/services/Demo/audit", secret: "whsec_audit_" + randomBytes(8).toString("hex"), events: [], isActive: false, createdAt: new Date(Date.now() - 86400000), updatedAt: new Date(Date.now() - 86400000) },
  ]).returning();
  console.log(`✅ ${whActive.length} Webhook endpoint contoh tersimpan.`);

  // 10. Webhook delivery contoh (outbox history)
  await db.insert(webhookDeliveries).values([
    { id: "whd_demo_001", endpointId: whActive[0].id, event: "license.issued", payload: { event: "license.issued", data: { licenseKey: "TT-DEVD-9921-X8WQ", customerEmail: "budi.santoso@startup.id" } }, signature: "whsec_sig_demo_001", status: "SENT", attempts: 1, lastAttemptAt: new Date(), nextRetryAt: new Date(), createdAt: new Date(Date.now() - 3600000), updatedAt: new Date() },
    { id: "whd_demo_002", endpointId: whActive[0].id, event: "license.revoked", payload: { event: "license.revoked", data: { licenseKey: "TT-DEVD-0000-VOID", customerEmail: "pirate.violator@blackhat.xyz" } }, signature: "whsec_sig_demo_002", status: "FAILED", attempts: 4, lastAttemptAt: new Date(), nextRetryAt: new Date(Date.now() + 300000), createdAt: new Date(Date.now() - 7200000), updatedAt: new Date() },
    { id: "whd_demo_003", endpointId: whActive[0].id, event: "license.activated", payload: { event: "license.activated", data: { licenseKey: "TT-REEL-7734-P4KM", customerEmail: "siti.rahmawati@creator.co" } }, signature: "whsec_sig_demo_003", status: "PENDING", attempts: 0, nextRetryAt: new Date(), createdAt: new Date(), updatedAt: new Date() },
  ]);
  console.log(`✅ Webhook delivery history tersimpan.`);

  // 11. License Events (audit trail)
  const evRows = await db.insert(licenseEvents).values([
    { id: "evt_issued_01", licenseId: licenseRows[0].id, licenseKey: "TT-DEVD-9921-X8WQ", appId: "app_devdocs_pro", event: "license.issued", actorType: "S2S" as const, actorId: builder.id, payload: { maxSeats: 5, floating: true }, ipAddress: "103.28.12.90", createdAt: new Date(Date.now() - 3 * 86400000) },
    { id: "evt_activated_01", licenseId: licenseRows[0].id, licenseKey: "TT-DEVD-9921-X8WQ", appId: "app_devdocs_pro", event: "license.activated", actorType: "CLIENT" as const, payload: { hwidHash: LicenseService.hashHardwareId("CPU_INTEL_i9_13900K_SN_88219"), deviceName: "Budi's MacBook Pro M3" }, ipAddress: "103.28.12.90", createdAt: new Date(Date.now() - 2 * 86400000) },
    { id: "evt_heartbeat_01", licenseId: licenseRows[0].id, licenseKey: "TT-DEVD-9921-X8WQ", appId: "app_devdocs_pro", event: "license.activated", actorType: "CLIENT" as const, payload: { leaseKey: "lk_demo", heartbeat: true }, ipAddress: "103.28.12.90", createdAt: new Date(Date.now() - 1 * 86400000) },
    { id: "evt_issued_02", licenseId: licenseRows[1].id, licenseKey: "TT-REEL-7734-P4KM", appId: "app_autoreels_ai", event: "license.issued", actorType: "S2S" as const, actorId: builder.id, payload: { maxSeats: 3 }, ipAddress: "182.253.44.12", createdAt: new Date(Date.now() - 2 * 86400000) },
    { id: "evt_revoked_01", licenseId: licenseRows[4].id, licenseKey: "TT-DEVD-0000-VOID", appId: "app_devdocs_pro", event: "license.revoked", actorType: "ADMIN" as const, actorId: builder.id, payload: { reason: "Piracy detected" }, ipAddress: "192.168.1.1", createdAt: new Date(Date.now() - 5 * 86400000) },
    { id: "evt_issued_03", licenseId: licenseRows[2].id, licenseKey: "TT-DEVD-3341-M9LQ", appId: "app_devdocs_pro", event: "license.issued", actorType: "S2S" as const, actorId: builder.id, payload: { maxSeats: 3 }, ipAddress: "10.0.0.5", createdAt: new Date(Date.now() - 1 * 86400000) },
    { id: "evt_issued_04", licenseId: licenseRows[3].id, licenseKey: "TT-FAST-8812-C7NV", appId: "app_fastmail_ai", event: "license.issued", actorType: "S2S" as const, actorId: builder.id, payload: { maxSeats: 1 }, ipAddress: "172.16.0.2", createdAt: new Date(Date.now() - 10 * 86400000) },
  ]).returning();
  console.log(`✅ ${evRows.length} Audit event tersimpan.`);

  // 12. AI Vault + Logs
  await db.insert(aiVaultCredentials).values(AI_VAULT.map((v) => {
    const enc = CryptoService.encrypt(v.provider === "gemini" ? "AIzaSyB3-SAMPLE-REALISTIC-KEY-FOR-VAULT-TESTING" : "sk-proj-sample-encrypted-key-secure-vault-12345");
    return { appId: v.appId, provider: v.provider, encryptedApiKey: enc.cipherText, iv: enc.iv, authTag: enc.authTag, monthlyBudgetLimit: v.budget, currentMonthlyUsage: v.usage, isKillSwitchActive: false };
  }));
  await db.insert(aiProxyLogs).values(AI_LOGS.map((l) => ({
    appId: l.appId, licenseKey: l.licenseKey, provider: l.provider, model: l.model,
    promptTokens: l.prompt, completionTokens: l.completion, totalTokens: l.prompt + l.completion,
    latencyMs: l.latency, createdAt: new Date(Date.now() - l.agoMin * 60 * 1000),
  })));
  console.log("✅ Kredensial AI Vault & Proxy Audit Logs tersimpan.");

  console.log("🎉 Seeding database Postgres selesai 100%!");
  console.log(`📋 Dashboard login: admin@tertaut.com / ${BUILDER.password}`);
  console.log(`📋 Builder secret key tersedia di dashboard → Secret API Key`);
}

if (import.meta.main) {
  seed()
    .then(() => process.exit(0))
    .catch((err) => { console.error("❌ Gagal seeding database:", err); process.exit(1); });
}