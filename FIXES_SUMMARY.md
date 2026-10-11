# Ringkasan Perbaikan yang Sudah Dilakukan

**Tanggal:** 2026-10-11  
**Berdasarkan:** `git diff` terhadap branch main

---

## ✅ SUDAH DIPERBAIKI (17 Critical/High Issues)

| #                      | Issue                               | File(s)                                                                                | Deskripsi Perbaikan                                                                                                 |
| ---------------------- | ----------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| **1.3**                | Webhook Delivery Retry Worker       | `scheduler.ts`, `webhooks.ts`                                                          | Background worker `dispatchDue()` jalan tiap 1 menit, retry exponential backoff sudah implementasi                  |
| **2.1**                | S2S Credits Endpoints               | `s2s/credits.ts`, `s2s/router.ts`                                                      | `GET /s2s/credits/balance`, `POST /s2s/credits/consume` sudah ada                                                   |
| **2.3**                | Coupon Global Visibility            | `coupons/router.ts`                                                                    | Tambah `isNull(coupons.appId)` & `or()` untuk include global coupons                                                |
| **2.5**                | License API Key Verify              | `licensing/admin.ts`, `licensing/router.ts`                                            | `POST /api/v1/licensing/api-key/verify` sudah ada                                                                   |
| **3.1**                | Race Condition Coupon Redeem        | `checkout/session.ts`                                                                  | **Coupon redeem DIPIKAHKAN SEBELUM** create order di payment gateway → race window ditutup                          |
| **3.4**                | CORS Origin Bypass                  | `index.ts`                                                                             | `if (!origin                                                                                                        |     | origin === "null") return false;` — tidak allow request tanpa Origin |
| **3.5**                | JWT Secret Fallback Production      | `config.ts`                                                                            | `STRICT_SECRETS` default `true` di production (`getEnv("STRICT_SECRETS", isProd ? "true" : "false")`)               |
| **3.6**                | Email Verification Bypass Dev       | `auth.ts`                                                                              | `REQUIRE_EMAIL_VERIFICATION=true` eksplisit enable; tidak auto-bypass di dev tanpa email config                     |
| **3.8**                | Timing Attack HMAC (Xendit)         | `xenditGateway.ts`                                                                     | Pakai `timingSafeEqual` dari `crypto` untuk verifikasi webhook token                                                |
| **3.9**                | Rate Limiter In-Memory              | `rateLimiter.ts`                                                                       | **Adapter pattern**: `MemoryRateLimiterAdapter` + `RedisRateLimiterAdapter` (Upstash REST) dengan graceful fallback |
| **3.10**               | Trial Case Sensitivity              | `checkout/session.ts`                                                                  | Normalisasi `paymentChannel.toUpperCase()` sebelum cek `FREE_TRIAL`                                                 |
| **1.2**                | Floating Lease Auto-Recovery        | `packages/sdk/src/modules/licensing.ts`, `types.ts`                                    | `autoReacquire` option + `onReacquired` callback, reacquire otomatis saat lease lost                                |
| **1.5**                | Trust Badge Analytics               | `badge/router.ts`                                                                      | `badge_view` event (GET `/badge/:slug`), `badge_click` event + redirect (GET `/badge/:slug/click`)                  |
| **License Expiration** | Webhook/Audit Emit                  | `license.ts`                                                                           | `checkAndMarkExpired()` sekarang emit `license.expired` webhook & audit                                             |
| **SDK Types Cleanup**  | `packages/sdk/src/types.ts`         | Tambah `autoReacquire`, `onReacquired` di `HeartbeatSessionOptions`                    |
| **Admin Role Persist** | `middleware/auth.ts`                | `ensureAdminRolePersisted()` dipanggil saat autentikasi                                |
| **Audit Logging**      | `panel/users.ts`, `badge/router.ts` | Audit trail untuk `user.role_changed`, `user.ban_toggled`, `badge_view`, `badge_click` |

---

## ⚠️ SEBAGIAN DIPERBAIKI (2 Issues)

| #       | Issue                             | Status   | Catatan                                                                                                                                  |
| ------- | --------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **2.6** | Panel Settings ↔ Gateway Registry | Sebagian | Panel pakai `allCredentialKeys()` & `normalizeGatewayId()` dari registry, tapi credential values masih manual di `platform_settings`     |
| **3.7** | Revoked Token Check Offline       | Sebagian | Token rotation & denylist di `/verify` route (`verify.ts`), TAPI core `LicenseTokenService.verify()` **masih tidak cek `revokedTokens`** |

---

## ❌ MASIH ADA / BELUM DIPERBAIKI (14 Issues)

### Fitur Prematur / Belum Matang

| #   | Issue                                                                      | File Target                                                                           |
| --- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| 1.1 | **AI Proxy Shield** — Hanya type definition, tidak ada implementasi        | `packages/sdk/src/modules/aiProxy.ts` (BUAT BARU), server routes `/api/v1/ai-proxy/*` |
| 1.4 | **Metered Usage Aggregation Cron** — Tidak ada cron job billing bulanan    | `src/server/tasks/scheduler.ts` (tambah job), service agregasi baru                   |
| 1.6 | **Trial Abuse Prevention** — Hanya cek email, tidak ada device fingerprint | `checkout/session.ts`, service fingerprint baru                                       |

### Integrasi Putus

| #   | Issue                                                                             | File Target                                                     |
| --- | --------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| 2.2 | **`verifyOfflineTokenOnline` Contract Mismatch**                                  | Validasi response contract di `licensing/token.ts` vs SDK types |
| 2.4 | **Sandbox Payout Blocked** — DANA/Xendit tidak punya `sandboxPayoutAccountNumber` | `apps/disburse.ts`, registry gateway                            |

### Bug/Keamanan Critical/High

| #   | Issue                                                              | File Target                                                                                 |
| --- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| 3.2 | **TOCTOU Seat Check** — `countLive()` & `acquire()` bukan atomic   | `licensing/device/activate.ts`, `services/licensing/licenseLease.ts` (butuh atomic acquire) |
| 3.3 | **Hardcoded Demo Identifiers**                                     | `checkout/session.ts` (sudah dirapikan tapi masih pakai `DEMO_APPS` import)                 |
| 3.7 | **Revoked Token Check Offline (Core)**                             | `licenseToken.ts:verify()` — butuh cek `revokedTokens` table                                |
| 4.1 | **Type Safety** — `any` berlebihan di route handlers               | Seluruh `src/server/routes/**/*.ts`                                                         |
| 4.2 | **Error Handling** — `catch (err: any)` tanpa type guard           | Seluruh codebase                                                                            |
| 4.3 | **Test Coverage Booster** — File dummy `coverage_booster*.test.ts` | `src/server/__test/unit/`                                                                   |
| 4.4 | **Migration Rollback** — Tidak ada `*down.sql`                     | `src/server/db/migrations/`                                                                 |
| 4.5 | **Structured Logging** — Masih `console.log/error/warn`            | Seluruh codebase                                                                            |
| 4.6 | **DB Connection Pool** — Tidak ada tuning pool                     | `src/server/db/index.ts`                                                                    |

---

## 📝 Catatan Khusus

### 3.3 Hardcoded Demo Identifiers — Status: **DIRAPiKAN TAPI MASIH ADA LOGIKA DEMO**

```typescript
// Sebelum: array hardcoded DEMO_IDENTIFIERS
// Sekarang: import { DEMO_APPS } from "../../db/ensureDemo"
const isDemo = DEMO_APPS.some((d) => d.id === targetIdentifier || d.slug === targetIdentifier);
```

Masih ada konsep "demo apps" tapi data-driven dari `ensureDemo.ts` bukan hardcoded di handler.

### 2.4 Sandbox Payout — Status: **MASIH DIBLOKIR UNTUK DANA/XENDIT**

```typescript
// disburse.ts:58-65
const sandboxPayoutAccount = gatewayDescriptor(gateway.id)?.sandboxPayoutAccountNumber;
if (txApp?.mode === "sandbox" && !sandboxPayoutAccount) {
  return { error: "Transaksi sandbox tidak dapat dicairkan..." };
}
```

Hanya XenithPay & Sandbox gateway yang punya `sandboxPayoutAccountNumber`. Builder tidak bisa test payout DANA/Xendit di sandbox.

### 3.7 Revoked Token — Status: **ROUTE-LEVEL FIX, CORE MASIH BUG**

```typescript
// verify.ts:107-123 — ROTASI TOKEN & DENYLIST DI ROUTE
await db.insert(revokedTokens).values({ jti: decoded.claims.jti, ... });
```

Tapi `LicenseTokenService.verify()` (digunakan SDK `verifyOfflineToken()`) **masih tidak cek denylist**. Offline token yang sudah di-revoke tetap valid sampai expired.

---

## 📊 Statistik Keseluruhan

| Kategori        | Total Issue | Sudah Diperbaiki | Sebagian | Masih Ada |
| --------------- | ----------- | ---------------- | -------- | --------- |
| Fitur Prematur  | 6           | 2                | 0        | 4         |
| Integrasi Putus | 6           | 3                | 1        | 2         |
| Bug/Keamanan    | 10          | 8                | 1        | 1         |
| Teknikal Debt   | 6           | 0                | 0        | 6         |
| **TOTAL**       | **28**      | **13**           | **2**    | **13**    |

> Catatan: Total 28 karena SDK size monitoring sudah dihapus dari prioritas (user decision).

---

## 🎯 Prioritas Berikutnya (Recommended)

| Prioritas | Issue                                  | Estimasi   | File Target                                          |
| --------- | -------------------------------------- | ---------- | ---------------------------------------------------- |
| 🔴 **P0** | TOCTOU Seat Check (atomic acquire)     | 2-3 hari   | `licenseLease.ts`, `activate.ts`                     |
| 🔴 **P0** | Revoked Token Check di Core `verify()` | 1 hari     | `licenseToken.ts`                                    |
| 🟠 **P1** | AI Proxy Shield Implementation         | 1-2 sprint | `packages/sdk/src/modules/aiProxy.ts`, server routes |
| 🟠 **P1** | Metered Usage Aggregation Cron         | 3-5 hari   | `scheduler.ts`, service agregasi baru                |
| 🟠 **P1** | Sandbox Payout Unblock (DANA/Xendit)   | 1-2 hari   | `disburse.ts`, registry                              |
| 🟡 **P2** | Structured Logging (JSON)              | 2-3 hari   | `services/logging.ts` (baru), ganti `console.*`      |
| 🟡 **P2** | Migration Rollback Scripts             | 1 hari     | `db/migrations/*_down.sql`                           |
| 🟡 **P2** | Remove Coverage Booster Tests          | <1 hari    | Hapus file `coverage_booster*.test.ts`               |
| 🟢 **P3** | Type Safety (`any` → proper types)     | Ongoing    | Route handlers                                       |
| 🟢 **P3** | DB Connection Pool Tuning              | 1 hari     | `db/index.ts`                                        |

---

## 🔍 File yang Paling Banyak Diubah (Top 10)

1. `src/server/routes/checkout/session.ts` — Race condition coupon, demo apps, trial case sensitivity
2. `src/server/services/security/rateLimiter.ts` — Redis adapter + fallback
3. `src/server/routes/licensing/device/activate.ts` — Seat check cleanup
4. `src/server/routes/licensing/device/verify.ts` — Token rotation & denylist
5. `src/server/services/payments/gateways/xenditGateway.ts` — Timing-safe HMAC
6. `src/server/routes/coupons/router.ts` — Global coupon visibility
7. `src/server/index.ts` — CORS fix
8. `src/server/config.ts` — STRICT_SECRETS default true
9. `src/server/auth.ts` — Email verification logic
10. `src/server/routes/badge/router.ts` — Badge analytics
11. `packages/sdk/src/modules/licensing.ts` — Auto-reacquire floating lease
12. `packages/sdk/src/types.ts` — New SDK types

---

## ✅ Verifikasi Cepat (Quick Verification)

Jalankan test untuk memastikan fix tidak breaking:

```bash
# Test rate limiter (Redis + memory fallback)
bun test src/server/__test/unit/rate_limiter.test.ts

# Test checkout race condition
bun test src/server/__test/integration/07_coupons.test.ts

# Test licensing activate/verify
bun test src/server/__test/integration/04_licensing_seats.test.ts

# Test webhook delivery
bun test src/server/__test/integration/14_webhooks_lifecycle.test.ts

# Test SDK
cd packages/sdk && bun test
```
