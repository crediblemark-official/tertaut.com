# DANA Go-Live Checklist & Setup Guide

**Terakhir diperbarui: 23 September 2026**

## Status Saat Ini

| Item                                     | Status               | Keterangan                                                                                        |
| ---------------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------- |
| Kode integrasi DANA                      | ✅ Siap              | Direfaktor ke `danaClient`, `danaOrderService`, `danaWebhookVerifier`, `danaDisbursementService`  |
| Private Key kita (untuk sign request)    | ✅ Ada di `.env`     | `DANA_PRIVATE_KEY_BASE64` (2048-bit RSA)                                                          |
| Merchant ID, Client ID, Client Secret    | ✅ Ada di `.env`     | Dari screenshot dashboard DANA                                                                    |
| Sandbox credentials                      | ✅ Lengkap           | `DANA_SANDBOX_*` semua terisi                                                                     |
| Public key DANA untuk verifikasi webhook | ⚠️ **PERLU DIISI**   | `DANA_PUBLIC_KEY_BASE64` dikosongkan karena sebelumnya salah diisi dengan public key kita sendiri |
| `DANA_ENV=production`                    | ⚠️ **Masih sandbox** | Perlu ganti saat siap go-live                                                                     |
| Submerchant / ExternalStoreId (QRIS)     | ⚠️ **Perlu daftar**  | Di DANA dashboard → Submerchants                                                                  |

---

## Step-by-Step Go-Live

### Step 1: Daftarkan Public Key Kita ke DANA Dashboard

> **Ini WAJIB dilakukan terlebih dahulu** sebelum DANA bisa memverifikasi signature request dari server kita.

Buka DANA Merchant Portal → **Settings / API Credentials** → **Your RSA Public Key**, paste public key berikut:

```
-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAn7E/18nPmOeCKgAxqnhZ
7ID8vmE0B3iGTMjM/QM0lSgVeqHuXuROv00K6KLHnt1IyT45kZERtTL6NVuE7Wf/
2IDZG5wAaSoUz4rKVy7A5WVZiS4WIRhZe3Qc6SoLYjmd0TUXouQmn2yLwxen7wlZ
N9VbLcg0+QZeeOGhSepW2UIx5XEKbUYhoRyg4ybqcrxUaU0bi4vsxcuZhWo2QV8o
0uxtZNwn16nxH5neDRR+lelzf9DbcFsapEtV3qy0QsofNEKrcTsduhnOasNmjxaU
/nQ1MHHLj/GSH+XNCUk3M8aAjU1Flw1RYHj2CO3AkQErV5jJQiDm0o/4JaEEpGdF
hQIDAQAB
-----END PUBLIC KEY-----
```

> **Catatan:** File ini ada di `keys/dana_production_public.pem`. Ini adalah **public key KITA** yang dipakai DANA untuk memverifikasi tanda tangan request dari server tertaut.com. Private key-nya ada di `.env` sebagai `DANA_PRIVATE_KEY_BASE64`.

---

### Step 2: Ambil Public Key DANA untuk Verifikasi Webhook

Setelah mendaftar di atas, DANA akan memberikan public key mereka. Atau cari di:

- DANA Merchant Portal → **Settings → DANA Public Key / Webhook Public Key**
- Atau tanya tim DANA melalui Discord resmi mereka / account manager

Setelah dapat, isi di `.env` production (Dokploy/server):

```env
# Public key DANA (dari DANA dashboard), bukan public key kita
DANA_PUBLIC_KEY_BASE64=<paste base64 encode dari PEM public key DANA>
```

Atau simpan sebagai file:

```bash
# Simpan PEM ke file
echo "-----BEGIN PUBLIC KEY-----
...konten dari DANA...
-----END PUBLIC KEY-----" > keys/dana_production_public.pem
```

> ⚠️ **Jangan** isi dengan public key kita sendiri — itu yang terjadi sebelumnya dan sudah diperbaiki.

---

### Step 3: Daftarkan Submerchant untuk QRIS

QRIS membutuhkan `externalStoreId` yang terdaftar di DANA.

1. Login ke DANA Merchant Portal → **Submerchants**
2. Tambah store baru dengan nama toko (misal: `tertaut.com`)
3. Catat `externalStoreId` yang diberikan
4. (Opsional) tambahkan ke config jika berbeda dari merchantId — saat ini kode menggunakan `config.dana.merchantId` sebagai fallback

---

### Step 4: Switch ke Production di `.env` server

Di server Dokploy / deployment production, set:

```env
# === DANA Production ===
DANA_ENV=production
DANA_CLIENT_ID=202609211102520222154  # sudah ada
DANA_CLIENT_SECRET=00b18d19398bcd9d...   # sudah ada
DANA_MERCHANT_ID=21662009002103207...    # sudah ada
DANA_PRIVATE_KEY_BASE64=<nilai dari .env lokal, sudah ada>
DANA_PUBLIC_KEY_BASE64=<dari Step 2 di atas — public key DANA production>
DANA_BASE_URL=https://api.saas.dana.id
```

> **Jangan set** `DANA_SANDBOX_*` keys di production deployment.

---

### Step 5: Registrasi Webhook URL ke DANA

DANA perlu tahu URL callback untuk notifikasi pembayaran:

| Tipe Webhook              | URL                                             |
| ------------------------- | ----------------------------------------------- |
| Payment Notification      | `https://tertaut.com/webhook/dana/notify`       |
| Disbursement Notification | `https://tertaut.com/webhook/dana/disbursement` |

Daftar di: DANA Merchant Portal → **Webhook / Notification Settings**

---

### Step 6: Verifikasi End-to-End

Gunakan endpoint health check DANA yang tersedia:

```bash
curl https://tertaut.com/api/v1/health/dana
```

Response expected:

```json
{
  "status": "ok",
  "env": "production",
  "clientId": "20260921...",
  "hasPrivateKey": true,
  "hasPublicKey": true,
  "hasWebhookPublicKey": true
}
```

---

## Sandbox vs Production Credential Map

| `.env` Variable           | Sandbox                                                                    | Production                            |
| ------------------------- | -------------------------------------------------------------------------- | ------------------------------------- |
| `DANA_ENV`                | `sandbox`                                                                  | `production`                          |
| `DANA_CLIENT_ID`          | `DANA_SANDBOX_CLIENT_ID`                                                   | Dari screenshot                       |
| `DANA_CLIENT_SECRET`      | `DANA_SANDBOX_CLIENT_SECRET`                                               | Dari screenshot                       |
| `DANA_MERCHANT_ID`        | `DANA_SANDBOX_MERCHANT_ID`                                                 | Dari screenshot                       |
| `DANA_PRIVATE_KEY_BASE64` | `DANA_SANDBOX_PRIVATE_KEY_BASE64` (keys kita)                              | Dari `.env` sudah ada                 |
| `DANA_PUBLIC_KEY_BASE64`  | `DANA_SANDBOX_PUBLIC_KEY_BASE64` (DANA sandbox key — **sudah diperbaiki**) | Dari DANA dashboard — **PERLU DIISI** |
| `DANA_BASE_URL`           | `https://api.sandbox.dana.id`                                              | `https://api.saas.dana.id`            |

---

## Yang SUDAH Beres di Kode

- ✅ `danaWebhookVerifier.ts` — verifikasi RSA signature webhook dengan public key DANA
- ✅ `danaOrderService.ts` — createOrder (QRIS, VA, E-Wallet, Balance), fallback sandbox, timeout wrapper
- ✅ `danaDisbursementService.ts` — transfer bank, resolveDisbursementAccount, MoR breakdown
- ✅ `danaClient.ts` — SDK factory, timeout 15s
- ✅ Mock order tidak pernah dikirim ke production (guard `config.isProd`)
- ✅ Webhook verifikasi wajib jika public key tersedia (sandbox bypass hanya jika pubkey kosong)
- ✅ QRIS fallback ke mock jika submerchant belum terdaftar (non-prod) — error asli di prod
- ✅ `dana_sandbox_public.pem` sudah diisi dengan public key DANA sandbox yang benar (dari `dana-node` SDK)
- ✅ `DANA_SANDBOX_PUBLIC_KEY_BASE64` di `.env` sudah diperbaiki dengan public key DANA yang benar
