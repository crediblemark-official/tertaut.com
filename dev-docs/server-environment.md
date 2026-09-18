# Konfigurasi & Environment Variables

Seluruh konfigurasi dibaca **di startup** dari `src/server/config.ts`. Referensi lengkap, akurat mengikuti kode (bukan PRD).

## Aturan Dasar

1. **Precedence**: `process.env` > file `.env` > default kode. Env proses (Docker/systemd/shell) selalu menang.
2. `.env.example` = daftar kunci lengkap (baru-baru ini diberbarui agar konsisten dengan config).
3. **Production** (menunjuk `NODE_ENV=production`) **wajib** menyetel secret kustom — jika kosong atau masih nilai default publik, **startup gagal** dengan pesan `[config] ... wajib disetel`.
4. `DATABASE_URL` **wajib** di semua mode (tidak ada fallback hardcode).

## Tabel Referensi

### Server

| Variabel | Wajib | Default | Deskripsi |
| --- | --- | --- | --- |
| `PORT` | — | `3000` | Port HTTP server |
| `NODE_ENV` | — | `development` | `production` = mode produksi (enforce secret & sandbox mati) |
| `PUBLIC_APP_URL` | — | `http://localhost:3000` | URL publik aplikasi (redirect pasca-bayar dll) |
| `PUBLIC_STORE_URL` | — | `https://situsbisnis.com` | URL toko (kotak/donasi) |
| `DEFAULT_PRICE` | — | `0` | Harga fallback (IDR) untuk produk tanpa `targetPrice` |
| `DATABASE_URL` | ✅ | — | Connection string PostgreSQL. **Harus di-set** (lihat `.env.example`) |

> **Sandbox mode**: `config.isSandbox` = otomatis **non-production**. Semua fitur dev (mock payment, auto-seed demo) mati total di `NODE_ENV=production` untuk mencegah bypass pembayaran riil. Tidak ada flag env terpisah.

### Security & Encryption

| Variabel | Wajib (prod) | Deskripsi |
| --- | --- | --- |
| `JWT_SECRET` | ✅ | Secret JWT (≥ 32 karakter) |
| `BETTER_AUTH_SECRET` | ✅ | Secret sesi/token Better Auth |
| `VAULT_ENCRYPTION_KEY` | ✅ | 32-byte hex untuk AES-256-GCM Vault |
| `HWID_SALT` | ✅ | Salt HMAC HWID; di prod wajib unik (fallback dev otomatis) |
| `LICENSE_SIGNING_PRIVATE_KEY` | — | Ed25519 private key — inline / base64 / PEM / path `keys/license_signing_private.pem` |

### Email (Resend)

| Variabel | Wajib | Deskripsi |
| --- | --- | --- |
| `RESEND_API_KEY` | — | API key Resend; **kosong = email dilewati** (skip) |
| `MAIL_FROM` | — | Pengirim terverifikasi, mis. `"Tertaut <noreply@mail.tertaut.com>"` |
| `EMAIL_REPLY_TO` | — | Alamat Reply-To (opsional) |

### Payment Gateway

Pilih satu gateway lewat `PAYMENT_GATEWAY`.

| Variabel | Wajib | Default | Deskripsi |
| --- | --- | --- | --- |
| `PAYMENT_GATEWAY` | — | `xendit` | `xendit` atau `dana` (selain itu → xendit) |

**Xendit:**

| Variabel | Deskripsi |
| --- | --- |
| `XENDIT_SECRET_KEY` | Secret key (deployment: sandbox `xnd_development_...`) |
| `XENDIT_PUBLIC_KEY` | Public key |
| `XENDIT_WEBHOOK_VERIFICATION_TOKEN` | Token verifikasi webhook |

**DANA (SNAP BI):** kunci dapat berupa **base64/PEM string** atau **path file** (otomatis dibaca dari folder `keys/`):

| Variabel | Deskripsi |
| --- | --- |
| `DANA_CLIENT_ID` / `DANA_CLIENT_SECRET` | Kredensial OAuth DANA |
| `DANA_MERCHANT_ID` | ID merchant |
| `DANA_BASE_URL` | Default `https://api-sandbox.dana.id` (sandbox) |
| `DANA_PUBLIC_KEY` / `DANA_PRIVATE_KEY` | Kunci sign — inline atau path ke `keys/dana_production_public.pem` / `keys/dana_production_private.pem` |

## Biaya Platform (fixed, bukan env)

- Xendit & DANA memakai **5% Merchant of Record** (`config.xendit.platformFeePercent` / `config.dana.platformFeePercent`) — di-hardcode, bukan env.

## Implementasi di Kode (bukti)

- Precedence env & parsing `.env`: `src/server/config.ts` → `getEnv()` / `requireEnv()` / `resolveSecret()` / `resolveKeyOrFile()`.
- `.env.example` — daftar kunci resmi (23 + `DEFAULT_PRICE`).
- Production enforcement: `isProd` branch di `config.ts:33-44`.