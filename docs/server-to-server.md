# Server-to-Server API

Otomasi penuh dari **backend Anda** (tanpa sesi dashboard): menerbitkan/mencabut lisensi dan mengelola kredit. Semua resource di-scope ke builder pemilik secret key.

## Autentikasi

```
Authorization: Bearer tt_secret_<...>
```

Tanpa/`tt_secret_` salah → `401 { "error": "..." }`. Secret key didapat & dirotasi dari dashboard → **Dashboard Docs** → **Secret API Key**.

> Key bersifat rahasia — hanya untuk server Anda, jangan pernah di frontend.

## Daftar Endpoint

| Method | Endpoint                                 | Fungsi                                                   |
| ------ | ---------------------------------------- | -------------------------------------------------------- |
| GET    | `/api/v1/s2s`                            | Info akun builder                                        |
| GET    | `/api/v1/s2s/apps`                       | Daftar aplikasi (`?mode=sandbox\|live`)                  |
| GET    | `/api/v1/s2s/apps/:appId`                | Detail satu aplikasi                                     |
| GET    | `/api/v1/s2s/licenses`                   | Daftar lisensi scoped                                    |
| POST   | `/api/v1/s2s/licenses/issue`             | Terbitkan lisensi (tanpa pembayaran)                     |
| POST   | `/api/v1/s2s/licenses/revoke`            | Cabut lisensi + denylist token offline                   |
| POST   | `/api/v1/s2s/licenses/issue-batch`       | Terbitkan batch lisensi (maks 200)                       |
| POST   | `/api/v1/s2s/licenses/revoke-batch`      | Cabut batch lisensi (maks 200)                           |
| GET    | `/api/v1/s2s/licenses/seats`             | Daftar seat perangkat + status lease floating            |
| POST   | `/api/v1/s2s/licenses/seat/release`      | Force-release satu seat perangkat                        |
| POST   | `/api/v1/s2s/licenses/recover`           | Pulihkan lisensi dari device hilang (reset seluruh seat) |
| POST   | `/api/v1/s2s/licenses/transfer`          | Pindah kepemilikan lisensi ke customer lain              |
| GET    | `/api/v1/s2s/licenses/events`            | Audit trail lisensi (event-sourced)                      |
| GET    | `/api/v1/s2s/credits/balance`            | Saldo kredit lisensi                                     |
| POST   | `/api/v1/s2s/credits/consume`            | Konsumsi kredit (idempoten, atomik)                      |
| GET    | `/api/v1/s2s/webhooks`                   | Daftar webhook endpoint + event tersedia                 |
| POST   | `/api/v1/s2s/webhooks`                   | Daftarkan webhook endpoint                               |
| PATCH  | `/api/v1/s2s/webhooks/:id`               | Perbarui webhook endpoint                                |
| DELETE | `/api/v1/s2s/webhooks/:id`               | Hapus webhook endpoint                                   |
| POST   | `/api/v1/s2s/webhooks/:id/rotate-secret` | Rotasi secret HMAC webhook                               |
| POST   | `/api/v1/s2s/webhooks/:id/test`          | Kirim test delivery                                      |

## Info Akun

```bash
curl https://tertaut.com/api/v1/s2s \
  -H "Authorization: Bearer tt_secret_..."
```

```json
{
  "service": "tertaut.com Server-to-Server API",
  "builder": { "id": "bld_...", "email": "admin@tertaut.com", "name": "..." }
}
```

## Apps

```bash
curl "https://tertaut.com/api/v1/s2s/apps?mode=live" \
  -H "Authorization: Bearer tt_secret_..."
```

```json
[
  {
    "id": "app_...",
    "name": "My Product",
    "slug": "my-product",
    "mode": "live",
    "apiKey": "tt_live_...",
    "targetPrice": 49000,
    "createdAt": "2026-09-01T...Z"
  }
]
```

## Licenses

### List

```bash
curl "https://tertaut.com/api/v1/s2s/licenses?appId=app_xxx&status=ACTIVE&limit=50" \
  -H "Authorization: Bearer tt_secret_..."
```

```json
{
  "licenses": [
    {
      "id": "lic_...",
      "appId": "app_xxx",
      "licenseKey": "TT-...",
      "customerEmail": "pembeli@example.com",
      "platform": "web",
      "status": "ACTIVE",
      "maxSeats": 3,
      "expiresAt": "2026-10-18T00:00:00.000Z",
      "lastValidatedAt": "2026-09-18T...Z",
      "createdAt": "2026-09-18T...Z"
    }
  ]
}
```

Filter: `appId?`, `status?` (`ACTIVE` / `REVOKED` / `EXPIRED`), `limit?` (default 50, maks 200). Data selalu di-scope ke app milik builder.

### Issue lisensi

```bash
curl -X POST https://tertaut.com/api/v1/s2s/licenses/issue \
  -H "Authorization: Bearer tt_secret_..." -H "Content-Type: application/json" \
  -d '{
    "appId": "app_xxx",
    "customerEmail": "pembeli@example.com",
    "grantDays": 30,
    "maxSeats": 3,
    "platform": "web",
    "grantCredits": 100
  }'
```

```json
{
  "success": true,
  "license": {
    "id": "lic_...",
    "appId": "app_xxx",
    "licenseKey": "TT-...",
    "customerEmail": "pembeli@example.com",
    "status": "ACTIVE",
    "maxSeats": 3,
    "expiresAt": "2026-10-18T00:00:00.000Z"
  },
  "creditBalance": 100
}
```

- `grantDays` default 30, `maxSeats` default 3, `platform` default `general`, `grantCredits` default 0.
- Email lisensi otomatis ke `customerEmail`. Jika `deliveryConfig.apiAccess.enabled` di app, lisensi ikut membawa `apiKey` (`tt_cust_...`).
- App bukan milik builder → `404`.

### Revoke

```bash
curl -X POST https://tertaut.com/api/v1/s2s/licenses/revoke \
  -H "Authorization: Bearer tt_secret_..." -H "Content-Type: application/json" \
  -d '{ "licenseKey": "TT-..." }'
```

```json
{
  "success": true,
  "message": "Kunci lisensi TT-... berhasil dicabut (REVOKED).",
  "tokenDenylisted": true,
  "license": { "id": "lic_...", "licenseKey": "TT-...", "status": "REVOKED" }
}
```

Status lisensi → `REVOKED`; token offline (JWT) yang sudah terbit ikut masuk **denylist**.

## Seat Management (Floating License)

### List seats & lease

```bash
curl "https://tertaut.com/api/v1/s2s/licenses/seats?licenseKey=TT-..." \
  -H "Authorization: Bearer tt_secret_..."
```

```json
{
  "success": true,
  "licenseKey": "TT-...",
  "status": "ACTIVE",
  "floating": true,
  "maxSeats": 3,
  "seatsUsed": 1,
  "leaseTtlSeconds": 300,
  "seats": [
    {
      "hwidHash": "ab34...",
      "deviceName": "MacBook Pro",
      "ipAddress": "103.1.2.3",
      "lastValidatedAt": "2026-09-18T10:00:00.000Z",
      "createdAt": "2026-09-18T09:00:00.000Z",
      "leaseActive": true,
      "lastHeartbeatAt": "2026-09-18T10:05:00.000Z",
      "leaseExpiresAt": "2026-09-18T10:10:00.000Z"
    }
  ]
}
```

- `floating=false` (lisensi fixed) → `seatsUsed` = semua aktivasi, `leaseActive: null`.
- `floating=true` → `seatsUsed` hanya menghitung seat dengan **lease aktif** (mis. jumlah seat yang sedang dipakai live), TTL lease = konfigurasi app (`leaseTtlSeconds`).

### Force-release satu seat

```bash
curl -X POST https://tertaut.com/api/v1/s2s/licenses/seat/release \
  -H "Authorization: Bearer tt_secret_..." -H "Content-Type: application/json" \
  -d '{ "licenseKey": "TT-...", "hwid": "ab34..." }'
```

```json
{ "success": true, "leasesReleased": 1, "message": "Seat perangkat berhasil dilepas." }
```

Menghapus aktivasi + lease sekaligus — seat langsung bisa dipakai perangkat lain.

### Recover (device hilang / reset seluruh seat)

```bash
curl -X POST https://tertaut.com/api/v1/s2s/licenses/recover \
  -H "Authorization: Bearer tt_secret_..." -H "Content-Type: application/json" \
  -d '{ "licenseKey": "TT-..." }'
```

```json
{
  "success": true,
  "message": "Lisensi dipulihkan. Seluruh seat device dilepas.",
  "licenseKey": "TT-..."
}
```

Melepas seluruh aktivasi + lease, lalu **me-rotate token offline** (hak akses device lama hangus).

### Transfer kepemilikan

```bash
curl -X POST https://tertaut.com/api/v1/s2s/licenses/transfer \
  -H "Authorization: Bearer tt_secret_..." -H "Content-Type: application/json" \
  -d '{ "licenseKey": "TT-...", "newCustomerEmail": "penerima@example.com" }'
```

```json
{
  "success": true,
  "license": {
    "id": "lic_...",
    "licenseKey": "TT-...",
    "customerEmail": "penerima@example.com",
    "status": "ACTIVE"
  }
}
```

Email tidak valid → HTTP `400`.

## Batch Operations

### Issue batch (maks 200 per request)

```bash
curl -X POST https://tertaut.com/api/v1/s2s/licenses/issue-batch \
  -H "Authorization: Bearer tt_secret_..." -H "Content-Type: application/json" \
  -d '{
    "appId": "app_xxx",
    "items": [
      { "customerEmail": "a@example.com", "grantDays": 30, "maxSeats": 3, "features": { "premium": true } },
      { "customerEmail": "b@example.com", "grantDays": 90, "maxSeats": 5 }
    ]
  }'
```

```json
{
  "success": true,
  "issued": 2,
  "failed": 0,
  "licenses": [
    { "customerEmail": "a@example.com", "licenseKey": "TT-...", "id": "lic_..." },
    { "customerEmail": "b@example.com", "licenseKey": "TT-...", "id": "lic_..." }
  ],
  "errors": []
}
```

Baris yang gagal dilaporkan di `errors` (proses lanjut ke item berikutnya).

### Revoke batch (maks 200 per request)

```bash
curl -X POST https://tertaut.com/api/v1/s2s/licenses/revoke-batch \
  -H "Authorization: Bearer tt_secret_..." -H "Content-Type: application/json" \
  -d '{ "licenseKeys": ["TT-A1B2...", "TT-C3D4..."] }'
```

```json
{
  "success": true,
  "revoked": 1,
  "results": [
    {
      "licenseKey": "TT-A1B2...",
      "revoked": true,
      "message": "Kunci lisensi berhasil dicabut (REVOKED)."
    },
    { "licenseKey": "TT-C3D4...", "revoked": false, "error": "NOT_FOUND_OR_UNOWNED" }
  ]
}
```

## Audit Trail

### Events lisensi

```bash
curl "https://tertaut.com/api/v1/s2s/licenses/events?licenseKey=TT-...&event=license.activated&limit=20" \
  -H "Authorization: Bearer tt_secret_..."
```

Atau per app (tanpa `licenseKey`):

```bash
curl "https://tertaut.com/api/v1/s2s/licenses/events?appId=app_xxx" \
  -H "Authorization: Bearer tt_secret_..."
```

```json
{
  "success": true,
  "events": [
    {
      "id": "evt_...",
      "licenseKey": "TT-...",
      "appId": "app_xxx",
      "event": "license.activated",
      "actorType": "CLIENT",
      "ipAddress": "103.1.2.3",
      "payload": { "hwid": "ab34..." },
      "createdAt": "2026-09-18T10:00:00.000Z"
    }
  ],
  "total": 1,
  "limit": 20,
  "offset": 0
}
```

Filter: `licenseKey?`/`appId?` (wajib salah satu), `event?`, `actorType?` (`ADMIN`/`BUILDER`/`S2S`/`SYSTEM`/`CLIENT`), `limit?` (default 50).

## Webhooks Lifecycle

Daftarkan endpoint untuk menerima notifikasi event lisensi secara realtime.

### List endpoint + event tersedia

```bash
curl "https://tertaut.com/api/v1/s2s/webhooks" \
  -H "Authorization: Bearer tt_secret_..."
```

```json
{
  "success": true,
  "events": [
    "license.issued",
    "license.activated",
    "license.deactivated",
    "license.seat_full",
    "license.revoked",
    "license.expired",
    "license.renewed",
    "license.transferred",
    "license.unbound",
    "credits.insufficient"
  ],
  "webhooks": [
    {
      "id": "whk_...",
      "url": "https://api.anda.com/webhook",
      "events": ["license.issued", "license.revoked"],
      "isActive": true,
      "createdAt": "..."
    }
  ]
}
```

### Daftarkan endpoint

```bash
curl -X POST https://tertaut.com/api/v1/s2s/webhooks \
  -H "Authorization: Bearer tt_secret_..." -H "Content-Type: application/json" \
  -d '{ "url": "https://api.anda.com/webhook/tertaut", "events": ["license.issued", "license.revoked"], "secret": "opsional-secret-anda" }'
```

- `events` **kosong** → langganan **semua** event.
- `secret` opsional; bila dikosongkan, sistem membuat secret otomatis.
- Endpoint lain: `PATCH /webhooks/:id`, `DELETE /webhooks/:id`, `POST /webhooks/:id/rotate-secret` (hasil → secret baru, header lama langsung tolak), `POST /webhooks/:id/test`.

### Format delivery & verifikasi signature

Setiap event dikirim sebagai `POST` dengan body JSON:

```json
{
  "event": "license.issued",
  "timestamp": "2026-09-18T10:00:00.000Z",
  "data": {
    "licenseKey": "TT-...",
    "customerEmail": "pembeli@example.com",
    "appId": "app_xxx",
    "status": "ACTIVE",
    "maxSeats": 3,
    "expiresAt": "2026-10-18T00:00:00.000Z"
  }
}
```

Header wajib diverifikasi:

```
x-tertaut-signature: <hex hmac-sha256(endpoint.secret, rawBody)>
x-tertaut-event: license.issued
x-tertaut-delivery-id: whd_...
Content-Type: application/json
```

Verifikasi di server penerima (Node.js):

```ts
const crypto = require("crypto");
const expected = crypto
  .createHmac("sha256", endpoint.secret)
  .update(rawBody) // body mentah persis, jangan di-parse dulu
  .digest("hex");
if (signature !== expected) reject(401);
```

> Gunakan `rawBody` mentah (bukan hasil `JSON.stringify` objek yang sudah di-parse) agar urutan kunci tidak mengubah signature.

**Pengiriman & retry:** outbox — maksimum 6 percobaan, backoff eksponensial (`30s`, `60s`, `120s`, ...), timeout HTTP 10 detik. Balas `2xx` untuk konfirmasi sukses; selain itu akan masuk antrean retry. Delivery yang telah melewati batas diberi status `FAILED`. Job beda proses dijalankan (daemon `start()`).

## Metered Credits

### Cek saldo

```bash
curl "https://tertaut.com/api/v1/s2s/credits/balance?licenseKey=TT-..." \
  -H "Authorization: Bearer tt_secret_..."
```

```json
{ "success": true, "licenseKey": "TT-...", "balance": 95 }
```

### Konsumsi

```bash
curl -X POST https://tertaut.com/api/v1/s2s/credits/consume \
  -H "Authorization: Bearer tt_secret_..." -H "Content-Type: application/json" \
  -d '{ "licenseKey": "TT-...", "amount": 5, "reference": "call-000123", "reason": "10x generate" }'
```

```json
{ "success": true, "balance": 90, "consumed": 5 }
```

- **Idempoten terhadap `reference`**: retry yang sama → `consumed: 0`, saldo tidak berubah.
- Saldo tidak bisa negatif: konsumsi berlebih → HTTP `409` `{ "success": false, "reason": "INSUFFICIENT_CREDITS", "balance": 5 }`.

## Otorisasi & Keamanan

- Semua query di-scope ke **builder pemilik** secret key — key milik builder lain ditolak (`404`/`401`).
- Rotasi secret key → semua request dengan key lama langsung gagal (`401`).

## Penanganan Error & Kode Status HTTP

API Server-to-Server mengembalikan kode status HTTP standar:

| HTTP Code          | Arti                                                   | Contoh Kasus                                                                                                             |
| ------------------ | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| `200 OK`           | Permintaan berhasil diproses.                          | Lisensi terbit, saldo didapatkan.                                                                                        |
| `400 Bad Request`  | Payload atau parameter tidak valid.                    | Format email pembeli salah atau parameter wajib kosong.                                                                  |
| `401 Unauthorized` | Autentikasi secret key gagal.                          | Header `Authorization: Bearer tt_secret_...` tidak disertakan atau key tidak valid/sudah dirotasi.                       |
| `404 Not Found`    | Resource tidak ditemukan atau bukan milik builder.     | ID aplikasi (`appId`) atau kunci lisensi tidak ditemukan di bawah akun Anda.                                             |
| `409 Conflict`     | Saldo kredit tidak mencukupi (_Insufficient Credits_). | Konsumsi kredit melebihi saldo aktif lisensi (`{ "success": false, "reason": "INSUFFICIENT_CREDITS", "balance": ... }`). |

## Referensi Lengkap

Schema request/response & status code lengkap: [Swagger UI](https://tertaut.com/swagger).
