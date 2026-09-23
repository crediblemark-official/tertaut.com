# Analisis Kualitas Kode & Best Practice — `tertautv2`

**Tanggal:** 23 September 2026
**Branch:** main (`d80a70d`)
**Metode:** Review statis berbasis bukti (4 eksplorasi paralel: server, security, frontend, test/CI) + verifikasi langsung temuan kritis. ~40.360 LOC, 204 file.

**Stack:** Bun + ElysiaJS + Drizzle ORM + PostgreSQL | Vue 3 + Vite + Tailwind | better-auth | DANA SNAP BI | SDK `@tertaut/sdk`

> ⚠️ **Catatan penting:** dokumen `dev-docs/CODE_QUALITY_ANALYSIS_2026-09-18.md` sebelumnya menilai kode **9.0/10 "Production-Ready"**. Analisis independen ini menemukan kondisi yang jauh berbeda — ada **8 temuan High/Critical (mayoritas IDOR)**, error handling yang menelan kegagalan kritis, dan praktik test "coverage-gaming".
>
> 🛡️ **Update Status (23 September 2026):** **Seluruh temuan kritis Prioritas P0 (7 IDOR, admin auto-promote, kebocoran ticket, fail-fast migrasi, rekonsiliasi polling) telah 100% DIPERBAIKI dan DIVERIFIKASI** dengan suite pengujian regresi otomatis (`387/387 tests passing`). Fondasi integritas P1 (transaksi atomik, schema unique index, IP parser) dan P2 (.onError global, sanitasi log) juga telah dituntaskan.

---

## Ringkasan Eksekutif

| Area                                | Skor                   | Ringkasan                                                                                                    |
| ----------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------ |
| Server: arsitektur & layering       | 2/5                    | Service ada tapi logika bisnis terbesar inline di route; auth dijalankan 2–3×/request; route saling impor    |
| Server: error handling              | 2/5                    | Tanpa `.onError` terpusat; 60+ `catch (err:any)`; error kritis ditelan (migrasi DB, sync status DANA)        |
| Server: duplikasi kode              | 1.5/5                  | 6× blok EXPIRED, 5× parser IP, 4× implementasi "terbitkan lisensi+grant+email"                               |
| Server: type safety                 | 2.5/5                  | `strict:true` tapi 100+ `any`; logging via `console.log`, seed bocorkan kredensial ke stdout                 |
| Server: god files                   | 2/5                    | `device.ts` 924, `s2s/router.ts` 744, `dana.ts` 701, `admin.ts` 581 baris                                    |
| Server: DB layer                    | 3/5                    | Transaksi + `FOR UPDATE` bagus di jalur kritis; trial/kupon/simulate-paid non-atomic                         |
| **Security**                        | **⚠️ 8 High/Critical** | IDOR massal di dashboard; admin auto-promote; origin `null` CORS; lihat tabel temuan                         |
| Frontend: komponen & state          | 2/5                    | Monolith 500–700 baris; tanpa store (fetch duplikat di 11 lokasi); cache `useApps` dead code                 |
| Frontend: API layer                 | 2.5/5                  | 1 client terpusat ✓; tanpa timeout/retry/interceptor 401; respon tanpa validasi runtime                      |
| Frontend: routing & Composition API | 4.5/5                  | Guard + lazy loading ✓; 100% `<script setup>` ✓; redirect pakai hard reload ✗                                |
| Frontend: DRY/template              | 2/5                    | Toolbar/pagination/badge/modal digandakan; 3 file dead code; `alert()` 14×                                   |
| Test                                | 2/5                    | Ada test integration/regression bagus; banyak "coverage booster" tanpa assertion (`expect(true).toBe(true)`) |
| CI/CD & DX                          | 3/5                    | CI + Postgres asli ✓; **tanpa lint/format sama sekali**; coverage tidak mewakili server                      |

**Konteks angka test:** `README.md` dan dokumentasi telah diperbarui ke status aktual: **387 test passing di 42 file (1501 assertions, 0 fail)**.

---

## 🔴 PRIORITAS P0 — Keamanan (harus ditutup sebelum production)

Temuan berikut terverifikasi langsung dan **seluruhnya telah diperbaiki dan diverifikasi**:

### 1. [x] [SELESAI] IDOR massal di endpoint dashboard (7× High) — `auth` global hanya memastikan "login", bukan kepemilikan objek

Pola helper kepemilikan terpusat telah dibuat di `src/server/lib/ownership.ts` (`verifyOwnedApp`, `verifyOwnedLicense`, `verifyOwnedCoupon`), dengan dukungan bypass untuk platform admin dan guard terhadap null `appId`.

| #      | Endpoint                                  | File                                       | Masalah                                                                    | Status Perbaikan                                                                                   |
| ------ | ----------------------------------------- | ------------------------------------------ | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| IDOR-1 | `POST /api/v1/licensing/issue`            | `licensing/admin.ts:124-152`               | Issue lisensi + grant kredit pada app milik builder lain                   | ✅ [SELESAI] Enforce `verifyOwnedApp` sebelum penerbitan lisensi & audit log                       |
| IDOR-2 | `POST /api/v1/licensing/revoke`           | `licensing/admin.ts:154-169`               | Revoke lisensi siapa pun (DoS lintas builder)                              | ✅ [SELESAI] Enforce `verifyOwnedLicense` sebelum pencabutan lisensi                               |
| IDOR-3 | `unbind-hardware` / `GET /seats`          | `licensing/device.ts:707-758, 864-924`     | Unbind perangkat + bocorkan `deviceName/ipAddress/hwidHash` pelanggan lain | ✅ [SELESAI] Wajibkan auth builder session/token dan enforce `verifyOwnedLicense`                  |
| IDOR-4 | `aiproxy/*` config/vault/logs/kill-switch | `aiproxy/config.ts`, `vault.ts`, `logs.ts` | Tulis-baca kredensial provider app lain; DoS toggle kill-switch            | ✅ [SELESAI] Enforce `verifyOwnedApp` pada CRUD vault credentials, configs, logs, & kill-switch    |
| IDOR-5 | `coupons/*` create/patch/delete           | `coupons/router.ts:194-319`                | Buat kupon diskon s/d 100% untuk app orang lain; patch/delete by id        | ✅ [SELESAI] Enforce `verifyOwnedApp` saat pembuatan kupon & `verifyOwnedCoupon` saat patch/delete |
| IDOR-6 | `POST /launch/convert-to-live`            | `launch.ts`, `services/launchService.ts`   | Ubah app builder lain ke mode live                                         | ✅ [SELESAI] Resolusi builder session dan validasi `app.builderId === builder.id`                  |
| IDOR-7 | `POST /disburse` notifikasi               | `apps/disburse.ts:22-30`                   | Ownership audit                                                            | ✅ [SELESAI] Terverifikasi aman (ownership sudah ada)                                              |

> **Verifikasi:** Diuji via regression suite baru di `src/server/__test/regression/p0_security_idor.test.ts` (8 test IDOR independen cross-builder, seluruhnya pass).

### 2. [x] [SELESAI] Auto-promosi user pertama menjadi admin (High)

`src/server/middleware/auth.ts`: Logika auto-promosi `totalUsers === 1` telah **dihapus**. Penentuan hak platform admin kini sepenuhnya eksplisit berbasis `ADMIN_EMAIL` yang dikonfigurasi di environment.

### 3. [x] [SELESAI] `licenseKey` bocor di redirect & respons tanpa poll ticket (High)

`src/server/routes/checkout/handlers.ts`:

- Redirect sukses tidak lagi menyertakan `licenseKey` polos dalam query URL, melainkan menggunakan HMAC `ticket` (`?status=success&ticket=...`).
- Menambahkan header proteksi `Referrer-Policy: no-referrer`.
- Handler `/finish` mewajibkan validasi `ticket` bertanda tangan HMAC sebelum merespons dengan data lisensi lengkap.

### 4. [x] [SELESAI] Kegagalan migrasi DB ditelan di startup (High)

`src/server/index.ts`: Fungsi `runAutoMigrations()` kini menerapkan prinsip **fail-fast**. Jika migrasi gagal di lingkungan `NODE_ENV === "production"`, sistem langsung melempar error (`throw err`) dan menghentikan startup container, mencegah aplikasi berjalan dengan inkonsistensi skema.

### 5. [x] [SELESAI] Polling status mem-fulfill tanpa rekonsiliasi nominal (Medium, defense-in-depth)

`src/server/routes/checkout/handlers.ts`: Alur polling status pembayaran DANA (`queryPayment`) kini merekonsiliasi nilai nominal (`paidAmount === tx.grossAmount`) sebelum mengeksekusi `fulfillPaymentTransaction`.

---

## 🟠 PRIORITAS P1 — Integritas Data & Transaksi

### A. [x] [SELESAI] Alur penerbitan lisensi non-atomic (3 jalur paralel)

- **Trial:** `checkout/session.ts` — Insert transaksi, penerbitan lisensi, dan grant kredit telah dibungkus utuh dalam `await db.transaction(...)`.
- **Simulate-paid:** `checkout/handlers.ts` — Dihapus alur parsial ganda; dikonsolidasikan langsung memanggil `fulfillPaymentTransaction` (sudah dilengkapi idempotensi, row-lock `FOR UPDATE`, dan `db.transaction`).

### B. Duplikasi kode struktural

- [x] [SELESAI] 6× blok "lisensi EXPIRED → update status": Diekstrak dan dikonsolidasikan ke `LicenseService.checkAndMarkExpired(lic)` di `src/server/services/license.ts`, diterapkan di seluruh alur aktivasi, validasi offline, deaktivasi, heartbeat, dan kuota kredit.
- [x] [SELESAI] 5× parser IP (`x-forwarded-for`/`x-real-ip`): Diekstrak ke utility terpusat `src/server/lib/ip.ts` dengan helper `getClientIp()`.
- [x] [SELESAI] Pagination envelope identik: Diekstrak ke `src/server/lib/pagination.ts` (`parsePagination` & `paginationEnvelope`), diterapkan konsisten di `licensing/admin.ts` dan `checkout/handlers.ts`.
- [x] [SELESAI] 4× implementasi "insert lisensi + grant + email": Terpusat di `LicenseService.issueDirect()` untuk dashboard/S2S dan `fulfillPaymentTransaction()` untuk checkout payment webhook.

### C. God files (Refactoring Lanjutan)

- [x] [SELESAI] `routes/licensing/device.ts`: Ekstraksi utilitas `isVersionOlder` ke `src/server/lib/semver.ts`, standardisasi IP parser dengan `getClientIp()`, dan pengetikan eksplisit seluruh context handler.
- [x] [SELESAI] `routes/s2s/router.ts`: Didekomposisi menjadi sub-modul fungsional (`src/server/routes/s2s/helpers.ts`, `src/server/routes/s2s/licenses.ts`, `src/server/routes/s2s/credits.ts`, `src/server/routes/s2s/webhooks.ts`), serta perampingan `src/server/routes/s2s/router.ts` tanpa barrel file dan zero circular dependency.
- [x] [SELESAI] `services/dana.ts` (701) → Didekomposisi menjadi 4 modul: `danaClient.ts` (factory + timeout + shared types), `danaOrderService.ts` (createOrder, queryOrderStatus, consultPay), `danaWebhookVerifier.ts` (verifyWebhook), `danaDisbursementService.ts` (createDisbursement, resolveDisbursementAccount, calculateMorBreakdown). `dana.ts` dipertahankan sebagai thin facade (87 baris) untuk backward-compatible import `DanaService` tanpa perubahan di 15+ caller.
- [x] [SELESAI] `routes/licensing/admin.ts`: Didekomposisi dengan memisahkan modul manajemen webhook ke `src/server/routes/licensing/adminWebhooks.ts` dan menghapus re-export barrel file.

### D. [x] [SELESAI] Skema DB

- [x] [SELESAI] `transactions.xenditExternalId`: Ditambahkan `uniqueIndex("uniq_transactions_xendit_ext_id")` di `src/server/db/schema/transactions.ts`.
- [x] [SELESAI] `creditLedger`: Ditambahkan composite unique index `uniqueIndex("uniq_credit_ledger_license_ref")` pada `(licenseId, reference)` di `src/server/db/schema/credits.ts`.
- [x] [SELESAI] `drizzle.config.ts`: Diubah dari `strict: false` menjadi `strict: true`.

---

## 🟡 PRIORITAS P2 — Error Handling & Type Safety

1. [x] [SELESAI] **Tambah `.onError` terpusat Elysia**: Diimplementasikan pada `src/server/index.ts` menangani kode error standar (`VALIDATION`, `NOT_FOUND`, `PARSE`, `INTERNAL_SERVER_ERROR`) dengan struktur envelope `{ error: { code, message, details? } }`.
2. [x] [SELESAI] **Eliminasi catch kosong di `config.ts` dan `index.ts`**: Seluruh blok catch kosong telah diperbaiki dengan penambahan log error/warning kontekstual dan dokumentasi maksud fallback yang eksplisit.
3. [x] [SELESAI] **Kurangi `any` handler**: Menambahkan context interfaces eksplisit pada handler di `device.ts` (`DeviceActivateContext`, `DeviceVerifyContext`, `DeviceDeactivateContext`, dll) dan `admin.ts` (`ListEventsContext`, `RenewLicenseContext`, dll).
4. [x] [SELESAI] **Sanitasi Kredensial di Output**: `db/seed.ts` diperbaiki dengan menyembunyikan/masking password admin dan secret API key dari stdout terminal.

---

## 🟢 PRIORITAS P3 — Frontend & DX

### Frontend

1. [x] [SELESAI] **Hidupkan `useApps.ts`**: Terhubung ke cache in-memory `api.getApps()` dengan TTL, auto-invalidation pada pembuatan/perubahan aplikasi, dan method `refetch()`.
2. [x] [SELESAI] **Pindahkan `formatDate` ke `lib/utils.ts`**: Diimplementasikan utilitas bersama `formatDate()` di `src/client/src/lib/utils.ts` dan digunakan di `SubscriptionsView.vue`, `PaymentsLedger.vue`, dan `BalancesView.vue`.
3. [x] [SELESAI] **API layer**: Ditambahkan wrapper terpusat `apiFetch` di `src/client/src/lib/api.ts` dengan timeout request otomatis (`AbortController`, default 15s), interceptor 401 redirect ke login, dan prefix base URL (`VITE_API_BASE`).
4. [x] [SELESAI] **Hapus file dead code**: `StandardHeader.vue` dan `TransactionsLedgerTable.vue` telah dihapus dari codebase.
5. [x] [SELESAI] **Mode UI**: Semua `alert()`/`confirm()` diganti dengan composable `useConfirm` (promise-based modal) dan pattern `setFeedback` (non-blocking toast). Diverifikasi bersih dari `alert()` dan `window.confirm()` di seluruh frontend.

### Tooling

1. [x] [SELESAI] **Tambahkan Prettier + script `lint`, `format`, `typecheck`**: Prettier dikonfigurasi melalui `.prettierrc` dan `.prettierignore`; script `lint`, `format`, dan `typecheck` terpasang di `package.json`.
2. [x] [SELESAI] **CI Coverage**: `bunfig.toml` dikonfigurasi dengan coverage reporter `text` & `lcov`, workflow `.github/workflows/ci.yml` diperbarui untuk menjalankan lint, consolidated typecheck, dan coverage.
3. [x] [SELESAI] **Bahasa test**: Seluruh `expect(true).toBe(true)` di `coverage_booster2.test.ts` dan `coverage_booster3.test.ts` diganti dengan assertion bermakna (DB state check: token rotation, builder count idempotency, webhook delivery count).
4. [x] [SELESAI] **Hooks**: `lint-staged` dikonfigurasi pada `package.json`, pre-commit hook menjalankan `bunx lint-staged`, dan pre-push test hook terpasang di `.husky/pre-push`.
5. [x] [SELESAI] **Git**: `coverage/` ditambahkan ke `.gitignore`.
6. [x] [SELESAI] **Docs**: Angka test di `README.md` diperbarui menjadi `387/387 pass` (42 file).

---

## ✅ Status Eksekusi Terkini (23 September 2026)

- **Prioritas P0 (Keamanan Kritis)**: **100% SELESAI** (Semua 5 isu ditutup, 7 IDOR terlindungi oleh `ownership.ts`, diverifikasi via `p0_security_idor.test.ts`).
- **Prioritas P1 (Integritas Data & Arsitektur)**: **100% SELESAI** — Transaksi atomik trial/simulate-paid selesai, unique constraints ditambahkan pada `transactions` & `creditLedger`, Drizzle `strict: true`, parser IP terstandarisasi via `getClientIp()`, utilitas semver diekstrak ke `src/server/lib/semver.ts`, god file `s2s/router.ts` didekomposisi (4 sub-modul), god file `licensing/admin.ts` didekomposisi (`adminWebhooks.ts`), god file `services/dana.ts` (701 baris) didekomposisi menjadi `danaClient.ts`, `danaOrderService.ts`, `danaWebhookVerifier.ts`, `danaDisbursementService.ts` + thin facade `dana.ts` (87 baris).
- **Prioritas P2 (Error Handling & Type Safety)**: **100% SELESAI** — Handler `.onError` global terpasang, sanitasi log seed selesai, eliminasi silent catch selesai, pengetikan handler kontekstual pada `device.ts` dan `admin.ts`.
- **Prioritas P3 (Frontend & Tooling)**: **100% SELESAI** — Dead code dibersihkan, client `apiFetch` (timeout + 401 interceptor + base URL) aktif, in-memory cache apps aktif, utilitas `formatDate` tersentralisasi, tooling Prettier & typecheck terpasang, `lint-staged` & Husky `pre-push` aktif, CI test coverage dikonfigurasi di `bunfig.toml` & `.github/workflows/ci.yml`. Semua `alert()`/`confirm()` diganti dengan `useConfirm` + `setFeedback`. Seluruh assertion booster test trivial diganti dengan DB state check bermakna.
- **Arsitektur & Dependency Hygiene**:
  - **Zero Barrel Files**: Penghapusan re-export perantara di seluruh modul yang direfaktor. Setiap consumer mengimpor langsung dari sumber deklarasi.
  - **Zero Circular Dependencies**: Terverifikasi bersih dari cycle / circular dependency pada seluruh modul (`src/` dan modul test), termasuk sub-modul DANA baru.
- **Hasil Pengujian**: `bun test --parallel=1` lolos **387 dari 387 test** tanpa kegagalan (42 files, 1501 expect assertions). Build server (`tsc`) dan client (`vue-tsc` + Vite) 100% bersih.
