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

Setiap aplikasi memiliki **publishable API key** (`tt_live_...` / `tt_test_...`). Key ini **publik** — aman dipasang di frontend, dan bisa dirotasi kapan saja dari menu **Dashboard Docs**.

## 2. Ambil Secret Key (untuk otomasi backend)

Dashboard → **Dashboard Docs** → **Secret API Key**: buat atau rotasikan key `tt_secret_...`.

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
    "paymentGateway": "dana",
    "checkoutUrl": "https://tertaut.com/checkout/dana/finish?orderId=...",
    "expiresAt": "2026-09-21T18:30:00.000Z",
    "isSandbox": false
  },
  "transactionId": "tx_...",
  "checkoutUrl": "https://tertaut.com/checkout/dana/finish?orderId=...",
  "paymentGateway": "dana"
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
    "platform": "web",
    "grantCredits": 100
  }'
```

Respons: `{ "success": true, "license": { "licenseKey": "TT-...", "status": "ACTIVE", ... }, "creditBalance": 100 }`. Email konfirmasi lisensi otomatis dikirim ke `customerEmail`.

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
{ "valid": true, "status": "ACTIVE", "gracePeriodRemainingDays": 7, "credits": 95 }
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

## 7. Metered Credits

Saldo kredit per lisensi (ledger append-only). Konsumsi **atomik** (tidak bisa minus) & **idempoten** lewat `reference`.

```bash
curl -X POST https://tertaut.com/api/v1/licensing/credits/consume \
  -H "Content-Type: application/json" \
  -d '{ "licenseKey": "TT-...", "hwid": "device-xxxx", "amount": 10, "reason": "10x generate", "reference": "job-00123" }'
```

```json
{ "success": true, "balance": 85, "consumed": 10 }
```

Cek saldo & riwayat:

```bash
curl -X POST https://tertaut.com/api/v1/licensing/credits/balance \
  -H "Content-Type: application/json" -d '{ "licenseKey": "TT-..." }'

curl -X POST https://tertaut.com/api/v1/licensing/credits/history \
  -H "Content-Type: application/json" \
  -d '{ "licenseKey": "TT-...", "limit": 20 }'
```

> Untuk otomasi dari backend, versi `/api/v1/s2s/credits/balance` (GET) & `/api/v1/s2s/credits/consume` (POST) lebih ringkas — lihat [Server-to-Server](/server-to-server).

## 8. Verifikasi Kunci API Pelanggan

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
  "credits": 100,
  "appId": "app_xxxx",
  "customerEmail": "pembeli@example.com"
}
```

## 9. Penanganan Error & Kode Status HTTP

API tertaut.com menggunakan kode status HTTP standar:

| HTTP Code               | Arti                                     | Contoh Kasus                                                      |
| ----------------------- | ---------------------------------------- | ----------------------------------------------------------------- |
| `200 OK`                | Permintaan berhasil diproses.            | Validasi berhasil, saldo terbaca.                                 |
| `400 Bad Request`       | Parameter input tidak valid.             | Format email salah, harga tidak cocok dengan list price.          |
| `401 Unauthorized`      | Autentikasi gagal atau API key salah.    | Header `Authorization` S2S tidak valid.                           |
| `402 Payment Required`  | Saldo kredit lisensi habis.              | Konsumsi kredit melewati batas saldo saat ini.                    |
| `403 Forbidden`         | Akses ditolak.                           | Lisensi `REVOKED`/`EXPIRED`, atau kuota perangkat (_seat_) penuh. |
| `404 Not Found`         | Resource tidak ditemukan.                | Kunci lisensi atau ID aplikasi tidak terdaftar.                   |
| `409 Conflict`          | Terjadi konflik state atau balapan data. | Kuota kupon habis saat checkout, pendaftaran trial ganda.         |
| `429 Too Many Requests` | Melebihi batas ambang (_Rate Limit_).    | Terlalu banyak percobaan aktivasi/validasi per menit.             |

## Referensi Lengkap

Setiap endpoint (schema request/response, tipe parameter, dan model data lengkap) terdokumentasi di [Swagger UI](https://tertaut.com/swagger).
