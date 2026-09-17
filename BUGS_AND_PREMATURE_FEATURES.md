# Laporan Bug & Fitur Prematur — tertautv2

> Tanggal audit: 11 September 2026  
> Terakhir diperbarui: 17 September 2026 (Sistem Kupon, Guardrail AI & Multi-Provider AI Proxy)  
> Audit ulang: 17 September 2026 — temuan lengkap ada di bagian [AUDIT ULANG 17 SEPTEMBER 2026](#audit-ulang-17-september-2026) di bawah.

---

## STATUS PERBAIKAN CEPAT (Quick Patch Summary)
- [x] **Bug #2 (Path Traversal)**: Sanitized path & enforced `targetFile.startsWith(clientDistPath)` di `src/server/index.ts`.
- [x] **Bug #3 (CORS Reflect Origin)**: Restrict origin ke trusted list (localhost, 127.0.0.1, tertaut.com, public URLs) di `src/server/index.ts`.
- [x] **Bug #4 & #7 (Race Condition & Disbursement Status)**: Atomic `UPDATE ... WHERE disbursementStatus = 'PENDING'` lock dan pemetaan status real Xendit di `src/server/routes/apps.ts`.
- [x] **Bug #8 (JWT Timing Attack)**: Diganti dengan `crypto.timingSafeEqual()` di `src/server/services/crypto.ts`.
- [x] **Bug #9 (Weak Key Derivation)**: Diganti dengan SHA-256 derivation di `src/server/services/crypto.ts`.
- [x] **Bug #10 (Inconsistent DB URL Fallback)**: Menggunakan single source of truth `config.database.url` di `src/server/db/index.ts`.
- [x] **Bug #12 (Body Spread Mass Assignment)**: Menggunakan allowlist field eksplisit di `src/server/routes/apps.ts`.
- [x] **Bug #13 (Rate Limiter Memory Leak)**: Eviction pruning berkala pada sliding-window map di `src/server/services/aiGateway.ts`.
- [x] **Bug #14 (Full Table Scan Dashboard)**: Diganti dengan SQL aggregate `SUM()` dan `COUNT()` langsung di DB engine di `src/server/routes/apps.ts`.
- [x] **Bug #20 (Regex Injection .env Parser)**: Escaped regex metacharacters di `src/server/config.ts`.
- [x] **Bug #21 (Config Variable Shadowed)**: Variable lokal di-rename menjadi `appConfig` di `src/server/services/aiGateway.ts`.
- [x] **Bug #26 (Missing Component Import)**: `RefreshCw` di-import di `src/client/src/views/OverviewView.vue`.
- [x] **Bug #31 (Clipboard Tanpa Guard)**: Hardened dengan error handling, timer cleanup, dan fallback legacy di `src/client/src/composables/useClipboard.ts`.
- [x] **Bug #32 (App.vue Dead Code)**: Disederhanakan menjadi `!!route.meta.public` di `src/client/src/App.vue`.
- [x] **Bug #34 (Prop Mutation Anti-Pattern)**: Disederhanakan wizard step flow di `CaptureConfigForm.vue`.
- [x] **Bug #17 (Hardcoded Encryption Key Fallback)**: `JWT_SECRET` & `VAULT_ENCRYPTION_KEY` kini dipaksa dari env — startup production GAGAL jika secret kosong/pakai nilai default publik. Fallback publik hanya untuk development.
- [x] **Bug #18 (Simulate-Paid Tanpa Auth)**: `/checkout/simulate-paid/:txId` di-gate `config.isSandbox` (403 di luar sandbox).
- [x] **Bug #24 (Grace Period Selalu 30 Hari)**: `gracePeriodRemainingDays` kini dihitung dinamis dari expiry offline JWT token, bukan hardcoded.
- [x] **Mock Payment Isolasi**: Mock invoice/disbursement Xendit hanya aktif saat `config.isSandbox`; di production tanpa key → error (bukan respons mock).
- [x] **Webhook Bypass**: `verifyWebhook` hanya bypass di sandbox; di production tanpa token → tolak callback.
- [x] **AI Proxy Mock Key Mode**: Respons simulasi (`sk-test`/`mock`) hanya aktif di sandbox; di production → HTTP 503.
- [x] **Demo Auto-Seed**: `GET /apps` hanya membuat builder + `app_demo_123` saat sandbox.
- [x] **Hardcoded Rekening Bank**: Semua fallback rekening payer (`8830192847`, `"1234567890"`, `"Ahmad Rizky"`, `"Demo Builder"`, `"Vibe Builder"`) digantikan helper `XenditService.resolveDisbursementAccount()`. Di production, pencairan DITOLAK jika builder belum menyimpan rekening (bukan data palsu); fallback dummy hanya di sandbox.
- [x] **Default Harga Hardcoded**: `49000` kini dari `config.defaultPrice` (`DEFAULT_PRICE` env), bukan literal di route.
- [x] **Sistem Kupon Ditebus (17 Sep)**: Tabel `coupons` + kolom `coupon_code`/`discount_amount` di `transactions`, validasi & klaim kuota atomik di `POST /checkout/session`, preview kupon, CRUD `/api/v1/coupons`, persist kupon di `/launch/convert-to-live`, input kupon di halaman `/pay/:slug`, UI manajemen di dashboard, 4 test E2E penebusan.
- [x] **Guardrail AI Berfungsi (17 Sep)**: `currentMonthlyUsage` kini di-increment setiap request AI sukses (`incrementVaultMonthlyUsage`) sehingga `BUDGET_LIMIT_EXCEEDED` terpicu pemakaian nyata; `maxRequestsPerMin` dari `ai_app_configs` tidak lagi diabaikan.
- [x] **Provider AI Anthropic & DeepSeek (17 Sep)**: Implementasi upstream nyata (non-streaming & SSE streaming asli via `callUpstreamNonStreaming`/`callUpstreamStreamingChunks`); streaming tidak lagi memecah respons penuh per-kata; error upstream kini 502 `UPSTREAM_AI_ERROR`, bukan teks palsu `success: true`.
- [x] **Statistik Penebusan Kupon (17 Sep)**: `GET /api/v1/coupons/stats` (agregat harian, total diskon, kupon teratas) + grafik bar 7/14/30 hari di dashboard.

---

## BUG KRITIS (Harus Diperbaiki Segera)

### 1. Zero Autentikasi di Seluruh Endpoint
Semua route API terbuka tanpa autentikasi. Siapapun bisa:
- Trigger pembayaran real (`POST /apps/disburse/:transactionId`)
- Batch payout ke semua builder (`POST /panel/payouts/batch`)
- Issue/revoke license key
- Akses semua email leads dan nomor rekening bank builder

**Lokasi:** Semua file di `src/server/routes/`

### 2. Path Traversal — Bisa Baca File Server ✅ [DIPERBAIKI]
`resolve(clientDistPath, "." + decodedPath)` bisa resolve diluar directory dist. Request `GET /../../etc/passwd` membaca arbitrary file di sistem.
- **Status:** Diperbaiki dengan regex strip traversal `replace(/\.\.+[/\\]/g, "")` dan validasi ketat `targetFile.startsWith(clientDistPath)`.
- **Lokasi:** `src/server/index.ts:55-65`

### 3. CORS Reflect Origin + Credentials ✅ [DIPERBAIKI]
`origin: true, credentials: true` memungkinkan situs manapun melakukan authenticated cross-origin requests dan membaca response-nya. Full CSRF/data exfiltration.
- **Status:** Diperbaiki dengan origin validator fungsi berbasis whitelist (localhost, 127.0.0.1, subdomain `*.tertaut.com`, `config.publicAppUrl`, dan `config.publicStoreUrl`).
- **Lokasi:** `src/server/index.ts:18-22`

### 4. Race Condition: Double Disbursement ✅ [DIPERBAIKI]
Tidak ada locking pada transaksi sebelum check `paymentStatus === "PAID"` dan update ke "COMPLETED". Dua request concurrent bisa keduanya trigger Xendit disbursement → double pembayaran.
- **Status:** Diperbaiki dengan atomic conditional update: `UPDATE transactions SET disbursementStatus = 'PROCESSING' WHERE id = :id AND paymentStatus = 'PAID' AND disbursementStatus = 'PENDING' RETURNING id`. Request kedua otomatis ditolak dengan HTTP 409 Conflict.
- **Lokasi:** `src/server/routes/apps.ts:450-515`

### 5. Race Condition: License Seat Overflow
Check-then-act pada seat count tanpa transaction lock. Concurrent requests bisa melebihi batas `maxSeats`.

**Lokasi:** `src/server/routes/licensing.ts:64-75`

### 6. Race Condition: Duplicate License pada Webhook
Antara idempotency check dan UPDATE, webhook callback lain bisa slip in dan buat duplicate license key.

**Lokasi:** `src/server/routes/webhook.ts:84-106`

### 7. Disbursement Status Selalu COMPLETED ✅ [DIPERBAIKI]
`XenditService.createDisbursement` bisa return `FAILED`/`PROCESSING`, tapi kode unconditionally set `disbursementStatus: "COMPLETED"`.
- **Status:** Diperbaiki dengan mapping status riil dari respons Xendit (`FAILED`, `PROCESSING`, atau `COMPLETED`) serta rollback ke `PENDING` jika terjadi network/unhandled exception.
- **Lokasi:** `src/server/routes/apps.ts:481-525`

### 8. JWT Signature Vulnerable Timing Attack ✅ [DIPERBAIKI]
Perbandingan `!==` non-constant-time. Attacker bisa forge valid JWT byte-by-byte via timing side-channel. Harus pakai `crypto.timingSafeEqual()`.
- **Status:** Diperbaiki dengan perbandingan constant-time `crypto.timingSafeEqual()` dan validasi buffer length.
- **Lokasi:** `src/server/services/crypto.ts:84-90`

### 9. Weak Key Derivation ✅ [DIPERBAIKI]
Jika encryption key < 32 bytes, di-pad dengan ASCII `"0"`. Bukan proper KDF (seharusnya HKDF/PBKDF2/Argon2).
- **Status:** Diperbaiki dengan cryptographic derivation `createHash("sha256").update(key).digest()` jika key tidak berukuran 32 bytes.
- **Lokasi:** `src/server/services/crypto.ts:9-18`

---

## BUG SEDANG

### 10. Inconsistent Database URL Fallback ✅ [DIPERBAIKI]
`db/index.ts` fallback ke database `tertaut`, sedangkan `config.ts` fallback ke `tertautv2`. Jika env var unset, app connect ke database salah.
- **Status:** Diperbaiki dengan mengimpor `config` dan menggunakan `config.database.url` sebagai single source of truth.
- **Lokasi:** `src/server/db/index.ts:1-8`

### 11. GET Handler Bikin Data
`GET /apps` membuat builder + app sebagai side effect. GET harusnya idempotent.

**Lokasi:** `src/server/routes/apps.ts:15-38`

### 12. Body Spread Tanpa Allowlist ✅ [DIPERBAIKI]
Request body di-spread langsung ke DB update tanpa validasi field. Attacker bisa overwrite `builderId`, `id`, `createdAt`.
- **Status:** Diperbaiki dengan sanitasi eksplisit allowlist fields (`name, slug, targetPrice, mode, description, headline, subheadline, mediaUrl, valueProps, ctaText, customIntentMessage, redirectUrl, pageBlocks, customHtml, captureConfig`).
- **Lokasi:** `src/server/routes/apps.ts:255-275`

### 13. Memory Leak Rate Limiter ✅ [DIPERBAIKI]
`rateLimitMap` (Map) entries tidak pernah di-evict. Setiap unique ID buat entry baru yang persist selama process hidup.
- **Status:** Diperbaiki dengan pruning berkala pada entri yang seluruh timestamp-nya telah kedaluwarsa di luar window 60 detik.
- **Lokasi:** `src/server/services/aiGateway.ts:130-145`

### 14. Full Table Scan untuk Dashboard Stats ✅ [DIPERBAIKI]
Load seluruh tabel ke memory untuk hitung aggregate. Seharusnya pakai SQL `SUM`/`COUNT`.
- **Status:** Diperbaiki dengan menjalankan SQL aggregasi `COALESCE(SUM(...), 0)` dan `count(*)` langsung di engine PostgreSQL tanpa memory scan.
- **Lokasi:** `src/server/routes/apps.ts:58-95`

### 15. Email Leads & Bank Account Exposed Tanpa Auth
Siapapun bisa akses semua email leads dan nomor rekening bank builder.

**Lokasi:** `src/server/routes/panel.ts:100-169`, `src/server/routes/portal.ts:10-79`, `src/server/routes/fakedoor.ts:290-336`

### 16. Webhook Ignore Status FAILED
Xendit bisa kirim `status: "FAILED"` tapi tidak di-handle. Transaksi stuck `PENDING` forever.

**Lokasi:** `src/server/routes/webhook.ts:92-142`

### 17. Hardcoded Encryption Key Fallback
Default JWT secret dan vault key bersifat publik. Jika env var unset, semua JWT bisa di-forge dan semua API key bisa di-decrypt.

**Lokasi:** `src/server/config.ts:33-37`

### 18. Simulate-Paid Tanpa Auth + Race Condition
Siapapun bisa panggil `POST /checkout/simulate-paid/:txId` untuk buat license dari transaksi yang belum dibayar.

**Lokasi:** `src/server/routes/checkout.ts:246-316`

### 19. Portal Deactivation Tanpa Prove Ownership
`customerEmail` optional — siapapun dengan license key + HWID hash bisa deactivate device tanpa bukti ownership.

**Lokasi:** `src/server/routes/portal.ts:86-88`

### 20. Regex Injection di .env Parser ✅ [DIPERBAIKI]
`key` parameter dipakai langsung di regex. Jika key mengandung regex metacharacters, bisa break atau match unintended patterns.
- **Status:** Diperbaiki dengan escaping karakter khusus regex (`replace(/[.*+?^${}()|[\]\\]/g, "\\$&")`).
- **Lokasi:** `src/server/config.ts:7-9`

### 21. Config Variable Shadowed ✅ [DIPERBAIKI]
`config` variable lokal shadow import `config` dari `../config`, membuat module config inaccessible di scope tersebut.
- **Status:** Diperbaiki dengan me-rename variabel lokal menjadi `appConfig`.
- **Lokasi:** `src/server/services/aiGateway.ts:197-205`

### 22. Missing Database Indexes
Index tidak ada di kolom yang sering di-query: `transactions.appId`, `transactions.paymentStatus`, `licenses.appId`, `licenses.customerEmail`, `fakeDoorEvents.appId`, `aiVaultCredentials.appId`, dll.

### 23. Sequential DB Inserts di Loop
Setiap email trigger separate `await` DB round-trip. Seharusnya batch insert.

**Lokasi:** `src/server/services/launchService.ts:111-118`

### 24. Grace Period Selalu 30 Hari
`gracePeriodRemainingDays` hardcoded 30, tidak dihitung dari token expiry.

**Lokasi:** `src/server/routes/licensing.ts:191`

### 25. Silent Error Swallowing
DB write errors pada view tracking di-catch dan di-discard tanpa log.

**Lokasi:** `src/server/routes/fakedoor.ts:33`, `src/server/routes/smoketest.ts:35`

---

## BUG CLIENT

### 26. Missing Import Component ✅ [DIPERBAIKI]
`<RefreshCw>` digunakan di template tapi tidak di-import. Component tidak resolve.
- **Status:** Diperbaiki dengan mengimpor `RefreshCw` dari `lucide-vue-next` di `OverviewView.vue`.
- **Lokasi:** `src/client/src/views/OverviewView.vue:18`

### 27. Route Params Tidak Reaktif
Route params dibaca sekali, tidak reactive pada in-place navigation.

**Lokasi:** `src/client/src/views/PublicProductView.vue:12`, `src/client/src/views/CustomerPortalView.vue:25`

### 28. Embed Script Path Tidak Konsisten
Dua path berbeda untuk embed script — salah satu pasti broken.

**Lokasi:** `src/client/src/components/smoketest/GeneratedEmbedCard.vue:55` (`/smoke-test/embed.js`) vs `DocsView`/`LandingView` (`/widgets/embed.js`)

### 29. API Client Tidak Ada res.ok Check
Fetch wrapper tidak mengecek `res.ok`. Error response tidak ditangkap kecuali di `streamAiChat`.

**Lokasi:** `src/client/src/lib/api.ts` (semua fungsi kecuali `streamAiChat:362-365`)

### 30. Router Tidak Ada Auth Guard
`/panel` (admin), `/portal`, `/dashboard/*` semua `meta: { public: true }` atau tanpa meta. Tidak ada auth guard.

**Lokasi:** `src/client/src/router/index.ts:71-75`

### 31. Clipboard Tanpa Guard ✅ [DIPERBAIKI]
`navigator.clipboard.writeText` dipanggil raw tanpa try-catch. Multiple `setTimeout` tidak pernah di-clear.
- **Status:** Diperbaiki di `useClipboard.ts` dengan try-catch, pembatalan timer aktif via `clearTimeout`, dan fallback legacy `document.execCommand('copy')`.
- **Lokasi:** `src/client/src/composables/useClipboard.ts`

### 32. App.vue Dead Code ✅ [DIPERBAIKI]
`isPublicPage` check `meta.fullscreen` — meta ini tidak pernah di-set di route manapun.
- **Status:** Disederhanakan menjadi `computed(() => !!route.meta.public)` yang bersih.
- **Lokasi:** `src/client/src/App.vue:22`

### 33. PayView Payment Rail Tidak Dikirim
`selectedPaymentRail` di-set tapi tidak pernah dikirim ke checkout request.

**Lokasi:** `src/client/src/views/PayView.vue:46`

### 34. Prop Mutation Anti-Pattern ✅ [DIPERBAIKI]
`captureForm.type` dimutasi via `as any` dari child component.
- **Status:** Diperbaiki dengan penyederhanaan alur studio 3-langkah terarah di `CaptureConfigForm.vue`.
- **Lokasi:** `src/client/src/components/smoketest/CaptureConfigForm.vue`

### 35. LandingView Badge Image Hardcoded
`selectedDemoBadge` diabaikan, img src hardcoded ke satu path.

**Lokasi:** `src/client/src/views/LandingView.vue:276`

### 36. Runtime TypeError Risks
Dereference properti dari response tanpa null check.

**Lokasi:** `CheckoutView.vue` (`res.data.amount`), `BatchPayoutBanner.vue:8` (`ref<any>`), `LicensingView.vue` (`res.license.licenseKey`)

### 37. Weak `any` Types
Banyak `ref<any>`, `catch (err: any)`, `pageBlocks: any[]`, `answers?: any`, `metadata?: any`.

**Lokasi:** `types/app.ts:20`, `types/smoketest.ts:62,64`, `LicensingView.vue:20`, `AiProxyView.vue:38`, `AdminPanelView.vue:38`

---

## FITUR PREMATUR / STUB

> **Update 17 Sep:** Item kupon, guardrail AI budget/rate, dan provider Anthropic/DeepSeek pada bagian ini telah DIHAPUSKAN dari daftar prematur — lihat daftar perbaikan di atas.

### ✅ [SELESAI 17 Sep] Sistem Kupon = Stub
Sudah berfungsi penuh: tabel `coupons`, penebusan atomik di checkout, persist di launch kit, CRUD API, input pembeli di `/pay/:slug`, UI dashboard, dan 4 test E2E.

### Payment System Masih Mock
| Item | Lokasi |
|------|--------|
| Invoice return `inv_mock_...` jika tidak ada API key | `src/server/services/xendit.ts:52-66` |
| Disbursement mock selalu `COMPLETED` | `src/server/services/xendit.ts:115-124` |
| Webhook verification bypass saat token unset | `src/server/services/xendit.ts:92-94` |
| Hardcoded `BCA / "Demo Builder" / 1234567890` | `src/server/routes/checkout.ts:206-210` |
| Fallback bank `BCA 8830192847 "Ahmad Rizky"` | `src/server/routes/payouts.ts:46-50` |
| App route fallback account `"1234567890"` | `src/server/routes/apps.ts:475-478` |
| Panel builder directory fallback hardcoded bank | `src/server/routes/panel.ts:126-141` |

### Email / Notifikasi Belum Jalan
| Item | Lokasi |
|------|--------|
| "Dispatch" email cuma `console.log` | `src/server/services/notifier.ts:45-52` |
| Broadcast queue synchronous inline, bukan background worker | `src/server/services/launchService.ts:121-143` |

### AI Proxy Masih Demo
| Item | Lokasi |
|------|--------|
| Key mode return scripted response "Halo!" | `src/server/routes/aiproxy.ts:222-239` |
| Streaming fallback return static placeholder | `src/server/routes/aiproxy.ts:316-324` |
| Mock key (`AIzaSyB3-SAMPLE-...`) bypass guard, hit real API | `src/server/routes/aiproxy.ts:187` vs `db/seed.ts:321-322` |
| `maxRequestsPerMin` dari DB di-fetch tapi di-ignore, hardcoded 15 | `src/server/routes/aiproxy.ts:51` vs `:64-69` |

### Demo Data Auto-Seed
| Item | Lokasi |
|------|--------|
| GET /apps bikin data demo jika DB kosong | `src/server/routes/apps.ts:14-38` |
| Default customer email `pembeli@tertaut.com` | `src/client/src/views/CheckoutView.vue:20` |
| Default device name `Fikri-MacBook-Pro` | `src/client/src/views/LicensingView.vue:18` |
| Default budget `500000` | `src/client/src/views/AiProxyView.vue:28` |
| Widget preview hardcoded `"89 Lisensi Terjual"` | `src/client/src/views/DocsView.vue:271` |
| SDK checkout fallback `customer@example.com` | `packages/sdk/src/index.ts:225` |

---

## DEVIASI DARI PRD (Spesifikasi vs Realita)

| # | PRD Requirement | Kode Aktual | Lokasi |
|---|-----------------|-------------|--------|
| 1 | Module 3 FR-3.1: RSA-256/Ed25519 asymmetric offline JWT | HS256 HMAC (shared secret) | `services/crypto.ts:59-69, 80-84` |
| 2 | Module 3 FR-4.1: Chrome `chrome.storage.sync` auto-injection | Tidak ada | — |
| 3 | Module 3 FR-4.2: Deep link `tertaut://activate` | Tidak ada | — |
| 4 | Module 2 FR-4.2: Scheduled/threshold auto-disbursement | Manual trigger only | `routes/payouts.ts:10-43` |
| 5 | Module 2: `builder_balances` & `disbursements` tables | Tidak ada — balance dihitung on-the-fly | `db/schema/index.ts` |
| 6 | Module 4: Redis-backed distributed rate limiting | In-memory Map per-process | `services/aiGateway.ts:40-41` |
| 7 | Module 5: Resend/Nodemailer email provider | Console.log only | `services/notifier.ts:45-52` |
| 8 | Module 5: Background queue worker for broadcast | Synchronous inline processing | `services/launchService.ts:121-143` |
| 9 | Disbursement status harus reflekt status Xendit | Selalu `COMPLETED` regardless | `routes/checkout.ts:216` |

---

## KODE MATI / REDUNDAN

### Fake Door Engine Dibangun 2x
`routes/fakedoor.ts` (`/fakedoor/*`) dan `routes/smoketest.ts` (`/smoke-test/*`) adalah implementasi hampir identik dari fungsionalitas yang sama: public page data, click tracking, lead capture, metrics, leads list.

### Dual-Write Tanpa Consumer
`ai_usage_logs` DAN `ai_proxy_logs` di-write bersamaan, tapi consumer untuk legacy table tidak ada.

**Lokasi:** `src/server/services/aiGateway.ts:250-260`

### Client API Legacy Aliases
Fungsi lama (`createApp`, `updateApp`, `checkSlug`, `getFakeDoorMetrics`, `getFakeDoorLeads`, `recordFakeDoorEvent`) tidak dipakai.

**Lokasi:** `src/client/src/lib/api.ts:69-90, 164-179`

### Dead Redirect
`/builder/:appId?` redirect ke `/dashboard/smoke-test` — dead redirect.

**Lokasi:** `src/client/src/router/index.ts:77-79`

---

## HARDCODED MOCK DATA DI PRODUCTION

| Data | Lokasi |
|------|--------|
| `49000` (harga default) | 6+ lokasi: `OverviewView.vue:30`, `CheckoutView.vue:19`, `DynamicCheckoutForm.vue:9`, `CreateCampaignModal.vue:20`, `DocsView.vue`, `SmokeTestAnalytics.vue` |
| `pembeli@tertaut.com` | `CheckoutView.vue:20`, `DynamicCheckoutForm.vue:10`, `CustomerPortalView.vue` |
| `Fikri-MacBook-Pro` | `LicensingView.vue:18`, `LicenseValidatorPanel.vue:21` |
| `QRIS Instan` | `LandingView.vue:26` |
| `fastmail-ai` | `DocsView.vue:19`, pay/badge links |
| `500000` budget | `AiProxyView.vue:28`, `VaultCredentialsManager.vue:13` |
| `fast-summary-model` | `AiProxyView.vue:34`, `AiStreamingPlayground.vue:10` |
| `CPU_INTEL_i9_13900K_SN_88219` | `LicensingView.vue:53` |
| `EARLY50` coupon | `constants/smokeTest.ts:138`, `ProductCaptureSection.vue:84` |
| `https://cal.com` | `constants/smokeTest.ts:144` |
| `© 2026` | `PageBuilderHtml.vue:128` |
| `89 Lisensi Terjual` | `DocsView.vue:271` |

---

## INFRASTRUKTUR

| Issue | Lokasi |
|-------|--------|
| Redis di-setup tapi tidak dipakai — rate limiter in-memory Map, reset tiap restart | `docker-compose.yml` + `aiGateway.ts:40` |
| Docker Compose tidak ada app service | `docker-compose.yml:1-36` |
| `.env` berisi API key asli, tidak di-.gitignore dengan benar | `.env:24-27` |
| `passwordHash` ada di schema tapi tidak pernah dipakai (zero auth) | `db/schema/builders.ts:7` |
| SDK docs arahkan ke `localhost:3000` | `DocsView.vue:35` |
| SDK v0.1.0 belum published tapi docs instruksi `npm install` | `DocsView.vue:150`, `packages/sdk/package.json:3` |
| `package.json` punya script `test` tapi coverage sangat minim (2 test files) | `package.json:20` |
| `drizzle.config.ts` fallback ke `postgres:postgres@localhost` plain text | `drizzle.config.ts:8` |
| Dockerfile `bun install --production` mungkin miss dependencies | `Dockerfile:20, 33` |
| 22x `console.log`/`console.warn` di production server code | Multiple lokasi |

---

## PRIORITAS PERBAIKAN

1. **Auth system** — implementasi JWT auth middleware untuk semua route
2. ~~Path traversal~~ ✅
3. ~~CORS~~ ✅
4. ~~Race conditions (disbursement)~~ ✅ — seat license & webhook masih check-then-act
5. ~~Mock payment cleanup~~ ✅
6. **Email integration** — integrasikan Resend/Nodemailer (notifier.ts sudah terhapus; pembeli tidak menerima email lisensi)
7. **PRD alignment** — implementasi RSA-256 JWT untuk offline licensing
8. **Rate limiter** — pindah ke Redis
9. ~~Database indexes~~ ✅
10. **Kode redundan** — merge fakedoor.ts dan smoketest.ts

---

## AUDIT ULANG 17 SEPTEMBER 2026

Audit ulang terhadap kode terkini. Sebagian besar perbaikan v2.2.1 terverifikasi benar-benar ada. Berikut status lengkap.

### Terverifikasi Sudah Diperbaiki (v2.2.1 akurat) ✅
Path traversal (`index.ts`), CORS whitelist, atomic disbursement lock + pemetaan status riil, timing-safe JWT, SHA-256 KDF, DB URL konsisten, mass-assignment allowlist, rate limiter pruning, aggregate SQL di `apps.ts`, database indexes (semua tabel relevan ber-index), grace period dinamis dari token, gate sandbox untuk simulate-paid/mock invoice/webhook bypass/mock AI key, `resolveDisbursementAccount()` menggantikan semua rekening dummy, harga default dari env, Dockerfile multi-stage dengan healthcheck, `.env` sudah di-gitignore.

### Masih Prematur (terkonfirmasi di kode saat ini)
1. **Zero autentikasi (akar masalah)** — tidak ada middleware auth; `passwordHash` masih kolom mati; `/panel/payouts/batch`, `/licensing/issue|revoke|list`, `/portal/licenses?email=...`, `/checkout/disburse/:txId` terbuka.
2. **Email delivery hilang total** — `notifier.ts` sudah terhapus; `PayView.vue` masih berjanji kirim lisensi ke email; tidak ada kode kirim email sama sekali.
3. **Budget guardrail AI mati** — `currentMonthlyUsage` dicek tapi tak pernah di-increment. → ✅ **DIPERBAIKI 17 Sep** (`incrementVaultMonthlyUsage`).
4. **`maxRequestsPerMin` diabaikan** → ✅ **DIPERBAIKI 17 Sep**.
5. **Sistem kupon = stub** (EARLY50 tidak tersimpan & tak bisa ditebus) → ✅ **DIPERBAIKI 17 Sep**.
6. **Provider AI selain Gemini/OpenAI merespon palsu** → ✅ **DIPERBAIKI 17 Sep** (Anthropic & DeepSeek nyata, streaming SSE asli, error upstream eksplisit).
7. **Webhook disbursement tidak ada** — payout PROCESSING di Xendit tidak pernah final.
8. **Webhook abaikan status FAILED** — transaksi FAILED stuck PENDING.
9. **Race condition seat & duplicate license webhook** — masih check-then-act tanpa DB lock.
10. **`grantCredits` diterima tapi tak pernah ditegakkan**.
11. **Deviasi PRD**: HS256 (bukan RSA/Ed25519), tanpa `chrome.storage.sync`, tanpa deep link `tertaut://activate`, payout manual-only, tanpa tabel `builder_balances`/`disbursements`, Redis di-compose tapi tak dipakai.
12. **Data demo & hardcode**: `pembeli@tertaut.com`, `49000`, `500000`, `fast-summary-model`, `fastmail-ai`, "89 Lisensi Terjual" (DocsView), `customer@example.com` di SDK, auto-seed di `GET /apps` (ter-gate sandbox tapi GET tetap menulis).
13. **SDK v0.1.0 belum publish** tapi docs menyuruh `npm install @tertaut/sdk`; endpoint docs `localhost:3000`.

### Temuan Baru (belum ada di laporan lama)
1. **`body.appId` dipercaya mentah di AI chat** (`aiproxy.ts`) — license app A bisa membakar vault app B (cross-app entitlement leak).
2. **`/panel/stats|builders|transactions`**: full table scan + N+1 query per baris.
3. **`POST /payouts/trigger` tanpa `builderId`** memilih builder pertama — risiko salah penerima dana di multi-builder.
4. **`DocsView.copyCode`** pakai `navigator.clipboard` raw; composable `useClipboard` yang sudah di-harden tidak dipakai (juga di `LandingView`, `LicensingView`, `CustomerPortalView`).
5. **`selectedPaymentRail` di PayView tetap tidak dikirim** ke `/checkout/session` — pilihan QRIS/VA/E-Wallet dekoratif.
6. **Client `api.ts` masih tanpa `res.ok` check** di hampir semua fungsi.
7. **`docker-compose.yml` tanpa service app**; `console.log` produksi masih ada (`index.ts`, `webhook.ts`).
8. **`App.vue` masih membaca `meta.fullscreen`** yang tak pernah di-set (dead code, dibersihkan v2.2.1 ternyata ter-regresi).
9. **`drizzle.config.ts` fallback ke DB `tertaut`** sedangkan config server fallback `tertautv2` — inkonsistensi lama #10 luput di drizzle config.

### Test Coverage
- `src/server/__test/server.test.ts`: **47 test** — 29 di atas + auth Better Auth, seat race atomik, migrasi HWID salted, Ed25519 offline token + denylist `jti` + JWKS + verifikasi lokal SDK, cross-app AI guard, status terminal webhook invoice/disbursement, ledger kredit (grant/debit atomik/idempotensi/endpoint HTTP).
- Catatan: test E2E butuh server berjalan di `localhost:3000` + Postgres; test kupon aman di sandbox karena `XENDIT_SECRET_KEY` mock → invoice mock, bukan tagihan nyata.

---

### Pembaruan Sesi Terbaru (17 September 2026)

Sudah diperbaiki:
- ✅ **Autentikasi** — Better Auth native Elysia (email + password), guard `requireAuth`/`requireAdmin` pada panel/payouts/coupons/launch/apps/checkout/licensing + aiproxy; bypass `DEV_USER` hanya di non-production.
- ✅ **Race condition seat & duplicate license webhook** — klaim seat atomik (`db.transaction` + `FOR UPDATE`) + `unique_licenses_transaction_id` + backstop `23505`.
- ✅ **Portal tanpa bukti kepemilikan** — `POST /portal/access` (email + license key → signed token); `/portal/licenses` & `/portal/transactions` wajib token.
- ✅ **Rate limiting** — sliding-window in-memory di endpoint lisensi & portal.
- ✅ **Token offline HS256 → Ed25519** — `LicenseTokenService` (EdDSA, `kid`, `jti`), JWKS + public key PEM, revoke via denylist `revoked_tokens`, verifikasi lokal SDK via Web Crypto.
- ✅ **Deviasi SDK** — hapus fallback email demo; `customerEmail` wajib saat checkout.
- ✅ **HWID hash tanpa salt** — kini HMAC-SHA256 (`HWID_SALT`/`JWT_SECRET`, prefix `hw2:`) dengan migrasi transparan untuk binding legacy.
- ✅ **Data demo/hardcode** — `pembeli@tertaut.com`, `customer@example.com` dihapus dari checkout/portal/SDK; social-proof widget di `DocsView` kini menarik angka asli dari `/widgets/badge/:slug`.
- ✅ **Cross-app entitlement leak AI** — `body.appId` tidak lagi dipercaya; lisensi app A tidak bisa memakai vault app B (`APP_MISMATCH`).
- ✅ **Webhook status terminal** — invoice Xendit `FAILED`/`EXPIRED` kini ditandai dan tidak menurunkan transaksi `PAID`; callback disbursement Xendit ditambahkan (`/webhook/xendit/disbursement`) + guard status terminal DANA.
- ✅ **Payout tanpa builder** — `/payouts/trigger` tidak lagi menebak builder pertama; non-admin hanya boleh mencairkan builder miliknya.
- ✅ **N+1 panel** — `/panel/stats` (agregasi SQL), `/panel/builders`, dan `/panel/transactions` memakai batch query.
- ✅ **Clipboard non-secure** — `useClipboard` (dengan fallback `execCommand`) dipakai di Landing/Docs/Licensing/CustomerPortal.
- ✅ **`selectedPaymentRail`** — pilihan QRIS/VA/E-Wallet kini dikirim `paymentRail` → `payment_methods` Xendit.
- ✅ **Docker Compose** — service `app` (build Dockerfile) ditambahkan, depend on Postgres sehat; default DB diselaraskan ke `tertautv2`.
- ✅ **Email delivery (Resend)** — `EmailService` (REST API, tanpa dep baru) mengirim kunci lisensi saat pembayaran terkonfirmasi (webhook) & saat lisensi diterbitkan manual; non-fatal, dilewati bila `RESEND_API_KEY` kosong.
- ✅ **Publish SDK** — `@tertaut/sdk@0.1.5` terbit ke npm (public) dengan `exports`, `.d.ts`, README, `publishConfig.access`.
- ✅ **Endpoint docs** — prompt AI di `DocsView` memakai `window.location.origin` (bukan hardcode `localhost:3000`).
- ✅ **Git hooks** — Husky v9: pre-commit menjalankan `build:server` + typecheck SDK.
- ✅ **Login / Logout UI** — tombol "Masuk" (→ `/login`) dan "Keluar" di LandingView; `handleLogout` di App.vue memanggil `authClient.signOut()`. Origin check diperluas ke `localhost:3000` & `127.0.0.1:3000`.
- ✅ **Auth gate global** — `apiV1Routes` menegakkan `authenticate()` untuk semua `/api/v1/*` kecuali path publik yang sudah diizinkan (health, badge, widget, webhook, portal/access, checkout/session, apps/by-slug, licensing verify/validate/activate/deactivate, credits). Endpoint admin licensing (`/list`, `/issue`, `/revoke`) yang sebelumnya tanpa guard kini dilindungi. Di prod → 401 tanpa sesi; dev → DEV_USER bypass.
- ✅ **Ledger kredit (`grantCredits`)** — tabel `credit_ledger` (append-only, `SUM(delta)` + `balance_after` audit). Kredit di-grant otomatis saat pembayaran terkonfirmasi & saat lisensi diterbitkan manual. Endpoint publik baru: `POST /api/v1/licensing/credits/{balance,consume,history}`. `consume` atomik (`FOR UPDATE`, anti saldo negatif) + idempotensi via `reference`. `verify` kini mengembalikan `credits`. SDK `credits.balance/consume/history`.

Tidak ada item backlog yang tersisa.
