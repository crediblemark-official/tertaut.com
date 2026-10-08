/**
 * Guard parity: setiap anggota publik SDK harus terdokumentasi.
 *
 * Audit sebelumnya menemukan `docs/sdk.md` hanya mencakup ~40% permukaan SDK
 * (getPaymentStatus, licensing.check, startHeartbeatSession, verifyApiKey,
 * credits.reportUsage, credits.getUsage, aiProxy.quotaStatus, seluruh s2s.*, dan
 * verifyWebhookSignature tidak tersentuh sama sekali) tanpa ada yang alarmed.
 * Test ini membuat ketiadaan dokumentasi menjadi kegagalan build.
 */

import { describe, it, expect } from "bun:test";
import { readFileSync, existsSync } from "fs";

const SDK_DOC = "docs/sdk.md";
const SDK_README = "packages/sdk/README.md";

/** Anggota publik yang wajib muncul di dokumentasi. */
const REQUIRED_DOCS: Array<{ label: string; needle: string }> = [
  // Konstruktor & checkout
  { label: "new Tertaut()", needle: "new Tertaut(" },
  { label: "checkout()", needle: "tertaut.checkout(" },
  { label: "getPaymentStatus()", needle: "getPaymentStatus(" },
  // Lisensi
  { label: "licensing.activate", needle: "licensing.activate" },
  { label: "licensing.validate", needle: "licensing.validate" },
  { label: "licensing.verify", needle: "licensing.verify" },
  { label: "licensing.entitlements", needle: "licensing.entitlements" },
  { label: "licensing.deactivate", needle: "licensing.deactivate" },
  { label: "licensing.heartbeat", needle: "licensing.heartbeat" },
  { label: "licensing.check", needle: "licensing.check" },
  { label: "licensing.startHeartbeatSession", needle: "startHeartbeatSession" },
  { label: "licensing.verifyOfflineToken", needle: "verifyOfflineToken" },
  { label: "licensing.verifyOfflineTokenOnline", needle: "verifyOfflineTokenOnline" },
  { label: "licensing.verifyApiKey", needle: "verifyApiKey" },
  { label: "licensing.getJwks", needle: "getJwks" },
  // Kredit
  { label: "credits.balance", needle: "credits.balance" },
  { label: "credits.consume", needle: "credits.consume" },
  { label: "credits.history", needle: "credits.history" },
  { label: "credits.reportUsage", needle: "reportUsage" },
  { label: "credits.getUsage", needle: "getUsage" },
  // S2S
  { label: "s2s.info", needle: "s2s.info" },
  { label: "s2s.apps", needle: "s2s.apps" },
  { label: "s2s.licenses", needle: "s2s.licenses" },
  { label: "s2s.credits", needle: "s2s.credits" },
  { label: "s2s.webhooks", needle: "s2s.webhooks" },
  // Utilitas
  { label: "verifyWebhookSignature", needle: "verifyWebhookSignature" },
  // Error bertipe
  { label: "TertautError", needle: "TertautError" },
  { label: "LicenseExpiredError", needle: "LicenseExpiredError" },
  { label: "SeatLimitExceededError", needle: "SeatLimitExceededError" },
  { label: "HeartbeatLeaseError", needle: "HeartbeatLeaseError" },
  { label: "InsufficientCreditsError", needle: "InsufficientCreditsError" },
  { label: "VersionFloorError", needle: "VersionFloorError" },
  { label: "TertautRateLimitError", needle: "TertautRateLimitError" },
];

const missing = (file: string, needles: string[]) =>
  needles.filter((n) => !readFileSync(file, "utf8").includes(n));

describe("Docs parity: @tertaut/sdk ↔ docs/sdk.md", () => {
  it("test ini punya file dokumentasi yang dituju", () => {
    expect(existsSync(SDK_DOC)).toBe(true);
    expect(existsSync(SDK_README)).toBe(true);
  });

  it("docs/sdk.md mendokumentasikan seluruh anggota publik SDK", () => {
    const gaps = REQUIRED_DOCS.filter((r) => !readFileSync(SDK_DOC, "utf8").includes(r.needle)).map(
      (r) => r.label
    );
    expect(gaps).toEqual([]);
  });

  it("packages/sdk/README.md mendokumentasikan seluruh anggota publik SDK", () => {
    const gaps = REQUIRED_DOCS.filter(
      (r) => !readFileSync(SDK_README, "utf8").includes(r.needle)
    ).map((r) => r.label);
    expect(gaps).toEqual([]);
  });

  it("docs tidak lagi mengklaim kode error lease yang tidak pernah dikirim server", () => {
    // Server hanya mengirim LEASE_MISMATCH (409) dan LEASE_STALE.
    // LEASE_EXPIRED/LEASE_INVALID sebagai *respons HTTP* tidak pernah ada.
    for (const file of [SDK_DOC, SDK_README]) {
      const text = readFileSync(file, "utf8");
      expect(text).not.toMatch(/403\s+`?LEASE_INVALID/);
      expect(text).not.toMatch(/409\s+`?LEASE_EXPIRED/);
    }
    // …dan kode yang benar harus terdokumentasi.
    const doc = readFileSync(SDK_DOC, "utf8");
    expect(doc).toContain("LEASE_MISMATCH");
    expect(doc).toContain("LEASE_STALE");
  });

  it("tidak ada klaim grantCredits dari klien di dokumentasi", () => {
    // Server mengambilnya dari meteringConfig.freeAllowance produk dan
    // mengabaikan kiriman klien (regression test #1 mengunci hal ini).
    for (const file of [SDK_DOC, SDK_README]) {
      const text = readFileSync(file, "utf8");
      expect(text).not.toMatch(/checkout membawa `?grantCredits/);
      expect(text).not.toMatch(/grantCredits[^\n]*dari klien/i);
    }
  });

  it("dokumentasi mencantumkan rate limit server yang nyata", () => {
    const doc = readFileSync(SDK_DOC, "utf8");
    for (const needle of ["60", "120", "429", "RATE_LIMIT"]) {
      expect(doc).toContain(needle);
    }
  });

  it("dokumentasi menyatakan ketersediaan paymentRail berbeda antar gateway", () => {
    // `card`/`retail` hanya ada di Xendit & XenithPay; DANA tidak mendukungnya.
    // Menampilkan lima rail seolah-olah universal akan menyesatkan integrator
    // saat gateway aktif diganti.
    const doc = readFileSync(SDK_DOC, "utf8");
    expect(doc).toContain("Ketersediaan `paymentRail` per gateway");
    for (const gateway of ["DANA", "Xendit", "XenithPay"]) {
      expect(doc).toContain(gateway);
    }

    const railSection = doc.slice(doc.indexOf("Ketersediaan `paymentRail`"));
    expect(railSection).toMatch(/`card`[^|]*\|[^|]*❌/);
    expect(railSection).toMatch(/`retail`[^|]*\|[^|]*❌/);
  });

  it("tipe SDK tetap sinkron dengan himpunan rail di server", () => {
    const types = readFileSync("packages/sdk/src/types.ts", "utf8");
    const railUnion = types.match(/paymentRail\?:([^;]+);/)?.[1] ?? "";
    for (const rail of ["qris", "va", "ewallet", "card", "retail"]) {
      expect(railUnion).toContain(`"${rail}"`);
    }
  });

  it("setiap gateway di registry punya adapter, webhook, dan entri di docs", () => {
    // Nama gateway TIDAK ditulis di test ini — diambil dari registry. Kalau test
    // ini menulis daftar gateway secara literal, dia akan jadi delete-blocker: begitu
    // sebuah gateway dihapus, test gagal padahal tidak ada masalah kode.
    const {
      GATEWAY_IDS,
      GATEWAY_REGISTRY,
      GATEWAY_LIST,
    } = require("../../../../src/server/services/payments/gateways/registry");
    const doc = readFileSync(SDK_DOC, "utf8");
    const adapterModule = require("../../../../src/server/services/payments/gateways/index");

    expect(GATEWAY_IDS.length).toBeGreaterThan(0);
    for (const id of GATEWAY_IDS) {
      // adapter tersedia & dapat di-resolve
      const adapter = adapterModule.getPaymentGateway(id);
      expect(adapter.id).toBe(id);
      expect(typeof adapter.createOrder).toBe("function");
      expect(typeof adapter.createDisbursement).toBe("function");

      // descriptor lengkap
      const descriptor = GATEWAY_REGISTRY[id];
      expect(descriptor.displayName.length).toBeGreaterThan(0);
      expect(descriptor.rails.length).toBeGreaterThan(0);
      expect(descriptor.finishPath.length).toBeGreaterThan(0);

      // file webhook milik gateway ada (dari nama descriptor)
      expect(
        existsSync(`src/server/routes/webhook/${id}.ts`),
        `webhook handler untuk "${id}" tidak ditemukan`
      ).toBe(true);

      // tampil di tabel rail pada docs
      expect(doc).toContain(descriptor.displayName);
    }
    expect(GATEWAY_LIST.length).toBe(GATEWAY_IDS.length);
  });

  it("sidebar vitepress hanya menautkan halaman yang benar-benar ada", () => {
    const config = readFileSync("docs/.vitepress/config.ts", "utf8");
    const links = [...config.matchAll(/link:\s*"\/([\w-]+)"/g)].map((m) => `${m[1]}.md`);
    const orphan = links.filter((f) => !existsSync(`docs/${f}`));
    expect(orphan).toEqual([]);
  });

  it("setiap halaman docs selain index tercantum di sidebar vitepress", () => {
    const config = readFileSync("docs/.vitepress/config.ts", "utf8");
    const listed = new Set([...config.matchAll(/link:\s*"\/([\w-]+)"/g)].map((m) => m[1]));
    listed.add("index");

    const files = ["demo-checkout", "environment", "getting-started", "sdk", "server-to-server"];
    const unlisted = files.filter((f) => !listed.has(f));
    expect(unlisted).toEqual([]);
  });

  it("nomor versi konsisten antara package.json, health, dan README", () => {
    // Audit sebelumnya menemukan empat angka versi berbeda melayang
    // (0.2.0 / 2.2.0 / 2.2.3 / "2.3") tanpa ada yang gagal.
    const pkg = JSON.parse(readFileSync("package.json", "utf8"));
    const health = readFileSync("src/server/routes/health.ts", "utf8");
    const readme = readFileSync("README.md", "utf8");

    const healthVersion = health.match(/version:\s*"([\d.]+)"/)?.[1];
    expect(pkg.version).toBe(healthVersion);
    expect(readme).toContain(`**Versi ${pkg.version}**`);
  });
});
