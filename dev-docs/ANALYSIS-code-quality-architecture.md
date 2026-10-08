# Analisis Kualitas Kode, Struktur Folder & Arsitektur — tertaut.com

**Tanggal:** 2026-10-08
**Versi:** 2.2.3
**Metode:** Analisis statis (baca kode), bukan audit dinamis
**Catatan:** Laporan ini adalah kelanjutan dari `ANALYSIS-premature-unintegrated-bugs.md`

---

## 0. Koreksi terhadap Laporan Sebelumnya

Sebelum masuk ke temuan baru, ada beberapa klaim di laporan sebelumnya yang **terbantah setelah verifikasi langsung terhadap kode**:

| Klaim Lama                                              | Status          | Bukti                                                                                                                                                                                                   |
| ------------------------------------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "Missing security headers (CSP, HSTS, X-Frame-Options)" | ❌ **SALAH**    | Sudah ada di `src/server/index.ts` baris 126-147: `X-Content-Type-Options`, `Referrer-Policy`, `X-XSS-Protection`, `X-Frame-Options` (dikecuali embed path), HSTS (prod only)                           |
| "Missing Request ID / Tracing"                          | ❌ **SALAH**    | Sudah ada di `src/server/index.ts` baris 130-132: `crypto.randomUUID()` + header `X-Request-Id`                                                                                                         |
| "Sandbox webhook tidak punya env check"                 | ⚠️ **BERITAHU** | Tidak ada `config.isSandbox` check, **TAPI** ada guard `isSandboxTx` di baris 34-47 yang menolak transaksi LIVE (403). Risiko tersisa: endpoint tetap terbuka tanpa autentikasi untuk transaksi sandbox |
| "Mass assignment di app update"                         | ⚠️ **BERITAHU** | Ada allowlist field eksplisit. `t.Any()` pada `deliveryConfig`/`meteringConfig` memang ada, tapi builder memang pemilik app-nya sendiri — risiko lebih rendah dari klaim awal                           |

---

## 1. RINGKASAN EKSEKUTIF

**Penilaian Umum: Baik, dengan beberapa titik_ARCHitektur yang perlu dirapikan.**

| Aspek           | Skor   | Catatan                                                                  |
| --------------- | ------ | ------------------------------------------------------------------------ |
| Struktur folder | 8/10   | Domain-driven di server, feature-based di client. Root level berantakan. |
| Arsitektur      | 6.5/10 | Layering benar, tapi tanpa DI dan tanpa response contract                |
| Kualitas kode   | 6/10   | 695 `any` di server, 3 file >1000 baris                                  |
| Kerapian test   | 5/10   | Ada file "coverage_booster" untuk padding, tidak ada test client         |
| Konsistensi     | 4.5/10 | 4 pola auth berbeda, 3 bentuk error response, naming campur              |

**Total codebase:** ~76.000 baris TypeScript/Vue (di luar `node_modules`, cache VitePress).

---

## 2. KUALITAS KODE

### 2.1 Penggunaan `any` — MASALAH TERBESAR

**Total: 695 `any` di server, 97 di client.**

File dengan `any` terbanyak (di luar test):

| File                                      | Jumlah `any` |
| ----------------------------------------- | ------------ |
| `src/server/index.ts`                     | 17           |
| `src/server/routes/checkout/handlers.ts`  | 16           |
| `src/server/routes/s2s/licenses.ts`       | 15           |
| `src/client/src/views/AdminPanelView.vue` | 15           |
| `src/client/src/views/PayView.vue`        | 13           |

**Kasus terburuk — webhook handlers:**

```typescript
// src/server/routes/webhook/dana.ts:12
export async function handleDanaFinishPaymentWebhook({ request, headers, body, set }: any);

// src/server/routes/webhook/xendit.ts:155
export async function handleXenditDisbursementWebhook({ headers, body, set }: any);

// src/server/routes/webhook/sandbox.ts:11
export async function handleSandboxPaymentWebhook({ body, set }: any);
```

**Dampak:** Handler yang paling kritis secara keamanan justru paling tidak ter-type. `set.status` bisa di-set ke string apa pun tanpa error kompilasi.

**Rekomendasi:** Definisikan interface context per handler:

```typescript
interface DanaWebhookContext {
  request: Request;
  headers: Record<string, string>;
  body: unknown; // parsed + validated
  set: { status?: number };
}
```

### 2.2 File Terlalu Besar (God Files)

| File                                              | Baris | Layer     | Masalah                                        |
| ------------------------------------------------- | ----- | --------- | ---------------------------------------------- |
| `src/client/src/views/LandingView.vue`            | 1431  | View      | monolithic; tidak dipecah section              |
| `src/client/src/lib/api.ts`                       | 1167  | Lib       | 64 `Promise<T>`, semua API client dalam 1 file |
| `src/server/routes/licensing/device.ts`           | 1060  | Route     | 7 handler dalam 1 file                         |
| `src/client/src/components/pay/PayXenditForm.vue` | 988   | Component | form logic + UI dalam 1 SFC                    |
| `src/server/db/seed.ts`                           | 910   | DB        | seed data belum dipecah per domain             |
| `src/client/src/views/PrivacyView.vue`            | 851   | View      | 10 artikel markdown inline                     |
| `src/server/index.ts`                             | 671   | Root      | 8 concern berbeda dalam 1 file                 |
| `src/server/routes/checkout/session.ts`           | 622   | Route     | session creation + validasi + gateway dispatch |

**`src/server/index.ts` (671 baris) — 8 concern yang seharusnya terpisah:**

```
CORS configuration        (baris 64-123)
Security headers          (baris 126-147)
Swagger + exclude list    (baris 150-254)
Global error handler      (baris 256-286)
SPA fallback + static     (baris 288-460)
expireLicenses() cron     (baris 462-495)
expireLeases() cron       (baris 497-507)
dispatchWebhooks() cron   (baris 509+)
auto-migrate + admin setup
```

**Rekomendasi:**

```
src/server/
├── app.ts          # Elysia setup: CORS, headers, swagger, error handler
├── server.ts       # entry point: app.listen()
├── tasks/
│   ├── licenseExpiry.ts
│   ├── leaseExpiry.ts
│   └── webhookDispatch.ts
├── static.ts       # SPA fallback + static serving
└── bootstrap.ts    # auto-migrate + admin setup
```

### 2.3 Duplikasi Kode

**Duplikasi paling jelas — DANA webhook handler di-register 3 kali:**

`handleDanaFinishPaymentWebhook` dipanggil di **8 titik berbeda**:

```
src/server/routes/webhook/router.ts:12   .post("/dana/finish-payment", ...)
src/server/routes/webhook/router.ts:13   .post("/dana/notify", ...)
src/server/routes/webhook/router.ts:29   (prefix /webhooks) .post("/dana/finish-payment", ...)
src/server/routes/webhook/router.ts:39   (SNAP BI) .post("/v1.0/debit/notify", ...)
src/server/routes/checkout/router.ts:41  .post("/webhook/dana", ...)
src/server/routes/checkout/router.ts:42  .post("/webhook/dana/finish-payment", ...)
```

Artinya satu endpoint DANA punya **6 URL berbeda** yang memicu handler identik. Ini_surface area attack yang tidak perlu.

**Duplikasi lain:**

- `PUBLIC_PREFIXES` di `src/server/routes/api.ts:19-53` (34 entri) menduplikasi path knowledge yang sudah ada di route modules
- `PUBLIC_CHECKOUT_PATHS` di `src/server/routes/checkout/router.ts:19-29` (9 entri) — subset dari atas, tapi tidakderived dari sumber yang sama
- Trusted origins diduplikasi di `index.ts:64-123` dan `auth.ts:9-18`

### 2.4 Ketidakkonsistenan Naming

**Server — 3 konvensi tercampur:**

| Konvensi   | Contoh                                                                                          |
| ---------- | ----------------------------------------------------------------------------------------------- |
| kebab-case | `routes/apps/api-key.ts`                                                                        |
| camelCase  | `routes/licensing/adminWebhooks.ts`, `db/ensureDemo.ts`, `services/payments/dana/danaClient.ts` |
| lowercase  | `routes/webhook/dana.ts`, `services/monetization/credits.ts`, `db/seed.ts`                      |

**Client — konsisten:** PascalCase (component/view), camelCase + `use` (composable), lowercase (types/constants/lib).

**Rekomendasi:** pilih satu (kebab-case atau camelCase) dan konsisten. Karena client sudah konsisten dengan camelCase, server sebaiknya mengikuti.

### 2.5 Magic Numbers & Hardcoded Values

```typescript
// src/server/config.ts — platformFeePercent hardcoded 3x
line 427: platformFeePercent: 5,   // dana
line 434: platformFeePercent: 5,   // xendit
line 445: platformFeePercent: 5,   // xenithpay

// src/server/routes/payouts/router.ts:11
const MIN_THRESHOLD = 50000;
```

`platformFeePercent: 5` tertulis 3 kali di 3 gateway berbeda. Jika bisnis mengubah fee, harus edit 3 tempat — dan bisa tidak sinkron.

**Rekomendasi:** extract ke konstanta tunggal di `config.ts`:

```typescript
export const PLATFORM_FEE_PERCENT = 5;
```

### 2.6 Test Coverage yang Palsu

**File "coverage_booster" —/test untuk padding metrik, bukan test functionality:**

```
src/server/__test/unit/coverage_booster.test.ts
src/server/__test/unit/coverage_booster2.test.ts   (1122 baris, 67 any)
src/server/__test/unit/coverage_booster3.test.ts   (957 baris, 44 any)
src/server/__test/unit/coverage_booster4.test.ts
src/server/__test/unit/all_green_booster.test.ts
```

Total 5 file ini ≈ 3.500 baris. Oneuptest/

**Test numbering menyiratkan ordering dependency:**

```
integration/01_crypto_license.test.ts
integration/02_apps_config.test.ts
...
integration/27_advanced_seo.test.ts
```

Test harus independen — numbering di sini menyiratkan urutan eksekusi, yang membuat debugging sulit.

**Test duplikat di 2 file berbeda** — contoh yang sama diuji dua kali:

```
src/server/__test/unit/coverage_booster2.test.ts:366  "handleDanaFinishPaymentWebhook: rate limited returns 429"
src/server/__test/unit/coverage_booster3.test.ts:134  "handleDanaFinishPaymentWebhook: rate limited returns 429"
```

```
src/server/__test/unit/coverage_booster2.test.ts  (test "BUG A5")
src/server/__test/unit/coverage_booster4.test.ts:47  (test "BUG A5" lagi)
```

**Zero client tests** — `src/client/` tidak punya test sama sekali.

**Rekomendasi:**

1. Hapus file `*_booster*.test.ts`, ganti dengan test yang benar-benar menguji behavior
2. Hapus numbering prefix dari integration tests
3. Tambahkan minimal unit test untuk `client/src/lib/api.ts`, `client/src/composables/`
4. Mirror struktur source di `__test__/`

---

## 3. KERAPIHAN STRUKTUR FOLDER

### 3.1 Root Level — Berantakan

```
/media/rasyiqi/7653717A1C07B131/tertaut/
├── kredensial.txt                              ← file kredensial di root
├── Pilot_Testing_DANA_Tertaut_Production.zip   ← binary artifact di root
├── mcp-config.json                             ← duplikat dari .agents/mcp_config.json
├── .env.production                             ← ada di disk (gitignored, tapi membingungkan)
├── dev-docs/
│   └── DANA UAT Results - Disburse to Bank.xlsx  ← TERCOMMIT ke git
├── coverage/
│   └── lcov.info                              ← TERCOMMIT ke git
├── docs/.vitepress/cache/deps_temp_*/         ← 5x duplikat cache (13.339 baris each!)
└── scripts/dana-uat/                          ← nested node_modules (gitignored)
```

**Temuan:**

1. **`.gitignore` sudah benar** untuk `.env.production`, `kredensial.txt`, `*.zip`, `coverage/`, `.vitepress/cache/` — tapi `coverage/lcov.info` dan `.xlsx` **ter-commit** (sudah ada sebelum `.gitignore` diperbarui).

2. **Duplikat MCP config:**

```
./mcp-config.json              ← root
./.agents/mcp_config.json      ← .agents/
```

3. **Cache VitePress di disk:** 5 folder `deps_temp_*` masing-masing berisi file identik 13.339 baris. Total ~67.000 baris duplikat di filesystem (gitignored, tapi membingungkan saat `wc -l`).

**Rekomendasi:**

```bash
# Root cleanup
rm Pilot_Testing_DANA_Tertaut_Production.zip
rm mcp-config.json                     # unify ke .agents/mcp_config.json
git rm --cached coverage/lcov.info
git rm --cached "dev-docs/DANA UAT Results - Disburse to Bank.xlsx"
rm -rf docs/.vitepress/cache/deps_temp_*
```

### 3.2 Server — Struktur Baik

```
src/server/
├── index.ts              ← 671 baris, god file
├── config.ts             ← 452 baris, god file
├── auth.ts
├── db/
│   ├── index.ts, schema/ (9 files), migrations/
│   ├── migrate.ts, seed.ts, reset.ts
│   └── ensureDemo.ts, ensureSettings.ts
├── lib/                  ← ip, ownership, pagination, semver (4 files, pure functions)
├── middleware/
│   └── auth.ts
├── routes/               ← 12 domain folders
│   ├── aiproxy/ (6), apps/ (5), badge/ (1), checkout/ (3),
│   ├── coupons/ (1), licensing/ (6), metering/ (1), panel/ (12),
│   ├── payouts/ (1), s2s/ (4), seo/ (2), webhook/ (6)
│   └── api.ts, health.ts, launch.ts
├── services/             ← 7 domain folders
│   ├── ai/, licensing/, monetization/, notifications/,
│   ├── payments/ (dana/, gateways/), security/, seo/
├── utils/                ← payment.ts, pollTicket.ts
└── __test/
```

**Strengths:**

- Domain-driven organization konsisten
- Routes ↔ Services mapping jelas
- `lib/` berisi pure functions (IP parsing, semver, pagination) — mudah diuji
- Hanya 2 barrel file: `db/schema/index.ts` dan `payments/gateways/index.ts` — restraint yang baik

**Weaknesses:**

- `services/payments/` punya struktur ambigu:

```
payments/
├── paymentGateway.ts     ← wrapper tipis
├── xendit.ts             ← Xendit logic langsung (lama)
├── dana/
│   ├── dana.ts           ← DANA service
│   ├── danaClient.ts     ← HTTP client
│   ├── danaOrderService.ts
│   ├── danaDisbursementService.ts
│   └── danaWebhookVerifier.ts
└── gateways/             ← abstraction layer
    ├── registry.ts
    ├── danaGateway.ts    ← adapter → delegates ke DanaService
    ├── xenditGateway.ts
    ├── xenithpayGateway.ts
    └── sandboxGateway.ts
```

Ada **dua cara berbeda** accessing Xendit: `payments/xendit.ts` (langsung) dan `gateways/xenditGateway.ts` (adapter). Ini membuat unclear mana yang canonical.

- `utils/` dan `lib/` overlap: keduanya berisi helper functions. Kapan pakai `lib/IP` vs `utils/payment`? Tidak ada aturan jelas.

### 3.3 Client — Struktur Bagus

```
src/client/
├── public/               ← 10 aset + .well-known/
├── src/
│   ├── components/       ← 9 feature groups (admin, aiproxy, apps, checkout,
│   │                        common, licensing, overview, pay, payments)
│   ├── composables/      ← 4 files (useApps, useClipboard, useConfirm, useSeo)
│   ├── constants/        ← 6 files (company, licensing, payment, pricing, seo)
│   ├── lib/              ← 4 files (api, auth, environment, utils)
│   ├── types/            ← 6 files (aiproxy, app, coupon, licensing, panel, transaction)
│   ├── views/            ← 19 views
│   ├── router/           ← index.ts (240 baris)
│   ├── assets/           ← HANYA logo.svg + main.css (nyaris kosong)
│   └── main.ts, App.vue
└── vite.config.ts, tailwind.config.js, postcss.config.js, tsconfig.json
```

**Weaknesses:**

- **Duplikat logo:** `public/logo.svg` DAN `src/assets/logo.svg` — keduanya ada
- **`src/assets/` nyaris kosong** — 2 file; tidak jelas apakah masih dipakai
- **`public/` mencampur concerns:** aset visual (favicon, logo) + SEO text files (robots.txt, sitemap.xml, llms.txt, llms-full.txt, ai-catalog.json)

**Rekomendasi:**

```
src/client/public/
├── assets/               ← favicon.*, logo.*
├── seo/                  ← robots.txt, sitemap.xml, llms*.txt, ai-catalog.json
└── .well-known/
```

Atau lebih baik: generate file SEO di build time dari `src/client/src/constants/seo.ts` (sudah ada konstantanya).

### 3.4 Test Organization — Tidak Mirror Source

```
src/server/__test/
├── setup.ts
├── integration/    ← 27 file bernomor (01-27)
├── regression/     ← 4 file (auth_hardening, bugfixes, p0_security_idor, security_fixes)
└── unit/           ← 18 file
```

**Tidak ada** subfolder `routes/`, `services/`, `db/` di test — jadi cari test untuk modul tertentu harus grep nama file.

---

## 4. ARSITEKTUR

### 4.1 Layering — Benar secara Konseptual

```
HTTP Request
     ↓
Routes (validasi, auth check)          ← src/server/routes/
     ↓
Services (business logic, external API) ← src/server/services/
     ↓
DB (Drizzle ORM)                        ← src/server/db/
```

Dependency_flow benar: routes → services → db. Tidak ada service yang import dari routes (verified: **tidak ada import cycle**).

### 4.2 Design Patterns —识Bagus, tapi Overused

| Pattern                   | Lokasi                          | Assessment                          |
| ------------------------- | ------------------------------- | ----------------------------------- |
| **Strategy + Registry**   | `services/payments/gateways/`   | ✅ Well-implemented, extensible     |
| **Outbox Pattern**        | `WebhookService.dispatchDue()`  | ✅ Excellent — retry dengan backoff |
| **Factory (router)**      | `createLicensingRouter(prefix)` | ✅ Clean                            |
| **Middleware**            | `middleware/auth.ts`            | ✅ Correct, Elysia macros           |
| **Static Class Services** | 17 files di `services/`         | ⚠️ Anti-pattern                     |

### 4.3 Static Service Classes — Anti-Pattern

**17 dari ~20 service files** menggunakan `static` methods:

```
services/ai/aiGateway.ts              → static async validateLicense, checkRateLimit, ...
services/licensing/license.ts         → static generateLicenseKey, issueDirect, revoke, ...
services/licensing/licenseToken.ts    → static ...
services/licensing/licenseLease.ts    → static ...
services/monetization/coupon.ts       → static ...
services/monetization/credits.ts      → static ...
services/monetization/launchService.ts → static ...
services/notifications/email.ts       → static ...
services/notifications/notifier.ts    → static ...
services/notifications/webhooks.ts    → static ...
services/security/crypto.ts           → static ...
services/security/audit.ts            → static ...
services/payments/dana/*.ts           → static ...
services/payments/xendit.ts           → static ...
```

**Masalah:**

1. **Tidak ada dependency injection** — semua import langsung:

```typescript
// services/licensing/license.ts:1-10
import { db } from "../../db";
import { LicenseTokenService } from "./licenseToken";
import { EmailService } from "../notifications/email";
import { CreditService } from "../monetization/credits";
import { AuditService } from "../security/audit";
import { WebhookService } from "../notifications/webhooks";
import { config } from "../../config";
```

2. **State global yang shared** — `AiGatewayService` punya:

```typescript
// services/ai/aiGateway.ts:41
private static rateLimitMap = new Map<string, number[]>();
```

Static `Map` = state bersama lintas test dan lintas instance. Risiko memory leak dan test pollution.

3. **Sulit di-mock** — test harus `spyOn(LicenseService, "method")` (banyak dilakukan di test files) alih-alih meng-inject dependency.

**Rekomendasi (incremental, tidak perlu rewrite):**

```typescript
// services/licensing/license.ts — versi yang lebih testable
export class LicenseService {
  constructor(
    private readonly db: Database,
    private readonly emailer: EmailSender,
    private readonly credits: CreditStore,
    private readonly audit: AuditLogger,
    private readonly webhooks: WebhookDispatcher
  ) {}

  async issueDirect(params: IssueDirectLicenseParams) {
    /* ... */
  }
}

// composition root — di app.ts
export const licenseService = new LicenseService(
  db,
  emailService,
  creditService,
  auditService,
  webhookService
);
```

Tidak perlu static sama sekali. Start dari 2-3 services yang paling sulit dites (`AiGatewayService`, `LicenseService`, `WebhookService`), sisakan yang lain.

### 4.4 Authentication — 4 Pola Berbeda

| Route Group      | Mekanisme                                                | Lokasi                     |
| ---------------- | -------------------------------------------------------- | -------------------------- |
| `apiV1Routes`    | `onBeforeHandle` + `PUBLIC_PREFIXES` skip list           | `api.ts:50-60`             |
| `checkoutRoutes` | `onBeforeHandle` + `PUBLIC_CHECKOUT_PATHS` skip list     | `checkout/router.ts:32-36` |
| `panelRoutes`    | `onBeforeHandle` + `authenticate(headers, true)` (admin) | `panel/router.ts`          |
| `s2sRoutes`      | `.resolve()` + `authenticateSecretApiKey()`              | `s2s/router.ts`            |

**Masalah utama:** dua skip-list (`PUBLIC_PREFIXES` 34 entri, `PUBLIC_CHECKOUT_PATHS` 9 entri) harus di-maintain manual. Tambah route baru =-edit 2 file. Kalau lupa → route jadi protected (safe) atau route jadi public (**dangerous**).

**Contoh nyata dari laporan sebelumnya:** bug "mode param di-silent drop Elysia" terjadi karena schema validation ketat. Pola skip-list exacerbates masalah: `{ error: res.error }` di `api.ts:60` vs `PUBLIC_CHECKOUT_PATHS.some((p) => path.includes(p))` di `checkout/router.ts:33` — `includes()` vs `startsWith()`. Match berbeda untuk path yang sama.

**Rekomendasi:** Deklarasikan auth requirement di route itu sendiri:

```typescript
// routes/checkout/session.ts
export const publicSessionRoutes = new Elysia({ prefix: "/session" })
  .post("/", handleCreateSession, { public: true }, sessionSchema)

  // routes/api.ts — single auth gate
  .onBeforeHandle(({ request: { headers }, status, path, route }) => {
    if (route?.detail?.public) return;
    const res = await authenticate(headers);
    if ("status" in res) return status(res.status, { error: res.error });
  });
```

Metadata-based auth = single source of truth.

### 4.5 API Response Format — Tidak Konsisten

**Tiga bentuk error response berbeda:**

```typescript
// Bentuk 1 — global handler (1 tempat)
{ error: { code: "NOT_FOUND", message: "..." } }

// Bentuk 2 — auth failure
{ error: "Unauthorized" }                       // string

// Bentuk 3 — route handlers (73 lokasi)
{ success: false, error: "..." }               // boolean + string

// Bentuk 4 — webhook handlers
{ responseCode: "4015600", responseMessage: "..." }   // DANA-specific
{ error: "..." }                                       // Xendit/XenithPay
```

**Statistik:**

```
success: false count:
  routes/licensing/device.ts         20
  routes/licensing/adminWebhooks.ts  20
  routes/payouts/router.ts           15
  routes/coupons/router.ts           12
  routes/metering/router.ts          11
  routes/licensing/admin.ts          11
  routes/aiproxy/chat.ts             11
```

Client harus handle multiple shapes (terlihat di `client/src/lib/api.ts` yang punya 64 `Promise<T>` berbeda).

**Webhook errors paling 불가 di-standarisasi** karena DANA SNAP BI protocol _mengharuskan_ format `{ responseCode, responseMessage }`. Tapi endpoint non-webhook seharusnya konsisten.

**Rekomendasi:**

```typescript
// types/api.ts
type ApiResponse<T> = { success: true; data: T } | { success: false; error: string };
type ApiError = { error: { code: string; message: string } };

// handler
if (!ok) return status(400, { error: { code: "VALIDATION", message: "..." } } satisfies ApiError);
```

### 4.6 Middleware — Tidak Reusable

`authMiddleware` (`middleware/auth.ts`) adalah Elysia instance dengan macros (`requireAuth`, `requireAdmin`). Tapi **hanya dipakai di `apiV1Routes`**. Route group lain (`s2s`, `panel`, `checkout`) implement auth sendiri.

**Rate limiter juga bukan middleware:**

```typescript
// services/security/rateLimiter.ts
export function enforceRateLimit(request, scope, max, windowMs) {
  /* ... */
}
```

Dipanggil manual di setiap handler yang butuh. Kalau lupa di satu endpoint publik → endpoint itu tidak ter-rate-limit.

**Rekomendasi:** ubah `enforceRateLimit` menjadi Elysia plugin dengan declarative config:

```typescript
const rateLimited = (scope: string, max: number, windowMs: number) =>
  new Elysia({ name: `rl-${scope}` }).onBeforeHandle(({ request, set }) => {
    const rl = enforceRateLimit(request, scope, max, windowMs);
    if (!rl.allowed) {
      set.status = 429;
      return { error: { code: "RATE_LIMITED", message: `Retry in ${rl.retryAfter}s` } };
    }
  });

// usage
.post("/session", handleCreateSession, rateLimited("checkout:session", 10, 60_000), schema)
```

### 4.7 Konfigurasi — Singleton yang Tidak Bisa Di-Override

`config.ts` export satu object `config` yang di-import langsung ke mana-mana. Test yang butuh override (misal `isSandbox = true`) harus mutate singleton:

```typescript
// test pattern yang ditemukan
config.isSandbox = true; // mutate global state
```

**Ini freelancer** — test yang run paralel (`bun test --parallel=1` di package.json, jadi sequential, tapi tetap) bisa互相 contaminate.

**`config.ts` juga punya responsibility bercampur:**

```
env parsing          (getEnv)
secret resolution    (resolveSecret, 40+ baris)
key file reading     (readKeyFile)
PEM cleaning         (cleanPem)
config object        (452 baris total)
```

**Rekomendasi:** pisahkan:

```
src/server/config/
├── env.ts           # getEnv, flags (isProd/isTest/isDev)
├── secrets.ts       # resolveSecret, STRICT_SECRETS logic
├── keys.ts          # readKeyFile, cleanPem
└── index.ts         # re-export combined config object
```

### 4.8 Observability — Ada, tapi Tidak Lengkap

**Yang sudah ada (bagus):**

- Request ID tracing (`X-Request-Id`)
- Security headers
- Structured error response

**Yang belum:**

- Tidak ada structured logging (pakai `console.log`/`console.error` scattered)
- Tidak ada metrics (request latency, error rate, webhook queue depth)
- Tidak ada tracing terdistribusi antar service (tidak relevant untuk monolith, tapi tidak ada span sama sekali)
- Health check tidak cek dependency (DB, gateway)

---

## 5. RINGKASAN TEMUAN

### Prioritas Tinggi (Quick Wins)

| #   | Temuan                                                                       | Lokasi                                    | Estimasi |
| --- | ---------------------------------------------------------------------------- | ----------------------------------------- | -------- |
| 1   | Root level berantakan: duplikat MCP config, binary artifact, file ter-commit | root, `coverage/`, `dev-docs/`            | 15 menit |
| 2   | `handleDanaFinishPaymentWebhook` di 6 URL berbeda                            | `webhook/router.ts`, `checkout/router.ts` | 30 menit |
| 3   | 2 MCP config files                                                           | root vs `.agents/`                        | 2 menit  |
| 4   | Duplikat test file (rate-limit test di 2 file)                               | `coverage_booster2/3/4`                   | 20 menit |
| 5   | `platformFeePercent: 5` di 3 tempat                                          | `config.ts:427,434,445`                   | 5 menit  |

### Prioritas Sedang (Refactor Terarah)

| #   | Temuan                                       | Lokasi                                                             | Estimasi |
| --- | -------------------------------------------- | ------------------------------------------------------------------ | -------- |
| 6   | 4 pola auth berbeda + 2 skip-list fragile    | `api.ts`, `checkout/router.ts`, `panel/router.ts`, `s2s/router.ts` | 2-4 jam  |
| 7   | 3+ bentuk error response                     | 73 lokasi                                                          | 4-6 jam  |
| 8   | Hapus `*_booster*.test.ts`, ganti test nyata | `__test/unit/`                                                     | 4-8 jam  |
| 9   | Split `index.ts` (671 baris, 8 concern)      | `src/server/index.ts`                                              | 2 jam    |
| 10  | Type webhook handlers (hapus `any`)          | `routes/webhook/*.ts`                                              | 1-2 jam  |

### Prioritas Rendah (Technical Debt)

| #   | Temuan                                                         | Lokasi                        | Estimasi        |
| --- | -------------------------------------------------------------- | ----------------------------- | --------------- |
| 11  | Static service classes → DI container                          | 17 files di `services/`       | 2-3 hari        |
| 12  | Naming convention server (campur 3 gaya)                       | `routes/`, `db/`, `services/` | 1 hari          |
| 13  | Ambiguitas `payments/xendit.ts` vs `gateways/xenditGateway.ts` | `services/payments/`          | 3 jam           |
| 14  | Zero client tests                                              | `src/client/`                 | 2-3 hari        |
| 15  | `docs/.vitepress/cache/` 5x duplikat (~67K baris) di disk      | `docs/.vitepress/cache/`      | 1 menit (hapus) |

---

## 6. YANG SUDAH BAGUS (Tidak Perlu Diubah)

1. **Dependency flow benar** — routes → services → db, tanpa cycle
2. **Outbox pattern** untuk webhook delivery (`WebhookService.dispatchDue()` dengan retry + backoff) — production-grade
3. **Strategy + Registry pattern** di payment gateways — extensible dan clean
4. **Pure functions di `lib/`** — mudah diuji, tidak ada hidden dependency
5. **Domain-driven folder structure** di server — 12 domain, jelas batasnya
6. **Error response global** sudah ada structured (`{ error: { code, message } }`)
7. **Request ID tracing + security headers** sudah ada
8. **Audit service** untuk semua operasi sensitif (license issue/revoke/expire, payment)
9. **S2S API key dengan bcrypt-style hashing** (bukan plain comparison)
10. **Schema validation via Elysia `t.Object()`** di majority routes (meskipun ada bug skip)

---

## 7. CATATAN METODOLOGIS

**Yang TIDAK dilakukan dalam analisis ini:**

- Tidak menjalankan test suite
- Tidak menjalankan typecheck
- Tidak menjalankan build
- Tidak melakukan dynamic analysis / penetration testing
- Tidak membaca `node_modules`, `dist/`, `coverage/` secara detail

**Rekomendasi follow-up:**

1. Jalankan `bun run typecheck` — hasilnya bisa quantifying masalah `any` lebih akurat
2. Jalankan `bun test` — cek apakah ada flaky test
3. Audit dependency dengan `bun audit` atau `npm audit`
4. Review manual `dist/` output untuk cek bundle size
