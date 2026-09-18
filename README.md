# tertaut.com — Headless Developer Infrastructure Engine

> **Versi 2.3** • Single Container Architecture Blueprint
> **Status**: Semua fase F0–F6 **SELESAI** (101/101 test passing, 26 files, build client & server bersih)
> **Peran Sistem**: Headless Developer Infrastructure Engine (Monetization, Universal Licensing, AI API Protection, Fake Door Validation & Launch Kit)
> **Model Bisnis**: Merchant of Record (MoR) dengan Platform Fee 5% per transaksi via Xendit Infrastructure  

---

## ⚡ Tech Stack & Fondasi

- **Runtime & Engine**: [Bun](https://bun.sh/) 1.3+ & [ElysiaJS](https://elysiajs.com/) (Ultra-fast, type-safe, sub-millisecond response)
- **Frontend Dashboard**: Vue 3 (`<script setup>` Composition API), Vite 6, Tailwind CSS, Lucide Icons
- **Database & ORM**: PostgreSQL 16 (Local Docker) via [Drizzle ORM](https://orm.drizzle.team/) & `postgres.js`
- **Payment & MoR Partner**: Xendit Payment Request / Invoice, DANA Enterprise Gateway & Disbursement API (95% net payout to builders)
- **Security & Enkripsi**: AES-256-GCM Vault untuk API Key AI, Ed25519 (Asymmetric) & HMAC JWT untuk lisensi offline
- **Client SDK**: `@tertaut/sdk` (Ultra lightweight, **6.2 KB** minified, zero dependency, target < 15 KB)
- **Verifikasi**: `bun test --parallel=1` = 101 pass / 0 fail; `bun run build:client` + `bun run build:server` bersih

---

## 🌟 Fitur Unggulan Sistem Lisensi (F0–F6 Enterprise Upgrade)

Sistem lisensi tertaut.com dilengkapi kapabilitas kelas enterprise:

1. **F0 — Konsolidasi Skema & Versioning**:
   - Dukungan `licenseVersion` dan metadata `features` (JSONB) terintegrasi pada skema PostgreSQL.
2. **F1 — Entitlements, Feature Flags & Version Floor**:
   - Penetapan fitur kustom per lisensi (`{ "ai-4k": true, "max_users": 50, "min_version": "2.4.0" }`).
   - Penegakan *Version Floor* pada aktivasi/validasi (`APP_VERSION_TOO_OLD` HTTP 403 jika versi client usang).
   - Claims Ed25519 `feat` & `vfl` untuk validasi offline tanpa server.
3. **F2 — Floating License & Rolling Lease / Heartbeat**:
   - Model lisensi dinamis berbasis sewa (*lease* dengan TTL, default 5 menit).
   - Endpoint `POST /licensing/heartbeat` berkala dari client untuk memperpanjang masa sewa aktif.
   - Otomatis melepas seat yang ditinggalkan (*seat rolling*) sehingga dapat dipakai perangkat lain tanpa lockout.
4. **F3 — Webhooks Lifecycle & Reliable Delivery**:
   - Notifikasi realtime untuk 10 siklus lisensi (`issued`, `activated`, `deactivated`, `seat_full`, `revoked`, `expired`, `renewed`, `transferred`, `unbound`, `credits.insufficient`).
   - Pengiriman berbasis tabel outbox, retry backoff eksponensial (maks 6 kali), dan verifikasi integritas HMAC-SHA256 (`x-tertaut-signature`).
   - Manajemen endpoint, rotasi secret, dan test ping delivery langsung via Dashboard dan S2S API.
5. **F4 — Audit Log Event-Sourced**:
   - Pencatatan append-only menyeluruh (`license_events`) mencakup aktor, IP address, jenis event, dan payload perubahan.
   - Panel aktivitas interaktif pada Dashboard Builder serta query via S2S API.
6. **F5 — Offline Token Hardening**:
   - Rotasi token otomatis setiap kali client melakukan validasi online; token lama otomatis masuk JTI denylist.
   - Toleransi clock-skew (`nbf` leeway ±5 menit) dan pencegahan token iat masa depan.
   - Kustomisasi `offlineGraceDays` per aplikasi (default 30 hari).
7. **F6 — S2S Batch Operations & Seat Operations**:
   - Penerbitan dan pencabutan lisensi massal hingga 200 item per request (`/issue-batch`, `/revoke-batch`).
   - Force-release seat per perangkat, transfer kepemilikan lisensi, dan pemulihan darurat (*recovery* reset seluruh seat).

---

## 📁 Struktur Monorepo / Workspace

```text
tertautv2/
├── PRD.md                     # Product Requirement Document v2.2
├── LICENSE_UPGRADE_ROADMAP.md # Dokumen spesifikasi roadmap lisensi F0-F6
├── docker-compose.yml         # Local PostgreSQL 16 & Redis 7 services
├── Dockerfile                 # Multi-stage single-container build (Vue 3 -> Elysia)
├── package.json               # Root scripts (dev, build, start, db)
├── tsconfig.json              # Shared TypeScript config
├── .env.example               # Template environment variables
├── .env                       # Local active environment configuration
│
├── src/
│   ├── server/                # Backend ElysiaJS (Bun)
│   │   ├── index.ts           # Server entry point + static SPA server
│   │   ├── config.ts          # Centralized configuration & environment loader
│   │   ├── db/                # Drizzle ORM
│   │   │   ├── index.ts       # PostgreSQL connection pool (postgres.js)
│   │   │   ├── migrate.ts     # Migration runner script
│   │   │   ├── migrations/    # Generated SQL schema migrations (0000-0004)
│   │   │   └── schema/        # Modular schemas (builders, apps, transactions, licenses, leases, events, webhooks)
│   │   ├── routes/            # Elysia v1 modular endpoints
│   │   │   ├── api.ts         # Aggregator router (/api/v1)
│   │   │   ├── health.ts      # Health check (/api/v1/health)
│   │   │   ├── apps/          # App catalog, API keys, & delivery settings (/api/v1/apps)
│   │   │   ├── checkout/      # Dynamic MoR Checkout & sessions (/api/v1/checkout)
│   │   │   ├── webhook/       # Xendit & DANA payment callbacks (/api/v1/webhook)
│   │   │   ├── licensing/     # Universal Licensing, Seats, Heartbeat & Lease (/api/v1/licensing)
│   │   │   ├── s2s/           # Server-to-Server Admin API (/api/v1/s2s)
│   │   │   └── aiproxy/       # AI Proxy Shield Gateway (/api/v1/ai)
│   │   └── services/          # Core business services
│   │       ├── crypto.ts      # AES-256-GCM vault & signed JWT tokens
│   │       ├── license.ts     # Key generator, direct issue/revoke & hardware matcher
│   │       ├── licenseToken.ts# Ed25519 token signing & claims verification
│   │       ├── licenseLease.ts# Floating license leases, heartbeat & auto-expire job
│   │       ├── webhooks.ts    # Webhook outbox dispatcher, retries & HMAC signatures
│   │       ├── audit.ts       # Event-sourced license activity logging
│   │       ├── xendit.ts      # Xendit Invoice & Disbursement client
│   │       └── dana.ts        # DANA Enterprise payment gateway client
│   │
│   └── client/                # Frontend Vue 3 + Vite Dashboard
│       ├── index.html         # Dark-first SPA entry with Inter & JetBrains Mono
│       ├── vite.config.ts     # Vite bundler with API reverse-proxy (:3000)
│       ├── tailwind.config.js # Modern design tokens (shadcn-vue style)
│       └── src/
│           ├── main.ts        # Vue app bootstrap
│           ├── App.vue        # Modern sidebar layout & responsive view
│           ├── router/        # Vue Router routes
│           ├── views/         # Modul Views (Overview, Apps, Checkout, Licensing, AiProxy, Docs)
│           ├── components/    # Modular UI components (LicenseActivityPanel, WebhookManager, dll)
│           └── lib/           # Type-safe API client & formatters
│
└── packages/
    └── sdk/                   # @tertaut/sdk (< 7KB lightweight client library)
        ├── src/index.ts       # Unified Tertaut SDK (checkout, licensing, credits, aiProxy)
        └── package.json       # Build scripts
```

---

## 🚀 Panduan Memulai Cepat (Local Development)

### 1. Prasyarat
- [Bun](https://bun.sh/) 1.3+
- [Docker](https://www.docker.com/) & Docker Compose

### 2. Jalankan PostgreSQL di Docker
Kredensial container wajib dari environment (tanpa default hardcoded):
```bash
export DB_USER=postgres DB_PASSWORD=postgres DB_NAME=tertautv2
docker compose up -d
```
*Kontainer default: `tertaut_postgres` pada port 5432.*

### 3. Migrasi Database
Jalankan migrasi Drizzle untuk membuat seluruh tabel (termasuk `license_events`, `license_leases`, `webhook_endpoints`, `webhook_deliveries`):
```bash
bun run db:migrate
```
> **Catatan**: Jika database dibuat via `drizzle-kit push` (tanpa journal migrasi), `db:migrate` akan gagal. Dalam kasus ini, jalankan script SQL `0004_polite_sinister_six.sql` secara manual.

### 4. Jalankan Mode Development (Server & Frontend bersamaan)
```bash
bun run dev
```
- **Dashboard UI**: `http://localhost:5173`
- **Backend API**: `http://localhost:3000`
- **Swagger / OpenAPI**: `http://localhost:3000/swagger`

---

## 📦 Single Container Production Build

Untuk memverifikasi arsitektur Single Container (Elysia menyajikan API sekaligus static SPA):
```bash
bun run build
bun run start
```
Akses `http://localhost:3000` — Dashboard Vue 3 dan API `/api/v1/*` berjalan di satu port tanpa masalah CORS!
