# SDK @tertaut/sdk

SDK ringan (**~16 KB minified, ~5 KB gzipped, zero dependency**, `fetch`-based) untuk
tertaut.com: checkout MoR, universal licensing, metered credits, dan AI proxy.

Berjalan di **Browser**, **Chrome Extension**, **Desktop (Tauri/Electron)**, **Node.js / Bun**, dan **React Native**.

> Untuk API Server-to-Server lewat HTTP langsung (tanpa SDK), lihat **[Server-to-Server API](/server-to-server)**.

---

## Instalasi

```bash
npm install @tertaut/sdk
# bun add @tertaut/sdk
# pnpm add @tertaut/sdk
```

## Inisialisasi

```ts
import { Tertaut } from "@tertaut/sdk";

const tertaut = new Tertaut({
  apiKey: "tt_live_xxx", // publishable: tt_live_ (produksi) / tt_test_ (sandbox)
  baseUrl: "https://tertaut.com",
  appId: "app_xxx",
});
```

| Properti    | Wajib | Catatan                                                            |
| ----------- | ----- | ------------------------------------------------------------------ |
| `apiKey`    | ✅    | `tt_live_…`, `tt_test_…` (publishable) atau `tt_secret_…` (server) |
| `baseUrl`   | ✅    | `http(s)://…`; trailing `/` dibuang otomatis                       |
| `appId`     | ✅*   | Wajib kecuali `apiKey` berupa `tt_secret_…`                        |
| `timeoutMs` | —     | Default `15000`                                                    |

`tertaut.environment` diturunkan dari prefiks `apiKey`:
`tt_live_` → `"production"`, `tt_test_` → `"sandbox"`, `tt_secret_` → `"server"`.

### Environment client

SDK **tidak** membaca variabel environment secara otomatis — ketiga nilai wajib
di-inject eksplisit ke konstruktor. Penjelasan & contoh per framework (Vite,
Next.js, SvelteKit, Node/Bun) ada di **[Environment Client](/environment)**.

**Keamanan:** ketiga nilai ini bersifat publik dan aman di-commit ke frontend
(pola publishable key). **Jangan pernah** menaruh `tt_secret_…` di env browser —
secret hanya untuk backend dan endpoint `/api/v1/s2s`.

---

## Penanganan error

Semua metode melempar subclass `TertautError` ketika server merespons HTTP
`>= 400`, sehingga Anda bisa bercabang via `instanceof`:

```ts
import {
  TertautError,
  TertautRateLimitError,
  LicenseExpiredError,
  LicenseRevokedError,
  SeatLimitExceededError,
  HeartbeatLeaseError,
  InsufficientCreditsError,
  VersionFloorError,
} from "@tertaut/sdk";

try {
  await tertaut.licensing.activate({ licenseKey, hwid });
} catch (err) {
  if (err instanceof SeatLimitExceededError) {
    // Semua perangkat sudah memakai kuota seat — tunggu lease lain kadaluwarsa
  } else if (err instanceof VersionFloorError) {
    console.warn("Upgrade ke versi", err.details.minVersion);
  } else if (err instanceof TertautRateLimitError) {
    await sleep((err.retryAfter ?? 60) * 1000);
  } else if (err instanceof TertautError) {
    console.error(err.code, err.status, err.message);
  }
}
```

Semua kelas menurunkan `TertautError` yang punya `code`, `status`, dan `details`
(payload respons mentah).

> **Penting:** respons `2xx` yang berisi `valid:false` atau `success:false`
> **tidak** dilempar — itu jawaban bisnis yang sah (mis. perangkat belum
> diaktivasi), bukan kegagalan transport. Periksa `result.valid` seperti biasa.

### Tabel pemetaan error

| Kode dari server                                                                                                                                                                                                                                                                   | Kelas SDK                  | HTTP   |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- | ------ |
| `TOKEN_EXPIRED`, `LICENSE_EXPIRED`, `EXPIRED`                                                                                                                                                                                                                                      | `LicenseExpiredError`      | 403    |
| `TOKEN_REVOKED`, `LICENSE_REVOKED`, `REVOKED`                                                                                                                                                                                                                                      | `LicenseRevokedError`      | 403    |
| `SEAT_FULL`                                                                                                                                                                                                                                                                        | `SeatLimitExceededError`   | 403    |
| `LEASE_MISMATCH` (heartbeat), `LEASE_STALE` (verify)                                                                                                                                                                                                                               | `HeartbeatLeaseError`      | 409    |
| `INSUFFICIENT_CREDITS`                                                                                                                                                                                                                                                             | `InsufficientCreditsError` | 402    |
| `APP_VERSION_TOO_OLD`                                                                                                                                                                                                                                                              | `VersionFloorError`        | 403    |
| `RATE_LIMITED`, `RATE_LIMIT_EXCEEDED`, `DAILY_TOKEN_LIMIT_EXCEEDED`                                                                                                                                                                                                                | `TertautRateLimitError`    | 429    |
| `LICENSE_NOT_FOUND`, `APP_MISMATCH`, `HARDWARE_MISMATCH`, `DEVICE_NOT_ACTIVATED`, `PLATFORM_MISMATCH`, `HWID_REQUIRED`, `COUPON_EXHAUSTED`, `APP_SUSPENDED`, `BUILDER_SUSPENDED`, `AI_KILL_SWITCH_ACTIVE`, `BUDGET_LIMIT_EXCEEDED`, `UPSTREAM_AI_ERROR`, `AI_PROXY_UNAVAILABLE`, … | `TertautError`             | varies |

> Catatan: `LEASE_EXPIRED` dan `LEASE_INVALID` **tidak pernah** dikirim server
> sebagai kode respons. Kode lease yang nyata adalah `LEASE_MISMATCH` dan
> `LEASE_STALE`.

### Rate limit

Dihitung per IP dengan fixed window. exceeded → HTTP `429` + `TertautRateLimitError`.

| Endpoint                               | Batas                                                |
| -------------------------------------- | ---------------------------------------------------- |
| `POST /licensing/activate`             | 60 / menit                                           |
| `POST /licensing/validate`             | 120 / menit                                          |
| `POST /licensing/verify`               | 120 / menit                                          |
| `POST /licensing/deactivate`           | 30 / menit                                           |
| `POST /licensing/heartbeat`            | 120 / menit                                          |
| `POST /licensing/verify-offline-token` | 120 / menit                                          |
| `POST /licensing/credits/balance`      | 120 / menit                                          |
| `POST /licensing/credits/consume`      | 120 / menit                                          |
| `POST /licensing/credits/history`      | 60 / menit                                           |
| `POST /checkout/session`               | 60 / menit                                           |
| `GET /checkout/status/:txId`           | 120 / menit                                          |
| `POST /ai/chat`                        | `maxRequestsPerMin` per lisensi (default 15 / menit) |

> Validasi lisensi yang dilakukan setiap heartbeat **harus** tetap di bawah 120/menit.
> Pada interval 60 detik Anda aman dengan margin jauh.

---

## Checkout (Merchant of Record)

```ts
const { checkoutUrl, transactionId, ticket } = await tertaut.checkout({
  amount: 49000,
  customerEmail: "pembeli@example.com",
  redirectUrl: "https://app.example.com/thanks",
});
// browser → redirect otomatis ke halaman bayar
```

| Opsi                                               | Tipe                                                                                                              |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `customerEmail`                                    | **wajib** (string)                                                                                                |
| `amount`                                           | number — opsional; harga produk tetap otoritatif                                                                  |
| `buyerEmail`                                       | string — alias `customerEmail`                                                                                    |
| `appSlug` / `slug`                                 | string — alternatif bila `appId` tidak dikonfigurasi                                                              |
| `grantDays`                                        | number (default `30`)                                                                                             |
| `redirectUrl`                                      | string                                                                                                            |
| `couponCode`                                       | string                                                                                                            |
| `customAmount`                                     | number — hanya untuk produk harga bebas                                                                           |
| `paymentGateway`                                   | string                                                                                                            |
| `paymentRail`                                      | `"qris" \| "va" \| "ewallet" \| "card" \| "retail"` — ketersediaan bergantung gateway aktif, lihat tabel di bawah |
| `preferredPaymentChannel`                          | string — alias `paymentRail`                                                                                      |
| `vaBank`, `bank`, `ewalletChannel`, `retailOutlet` | string                                                                                                            |
| `startTrial` / `isTrial`                           | boolean — free trial bila produk punya periode                                                                    |

**Simpan `ticket`.** Ticket HMAC berumur 45 menit dan dibutuhkan untuk polling
status pembayaran serta mengambil faktur.

### Ketersediaan `paymentRail` per gateway

Rail **tidak seragam antar gateway**. Mengirim rail yang tidak didukung gateway
aktif akan membuat gateway tersebut menolak permintaan.

| Rail      | DANA             | Xendit | XenithPay |
| --------- | ---------------- | ------ | --------- |
| `qris`    | ✅               | ✅     | ✅        |
| `va`      | ✅               | ✅     | ✅        |
| `ewallet` | ✅               | ✅     | ✅        |
| `card`    | ❌               | ✅     | ✅        |
| `retail`  | ❌               | ✅     | ✅        |
| `balance` | ✅ (khusus DANA) | ❌     | ❌        |

Bila `paymentRail` tidak diisi, server memakai rail default dari produk. Untuk
kode yang harus jalan di semua gateway, lakukan branch berdasarkan
`paymentGateway` pada respons sesi checkout daripada mengasumsikan satu rail
berlaku universal.

> **Tentang kredit gratis:** nilai kredit yang diberikan saat checkout
> sepenuhnya ditentukan produk (`meteringConfig.freeAllowance`) di dashboard.
> Nilai kiriman klien diabaikan oleh server demi mencegah pencetakan kredit
> gratis, jadi SDK tidak pernah mengirim parameter kredit.

### Status pembayaran

```ts
const status = await tertaut.getPaymentStatus(transactionId, ticket);
// tanpa ticket yang valid, server hanya mengembalikan ringkasan minimal
// { success, transactionId, paymentStatus }
```

### Free trial

Bila produk punya `trialPeriodDays > 0` dan Anda mengirim `startTrial: true`, server
menerbitkan lisensi langsung tanpa pembayaran:

```ts
const res = await tertaut.checkout({ customerEmail, startTrial: true });
if (res.isTrial) console.log("Lisensi:", res.licenseKey, "sampai", res.expiresAt);
```

---

## Lisensi

| Metode                               | Request ke                                    | Opsi                                                                 |
| ------------------------------------ | --------------------------------------------- | -------------------------------------------------------------------- |
| `licensing.activate`                 | `POST /api/v1/licensing/activate`             | `{ licenseKey, hwid, deviceName? }` — `appId` dari klien             |
| `licensing.validate`                 | `POST /api/v1/licensing/validate`             | `{ licenseKey, hardwareId?, appVersion?, platform? }`                |
| `licensing.verify`                   | `POST /api/v1/licensing/verify`               | `{ licenseKey, hwid?, appVersion? }`                                 |
| `licensing.entitlements`             | `POST /api/v1/licensing/verify`               | `{ licenseKey, hwid?, appVersion? }` → feature flags + version floor |
| `licensing.deactivate`               | `POST /api/v1/licensing/deactivate`           | `{ licenseKey, hwid }`                                               |
| `licensing.heartbeat`                | `POST /api/v1/licensing/heartbeat`            | `{ licenseKey, hwid, leaseKey, deviceName? }`                        |
| `licensing.verifyApiKey`             | `POST /api/v1/licensing/api-key/verify`       | `(apiKey)` — customer key `tt_cust_…`                                |
| `licensing.verifyOfflineToken`       | lokal, tanpa request                          | `(token, { publicKeyJwk?, jwksUrl?, appVersion? })`                  |
| `licensing.verifyOfflineTokenOnline` | `POST /api/v1/licensing/verify-offline-token` | `(token)` — cek revoke & status terkini                              |
| `licensing.getJwks`                  | `GET /.well-known/jwks.json`                  | —                                                                    |

### Aktivasi & validasi

```ts
const { success, data } = await tertaut.licensing.activate({
  licenseKey: "TT-...",
  hwid: "device-xxxx",
  deviceName: "MacBook Pro",
});
// data.licenseToken  → token offline Ed25519
// data.seatsUsed / data.maxSeats → pemakaian seat
// data.leaseKey     → hanya untuk lisensi floating

const check = await tertaut.licensing.validate({ licenseKey, hardwareId: hwid });
// → { valid, status, expiresAt, offlineGraceToken, entitlements, licenseVersion }

const v = await tertaut.licensing.verify({ licenseKey, hwid });
// → { valid, status, gracePeriodRemainingDays, credits, entitlements, licenseVersion }
//    `credits` adalah angka (saldo), bukan objek.

await tertaut.licensing.deactivate({ licenseKey, hwid });
```

> **Simpan `offlineGraceToken` hasil `validate()`.** Setiap validasi online
> melakukan rotasi token; token sebelumnya otomatis masuk JTI denylist. Kalau
> Anda menyimpan token lama, verifikasi offline berikutnya akan gagal.

### Entitlements & version floor

```ts
const ent = await tertaut.licensing.entitlements({ licenseKey, hwid, appVersion: "2.3.0" });

if (ent.valid) {
  if (ent.hasFeature("ai-4k")) enable4K();
  const maxUsers = ent.getFeature("max_users", 5);
  console.log(maxUsers, ent.licenseVersion);
}
```

Builder dapat menetapkan `min_version` per lisensi. Bila `appVersion` klien lebih
lama, server membalas `403` + `APP_VERSION_TOO_OLD` (dilempar sebagai
`VersionFloorError`, `err.details.minVersion` berisi versi minimum) — baik saat
validasi online maupun saat verifikasi token offline secara lokal.

### Verifikasi token offline

```ts
// Lokal — Ed25519, tanpa internet, tapi tidak tahu revoke terbaru
const offline = await tertaut.licensing.verifyOfflineToken(data.licenseToken, {
  appVersion: "2.3.0", // opsional: taremi bila di bawah version floor
});
if (offline.valid) console.log(offline.claims);

// Online — cek JTI denylist + status lisensi terkini di server
const fresh = await tertaut.licensing.verifyOfflineTokenOnline(data.licenseToken);
if (!fresh.valid) {
  // token sudah dicabut / kedaluwarsa / lisensi tidak ada
}
```

Public key diambil otomatis dari `{baseUrl}/.well-known/jwks.json`; cache sendiri
lalu kirim lewat `publicKeyJwk` untuk Hemat request.

### Customer API key

Saat checkout, server menerbitkan customer API key (`tt_cust_…`) secara
otomatis. Verifikasinya:

```ts
const res = await tertaut.licensing.verifyApiKey("tt_cust_xxx");
// → { success, valid, status, appId, customerEmail, expiresAt, credits }
```

### Smart dual-mode check

```ts
const result = await tertaut.licensing.check({
  licenseKey,
  hwid,
  appVersion: "2.3.0",
  offlineToken: cachedToken, // dipakai kalau server tidak dapat dihubungi
  allowOfflineFallback: true, // default true
});

if (result.valid) {
  console.log(result.source); // "online" | "offline"
  if (result.hasFeature("ai-assistant")) enableAssistant();
}
```

Bila server tidak dapat dihubungi dan tidak ada `offlineToken`, hasilnya
`valid: false` dengan `reason: "SERVER_UNREACHABLE_NO_OFFLINE_TOKEN"` — bukan
throw.

### Floating license (lease & heartbeat)

Lisensi floating memakai **seat rolling**: `activate` menyewa seat dengan lease
TTL. Klien **wajib** mengirim `heartbeat` berkala agar lease tetap hidup — jika
berhenti, lease lepas dan slot dipakai perangkat lain.

Server mengembalikan konfigurasi lease pada respons `activate`, jadi Anda tidak
perlu menebak intervalnya:

```ts
const { data } = await tertaut.licensing.activate({ licenseKey, hwid, deviceName });

if (data.floating) {
  console.log("Lease TTL:", data.leaseTtlSeconds, "detik");
  console.log("Heartbeat setiap:", data.heartbeatIntervalSeconds, "detik");

  const session = tertaut.licensing.startHeartbeatSession({
    licenseKey,
    hwid,
    leaseKey: data.leaseKey!,
    intervalSeconds: data.heartbeatIntervalSeconds,
    onSuccess: (res) => console.log("Lease berlaku sampai", res.expiresAt),
    onLeaseExpired: (err) => showReactivationPrompt(),
    onError: (err) => console.warn("Heartbeat bermasalah:", err.message),
  });

  window.addEventListener("beforeunload", () => session.stop());
}
```

Atau manual:

```ts
const beat = await tertaut.licensing.heartbeat({ licenseKey, hwid, leaseKey });
// → { success, floating, leaseKey, leaseExpiresAt, lastHeartbeatAt, seatsUsed, status }
// SDK menormalisasi `leaseExpiresAt` juga ke `expiresAt` demi kompatibilitas.
```

- `409` + `reason: "LEASE_MISMATCH"` → lease sudah tidak valid untuk perangkat ini.
  `startHeartbeatSession` otomatis memanggil `onLeaseExpired` lalu menghentikan loop.
- `LEASE_STALE` pada `verify`/`validate` → lease lama masih tercatat tapi kedaluwarsa.
- Heartbeat pada lisensi **non-floating** diterima (`floating: false`) tanpa mengelola lease.

---

## Metered Credits

| Metode                | Request                                  | Opsi                                                                   |
| --------------------- | ---------------------------------------- | ---------------------------------------------------------------------- |
| `credits.balance`     | `POST /api/v1/licensing/credits/balance` | `{ licenseKey, hwid? }`                                                |
| `credits.consume`     | `POST /api/v1/licensing/credits/consume` | `{ licenseKey, hwid, amount, reason?, reference? }`                    |
| `credits.history`     | `POST /api/v1/licensing/credits/history` | `{ licenseKey, hwid?, limit? }`                                        |
| `credits.reportUsage` | `POST /api/v1/metering/events`           | `{ licenseKey, eventName, units?, idempotencyKey?, metadata?, hwid? }` |
| `credits.getUsage`    | `GET /api/v1/metering/usage/:licenseKey` | `(licenseKey)`                                                         |

```ts
await tertaut.credits.balance({ licenseKey, hwid });

const { balance, consumed } = await tertaut.credits.consume({
  licenseKey,
  hwid,
  amount: 10,
  reason: "10x generate",
  reference: "job-00123", // idempoten: dipanggil ulang ≠ potong dua kali
});

const { entries } = await tertaut.credits.history({ licenseKey, limit: 20 });
```

Konsumsi bersifat atomik (tidak bisa melewati saldo) dan `reference` menjamin
idempotensi. Saldo tidak akan pernah negatif — permintaan yang melebihi saldo
ditolak `402` + `InsufficientCreditsError`.

> `reference` **wajib unik per lisensi**. Indeks uniknya `(licenseId, reference)`,
> jadi memakai `reference` yang sama untuk operasi berbeda akan ditolak.

### Metered usage (billing per pemakaian)

```ts
await tertaut.credits.reportUsage({
  licenseKey,
  hwid, // perangkat yang sudah diaktivasi
  eventName: "pdf_export",
  units: 3,
  idempotencyKey: "req-9f2a",
  metadata: { pages: 12 },
});

const usage = await tertaut.credits.getUsage(licenseKey);
```

SDK mengirim `x-api-key` aplikasi secara otomatis sebagai bukti kepemilikan.

---

## AI Proxy

| Metode                | Request                       |
| --------------------- | ----------------------------- |
| `aiProxy.chat`        | `POST /api/v1/ai/chat`        |
| `aiProxy.chatStream`  | `POST /api/v1/ai/chat` (SSE)  |
| `aiProxy.quotaStatus` | `GET /api/v1/ai/quota-status` |

```ts
const reply = await tertaut.aiProxy.chat({
  licenseKey: "TT-...", // atau licenseToken
  prompt: "Ringkas dokumen ini",
});
// → { success, text, model, provider, usage: {...}, latencyMs }

for await (const chunk of await tertaut.aiProxy.chatStream({
  licenseKey: "TT-...",
  prompt: "Halo",
})) {
  process.stdout.write(chunk.text);
}

const quota = await tertaut.aiProxy.quotaStatus({ licenseKey: "TT-..." });
// → { success, data: { dailyTokensUsed, dailyTokenLimit, remainingTokens, resetInSeconds } }
```

### `modelAlias` — read the room carefully

`modelAlias` **bukan** nama model AI, melainkan **kunci lookup konfigurasi** milik
builder di dashboard. Nilai ini menentukan guardrail yang berlaku:

- `maxRequestsPerMin` (rate limit)
- `dailyTokenLimit` (kuota token harian)
- `targetModelName` (model yang dituju)

Karena itu default SDK adalah `"default"` — nilai yang sama dipakai server.
Jika Anda mengirim alias yang tidak terdaftar, konfigurasi builder **tidak akan
ditemukan dan guardrail-nya dilewati** (jatuh ke default server), bukan error.

```ts
// ✅ Ikut konfigurasi builder
await tertaut.aiProxy.chat({ licenseKey, prompt, modelAlias: "fastmail-summary" });

// ✅ Alias default — guardrail default aplikasi diterapkan
await tertaut.aiProxy.chat({ licenseKey, prompt });
```

---

## Server-to-Server (backend)

Semua metode di bawah memakai `Authorization: Bearer tt_secret_…` dan **hanya
paling aman dipanggil dari backend**.

```ts
const admin = new Tertaut({
  apiKey: "tt_secret_xxxx",
  baseUrl: "https://tertaut.com",
  // appId opsional; dipakai sebagai nilai default bila tidak diberikan per-request
});
```

| Anggota                          | Endpoint                                      |
| -------------------------------- | --------------------------------------------- |
| `s2s.info()`                     | `GET /api/v1/s2s`                             |
| `s2s.apps.list(mode?)`           | `GET /api/v1/s2s/apps`                        |
| `s2s.apps.get(appId)`            | `GET /api/v1/s2s/apps/:appId`                 |
| `s2s.licenses.list(filter?)`     | `GET /api/v1/s2s/licenses`                    |
| `s2s.licenses.issue(options)`    | `POST /api/v1/s2s/licenses/issue`             |
| `s2s.licenses.issueBatch(opts)`  | `POST /api/v1/s2s/licenses/issue-batch`       |
| `s2s.licenses.revoke(opts)`      | `POST /api/v1/s2s/licenses/revoke`            |
| `s2s.licenses.revokeBatch(opts)` | `POST /api/v1/s2s/licenses/revoke-batch`      |
| `s2s.licenses.seats(licenseKey)` | `GET /api/v1/s2s/licenses/seats`              |
| `s2s.licenses.releaseSeat(opts)` | `POST /api/v1/s2s/licenses/seat/release`      |
| `s2s.licenses.recover(key)`      | `POST /api/v1/s2s/licenses/recover`           |
| `s2s.licenses.transfer(opts)`    | `POST /api/v1/s2s/licenses/transfer`          |
| `s2s.licenses.events(filter?)`   | `GET /api/v1/s2s/licenses/events`             |
| `s2s.credits.balance(key)`       | `GET /api/v1/s2s/credits/balance`             |
| `s2s.credits.consume(opts)`      | `POST /api/v1/s2s/credits/consume`            |
| `s2s.webhooks.list()`            | `GET /api/v1/s2s/webhooks`                    |
| `s2s.webhooks.create(opts)`      | `POST /api/v1/s2s/webhooks`                   |
| `s2s.webhooks.update(id, patch)` | `PATCH /api/v1/s2s/webhooks/:id`              |
| `s2s.webhooks.delete(id)`        | `DELETE /api/v1/s2s/webhooks/:id`             |
| `s2s.webhooks.rotateSecret(id)`  | `POST /api/v1/s2s/webhooks/:id/rotate-secret` |
| `s2s.webhooks.test(id)`          | `POST /api/v1/s2s/webhooks/:id/test`          |

```ts
const { license } = await admin.s2s.licenses.issue({
  appId: "app_xxx",
  customerEmail: "user@example.com",
  grantDays: 365,
  grantCredits: 100,
  features: { "ai-4k": true, max_users: 50 },
});

const batch = await admin.s2s.licenses.issueBatch({
  appId: "app_xxx",
  items: [{ customerEmail: "a@x.com" }, { customerEmail: "b@x.com", grantDays: 90 }],
});
// → { success, issued, failed, licenses, errors }   (maks 200 item per request)
```

---

## Webhook

Verifikasi signature HMAC-SHA256 secara universal (Web Crypto, tanpa dependensi):

```ts
const isValid = await Tertaut.verifyWebhookSignature(
  rawBodyString, // body mentah, apa adanya sebelum di-parse
  headers["x-tertaut-signature"], // "hmac-sha256=<hex>"
  webhookSecret
);
```

Perbandingan dilakukan secara constant-time. Prefix `hmac-sha256=` opsional.
Kesalahan konfigurasi secret akan menghasilkan `false`, bukan exception.

Event yang tersedia: `license.issued`, `license.activated`, `license.deactivated`,
`license.seat_full`, `license.revoked`, `license.expired`, `license.renewed`,
`license.transferred`, `license.unbound`, `credits.insufficient`.

---

## Ringkasan modul

| Anggota                           | Modul                                                  |
| --------------------------------- | ------------------------------------------------------ |
| `checkout(options)`               | Hosted checkout MoR                                    |
| `getPaymentStatus(txId, ticket?)` | Status pembayaran MoR                                  |
| `licensing.*`                     | Siklus hidup lisensi, seat, lease & verifikasi offline |
| `credits.*`                       | Saldo, pemakaian idempoten, riwayat, metered usage     |
| `aiProxy.*`                       | AI gateway streaming, non-streaming & kuota            |
| `s2s.*`                           | Admin API backend (secret key)                         |
| `Tertaut.verifyWebhookSignature`  | Verifikasi HMAC webhook                                |
