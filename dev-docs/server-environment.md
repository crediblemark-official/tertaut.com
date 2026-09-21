# Konfigurasi & Environment Variables

Seluruh konfigurasi dibaca **di startup** dari `src/server/config.ts`. Dokumen ini mencerminkan arsitektur runtime aktif **tertaut.com** (DANA Enterprise SNAP BI Engine & 12-Factor Cloud-Native).

---

## Aturan Dasar

1. **Precedence**: `process.env` > file `.env` > default kode. Environment proses (Docker/Dokploy/systemd) selalu menang.
2. **Dokploy / Cloud-Native**: Gunakan variabel **`*_BASE64`** untuk asymmetric keys (RSA DANA & Ed25519) untuk mencegah error pemenggalan newline/quotes pada container.
3. **Production Mode** (`NODE_ENV=production`): **Wajib** menyetel secret kustom (`JWT_SECRET`, database, dll). Jika kosong atau masih default publik, startup server **gagal**.
4. **Database**: `DATABASE_URL` wajib diisi di semua mode (tidak ada fallback hardcode).

---

## Tabel Referensi Environment Variables

### 1. Server Core

| Variabel | Wajib | Default | Deskripsi |
| :--- | :---: | :--- | :--- |
| `PORT` | — | `8081` | Port HTTP server |
| `NODE_ENV` | — | `development` | `production` = mode produksi (enforce secret kustom & sandbox mati) |
| `PUBLIC_APP_URL` | — | `https://tertaut.com` (prod) / `http://localhost:8081` (dev) | URL publik utama (mendukung auto-detect via request Host) |
| `PUBLIC_STORE_URL` | — | Fallback ke `PUBLIC_APP_URL` | URL storefront toko/donasi |
| `DEFAULT_PRICE` | — | `0` | Harga fallback (IDR) untuk produk tanpa `targetPrice` |
| `DATABASE_URL` | ✅ | — | Connection string PostgreSQL (contoh: `postgresql://user:pass@host:5432/db`) |

> **Sandbox Mode**: `config.isSandbox` otomatis aktif di **non-production** (`NODE_ENV !== "production"`). Di sandbox, simulator pembayaran dan dev mock aktif untuk mempermudah testing. Di production, sandbox dimatikan total demi mencegah bypass pembayaran riil.

---

### 2. Security & Token Keys

| Variabel | Wajib (Prod) | Deskripsi |
| :--- | :---: | :--- |
| `JWT_SECRET` | ✅ | Secret JWT platform (≥ 32 karakter). Mewariskan ke Better Auth & Vault jika tidak diatur terpisah. |
| `BETTER_AUTH_SECRET` | — | Secret Better Auth (otomatis mewarisi `JWT_SECRET` jika kosong). |
| `VAULT_ENCRYPTION_KEY` | — | Kunci enkripsi AES-256-GCM Vault (otomatis mewarisi `JWT_SECRET` jika kosong). |
| `HWID_SALT` | ✅ | Salt HMAC HWID mesin builder. |
| `LICENSE_SIGNING_PRIVATE_KEY_BASE64` | ✅ | **Rekomendasi Dokploy/Docker:** 1-baris string Base64 dari Ed25519 private key. |
| `LICENSE_SIGNING_PRIVATE_KEY` | — | Alternatif path file lokal (`keys/license_signing_private.pem`) atau inline PEM. |

---

### 3. Payment Gateway: DANA Enterprise (SNAP BI)

`tertaut.com` menggunakan SDK resmi `@dana-node` (v2.2.2) sesuai spesifikasi [DANA API Docs v2](https://dashboard.dana.id/api-docs-v2/).

| Variabel | Wajib (Prod) | Default | Deskripsi |
| :--- | :---: | :--- | :--- |
| `PAYMENT_GATEWAY` | — | `dana` | Gateway aktif (`dana`) |
| `DANA_ENV` | — | `sandbox` (dev) / `production` (prod) | Menentukan target environment DANA (`sandbox` atau `production`) |
| `DANA_CLIENT_ID` | ✅ | — | Client ID DANA Production (dari dashboard.dana.id) |
| `DANA_CLIENT_SECRET` | ✅ | — | Client Secret DANA Production (untuk API Disbursement) |
| `DANA_MERCHANT_ID` | ✅ | — | Merchant ID DANA Production |
| `DANA_BASE_URL` | — | `https://api.saas.dana.id` | Base URL API DANA Production |
| `DANA_PRIVATE_KEY_BASE64` | ✅ | — | **Rekomendasi Dokploy:** 1-baris Base64 Private Key RSA DANA Production |
| `DANA_PUBLIC_KEY_BASE64` | ✅ | — | **Rekomendasi Dokploy:** 1-baris Base64 Public Key RSA DANA Production |
| `DANA_SANDBOX_CLIENT_ID` | — | — | Client ID untuk Sandbox DANA |
| `DANA_SANDBOX_CLIENT_SECRET` | — | — | Client Secret untuk Sandbox DANA |
| `DANA_SANDBOX_MERCHANT_ID` | — | — | Merchant ID untuk Sandbox DANA |
| `DANA_SANDBOX_BASE_URL` | — | `https://api.sandbox.dana.id` | Base URL API DANA Sandbox |
| `DANA_SANDBOX_PRIVATE_KEY_BASE64` | — | — | 1-baris Base64 Private Key RSA DANA Sandbox |
| `DANA_SANDBOX_PUBLIC_KEY_BASE64` | — | — | 1-baris Base64 Public Key RSA DANA Sandbox |

> 💡 **Utilitas Konversi Kunci**: Jalankan `bun run keys:encode` di komputer lokal untuk otomatis mengubah file `.pem` di `./keys/` menjadi nilai `_BASE64` yang siap disalin ke Dokploy!

---

### 4. Email (Resend)

| Variabel | Wajib | Deskripsi |
| :--- | :---: | :--- |
| `RESEND_API_KEY` | — | API key Resend. Bila kosong, pengiriman email dilewati (skip). |
| `MAIL_FROM` | — | Alamat pengirim terverifikasi, mis. `"Tertaut <no-reply@mail.tertaut.com>"` |
| `EMAIL_REPLY_TO` | — | Alamat email Reply-To (opsional) |

---

## Biaya Platform (Fixed MoR)
Platform memotong fee **5% Merchant of Record** (`config.dana.platformFeePercent`) dan menyalurkan 95% net payout ke builder via DANA Disbursement.