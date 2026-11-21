# Getting Started

Panduan integrasi menyeluruh end-to-end menggunakan REST API dan SDK tertaut.com.

## 0. Lingkungan & Base URL

| Mode    | API Key       | Base URL (server)     |
| ------- | ------------- | --------------------- |
| Sandbox | `tt_test_...` | `https://tertaut.com` |
| Live    | `tt_live_...` | `https://tertaut.com` |

- Mode (`environment`) di SDK otomatis ditentukan dari **prefiks** API key — tidak memerlukan konfigurasi terpisah.
- Saat development lokal, set `baseUrl` ke server lokal Anda, misal `http://localhost:8081`.

## 1. Buat Aplikasi

Dashboard → **Aplikasi** → **Buat Aplikasi**: tentukan nama, slug (URL checkout publik `/pay/:slug`), strategi harga, dan mode.

> [!TIP] Memilih Strategi Harga (Tetap vs Dinamis)
>
> - **Harga Tetap (Fixed)**: Masukkan nominal resmi (misal `135000`). URL kasir publik `https://tertaut.com/pay/:slug` langsung dapat dipakai secara mandiri tanpa koding API.
> - **Harga Dinamis (S2S)**: Dipilih jika nominal ditentukan secara terprogram saat runtime. Tautan statis mentah `/pay/:slug` **tidak bisa dibuka langsung** (akan bernilai Rp 0 dan error `S2S_REQUIRED`). Anda harus menginisiasi sesi transaksi melalui `POST /api/v1/checkout/session` dengan Secret Key terlebih dahulu.

Setiap aplikasi memiliki **publishable API key** (`tt_live_...` / `tt_test_...`). Key ini **publik** — aman dipasang di frontend, dan bisa dirotasi kapan saja dari menu **Developer**.

## 2. Ambil Secret Key (untuk otomasi backend)

Dashboard → **Developer** → **Secret API Key**: buat atau rotasikan key `tt_secret_...`.

> **PERINGATAN KEAMANAN**: Jangan pernah meletakkan secret key di frontend atau commit ke repositori publik. Key ini khusus untuk server backend Anda.

## 3. Inisialisasi SDK

```ts
import { Tertaut } from "@tertaut/sdk";

const tertaut = new Tertaut({
  apiKey: "tt_live_xxxxxxxx",
  baseUrl: "https://tertaut.com",
  appId: "app_xxxx",
});
```

## 4. Terbitkan Lisensi

### Opsi A — Hosted Checkout (Otomatis Terbit Pasca Pembayaran)

`POST /api/v1/checkout/session` — buat sesi invoice dinamis lalu arahkan pembeli ke `checkoutUrl`.

```bash
curl -X POST https://tertaut.com/api/v1/checkout/session \
  -H "Content-Type: application/json" \
  -d '{
    "appId": "app_xxxx",
    "customerEmail": "pembeli@example.com",
    "amount": 49000,
    "couponCode": "HEMAT20",
    "redirectUrl": "https://app.example.com/selesai"
  }'
```

Respons sukses:

```json
{
  "success": true,
  "data": {
    "sessionId": "tx_sand_...",
    "ticket": "tx_sand_....poll_ticket_hmac",
    "paymentGateway": "xendit",
    "checkoutUrl": "https://tertaut.com/pay/fastmail-ai?ticket=poll_ticket_hmac",
    "hostedPayUrl": "https://tertaut.com/pay/fastmail-ai?ticket=poll_ticket_hmac",
    "actionUrl": "https://pay.ovo.id/...",
    "expiresAt": "2026-10-23T18:30:00.000Z",
    "isSandbox": false,
    "scenario": "API",
    "paymentRail": "qris",
    "qrDataUrl": "data:image/png;base64,..."
  },
  "transactionId": "tx_sand_...",
  "ticket": "tx_sand_....poll_ticket_hmac",
  "checkoutUrl": "https://tertaut.com/pay/fastmail-ai?ticket=poll_ticket_hmac",
  "hostedPayUrl": "https://tertaut.com/pay/fastmail-ai?ticket=poll_ticket_hmac",
  "paymentGateway": "xendit",
  "amount": 49000,
  "listPrice": 49000,
  "discountAmount": 0,
  "grantDays": 365
}
```

> **Catatan Keamanan & Parameter**:
>
> - Pembeli akan diarahkan ke antarmuka kasir kustom Tertaut (`/pay/:slug`), bukan ke vendor pihak ketiga.
> - `amount`: Harus sesuai dengan harga resmi aplikasi atau harga setelah diskon kupon valid (anti-tampering).
> - `grantDays`: Durasi lisensi ditentukan secara terpusat oleh konfigurasi produk (`deliveryConfig.licenseKey.expiresInDays`, default 365 hari) dan tidak dapat dimanipulasi dari sisi klien.
> - `appSlug` / `slug` dapat digunakan sebagai alternatif `appId`.
> - `paymentRail`: Nilai opsional (`qris` / `va` / `ewallet` / `retail`) untuk mengunci kanal pembayaran tertentu.

### Opsi B — Menggunakan SDK Klien `@tertaut/sdk`

```ts
import { Tertaut } from "@tertaut/sdk";

const tertaut = new Tertaut({
  apiKey: "tt_live_...",
  baseUrl: "https://tertaut.com",
  appId: "app_...",
});

// Validasi kupon sebelum bayar (opsional)
const coupon = await tertaut.validateCoupon({ couponCode: "HEMAT20", amount: 49000 });

// Buat sesi checkout (auto redirect ke halaman kasir resmi Tertaut)
const { checkoutUrl, transactionId, ticket } = await tertaut.checkout({
  customerEmail: "pembeli@example.com",
  couponCode: "HEMAT20",
  redirectUrl: "https://app.example.com/finish",
  autoRedirect: true,
});
```

### Opsi C — Server-to-Server (Penerbitan Programatik Tanpa Pembayaran)

Gunakan backend Anda untuk menerbitkan lisensi (trial, migrasi database, atau transaksi off-platform):

```bash
curl -X POST https://tertaut.com/api/v1/s2s/licenses/issue \
  -H "Authorization: Bearer tt_secret_..." \
  -H "Content-Type: application/json" \
  -d '{
    "appId": "app_xxxx",
    "customerEmail": "pembeli@example.com",
    "grantDays": 30,
    "maxSeats": 3,
    "platform": "web"
  }'
```

Respons: `{ "success": true, "license": { "licenseKey": "TT-...", "status": "ACTIVE", ... } }`. Email konfirmasi lisensi otomatis dikirim ke `customerEmail`.

### Menangani Webhook Pembayaran di Server Anda

Saat pembayaran selesai, Tertaut mengirim event `payment.success` dan `license.issued` ke URL webhook yang Anda daftarkan di dashboard (**Aplikasi** → **Webhook URL** atau via S2S API).

Verifikasi signature HMAC-SHA256 dari header `x-tertaut-signature` untuk memastikan callback resmi:

```ts
import { Tertaut } from "@tertaut/sdk";

// Verifikasi signature webhook universal (Web Crypto API)
const isValid = await Tertaut.verifyWebhookSignature(
  rawBodyString,
  req.headers["x-tertaut-signature"],
  process.env.TERTAUT_WEBHOOK_SECRET!
);

if (isValid) {
  const { event, data } = JSON.parse(rawBodyString);
  if (event === "payment.success") {
    console.log("Pembayaran terkonfirmasi:", data.transactionId, data.customerEmail);
  }
}
```

> Contoh lengkap implementasi webhook receiver di **Next.js, Express, Python (FastAPI), dan PHP (Laravel)** tersedia di [Resep Integrasi per Platform](/guide/integration-recipes).

## 5. Validasi Lisensi

### Via SDK

```ts
const res = await tertaut.licensing.validate({
  licenseKey: "TT-...",
  hardwareId: "device-xxxx", // opsional: verifikasi binding perangkat
});
// SDK otomatis memanggil POST /api/v1/licensing/verify { licenseKey, hwid }
```

### Via API Langsung

```bash
curl -X POST https://tertaut.com/api/v1/licensing/verify \
  -H "Content-Type: application/json" \
  -d '{ "licenseKey": "TT-...", "hwid": "device-xxxx" }'
```

Respons **valid**:

```json
{
  "valid": true,
  "status": "ACTIVE",
  "gracePeriodRemainingDays": 7,
  "entitlements": { "pro_tier": true },
  "licenseVersion": 1,
  "offlineGraceToken": "eyJhbGciOiJFZERT..."
}
```

Respons **tidak valid** (`valid: false` + `status`):

| `status`               | Keterangan & HTTP Code                                                              |
| ---------------------- | ----------------------------------------------------------------------------------- |
| `NOT_FOUND`            | Kunci lisensi tidak ditemukan di sistem (HTTP 404).                                 |
| `REVOKED`              | Lisensi telah dicabut oleh builder.                                                 |
| `EXPIRED`              | Masa aktif lisensi telah habis.                                                     |
| `DEVICE_NOT_ACTIVATED` | Perangkat belum diaktivasi untuk lisensi ini. Jalankan `/activate` terlebih dahulu. |
| `RATE_LIMITED`         | Terlalu banyak permintaan validasi (HTTP 429, batas 120 req/menit).                 |

> Catatan: Status `APP_MISMATCH` (HTTP 403) hanya dikembalikan oleh endpoint verifikasi berbasis aplikasi (`POST /api/v1/licensing/validate`) jika lisensi divalidasi pada aplikasi yang berbeda.

## 6. Aktivasi & Seat Perangkat

Bind perangkat → dapat **offline license token** (JWT yang bisa diverifikasi tanpa internet):

```bash
curl -X POST https://tertaut.com/api/v1/licensing/activate \
  -H "Content-Type: application/json" \
  -d '{ "licenseKey": "TT-...", "appId": "app_xxxx", "hwid": "device-xxxx", "deviceName": "MacBook Pro" }'
```

```json
{
  "success": true,
  "message": "Device activated successfully",
  "activated": true,
  "data": {
    "licenseToken": "eyJhbGciOiJFZERT...",
    "status": "ACTIVE",
    "expiresAt": "2026-10-18T00:00:00.000Z",
    "seatsUsed": 1,
    "maxSeats": 3,
    "floating": false,
    "entitlements": { "pro_tier": true },
    "licenseVersion": 1
  }
}
```

- Aktivasi **idempoten**: device yang sama diaktivasi ulang → `success: true` dengan token yang sama.
- Kuota seat dijaga: aktivasi ke-4 saat `maxSeats: 3` ditolak — lepas dulu via `POST /api/v1/licensing/deactivate` `{ licenseKey, hwid }`.

### Verifikasi offline (tanpa internet)

```ts
const res = await tertaut.licensing.verifyOfflineToken(token);
if (res.valid) console.log(res.claims);
// Memanfaatkan Web Crypto API bawaan untuk verifikasi Ed25519 lokal. Lakukan validasi online berkala.
```

## 7. Verifikasi Kunci API Pelanggan

Jika produk Anda mengaktifkan pengiriman API Access (`deliveryConfig.apiAccess.enabled`), pembeli akan menerima API key personal (`tt_cust_...`). Server Anda dapat memverifikasi kunci ini:

```bash
curl -X POST https://tertaut.com/api/v1/licensing/api-key/verify \
  -H "Content-Type: application/json" \
  -d '{ "apiKey": "tt_cust_xxxxxxxxxxxxxxxxxxxxxxxx" }'
```

Respons:

```json
{
  "valid": true,
  "status": "ACTIVE",
  "licenseKey": "TT-XXXX-XXXX-XXXX",
  "appId": "app_xxxx",
  "customerEmail": "pembeli@example.com"
}
```

## 8. Penanganan Error & Kode Status HTTP

API tertaut.com menggunakan kode status HTTP standar:

| HTTP Code               | Arti                                     | Contoh Kasus                                                      |
| ----------------------- | ---------------------------------------- | ----------------------------------------------------------------- |
| `200 OK`                | Permintaan berhasil diproses.            | Validasi berhasil, token diterbitkan.                             |
| `400 Bad Request`       | Parameter input tidak valid.             | Format email salah, harga tidak cocok dengan list price.          |
| `401 Unauthorized`      | Autentikasi gagal atau API key salah.    | Header `Authorization` S2S tidak valid.                           |
| `403 Forbidden`         | Akses ditolak.                           | Lisensi `REVOKED`/`EXPIRED`, atau kuota perangkat (_seat_) penuh. |
| `404 Not Found`         | Resource tidak ditemukan.                | Kunci lisensi atau ID aplikasi tidak terdaftar.                   |
| `409 Conflict`          | Terjadi konflik state atau balapan data. | Kuota kupon habis saat checkout, pendaftaran trial ganda.         |
| `429 Too Many Requests` | Melebihi batas ambang (_Rate Limit_).    | Terlalu banyak percobaan aktivasi/validasi per menit.             |

## Referensi Lengkap

Setiap endpoint (schema request/response, tipe parameter, dan model data lengkap) terdokumentasi di [Swagger UI](https://tertaut.com/swagger).
