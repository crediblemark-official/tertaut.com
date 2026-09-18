# tertaut.com — Headless Developer Infrastructure Engine

> **Versi 2.2** • Single Container Architecture Blueprint  
> **Peran Sistem**: Headless Developer Infrastructure Engine (Monetization, Universal Licensing, AI API Protection, Fake Door Validation & Launch Kit)  
> **Model Bisnis**: Merchant of Record (MoR) dengan Platform Fee 5% per transaksi via Xendit Infrastructure  

---

## ⚡ Tech Stack & Fondasi

- **Runtime & Engine**: [Bun](https://bun.sh/) 1.3+ & [ElysiaJS](https://elysiajs.com/) (Ultra-fast, type-safe, sub-millisecond response)
- **Frontend Dashboard**: Vue 3 (`<script setup>` Composition API), Vite 6, Tailwind CSS, Lucide Icons
- **Database & ORM**: PostgreSQL 16 (Local Docker) via [Drizzle ORM](https://orm.drizzle.team/) & `postgres.js`
- **Payment & MoR Partner**: Xendit Payment Request / Invoice & Disbursement API (95% net payout to builders)
- **Security & Enkripsi**: AES-256-GCM Vault untuk API Key AI, RSA-256 / HMAC JWT untuk lisensi offline
- **Client SDK**: `@tertaut/sdk` (Ultra lightweight, **4.5 KB** gzipped/minified, target < 15 KB)

---

## 📁 Struktur Monorepo / Workspace

```text
tertautv2/
├── PRD.md                     # Product Requirement Document v2.2
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
│   │   │   ├── migrations/    # Generated SQL schema migrations
│   │   │   └── schema/        # Modular schemas (builders, apps, transactions, licenses, fakedoor, aiproxy)
│   │   ├── routes/            # Elysia v1 modular endpoints
│   │   │   ├── api.ts         # Aggregator router (/api/v1)
│   │   │   ├── health.ts      # Health check (/api/v1/health)
│   │   │   ├── apps.ts        # App management & KPI stats (/api/v1/apps)
│   │   │   ├── fakedoor.ts    # Modul 1: Fake Door validation & metrics (/api/v1/fakedoor)
│   │   │   ├── checkout.ts    # Modul 2: Dynamic MoR Checkout (/api/v1/checkout)
│   │   │   ├── webhook.ts     # Modul 2: Xendit payment callback (/api/v1/webhook)
│   │   │   ├── licensing.ts   # Modul 3: Universal Licensing & HW Binding (/api/v1/license)
│   │   │   └── aiproxy.ts     # Modul 4: AI Proxy Shield Gateway (/api/v1/ai-proxy)
│   │   └── services/          # Business logic helpers
│   │       ├── crypto.ts      # AES-256-GCM vault & signed JWT tokens
│   │       ├── license.ts     # Key generator & hardware hash matcher
│   │       └── xendit.ts      # Xendit Invoice & Disbursement client
│   │
│   └── client/                # Frontend Vue 3 + Vite Dashboard
│       ├── index.html         # Dark-first SPA entry with Inter & JetBrains Mono
│       ├── vite.config.ts     # Vite bundler with API reverse-proxy (:3000)
│       ├── tailwind.config.js # Modern design tokens (shadcn-vue style)
│       └── src/
│           ├── main.ts        # Vue app bootstrap
│           ├── App.vue        # Modern sidebar layout & responsive view
│           ├── router/        # Vue Router routes
│           ├── views/         # 5 Modul Views (Overview, FakeDoor, Checkout, Licensing, AiProxy, Docs)
│           └── lib/           # Type-safe API client & formatters
│
└── packages/
    └── sdk/                   # @tertaut/sdk (< 5KB lightweight client library)
        ├── src/index.ts       # Tertaut class (fakedoor, checkout, licensing, aiProxy)
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
Jalankan migrasi Drizzle untuk membuat seluruh 7 tabel:
```bash
bun run db:migrate
```

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
