import { describe, it, expect, beforeAll } from "bun:test";
import { setupTestAuth, authCookie } from "../setup";
import { db } from "../../db";
import { apps, licenses, licenseActivations, builders } from "../../db/schema";
import { eq } from "drizzle-orm";
import { logger } from "../../lib/logger";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

setupTestAuth();

describe("Item 1.6: Trial Device Fingerprinting & Technical Debt Cleanup", () => {
  let builderId: string;
  let testAppId: string;

  beforeAll(async () => {
    const existingBuilder = await db.query.builders.findFirst();
    builderId = existingBuilder!.id;

    // Buat app dengan masa uji coba (trialPeriodDays = 7)
    testAppId = `app_trial_fp_${Date.now()}`;
    await db.insert(apps).values({
      id: testAppId,
      builderId,
      name: "Trial Fingerprint Test App",
      slug: `trial-fp-${Date.now()}`,
      trialPeriodDays: 7,
      pricingType: "one_time",
      targetPrice: 50000,
      mode: "sandbox",
    });
  });

  it("berhasil aktivasi trial perdana dengan HWID dan mengikat hardwareId", async () => {
    const email1 = `buyer_device1_${Date.now()}@example.com`;
    const hwid1 = `MAC-DE-AD-BE-EF-01_${Date.now()}`;

    const res = await fetch("http://localhost:3001/api/v1/checkout/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        appId: testAppId,
        customerEmail: email1,
        startTrial: true,
        hwid: hwid1,
        deviceName: "MacBook Pro M2",
      }),
    });

    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.success).toBe(true);
    expect(body.isTrial).toBe(true);
    expect(body.licenseKey).toBeDefined();

    // Pastikan hardwareId tersimpan di DB
    const lic = await db.query.licenses.findFirst({
      where: eq(licenses.licenseKey, body.licenseKey),
    });
    expect(lic).toBeDefined();
    expect(lic?.hardwareId).toBeDefined();
    expect(lic?.hardwareId).toMatch(/^hw2:/);

    // Pastikan aktivasi tercatat di licenseActivations
    const act = await db.query.licenseActivations.findFirst({
      where: eq(licenseActivations.licenseId, lic!.id),
    });
    expect(act).toBeDefined();
    expect(act?.deviceName).toBe("MacBook Pro M2");
  });

  it("menolak trial ganda dari perangkat yang sama meski menggunakan email berbeda (Anti-Abuse 1.6)", async () => {
    const email2 = `attacker_different_email_${Date.now()}@tempmail.org`;
    const sharedHwid = `HWID_DEVICE_FINGERPRINT_STRICT_12345`;

    // 1. Klaim pertama berhasil
    const firstRes = await fetch("http://localhost:3001/api/v1/checkout/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        appId: testAppId,
        customerEmail: `legit_user_${Date.now()}@gmail.com`,
        startTrial: true,
        hwid: sharedHwid,
      }),
    });
    expect(firstRes.status).toBe(200);

    // 2. Klaim kedua dari perangkat sama dengan email berbeda harus ditolak (409)
    const secondRes = await fetch("http://localhost:3001/api/v1/checkout/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        appId: testAppId,
        customerEmail: email2,
        startTrial: true,
        hwid: sharedHwid,
      }),
    });

    expect(secondRes.status).toBe(409);
    const errBody: any = await secondRes.json();
    expect(errBody.success).toBe(false);
    expect(errBody.errorCode).toBe("TRIAL_DEVICE_ALREADY_USED");
    expect(errBody.error).toContain("Perangkat ini sudah pernah mengaktifkan masa uji coba");
  });

  it("mendukung alias deviceFingerprint di body atau metadata", async () => {
    const fpDevice = `BROWSER_CANVAS_FP_${Date.now()}`;
    const emailA = `user_fp_a_${Date.now()}@domain.com`;
    const emailB = `user_fp_b_${Date.now()}@domain.com`;

    // Klaim pertama via deviceFingerprint
    const resA = await fetch("http://localhost:3001/api/v1/checkout/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        appId: testAppId,
        customerEmail: emailA,
        startTrial: true,
        deviceFingerprint: fpDevice,
      }),
    });
    expect(resA.status).toBe(200);

    // Klaim kedua via metadata.hwid harus ditolak
    const resB = await fetch("http://localhost:3001/api/v1/checkout/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        appId: testAppId,
        customerEmail: emailB,
        startTrial: true,
        metadata: { hwid: fpDevice },
      }),
    });
    expect(resB.status).toBe(409);
    const bodyB: any = await resB.json();
    expect(bodyB.errorCode).toBe("TRIAL_DEVICE_ALREADY_USED");
  });

  it("Logger terstruktur (JSON & formatting) berfungsi tanpa error", () => {
    expect(typeof logger.info).toBe("function");
    expect(typeof logger.error).toBe("function");
    expect(typeof logger.warn).toBe("function");
    expect(typeof logger.debug).toBe("function");

    const childLog = logger.child({ module: "test-module" });
    expect(childLog).toBeDefined();

    // Tidak boleh melempar exception saat dipanggil dengan error object atau metadata
    expect(() => {
      logger.info("Test info message", { orderId: 123 });
      logger.warn("Test warning message", { attempt: 2 });
      logger.error("Test error message", new Error("Simulated failure"), { traceId: "abc" });
      logger.debug("Test debug message");
    }).not.toThrow();
  });

  it("File migrasi down.sql dan down-migration individual tersedia dan valid", () => {
    const downSqlPath = resolve(import.meta.dir, "../../db/migrations/down.sql");
    expect(existsSync(downSqlPath)).toBe(true);

    const downSqlContent = readFileSync(downSqlPath, "utf-8");
    expect(downSqlContent).toContain('ALTER TABLE "apps" DROP COLUMN IF EXISTS');
    expect(downSqlContent).toContain('DROP TABLE IF EXISTS "webhook_deliveries"');
    expect(downSqlContent).toContain('DROP TABLE IF EXISTS "licenses"');

    const files = [
      "0000_shallow_venus",
      "0001_plain_namora",
      "0002_magical_morph",
      "0003_volatile_miracleman",
      "0004_polite_sinister_six",
      "0005_dry_monster_badoon",
      "0006_married_peter_parker",
      "0007_friendly_piledriver",
    ];
    for (const f of files) {
      const indivPath = resolve(import.meta.dir, `../../db/migrations/${f}.down.sql`);
      expect(existsSync(indivPath)).toBe(true);
    }
  });
});
