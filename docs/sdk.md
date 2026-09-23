# SDK @tertaut/sdk

SDK ringan (< 15 KB, **zero dependency**, `fetch`-based) untuk tertaut.com: checkout MoR, universal licensing, metered credits, dan AI proxy.

Berjalan di **Browser**, **Chrome Extension**, **Desktop (Tauri/Electron)**, **Node.js / Bun**, dan **React Native**.

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
  apiKey: "tt_live_xxx", // tt_live_... = produksi, tt_test_... = sandbox
  baseUrl: "https://tertaut.com",
  appId: "app_xxx",
});
```

Tiga properti **wajib** (pola publishable-key, tanpa default tersembunyi). `environment` otomatis ditentukan dari prefiks `apiKey`.

## Checkout (Merchant of Record)

```ts
await tertaut.checkout({
  amount: 49000,
  grantDays: 30,
  customerEmail: "pembeli@example.com",
  redirectUrl: "https://app.example.com/thanks",
});
// browser → redirect otomatis ke halaman bayar (checkoutUrl)
```

## Lisensi

| Metode                         | Melakukan request ke                  | Opsi                                                                       |
| ------------------------------ | ------------------------------------- | -------------------------------------------------------------------------- |
| `licensing.activate`           | `POST /api/v1/licensing/activate`     | `{ licenseKey, hwid, deviceName? }` (appId diambil dari klien)             |
| `licensing.validate`           | `POST /api/v1/licensing/verify`       | `{ licenseKey, hardwareId? }`                                              |
| `licensing.verify`             | `POST /api/v1/licensing/verify`       | `{ licenseKey, hwid? }`                                                    |
| `licensing.deactivate`         | `POST /api/v1/licensing/deactivate`   | `{ licenseKey, hwid }`                                                     |
| `licensing.entitlements`       | `POST /api/v1/licensing/verify`       | `{ licenseKey, hwid?, appVersion? }` (ambil feature flags & version floor) |
| `licensing.heartbeat`          | `POST /api/v1/licensing/heartbeat`    | `{ licenseKey, hwid, leaseKey, deviceName? }` (floating license)           |
| `licensing.getJwks`            | `GET {baseUrl}/.well-known/jwks.json` | —                                                                          |
| `licensing.verifyOfflineToken` | lokal (Ed25519, tanpa request)        | `(token, options?)`                                                        |

```ts
const { success, data } = await tertaut.licensing.activate({
  licenseKey: "TT-...",
  hwid: "device-xxxx",
  deviceName: "MacBook Pro",
});

const check = await tertaut.licensing.validate({
  licenseKey: "TT-...",
  hardwareId: "device-xxxx",
}); // → { valid: true, status: "ACTIVE", gracePeriodRemainingDays, credits }

await tertaut.licensing.deactivate({ licenseKey: "TT-...", hwid: "device-xxxx" });

// Verifikasi offline — berlaku tanpa internet, tanpa server
const offline = await tertaut.licensing.verifyOfflineToken(data.licenseToken);
if (offline.valid) console.log(offline.claims);
```

### Floating License (lease & heartbeat)

Lisensi floating memakai **seat rolling**: `activate` menyewa seat dengan lease TTL (default 5 menit). Klien wajib mengirim `heartbeat` berkala (mis. tiap 60 detik) agar lease tetap hidup — jika berhenti, lease lepas dan slot bisa dipakai perangkat lain.

```ts
const { success, data } = await tertaut.licensing.activate({
  licenseKey: "TT-...",
  hwid: "device-xxxx",
  deviceName: "MacBook Pro",
});

// data.leaseKey — simpan untuk heartbeat (hapus saat lease berakhir/reset)
const leaseKey = data.leaseKey;

// Kirim per interval heartbeatIntervalSeconds (konfigurasi app)
const beat = await tertaut.licensing.heartbeat({
  licenseKey: "TT-...",
  hwid: "device-xxxx",
  leaseKey,
});
// → { success: true, expiresAt, leaseTtlSeconds, gracePeriodRemainingDays }
```

- Salah/berubah `leaseKey` → `403 LEASE_INVALID`; lease telah lepas/kedaluwarsa → `409 LEASE_EXPIRED`.
- Lease tidak berlaku untuk lisensi non-floating — hanya `activate`/`validate` tetap.
- Interval heartbeat tergantung konfigurasi app di dashboard (`leaseTtlSeconds` & `heartbeatIntervalSeconds`).

> Token offline tidak kehilangan status revoke terbaru — panggil `validate()` online secara berkala.

## Metered Credits

| Metode            | Request                                  | Opsi                                                |
| ----------------- | ---------------------------------------- | --------------------------------------------------- |
| `credits.balance` | `POST /api/v1/licensing/credits/balance` | `{ licenseKey, hwid? }`                             |
| `credits.consume` | `POST /api/v1/licensing/credits/consume` | `{ licenseKey, hwid, amount, reason?, reference? }` |
| `credits.history` | `POST /api/v1/licensing/credits/history` | `{ licenseKey, hwid?, limit? }`                     |

```ts
await tertaut.credits.balance({ licenseKey: "TT-..." });

const { success, balance, consumed } = await tertaut.credits.consume({
  licenseKey: "TT-...",
  hwid: "device-xxxx",
  amount: 10,
  reason: "10x generate",
  reference: "job-00123", // idempoten: dipanggil ulang ≠ potong dua kali
});

const { entries } = await tertaut.credits.history({ licenseKey: "TT-...", limit: 20 });
```

## AI Proxy

| Metode               | Request                      |
| -------------------- | ---------------------------- |
| `aiProxy.chat`       | `POST /api/v1/ai/chat`       |
| `aiProxy.chatStream` | `POST /api/v1/ai/chat` (SSE) |

```ts
const reply = await tertaut.aiProxy.chat({
  licenseKey: "TT-...", // atau licenseToken
  prompt: "Ringkas dokumen ini",
});

for await (const chunk of await tertaut.aiProxy.chatStream({
  licenseKey: "TT-...",
  prompt: "Halo",
})) {
  process.stdout.write(chunk.text);
}
```

## Konfigurasi Client-Side (Env aplikasi client)

SDK **tidak otomatis** membaca variabel environment—ketiga nilai di-inject explisit ke konstruktor. Peran aplikasi Anda: menyimpan nilai tersebut di env sisi client dan meneruskannya.

> Dokumen lengkap & contoh per framework ada di halaman **[Environment Client](/environment)**.

### Tiga nilai wajib

| Nilai     | Contoh                | Sifat      | Asal                                                   |
| --------- | --------------------- | ---------- | ------------------------------------------------------ |
| `apiKey`  | `tt_live_...`         | **Publik** | Publishable key aplikasi (dashboard → Aplikasi / Docs) |
| `appId`   | `app_...`             | Publik     | ID aplikasi (dashboard)                                |
| `baseUrl` | `https://tertaut.com` | Publik     | Server tempat SDK memanggil API                        |

- Format `baseUrl`: harus `http(s)://...` (diverifikasi di konstruktor); trailing `/` otomatis dibuang. Ganti ke `http://localhost:3001` saat development lokal.
- `environment` (production/sandbox) **diturunkan dari prefiks `apiKey`** — tidak ada env terpisah. Ingin staging/uji coba? Pakai key `tt_test_...` pada env yang sama.

### Contoh per framework

**Vite** — `.env`:

```sh
VITE_TERTAUT_API_KEY=tt_live_xxxxxxxxxxxxxxxx
VITE_TERTAUT_APP_ID=app_xxxx
VITE_TERTAUT_BASE_URL=https://tertaut.com
```

**Next.js** — `.env.local`:

```sh
NEXT_PUBLIC_TERTAUT_API_KEY=tt_live_xxxxxxxxxxxxxxxx
NEXT_PUBLIC_TERTAUT_APP_ID=app_xxxx
NEXT_PUBLIC_TERTAUT_BASE_URL=https://tertaut.com
```

**SvelteKit** — `.env` (prefiks `PUBLIC_`):

```sh
PUBLIC_TERTAUT_API_KEY=tt_live_xxxxxxxxxxxxxxxx
PUBLIC_TERTAUT_APP_ID=app_xxxx
PUBLIC_TERTAUT_BASE_URL=https://tertaut.com
```

**Node.js / Bun** (server-side, tidak perlu prefiks):

```sh
TERTAUT_API_KEY=tt_live_xxxxxxxxxxxxxxxx
TERTAUT_APP_ID=app_xxxx
TERTAUT_BASE_URL=https://tertaut.com
```

### Pemakaian

```ts
// Vite/vanilla
const tertaut = new Tertaut({
  apiKey: import.meta.env.VITE_TERTAUT_API_KEY,
  baseUrl: import.meta.env.VITE_TERTAUT_BASE_URL,
  appId: import.meta.env.VITE_TERTAUT_APP_ID,
});

// Next.js / React
const tertaut = new Tertaut({
  apiKey: process.env.NEXT_PUBLIC_TERTAUT_API_KEY!,
  baseUrl: process.env.NEXT_PUBLIC_TERTAUT_BASE_URL!,
  appId: process.env.NEXT_PUBLIC_TERTAUT_APP_ID!,
});
```

### Ketentuan Validasi Konstruktor

Konstruktor `new Tertaut(config)` melempar `Error` bila:

- `apiKey` tidak berformat `tt_live_...` atau `tt_test_...`
- `appId` kosong
- `baseUrl` bukan URL berprotokol `http(s)://...` yang valid

### Keamanan

- Ketiga nilai **sifatnya publik** — aman di commit frontend (pola publishable-key `tt_live_`/`tt_test_`).
- **JANGAN** taruh `tt_secret_...` (secret key) di env browser/frontend. Secret hanya untuk backend & `/api/v1/s2s`.

## Ringkasan Modul

| Anggota             | Modul                                     |
| ------------------- | ----------------------------------------- |
| `checkout(options)` | Hosted checkout MoR                       |
| `licensing.*`       | Siklus hidup lisensi & verifikasi offline |
| `credits.*`         | Saldo, pemakaian, riwayat kredit          |
| `aiProxy.*`         | AI gateway streaming & non-streaming      |
