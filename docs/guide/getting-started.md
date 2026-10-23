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

Dashboard → **Aplikasi** → **Buat Aplikasi**: tentukan nama, slug (URL checkout publik `/pay/:slug`), harga resmi (`targetPrice`), dan mode.

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
    "sessionId": "tx_...",
    "paymentGateway": "xendit",
    "checkoutUrl": "https://checkout.xendit.co/web/...",
    "expiresAt": "2026-09-21T18:30:00.000Z",
    "isSandbox": false
  },
  "transactionId": "tx_...",
  "checkoutUrl": "https://checkout.xendit.co/web/...",
  "paymentGateway": "xendit"
}
```

> **Catatan Keamanan & Parameter**:
>
> - `amount`: Harus sesuai dengan harga resmi aplikasi atau harga setelah diskon kupon valid (anti-tampering).
> - `grantDays`: Durasi lisensi ditentukan secara terpusat oleh konfigurasi produk (`deliveryConfig.licenseKey.expiresInDays`, default 365 hari) dan tidak dapat dimanipulasi dari sisi klien.
> - `appSlug` / `slug` dapat digunakan sebagai alternatif `appId`.
> - `paymentRail`: Nilai opsional (`qris` / `va` / `ewallet`) untuk mengunci kanal pembayaran tertentu.

### Opsi B — Server-to-Server (Penerbitan Programatik Tanpa Pembayaran)

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
{ "valid": true, "status": "ACTIVE", "gracePeriodRemainingDays": 7 }
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
  "data": {
    "licenseToken": "eyJhbGciOiJFZERT...",
    "status": "ACTIVE",
    "expiresAt": "2026-10-18T00:00:00.000Z",
    "seatsUsed": 1,
    "maxSeats": 3
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
