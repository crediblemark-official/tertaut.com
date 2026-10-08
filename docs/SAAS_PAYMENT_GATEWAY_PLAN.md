# Arsitektur & Peta Jalan: Developer-First SaaS Payment Gateway (Tertaut MoR)

Dokumen ini menguraikan rencana transformasi **Tertaut** dari model toko digital/DRM lisensi bergaya Creem.io menjadi **Developer-First Payment Gateway & Merchant of Record (MoR) khusus SaaS** (serupa Stripe Checkout / Paddle / Midtrans Snap).

---

## 1. Latar Belakang & Perubahan Paradigma

### Masalah Utama Model Toko Digital Saat Ini

1. **SaaS Berbeda dari E-Book / Template Gumroad:**
   - Di toko barang digital, pembeli wajar dilempar ke link kasir pihak ketiga (`tertaut.com/pay/...`).
   - Di aplikasi SaaS, melempar pengguna keluar dari domain web SaaS (`app.namasaas.com`) menurunkan konversi, merusak kepercayaan pengguna, dan memutus sesi aplikasi.
2. **Penetapan Harga Kaku di Dashboard Menghambat SaaS:**
   - SaaS membutuhkan harga dinamis: perkalian jumlah seat (_misal 5 user x Rp 30.000_), tagihan prorasi (_upgrade di tengah bulan_), add-on kuota token/AI, dan diskon internal SaaS.
   - Mewajibkan pembuatan "Produk" dengan harga kaku dan opsi DRM lisensi (_hardware ID, lease TTL, offline token_) membingungkan dan tidak relevan untuk SaaS modern.

### Paradigma Baru: Tertaut sebagai Mesin Pembayaran Finansial Murni

- **SaaS Mengontrol Logika & Harga:** Penetapan harga, kuota, tier pengguna, dan diskon dikelola sepenuhnya di database dan kode SaaS itu sendiri.
- **Tertaut Mengurus Infrastruktur Finansial (MoR):** Menangani rel pembayaran rupiah (QRIS Dinamis, Virtual Account BCA/Mandiri/BRI/BNI, DANA, Kartu Kredit), rekonsiliasi, invoice, potongan platform fee, akumulasi saldo, dan penarikan dana (_payout_) ke rekening bank developer.

---

## 2. Konsep Baru Menu "Apps" (`/dashboard/apps`): Registry Multi-SaaS & Strategi Lisensi

Dalam arsitektur baru ini, menu **Apps** bukan lagi katalog jualan file/software DRM, melainkan **Workspace / Registry Identitas Proyek Developer**.

### Pilihan Tipe Proyek di Awal (Clean Onboarding):

Saat developer menekan tombol **"Tambah App / Proyek Baru"**, mereka memilih tipe proyek:

| Tipe Proyek                                           | Kasus Penggunaan                                                                                  | Yang Disediakan Tertaut                                                                                                                                                                                               | Status Lisensi                                                                          |
| :---------------------------------------------------- | :------------------------------------------------------------------------------------------------ | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------- |
| **🚀 SaaS Web / Cloud Platform** _(Default)_          | Aplikasi web, tools online, micro-SaaS, API subscription.                                         | • Murni Payment Gateway MoR.<br/>• Nominal dinamis dari kode SaaS.<br/>• Hosted Checkout resmi Tertaut (/pay).<br/>• Notifikasi Webhook HMAC.<br/>• Mutasi per-SaaS terisolasi.                                       | **Nonaktif & Tersembunyi** (Form bersih, tanpa istilah lisensi, DRM, atau hardware ID). |
| **💻 Desktop App / Plugin / On-Premise** _(Opsional)_ | Aplikasi desktop (Electron/Tauri), WordPress/Figma plugin, script, enterprise self-hosted Docker. | • Seluruh kapabilitas pembayaran di atas.<br/>• **+ Tertaut License Key Engine**.<br/>• Auto-generate License Key unik (`TT-XXXX-YYYY`) setelah lunas.<br/>• API verifikasi lisensi (`POST /api/v1/licenses/verify`). | **Aktif Otomatis** (Tersedia tab khusus kelola serial key & batas aktivasi perangkat).  |

---

### Perbandingan Isian Formulir: Model Lama vs Konsep Fresh

| Bagian Formulir                     | Model Lama (Creem.io / Toko File)           | Konsep Fresh: **🚀 SaaS Web (Payment Gateway)**                                          | Konsep Fresh: **💻 Desktop/Plugin**                          |
| :---------------------------------- | :------------------------------------------ | :--------------------------------------------------------------------------------------- | :----------------------------------------------------------- |
| **Identitas (Nama, Slug, Logo)**    | Diisi untuk judul etalase toko.             | **Tetap Ada** (Penting untuk branding di halaman checkout QRIS & receipt email pembeli). | **Tetap Ada**                                                |
| **Penetapan Harga (Pricing)**       | Wajib isi harga kaku (misal Rp 49.000/bln). | ❌ **Dihapus/Disembunyikan** (Harga dinamis dihitung di kode SaaS).                      | ✅ Opsional (jika produk bertarif tetap).                    |
| **Manfaat Produk (Benefits)**       | Poin-poin peluru keuntungan produk.         | ❌ **Dihapus** (SaaS sudah punya landing page pricing sendiri).                          | ✅ Opsional.                                                 |
| **Pengiriman (Delivery & Lisensi)** | Upload file zip / toggle DRM hardware ID.   | ❌ **Dihapus** (Aktivasi akun dilakukan via webhook backend SaaS).                       | ✅ **Ada** (Upload installer atau auto-generate serial key). |
| **Webhook & Redirect URL**          | Tersembunyi di bawah delivery / opsional.   | ✅ **Diangkat Jadi Pengaturan Utama** (Endpoint webhook & Return URL).                   | ✅ Ada.                                                      |
| **Panel Sisi Kanan**                | Preview kartu toko Gumroad/Creem.           | 🔄 **Ringkasan Konfigurasi & Submit** (Nama, Slug, Webhook, Model S2S).                  | 🔄 Ringkasan Produk & Lisensi.                               |

---

### Fungsi Utama Halaman `/dashboard/apps`:

1. **Identitas & Pembeda Multi-SaaS (`app_id`):**
   - Menghasilkan ID unik (`app_id` / slug) yang dikirim oleh backend SaaS pada saat memanggil API transaksi.
   - Memastikan pembayaran masuk ke rekening proyek yang tepat (misal: membedakan antara _FastMail AI_ dan _IndoOCR API_).
2. **Branding Khusus Per-SaaS (Isolated Branding):**
   - **Nama & Logo SaaS:** Ditampilkan pada popup kasir in-app, scan QRIS, dan email tanda terima (receipt) ke pelanggan.
   - **Domain Web:** Asal domain yang diizinkan untuk memanggil SDK.
3. **Konfigurasi Teknis Per-SaaS:**
   - **Webhook URL:** Endpoint khusus untuk menerima notifikasi pembayaran sukses per SaaS (misal: `https://fastmail.ai/api/webhook`).
   - **Redirect URL:** URL redirect default setelah pengguna menyelesaikan pembayaran di browser.
4. **Log Transaksi & Mutasi Terisolasi (Scoped Transactions):**
   - Setiap kartu SaaS memiliki tab **"Transaksi & Mutasi"** khusus.
   - Developer bisa memantau omset, mutasi masuk, dan riwayat pembayaran SaaS A tanpa tercampur dengan transaksi SaaS B.
   - Tersedia tombol ekspor laporan mutasi per proyek SaaS.

---

## 3. Empat Pilar Arsitektur Developer SaaS

```mermaid
sequenceDiagram
    autonumber
    actor User as Pengguna SaaS
    participant SaaS_FE as Frontend SaaS (app.namasaas.com)
    participant SaaS_BE as Backend SaaS
    participant Tertaut as Tertaut MoR Gateway
    participant Bank as Rel Pembayaran (QRIS / VA)

    User->>SaaS_FE: Klik "Upgrade ke Pro"
    SaaS_FE->>SaaS_BE: POST /api/subscribe (Pilih Paket)
    Note over SaaS_BE: Hitung harga dinamis di kode SaaS<br/>(misal: 3 seat x Rp 45.000 = Rp 135.000)
    SaaS_BE->>Tertaut: POST /api/v1/checkout/session<br/>(Header: Bearer tt_sec_..., appId: app_xxx)
    Tertaut->>Bank: Create Transaction
    Bank-->>Tertaut: QRIS Payload / VA Number
    Tertaut-->>SaaS_BE: Session Data ({ checkoutUrl, transactionId })
    SaaS_BE-->>SaaS_FE: { checkoutUrl }
    Note over SaaS_FE: Redirect Pelanggan ke Hosted Checkout Tertaut<br/>(window.location.href = checkoutUrl)
    User->>Tertaut: Buka Halaman Checkout Resmi Tertaut (/pay)
    User->>Bank: Scan QRIS / Transfer VA
    Bank->>Tertaut: Payment Callback (LUNAS)
    Tertaut->>SaaS_BE: POST /webhooks/tertaut<br/>(Signed with Webhook Secret HMAC)
    Note over SaaS_BE: Verifikasi signature & Upgrade Akun User ke PRO
    SaaS_BE-->>Tertaut: HTTP 200 OK
    Tertaut-->>User: Tampilkan Sukses & Redirect ke returnUrl SaaS
```

### 1. Kredensial Pengembang (Developer Credentials)

Setiap akun developer di Tertaut memiliki:

- **`Secret Key` (`tt_sec_...`):** Disimpan di backend SaaS untuk membuat sesi transaksi dinamis.
- **`Webhook Secret` (`tt_whsec_...`):** Kunci privat untuk memverifikasi keaslian payload webhook via header `X-Tertaut-Signature`.
- **`API Base URL`:** `https://tertaut.com/api/v1`.

### 2. Transaksi Dinamis Berbasis Kode (Server-to-Server / S2S)

Backend SaaS cukup mengirim nominal berapapun yang telah mereka hitung sendiri melalui request `POST /api/v1/checkout/session`.

### 3. Hosted Checkout Resmi Tertaut (Redirect URL ala Stripe Checkout)

Pelanggan diarahkan ke halaman checkout resmi Tertaut (`checkoutUrl`), membayar dengan QRIS/VA, dan setelah lunas otomatis dialihkan kembali ke `redirectUrl` milik SaaS. Praktis, aman, dan tanpa perlu script modal rumit atau iframe yang berisiko memicu isu cross-origin.

### 4. Notifikasi Webhook Terverifikasi (HMAC-SHA256)

Server SaaS memvalidasi tanda tangan kriptografi sebelum mengaktifkan fitur pengguna secara instan.

---

## 4. Spesifikasi Teknis REST API & Webhook

### A. Endpoint Pembuatan Sesi (`POST /api/v1/checkout/session`)

Diperluas untuk mengenali otentikasi `Secret Key` dan menerima nominal dinamis dari backend SaaS.

#### Request Header:

```http
POST /api/v1/checkout/session HTTP/1.1
Host: tertaut.com
Authorization: Bearer tt_sec_live_79a1f2b8c3d4e5f6...
Content-Type: application/json
```

#### Request Body (SaaS Dynamic Mode):

```json
{
  "appId": "app_fastmail_01",
  "orderId": "SUB-2026-0091",
  "amount": 135000,
  "customerEmail": "budi@perusahaan.com",
  "customerName": "Budi Santoso",
  "description": "Langganan Paket Pro (3 Seats)",
  "paymentRail": "qris",
  "redirectUrl": "https://app.namasaas.com/dashboard?billing=success",
  "metadata": {
    "userId": "usr_9981",
    "tier": "pro",
    "seats": 3
  }
}
```

#### Response (HTTP 200 OK):

```json
{
  "success": true,
  "transactionId": "tx_8f91a2b3c4d5",
  "appId": "app_fastmail_01",
  "orderId": "SUB-2026-0091",
  "amount": 135000,
  "paymentRail": "qris",
  "qrString": "00020101021126670016ID.CO.QRIS...",
  "qrDataUrl": "data:image/png;base64,iVBORw0KGgo...",
  "ticket": "tkt_poll_8f91a2b3",
  "checkoutUrl": "https://tertaut.com/pay/session/tx_8f91a2b3c4d5",
  "expiresAt": "2026-10-08T17:45:00.000Z"
}
```

---

### B. Payload Webhook Notifikasi (`POST <URL_WEBHOOK_SAAS>`)

#### Webhook Header:

```http
POST /api/webhooks/tertaut HTTP/1.1
Content-Type: application/json
X-Tertaut-Signature: t=1791453600,v1=9a8b7c6d5e4f3a2b1c...
X-Tertaut-Event: payment.success
```

#### Webhook Body:

```json
{
  "event": "payment.success",
  "id": "evt_91a2b3c4",
  "createdAt": "2026-10-08T17:25:30.000Z",
  "data": {
    "transactionId": "tx_8f91a2b3c4d5",
    "appId": "app_fastmail_01",
    "orderId": "SUB-2026-0091",
    "amount": 135000,
    "netAmount": 128250,
    "platformFee": 6750,
    "status": "PAID",
    "paymentChannel": "QRIS",
    "customerEmail": "budi@perusahaan.com",
    "customerName": "Budi Santoso",
    "paidAt": "2026-10-08T17:25:29.000Z",
    "metadata": {
      "userId": "usr_9981",
      "tier": "pro",
      "seats": 3
    }
  }
}
```

#### Contoh Verifikasi di Backend SaaS (Node.js):

```typescript
import crypto from "crypto";

export function verifyTertautWebhook(
  rawBody: string,
  headerSignature: string,
  secret: string
): boolean {
  const [tPart, v1Part] = headerSignature.split(",");
  const timestamp = tPart?.replace("t=", "");
  const signature = v1Part?.replace("v1=", "");

  if (!timestamp || !signature) return false;

  const signedPayload = `${timestamp}.${rawBody}`;
  const expected = crypto.createHmac("sha256", secret).update(signedPayload).digest("hex");

  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}
```

---

## 5. Tata Letak Dashboard: Financial & Developer Console

Dashboard Tertaut disusun rapi menjadi menu-menu yang saling melengkapi:

| Menu Dashboard                                          | Posisi & Fungsi Utama                                                                                                                                                                                                                                                                                                                                                                                               |
| :------------------------------------------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **1. Ringkasan & Saldo (`/dashboard`)**                 | Overview pendapatan agregat, saldo bersih yang dapat ditarik (_Available Balance_), dan tombol **"Tarik Dana (Payout)"** ke rekening bank.                                                                                                                                                                                                                                                                          |
| **2. Log Transaksi Global (`/dashboard/transactions`)** | Riwayat seluruh transaksi dari semua aplikasi SaaS, filter status (_PAID, PENDING, EXPIRED_), pencarian email/orderId, rincian potongan fee MoR, dan unduh laporan CSV/Excel.                                                                                                                                                                                                                                       |
| **3. Registry Apps (`/dashboard/apps`)**                | **Manajemen Proyek & Multi-SaaS:** <br/>• Pilihan Tipe Proyek: **SaaS Web** vs **Desktop/Plugin**.<br/>• Tambah/Edit identitas (Nama, Domain, Logo, Webhook, Redirect URL).<br/>• Salin `app_id` untuk integrasi.<br/>• **Tab Transaksi & Mutasi Khusus App:** Melihat mutasi pendapatan khusus per-SaaS tanpa tercampur.<br/>• **Tab Lisensi (Khusus Tipe Desktop/Plugin):** Melihat daftar serial key & aktivasi. |
| **4. Developer Portal (`/dashboard/developer`)**        | Manajemen kredensial pengembang terpadu:<br/>• `Client Key` (`tt_pub_...`) & `Secret Key` (`tt_sec_...`)<br/>• `Webhook Secret` (`tt_whsec_...`)<br/>• Generator & tombol rotasi kunci.<br/>• Dokumentasi cepat & panduan curl.                                                                                                                                                                                     |
| **5. Webhook Logs & Tester (`/dashboard/webhooks`)**    | Log pengiriman webhook ke server SaaS pengembang: status HTTP respon, waktu pengiriman, tombol **"Kirim Ulang (Retry)"**, dan simulator pembayaran sandbox.                                                                                                                                                                                                                                                         |

---

## 6. Pembersihan & Eliminasi Fitur Bloat: Penghapusan Total AI Shield

Fitur **AI Shield / AI Proxy** (LLM token proxy, guardrail, credential vault) dihapus sepenuhnya dari codebase karena keluar dari fokus bisnis Tertaut sebagai Payment Gateway & MoR.

### Rincian Penghapusan:

1. **Frontend UI:**
   - Hapus view `src/client/src/views/AiProxyView.vue`.
   - Hapus komponen `src/client/src/components/aiproxy/*` (_TokenGuardrailsWidget_, _VaultCredentialsManager_, _AiProxyAuditTable_, _AiStreamingPlayground_).
   - Hapus menu "AI Shield" dari `DashboardSidebar.vue` dan `MobileNav.vue`.
   - Hapus rute `/ai-proxy` dari `src/client/src/router/index.ts`.
   - Bersihkan metode `getAiProxyLogs`, `testAiProxy` di `src/client/src/lib/api.ts` dan tipe di `types/aiproxy.ts`.
   - Bersihkan teks/banner AI Shield di Landing Page (`LandingHero.vue`, `LandingSolutions.vue`, `LandingPricing.vue`, `LandingCodeShowcase.vue`).
2. **Backend API & Service:**
   - Hapus routes `src/server/routes/aiproxy/*` dan unregister dari `src/server/routes/api.ts` dan `src/server/index.ts`.
   - Hapus service `src/server/services/ai/aiGateway.ts`.
3. **Database Schema & SDK:**
   - Bersihkan tabel `aiProxyLogs` dan `aiVaultCredentials` dari database schema.
   - Bersihkan modul `sdk.aiProxy` dari `packages/sdk`.
   - Sesuaikan file test agar 100% test lulus.

---

## 7. Peta Jalan Implementasi (Implementation Roadmap)

### Fase 1: Penghapusan Total Fitur AI Shield (De-bloat Codebase) [SELESAI]

- [x] Hapus view, komponen, menu sidebar, dan rute frontend AI Shield.
- [x] Bersihkan banner/promosi AI Shield pada Landing Page & Docs.
- [x] Hapus endpoint backend AI Proxy, service `aiGateway`, dan schema AI.
- [x] Pastikan seluruh test suite lulus 100% dan build frontend bersih tanpa error.

### Fase 2: Perombakan Konsep Registry Apps (`/dashboard/apps`) [SELESAI]

- [x] Berikan pilihan tipe proyek di awal pembuatan: **🚀 SaaS Web (Default)** vs **💻 Desktop App / Plugin**.
- [x] Untuk tipe **SaaS Web**: Sembunyikan seluruh modul lisensi DRM, file upload, dan target price kaku. Formulir murni fokus pada Nama SaaS, Domain/Logo, Brand Color, Webhook URL, dan Redirect URL.
- [x] Untuk tipe **Desktop App / Plugin**: Pertahankan engine lisensi otomatis Tertaut (`TT-XXXX-YYYY`).
- [x] Panel Ringkasan Konfigurasi & Spesifikasi Integrasi yang menampilkan identitas, webhook, domain, dan branding warna aplikasi.
- [x] Tambahkan 3 tab tampilan di detail setiap aplikasi: **Pengaturan SaaS**, **Mutasi & Transaksi Khusus App** (Scoped Ledger terisolasi), dan **Kredensial & Integrasi API**.

### Fase 3: Bypass Validasi Harga Dinamis (Backend S2S Checkout) [SELESAI]

- [x] Sesuaikan `handleCreateSession` di `session.ts` agar saat request membawa otorisasi `Secret Key` atau nominal dinamis (atau tipe `saas_web`), sistem tidak memaksakan pencocokan terhadap targetPrice produk statis.
- [x] Izinkan nominal arbitrer bebas (`amount`) yang dikirim dari kodingan backend SaaS pengembang.
- [x] Return `checkoutUrl` resmi Tertaut dan data sesi lengkap untuk pengalihan (Hosted Checkout).
- [x] Unit/integration test `28_saas_payment_gateway.test.ts` terverifikasi 100% lulus.

### Fase 4: Standardisasi Kredensial Pengembang & Menu Developer Portal [SELESAI]

- [x] Pastikan tabel `builders` memiliki `secretApiKey` (`tt_sec_...`) dan `webhookSecret` (`tt_whsec_...`).
- [x] Sediakan menu khusus `/dashboard/developer` untuk melihat & merotasi kunci API.

### Fase 5: Standardisasi Webhook Payload & Signature (HMAC-SHA256) [SELESAI]

- [x] Standardisasi format header `X-Tertaut-Signature` dengan HMAC-SHA256.
- [x] Sertakan `appId`, `orderId`, `customerName`, dan `metadata` di dalam payload event `payment.success`.
- [x] Sediakan log pengiriman webhook dan alat uji coba simulasi webhook di dashboard.
