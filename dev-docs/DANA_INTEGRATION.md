# Panduan & Dokumentasi Integrasi DANA Enterprise (Multi-PG Engine)

Dokumen ini menjelaskan arsitektur, konfigurasi, dan alur operasional integrasi Payment Gateway **DANA Enterprise** pada **tertaut.com**, termasuk konfigurasi multi-gateway (Xendit & DANA) yang fleksibel.

---

## 1. Konfigurasi Endpoint URLs di Dashboard DANA

Saat melakukan pendaftaran atau integrasi di **DANA Enterprise Dashboard (Sandbox / Production)** pada bagian **Endpoint URLs Initialization**, isikan endpoint resmi berikut:

| Field di Form DANA | URL yang Diisikan | Keterangan & Tujuan |
| :--- | :--- | :--- |
| **Finish Payment URL** | `https://tertaut.com/v1.0/debit/notify` *(atau `/webhook/dana/finish-payment`)* | DANA memanggil webhook ini ketika pembeli berhasil menyelesaikan transaksi (*SNAP BI Debit Notify / DANA Finish Notify API*). Server merespons `2005600 Successful`, memotong 5% MoR platform fee, dan otomatis menerbitkan lisensi universal (`TT-XXXX-XXXX-XXXX`). |
| **Disburse to Bank Notify URL** | `https://tertaut.com/v1.0/emoney/transfer-bank-notify.htm` *(atau `/webhook/dana/disburse-notify`)* | DANA memanggil notifikasi ini ketika proses pencairan dana (*SNAP BI Transfer to Bank Notify API*) ke rekening bank builder selesai untuk mengupdate status ke `COMPLETED`. |
| **Finish Redirect URL** | `https://tertaut.com/checkout/dana/finish` | Halaman redirect browser pembeli setelah menyelesaikan pembayaran di aplikasi atau Web Checkout DANA. Pembeli akan diarahkan ke portal lisensi atau redirect URL milik builder. |

> **Catatan:**
> * Backend `tertautv2` mendukung kedua format path sekaligus (standar regulasi SNAP BI Bank Indonesia `/v1.0/...` maupun modular `/webhook/dana/...`).
> * Terlihat dari log server live: DANA secara aktif memanggil `/v1.0/debit/notify` saat pengujian UAT skenario `2005600` (Success) dan `5005601` (Internal Server Error) dan berhasil direspons secara presisi.
> * Untuk pengujian lokal di laptop (*development*), gunakan tunnel publik seperti **ngrok** (contoh: `https://xxxx.ngrok-free.app/v1.0/debit/notify`).


---

## 2. Strategi Multi-Payment Gateway ("Mana yang Di-ACC, Itu yang Dipakai")

Untuk mendukung pengajuan serentak ke beberapa payment gateway, sistem menerapkan pola modular yang dapat dialihkan sewaktu-waktu melalui variabel environment tanpa perlu mengubah kode sumber.

### Pengaturan di `.env`

```env
# Pilihan Payment Gateway Aktif ('xendit' atau 'dana')
PAYMENT_GATEWAY=xendit

# Kredensial Xendit
XENDIT_SECRET_KEY=xnd_development_...
XENDIT_PUBLIC_KEY=xnd_public_development_...
XENDIT_WEBHOOK_VERIFICATION_TOKEN=...

# Kredensial DANA Enterprise
DANA_CLIENT_ID=
DANA_CLIENT_SECRET=
DANA_MERCHANT_ID=
DANA_BASE_URL=https://api-sandbox.dana.id
DANA_PUBLIC_KEY=
DANA_PRIVATE_KEY=
```

### Cara Beralih:
* **Jika Xendit yang disetujui lebih dulu:** Set `PAYMENT_GATEWAY=xendit`. Seluruh sesi checkout dan payout akan dialirkan ke Xendit Invoice & Disbursement API.
* **Jika DANA yang disetujui lebih dulu:** Set `PAYMENT_GATEWAY=dana`. Sesi checkout akan otomatis membuat DANA Payment Order dan pencairan akan dialirkan via DANA Transfer to Bank.
* **Override Per Request (Opsional):** Client API juga dapat memaksa gateway tertentu melalui body request di endpoint `/api/v1/checkout/session`:
  ```json
  {
    "appId": "app_xxx",
    "amount": 50000,
    "customerEmail": "buyer@example.com",
    "paymentGateway": "dana"
  }
  ```

---

## 3. Diagram Alur Transaksi DANA Enterprise

```
[ Pembeli ] ────> (1) POST /api/v1/checkout/session
                       │  (paymentGateway = "dana" atau default config)
                       ▼
         [ tertaut.com Engine ]
                       │
                       ├──► (2) Hitung Merchant of Record (MoR):
                       │        Gross = Rp 50.000
                       │        Fee 5% = Rp 2.500
                       │        Net 95% = Rp 47.500
                       │
                       ├──► (3) DanaService.createOrder(...)
                       │        (Memanggil DANA API / Mock di sandbox)
                       ▼
         [ Pembeli Membuka Checkout DANA ]
                       │
                       ├──► (4A) Pembeli Menyelesaikan Pembayaran di DANA
                       │          │
                       │          ├──► Webhook Server-to-Server
                       │          │    POST /webhook/dana/finish-payment
                       │          │    - Verifikasi signature webhook
                       │          │    - Cek status transaksi (idempotent)
                       │          │    - Tandai status transaksi = PAID
                       │          │    - Terbitkan Universal License TT-XXXX-XXXX-XXXX
                       │          │    - Simpan 30-Day Offline Grace JWT Token
                       │          │
                       │          └──► Browser Redirect
                       │               GET /checkout/dana/finish?externalId=...
                       │               - Redirect pembeli ke portal lisensi aplikasi
```

---

## 4. Spesifikasi API & Webhook DANA

### A. Finish Payment Webhook
* **Endpoint:** `POST /webhook/dana/finish-payment` (atau `POST /api/v1/webhook/dana/finish-payment`)
* **Payload DANA:**
  ```json
  {
    "merchantTransId": "tt_app_1789588641732",
    "orderStatus": "SUCCESS",
    "orderAmount": {
      "currency": "IDR",
      "value": "50000"
    },
    "paymentChannel": "DANA_WALLET"
  }
  ```
* **Respons Sistem (Sesuai DANA Standard Spec):**
  ```json
  {
    "responseCode": "2005600",
    "responseMessage": "Successful",
    "status": "success",
    "licenseKey": "TT-XXXX-XXXX-XXXX"
  }
  ```

### B. Disburse to Bank Notify Webhook
* **Endpoint:** `POST /webhook/dana/disburse-notify` (atau `POST /api/v1/webhook/dana/disburse-notify`)
* **Payload DANA:**
  ```json
  {
    "partnerReferenceNo": "tt_app_1789588641732",
    "status": "SUCCESS"
  }
  ```
* **Efek:** Memperbarui kolom `disbursement_status` pada tabel `transactions` menjadi `COMPLETED`.

---

## 5. Idempotensi & Keamanan Finansial

1. **Anti-Duplikasi Lisensi:** Jika DANA mengirimkan webhook berulang untuk transaksi yang sama, handler mengecek apakah `paymentStatus === 'PAID'`. Jika ya, sistem langsung mengembalikan status sukses tanpa menerbitkan lisensi ganda atau menambah saldo builder dua kali.
2. **Mock Mode Sandbox:** Jika aplikasi dalam mode sandbox atau kredensial `DANA_CLIENT_ID` belum dimasukkan, checkout tetap berjalan normal dengan mengembalikan mock checkout URL sehingga development frontend/backend tidak terhambat selama masa pengajuan.

---

## 6. Laporan Hasil UAT Sandbox & Status Go-Live (17 September 2026)

Integrasi DANA Enterprise & SNAP Bank Indonesia di lingkungan Sandbox telah berhasil diselesaikan secara komprehensif pada sesi ini:

### A. Hasil Pengujian Skenario UAT (100% Verified - 60/60 Skenario)
Seluruh skenario pengujian di DANA Sandbox Dashboard (`dashboard.dana.id/sandbox/golive`) telah dinyatakan **Lulus (Completed)**:

1. **Disburse to Bank (7 dari 7 Skenario - 100%):**
   * **Bank Account Inquiry:** Pengujian respon sukses (`2001800`), akun tidak ditemukan (`4041812`), dan format parameter tidak valid (`4001802`).
   * **Transfer to Bank:** Pengujian transfer sukses (`2001800`), saldo merchant tidak mencukupi (`4031802`), dan duplikasi referensi partner (`4091800`).
   * **Transfer to Bank Inquiry Status:** Pengujian pengecekan status akhir transaksi pencairan (`2001800`).

2. **Payment Gateway (Mandatory & Additional Scenarios - 100%):**
   * **Consult Pay (3 Skenario):** Permintaan metode pembayaran sukses (`2005700`), invalid field (`4000001`), dan invalid signature.
   * **Create Order & Webhook E2E:** Pembuatan order host-to-host SNAP BI dan simulasi pembayaran browser otomatis (via runner Playwright).
   * **Debit Status (7 Skenario):** Pengecekan status transaksi pembayaran (sukses, pending, expired, refund).
   * **Cancel Order (11 Skenario):** Pembatalan pesanan pembayaran aktif.
   * **Refund Order (12 Skenario):** Pengembalian dana transaksi (full & partial refund).
   * **Finish Notify Webhook (`POST /v1.0/debit/notify`):**
     * Sukses notifikasi transaksi (`2005600`) dengan nominal Rp 11.011 (status `00`).
     * Unauthorized signature handling (`4015600`).
     * Internal server error simulasi (`5005601`) dengan nominal Rp 11.012.

---

### B. Penandatanganan Dokumen UAT Sign-Off Report (Step 2 - Completed)
* **Status:** **Completed** (Dokumen resmi telah ditandatangani secara digital via PrivyID pada **17 September 2026 08:56 WIB**).
* **Data Perwakilan yang Digunakan:**
  * **Badan Usaha:** PT Retas Lintas Batas
  * **IT Representative Name:** Rasyiqi
  * **IT Representative Email:** `crediblemarkofficial@gmail.com`
  * **IT Representative Title:** Developer

---

### C. Status ASPI Devsite Setup (Step 3 - In Progress)
* **Status Saat Ini:** **"Uji Devsite in Progress"** (Required by Bank Indonesia under SNAP).
* **Keterangan:** Akun ASPI `crediblemarkofficial@gmail.com` telah berhasil dihubungkan ke dashboard DANA. Pengujian devsite sedang berjalan secara otomatis di background server DANA & ASPI (*No further action required*).

---

## 7. Form Pengajuan Production DANA (Aktif Diisi)

Pada dashboard DANA Enterprise di menu **Pengajuan Production**, formulir berikut telah disiapkan dan diverifikasi:

### A. Production Key (RSA 2048-bit)
* **Pasangan Kunci Telah Dibuat:** Disimpan di direktori lokal `keys/` (terproteksi otomatis di `.gitignore`).
* **Public Key (Dimasukkan ke Form DANA):**
  ```text
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
* **Private Key (Disimpan untuk Server):** `keys/dana_production_private.pem`. File ini nanti dimasukkan ke variabel `DANA_PRIVATE_KEY` di server production.

---

### B. Endpoint Production (Terverifikasi HTTP 200)

Ketiga URL telah diuji secara lokal dan terbukti berfungsi dengan baik:

| Field di Form DANA | Nilai Endpoint | Status Pengujian |
| :--- | :--- | :---: |
| **URL Finish Payment** | `https://tertaut.com/v1.0/debit/notify` | ✅ HTTP 200 OK |
| **URL Disbursement Notify** | `https://tertaut.com/v1.0/emoney/transfer-bank-notify.htm` | ✅ HTTP 200 OK |
| **URL Finish Redirect** | `https://tertaut.com/checkout/dana/finish` | ✅ HTTP 200 OK |

---

## 8. Prosedur Deployment & Roadmap Aktivasi Live

1. **Submit Pengajuan:** Form Pengajuan Production dapat langsung diklik **Kirim** tanpa harus menunggu deploy server selesai, karena DANA hanya menyimpan konfigurasi awal ke sistem pendaftaran.
2. **Review Compliance (KYB):** Tim internal DANA akan memverifikasi legalitas PT Retas Lintas Batas (estimasi 1–3 hari kerja).
3. **Deployment Server Production:** Sebelum akun production diaktifkan untuk melayani transaksi nyata, pastikan repositori `tertautv2` telah di-deploy ke server hosting/VPS `tertaut.com`.
4. **Pemasangan Kredensial Live:** Begitu DANA menerbitkan `DANA_CLIENT_ID` dan `DANA_MERCHANT_ID` production, setel di `.env` server:
   ```env
   PAYMENT_GATEWAY=dana
   DANA_BASE_URL=https://api.dana.id
   DANA_CLIENT_ID=<production_client_id>
   DANA_MERCHANT_ID=<production_merchant_id>
   DANA_PRIVATE_KEY="<isi_dari_keys/dana_production_private.pem>"
   DANA_PUBLIC_KEY="<isi_dari_keys/dana_production_public.pem>"
   ```

---

## 9. Migrasi ke Official SDK `dana-node` (Rekomendasi)

### A. Status Implementasi Saat Ini

| Komponen | Implementasi Sekarang | Keterangan |
| :--- | :--- | :--- |
| **Create Order** | Raw `fetch()` + manual RSA SHA256 signature | `src/server/services/dana.ts` → `DanaService.createOrder()` |
| **Webhook Verification** | Manual `crypto.createVerify("SHA256")` | `DanaService.verifyWebhook()` |
| **Disbursement** | Raw `fetch()` ke endpoint SNAP BI | `DanaService.createDisbursement()` |
| **Signature Generation** | Manual `crypto.sign()` per-request | Inline di `createOrder()` |

> **Masalah:** Implementasi manual rentan terhadap breaking changes DANA API, tidak mengikuti update standar SNAP BI, dan memerlukan maintenance signature logic sendiri.

### B. Official SDK `dana-node`

**Repository:** [github.com/dana-id/dana-node](https://github.com/dana-id/dana-node)
**Instalasi:**
```bash
npm install dana-node@latest --save
```

**Requirements:** Node.js 18.0 atau lebih baru (kompatibel dengan Bun runtime).

**Environment Variables yang diperlukan SDK:**

| Variabel | Deskripsi | Contoh |
| :--- | :--- | :--- |
| `ENV` atau `DANA_ENV` | Environment SDK (`SANDBOX` / `PRODUCTION`) | `SANDBOX` |
| `X_PARTNER_ID` | Client ID / Partner ID dari dashboard DANA | `<DANA_CLIENT_ID>` |
| `PRIVATE_KEY` | RSA Private Key (path file atau inline PEM) | `keys/dana_production_private.pem` |
| `DANA_PUBLIC_KEY` | RSA Public Key DANA untuk verifikasi webhook | `keys/dana_production_public.pem` |

### C. Rencana Migrasi

Migrasi dari raw `fetch()` ke `dana-node` SDK dilakukan bertahap:

**Fase 1 — Install & Konfigurasi**
```bash
npm install dana-node@latest --save
```

Mapping variabel environment `.env` saat ini ke format SDK:
```env
# Existing tertaut config → SDK mapping
DANA_CLIENT_ID    →  X_PARTNER_ID
DANA_PRIVATE_KEY  →  PRIVATE_KEY
DANA_PUBLIC_KEY   →  DANA_PUBLIC_KEY
DANA_BASE_URL     →  ENV (SANDBOX / PRODUCTION)
```

**Fase 2 — Refactor `DanaService`**

| Method Lama | Pengganti SDK |
| :--- | :--- |
| `DanaService.createOrder()` | `dana.paymentGateway.createOrder()` |
| `DanaService.verifyWebhook()` | `dana.webhook.parseWebhook()` |
| `DanaService.createDisbursement()` | `dana.disbursement.transferToBank()` |

**Fase 3 — Validasi**
1. Jalankan UAT script resmi DANA: [github.com/dana-id/uat-script](https://github.com/dana-id/uat-script)
2. Jalankan test suite tertaut: `bun test src/server/__test/integration/09_dana_gateway.test.ts`
3. Verifikasi webhook di sandbox dashboard DANA

### D. Keuntungan Migrasi

| Aspek | Raw Fetch (Sekarang) | SDK `dana-node` (Target) |
| :--- | :--- | :--- |
| **Signature** | Manual RSA-SHA256 setiap request | Otomatis oleh SDK |
| **Webhook Parse** | Manual `crypto.createVerify()` | `dana.webhook.parseWebhook()` |
| **API Updates** | Harus update kode manual | Update versi SDK saja |
| **Error Handling** | Parse response manual | Typed error objects |
| **TypeScript** | Interface manual | Built-in type definitions |
| **SNAP BI Compliance** | Self-maintained | Dijamin oleh DANA |

### E. Catatan Penting

> ⚠️ **Jalankan UAT Script terlebih dahulu** sebelum menulis kode integrasi SDK. Script ini memvalidasi setup kredensial dan menunjukkan alur lengkap setiap skenario: [github.com/dana-id/uat-script](https://github.com/dana-id/uat-script)

> **Mock/Sandbox Mode:** Selama migrasi, fallback mock di `DanaService` tetap dipertahankan agar development frontend/backend tidak terhambat. SDK hanya digunakan saat kredensial DANA production sudah aktif.

