# @tertaut/sdk

SDK ringan (**~16 KB minified, ~5 KB gzipped, zero dependency**) untuk
[tertaut.com](https://tertaut.com): checkout Merchant-of-Record (MoR), pembayaran dinamis S2S,
lisensi universal multi-platform, dan metered credits.

Berjalan di Browser, Chrome Extension, Desktop (Tauri/Electron), Node.js, Bun, dan React Native.

Dokumentasi lengkap: **https://tertaut.com/docs/sdk**

## Instalasi

```bash
npm install @tertaut/sdk
# bun add @tertaut/sdk
# pnpm add @tertaut/sdk
```

## Mulai Cepat

```ts
import { Tertaut } from "@tertaut/sdk";

const tertaut = new Tertaut({
  apiKey: "tt_live_xxxx", // tt_live_... = produksi, tt_test_... = sandbox
  baseUrl: "https://tertaut.com", // ganti ke http://localhost:8081 saat dev lokal
  appId: "app_xxx",
});
```

`appId` wajib diisi kecuali `apiKey` berupa `tt_secret_…` (kunci server).

### Checkout (Merchant of Record / S2S Dynamic SaaS)

```ts
const { checkoutUrl, transactionId, ticket } = await tertaut.checkout({
  amount: 135000,
  customerEmail: "pembeli@example.com",
  customerName: "Budi Santoso",
  redirectUrl: "https://app.example.com/thanks",
  metadata: {
    userId: "usr_9981",
    tier: "pro",
    seats: 3,
  },
  autoRedirect: true, // di browser akan otomatis redirect ke hosted checkout
});

// Simpan `ticket` (HMAC, umur 45 menit) untuk polling status & faktur
const status = await tertaut.getPaymentStatus(transactionId, ticket);
```

> Kredit gratis saat checkout ditentukan **produk** (`meteringConfig.freeAllowance`),
> bukan oleh klien. Server mengabaikan nilai kredit yang dikirim klien.

### Lisensi

```ts
await tertaut.licensing.activate({ licenseKey, hwid, deviceName: "MacBook Pro" });
await tertaut.licensing.validate({ licenseKey, hardwareId: hwid });
await tertaut.licensing.verify({ licenseKey, hwid });
await tertaut.licensing.deactivate({ licenseKey, hwid });
```

**Floating license: perpanjang lease seat rolling via heartbeat**

```ts
const { data } = await tertaut.licensing.activate({ licenseKey, hwid });

const session = tertaut.licensing.startHeartbeatSession({
  licenseKey,
  hwid,
  leaseKey: data.leaseKey!,
  intervalSeconds: data.heartbeatIntervalSeconds, // dari respons activate
  onSuccess: (res) => console.log("Lease sampai", res.expiresAt),
  onLeaseExpired: (err) => showReactivationPrompt(),
  onError: (err) => console.warn("Heartbeat bermasalah:", err.message),
});
session.stop();
```

**Verifikasi offline (Ed25519, Web Crypto) — tanpa memanggil server**

```ts
const result = await tertaut.licensing.verifyOfflineToken(licenseToken, {
  appVersion: "2.3.0",
});
if (result.valid) console.log(result.claims);

// Online: cek JTI denylist + status lisensi terkini
const fresh = await tertaut.licensing.verifyOfflineTokenOnline(licenseToken);
```

> Verifikasi lokal tidak mengetahui revoke terbaru. Lakukan `validate()` online
> secara berkala — setiap validasi online **merotasi** token, jadi simpan
> `offlineGraceToken` terbaru.

### Kredit

```ts
await tertaut.credits.balance({ licenseKey, hwid });
await tertaut.credits.consume({ licenseKey, hwid, amount: 10, reason: "10x generate" });
const { entries } = await tertaut.credits.history({ licenseKey, limit: 20 });

// Metered usage per kejadian
await tertaut.credits.reportUsage({ licenseKey, hwid, eventName: "pdf_export", units: 3 });
const usage = await tertaut.credits.getUsage(licenseKey);
```

Konsumsi bersifat atomik dan mendukung `reference` untuk idempotensi.

## Penanganan error

Semua metode melempar subclass `TertautError` untuk HTTP `>= 400`:

```ts
import { SeatLimitExceededError, VersionFloorError, TertautRateLimitError } from "@tertaut/sdk";

try {
  await tertaut.licensing.activate({ licenseKey, hwid });
} catch (err) {
  if (err instanceof SeatLimitExceededError) return showSeatFull();
  if (err instanceof VersionFloorError) return promptUpgrade(err.details.minVersion);
  if (err instanceof TertautRateLimitError) return retryAfter(err.retryAfter);
  if (err instanceof InsufficientCreditsError) return showTopUpPrompt();
  throw err;
}
```

Kelas yang tersedia: `TertautError` (base), `LicenseExpiredError`,
`LicenseRevokedError`, `SeatLimitExceededError`, `HeartbeatLeaseError`,
`InsufficientCreditsError`, `VersionFloorError`, `TertautRateLimitError`.

Respons `2xx` dengan `valid:false` / `success:false` **tidak** dilempar — itu
jawaban bisnis yang sah. Periksa `result.valid` seperti biasa.

## API

| Anggota                                            | Deskripsi                                                                             |
| -------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `new Tertaut({ apiKey, baseUrl, appId? })`         | Inisialisasi klien (publishable `tt_live_`/`tt_test_` atau secret `tt_secret_`)       |
| `checkout(options)`                                | Buat sesi checkout MoR (auto redirect di browser, dukung kupon, rail, dan free trial) |
| `getPaymentStatus(txId, ticket?)`                  | Cek status transaksi pembayaran MoR dengan atau tanpa HMAC ticket                     |
| `licensing.activate`                               | Aktivasi perangkat, sewakan seat bila lisensi floating                                |
| `licensing.validate`                               | Validasi online + rotasi offline token                                                |
| `licensing.verify`                                 | Verifikasi cepat: status, sisa grace period, saldo kredit, entitlements               |
| `licensing.verify` / `licensing.entitlements(...)` | Ambil feature flags, entitlements & helper `hasFeature`/`getFeature`                  |
| `licensing.deactivate`                             | Lepaskan seat perangkat                                                               |
| `licensing.heartbeat`                              | Perpanjang lease floating (rolling seat) manual                                       |
| `licensing.startHeartbeatSession`                  | Background session manager untuk floating rolling seat lease                          |
| `licensing.check`                                  | Smart dual-mode check (online dengan graceful offline token fallback)                 |
| `licensing.verifyOfflineToken`                     | Verifikasi token offline Ed25519 secara lokal (tanpa request)                         |
| `licensing.verifyOfflineTokenOnline`               | Verifikasi token via server: cek JTI denylist & status lisensi terkini                |
| `licensing.verifyApiKey`                           | Verifikasi customer API key (`tt_cust_…`) yang terbit saat checkout                   |
| `licensing.getJwks`                                | Ambil public key Ed25519 dalam format JWKS                                            |
| `credits.balance / consume / history`              | Saldo & pemakaian kredit lisensi (konsumsi idempoten)                                 |
| `credits.reportUsage`                              | Kirim event konsumsi kredit terukur (metered usage event)                             |
| `credits.getUsage`                                 | Ambil ringkasan penggunaan metered billing untuk lisensi                              |
| `s2s.*`                                            | Server-to-Server Admin API (apps, licenses, seats, webhooks, credits)                 |
| `Tertaut.verifyWebhookSignature`                   | Verifikasi HMAC-SHA256 webhook (constant-time, Web Crypto)                            |

## Contoh Penggunaan Fitur Komprehensif

### 1. Smart License Check (Dual Mode)

```ts
const result = await tertaut.licensing.check({
  licenseKey: "TT-XXXX-XXXX-XXXX",
  hwid: "device_hardware_id",
  offlineToken: cachedOfflineToken,
  allowOfflineFallback: true,
});

if (result.valid) {
  if (result.hasFeature("ai-assistant")) {
    const maxFiles = result.getFeature("max_files", 5);
    console.log("Active with max files:", maxFiles);
  }
}
```

### 2. S2S Admin API (Backend Secret Key)

```ts
const admin = new Tertaut({
  apiKey: "tt_secret_xxxx",
  baseUrl: "https://tertaut.com",
});

await admin.s2s.info(); // profil builder pemilik secret key
await admin.s2s.apps.list("live"); // katalog aplikasi
await admin.s2s.apps.get("app_xxx");

const { license } = await admin.s2s.licenses.issue({
  appId: "app_xxx",
  customerEmail: "user@example.com",
  grantDays: 365,
});
await admin.s2s.licenses.seats(license.licenseKey);
await admin.s2s.licenses.releaseSeat({ licenseKey, hwid });

await admin.s2s.credits.balance(licenseKey);
await admin.s2s.credits.consume({ licenseKey, amount: 10, reference: "job-001" });

await admin.s2s.webhooks.list();
const wh = await admin.s2s.webhooks.create({ url: "https://app.example.com/hooks" });
await admin.s2s.webhooks.rotateSecret(wh.webhook.id);
await admin.s2s.webhooks.test(wh.webhook.id);

// Verifikasi incoming webhook
const isValid = await Tertaut.verifyWebhookSignature(
  rawBodyString,
  headers["x-tertaut-signature"],
  webhookSecret
);
```

## Arsitektur Modular

SDK diorganisir secara modular di bawah `src/` dengan standar Web Crypto zero-dependency:

- `types.ts`: Definisi antarmuka TypeScript lengkap.
- `errors.ts`: Typed custom error classes (`TertautError`, `LicenseExpiredError`, `HeartbeatLeaseError`, dll) + normalisasi envelope error server.
- `modules/checkout.ts`: MoR checkout engine.
- `modules/licensing.ts`: Universal licensing & floating lease manager.
- `modules/credits.ts`: Saldo, ledger & metered usage.
- `modules/s2s.ts`: Server-to-Server Admin API & Webhooks.
- `utils/crypto.ts`: Web Crypto Ed25519 & HMAC-SHA256 (constant-time).
- `utils/semver.ts`: Semver version comparison untuk version floor.

## Lisensi

UNLICENSED — © tertaut.com. All rights reserved.
