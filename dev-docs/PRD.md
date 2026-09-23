# DOKUMEN SPESIFIKASI PRODUK (PRD) — tertaut.com

**Versi**: 2.2 (Tech Stack & Single Container Architecture Blueprint)  
**Status**: Approved for Engineering  
**Peran Sistem**: Headless Developer Infrastructure Engine (Monetization, Licensing, AI Protection, Validation & Launch Kit)

---

## 1. Informasi & Metadata Dokumen

| Parameter             | Detail                                                                             |
| --------------------- | ---------------------------------------------------------------------------------- |
| **Nama Produk**       | `tertaut.com`                                                                      |
| **Kategori**          | Developer Infrastructure Engine & Monetization-as-a-Service                        |
| **Integrasi Etalase** | `situsbisnis.com` (Front-end Storefront & Distribution Layer)                      |
| **Target Audience**   | Vibe Coders, Solo Builders, Indie Hackers, Chrome Extension & Desktop/APK Builders |
| **Model Bisnis**      | Merchant of Record (MoR) dengan Platform Fee $5\%$ per transaksi                   |
| **Payment Partner**   | Xendit Payment & Disbursement Infrastructure                                       |

---

## 2. Ringkasan Eksekutif & Visi Produk

**tertaut.com** dirancang sebagai mesin backend headless yang memangkas seluruh beban administratif dan teknis vibe coder. Platform ini menyediakan infrastruktur:

- **Validasi Ide Awal**: Smoke Test / Fake Door Engine sebelum koding dimulai.
- **Monetisasi Instan**: Tanpa akun Payment Gateway (PG) sendiri & tanpa badan hukum (PT/CV).
- **Validasi Lisensi Universal**: Multi-platform (Chrome Extension, Desktop Tauri/Electron, Web, Mobile APK).
- **Pengamanan API Key AI**: Serverless AI Proxy Shield dengan enkripsi zero-leak.
- **Perangkat Peluncuran Produk**: Launch Kit, Waitlist Notifier, dan Trust Badge embeddable.

Dengan memindahkan urusan etalase publik ke `situsbisnis.com`, `tertaut.com` berfokus murni menjadi **backend engine** yang ringan, aman, dan dapat diintegrasikan hanya dalam hitungan menit via SDK/API.

---

## 3. Problem Statement & Target Persona

### 3.1 Problem Statement

1. **Validasi Berbiaya Tinggi**: Vibe coder sering menghabiskan waktu koding berminggu-minggu untuk produk yang ternyata tidak memiliki pasar atau minat bayar riil.
2. **Kerumitan Pembayaran & Legalitas**: Penyiapan payment gateway (PG) lokal rumit, membutuhkan verifikasi dokumen hukum entitas bisnis (PT/CV), serta biaya penanganan awal yang tinggi.
3. **Kebocoran Kredensial AI**: API Key AI rentan diretas (_reverse-engineered_) jika ditanam di aplikasi client-side.
4. **Hambatan Lisensi Lintas Platform**: Pengembang kesulitan mengunci akses aplikasi di ekstensi browser, aplikasi desktop offline, maupun APK Android.

### 3.2 Target User Persona

- **Vibe Coder / Solo Builder**: Membuat aplikasi menggunakan AI (_Cursor_, _v0_, _Windsurf_), fokus pada fungsionalitas, tidak mau pusing urusan backend pembayaran, registrasi PG, dan otentikasi.
- **Client-Side Developer**: Mengembangkan aplikasi desktop (_Tauri/Electron_), Ekstensi Chrome, atau APK Android yang membutuhkan pengamanan kredensial dan lisensi offline/online.

---

## 4. Breakdown Modul & Fitur Utama

```
                                [ TERTAUT.COM ENGINE ]
                                           │
     ┌─────────────────┬───────────────────┼───────────────────┬─────────────────┐
     ▼                 ▼                   ▼                   ▼                 ▼
 [ Modul 1 ]       [ Modul 2 ]         [ Modul 3 ]         [ Modul 4 ]       [ Modul 5 ]
Smoke Test /      Dynamic Checkout    Universal Licensing  AI API Proxy     Launch Kit & SDK
 Fake Door         (MoR Payments)      (Multi-Platform)      Shield         (Developer Center)
(Validation)
```

### Modul 1: Built-in Smoke Test / Fake Door Engine (Validasi Ide)

Mekanisme validasi minat pembeli asli sebelum kode aplikasi dibuat:

- **Mode Dynamic SDK (`mode: "smoke_test"` / `"fakedoor"`)**: Memungkinkan builder memasang tombol bayar fiktif di landing page atau situsbisnis.com.
- **Hosted Page Builder (`tertaut.com/v/:slug`)**: Landing page validasi instan zero-code dengan live mobile mockup preview dan verifikasi vanity slug.
- **Intent Capture & Modal Interceptor**: Saat pengunjung menekan tombol bayar, sistem menampilkan konfirmasi ketersediaan slot/akses awal, menangkap email pembeli ($L$), dan membagikan diskon early bird.
- **Metrics Analytics**: Menghitung Intent Conversion Rate ($ICR$) secara otomatis:
  $$ICR = \left( \frac{\text{Pengunjung Niat Bayar / Leads } (L)}{\text{Total Klik CTA } (C)} \right) \times 100\%$$
- **One-Click Convert to Live**: Alert emas otomatis saat $ICR \ge 10\%$ untuk mengalihkan produk ke mode pembayaran aktif.

### Modul 2: Dynamic & Headless Checkout (MoR Engine via Xendit)

Infrastruktur transaksi finansial tanpa konfigurasi produk kaku di dashboard:

- **Poin Utama MoR (Zero PG & Zero Legal Entity)**: Builder **TIDAK PERLU** memiliki akun Payment Gateway sendiri dan **TIDAK PERLU** mendirikan PT/CV. `tertaut.com` memproses pembayaran atas nama platform via Xendit dan mencairkan uang bersih ke rekening pribadi builder.
- **Hosted Checkout Page (`tertaut.com/pay/:slug`)**: Halaman checkout publik instan dengan rincian biaya transparan dan penangkapan email lisensi.
- **Headless Checkout Session**: Transaksi dipicu langsung via parameter URL/SDK (`amount`, `grantDays`, `buyerEmail`, `redirectUrl`).
- **Xendit Multi-Payment Rail**: Menerima QRIS instan (GoPay, OVO, DANA, BCA QRIS), Virtual Account (BCA, Mandiri, BRI, BNI), dan E-Wallet Direct.
- **Xendit Automated Disbursement**: Pencairan otomatis saldo bersih ($95\%$ setelah potong platform fee $5\%$) dengan ambang batas minimum $\ge \text{Rp } 50.000$.
- **Webhook Idempotency & Token Security**: Validasi `x-callback-token` dan perlindungan idempotensi agar tidak terjadi duplikasi lisensi atau saldo saat callback berulang.

### Modul 3: Universal Licensing Engine & Anti-Piracy Guard

Sistem penerbitan dan validasi kunci lisensi multi-platform:

- **Format Kunci Lisensi**: Format baku anti-typo `TT-XXXX-XXXX-XXXX`.
- **Hardware Binding (Desktop)**: Pengikatan kunci lisensi ke Hardware ID (CPU/Motherboard hash) pengguna.
- **Chrome Sync Storage**: Auto-inject lisensi ke `chrome.storage.sync` pasca-pembayaran.
- **Android Deep-Link Activation**: Aktivasi otomatis di aplikasi Android via URL scheme (`tertaut://activate?license=...`).
- **JWT Offline Fallback (30 Days Grace Period)**: Penerbitan token terenkripsi agar aplikasi desktop/offline tetap berfungsi tanpa koneksi internet selama 30 hari.

### Modul 4: AI API Proxy Shield & Cost Guardrails

Gateway serverless untuk mengamankan API Key AI dan mengendalikan biaya pemakaian:

- **Encrypted Key Vault**: Kunci API (OpenAI, Anthropic, Gemini) disimpan di server `tertaut.com` terenkripsi AES-256-GCM. Client hanya mengirimkan lisensi token.
- **Real-time Metering & Rate Limiting**: Membatasi kuota panggilan API berdasarkan transaksi/paket pengguna.
- **Auto-Kill Switch**: Pemutusan otomatis akses pemanggilan API jika terdeteksi aktivitas botting atau pemakaian abnormal.

### Modul 5: Launch Kit & Waitlist Notifier

Amunisi peluncuran cepat dan retensi calon pembeli:

- **One-Click Launch URL (`tertaut.com/p/:slug`)**: Halaman etalase serbaguna yang siap di-link dari `situsbisnis.com`.
- **Waitlist Auto-Notifier**: Pengiriman email massal otomatis ke seluruh calon pembeli fase Smoke Test saat status produk beralih ke `live`.
- **Embeddable Launch Badge**: Widget indikator status produk (_Just Launched_, _Uptime_, _Trust Badge_) untuk dipasang di situs eksternal.

### Modul 6: Developer Center & Lightweight SDK

Pustaka koding serba ada yang dioptimalkan untuk AI Assistant:

- **Lightweight JS/TS SDK (`@tertaut/sdk`)**: Pustaka berukuran $< 15\text{ KB}$ untuk integrasi lisensi, checkout, dan AI proxy.
- **Prompt-Ready Integration Docs**: Dokumentasi berformat khusus yang bisa langsung di-copy paste ke Cursor, Windsurf, atau v0.

---

## 5. Spesifikasi Stack Teknologi & Arsitektur Deployment

### 5.1 High-Level Tech Stack

| Komponen               | Pilihan Teknologi                                | Keterangan                                                        |
| ---------------------- | ------------------------------------------------ | ----------------------------------------------------------------- |
| **Backend Framework**  | ElysiaJS (Bun Runtime)                           | Sangat cepat, hemat memori, dan end-to-end type safety TypeScript |
| **Frontend Framework** | Vue 3 (Composition API `<script setup>`)         | Ringan, reaktif, dan performa tinggi bersama Vite                 |
| **Styling & UI**       | Tailwind CSS / Vanilla CSS + Lucide Icons        | Palet Light Mode Luxury (Putih, Hitam Pekat, Emas, Forest Green)  |
| **Payment Gateway**    | Xendit Invoice API & Disbursement API            | Multi-rail (QRIS, VA, E-Wallet) dan Instant Payout                |
| **Database & ORM**     | PostgreSQL + Drizzle ORM                         | Relasional, kuat, zero-mock, dan audit trail presisi              |
| **Cache & In-Memory**  | Redis                                            | Rate-limiting AI proxy & session cache                            |
| **Security & Vault**   | Node.js Crypto (AES-256-GCM) + JWT (RS256/HS256) | Proteksi kredensial AI dan token lisensi offline                  |

### 5.2 Single Container Monolithic Deployment Architecture

```
┌─────────────────────────────────────────────────────────┐
│              DOCKER CONTAINER (Single Node)             │
│                                                         │
│  ┌───────────────────────────────────────────────────┐  │
│  │ Bun Runtime / ElysiaJS Web Server                 │  │
│  │                                                   │  │
│  │  ├── /api/v1/*        (Elysia REST API Endpoints) │  │
│  │  ├── /api/v1/webhook  (Xendit Webhook Handler)    │  │
│  │  └── /*               (Elysia Static Plugin)      │  │
│  │                            │                      │  │
│  └────────────────────────────┼──────────────────────┘  │
│                               ▼                         │
│                  [ Built Vue 3 SPA Assets ]             │
│                       (/dist folder)                    │
└─────────────────────────────────────────────────────────┘
```

> [!NOTE]
> **Kelebihan Single Container**:
>
> 1. **Zero CORS Issues**: API dan Dashboard SPA berjalan pada domain dan port yang sama.
> 2. **Ultra-low Operational Cost**: Bisa berjalan lancar di 1 unit VPS kecil (1 vCPU / 1GB RAM).
> 3. **Simple CI/CD Pipeline**: Cukup build satu image Docker dan jalankan secara terpadu.

---

## 6. Arsitektur Integrasi dengan situsbisnis.com

```
[ situsbisnis.com ]                             [ tertaut.com ]
(Etalase / Link-in-Bio / Discovery)             (ElysiaJS Single Container Engine)
        │                                               │
        │ 1. User Klik "Beli"                           │
        └───────────────── Redirect ───────────────────►│
                                                        │ 2. Buat Payment via Xendit API
                                                        │ 3. Terbitkan Lisensi & JWT
                                                        │
        ┌───────────── Redirect Back ───────────────────┤
        ▼                                               │
[ Thank You Page ]                                      │ 4. Client App Panggil SDK
(situsbisnis.com)                                       └────── Check License ────► [ Valid ]
```

---

## 7. Contoh Implementasi SDK (Untuk Vibe Coding)

### A. Integrasi Smoke Test / Fake Door Mode

```typescript
import { Tertaut } from "@tertaut/sdk";

const tertaut = new Tertaut({ appId: "app_fastmail_ai" });

// Dipanggil saat tombol "Beli" diklik di landing page / situsbisnis.com
function handleBuyClick() {
  tertaut.smokeTest({
    productName: "FastMail AI Summarizer",
    targetPrice: 49000,
    onCaptured: (email) => {
      console.log("Calon pembeli terekam dalam waitlist:", email);
    },
  });
}
```

### B. Integrasi Live Checkout & AI API Proxy Shield

```typescript
import { Tertaut } from "@tertaut/sdk";

const tertaut = new Tertaut({ appId: "app_devdocs_pro" });

// 1. Pemicu Checkout Redirect (Xendit Hosted Paywall)
function triggerPayment() {
  tertaut.checkout({
    amount: 149000,
    grantDays: 365,
    redirectUrl: "https://situsbisnis.com/@builder/success",
  });
}

// 2. Pemanggilan AI via Proxy Shield (Client-side aman tanpa bocor API key)
async function generateDocumentation(userPrompt: string) {
  const response = await tertaut.aiProxy.chat({
    licenseKey: "TT-XXXX-XXXX-XXXX",
    prompt: userPrompt,
  });

  return response.text;
}
```

---

## 8. Persyaratan Non-Fungsional (NFR)

- **Keamanan Data**: Enkripsi API Key AI menggunakan AES-256-GCM. Token transaksi menggunakan JWT bertanda tangan digital. Kunci rahasia Xendit disimpan aman di environment variables.
- **Performa AI Proxy**: Latensi overhead pada AI API Proxy Shield $< 50\text{ ms}$ berkat event loop Bun + ElysiaJS.
- **Availability**: Target Uptime backend engine $\ge 99.9\%$.
- **Efisiensi Memori Container**: Memory footprint container saat idle $< 100\text{ MB RAM}$.
- **Idempotensi & Auditability**: Seluruh callback Webhook Xendit dan mutasi saldo tercatat dalam audit log transaksi yang tidak dapat dimanipulasi (_immutable ledger_).

---

## 9. Indikator Keberhasilan (KPI) & Roadmap Peluncuran

### 9.1 Indikator Keberhasilan Utama (KPIs)

- **Time-to-First-Dollar**: Rata-rata builder dapat menerima pembayaran pertama $< 15\text{ menit}$ sejak memasang SDK tanpa mengurus legalitas PT/CV atau verifikasi PG.
- **Validation Efficiency**: $30\%+$ proyek yang menggunakan Smoke Test berhasil mengukur minat pasar riil sebelum koding fitur kompleks dimulai.
- **Gross Merchandise Value (GMV)**: $\text{Rp } 1.000.000.000+$ diproses dalam 3 bulan pertama pasca-peluncuran.

### 9.2 Roadmap Peluncuran

#### Fase 1: Core Engine & Single Container Setup

- [x] Setup ElysiaJS + Bun + Vue 3 (Vite + Tailwind + Lucide)
- [x] Integrasi Xendit Invoice & Webhook Callback Handler dengan Idempotency
- [x] Core Engine: Dynamic Checkout & Universal Licensing Engine
- [x] Pengujian pada Aplikasi Internal (Dogfooding)

#### Fase 2: Closed Alpha (Vibe Coder Community)

- [x] Integrasi Built-in Smoke Test / Fake Door Engine & Hosted Page Builder
- [x] Dynamic Checkout Engine & MoR Payments (Xendit)
- [x] Setup Xendit Automated Disbursement API ($\ge \text{Rp } 50.000$)
- [ ] Universal Licensing Engine & Hardware Fingerprinting
- [ ] AI API Proxy Shield (OpenAI & Gemini Gateway)
- [ ] Rilis SDK JS/TS (`@tertaut/sdk`) & Prompt Docs untuk Cursor/Windsurf

#### Fase 3: Public Launch & Ecosystem Sync

- [ ] Buka Registrasi Publik
- [ ] Integrasi Otomatis Halaman Peluncuran dengan `situsbisnis.com`
- [ ] Peluncuran Fitur Waitlist Auto-Notifier Massal

#### Fase 4: Product Analytics Dashboard (Catatan Backlog)

> [!NOTE]
> **Ide fitur berikutnya (belum dimulai)**: SaaS builder butuh metrik bisnis yang mudah dibaca — GA4/GSC terlalu overpowered. Tertaut punya keunggulan unik: data transaksional (transactions, licenses, ai_proxy_logs) yang tidak dimiliki GA/GSC.

- [ ] **Dashboard Metrik Mudah Dibaca** — kartu metrik actionable dari data transaksional tertaut (bukan traffic/pageview, itu domain GA):
  - Revenue & GMV (total transaksi, net earnings per app) — dari tabel `transactions`
  - Licensing metrics (total active licenses, verifikasi/hari) — dari tabel `licenses`
  - Semua per app, update real-time dari DB, tanpa setup tracking
- [ ] **Tentukan scope v1** (draft skenario dari analisis):
  - Lead Capture → PQL triggers & behavioral intent (perlu tracking event baru via SDK, berat)
  - Launch → Time-to-Value & drop-off points (perlu data UX baru)
  - SaaS Finance → NRR, LTV:CAC ratio, cohort retention, payback period (butuh histori utilisasi bulanan)
- [ ] **Prinsip**: hanya actionable data, hindari vanity metrics. Prioritas awal direkomendasikan pada metrik yang sudah ada di DB tanpa track event baru.
