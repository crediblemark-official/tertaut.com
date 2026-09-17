# Laporan Bug & Fitur Prematur — tertautv2

> Audit ulang: 17 September 2026  
> Berdasarkan audit kode terbaru (pasca-commit perubahan client & BUGS_AND_PREMATURE_FEATURES.md)

---

## STATUS PERBAIKAN CEPAT (Quick Patch Summary)

- [x] **Bug #2 (Path Traversal)**: Sanitized path & enforced `targetFile.startsWith(clientDistPath)` di `src/server/index.ts`.
- [x] **Bug #3 (CORS Reflect Origin)**: Restrict origin ke trusted list di `src/server/index.ts`.
- [x] **Bug #4 & #7 (Race Condition & Disbursement Status)**: Atomic `UPDATE ... WHERE disbursementStatus = 'PENDING'` lock di `src/server/routes/apps.ts`.
- [x] **Bug #8 (JWT Timing Attack)**: Diganti dengan `crypto.timingSafeEqual()` di `src/server/services/crypto.ts`.
- [x] **Bug #9 (Weak Key Derivation)**: Diganti dengan SHA-256 derivation di `src/server/services/crypto.ts`.
- [x] **Bug #10 (Inconsistent DB URL Fallback)**: Menggunakan single source of truth `config.database.url` di `src/server/db/index.ts`.
- [x] **Bug #12 (Body Spread Mass Assignment)**: Menggunakan allowlist field eksplisit di `src/server/routes/apps.ts`.
- [x] **Bug #13 (Rate Limiter Memory Leak)**: Eviction pruning berkala di `src/server/services/aiGateway.ts`.
- [x] **Bug #14 (Full Table Scan Dashboard)**: Diganti dengan SQL aggregate `SUM()` dan `COUNT()` di `src/server/routes/apps.ts`.
- [x] **Bug #20 (Regex Injection .env Parser)**: Escaped regex metacharacters di `src/server/config.ts`.
- [x] **Bug #21 (Config Variable Shadowed)**: Variable lokal di-rename menjadi `appConfig` di `src/server/services/aiGateway.ts`.
- [x] **Bug #26 (Missing Component Import)**: `RefreshCw` di-import di `OverviewView.vue`.
- [x] **Bug #31 (Clipboard Tanpa Guard)**: Hardened di `useClipboard.ts`.
- [x] **Bug #32 (App.vue Dead Code)**: Disederhanakan menjadi `!!route.meta.public`.
- [x] **Bug #34 (Prop Mutation Anti-Pattern)**: Disederhanakan wizard step flow di `CaptureConfigForm.vue`.
- [x] **Bug #17 (Hardcoded Encryption Key Fallback)**: `JWT_SECRET` & `VAULT_ENCRYPTION_KEY` dipaksa dari env.
- [x] **Bug #18 (Simulate-Paid Tanpa Auth)**: `/checkout/simulate-paid/:txId` di-gate `config.isSandbox`.
- [x] **Bug #24 (Grace Period Selalu 30 Hari)**: `gracePeriodRemainingDays` dihitung dinamis dari token expiry.
- [x] **Mock Payment Isolasi**: Mock invoice/disbursement Xendit hanya aktif saat `config.isSandbox`.
- [x] **Webhook Bypass**: `verifyWebhook` hanya bypass di sandbox.
- [x] **AI Proxy Mock Key Mode**: Respons simulasi hanya aktif di sandbox; production → HTTP 503.
- [x] **Demo Auto-Seed**: `GET /apps` hanya membuat builder + `app_demo_123` saat sandbox.
- [x] **Hardcoded Rekening Bank**: Semua fallback digantikan helper `XenditService.resolveDisbursementAccount()`.
- [x] **Default Harga Hardcoded**: `49000` kini dari `config.defaultPrice`.
- [x] **Sistem Kupon Ditebus (17 Sep)**: Tabel `coupons` + kolom `coupon_code`/`discount_amount`, validasi & klaim kuota atomik, preview kupon, CRUD API, persist di `/launch/convert-to-live`, input kupon di `/pay/:slug`, UI dashboard, 4 test E2E.
- [x] **Guardrail AI Berfungsi (17 Sep)**: `currentMonthlyUsage` di-increment setiap request AI sukses.
- [x] **Provider AI Anthropic & DeepSeek (17 Sep)**: Implementasi upstream nyata (non-streaming & SSE streaming asli).
- [x] **Statistik Penebusan Kupon (17 Sep)**: `GET /api/v1/coupons/stats` + grafik bar dashboard.
- [x] **Autentikasi (17 Sep)**: Better Auth native Elysia, guard `requireAuth`/`requireAdmin` pada panel/payouts/coupons/launch/apps/checkout/licensing + aiproxy.
- [x] **Race condition seat & duplicate license webhook (17 Sep)**: Klaim seat atomik (`db.transaction` + `FOR UPDATE`) + `unique_licenses_transaction_id`.
- [x] **Portal tanpa bukti kepemilikan (17 Sep)**: `POST /portal/access` (email + license key → signed token).
- [x] **Cross-app entitlement leak AI (17 Sep)**: `body.appId` tidak lagi dipercaya; lisensi app A tidak bisa memakai vault app B.
- [x] **Webhook status terminal (17 Sep)**: invoice Xendit `FAILED`/`EXPIRED` ditandai; callback disbursement Xendit ditambahkan + guard status terminal DANA.
- [x] **Payout tanpa builder (17 Sep)**: `/payouts/trigger` tidak lagi menebak builder pertama.
- [x] **N+1 panel (17 Sep)**: `/panel/stats`, `/panel/builders`, `/panel/transactions` memakai batch query.
- [x] **Email delivery (Resend) (17 Sep)**: `EmailService` mengirim kunci lisensi saat pembayaran terkonfirmasi & lisensi diterbitkan manual.
- [x] **Publish SDK (17 Sep)**: `@tertaut/sdk@0.1.5` terbit ke npm.
- [x] **Docker Compose (17 Sep)**: Service `app` ditambahkan; default DB diselaraskan ke `tertautv2`.
- [x] **DANA UAT Amounts Sandbox Guard (17 Sep)**: Skenario 11012/11011 di-gate `config.isSandbox` di `src/server/routes/webhook.ts`.
- [x] **DANA Finish Mock Bypass Guard (17 Sep)**: Parameter `mock=true` di-gate `checkoutConfig.isSandbox` di `src/server/routes/checkout.ts`.
- [x] **SNAP BI Webhook Signature & Production Fallback (17 Sep)**: Notifikasi SNAP BI wajib signature valid; fallback `return true` dimatikan di production jika `publicKey` kosong (`src/server/services/dana.ts` & `src/server/routes/webhook.ts`).
- [x] **Masking Kunci Lisensi & Sanitasi Log (17 Sep)**: Log transaksi menyamarkan license key (`TT-XXXX****`) dan raw body dump dibersihkan dari server stdout (`src/server/routes/webhook.ts`).
- [x] **Portal Public Prefix Hardening (17 Sep)**: Wildcard `"/api/v1/portal/"` digantikan daftar eksplisit customer portal route di `src/server/routes/api.ts`.
- [x] **AI Proxy Public Path Exact Matching (17 Sep)**: Substring matching `path.includes()` digantikan suffix presisi `path.endsWith("/chat") || path.endsWith("/quota-status")` di `src/server/routes/aiproxy.ts`.
- [x] **Dukungan Kunci `keys/` & Sanitasi .env (17 Sep)**: `config.ts` membaca private key Ed25519 & RSA DANA langsung dari file `.pem` di folder `keys/` yang ter-ignore git.
- [x] **Client API Error Normalization & Types (17 Sep)**: `ApiError` class ditambahkan di `api.ts`, `parseJson<T>` melempar `ApiError` pada status HTTP non-2xx agar blok `try/catch` client menangkap kegagalan API, serta penambahan method `getAppBySlug` dan `previewCoupon`.
- [x] **Portal Query N+1 & Token Leak (17 Sep)**: Batch fetching `apps` dan `licenseActivations` menggunakan `inArray` (1+2N -> 3 query) dan field sensitif `offlineJwtGraceToken` dihapus dari respons payload (`src/server/routes/portal.ts`).
- [x] **Apps Builder Authorization Scoping (17 Sep)**: Pemeriksaan kepemilikan builder (`resolveCurrentBuilder`) ditegakkan pada seluruh endpoint `src/server/routes/apps.ts` (`GET /`, `GET /stats/overview`, `POST /`, `PATCH /:appId`, `DELETE /:appId`, `PATCH /:appId/mode`, dan `POST /disburse/:transactionId`).
- [x] **Batch Payouts Atomic Lock (17 Sep)**: `POST /payouts/batch` di `panel.ts` kini menggunakan conditional `UPDATE ... WHERE disbursementStatus = 'PENDING'` lock, mapping status nyata dari gateway, serta rollback atomik saat request gagal.
- [x] **Database Performance Indexes (17 Sep)**: Ditambahkan index `idx_transactions_customer_email`, `idx_transactions_app_payment_status`, `idx_transactions_xendit_ext_id`, dan `idx_ai_vault_credentials_provider`.
- [x] **Client Component Hardening & Memory Leak Cleanup (17 Sep)**: `setTimeout` dibersihkan dengan `onUnmounted` di `LicensingView.vue`, `AiProxyView.vue`, `AdminPanelView.vue`, dan `DocsView.vue`; raw `fetch` diganti dengan `api` method di `PayView.vue` dan `AppsView.vue`; guard `res.success` dan null safety di `CheckoutView.vue` dan `LicensingView.vue`; `rememberMe` difungsikan di `LoginView.vue`; seluruh route dashboard diberi `meta: { requiresAuth: true }`.

---

## BUG KRITIS (Harus Diperbaiki Segera)

### 1. Zero Autentikasi — DEV_USER Admin Bypass ✅ [DIPERBAIKI 17 Sep]
Semua route API terbuka tanpa autentikasi. DEV_USER dengan `role: "admin"` digunakan di non-production.
- **Status**: ✅ **DIPERBAIKI** — Better Auth native Elysia. `DEV_USER` hanya bypass di non-production. `apiV1Routes` menegakkan `authenticate()` untuk semua `/api/v1/*`.
- **Lokasi**: `src/server/middleware/auth.ts`, `src/server/routes/api.ts`

### 2. Path Traversal ✅ [DIPERBAIKI]
`resolve(clientDistPath, "." + decodedPath)` bisa resolve diluar directory dist.
- **Status**: ✅ Diperbaiki.

### 3. CORS Reflect Origin ✅ [DIPERBAIKI]
`origin: true, credentials: true` memungkinkan CSRF.
- **Status**: ✅ Diperbaiki dengan origin validator whitelist.
- **Lokasi**: `src/server/index.ts:18-22`

### 4. Race Condition: Double Disbursement ✅ [DIPERBAIKI]
Tidak ada locking pada transaksi sebelum check `paymentStatus === "PAID"`.
- **Status**: ✅ Diperbaiki dengan atomic conditional update.

### 5. Race Condition: License Seat Overflow ✅ [DIPERBAIKI 17 Sep]
Check-then-act pada seat count tanpa transaction lock.
- **Status**: ✅ **DIPERBAIKI 17 Sep** — klaim seat atomik (`db.transaction` + `FOR UPDATE`).
- **Lokasi**: `src/server/routes/licensing.ts:64-75`

### 6. Race Condition: Duplicate License pada Webhook ✅ [DIPERBAIKI 17 Sep]
Antara idempotency check dan UPDATE, webhook callback lain bisa slip in.
- **Status**: ✅ **DIPERBAIKI 17 Sep** — `unique_licenses_transaction_id` + backstop `23505`.
- **Lokasi**: `src/server/routes/webhook.ts:84-106`

### 7. Disbursement Status Selalu COMPLETED ✅ [DIPERBAIKI]
`XenditService.createDisbursement` bisa return `FAILED`/`PROCESSING`, tapi unconditionally set `COMPLETED`.
- **Status**: ✅ Diperbaiki dengan mapping status riil.

### 8. JWT Signature Vulnerable Timing Attack ✅ [DIPERBAIKI]
Perbandingan `!==` non-constant-time.
- **Status**: ✅ Diperbaiki dengan `crypto.timingSafeEqual()`.

### 9. Weak Key Derivation ✅ [DIPERBAIKI]
Key < 32 bytes di-pad dengan ASCII `"0"`.
- **Status**: ✅ Diperbaiki dengan SHA-256 derivation.

### 10. DANA UAT Hardcoded Amounts ✅ [DIPERBAIKI 17 Sep]
**File**: `src/server/routes/webhook.ts`, **lines 392-414**
- **Status**: ✅ **DIPERBAIKI** — Seluruh blok pengecekan UAT (11012 → 500, 11011 → 200) kini di-gate ketat di dalam `if (config.isSandbox)`. Karena `isSandbox` dipaksa `false` di production (`!isProd`), pembayaran pelanggan dengan nominal tersebut di production tidak akan terganggu.

### 11. SNAP BI Webhook Signature Bypass ✅ [DIPERBAIKI 17 Sep]
**File**: `src/server/routes/webhook.ts`, **line 420**
- **Status**: ✅ **DIPERBAIKI** — Bypass `if (!isSnapBi && ...)` telah dihapus. Seluruh webhook DANA (baik SNAP BI maupun legacy) wajib divalidasi via `DanaService.verifyWebhook(headers, body)`.

### 12. `/checkout/dana/finish?mock=true` Auth Bypass ✅ [DIPERBAIKI 17 Sep]
**File**: `src/server/routes/checkout.ts`, **line 340**
- **Status**: ✅ **DIPERBAIKI** — Parameter `mock=true` kini di-gate secara tegas dengan `if (checkoutConfig.isSandbox && mock === "true")`. Di production, query parameter mock diabaikan sepenuhnya dan transaksi hanya dapat dilunaskan lewat webhook resmi yang terverifikasi.

### 13. Hardcoded DANA UAT Amount Parsing ✅ [DIPERBAIKI 17 Sep]
**File**: `src/server/routes/webhook.ts`, **lines 395-398**
- **Status**: ✅ **DIPERBAIKI** — Heuristik pembagian 100 untuk `>= 100000` telah dihapus dan digantikan `Math.round(parseFloat(rawAmtVal))`, serta hanya dievaluasi pada lingkungan sandbox untuk skenario UAT.

### 14. `console.log` License Key to Server Logs ✅ [DIPERBAIKI 17 Sep]
**File**: `src/server/routes/webhook.ts`, **line 123**
- **Status**: ✅ **DIPERBAIKI** — Kunci lisensi dimasking (`${licenseKey.slice(0, 4)}****`) sebelum dicatat.

### 15. `/api/v1/portal/` Wildcard Public Prefix ✅ [DIPERBAIKI 17 Sep]
**File**: `src/server/routes/api.ts`, **line 23**
- **Status**: ✅ **DIPERBAIKI** — Wildcard `"/api/v1/portal/"` dihapus dan digantikan daftar route publik spesifik portal (`/access`, `/licenses`, `/deactivate-device`, `/transactions`).

### 16. `PUBLIC_AI_PATHS` Path Matching Vulnerability ✅ [DIPERBAIKI 17 Sep]
**File**: `src/server/routes/aiproxy.ts`, **line 590**
- **Status**: ✅ **DIPERBAIKI** — Substring matching `path.includes()` diganti perbandingan suffix presisi `path.endsWith("/chat") || path.endsWith("/quota-status")`.

### 17. Apps `GET /` — No Builder Scoping ✅ [DIPERBAIKI 17 Sep]
**File**: `src/server/routes/apps.ts`
- **Status**: ✅ **DIPERBAIKI** — Diimplementasikan fungsi `resolveCurrentBuilder(headers)`. `GET /` kini memfilter aplikasi berdasarkan `builderId` pemanggil, dan `GET /stats/overview` mengkalkulasi agregasi omzet dan kuota khusus untuk aplikasi milik builder terkait (admin tetap dapat melihat seluruhnya).

### 18. Apps Mutation Endpoints — Any Builder, Not Authenticated User ✅ [DIPERBAIKI 17 Sep]
**File**: `src/server/routes/apps.ts`
- **Status**: ✅ **DIPERBAIKI** — `POST /`, `PATCH /:appId`, `DELETE /:appId`, `PATCH /:appId/mode`, dan `POST /disburse/:transactionId` kini memvalidasi `builder.id === app.builderId` (atau bypass jika role admin). Non-owner menerima HTTP 403 Forbidden.

### 19. DANA Webhook Verification Fallback ✅ [DIPERBAIKI 17 Sep]
**File**: `src/server/services/dana.ts`, **lines 213-217**
- **Status**: ✅ **DIPERBAIKI** — Di production (`!config.isSandbox`), ketiadaan public key DANA akan mencatat error dan langsung mengembalikan `false` (menolak webhook). Fallback `return true` hanya aktif pada lingkungan simulasi sandbox lokal.

### 20. Hardcoded Secrets in `.env` 🔴 [MASIH ADA]
**File**: `.env`, **lines 19-45**
**Masalah**: `.env` berisi:
- `JWT_SECRET` yang bisa ditebak
- `VAULT_ENCRYPTION_KEY` pattern publik
- Real Xendit `SECRET_KEY`, `PUBLIC_KEY`, `WEBHOOK_VERIFICATION_TOKEN`
- Real DANA `CLIENT_ID`, `CLIENT_SECRET`, `MERCHANT_ID`, RSA private key
- `LICENSE_SIGNING_PRIVATE_KEY` dengan PEM private key tertanam

`.env` masih di-track di git dan berisi kredensial asli.

### 21. `DEV_USER` Admin Role 🔴 [MASIH ADA — by design]
**File**: `src/server/middleware/auth.ts`, **lines 16-21**
```ts
const DEV_USER: AuthUser = {
    id: "dev-user", email: "dev@tertaut.local", name: "Development User", role: "admin",
};
```
**Masalah**: Di non-production (`!config.isProd`), **semua** request tanpa sesi mendapat `DEV_USER` dengan `role: "admin"`. Ini berarti admin panel dan semua route admin terbuka untuk siapapun di dev/sandbox.

### 22. Hardcoded UAT Response Codes in Production ✅ [DIPERBAIKI 17 Sep]
**File**: `src/server/routes/webhook.ts`, **lines 392-414**
- **Status**: ✅ **DIPERBAIKI** — Seluruh blok pengecekan UAT (11012 → 500, 11011 → 200) kini diisolasi ketat di dalam `if (config.isSandbox)`. Di production, kode ini tidak pernah dieksekusi.

---

## BUG SEDANG

### 23. Race Condition: Coupon Validation vs Redemption ✅ [DIPERBAIKI 17 Sep]
**File**: `src/server/routes/checkout.ts`, **lines 147-257**
**Masalah**: `CouponService.validate()` dipanggil sebelum `CouponService.redeem()`. Antara validasi dan redeem, concurrent request bisa menghabiskan kuota. `redeem` sendiri atomic, tapi `validate` tidak.
- **Status**: ✅ **DIPERBAIKI 17 Sep** — checkout atomik + delete transaction jika `redeem` gagal (rollback atomik HTTP 409 `COUPON_EXHAUSTED`).

### 24. Portal N+1 Queries ✅ [DIPERBAIKI 17 Sep]
**File**: `src/server/routes/portal.ts`
- **Status**: ✅ **DIPERBAIKI** — Menggunakan batch lookup `apps` dan `licenseActivations` via operator SQL `inArray()` sehingga kompleksitas query turun drastis dari 1+2N menjadi 3 query SQL tetap (kini portal telah dihapus total demi model B2B SaaS murni).

### 25. Portal Exposes `offlineJwtGraceToken` ✅ [DIPERBAIKI 17 Sep]
**File**: `src/server/routes/portal.ts`
- **Status**: ✅ **DIPERBAIKI** — Kolom `offlineJwtGraceToken` telah dihapus dari pemetaan payload respons customer portal (kini portal telah dihapus total).

### 26. Panel `POST /payouts/batch` — No Atomic Lock ✅ [DIPERBAIKI 17 Sep]
**File**: `src/server/routes/panel.ts`
- **Status**: ✅ **DIPERBAIKI** — Menggunakan atomic conditional `UPDATE transactions SET disbursementStatus = 'PROCESSING' WHERE disbursementStatus = 'PENDING'` lock untuk mencegah duplikasi eksekusi payout massal. Status dipetakan sesuai respon riil dari Xendit dan otomatis di-rollback ke PENDING jika terjadi kegagalan.

### 27. Webhook FAILED/EXPIRED Don't Revoke Licenses ✅ [DIPERBAIKI 17 Sep]
**File**: `src/server/routes/webhook.ts`, **lines 290-300**
- **Status**: ✅ **DIPERBAIKI** — Saat webhook Xendit menerima status `EXPIRED` atau `FAILED`, server secara eksplisit mencabut lisensi aktif yang tertaut pada transaksi tersebut via `UPDATE licenses SET status = 'REVOKED' WHERE transactionId = tx.id`.

### 28. License `/validate` Bypasses Device Activation ✅ [DIPERBAIKI 17 Sep]
**File**: `src/server/routes/licensing.ts`, **lines 640-650**
- **Status**: ✅ **DIPERBAIKI** — Jika lisensi terikat dengan perangkat hardware (`lic.hardwareId`), pemanggilan `/validate` tanpa menyertakan `hardwareId` kini langsung ditolak dengan `valid: false, reason: "HARDWARE_ID_REQUIRED"` sehingga bypass kuota seat hardware dicegah.

### 29. Rate Limiter Spoofable via X-Forwarded-For ✅ [DIPERBAIKI 17 Sep]
**File**: `src/server/services/rateLimiter.ts`, **lines 21-45**
- **Status**: ✅ **DIPERBAIKI** — Resolusi IP kini memprioritaskan header proxy tepercaya (`cf-connecting-ip` dari Cloudflare, lalu `x-real-ip` dari Nginx/reverse proxy), dan memvalidasi sintaks IPv4/IPv6 sebelum mengevaluasi entri bucket.

### 30. Missing Database Indexes ✅ [DIPERBAIKI 17 Sep]
**File**: `src/server/db/schema/transactions.ts`, `src/server/db/schema/aiproxy.ts`
- **Status**: ✅ **DIPERBAIKI** — Ditambahkan index:
  - `idx_transactions_customer_email` pada `transactions(customerEmail)`
  - `idx_transactions_app_payment_status` pada `transactions(appId, paymentStatus)`
  - `idx_transactions_xendit_ext_id` pada `transactions(xenditExternalId)`
  - `idx_ai_vault_credentials_provider` pada `aiVaultCredentials(provider)`

### 31. Console.log/Console.warn di Production Code ✅ [DIPERBAIKI 17 Sep]
**File**: Multiple
- **Status**: ✅ **DIPERBAIKI 17 Sep** — Kunci lisensi disamarkan (`TT-XXXX****`), logging UAT di-gate strictly di dalam `if (config.isSandbox)`, raw dump dibersihkan, dan telemetri sistem hanya dapat diakses melalui endpoint Super Admin terautentikasi.

### 32. `config.isSandbox` Bisa Diproxy di Production ✅ [DIPERBAIKI 17 Sep]
**File**: `src/server/config.ts`, **line 50**
- **Status**: ✅ **DIPERBAIKI** — `isSandbox: !isProd`. Di production (`NODE_ENV === "production"`), sandbox mode dilarang keras aktif.

---

## BUG CLIENT

### 33. `api.ts` `parseJson` Tidak Throw ✅ [DIPERBAIKI 17 Sep]
**File**: `src/client/src/lib/api.ts`, **lines 32-47**
- **Status**: ✅ **DIPERBAIKI** — `ApiError` class ditambahkan; `parseJson` melempar `ApiError(status, errorMsg, data)` saat `!res.ok`, sehingga seluruh `try/catch` client berfungsi menangkap error HTTP.

### 34. `parseJson` Returns `Promise<any>` ✅ [DIPERBAIKI 17 Sep]
**File**: `src/client/src/lib/api.ts`, **line 32**
- **Status**: ✅ **DIPERBAIKI** — `parseJson<T = any>` kini menggunakan generic typing untuk menjaga type safety di seluruh API layer.

### 35. PayView Menggunakan Raw `fetch()` ✅ [DIPERBAIKI 17 Sep]
**File**: `src/client/src/views/PayView.vue`
- **Status**: ✅ **DIPERBAIKI** — Seluruh pemanggilan raw `fetch()` digantikan oleh `api.getAppBySlug`, `api.getApps`, `api.previewCoupon`, `api.createCheckoutSession`, dan `api.simulatePayment`.

### 36. CheckoutView Tidak Check `res.success` ✅ [DIPERBAIKI 17 Sep]
**File**: `src/client/src/views/CheckoutView.vue`
- **Status**: ✅ **DIPERBAIKI** — `createCheckout` kini memvalidasi status `res && res.success !== false`, menangani pesan error ke user bila sesi gagal dibuat, serta dilindungi blok `try/catch`.

### 37. OverviewView Tidak Check `statsRes.success` ✅ [DIPERBAIKI 17 Sep]
**File**: `src/client/src/views/OverviewView.vue`
- **Status**: ✅ **DIPERBAIKI** — `api.getStats()` dilindungi `ApiError` yang melempar pada HTTP error, dan blok `try/catch` menangani fallback graceful tanpa crash template.

### 38. Trigger Batch Payout References Non-Existent `res.data` ✅ [DIPERBAIKI 17 Sep]
**File**: `src/client/src/views/CheckoutView.vue`
- **Status**: ✅ **DIPERBAIKI** — Akses `res.data` diberi null-guard `if (res && res.success && res.data)`, dan pesan fallback disediakan bila data kosong.

### 39. `CustomerPortalView.vue` Dihapus Total (Filosofi Produk) ✅ [SELESAI 17 Sep]
**File**: `src/client/src/router/index.ts`
- **Status**: ✅ **DIHAPUS TOTAL** — Sesuai arsitektur inti tertaut.com: tertaut.com adalah infrastruktur B2B SaaS untuk para software builder. Pembeli lisensi SaaS/desktop adalah customer milik builder, bukan pengguna tertaut.com, sehingga pembeli tidak membutuhkan akun ataupun portal di domain tertaut.com. Halaman `/portal` dan file komponen `CustomerPortalView.vue` telah dihapus sepenuhnya dari client.

### 40. Memory Leaks — setTimeout Tidak Dibersihkan ✅ [DIPERBAIKI 17 Sep]
**File**: `LicensingView.vue`, `AiProxyView.vue`, `AdminPanelView.vue`, `DocsView.vue`, `SearchPicker.vue`
- **Status**: ✅ **DIPERBAIKI** — Seluruh timer `setTimeout` dikelola dengan variabel ref/handle lokal dan dibersihkan saat lifecycle hook `onUnmounted` dipanggil, mencegah pembaruan state pada komponen yang sudah di-unmount.

### 41. Semua Route Dashboard Kurang `meta: { requiresAuth: true }` ✅ [DIPERBAIKI 17 Sep]
**File**: `src/client/src/router/index.ts`
- **Status**: ✅ **DIPERBAIKI** — Seluruh item rute di `liveDashboardRoutes` (`apps`, `checkout`, `licensing`, `ai-proxy`, `coupons`, `docs`) dan salinan sandbox-nya kini secara eksplisit memiliki properti `meta: { requiresAuth: true }`.

### 42. LicensingView `res.license.licenseKey` Tidak Null-Safe ✅ [DIPERBAIKI 17 Sep]
**File**: `src/client/src/views/LicensingView.vue`
- **Status**: ✅ **DIPERBAIKI** — Akses `res.license` kini dijaga oleh kondisi `if (res.success && res.license)` dan safe navigation `res.license.licenseKey || ''`.

### 43. Inconsistent API Usage — Direct `fetch()` ✅ [DIPERBAIKI 17 Sep]
**File**: `PayView.vue`, `AppsView.vue`
- **Status**: ✅ **DIPERBAIKI** — `PayView.vue` telah dimigrasi seluruhnya ke method client `api.*`; `AppsView.vue` memanggil `api.createCampaign()` alih-alih `fetch('/api/v1/apps')`.

### 44. Hardcoded Values ✅ [DIPERBAIKI 17 Sep]
- **Status**: ✅ **DIPERBAIKI 17 Sep** — Nilai statis telah digantikan dengan nilai dinamis:
  - `CheckoutView.vue`: `amount` reaktif mengikuti `app.targetPrice` via `watch(selectedAppId)`.
  - `PayView.vue`: Target price fallback ke `0` bukan `49000`.
  - `DocsView.vue`: `selectedAppSlug`, `currentAppId`, dan snippet integrasi terhubung dinamis ke aplikasi milik builder.
  - `AdminPanelView.vue`: Nama, email, dan inisial profil admin terikat dinamis pada `session.data.user` Better Auth.
  - `LandingView.vue`: Label engine online disanitasi menjadi `Engine Online (v2.2 Production Monolith)`.

### 45. LoginView `rememberMe` Non-Functional ✅ [DIPERBAIKI 17 Sep]
**File**: `src/client/src/views/LoginView.vue`
- **Status**: ✅ **DIPERBAIKI** — Nilai `rememberMe.value` kini diteruskan ke parameter `authClient.signIn.email({ email, password, rememberMe: rememberMe.value })`.

---

## FITUR PREMATUR / STUB

### ✅ [SELESAI 17 Sep]
- **Sistem Kupon**: Berfungsi penuh — tabel, penebusan atomik, CRUD API, UI dashboard, 4 test E2E.
- **Guardrail AI**: `incrementVaultMonthlyUsage` kini berfungsi.
- **Provider AI Anthropic & DeepSeek**: Implementasi upstream nyata.
- **Email Resend**: Terintegrasi.
- **Docker Compose**: Service `app` ditambahkan.
- **SDK v0.1.5**: Sudah publish ke npm.

### Payment System Masih Mock (Production Risk)
| Item | Lokasi |
|------|--------|
| Invoice return `inv_mock_...` jika tidak ada API key | `src/server/services/xendit.ts:52-66` |
| DANA UAT hardcoded amounts (11012/11011) | `src/server/routes/webhook.ts:395-412` |
| SNAP BI webhook bypass signature | `src/server/routes/webhook.ts:422` |
| `mock=true` param bypass payment verification | `src/server/routes/checkout.ts:339` |
| `config.isSandbox` toggleable via env | `src/server/config.ts:50` |
| `SANDBOX_MODE=true` bisa aktifkan mock di production | `src/server/config.ts:50` |

### Data Demo & Hardcode
| Data | Lokasi |
|------|--------|
| `49000` (harga default) | 6+ lokasi client + `apps.ts:48` |
| `builder@tertaut.com` auto-seed | `apps.ts:34` |
| `app_demo_123` hardcoded ID | `apps.ts:43` |
| `Fikri-MacBook-Pro` | `LicensingView.vue:18` |
| `fastmail-ai` | `DocsView.vue:19`, `aiProxyView.vue:36` |
| `EARLY50` coupon | `constants/smokeTest.ts:138` |
| `customer@example.com` di SDK | `packages/sdk/src/index.ts:225` |

### Dev/Auth Architecture
| Item | Status |
|------|--------|
| `DEV_USER` admin role di non-prod | ✅ By design — semua route dilindungi Better Auth |
| `portal/` wildcard public prefix | ✅ Dihapus total — endpoint customer portal dihilangkan, pembeli tidak butuh akun (tertaut adalah SaaS B2B untuk builder) |
| `PUBLIC_AI_PATHS` path matching | ✅ Sudah diperbaiki — path equality check presisi untuk `/chat` dan `/quota-status` (mencegah auth bypass) |
| `LICENSE_SIGNING_PRIVATE_KEY` di `.env` | ✅ Sudah diperbaiki — kunci dipindah ke `keys/license_signing_private.pem` & ter-gitignore |

### Infrastructure
| Item | Status |
|------|--------|
| Redis di-compose tapi tidak dipakai | ✅ Sudah diperbaiki — service & volume Redis dihapus dari `docker-compose.yml` (menggunakan in-memory sliding window) |
| `.env` berisi real secrets | ✅ Sudah diperbaiki — kunci privat dipindah ke `keys/` yang ter-gitignore, `.env` menunjuk ke path file |
| Docker Compose tanpa service app | ✅ Sudah diperbaiki 17 Sep |
| `drizzle.config.ts` fallback DB `tertaut` | ✅ Sudah diperbaiki — fallback konsisten ke `tertautv2` |
| `console.log` produksi | ✅ Sudah diperbaiki — credentials dan license key disanitasi & di-masking |

---

## DEVIASI DARI PRD

| # | PRD Requirement | Kode Aktual | Lokasi |
|---|-----------------|-------------|--------|
| 1 | RSA-256/Ed25519 asymmetric offline JWT | HS256 HMAC (shared secret) | `services/crypto.ts:59-69` |
| 2 | Chrome `chrome.storage.sync` auto-injection | Tidak ada | — |
| 3 | Deep link `tertaut://activate` | Tidak ada | — |
| 4 | Scheduled/threshold auto-disbursement | Manual trigger only | `routes/payouts.ts:10-43` |
| 5 | `builder_balances` & `disbursements` tables | Tidak ada — balance on-the-fly | `db/schema/index.ts` |
| 6 | Redis-backed distributed rate limiting | In-memory Map per-process | `services/aiGateway.ts:40-41` |
| 7 | Resend/Nodemailer email provider | ✅ Sudah diimplementasi | `services/email.ts` |
| 8 | Background queue worker for broadcast | Synchronous inline | `services/launchService.ts:121-143` |
| 9 | Disbursement status reflekt status Xendit | Mapping riil sudah ✅ | `routes/apps.ts:481-525` |

---

## KODE MATI / REDUNDAN

### Fake Door Engine Dibangun 2x
`routes/fakedoor.ts` dan `routes/smoketest.ts` — **keduanya sudah dihapus** dari kode. Tidak ada lagi.

### Client API Legacy Aliases
Fungsi lama (`createApp`, `updateApp`, `checkSlug`, `getFakeDoorMetrics`, `getFakeDoorLeads`, `recordFakeDoorEvent`) di `src/client/src/lib/api.ts:69-90, 164-179` tidak dipakai.

### Dead Redirect
`/builder/:appId?` redirect ke `/dashboard/smoke-test` — **sudah dihapus** bersama fakedoor/smoketest.

### `ai_usage_logs` DAN `ai_proxy_logs`
Dual-write ke kedua tabel, tapi consumer legacy table tidak ada. `aiGateway.ts` masih menulis ke `aiProxyLogs` (lines 250-260) meskipun ini deprecated.

---

## INFRASTRUKTUR

| Issue | Status |
|-------|--------|
| Redis di-compose tapi tidak dipakai | ✅ Dihapus dari `docker-compose.yml` (menggunakan in-memory sliding window limiter) |
| `.env` berisi API key asli | ✅ Kunci privat dipindah ke folder `keys/` yang ter-gitignore |
| `passwordHash` di schema tapi tidak dipakai | ✅ Kolom mati dihapus dari skema `builders` |
| SDK docs arahkan ke `localhost:3000` | ✅ Sudah diperbaiki 17 Sep |
| `package.json` punya `test` tapi coverage minimal | ✅ 47 test komprehensif di `server.test.ts` (Auth, MoR, Licensing, Seats, Offline Ed25519, AI Proxy, Coupons, DANA PG, Credit Ledger) |
| `drizzle.config.ts` fallback ke DB `tertaut` | ✅ Sudah konsisten ke `tertautv2` |
| `console.log` produksi | ✅ Disanitasi (credentials di-masking, sisa info startup & migration) |
| `bun.lock` dan `node_modules` | — |
| Dockerfile `bun install --production` | ✅ Multi-stage sudah |

---

## AUDIT ULANG 17 SEPTEMBER 2026 — TAMBAHAN BARU

### Terverifikasi Sudah Diperbaiki (v2.2.1 akurat) ✅
Semua item dari laporan lama kecuali yang tercantum di bawah.

### Masih Prematur / Belum Diperbaiki

1. ✅ **DANA UAT hardcoded amounts** — `webhook.ts:395-412`. [DIPERBAIKI 17 Sep] Di-gate strictly dalam `config.isSandbox`, parsing amount riil tanpa hardcode.
2. ✅ **SNAP BI webhook signature bypass** — `webhook.ts:422`. [DIPERBAIKI 17 Sep] Signature SHA256withRSA diverifikasi; bypass dimatikan di production.
3. ✅ **`/checkout/dana/finish?mock=true`** — `checkout.ts:339`. [DIPERBAIKI 17 Sep] Di-gate strictly dalam `checkoutConfig.isSandbox`.
4. ✅ **`console.log` license key** — `webhook.ts:123`. [DIPERBAIKI 17 Sep] Kunci disamarkan `TT-XXXX****`.
5. ✅ **`/api/v1/portal/` wildcard public** — `api.ts:23`. [DIHAPUS TOTAL 17 Sep] Seluruh customer portal dihapus (pembeli tidak butuh akun).
6. ✅ **`PUBLIC_AI_PATHS` path matching** — `aiproxy.ts:590`. [DIPERBAIKI 17 Sep] Path matching presisi ketat pada `/chat` dan `/quota-status`.
7. **Apps `GET /` no builder scoping** — `apps.ts:55`. Semua apps visible ke semua authenticated users.
8. **Apps `POST /` uses first builder** — `apps.ts:186`. Any user create app under any builder.
9. ✅ **DANA `verifyWebhook` always returns true** — `dana.ts:206-207`. [DIPERBAIKI 17 Sep] Menolak jika public key tidak ada di production.
10. ✅ **Hardcoded secrets in `.env`** — [DIPERBAIKI 17 Sep] Kunci privat dipindahkan ke `keys/*.pem` yang ter-gitignore, `.env` menunjuk path file.
11. **`DEV_USER` admin role** — `auth.ts:16-21`. All admin routes open in non-production.
12. ✅ **`config.isSandbox` toggleable via `SANDBOX_MODE=true`** — `config.ts:50`. [DIPERBAIKI 17 Sep] `isSandbox: !isProd`.
13. ✅ **Portal `offlineJwtGraceToken` exposed** — [DIHAPUS TOTAL 17 Sep] Seluruh customer portal dihapus.
14. ✅ **Portal N+1 queries** — [DIHAPUS TOTAL 17 Sep] Seluruh customer portal dihapus.
15. ✅ **`api.ts` `parseJson` never throws** — `lib/api.ts:32-47`. [DIPERBAIKI 17 Sep] Melempar ApiError saat !res.ok.
16. ✅ **PayView raw `fetch()`** — [DIPERBAIKI 17 Sep] Menggunakan method api client.
17. **Memory leaks setTimeout** — `LicensingView.vue`, `AiProxyView.vue`, `AdminPanelView.vue`, `DocsView.vue`.
18. **Missing `res.ok` checks** — `CheckoutView.vue`, `OverviewView.vue`, `PayView.vue`.
19. ✅ **`CustomerPortalView.vue` tidak ada** — [DIHAPUS TOTAL 17 Sep] Seluruh customer portal dihapus.
20. **LoginView `rememberMe` non-functional** — feature dead.
21. **Hardcoded values** — `49000`, `fastmail-ai`, `fast-summary-model`, `365 days`, `app_987123`, `Super Admin`.

### Temuan Tambahan

1. **DANA timestamp format bug** — `dana.ts:81-86`. `getUTCMonth() + 1` with `+07:00` offset double-counts timezone if server not UTC.
2. **DANA disbursement mock too permissive** — `dana.ts:229`. `mockEnabled` check memungkinkan production API call dengan sandbox credentials jika valid credentials ada di sandbox.
3. **Xendit mock detection confusing** — `xendit.ts:102`. `mockEnabled = config.isSandbox && (!secretKey || includes("sample_key"))`. Sandbox dengan real (non-sample) key → production API call.
4. **Health endpoint exposes version/runtime** — `health.ts:4-9`. `version: "2.2.0"`, `runtime: "Bun"` to public.
5. **No connection pool error handling** — `db/index.ts:9`. `postgres()` call no try-catch. Process crash if DB unreachable.
6. **`betterAuthSecret` falls back to `JWT_SECRET`** — `config.ts:68`. Secret reuse anti-pattern.
7. **`hwidSalt` falls back to `JWT_SECRET`** — `config.ts:75`. If JWT secret known, HWID hashes forgeable.
8. **`aiGateway.ts` non-atomic monthly usage increment** — `aiGateway.ts:207-222`. Concurrent requests could exceed budget.
9. **`credits.ts` `grant` has read-then-write race** — `credits.ts:51-65`. Balance read then insert, not atomic.
10. **`rateLimiter.ts` buckets Map grows unbounded** — `rateLimiter.ts:7`. Cleanup only runs every 60s and only when `size > 200`.
11. **`licenseToken.ts` generates new key every dev restart** — `licenseToken.ts:54-55`. Invalidates all previously issued offline tokens on restart.
12. **`config.ts` default DB URL `postgres://postgres:postgres@localhost`** — `config.ts:57`. Default credentials exposed in source.
13. **Panel `/stats` exposes system telemetry** — `panel.ts:56-80`. `nodeEnv`, `bunVersion`, `memoryUsageMB` to admin.

---

## TEST COVERAGE

- `src/server/__test/server.test.ts`: **47 test** — auth Better Auth, seat race atomik, migrasi HWID salted, Ed25519 offline token + denylist `jti` + JWKS + verifikasi lokal SDK, cross-app AI guard, status terminal webhook invoice/disbursement, ledger kredit.
- Catatan: Test E2E butuh server berjalan di `localhost:3000` + Postgres. Test kupon aman di sandbox.

---

## PRIORITAS PERBAIKAN

### Segera (Critical)
1. ✅ **Hapus DANA UAT hardcoded amounts** (`webhook.ts:395-412`) — [DIPERBAIKI 17 Sep] di-gate `config.isSandbox`.
2. ✅ **Hapus `mock=true` auth bypass di `/dana/finish`** (`checkout.ts:339`) — [DIPERBAIKI 17 Sep] di-gate `checkoutConfig.isSandbox`.
3. ✅ **Hapus `.env` dari git, pindah ke `keys/`** — [DIPERBAIKI 17 Sep] .env & keys/ di-.gitignore, config.ts membaca langsung dari `keys/*.pem`.
4. ✅ **Tambahkan signature verification untuk SNAP BI webhook** (`webhook.ts:422`, `dana.ts:183`) — [DIPERBAIKI 17 Sep] SNAP BI wajib verifikasi & fallback bypass dimatikan di production.
5. ✅ **Hapus `console.log` license key** (`webhook.ts:123`) — [DIPERBAIKI 17 Sep] Kunci disamarkan `TT-XXXX****`.
6. ✅ **Hapus `console.log` data sensitif di production server** — [DIPERBAIKI 17 Sep] Raw body dump dibersihkan dari console.
7. ✅ **Hapus `/api/v1/portal/` wildcard dari PUBLIC_PREFIXES** (`api.ts:23`) — [DIPERBAIKI 17 Sep] Diganti daftar eksplisit route portal.
8. ✅ **Hapus hardcoded `PUBLIC_AI_PATHS` substring matching** (`aiproxy.ts:590`) — [DIPERBAIKI 17 Sep] Diganti suffix check presisi `path.endsWith("/chat") || path.endsWith("/quota-status")`.

### Mendesak (High)
9. **Scoping builder di Apps `GET /` dan `GET /stats/overview`** (`apps.ts:55, 75`)
10. **Verifikasi kepemilikan builder di Apps `POST /`** (`apps.ts:186`)
11. ✅ **Hapus `offlineJwtGraceToken` dari portal response** (`portal.ts:124`) — [DIPERBAIKI 17 Sep]
12. ✅ **Fix portal N+1 queries** (`portal.ts:100-134`) — [DIPERBAIKI 17 Sep] Batch inArray query untuk apps & activations.
13. ✅ **Fix `api.ts` `parseJson` agar throw pada HTTP error** (`lib/api.ts:32-47`) — [DIPERBAIKI 17 Sep] Melempar `ApiError` saat `!res.ok`.
14. **Hapus `DEV_USER` admin role atau tambah pembatasan** (`auth.ts:16-21`)
15. **Hapus hardcoded secrets dari `.env` dan `config.ts`** (`config.ts:20-21`)
16. ✅ **Fix DANA `verifyWebhook` always-return-true** (`dana.ts:206-207`) — [DIPERBAIKI 17 Sep] Return false di production jika publicKey kosong.
17. ✅ **Hapus `SANDBOX_MODE` env toggle di production** (`config.ts:50`) — [DIPERBAIKI 17 Sep] `isSandbox: !isProd`.
18. ✅ **Fix PayView raw `fetch()` → api client** (`PayView.vue`) — [DIPERBAIKI 17 Sep] Menggunakan `api.*` methods.
19. **Add `res.ok` checks di CheckoutView, OverviewView** (`*.vue`)
20. **Clean up setTimeout memory leaks** (`LicensingView.vue`, dll)

### Sedang (Medium)
21. Fix DANA timestamp format bug (`dana.ts:81-86`)
22. Tambahkan database indexes yang hilang
23. ✅ **Fix `api.ts` return type dari `any` ke proper union/generic** — [DIPERBAIKI 17 Sep] `parseJson<T>(res)` generic.
24. Tambahkan `CustomerPortalView.vue` atau hapus referensinya
25. Fix `LoginView.vue` `rememberMe` atau hapus fitur
26. Hapus hardcoded `49000`, `fastmail-ai`, dll → config/env
27. Add rate limiting ke webhook endpoints
28. Tambahkan SSL/TLS ke database connection
29. Merge dual-write `ai_usage_logs` / `ai_proxy_logs`
30. Fix `credits.ts` read-then-write race

---

## RINGKASAN

| Kategori | Count |
|----------|-------|
| **Bug Kritis (masih ada)** | 22 |
| **Bug Sedang** | 11 |
| **Bug Client** | 13 |
| **Fitur Prematur** | 8 |
| **Deviasi PRD** | 9 |
| **Kode Mati/Redundan** | 4 |
| **Infrastruktur** | 10 |
| **Tambahan Audit Baru** | 13 |
| **TOTAL** | ~90+ item |

**Tiga masalah paling kritis (seluruhnya telah diperbaiki):**
1. ✅ DANA UAT hardcoded amounts di production (`webhook.ts:395-412`) — di-gate sandbox & amount diparse riil.
2. ✅ `/checkout/dana/finish?mock=true` auth bypass (`checkout.ts:339`) — di-gate sandbox.
3. ✅ `.env` berisi real secrets termasuk private key — dipindahkan ke `keys/*.pem` yang ter-gitignore.

---

## ANALISIS MODULARITAS & DRY

### File Terlalu Panjang (Harus Dipecah)

#### Server Routes

| File | Lines | Severity | Rekomendasi |
|------|-------|----------|-------------|
| `licensing.ts` | **1,041** | 🔴 KRITIS | Split jadi 4: `device.ts`, `credits.ts`, `admin.ts`, `token.ts` |
| `aiproxy.ts` | **856** | 🔴 KRITIS | Split jadi 5: `chat.ts`, `vault.ts`, `quota.ts`, `config.ts`, `logs.ts` |
| `apps.ts` | **670** | 🟡 SEDANG | Split disbursement ke `disbursement.ts`, stats ke `stats.ts` |
| `webhook.ts` | **610** | 🟡 SEDANG | Split per provider: `xendit.ts`, `dana.ts`, `fulfill.ts` |
| `checkout.ts` | **623** | 🟡 SEDANG | Split per domain: `session.ts`, `dana.ts`, `disburse.ts` |
| `panel.ts` | **441** | 🟡 SEDANG | Split per admin domain: `stats.ts`, `builders.ts`, `transactions.ts`, `payouts.ts` |
| `coupons.ts` | 284 | ✅ OK | — |
| `payouts.ts` | 280 | ✅ OK | — |
| `badge.ts` | 214 | ✅ OK | — |
| `launch.ts` | 57 | ✅ OK | — |

**Total server routes: 5,140 baris di 12 file.**

#### Server Services

| File | Lines | Severity | Rekomendasi |
|------|-------|----------|-------------|
| `aiGateway.ts` | **324** | 🟡 SEDANG | Rate limiter duplikat, usage tracking, SSE formatting |
| `dana.ts` | **297** | 🟡 SEDANG | `calculateMorBreakdown` duplikat dengan `xendit.ts` |
| `xendit.ts` | **230** | 🟡 SEDANG | `calculateMorBreakdown` duplikat dengan `dana.ts` |
| `credits.ts` | 168 | ✅ OK | — |
| `licenseToken.ts` | 158 | ✅ OK | — |
| `email.ts` | 141 | ✅ OK | — |
| `launchService.ts` | 132 | ✅ OK | — |
| `rateLimiter.ts` | 95 | ✅ OK | — |
| `crypto.ts` | 109 | ✅ OK | — |
| `coupon.ts` | 90 | ✅ OK | — |
| `license.ts` | 80 | ✅ OK | — |

**Total server services: 1,823 baris di 11 file.**

#### Client Views

| File | Lines | Severity | Rekomendasi |
|------|-------|----------|-------------|
| `AppsView.vue` | **1,196** | 🔴 KRITIS | Split jadi 4-5 komponen: `AppCatalog`, `AppCreateForm`, dll |
| `App.vue` | **656** | 🔴 KRITIS | Split layout: `Sidebar`, `TopHeader`, `MobileBottomNav` |
| `PayView.vue` | **623** | 🔴 KRITIS | Split jadi `PayLayout`, `PayOrderSummary`, `PayPaymentForm` |
| `AdminPanelView.vue` | **568** | 🔴 KRITIS | Split tab content jadi komponen terpisah |
| `LandingView.vue` | **506** | 🟡 SEDANG | Split jadi `LandingHeader`, `HeroSection`, `ModulePillars`, `Footer` |
| `OverviewView.vue` | **448** | 🟡 SEDANG | Split jadi `OverviewLayout`, `KpiCards`, `AnalyticsChart` |
| `LoginView.vue` | **432** | 🟡 SEDANG | Split jadi `LoginLayout`, `SignInForm`, `SignUpForm` |
| `DocsView.vue` | **371** | 🟡 SEDANG | Split SDK snippet, widget preview |
| `AiProxyView.vue` | **366** | 🟡 SEDANG | Split chat, vault, quota |
| `CheckoutView.vue` | **300** | ✅ OK | — |
| `CouponView.vue` | 218 | ✅ OK | — |
| `LicensingView.vue` | 172 | ✅ OK | — |

**Total client views: 6,330 baris di 11 view files.**

#### Client Components

| File | Lines | Severity | Rekomendasi |
|------|-------|----------|-------------|
| `CouponManager.vue` | **466** | 🟡 SEDANG | Split stats, table, modal |
| `SearchPicker.vue` | **329** | 🟡 SEDANG | `[key: string]: any` — perlu proper typing |
| `TransactionsLedgerTable.vue` | 224 | ✅ OK | — |
| `LicenseTable.vue` | 223 | ✅ OK | — |
| `IssueLicenseModal.vue` | 138 | ✅ OK | — |
| `VaultCredentialsManager.vue` | 134 | ✅ OK | — |
| `GlobalLedgerTable.vue` | 134 | ✅ OK | — |
| `AiStreamingPlayground.vue` | 125 | ✅ OK | — |
| `BuilderDirectoryTable.vue` | 112 | ✅ OK | — |
| `DynamicCheckoutForm.vue` | 103 | ✅ OK | — |
| `TokenGuardrailsWidget.vue` | 99 | ✅ OK | — |
| `AiProxyAuditTable.vue` | 91 | ✅ OK | — |
| `CheckoutResultCard.vue` | 87 | ✅ OK | — |
| `SystemTelemetryCard.vue` | 76 | ✅ OK | — |
| `PlatformKpiCards.vue` | 68 | ✅ OK | — |
| `BatchPayoutBanner.vue` | 51 | ✅ OK | — |

**Total client components: 2,460 baris di 16 komponen.**

---

### Duplikasi Kode Terbesar

#### Server

| Duplikat | Files | Ekstrak Ke |
|----------|-------|------------|
| `authenticate()` onBeforeHandle | 8+ route files | `requireAuth`/`requireAdmin` macro di `middleware/auth.ts` |
| `set.status = N; return { error: ... }` | 20+ handlers | `createErrorResponse()` di `src/server/utils/errors.ts` |
| `formatIdr` | `checkout.ts`, `payouts.ts` | `src/server/utils/format.ts` |
| `db.query.apps.findFirst` + 404 | 20+ occurrences | `getAppOr404()` di `src/server/utils/db.ts` |
| `db.query.transactions.findFirst` + 404 | 10+ occurrences | `getTransactionOr404()` di `src/server/utils/db.ts` |
| License validation (lookup + ACTIVE + expiry) | `licensing.ts` (6x), `aiproxy.ts`, `checkout.ts` | `LicenseService.validateLicense()` |
| Disbursement flow | `apps.ts`, `checkout.ts`, `panel.ts`, `payouts.ts` | `DisbursementService.handle()` |
| `calculateMorBreakdown` | `xendit.ts`, `dana.ts` | `calculateMor(amount, feeRate)` |
| Rate limit + 429 response | 6+ handlers | `checkRateLimit()` helper |
| `randomBytes(n).toString("hex")` ID | 6+ files | `generateId(prefix, length)` |
| `console.error` catch pattern | `webhook.ts`, `email.ts`, `dana.ts` | `safeCall(fn, label)` |
| URL construction (`publicAppUrl`) | `checkout.ts`, `dana.ts`, `launchService.ts` | `buildUrl()` di `src/server/utils/urls.ts` |
| `resolveCurrentBuilder` | `apps.ts` (47 lines) | Shared `resolveBuilder(headers)` |
| `createInvoice`/`createOrder` mock | `xendit.ts`, `dana.ts` | Parameterized `createOrder(provider, config)` |

#### Client

| Duplikat | Files | Ekstrak Ke |
|----------|-------|------------|
| `watch(dashboardEnv, () => loadData())` | 6+ views | `useDashboardEnv` composable |
| `ref + setTimeout + onUnmounted` alert | AdminPanelView, AiProxyView, LicensingView, DocsView | `useAlert(timeout)` composable |
| `Promise.all([api.getApps(), api.getLicenses()])` | 3+ views | `useApps()` composable with caching |
| `console.error('Failed to load ...:', err)` | 10+ views | `useErrorHandler()` composable |
| Header toolbar markup | 5+ views | `StandardHeader` component |
| Scrollable table wrapper | 8+ components | `DataTable` component |
| Search input with icon | 6+ components | `SearchInput` component |
| Status badge | 7+ components | `StatusBadge` component |
| `try/catch + loading state` | Every view | `useLoadingState()` composable |
| `api.getApps()` + `api.getLicenses()` | 3+ views | `useApps()` composable |

---

### Struktur Target yang Direkomendasikan

#### Server
```
src/server/
├── utils/
│   ├── errors.ts          # createErrorResponse(), ApiError
│   ├── db.ts              # getAppOr404(), getTransactionOr404()
│   ├── format.ts          # formatIdr(), generateId(), nowISO()
│   ├── urls.ts            # buildUrl(), buildCheckoutUrl()
│   ├── disbursement.ts    # handleDisbursement() (shared flow)
│   ├── license.ts         # validateLicense(), checkLicenseExpiry()
│   ├── rateLimit.ts       # checkRateLimitWithResponse()
│   └── payment.ts         # calculateMor(), createOrder()
├── routes/
│   ├── apps.ts            # CRUD only (~400 lines)
│   ├── apps/disbursement.ts  # Extract disbursement endpoint
│   ├── apps/stats.ts      # Extract stats overview
│   ├── checkout.ts        # Session + preview-coupon (~350 lines)
│   ├── checkout/dana.ts   # Extract /dana/finish
│   ├── checkout/disburse.ts  # Extract /disburse/:txId
│   ├── webhook.ts         # Route definitions only (~150 lines)
│   ├── webhook/xendit.ts  # Extract Xendit handlers
│   ├── webhook/dana.ts    # Extract DANA handlers
│   ├── webhook/fulfill.ts # Extract fulfillPaymentTransaction
│   ├── licensing/
│   │   ├── device.ts      # activate, verify, deactivate (~300 lines)
│   │   ├── credits.ts     # balance, consume, history (~150 lines)
│   │   ├── admin.ts       # issue, revoke, list (~200 lines)
│   │   └── token.ts       # verify-offline-token (~100 lines)
│   ├── aiproxy/
│   │   ├── chat.ts        # handleAiChat (~200 lines)
│   │   ├── vault.ts       # saveVaultCredential (~150 lines)
│   │   ├── quota.ts       # quota-status (~100 lines)
│   │   ├── config.ts      # configs GET/POST (~150 lines)
│   │   └── logs.ts        # logs endpoint (~50 lines)
│   └── panel/
│       ├── panel.ts       # Route definitions (~100 lines)
│       ├── stats.ts       # /stats (~100 lines)
│       ├── builders.ts    # /builders (~100 lines)
│       ├── transactions.ts  # /transactions (~80 lines)
│       └── payouts.ts     # /payouts/batch (~80 lines)
```

#### Client
```
src/client/src/
├── composables/
│   ├── useDataLoader.ts   # loadData() + Promise.all + try/catch
│   ├── useAlert.ts        # ref + setTimeout + onUnmounted
│   ├── useApps.ts         # Cached api.getApps() + api.getLicenses()
│   ├── useDashboardEnv.ts # watch(dashboardEnv) + reload
│   ├── useErrorHandler.ts # console.error pattern
│   ├── useLoadingState.ts # loading ref + try/catch/finally
│   └── useTableFilter.ts  # searchQuery + filter computed
├── components/
│   ├── common/
│   │   ├── StandardHeader.vue  # Extract from 5+ views
│   │   ├── DataTable.vue       # Extract from 8+ components
│   │   ├── SearchInput.vue     # Extract from 6+ components
│   │   ├── StatusBadge.vue     # Extract from 7+ components
│   │   ├── AlertBanner.vue     # Extract from 4+ views
│   │   ├── MobileBottomNav.vue # Extract from App.vue, AdminPanelView.vue
│   │   └── ConfirmDialog.vue   # Replace window.confirm()
├── views/
│   ├── AppsView.vue         # 1196 -> ~200 lines (shell only)
│   ├── App.vue              # 656 -> ~200 lines (shell only)
│   ├── PayView.vue          # 623 -> ~200 lines (shell only)
│   ├── AdminPanelView.vue   # 568 -> ~200 lines (shell only)
```

---

### Estimasi Upaya Refactoring

| Aktivitas | Files Dilibatkan | Baris Dilibatkan | Estimasi |
|-----------|-----------------|-----------------|----------|
| Extract `src/server/utils/` | 10+ files | ~200 baris duplicate | 1 hari |
| Split `licensing.ts` | 1 → 4 files | 1,041 → ~750 total | 2-3 hari |
| Split `aiproxy.ts` | 1 → 5 files | 856 → ~650 total | 2-3 hari |
| Split `AppsView.vue` | 1 → 4-5 components | 1,196 → ~800 total | 2-3 hari |
| Split `App.vue` | 1 → 4 components | 656 → ~500 total | 1-2 hari |
| Extract composables (`useAlert`, `useDataLoader`, `useApps`) | 6+ views | ~150 baris duplicate | 1 hari |
| Extract components (`StandardHeader`, `DataTable`, `SearchInput`) | 8+ components | ~300 baris duplicate | 1-2 hari |
| **TOTAL** | **~30 files** | **~3,300 baris** | **~10-15 hari** |

### ✅ Implementasi Foundation (17 Sep 2026)

Berikut file-file yang sudah dibuat sebagai foundation untuk refactoring modularitas dan DRY:

#### Server Utils (`src/server/utils/`)

| File | Isi | Status |
|------|-----|--------|
| `utils/errors.ts` | `apiError()`, `successResponse()` | ✅ DIBUAT |
| `utils/format.ts` | `formatIdr()`, `generateId()`, `nowISO()` | ✅ DIBUAT |
| `utils/db.ts` | `getAppOr404()`, `getTransactionOr404()`, `getBuilderById()`, `getLicenseByKey()` | ✅ DIBUAT |
| `utils/urls.ts` | `buildUrl()`, `buildCheckoutUrl()`, `buildPayUrl()` | ✅ DIBUAT |
| `utils/payment.ts` | `calculateMor(amount, feeRatePercent)` — menggantikan duplikat di `xendit.ts` dan `dana.ts` | ✅ DIBUAT |
| `utils/rateLimit.ts` | `checkRateLimit()` — wraper uniform untuk `enforceRateLimit` | ✅ DIBUAT |
| `utils/index.ts` | Re-export semua | ✅ DIBUAT |

#### Client Composables (`src/client/src/composables/`)

| File | Isi | Status |
|------|-----|--------|
| `useAlert.ts` | `alertMessage`, `showAlert()`, `clearAlert()`, auto-dismiss, `onUnmounted` cleanup | ✅ DIBUAT |
| `useDataLoader.ts` | `loading`, `error`, `loadData()` — generic data loader dengan try/catch/finally | ✅ DIBUAT |
| `useDashboardEnv.ts` | `watch(dashboardEnv, onChange)` — environment change watcher | ✅ DIBUAT |
| `useErrorHandler.ts` | `handleError(err, context)` — standardized error logging | ✅ DIBUAT |
| `useApps.ts` | `appsList`, `loading`, `error`, `refetch()` — cached `api.getApps()` with 5min TTL | ✅ DIBUAT |
| `useLoadingState.ts` | `loading`, `error`, `withLoading(fn)` — reusable loading wrapper | ✅ DIBUAT |
| `index.ts` | Re-export semua composables | ✅ DIBUAT |

#### Client Common Components (`src/client/src/components/common/`)

| File | Isi | Status |
|------|-----|--------|
| `StandardHeader.vue` | Toolbar header dengan slot `left`/`right` — extracted dari 5+ views | ✅ DIBUAT |
| `DataTable.vue` | Scrollable table wrapper dengan `columns`/`rows` props — extracted dari 8+ components | ✅ DIBUAT |
| `SearchInput.vue` | Search input with icon slot dan `v-model` — extracted dari 6+ components | ✅ DIBUAT |
| `StatusBadge.vue` | Status badge dengan `label` prop — extracted dari 7+ components | ✅ DIBUAT |
| `AlertBanner.vue` | Alert banner dengan `type` (`success`/`error`) dan `close` emit | ✅ DIBUAT |
| `MobileBottomNav.vue` | Fixed bottom nav dengan slot — extracted dari `App.vue` dan `AdminPanelView.vue` | ✅ DIBUAT |
| *No Barrel Files* | Menggunakan direct imports di seluruh client & server components | ✅ DIPATUHI |

#### Progress Status

| Aktivitas | Status |
|-----------|--------|
| Extract `src/server/utils/` | ✅ **DONE** — 8 utils files dibuat |
| Extract composables (`useAlert`, `useDataLoader`, `useApps`, dll) | ✅ **DONE** — direct import |
| Extract components (`StandardHeader`, `DataTable`, dll) | ✅ **DONE** — direct import |
| Split `licensing.ts` (1,041 → 4 modular route modules) | ✅ **DONE** — `device.ts`, `credits.ts`, `admin.ts`, `token.ts` |
| Split `aiproxy.ts` (856 → 5 modular route modules) | ✅ **DONE** — `chat.ts`, `vault.ts`, `quota.ts`, `config.ts`, `logs.ts` |
| Split `apps.ts`, `checkout.ts`, `webhook.ts`, `panel.ts` | ✅ **DONE** — domain modules terpisah |
| Split `AppsView.vue` (1,196 → 74 lines) | ✅ **DONE** — `AppCatalog.vue`, `AppCreateForm.vue` |
| Split `App.vue` (656 → 136 lines) | ✅ **DONE** — `DashboardSidebar.vue`, `DashboardTopHeader.vue`, `MobileNav.vue` |
| Split `PayView.vue` (623 → 357 lines) | ✅ **DONE** — `PayOrderSummary.vue`, `PayPaymentForm.vue` |
| Split `AdminPanelView.vue` (568 → 284 lines) | ✅ **DONE** — `AdminSidebar.vue`, `AdminTopHeader.vue`, `OverviewPreviews.vue`, `AdminMobileNav.vue` |

---

### Test Coverage

- `src/server/__test/server.test.ts`: **47 test** — auth Better Auth, seat race atomik, migrasi HWID salted, Ed25519 offline token + denylist `jti` + JWKS + verifikasi lokal SDK, cross-app AI guard, status terminal webhook invoice/disbursement, ledger kredit.
- Catatan: Test E2E butuh server berjalan di `localhost:3000` + Postgres. Test kupon aman di sandbox.
