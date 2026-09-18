# Laporan Bug, Fitur Prematur & Kebocoran UX — tertautv2

> Audit awal: 18 September 2026
> **Re-audit #3 (lanjutan 2): 18 September 2026**
> Status perubahan: N1–N4 **tuntas**, P4/P5 **tuntas** (API key dipersist + endpoint verifikasi), migrasi DB **diregenerasi menjadi satu baseline lengkap** (drift 0 vs `schema.ts`). Sisa P1 & P3 bersifat pengembangan lanjutan.
> Validasi: `bun test` 83 pass / 0 fail ✅, `tsc --noEmit` ✅, `vue-tsc` ✅, `bun run build` ✅, migrasi diuji pada DB segar ✅.

---

## STATUS VERIFIKASI (Re-audit #3)

### Ringkasan

| Kelompok | ✅ FIXED | 🟡 PARTIAL | ❌ BELUM |
|----------|:---:|:---:|:---:|
| BUG (B1–B11) | B1 B2 B3 B4 B5 B6 B7 B8 B9 B10 B11 | — | — |
| Prematur (P1–P8) | P2 P4 P5 P6 P7 P8 | P1 P3 | — |
| UX (U1–U8) | U1 U2 U3 U4 U5 U6 U7 U8 | — | — |
| Baru (N1–N4) | N1 N2 N3 N4 | — | — |

**Kesimpulan:** Seluruh celah kritis, regresi, dan temuan baru **tuntas**. Sebagian besar fitur prematur kini terintegrasi. Sisa **P1** (renewal berbayar/auto-debit) dan **P3** (kuota `freeAllowance` per siklus) adalah fitur lanjutan, bukan penghalang deploy.

### Deploy Blocker Dibereskan ✅
- Migrasi lama **tidak lengkap**: `meta/_journal.json` tak memuat `0004`, snapshot hanya sampai `0003` (sehingga `db:generate` berikutnya rusak), plus drift nyata — 4 index hilang (`idx_transactions_app_payment_status`, `idx_transactions_customer_email`, `idx_transactions_xendit_ext_id`, `idx_ai_vault_credentials_provider`) dan kolom usang `builders.password_hash` masih terbawa.
- **Solusi:** regenerasi satu **baseline lengkap** `src/server/db/migrations/0000_shallow_venus.sql` (17 tabel, 30 index, seluruh constraint) dari `schema.ts` via `drizzle-kit generate`. Proyek belum pernah deploy, jadi aman mereset linearitas migrasi.
- **Validasi parity:** DB segar → `drizzle-kit migrate` → `drizzle-kit push --force` melaporkan **tidak ada perubahan struktural** (kecuali churn kosmetik `unique_app_code` bawaan drizzle-kit). Semua kolom `apps.pricing_type/billing_period/trial_period_days/delivery_config/metering_config` dan `licenses.api_key` tercipta.

### Perbaikan Konfigurasi ✅
- `config.ts:getEnv` sebelumnya membaca file `.env` **lebih dulu** daripada `process.env`, sehingga override runtime diabaikan (di dev, `DATABASE_URL=... bun run db:migrate` tetap menuju DB dari `.env`). Kini **`process.env` diutamakan**; `.env` hanya fallback. Diverifikasi: `bun run db:migrate` + override env sukses membuat 17 tabel di DB segar.
- Koneksi DB **tanpa fallback hardcoded**: `DATABASE_URL` wajib di semua mode (`config.ts` via `requireEnv`, `drizzle.config.ts`), dan `docker-compose.yml` mewajibkan `DB_USER/DB_PASSWORD/DB_NAME` dari environment (gagal jelas bila kosong). `.env` aplikasi cukup satu baris `DATABASE_URL`.

---

## BUG

### B1. Kupon `/pay/:slug` → checkout 400 (double-discount)
✅ **FIXED** — `PayView` kirim `amount: targetPrice`; server hitung diskon atomik (`session.ts:96-122`). Kupon invalid → pesan kupon yang benar.

### B2. `grantDays` diatur pembeli
✅ **FIXED** — `grantDays` dari `app.deliveryConfig.licenseKey.expiresInDays` (`session.ts:86-90`); klien tak lagi kirim query param.

### B3. Kebocoran data antar-builder
✅ **FIXED** — `handleListTransactions` (`checkout/handlers.ts:94-124`), `handleListLicenses` (`licensing/admin.ts:11-63`), `coupons` (`coupons/router.ts`), apps & stats semua scoped `builderId` untuk non-admin. **Residual R1 tuntas**: `resolveCurrentBuilder` (`apps/builder.ts:32-67`) kini membuat profil builder spesifik per-user dan fallback `findFirst()` **hanya** di `isSandbox`. Di production user tanpa profil → `builder: null` → query mengembalikan kosong (tidak bocor).
> Catatan produk (bukan bug): setiap user login otomatis dibuatkan profil builder + apiKey di step 3 — keputusan self-service onboarding.

### B4. KPI dihitung dari window transaksi
✅ **FIXED** — Server & client kini mendukung penuh pagination. `api.getTransactions({ page, limit })` dan `api.getLicenses({ page, limit })` terintegrasi dengan state `page`, `limit`, `total`, dan `hasMore`. Komponen `PaymentsView.vue` dan `SubscriptionsView.vue` dilengkapi pagination bar.
> Residual UX: kolom search/filter di `PaymentsView` & `SubscriptionsView` masih **client-side** sehingga hanya menyaring halaman aktif (bukan seluruh dataset). LTV di `SubscriptionsView` menghitung dari maksimum 200 transaksi (`limit: 200`). Pertimbangkan filter server-side bila volume besar.

### B5. SIMULATE paid menyentuh aplikasi LIVE
✅ **FIXED** — hanya app `mode === "sandbox"` (`handlers.ts:151-155`).

### B6. Aplikasi sandbox bisa dibeli publik di production
✅ **FIXED** — guard `if (isSandboxApp && !checkoutConfig.isSandbox) → 400` sebelum invoice dibuat (`session.ts:70-76`). Ditambah badge **Test** pada Launch Link app sandbox (`AppCatalog.vue`).

### B7. Status EXPIRED tak bisa disaring
✅ **FIXED** — pill EXPIRED (`PaymentsView.vue:35,207`).

### B8. `preferredPaymentChannel` param mati
✅ **FIXED** — server menerima `paymentRail` || `preferredPaymentChannel` (`session.ts:37-43`).

### B9. PATCH menolak billing period baru
✅ **FIXED** — PATCH memakai `t.Partial(appBodySchema)` bersama POST (`apps/router.ts:111-116`), termasuk `trialPeriodDays`.

### B10. Ternary mati AppCatalog
✅ **FIXED** — `'product' : 'products'` (`AppCatalog.vue:120`).

### B11. Dua endpoint disburse redundan
✅ **FIXED** — `handleDisburseTx` delegasi ke `handleDisburse` (shared scoping + atomic lock + sandbox guard, `apps/disburse.ts`).

---

## FITUR PREMATUR / TIDAK TERINTEGRASI

### P1. Recurring billing tidak ada backend
🟡 **PARTIAL** — Endpoint perpanjangan manual ada (`POST /api/v1/licensing/renew`, `handleRenewLicense` di `licensing/admin.ts:200-225`) memakai `billingPeriod` atau hari kustom, dan kini **di-scope ke builder pemilik** (N3 ✅). **Belum tuntas:** (a) belum ada integrasi pembayaran — perpanjangan masih gratis sehingga mem-bypass fee MoR 5%; (b) belum ada penjadwalan/auto-debit, jadi belum benar-benar "recurring".

### P2. `trial_period_days` mati total
✅ **FIXED** — Alur trial 0-IDR hidup di `session.ts:89-172` saat `startTrial`/`isTrial` true: transaksi 0 IDR + lisensi ACTIVE berdurasi `trialPeriodDays`. Kredit trial kini **server-authoritative** (`app.meteringConfig.freeAllowance`), dan ada **dedup satu trial per email+app** (409) — celah N2 tertutup & dijaga test.

### P3. `meteringConfig` tak pernah dibaca
🟡 **PARTIAL** — Engine ada (`src/server/routes/metering/router.ts`): `POST /events` memvalidasi lisensi ACTIVE + `meteringConfig.enabled`, mengalikan `unitPrice`, lalu `CreditService.debit()` atomik; ada `GET /usage/:licenseKey` & `GET /stats` (bentuk respons sudah konsisten). **Sisa:** kuota `freeAllowance` per siklus belum dipotongkan (perlu pelacakan unit per periode). `unitMultiplier` sengaja minimal 1 kredit; `/events` & `/usage/:key` publik sesuai desain (lisensi key sebagai kredensial).

### P4. `deliveryConfig` tak dipakai saat fulfillment
✅ **FIXED** — File download & private note dirender di email (`email.ts:110-148`); API key `tt_cust_...` kini **dipersist** ke kolom `licenses.api_key` (migrasi `0005`) saat fulfillment (`fulfill.ts`), trial (`session.ts`), dan penerbitan manual (`admin.ts`). Jalur email fulfillment normal (N1 ✅).

### P5. `apiAccess` buntu dari UI sampai backend
✅ **FIXED** — `AppDeliverySection.vue` terintegrasi ke `AppCreateForm.vue` (4 kanal). API key tersimpan + dapat diverifikasi backend via `POST /api/v1/licensing/api-key/verify` (publik), mengembalikan status lisensi & saldo kredit. Dijaga test `P4/P5`. **Sisa (opsional):** form edit produk & rotasi API key.

### P6. Pencairan tanpa on-boarding rekening
✅ **FIXED** — `GET/POST /api/v1/payouts/account` (`payouts/router.ts:280-376`) + modal "Rekening Bank" (`BalancesView.vue:533-612`).

### P7. MRR & metrik langganan dipalsukan
✅ **FIXED** — MRR hanya produk `subscription` + konversi period (`SubscriptionsView.vue:155-167`); `isTrial` dari `trialPeriodDays`; `billingInterval` dari periode; label "Estimasi MRR"; LTV dari transaksi PAID.

### P8. Migrasi DB out-of-sync
✅ **FIXED** — Diregenerasi jadi baseline lengkap `0000_shallow_venus.sql`; parity dengan `schema.ts` diverifikasi via `drizzle-kit push` (0 drift struktural).

---

## UX

### U1. 4 halaman finansial tumpang tindih
✅ **FIXED** — Pembagian peran arsitektur informasi 4 halaman finansial telah dikonsolidasikan dan ditegaskan:
- **Payments (`/payments`)**: Mengelola seluruh histori transaksi masuk, status pembayaran (Paid, Pending, Failed, Expired), breakdown fee MoR 5%, dan simulator sandbox.
- **Subscriptions (`/subscriptions`)**: Mengelola pelanggan berulang, estimasi MRR riil, nilai siklus hidup (LTV), perpanjangan lisensi, dan pencabutan lisensi (revoke).
- **Balances (`/balances`)**: Mengelola saldo creator (95%), onboarding rekening bank/e-wallet untuk payout, dan permintaan pencairan dana.
- **Tautan Kasir (`/checkout`)**: Generator dan arena pengujian dynamic checkout link serta tautan kasir hosted `/pay/:slug`.

### U2. Tombol "Kelola" dead-end
✅ **FIXED** — diganti "Buka Kasir" fungsional (`AppCatalog.vue:248-258`).

### U3. BalancesView sandbox menyesatkan
✅ **FIXED** — tombol terkunci label "Simulasi" + badge "Simulasi" + guard env (`BalancesView.vue:301-315,324`).

### U4. Launch Link untuk semua mode
✅ **FIXED** — badge Test untuk sandbox + backend menolak checkout sandbox di production (B6).

### U5. KPI AppCatalog menyesatkan
✅ **FIXED** — `activeSubscriptions` kini hanya produk `pricing_type = 'subscription'` (`queries.ts:148-162`); label archive palsu diganti kontekstual "Mode Sandbox"/"Siap Jual" (`AppCatalog.vue:109`). (Fitur archive sendiri memang belum ada.)

### U6. Badge pricing salah label
✅ **FIXED** — `getPricingBadge` menangani semua periode (`AppCatalog.vue:49-61`).

### U7. `/pay` tanpa slug tampak broken
✅ **FIXED** — `notFound` ramah tanpa panggilan auth (`PayView.vue:64-72`).

### U8. Revoke tanpa umpan balik
✅ **FIXED** — `actionFeedback` + reload (`SubscriptionsView.vue:214-233`).

---

## Item Baru / Catatan Re-audit #3

- **R1 ✅ TUNTAS** — fallback `findFirst()` di `resolveCurrentBuilder` dikunci ke sandbox; production builder diisolasi penuh.
- **R2 ✅ TUNTAS** — `activeSubscriptions` dan MRR hanya memperhitungkan produk `subscription`.
- **R3 ✅ TUNTAS** — `productStatus` terintegrasi dengan mode sandbox/live produk.
- **R4 ✅ TUNTAS** — Engine metering & usage ingestion terpasang; terhubung `CreditService.debit()`.

---

## Temuan Baru & Regresi (Re-audit #3) — DIPERBAIKI

### N1. ✅ FIXED: regresi email lisensi (paid fulfillment)
`formatDate` di `email.ts` kini menerima `Date | string` dan menormalisasi + menangani tanggal invalid (`email.ts:29-36`); tipe `sendLicenseIssued.expiresAt` diubah ke `Date | string` (`email.ts:94`). Email fulfillment terkirim kembali (log test: `[Email] Terkirim ke ...`, tidak ada lagi `RangeError`).

### N2. ✅ FIXED: abuse free-credit trial
- `grantCredits` trial tidak lagi dari body klien, melainkan server-authoritative dari `app.meteringConfig.freeAllowance` (`session.ts:108-111`).
- Ditambah dedup: satu trial per `email + appId` via `transactions.paymentChannel = 'FREE_TRIAL'` → request kedua `409` (`session.ts:91-106`).
- Regresi dijaga oleh test `P1 & P2` (kini 12 ekspektasi, termasuk percobaan trial ganda).

### N3. ✅ FIXED: IDOR + bypass billing `/renew`
`handleRenewLicense` kini memanggil `resolveCurrentBuilder` dan menolak (404) jika lisensi bukan milik builder yang login, kecuali admin (`admin.ts:200-225`). Route juga menerima alias `days` (`router.ts:233-237`).
> Sisa catatan produk: belum ada integrasi pembayaran untuk renewal (perpanjangan masih gratis) — perlu keputusan bisnis.

### N4. ✅ FIXED: typecheck server
Refactor test `f15ef8a` menghapus `includedUnits`; `tsc --noEmit` dan `vue-tsc` kini **lolos** (0 error).

### Catatan minor
- `GET /metering/stats` mengembalikan bentuk respons berbeda saat kosong (`appsWithMetering`) vs terisi (`appsCount`).
- `AppDeliverySection.vue` memancarkan konfigurasi penuh pada tiap ketikan; belum dipanggil saat mount.

---

## Ringkasan Eksekusi Akhir

| # | Item | Status | Keterangan |
|---|------|:------:|------------|
| B4 | Paging di client | ✅ FIXED | Bar pagination terpasang; search/filter masih per-halaman |
| P3 | Engine metering/usage | 🟡 PARTIAL | Engine jalan & stats konsisten; kuota `freeAllowance` per siklus belum dipotongkan |
| P1 | Engine recurring/trial | 🟡 PARTIAL | Renew manual + scope owner tuntas; belum ada pembayaran/auto-debit |
| P2 | Eksekusi trial di checkout | ✅ FIXED | Trial kredensial server-controlled + dedup email/app |
| P4/P5 | Provisioning + UI form | ✅ FIXED | API key dipersist + endpoint verifikasi; sisa rotasi/edit-form (opsional) |
| Migrasi | Baseline lengkap `0000_shallow_venus` | ✅ FIXED | Deploy blocker: 17 tabel + index lengkap, 0 drift vs schema |
| U1 | Konsolidasi 4 halaman finansial | ✅ FIXED | Pembagian peran didokumentasikan & ditegaskan |
| N1 | Regresi email fulfillment | ✅ FIXED | `formatDate` terima `Date \| string` |
| N2 | Trial abuse kredit gratis | ✅ FIXED | Kredit server-side + dedup per email/app |
| N3 | Renew IDOR + bypass billing | ✅ FIXED | Di-scope ke builder pemilik (admin dikecualikan) |
| N4 | Typecheck server | ✅ FIXED | 0 error `tsc` & `vue-tsc` |

> Status berdasarkan verifikasi kode dan pengujian otomatis (18 Sep 2026). `bun test` **83 pass / 0 fail** ✅, `tsc --noEmit` ✅, `vue-tsc` ✅, `bun run build` ✅, migrasi diuji pada DB segar ✅. Tidak ada lagi celah kritis/penghalang deploy; P1 & P3 adalah fitur lanjutan.

---

## Checklist Deploy Produksi

1. **Migrasi DB (WAJIB)** — di **DB produksi yang masih kosong**: `bun run db:migrate` akan menerapkan baseline lengkap `0000_shallow_venus.sql`. Jika DB sudah pernah dibuat lewat `db:push` (mis. dev lokal), `db:migrate` akan gagal `relation already exists` — gunakan DB baru, atau sinkronkan dulu dengan `db:push` lalu tandai migrasi sebagai sudah diterapkan.
2. **Environment** — set `NODE_ENV=production` dan secret wajib (tanpa nilai default, startup akan gagal bila kosong): `DATABASE_URL`, `JWT_SECRET`, `VAULT_ENCRYPTION_KEY`, `BETTER_AUTH_SECRET`, `HWID_SALT`, `LICENSE_SIGNING_PRIVATE_KEY`.
3. **URL publik** — `PUBLIC_APP_URL` dan `PUBLIC_STORE_URL` ke domain produksi.
4. **Pembayaran & email** — `XENDIT_*` atau `DANA_*`, `XENDIT_WEBHOOK_VERIFICATION_TOKEN`, `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_REPLY_TO`.
5. **Build & jalankan** — `bun run build` lalu `bun run start`, atau `docker compose up -d --build`.
6. **Smoke test** — `GET /api/v1/health`, uji satu checkout sandbox→live, cek email lisensi terkirim, dan uji `POST /api/v1/licensing/api-key/verify` dengan API key hasil pembelian apiAccess.
> Catatan: `NODE_ENV=production` otomatis mematikan mode sandbox (`config.isSandbox=false`), sehingga app sandbox tidak bisa dibeli publik (B6) dan mock payment nonaktif.