# @tertaut/sdk

SDK ringan (< 15KB, zero dependency) untuk [tertaut.com](https://tertaut.com): checkout Merchant-of-Record, lisensi universal multi-platform, dan AI proxy.

Berjalan di Browser, Chrome Extension, Desktop (Tauri/Electron), Node.js, Bun, dan React Native.

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

### Checkout (Merchant of Record)

```ts
await tertaut.checkout({
  amount: 49000,
  grantDays: 30,
  customerEmail: "pembeli@example.com",
  redirectUrl: "https://app.example.com/thanks",
}); // di browser akan otomatis redirect ke halaman pembayaran
```

### Lisensi

```ts
await tertaut.licensing.activate({ licenseKey, hwid, deviceName: "MacBook Pro" });
await tertaut.licensing.validate({ licenseKey, hardwareId: hwid });
await tertaut.licensing.deactivate({ licenseKey, hwid });

// Floating license: perpanjang lease seat rolling via heartbeat
const { data } = await tertaut.licensing.activate({ licenseKey, hwid });
await tertaut.licensing.heartbeat({
  licenseKey,
  hwid,
  leaseKey: data.leaseKey, // dari respon activate
});

// Verifikasi offline (Ed25519, Web Crypto) — tanpa memanggil server
const result = await tertaut.licensing.verifyOfflineToken(offlineToken);
if (result.valid) console.log(result.claims);
```

> Verifikasi offline tidak mengetahui revoke terbaru. Lakukan `validate()` online secara berkala.

### Kredit

```ts
await tertaut.credits.balance({ licenseKey, hwid });
await tertaut.credits.consume({ licenseKey, hwid, amount: 10, reason: "10x generate" });
const { entries } = await tertaut.credits.history({ licenseKey, limit: 20 });
```

Kredit ditambahkan otomatis saat checkout membawa `grantCredits`. Pemakaian bersifat atomik (tidak bisa melewati saldo) dan mendukung `reference` untuk idempotensi.

### AI Proxy

```ts
const reply = await tertaut.aiProxy.chat({
  licenseKey,
  messages: [{ role: "user", content: "Ringkas dokumen ini" }],
});

for await (const chunk of await tertaut.aiProxy.chatStream({ licenseKey, prompt: "Halo" })) {
  process.stdout.write(chunk.text);
}
```

## API

| Anggota                                                      | Deskripsi                                                                                 |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| `new Tertaut({ apiKey, baseUrl, appId })`                    | Inisialisasi klien (mendukung publishable `tt_live_`/`tt_test_` atau secret `tt_secret_`) |
| `checkout(options)`                                          | Buat sesi checkout MoR (auto redirect di browser, dukung kupon & payment rail)            |
| `getPaymentStatus(txId, ticket?)`                            | Cek status transaksi pembayaran MoR dengan atau tanpa HMAC ticket                         |
| `licensing.check(options)`                                   | Smart dual-mode check (online validate dengan graceful offline token fallback)            |
| `licensing.startHeartbeatSession(options)`                   | Background session manager untuk floating rolling seat lease                              |
| `licensing.activate / validate / verify / deactivate`        | Siklus hidup lisensi & seat binding                                                       |
| `licensing.verifyApiKey(apiKey)`                             | Verifikasi customer API key auto-provisioning yang diterbitkan saat checkout              |
| `licensing.entitlements({ licenseKey, hwid?, appVersion? })` | Ambil feature flags, entitlements & helper methods                                        |
| `licensing.heartbeat({ licenseKey, hwid, leaseKey })`        | Perpanjang lease floating (rolling seat) manual                                           |
| `licensing.getJwks()`                                        | Ambil public key Ed25519 JWKS                                                             |
| `licensing.verifyOfflineToken(token, options?)`              | Verifikasi token offline Ed25519 secara lokal                                             |
| `credits.balance / consume / history`                        | Saldo & pemakaian kredit lisensi (idempoten)                                              |
| `credits.reportUsage(options)`                               | Kirim event konsumsi kredit terukur (metered usage event)                                 |
| `credits.getUsage(licenseKey)`                               | Ambil ringkasan penggunaan metered billing untuk lisensi                                  |
| `aiProxy.chat / chatStream`                                  | AI gateway (non-streaming & SSE streaming relay)                                          |
| `aiProxy.quotaStatus(options)`                               | Periksa kuota harian & sisa limit token AI Proxy                                          |
| `s2s.*`                                                      | Server-to-Server Admin API (apps, licenses, seats, webhooks, credits)                     |
| `Tertaut.verifyWebhookSignature(rawBody, sig, secret)`       | Verifikasi HMAC-SHA256 webhook berbasis Web Crypto                                        |

### Contoh Penggunaan Fitur Komprehensif

#### 1. Smart License Check (Dual Mode)

```ts
const result = await tertaut.licensing.check({
  licenseKey: "TT-XXXX-XXXX-XXXX",
  hwid: "device_hardware_id",
  offlineToken: cachedOfflineToken,
  allowOfflineFallback: true,
});

if (result.valid) {
  // Entitlements helper methods
  if (result.hasFeature("ai-assistant")) {
    const maxFiles = result.getFeature("max_files", 5);
    console.log("Active with max files:", maxFiles);
  }
}
```

#### 2. Automatic Floating Heartbeat Session

```ts
const session = tertaut.licensing.startHeartbeatSession({
  licenseKey: "TT-XXXX-XXXX-XXXX",
  hwid: "device_hardware_id",
  leaseKey: activateData.leaseKey,
  intervalSeconds: 60,
  onSuccess: (res) => console.log("Lease renewed:", res.expiresAt),
  onLeaseExpired: (err) => console.error("Seat reclaimed or expired:", err),
  onError: (err) => console.warn("Heartbeat network error:", err),
});

// Stop session on app close
session.stop();
```

#### 3. S2S Admin API (Backend Secret Key)

```ts
const admin = new Tertaut({
  apiKey: "tt_secret_xxxx",
  baseUrl: "https://tertaut.com",
});

// Issue license
const { license } = await admin.s2s.licenses.issue({
  appId: "app_xxx",
  customerEmail: "user@example.com",
  grantDays: 365,
});

// Verify incoming webhook
const isValid = await Tertaut.verifyWebhookSignature(
  rawBodyString,
  headers["x-tertaut-signature"],
  webhookSecret
);
```

## Arsitektur Modular

SDK diorganisir secara modular di bawah `src/` dengan standar Web Crypto zero-dependency (< 15KB bundle):

- `types.ts`: Definisi antarmuka TypeScript lengkap.
- `errors.ts`: Typed custom error classes (`TertautError`, `LicenseExpiredError`, `HeartbeatLeaseError`, dll).
- `modules/checkout.ts`: MoR checkout engine.
- `modules/licensing.ts`: Universal licensing & floating lease manager.
- `modules/credits.ts`: Saldo & ledger pemakaian kredit.
- `modules/aiproxy.ts`: Shield gateway & SSE streaming parser.
- `modules/s2s.ts`: Server-to-Server Admin API & Webhooks.
- `utils/crypto.ts`: Web Crypto Ed25519 & HMAC-SHA256.
- `utils/semver.ts`: Semver version comparison.

## Lisensi

UNLICENSED — © tertaut.com. All rights reserved.
