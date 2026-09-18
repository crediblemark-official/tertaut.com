# SPESIFIKASI PRODUK DETIL (PRD) — MODUL 5: LAUNCH KIT & DEVELOPER SDK

**Versi**: 3.0 (Launch Automation, Embeddable Widgets & AI-First Developer SDK)  
**Status**: Approved for Engineering  
**Modul Parent**: tertaut.com (Engine Infrastructure)  
**Tech Stack Alignment**: ElysiaJS (Bun) + TypeScript + Vue 3 / Web Components + Resend/Nodemailer API  

---

## 1. Metadata Dokumen

| Parameter | Detail |
|---|---|
| **Nama Modul** | Launch Kit & Developer SDK |
| **Kode Modul** | MOD-05 |
| **Target User** | AI App Builders, Vibe Coders, Indie Hackers, Cross-Platform Developers |
| **Tujuan Utama** | Memfasilitasi alur pemicuan peluncuran produk secara instan, pengiriman notifikasi massal ke pendaftar waitlist, penyediaan embeddable widgets, serta penyediaan SDK serba ada yang dioptimalkan untuk AI Assistant (Cursor, Windsurf, v0). |
| **Integrasi Utama** | Modul 1 (Smoke Test), Modul 2 (Checkout), Modul 3 (Licensing), Modul 4 (AI Proxy) |

---

## 2. Ringkasan & Visi Modul

Modul 5 adalah jembatan yang menghubungkan fase validasi ide (Modul 1) ke fase monetisasi live (Modul 2, 3, dan 4). Setelah builder membuktikan adanya potensi pasar lewat metrik Intent Conversion Rate ($ICR$), Modul 5 bertugas mempermudah transisi peluncuran produk secara mulus (*frictionless*).

Modul ini menyediakan tiga komponen utama:
1. **Automated Launch Engine**: Sekali klik untuk mengubah status produk dari `smoke_test` / `ACTIVE_FAKEDOOR` ke `live` / `LIVE_CHECKOUT` sekaligus menyebarkan email pemberitahuan rilis otomatis ke seluruh calon pembeli terdaftar (*captured leads*).
2. **Embeddable Launch Badges & Widgets**: Widget HTML/JS berukuran ultra-ringan untuk menampilkan status Live, jumlah pembeli, atau Trust Badge pada landing page eksternal.
3. **AI-First Lightweight SDK (`@tertaut/sdk`)**: Pustaka JavaScript/TypeScript serba ada berukuran $< 15\text{ KB}$ dengan dokumentasi berformat Prompt-Ready Docs yang siap dimasukkan ke editor berbasis AI (Cursor, Windsurf, v0).

---

## 3. Spesifikasi Arsitektur System Launch & SDK

```
[ Dashboard Builder ] ───► (1) Klik "Convert to Live Launch"
                              │
                              ▼
                [ Modul 5 Launch Engine ]
                              │
      ┌───────────────────────┼───────────────────────┐
      ▼                       ▼                       ▼
[ Switch App Status ]   [ Trigger Email Broadcast ]   [ Generate Embed Code ]
Modul 1 -> Modul 2      Kirim Email Diskon/Rilis       Badges, Widget & SDK Snippet
                        ke Seluruh Leads (Modul 1)
                              │
                              ▼
                [ Client Application / LP ]
                Menggunakan @tertaut/sdk
```

---

## 4. Persyaratan Fungsional (Functional Requirements)

### 4.1 One-Click Live Launch & Automated Waitlist Broadcast
- **FR-1.1 (Status Transition Automation)**: Builder dapat mengalihkan status kampanye dari `smoke_test` ke `live` dengan satu tombol aksi di Dashboard tertaut.com.
- **FR-1.2 (Waitlist Email Queue Engine)**: Saat pemicuan Live Launch dieksekusi, sistem secara otomatis mengantrekan (*queue*) pengiriman email massal kepada seluruh daftar email yang ada di tabel leads.
- **FR-1.3 (Dynamic Coupon & Incentive Injection)**: Email rilis otomatis menyertakan pesan ucapan terima kasih, link checkout aktif Modul 2 (`tertaut.com/pay/:slug`), dan kode kupon/diskon eksklusif akses awal.

### 4.2 Embeddable Launch Badges & Social Trust Widgets
- **FR-2.1 (Embeddable Web Component / Script)**: Menyediakan skrip terisolasi yang dapat dipasang di situs web eksternal melalui tag `<script>` atau Web Component `<tertaut-badge>`.
- **FR-2.2 (Widget Types)**:
  - **Verified Trust Badge**: Menampilkan indikator "Verified Product by tertaut.com".
  - **Sales Counter Widget**: Menampilkan jumlah total lisensi yang telah terjual (*Real-time Social Proof*).
  - **Status Indicator**: Menampilkan status terkini ("Just Launched", "Smoke Test Validation", atau "Live Order").

### 4.3 AI-First Lightweight JavaScript/TypeScript SDK (`@tertaut/sdk`)
- **FR-3.1 (Ultra-Lightweight Size)**: Ukuran bundel SDK wajib $< 15\text{ KB}$ (*minified + gzipped*) tanpa ketergantungan (*zero heavy third-party dependencies*).
- **FR-3.2 (Unified Interface)**: SDK menyediakan akses terpadu ke seluruh modul tertaut.com:
  - `tertaut.fakedoor()` $\rightarrow$ Pemicu modal validasi Modul 1.
  - `tertaut.checkout()` $\rightarrow$ Redirect / popup checkout Modul 2.
  - `tertaut.licensing` $\rightarrow$ Pengecekan & aktivasi lisensi Modul 3.
  - `tertaut.aiProxy` $\rightarrow$ Panggilan gateway AI Shield Modul 4.

### 4.4 Developer Center & Prompt-Ready Documentation Generator
- **FR-4.1 (Prompt-Ready Docs Generator)**: Dashboard menyediakan opsi "Copy Integration Prompt for AI". Teks markdown ini memuat instruksi spesifik yang siap di-paste ke Cursor, Windsurf, atau v0 untuk melakukan integrasi otomatis.
- **FR-4.2 (Interactive API Explorer)**: Halaman dokumentasi interaktif yang memungkinkan builder menguji request SDK secara langsung dengan API Key uji coba (*Sandbox Mode*).

---

## 5. End-to-End Workflows

### 5.1 One-Click Launch & Waitlist Broadcast Workflow
1. Builder melihat metrik $ICR \ge 10\%$ pada kampanye validasi Modul 1.
2. Builder menekan tombol "Launch Product Live" di Dashboard tertaut.com.
3. Sistem menampilkan dialog konfirmasi pengisian Kupon Diskon Akses Awal (misal: `EARLY50` - Potongan $50\%$).
4. Backend ElysiaJS memproses transaksi transisi:
   - Status kampanye berubah menjadi `live`.
   - Endpoint publik `/v/:slug` secara otomatis meneruskan (*redirect*) pengunjung ke `/pay/:slug` (Modul 2 Checkout).
   - Sistem memasukkan seluruh email leads ke dalam antrean pengiriman email (*broadcast queue*).
5. Pekerja latar belakang (*Background worker*) mengirimkan email pemberitahuan rilis bertahap hingga seluruh pendaftar terkirim.

### 5.2 Client App SDK Integration Workflow
1. Builder menyalin Prompt Docs dari Dashboard tertaut.com.
2. Builder menempelkan (*paste*) prompt tersebut ke AI Editor (misalnya Cursor IDE).
3. AI Editor mengunduh `@tertaut/sdk` dan menuliskan fungsi pemanggilan fitur sesuai rekomendasi SDK Contract.
4. Aplikasi client siap dijalankan dan terintegrasi penuh secara otomatis.

---

## 6. Skema Data (Database Schema)

```sql
-- Tabel Antrean Pengiriman Email Waitlist Broadcast
CREATE TABLE launch_broadcast_queues (
    id VARCHAR(36) PRIMARY KEY,
    campaign_id VARCHAR(36) NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
    builder_id VARCHAR(36) NOT NULL REFERENCES builders(id) ON DELETE CASCADE,
    subject VARCHAR(200) NOT NULL,
    email_body TEXT NOT NULL,
    total_recipients INT NOT NULL DEFAULT 0,
    processed_recipients INT NOT NULL DEFAULT 0,
    status VARCHAR(20) DEFAULT 'PENDING', -- PENDING, PROCESSING, COMPLETED, FAILED
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_broadcast_campaign ON launch_broadcast_queues(campaign_id);

-- Tabel Detail Status Pengiriman per Email
CREATE TABLE launch_broadcast_logs (
    id VARCHAR(36) PRIMARY KEY,
    queue_id VARCHAR(36) NOT NULL REFERENCES launch_broadcast_queues(id) ON DELETE CASCADE,
    recipient_email VARCHAR(255) NOT NULL,
    status VARCHAR(20) DEFAULT 'QUEUED', -- QUEUED, SENT, FAILED
    error_message TEXT,
    sent_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_broadcast_logs_queue ON launch_broadcast_logs(queue_id);
```

---

## 7. Spesifikasi API & SDK Contract

### 7.1 Backend API Endpoints (ElysiaJS Backend)

#### A. Trigger One-Click Live Launch
- **Endpoint**: `POST /api/v1/launch/convert-to-live` (Protected Route)
- **Payload**:
```json
{
  "campaignId": "cmp_89f1a23b",
  "discountPercent": 50,
  "customEmailMessage": "Halo! Aplikasi FastMail AI yang Anda tunggu telah resmi rilis. Gunakan kupon diskon 50% ini!"
}
```
- **Response (200 OK)**:
```json
{
  "success": true,
  "message": "Campaign converted to LIVE. Waitlist broadcast queued.",
  "data": {
    "campaignId": "cmp_89f1a23b",
    "liveCheckoutUrl": "https://tertaut.com/pay/fastmail-ai",
    "totalLeadsQueued": 142
  }
}
```

#### B. Fetch Embeddable Widget Data
- **Endpoint**: `GET /api/v1/widgets/badge/:app_slug`
- **Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "appName": "FastMail AI",
    "status": "LIVE",
    "verifiedBy": "tertaut.com",
    "totalCustomers": 89
  }
}
```

### 7.2 `@tertaut/sdk` Bundle Architecture & Public Methods

```typescript
// Contoh Antarmuka Ekspor SDK Utama
import { Tertaut } from '@tertaut/sdk';

const tertaut = new Tertaut({
  appId: 'app_987123',
  environment: 'production' // 'sandbox' | 'production'
});

// Modul 1: Smoke Test / Fake Door Interceptor
tertaut.fakedoor({
  productName: 'FastMail AI',
  targetPrice: 49000
});

// Modul 2: Direct Live Checkout
tertaut.checkout({
  amount: 49000,
  grantDays: 30,
  redirectUrl: 'https://myapp.com/dashboard'
});

// Modul 3: Offline/Online Licensing Check
const licenseStatus = await tertaut.licensing.verify({
  licenseKey: 'TAUT-A8F2-9012-34BC',
  hwid: 'e3b0c44298fc1c149afbf4c8996fb...'
});

// Modul 4: Streaming AI Proxy Gateway
const stream = await tertaut.aiProxy.chatStream({
  licenseToken: 'eyJhbGciOiJSUzI1NiIsInR5c...',
  modelAlias: 'fast-summary-model',
  messages: [{ role: 'user', content: 'Halo AI!' }]
});
```

---

## 8. Persyaratan Non-Fungsional (NFR)

- **Email Deliverability & Rate Control**: Pekerja pengirim email (*Worker Queue*) wajib membatasi kecepatan pengiriman maksimal $50\text{ email/detik}$ untuk mencegah pembatasan (*rate-limiting*) atau spam flag dari penyedia SMTP/Email API.
- **Zero-Dependency SDK**: Pustaka `@tertaut/sdk` wajib tidak bergantung pada pustaka eksternal (*zero heavy third-party dependencies*) agar kompatibel di seluruh lingkungan runtime (Node.js, Bun, Browser, Chrome Extension, Tauri, React Native).
- **CORS & Embed Security**: Skrip widget embed wajib dikonfigurasi aman agar tidak mengganggu layout (*CSS encapsulation/Shadow DOM*) situs web tempat widget dipasang.