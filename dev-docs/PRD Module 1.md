# SPESIFIKASI PRODUK DETIL (PRD) — MODUL 1: BUILT-IN FAKE DOOR / SMOKE TEST ENGINE & BUILDER

**Versi**: 3.0 (Standalone Engine with Built-in Hosted Page Builder & SDK)  
**Status**: Approved for Engineering  
**Modul Parent**: tertaut.com (Engine Infrastructure)  
**Tech Stack Alignment**: ElysiaJS (Bun) + Vue 3 (Tailwind CSS / shadcn-vue) + PostgreSQL / SQLite

---

## 1. Metadata Dokumen

| Parameter           | Detail                                                                                                           |
| ------------------- | ---------------------------------------------------------------------------------------------------------------- |
| **Nama Modul**      | Fake Door / Smoke Test Engine & Hosted Page Builder                                                              |
| **Kode Modul**      | MOD-01                                                                                                           |
| **Target User**     | Vibe Coders, Solo Builders, Indie Hackers, Cross-Platform Developers                                             |
| **Tujuan Utama**    | Mengukur Intent Conversion Rate ($ICR$) calon pembeli sebelum penulisan kode utama aplikasi dimulai.             |
| **Metode Validasi** | Dual Approach: (1) Built-in No-Code Hosted Builder (`tertaut.com/v/:slug`), dan (2) Client SDK (`@tertaut/sdk`). |

---

## 2. Ringkasan & Visi Modul

Modul 1 dirancang untuk memecahkan masalah utama vibe coder: menghabiskan waktu berhari-hari membuat aplikasi yang ternyata tidak diminati pasar.

Dengan Modul 1 di **tertaut.com**, builder dapat menguji minat bayar pasar dalam waktu kurang dari 2 menit melalui dua jalur:

1. **Built-in Hosted Page Builder (`tertaut.com/v/:slug`)**: Membuat dan memublikasikan halaman validasi minimalis zero-code langsung dari dashboard tertaut.com.
2. **Dynamic SDK (`@tertaut/sdk`)**: Memasang modal interceptor validasi pada situs web kustom, aplikasi desktop (Tauri/Electron), ekstensi Chrome, atau APK Android buatan sendiri.

---

## 3. Spesifikasi Arsitektur Pendekatan Dual (Hybrid)

```
                               ┌─────────────────────────────────────────┐
                               │           tertaut.com ENGINE            │
                               └────────────────────┬────────────────────┘
                                                    │
                      ┌─────────────────────────────┴─────────────────────────────┐
                      ▼                                                           ▼
         [ JALUR 1: Hosted Page Builder ]                            [ JALUR 2: Dynamic SDK Engine ]
         Halaman /v/:slug publik di-host                             Modal Pop-up Interceptor di-embed
         langsung oleh ElysiaJS / Vue                                ke web/aplikasi kustom builder
                      │                                                           │
                      └─────────────────────────────┬─────────────────────────────┘
                                                    │
                                                    ▼
                                     [ Intent Capture & Analytics ]
                                     - Hits/Clicks Count (C)
                                     - Captured Email Leads (L)
                                     - ICR = (L / C) * 100%
```

---

## 4. Persyaratan Fungsional (Functional Requirements)

### 4.1 Built-in No-Code Hosted Page Builder

- **FR-1.1 (Campaign Management)**: Builder dapat membuat, membaca, memperbarui, dan menghapus (CRUD) kampanye validasi dari dashboard tertaut.com.
- **FR-1.2 (Custom Slug Validation)**: Setiap kampanye menghasilkan URL unik `tertaut.com/v/:slug`. Sistem memvalidasi ketersediaan slug secara real-time via API.
- **FR-1.3 (Visual Content Configuration)**: Form editor wajib mendukung bidang berikut:
  - Title & Headline Produk
  - Sub-headline / Deskripsi Singkat
  - Target Price (Nominal Simulasi Harga dalam IDR)
  - Media Preview (URL Gambar CDN / Youtube Embed Video ID)
  - Value Proposition Bullets (3-5 poin keunggulan produk)
  - CTA Button Text (Default: "Beli Sekarang - Rp X")
  - Custom Intent Message (Pesan modal saat CTA diklik)

### 4.2 Dynamic SDK Interceptor (@tertaut/sdk)

- **FR-2.1 (Headless Modal Interceptor)**: SDK menyediakan method `tertaut.smokeTest(options)` / `tertaut.fakedoor(options)` yang secara otomatis memunculkan modal Intent Capture siap pakai tanpa perlu mendesain UI dari nol.
- **FR-2.2 (Cross-Platform Support)**: SDK berukuran $< 15\text{ KB}$ dan dapat berjalan di browser, Chrome Extension (`chrome.storage`), Tauri/Electron, serta WebView mobile.

### 4.3 Intent Capture & Lead Collection

- **FR-3.1 (Click Tracking Event)**: Setiap kali tombol CTA utama diklik, sistem merekam 1 angka Unique Click ($C$) berdasarkan sesi visitor.
- **FR-3.2 (Email Capture Form)**: Modal wajib menyediakan input email yang memvalidasi format sintaks email standard.
- **FR-3.3 (Duplicate Lead Prevention)**: Satu email hanya dihitung 1 kali per kampanye validasi.

### 4.4 Analytics Calculation Engine

- **FR-4.1 (Metrics Calculation)**: Dashboard menghitung dan menampilkan Intent Conversion Rate ($ICR$) secara otomatis:
  $$ICR = \left( \frac{L}{C} \right) \times 100\%$$
  Di mana $L$ adalah total lead email terverifikasi, dan $C$ adalah total klik tombol CTA unik.

### 4.5 One-Click Live Launch Transition

- **FR-5.1 (Status Switching)**: Builder dapat mengubah status kampanye dari `smoke_test` / `ACTIVE_FAKEDOOR` menjadi `live` / `LIVE_CHECKOUT`.
- **FR-5.2 (Auto Waitlist Notification)**: Saat status beralih ke `LIVE_CHECKOUT`, sistem memicu pengiriman email massal otomatis kepada seluruh $L$ (leads) yang terdaftar, memberi tahu bahwa aplikasi telah rilis lengkap dengan diskon awal.

---

## 5. End-to-End Workflows

### 5.1 Builder Workflow (Creating Validation Page)

1. Builder masuk ke Dashboard tertaut.com $\rightarrow$ Menu Smoke Test / Fake Door Builder.
2. Klik "Create New Campaign".
3. Mengisi judul, slug, harga simulasi, deskripsi, poin keunggulan, dan pesan konfirmasi.
4. Klik "Publish Page".
5. Sistem menerbitkan URL `tertaut.com/v/:slug` yang siap disebarkan ke media sosial / komunitas.

### 5.2 Visitor Workflow (Hosted Page Interaction)

1. Pengunjung membuka `tertaut.com/v/:slug`.
2. Pengunjung membaca penawaran dan menekan tombol "Beli Sekarang - Rp 49.000".
3. Backend memicu pencatatan Event Click ($C = C + 1$).
4. Modal Overlay muncul dengan Custom Intent Message (misal: "Aplikasi rilis 3 hari lagi. Masukkan email untuk diskon 50%!").
5. Pengunjung memasukkan email dan menekan "Dapatkan Akses Awal".
6. Sistem menyimpan data email ke tabel leads ($L = L + 1$) dan menampilkan kupon diskon awal (`EARLY50`).

### 5.3 Live Transition Workflow

1. Builder melihat analitik di dashboard: $ICR \ge 10\%$.
2. Builder menekan tombol "Convert to Live Checkout".
3. Sistem secara otomatis:
   - Mengubah URL `/v/:slug` menjadi halaman Dynamic Live Checkout (Modul 2).
   - Mengirim email notifikasi otomatis ke semua email di daftar waitlist leads.

---

## 6. Skema Data (Database Schema)

```sql
-- Tabel Utama Kampanye Fake Door & Hosted Builder
CREATE TABLE fakedoor_campaigns (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    slug VARCHAR(100) UNIQUE NOT NULL,
    title VARCHAR(150) NOT NULL,
    headline TEXT NOT NULL,
    subheadline TEXT,
    media_url TEXT,
    target_price DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    cta_text VARCHAR(50) DEFAULT 'Beli Sekarang',
    custom_intent_message TEXT,
    status VARCHAR(20) DEFAULT 'ACTIVE_FAKEDOOR', -- ACTIVE_FAKEDOOR, PAUSED, CONVERTED_TO_LIVE
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexing untuk kecepatan query load-time Hosted Page (< 200ms)
CREATE INDEX idx_fakedoor_slug ON fakedoor_campaigns(slug);
CREATE INDEX idx_fakedoor_user ON fakedoor_campaigns(user_id);

-- Tabel Tracking Click Event (Visitor Clicks)
CREATE TABLE fakedoor_clicks (
    id VARCHAR(36) PRIMARY KEY,
    campaign_id VARCHAR(36) NOT NULL REFERENCES fakedoor_campaigns(id) ON DELETE CASCADE,
    visitor_ip VARCHAR(45),
    user_agent TEXT,
    referrer_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabel Data Lead Email (Captured Leads)
CREATE TABLE fakedoor_leads (
    id VARCHAR(36) PRIMARY KEY,
    campaign_id VARCHAR(36) NOT NULL REFERENCES fakedoor_campaigns(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    is_notified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_lead_per_campaign UNIQUE(campaign_id, email)
);
```

---

## 7. Spesifikasi API & SDK Contract

### 7.1 Public API Endpoints (ElysiaJS Backend)

#### A. Fetch Hosted Page Data

- **Endpoint**: `GET /api/v1/fakedoor/public/:slug` (dan `/api/v1/smoke-test/public/:slug`)
- **Response (200 OK)**:

```json
{
  "success": true,
  "data": {
    "campaignId": "cmp_89f1a23b",
    "title": "FastMail AI",
    "headline": "Ringkas Email dalam 3 Detik",
    "subheadline": "Hemat waktu baca email kerjaan setiap pagi secara otomatis.",
    "mediaUrl": "https://cdn.tertaut.com/demo.png",
    "targetPrice": 49000,
    "ctaText": "Beli Lisensi - Rp 49rb",
    "customIntentMessage": "Aplikasi dalam persiapan rilis. Masukkan email untuk diskon 50%!"
  }
}
```

#### B. Record Click Event

- **Endpoint**: `POST /api/v1/fakedoor/public/click` (dan `/api/v1/smoke-test/public/click`)
- **Payload**:

```json
{
  "campaignId": "cmp_89f1a23b",
  "referrer": "https://x.com"
}
```

#### C. Capture Lead Email

- **Endpoint**: `POST /api/v1/fakedoor/public/lead` (dan `/api/v1/smoke-test/public/lead`)
- **Payload**:

```json
{
  "campaignId": "cmp_89f1a23b",
  "email": "calonpembeli@gmail.com"
}
```

- **Response (201 Created)**:

```json
{
  "success": true,
  "message": "Lead captured successfully",
  "data": {
    "discountCode": "EARLY50"
  }
}
```

---

## 8. Persyaratan Non-Fungsional (NFR)

- **Performa Load Hosted Page**: Halaman `/v/:slug` wajib di-render dan dapat dimuat oleh browser visitor dalam waktu $< 200\text{ ms}$.
- **Spam & Anti-Bot Protection**: Rate limiting diterapkan pada endpoint `POST /lead` maksimal 3 kali submit per alamat IP per jam.
- **SEO & OpenGraph Dynamic Cards**: Halaman `/v/:slug` otomatis merender `<meta og:title>`, `<meta og:description>`, dan `<meta og:image>` agar menarik saat dibagikan di Twitter/X, LinkedIn, atau WhatsApp.
