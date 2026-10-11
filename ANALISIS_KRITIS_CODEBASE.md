# Analisis Kritis Codebase Tertaut

**Tanggal:** 2026-10-11  
**Versi:** 2.2.3  
**Arsitektur:** Monorepo Monolith (Bun + Elysia + Vue + PostgreSQL/Drizzle)

---

## Ringkasan Eksekutif

Tertaut memiliki fondasi arsitektur yang solid dengan:

- Registry-based payment gateway (extensible)
- Offline-first licensing dengan Ed25519 (asimetris)
- Floating lease / rolling seat mechanism
- SDK multi-platform zero-dependency

**Namun:** Beberapa fitur inti masih **vaporware** (hanya type definition tanpa implementasi), ada **integrasi yang putus** antara SDK ↔ Server, dan **bug keamanan/race condition** yang memblokir production readiness.

---

## 1. Fitur Prematur / Belum Matang

| #   | Fitur                         | Status             | Detail                                                                                                                                                                                                                                                                                |
| --- | ----------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.1 | **AI Proxy Shield**           | ❌ Type-only       | `AIProxyOptions`/`AIProxyResult` ada di `packages/sdk/src/types.ts` tapi **tidak ada modul `AIProxyModule`** di SDK, tidak ada route `/api/v1/ai-proxy/*` di server, tidak ada service `aiProxy.ts`                                                                                   |
| 1.2 | **Floating License Lease**    | ⚠️ Partial         | Logic server (`LicenseLeaseService`) + SDK (`startHeartbeatSession`) ada, tapi: **tidak ada auto-recovery** saat jaringan flapping, **tidak ada graceful degradation UX** (mode read-only), `heartbeatIntervalSeconds` hardcoded 60s tidak configurable per app                       |
| 1.3 | **Webhook Delivery Retry**    | ❌ Missing Worker  | Tabel `webhook_deliveries` + `nextRetryAt` siap (exponential backoff design), tapi **TIDAK ADA background worker** yang membaca dan retry. `WebhookService.emit()` hanya `INSERT` outbox.                                                                                             |
| 1.4 | **Metered Usage Aggregation** | ⚠️ Collection Only | `POST /api/v1/metering/events` ✅, `GET /api/v1/metering/usage/:licenseKey` ✅ (raw events). **Missing**: agregasi per periode untuk billing, eksekusi `meteringConfig.aggregation` (contoh: `"sum(tokens) on ai_usage"`), cron job hitung `unitPrice * usage` → invoice/credit debit |
| 1.5 | **Launch Kit / Trust Badge**  | ⚠️ Basic Only      | Web Component `<tertaut-badge>` ✅. **Missing**: impression/click tracking (`badge_view`, `badge_click`), A/B testing variant, conversion attribution ke checkout                                                                                                                     |
| 1.6 | **Free Trial Anti-Abuse**     | ⚠️ Weak            | Unique index `uniq_transactions_trial_per_app_email` ✅. **Masalah**: hanya cek `email` — attacker bisa pakai `email+tag@gmail.com` atau domain catch-all. Tidak ada device fingerprint/IP reputation check.                                                                          |

---

## 2. Fitur Tidak Terintegrasi / Putus

| #   | Integrasi                                   | Masalah                                                                                                                                                                  | Dampak                                                                   |
| --- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| 2.1 | **SDK `s2s.credits` ↔ Server**              | SDK memanggil `/api/v1/s2s/credits/*` tapi **route tidak exist** di server. Server hanya punya `/api/v1/licensing/credits/*` (client-facing, butuh `x-api-key` + `hwid`) | `sdk.s2s.credits.balance()` → **404**                                    |
| 2.2 | **SDK `verifyOfflineTokenOnline` ↔ Server** | Response contract beda. Server `POST /api/v1/licensing/verify-offline-token` return struktur berbeda dari `OnlineOfflineTokenVerifyResult` di SDK types                  | Potential crash kalau server response berubah                            |
| 2.3 | **Coupon System Panel UI**                  | `CouponView.vue` filter by `mode` (sandbox/live), tapi coupon di DB bisa global (`appId=null`) → **UI tidak tampilkan coupon global** di mode sandbox                    | Builder tidak bisa manage coupon global                                  |
| 2.4 | **Payout/Disbursement Sandbox**             | `gatewayAllowsSandboxPayout()`: DANA return `false` → sandbox app **tidak bisa test disbursement end-to-end**                                                            | Builder tidak bisa test payout flow tanpa kredensial DANA production     |
| 2.5 | **License `apiKey` Auto-Provisioning**      | `licenses.apiKey` kolom dibuat saat issue, tapi **TIDAK ADA endpoint `/api/v1/licensing/api-key/verify`** yang dipakai SDK `verifyApiKey()`                              | SDK `verifyApiKey()` → 404, builder tidak bisa validasi customer API key |
| 2.6 | **Platform Settings ↔ Gateway Registry**    | Dual source of truth: `GATEWAY_REGISTRY.credentials` (registry.ts) vs `platform_settings` (panel admin CRUD manual). **Tidak sinkron**                                   | Menambah gateway = edit 2+ tempat                                        |

---

## 3. Bug & Keamanan (Critical/High)

### 3.1 Race Condition: Coupon Redeem 🔴

**File:** `src/server/routes/checkout/session.ts:537-548`

```typescript
const [newTx] = await db.insert(transactions).values({...}).returning();
// ... lalu di luar transaksi:
if (coupon) {
  const redeemed = await CouponService.redeem(coupon.id);
  if (!redeemed) {
    await db.delete(transactions).where(eq(transactions.id, newTx.id)); // RACE WINDOW
```

**Masalah:** 2 request paralel pakai kupon sama → keduanya lolos `validate()` → keduanya `INSERT` transaksi → salah satu `redeem()` gagal → transaksi dihapus tapi **invoice sudah terkirim ke payment gateway**.

**Fix:** `redeem()` harus di dalam transaksi yang sama dengan `INSERT transactions` (atomic).

---

### 3.2 TOCTOU: License Activation Seat Check 🔴

**File:** `src/server/routes/licensing/device/activate.ts:169-175` (floating) / `204-213` (fixed)

```typescript
const liveLeases = await LicenseLeaseService.countLive(lic.id, trx);
if (liveLeases >= maxSeats) {
  return { error: "seat full" };
}
// ... lalu INSERT activation + acquire lease (BUKAN ATOMIC)
```

**Masalah:** `countLive()` dan `acquire()` bukan atomic → 2 device paralel lolos check → `liveLeases` jadi `maxSeats+1`.

**Fix:** `acquire()` harus return error kalau sudah penuh (pakai DB constraint / advisory lock).

---

### 3.3 Hardcoded Demo Identifiers 🐛

**File:** `src/server/routes/checkout/session.ts:96-107`

```typescript
const DEMO_IDENTIFIERS = [
  "app_fastmail_ai", "fastmail-ai", "app_saas_starter_kit", ...
];
```

Hardcoded list — bukan data-driven dari DB. Kalau demo app dihapus/diganti ID, checkout tetap coba `ensureDemoData()` → error/loop.

---

### 3.4 CORS Origin Validation Bypass Potential 🔒

**File:** `src/server/index.ts:64-116`

```typescript
origin: (request) => {
  const origin = request.headers.get("origin");
  if (!origin) return true;  // Same-origin GET, curl, navigasi diizinkan
```

Request tanpa `Origin` header (curl, native mobile app, server-to-server) **lolos CORS dengan `credentials: true`** → vektor CSRF kalau endpoint state-changing tidak pakai CSRF token terpisah.

**Rekomendasi:** Batasi `credentials: true` hanya untuk origin eksplisit allowed.

---

### 3.5 JWT Secret Fallback di Production 🔒

**File:** `src/server/config.ts:28, 348`

```typescript
const DEFAULT_JWT_SECRET = "tertaut_default_jwt_secret_change_me_in_production";
const jwtSecret = resolveSecret("JWT_SECRET", DEFAULT_JWT_SECRET);
```

`resolveSecret()` throw kalau production & value === devFallback ✅. **Tapi** `BETTER_AUTH_SECRET`, `VAULT_ENCRYPTION_KEY`, `HWID_SALT` pakai `resolveDerivedSecret()` yang **hanya warn** (kecuali `STRICT_SECRETS=true`). Default production bisa jalan dengan secret sama untuk 3 domain → **single point of failure**.

---

### 3.6 Email Verification Bypass di Dev 🔒

**File:** `src/server/auth.ts:29-33`

```typescript
const verifyEmailEnabled =
  EmailService.isConfigured() &&
  EmailService.isDeliveryEnabled() &&
  config.nodeEnv !== "test" &&
  process.env.REQUIRE_EMAIL_VERIFICATION !== "false";
```

Di development (`NODE_ENV=development`), `verifyEmailEnabled = false` → user register tanpa verifikasi email. Kalau deploy staging tanpa `NODE_ENV=production` → **akun dibuat tanpa verifikasi email**.

---

### 3.7 License Token Rotation — Revoked Token Tidak Dicek 🐛

**File:** `src/server/services/licensing/licenseToken.ts:122-161`

```typescript
// verify() hanya cek exp, nbf, iat — TIDAK cek revokedTokens table
```

`verifyOfflineToken()` (lokal) & `verify()` (server) **tidak cek `revokedTokens` JTI denylist**. Hanya `verifyOfflineTokenOnline()` yang cek. Token yang sudah di-revoke **masih valid offline** sampai expired.

---

### 3.8 Webhook Signature Verification — Timing Attack 🔒

**File:** `src/server/utils/crypto.ts` (verifyWebhookSignature)

```typescript
const expectedSignature = createHmac("sha256", secret).update(rawBody).digest("hex");
return signature === expectedSignature; // String comparison → timing attack
```

Pakai `===` untuk HMAC comparison → **vulnerable to timing attack**.

**Fix:** `crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))`

---

### 3.9 Rate Limiter In-Memory — Tidak Bekerja Multi-Instance 🐛

**File:** `src/server/services/security/rateLimiter.ts`

```typescript
const buckets = new Map<string, { count: number; resetAt: number }>();
```

`Map` in-memory → **tidak shared** kalau >1 replica (Docker Swarm, K8s, Dokploy multi-container). Attacker bypass rate limit dengan request ke instance berbeda.

---

### 3.10 Unique Index Trial — Case Sensitivity Bug 🐛

**File:** `src/server/db/schema/transactions.ts:71-73`

```typescript
uniqueIndex("uniq_transactions_trial_per_app_email")
  .on(table.appId, table.customerEmail, table.paymentChannel)
  .where(sql`${table.paymentChannel} = 'FREE_TRIAL'`);
```

Partial index hanya aktif kalau `paymentChannel = 'FREE_TRIAL'` (uppercase). Attacker kirim `paymentChannel: 'free_trial'` (lowercase) → **index tidak match** → bisa buat trial ganda.

**Fix:** Normalisasi ke uppercase sebelum insert, atau pakai case-insensitive index.

---

## 4. Teknikal Debt & Kualitas Kode

| Area               | Masalah                                                                | Dampak                                             |
| ------------------ | ---------------------------------------------------------------------- | -------------------------------------------------- |
| **Type Safety**    | `any` berlebihan di route handlers (`ctx: any`, `body: any`)           | Runtime error sulit detek compile-time             |
| **Error Handling** | `catch (err: any)` tanpa type guard → `err?.message` bisa undefined    | Error logging tidak informatif                     |
| **Testing**        | Banyak `coverage_booster*.test.ts` → test dummy untuk naikkan coverage | Coverage number menipu, bug nyata tidak tertangkap |
| **Migration**      | 7 migrasi tapi tidak ada `down` migration / rollback plan              | Rollback production berisiko                       |
| **Observability**  | Tidak ada structured logging (JSON), tracing, metrics (Prometheus)     | Debug production sulit                             |
| **Database**       | Tidak ada connection pool tuning (max connections, idle timeout)       | Connection leak / exhaustion di load tinggi        |

---

## 5. Rekomendasi Prioritas

### 🔴 Critical (Blokir Production)

1. **Fix race condition coupon redeem** — atomic transaction
2. **Implement webhook delivery worker** — outbox pattern butuh processor
3. **Enable `STRICT_SECRETS=true` di production** — enforce separate secrets
4. **Add timing-safe HMAC comparison** untuk webhook verification
5. **Implement rate limiter dengan Redis** (bukan in-memory Map)

### 🟠 High (Sebelum Launch Builder)

6. **Implementasi AI Proxy Shield** (server + SDK) — fitur utama yang dijanjikan
7. **Fix S2S Credits endpoint** — tambah route `/api/v1/s2s/credits/*`
8. **License API Key verify endpoint** — connect `licenses.apiKey` ke SDK
9. **Metered usage aggregation cron** — hitung billing dari events
10. **Coupon global visibility di panel** — fix filter mode

### 🟡 Medium (Quality of Life)

11. **Floating lease auto-recovery UX** di SDK (reconnect, grace period)
12. **Device fingerprint untuk trial abuse prevention**
13. **Structured logging + request ID propagation** (sudah ada `X-Request-Id` header)
14. **Database migration rollback scripts**
15. **E2E test checkout → license → heartbeat → credit consume flow**

### 🟢 Low (Nice to Have)

16. **Trust Badge analytics** (impression, click, conversion)
17. **Launch Kit A/B testing framework**
18. **Panel settings ↔ Gateway registry sync** (single source of truth)
19. **OpenAPI spec generation dari route handler** (bukan manual di swagger config)
20. ~~SDK size monitoring di CI~~ — _not a priority per user_

---

## 6. File Kunci untuk Diperbaiki

| Prioritas | File                                             | Aksi                                                 |
| --------- | ------------------------------------------------ | ---------------------------------------------------- |
| 🔴        | `src/server/routes/checkout/session.ts`          | Atomic coupon redeem dalam transaksi                 |
| 🔴        | `src/server/routes/licensing/device/activate.ts` | Atomic seat acquire (DB constraint/advisory lock)    |
| 🔴        | `src/server/services/notifications/webhooks.ts`  | Tambah background worker retry delivery              |
| 🔴        | `src/server/utils/crypto.ts`                     | `timingSafeEqual` untuk HMAC verify                  |
| 🔴        | `src/server/services/security/rateLimiter.ts`    | Migrasi ke Redis-backed rate limiter                 |
| 🟠        | `src/server/routes/s2s/credits.ts`               | **BUAT FILE BARU** — implement S2S credits endpoints |
| 🟠        | `src/server/routes/licensing/api-key/verify.ts`  | **BUAT FILE BARU** — verify customer API key         |
| 🟠        | `packages/sdk/src/modules/aiProxy.ts`            | **BUAT FILE BARU** — implement AI Proxy Shield       |
| 🟠        | `src/server/services/metering/aggregation.ts`    | **BUAT FILE BARU** — cron job agregasi metered usage |
| 🟡        | `src/server/config.ts`                           | Enforce `STRICT_SECRETS=true` di production docs     |
| 🟡        | `src/server/db/schema/transactions.ts`           | Fix partial index case sensitivity                   |

---

## 7. Kesimpulan

**Tertaut** memiliki fondasi yang kuat dan arsitektur modern, namun **belum siap production** untuk builder yang butuh reliability penuh.

**Blokir utama:**

1. Fitur flagship (AI Proxy Shield) tidak exist di runtime
2. Integrasi SDK ↔ Server putus di beberapa modul kritis (S2S credits, license API key)
3. Race condition & security issues yang bisa dieksploitasi
4. Background workers (webhook retry, metering aggregation) tidak diimplementasikan

**Rekomendasi:** Fokus pada 🔴 Critical + 🟠 High sebelum onboarding builder production. Estimasi effort: **3-4 sprint** untuk production-ready baseline.
