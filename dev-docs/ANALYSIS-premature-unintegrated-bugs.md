# Laporan Analisis Codebase: tertaut.com

**Tanggal:** 2026-10-08  
**Versi:** 2.2.4  
**Status:** In Progress / Partially Resolved

---

## Ringkasan Eksekutif

Codebase tertaut.com adalah aplikasi full-stack TypeScript (Bun + Elysia backend, Vue 3 + Vite frontend) untuk Merchant of Record (MoR) checkout, licensing, AI proxy shielding. Dari hasil audit dan mitigasi:

- **Bug Kritis Utama telah dimitigasi**: Xendit webhook amount verification, Sandbox payment webhook isolation, SEO HTML injection sanitization, dan Public Admin Registration Privilege Escalation.
- **Security Headers Diaktifkan**: HSTS, nosniff, Referrer-Policy, dan X-Frame-Options (kecuali widget/badge).
- **Arsitektur MoR Dipastikan**: Xendit Invoice + Payouts API murni (tanpa ketergantungan xenPlatform).

---

## BUG KEAMANAN KRITIS (Prioritas Tertinggi)

### 1. Admin Privilege Escalation via Email Registration

**File:** `src/server/auth.ts` (baris 86-98)

```typescript
const adminEmail = (process.env.ADMIN_EMAIL || "platformtertaut@gmail.com").toLowerCase();
const isPlatformAdmin = userRecord.email?.toLowerCase() === adminEmail;
return {
  data: {
    ...userRecord,
    role: isPlatformAdmin ? "admin" : "user",
    ...(isPlatformAdmin ? { emailVerified: true } : {}),
  },
};
```

**Masalah:** Siapa pun yang register dengan email `platformtertaut@gmail.com` (atau `ADMIN_EMAIL`) otomatis mendapat akses admin penuh + bypass email verification. Ini **critical privilege escalation vulnerability**.

**Dampak:** Attacker bisa register sebagai admin dan kontrol seluruh platform.

---

### 2. Hardcoded Default JWT Secret

**File:** `src/server/config.ts` (baris 28)

```typescript
const DEFAULT_JWT_SECRET = "tertaut_default_jwt_secret_change_me_in_production";
```

**Masalah:** Jika `JWT_SECRET` env var tidak diset di production, aplikasi menggunakan default value ini, membuat semua token predictable.

**Dampak:** Attacker bisa forge JWT tokens dan impersonate user mana pun.

---

### 3. Hardcoded DANA Sandbox Credentials

**File:** `src/server/config.ts` (baris 394-403)

```typescript
clientId: isSandbox
  ? getEnv("DANA_SANDBOX_CLIENT_ID") ||
    getEnv("DANA_CLIENT_ID") ||
    (isTest ? "2026092111025202221544" : "")
  : getEnv("DANA_CLIENT_ID"),
clientSecret: isSandbox
  ? getEnv("DANA_SANDBOX_CLIENT_SECRET") ||
    getEnv("DANA_CLIENT_SECRET") ||
    (isTest ? "00b18d19398bcd9ddad4b0792a0bdeaf5f2d79d70ee65c8359d4066a933515a5" : "")
  : getEnv("DANA_CLIENT_SECRET"),
```

**Masalah:** DANA sandbox credentials hardcoded di source code.

**Dampak:** Credentials bisa digunakan untuk unauthorized API calls ke DANA.

---

### 4. Missing Amount Verification di Xendit Webhook

**File:** `src/server/routes/webhook/xendit.ts` (baris 115-124)

```typescript
if (
  normalizedStatus === "PAID" ||
  normalizedStatus === "SETTLED" ||
  normalizedStatus === "SUCCEEDED" ||
  normalizedStatus === "COMPLETED"
) {
  const channel = payment_method || payment_channel || "XENDIT";
  const result = await fulfillPaymentTransaction(tx, channel);
  return { success: result.status === "success", ...result };
}
```

**Masalah:** Tidak ada verifikasi amount sama sekali. Berbeda dengan DANA webhook yang minimal check `paidAmount !== tx.grossAmount`.

**Dampak:** Attacker yang bisa forge Xendit webhook bisa mark transaction sebagai paid dengan amount berapa pun.

---

### 5. Sandbox Payment Simulation Accessible di Production

**File:** `src/server/routes/webhook/sandbox.ts` (baris 1-48)

```typescript
export async function handleSandboxPaymentWebhook({ body, set }: any) {
  // ... no environment check ...
  await fulfillPaymentTransaction(tx, tx.paymentChannel || "SANDBOX_SIMULATOR");
}
```

**Masalah:** Tidak ada `config.isSandbox` check. Jika endpoint ini accessible di production, siapa pun bisa fulfill transaction tanpa pembayaran.

**Dampak:** Free purchases, revenue loss, fraud massal.

---

### 6. IDOR di License Deactivation

**File:** `src/server/routes/licensing/device.ts` (baris 578-655)

```typescript
export async function handleDeactivateLicense({ body, set, request }: DeviceDeactivateLicenseContext) {
  const { licenseKey, hwid } = body;
  // ... no ownership check ...
  const lic = await db.query.licenses.findFirst({
    where: eq(licenses.licenseKey, licenseKey.trim()),
  });
  // ... deletes activation without verifying caller owns the license ...
```

**Masalah:** Tidak ada ownership check. Siapa pun dengan `licenseKey` bisa deactivate license orang lain.

**Dampak:** Denial of service terhadap license legitimate users.

---

### 7. IDOR di License Verification

**File:** `src/server/routes/licensing/device.ts` (baris 459-576)

```typescript
export async function handleVerifyLicense({ body, set, request }: DeviceVerifyContext) {
  const { licenseKey, hwid, appVersion } = body;
  // ... no ownership check ...
```

**Masalah:** Tidak ada ownership check. Siapa pun bisa query status license orang lain.

**Dampak:** Information leakage tentang license siapa pun.

---

### 8. Mass Assignment di App Update

**File:** `src/server/routes/apps/mutations.ts` (baris 173-218)

```typescript
const {
  name,
  slug,
  targetPrice,
  mode,
  description,
  headline,
  subheadline,
  mediaUrl,
  valueProps,
  ctaText,
  customIntentMessage,
  redirectUrl,
  pageBlocks,
  customHtml,
  captureConfig,
  pricingType,
  billingPeriod,
  trialPeriodDays,
  deliveryConfig,
  meteringConfig,
} = body as Record<string, any>;
```

**Masalah:** `deliveryConfig` dan `meteringConfig` menerima `t.Any()` yang berarti arbitrary nested objects bisa di-inject.

**Dampak:** Builder bisa modify `deliveryConfig.licenseKey.maxSeats` atau `meteringConfig.freeAllowance` untuk mendapatkan lebih banyak resources.

---

### 9. XSS di SEO Meta Injection

**File:** `src/server/services/seo/seoPrerender.ts` (baris 163-231)

```typescript
result = result.replace(/<title>.*?<\/title>/i, `<title>${meta.title}</title>`);
result = result.replace(
  /<meta\s+name=["']description["']\s+content=["'][^"']*["']\s*\/?>/i,
  `<meta name="description" content="${meta.description}" />`
);
```

**Masalah:** `meta.title` dan `meta.description` di-inject ke HTML tanpa escaping.

**Dampak:** Attacker bisa inject arbitrary HTML/JS melalui app name atau description.

---

### 10. Webhook Secret Exposed to Client

**File:** `src/client/src/types/licensing.ts` (baris 85-94)

```typescript
export interface WebhookEndpointItem {
  id: string;
  builderId: string;
  url: string;
  secret: string; // <-- Secret exposed to client
  events: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
```

**Masalah:** Webhook secret di-include di API response type, suggesting ini di-return ke client.

**Dampak:** Attacker bisa forge webhook signatures.

---

## FITUR PREMATUR (Over-engineered)

| #   | Fitur                          | File                                                 | Masalah                                                     |
| --- | ------------------------------ | ---------------------------------------------------- | ----------------------------------------------------------- |
| 1   | Multi-Gateway Payment Registry | `services/payments/gateways/registry.ts` (252 baris) | 4 gateway adapters, hanya DANA yang digunakan di production |
| 2   | XenithPay Gateway              | `services/payments/gateways/xenithpayGateway.ts`     | Full adapter, tidak ada evidence digunakan di production    |
| 3   | Sandbox Gateway Adapter        | `services/payments/gateways/sandboxGateway.ts`       | Redundant dengan `simulate-payment` endpoint                |
| 4   | Launch Service                 | `services/monetization/launchService.ts` (134 baris) | Marketing feature yang bisa simple API endpoint             |
| 5   | Notifier Service               | `services/notifications/notifier.ts` (139 baris)     | Telegram/webhook alerts prematur untuk tim kecil            |
| 6   | Email Service                  | `services/notifications/email.ts` (258 baris)        | Full-featured email service dengan complex HTML templates   |
| 7   | SEO Prerender Service          | `services/seo/seoPrerender.ts` (231 baris)           | 40+ bot detection, dynamic metadata, HTML injection         |
| 8   | OG Card SVG Generator          | `routes/seo/og.ts` (177 baris)                       | Sophisticated social sharing feature                        |

---

## FITUR TIDAK TERINTEGRASI (Orphaned/Dead Code)

| #   | Fitur                    | File                                         | Masalah                                          |
| --- | ------------------------ | -------------------------------------------- | ------------------------------------------------ |
| 1   | Widget Routes            | `routes/badge/router.ts` (baris 74-215)      | `/widgets/embed.js` tidak ada evidence digunakan |
| 2   | License Legacy Routes    | `routes/licensing/router.ts` (baris 512-513) | `/license` prefix duplicate dari `/licensing`    |
| 3   | AI Proxy Legacy Routes   | `routes/aiproxy/router.ts` (baris 145-146)   | `/ai` prefix duplicate dari `/ai-proxy`          |
| 4   | Webhook Plural Routes    | `routes/webhook/router.ts` (baris 26-33)     | `/webhooks` prefix duplicate dari `/webhook`     |
| 5   | SNAP BI Webhook Routes   | `routes/webhook/router.ts` (baris 35-41)     | Third duplicate dari webhook routes              |
| 6   | Client Route Aliases     | `client/src/router/index.ts`                 | 15+ routes untuk 5 pages                         |
| 7   | Sandbox Dashboard Routes | `client/src/router/index.ts` (baris 72-76)   | 11 duplicate routes dengan prefix berbeda        |

---

## MASALAH TAMBAHAN

### Database & Performance

- **Missing transaction** di checkout session creation (`routes/checkout/session.ts` baris 471-515)
- **N+1 query pattern** di `routes/panel/builders.ts` (baris 9-34)
- **Missing index** pada foreign keys di `transactions` table
- **Missing composite index** untuk common query pattern

### Error Handling

- **Information leakage** di error messages (`routes/checkout/session.ts` baris 556-621)
- **Missing error boundary** di `index.ts` (baris 256-286)
- **Unhandled promise rejections** di background jobs (`index.ts` baris 632-637)

### Configuration

- **Insecure default** untuk `STRICT_SECRETS=false` di `.env.example`
- **Debug mode** (Swagger) enabled unconditionally di production
- **Missing security headers** (CSP, HSTS, X-Frame-Options, dll)

### Client-Side Security

- **Sensitive data exposure** - `secretApiKey` di-return ke client (`lib/api.ts` baris 240-259)
- **No CSRF protection** - hanya rely on `sameSite: "lax"` cookie
- **XSS risk** di dynamic HTML injection

### Test Coverage

- **Excessive mocking** - payment gateway selalu di-mock, tidak ada real end-to-end test
- **Tests untuk non-existent routes** - `/s2s/credits/topup` tidak ada
- **Conditional test skipping** - security tests skip ketika `publicKey` missing
- **Race conditions** - `setTimeout(200)` untuk webhook delivery tidak reliable
- **No auth token refresh tests**
- **No real webhook signature verification tests**

---

## REKOMENDASI PRIORITAS

### Prioritas Kritis (Segera)

1. **[SELESAI] Fix admin privilege escalation** - Registrasi publik selalu default ber-role user (`src/server/auth.ts`)
2. **[TERLINDUNGI] Remove hardcoded secrets** - `STRICT_SECRETS=true` dan `isProd` guard mencegah penggunaan secret default
3. **[SELESAI] Add amount verification di Xendit webhook** - Rekonsiliasi nominal tagihan ketat ditambahkan (`src/server/routes/webhook/xendit.ts`)
4. **[SELESAI] Disable sandbox endpoints di production** - Guard isolasi mode sandbox ditambahkan (`src/server/routes/webhook/sandbox.ts`)
5. **Add ownership checks** di license operations (deactivate, verify, credits)
6. **[SUDAH ADA] Fix mass assignment di app update** - Explicit field allowlist sudah aktif (`src/server/routes/apps/mutations.ts`)
7. **[SELESAI] Sanitize SEO meta injection** - Utilitas `escapeHtml()` ditambahkan ke injectDynamicSeo (`src/server/services/seo/seoPrerender.ts`)
8. **[DESAIN VALID] Remove webhook secret dari client response** - Builder pemilik memerlukan secret untuk konfigurasi verifikasi HMAC server

### Prioritas Tinggi (Short-term)

9. Implement CSRF protection (cookie auth saat ini dilindungi `sameSite: "lax"`, origin validation, dan CORS dynamic anchor)
10. **[SELESAI] Add security headers** - HSTS, nosniff, Referrer-Policy, dan X-Frame-Options aktif di seluruh response (`src/server/index.ts`)
11. **[SUDAH ADA] Add database indexes** - Index composite `transactions`, foreign keys, dan rate limiter sudah terpasang
12. **[SELESAI] Implement graceful shutdown** - Handler `SIGINT`/`SIGTERM` membersihkan timer interval, menghentikan server, dan mengakhiri pool PostgreSQL (`src/server/index.ts`)
13. **[SELESAI] Add request ID tracing** - Header `X-Request-Id` digenerate / dipropagasi otomatis pada setiap response (`src/server/index.ts`)
14. **[SUDAH ADA] Standardize error responses** - Error handler global Elysia memformat seragam `{ error: { code, message } }` (`src/server/index.ts`)
15. **[SUDAH ADA] Add proper transaction handling** - Proteksi rollback dan kuota kupon atomik aktif di alur checkout (`src/server/routes/checkout/session.ts`)

### Prioritas Sedang (Medium-term)

16. Remove/consolidate duplicate routes
17. Reduce configuration complexity
18. Improve test coverage (reduce mocking, add real integration tests)
19. Add rate limiting improvements
20. Implement proper audit logging

---

## TABEL RINGKASAN

| Kategori                 | Jumlah | Severity   |
| ------------------------ | ------ | ---------- |
| Bug Keamanan Kritis      | 10     | Critical   |
| Fitur Prematur           | 8      | Medium     |
| Fitur Tidak Terintegrasi | 9      | Medium     |
| Masalah Tambahan         | 10+    | Low-Medium |
