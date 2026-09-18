# Laporan Bug, Fitur Prematur & Kebocoran UX — tertautv2

> Audit awal: 18 September 2026
> **Re-audit #3: 18 September 2026**
> Status perubahan: sebagian besar temuan tuntas; ditemukan **4 temuan baru/regresi** yang belum tertutup.
> Validasi: `bun test` 82 pass / 0 fail ✅, namun `tsc --noEmit` (server) ❌ dan ditemukan **regresi runtime pada email fulfillment** ❌.

---

## STATUS VERIFIKASI (Re-audit #3)

### Ringkasan

| Kelompok | ✅ FIXED | 🟡 PARTIAL | ❌ BELUM |
|----------|:---:|:---:|:---:|
| BUG (B1–B11) | B1 B2 B3 B4 B5 B6 B7 B8 B9 B10 B11 | — | — |
| Prematur (P1–P8) | P6 P7 P8 | P1 P2 P3 P4 P5 | — |
| UX (U1–U8) | U1 U2 U3 U4 U5 U6 U7 U8 | — | — |
| Baru (N1–N4) | — | — | N1 N2 N3 N4 |

**Kesimpulan:** 21/27 temuan tuntas. Kelima fitur prematur P1–P5 hanya **terpasang sebagian** (engine ada, tetapi belum aman/produksi-ready), dan muncul **4 temuan baru** — termasuk **1 regresi email** dan **1 celah kritis free-credit trial tanpa autentikasi**. Lihat bagian "Temuan Baru & Regresi".

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
🟡 **PARTIAL** — Endpoint perpanjangan manual ada (`POST /api/v1/licensing/renew`, `handleRenewLicense` di `licensing/admin.ts:200-254`) memakai `billingPeriod` atau hari kustom. **Belum tuntas:** (a) tidak ada integrasi pembayaran — perpanjangan gratis 100% sehingga mem-bypass fee MoR 5%; (b) handler **tidak men-scope lisensi ke builder yang login** (lihat N3); (c) belum ada penjadwalan/auto-debit, jadi belum benar-benar "recurring".

### P2. `trial_period_days` mati total
🟡 **PARTIAL** — Alur trial 0-IDR hidup di `session.ts:89-172` saat `startTrial`/`isTrial` true: menerbitkan transaksi 0 IDR + lisensi ACTIVE berdurasi `trialPeriodDays`. **Belum tuntas / berisiko kritis:** endpoint `/api/v1/checkout/session` **publik**, `grantCredits` diterima mentah dari body dan langsung di-grant pada trial → **free license + kredit tak terbatas tanpa autentikasi & tanpa dedup per email** (lihat N2).

### P3. `meteringConfig` tak pernah dibaca
🟡 **PARTIAL** — Engine ada (`src/server/routes/metering/router.ts`): `POST /events` memvalidasi lisensi ACTIVE + `meteringConfig.enabled`, mengalikan `unitPrice`, lalu `CreditService.debit()` atomik; ada `GET /usage/:licenseKey` & `GET /stats`. **Belum tuntas:** (a) `freeAllowance`/`includedUnits` diabaikan → tidak ada kuota gratis; (b) `unitMultiplier` di-`Math.max(1, …)` sehingga unit "gratis" (0) tetap menagih 1 kredit; (c) `eventName` tidak divalidasi terhadap event yang dikonfigurasi; (d) `/events` & `/usage/:key` publik (siapapun pemegang key bisa menguras kredit); (e) `GET /stats` menghitung **semua** `creditLedger` DEBIT (bukan hanya event metering).

### P4. `deliveryConfig` tak dipakai saat fulfillment
🟡 **PARTIAL** — File download & private note kini dirender di email (`email.ts:110-145`), dan `maxSeats`/`expiresInDays` dibaca dari delivery config. **Belum tuntas:** API key `tt_cust_...` di-generate (`fulfill.ts:92-96`) tetapi **tidak pernah disimpan** ke DB maupun divalidasi backend, dan di-generate ulang tiap fulfillment → provisioning bersifat kosmetik. Selain itu jalur email fulfillment sedang **error** (lihat N1).

### P5. `apiAccess` buntu dari UI sampai backend
🟡 **PARTIAL** — `AppDeliverySection.vue` dibuat dan diintegrasikan ke `AppCreateForm.vue`, builder bisa mengatur 4 kanal (licenseKey, fileDownload, privateNote, apiAccess). **Belum tuntas:** (a) API key hasil generation tidak dipersist (lihat P4); (b) konfigurasi delivery hanya tersedia saat **membuat** produk — belum terpasang di alur edit produk; (c) belum ada manajemen/rotasi API key pelanggan.

### P6. Pencairan tanpa on-boarding rekening
✅ **FIXED** — `GET/POST /api/v1/payouts/account` (`payouts/router.ts:280-376`) + modal "Rekening Bank" (`BalancesView.vue:533-612`).

### P7. MRR & metrik langganan dipalsukan
✅ **FIXED** — MRR hanya produk `subscription` + konversi period (`SubscriptionsView.vue:155-167`); `isTrial` dari `trialPeriodDays`; `billingInterval` dari periode; label "Estimasi MRR"; LTV dari transaksi PAID.

### P8. Migrasi DB out-of-sync
✅ **FIXED** — `0004_add_app_pricing_delivery_columns.sql` (`IF NOT EXISTS`).

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

## Temuan Baru & Regresi (Re-audit #3)

### N1. ❌ Regresi: email lisensi gagal terkirim (paid fulfillment)
`fulfill.ts:134` mengubah hasil menjadi `expiresAt: expiresAt.toISOString()` (string), sementara `EmailService.sendLicenseIssued` bertipe `expiresAt: Date` dan memanggil `formatDate()` → `new Intl.DateTimeFormat().format(string)` melempar `RangeError: date value is not finite`. Karena dipanggil sebelum pengecekan Resend, **semua email lisensi jalur pembayaran berbayar gagal** (tertangkap & di-log `[Webhook] Gagal kirim email lisensi`). Bukti: log `bun test`.
**Fix:** kirim `Date` (`expiresAt`), atau buat `formatDate` menerima `Date | string`.

### N2. ❌ Kritis: free license + kredit gratis tanpa autentikasi (trial)
`POST /api/v1/checkout/session` publik (`api.ts` PUBLIC_PREFIXES). Saat `startTrial: true` pada produk `trialPeriodDays > 0`, `grantCredits` diambil mentah dari body lalu langsung di-grant (`session.ts:32,152-165`). Penyerang dapat memanggil berulang kali dengan email acak → **lisensi ACTIVE + kredit tak terbatas gratis**, tanpa dedup email/app.
**Fix:** batasi `grantCredits` trial (pakai nilai dari konfigurasi produk, bukan input klien), satu trial per email/app, dan/atau rate-limit.

### N3. ❌ IDOR + bypass billing: `POST /api/v1/licensing/renew`
`handleRenewLicense` hanya memakai `requireAuth` dan **tidak men-scope lisensi ke builder pemilik** (tidak memanggil `resolveCurrentBuilder`). Builder terautentikasi mana pun yang mengetahui `licenseKey` dapat memperpanjang lisensi builder lain, tanpa pembayaran apa pun.
**Fix:** scope ke `builderId`/`appId` milik user (bandingkan `handleListLicenses`), dan integrasikan biaya perpanjangan.

### N4. ❌ Typecheck server gagal
`tsc --noEmit` error: `server.test.ts:2242` memakai `includedUnits` yang tidak ada di `MeteringConfig` (`schema/apps.ts:52`). Field `freeAllowance`/`includedUnits` juga belum diimplementasikan di engine metering (lihat P3).

### Catatan minor
- `AppDeliverySection.vue` memancarkan konfigurasi penuh pada tiap ketikan; belum dipanggil saat mount — pastikan default form tetap konsisten.
- `GET /metering/stats` mengembalikan bentuk respons berbeda saat kosong (`appsWithMetering`) vs terisi (`appsCount`).

---

## Ringkasan Eksekusi Akhir

| # | Item | Status | Keterangan |
|---|------|:------:|------------|
| B4 | Paging di client | ✅ FIXED | Bar pagination terpasang; search/filter masih per-halaman |
| P3 | Engine metering/usage | 🟡 PARTIAL | Engine jalan; `freeAllowance` diabaikan, endpoint publik, stats terlalu luas |
| P1 | Engine recurring/trial | 🟡 PARTIAL | Renew manual ada; tanpa pembayaran & tanpa scoping owner |
| P2 | Eksekusi trial di checkout | 🟡 PARTIAL | Trial jalan, tetapi abuse free-credit tanpa auth (N2) |
| P4/P5 | Provisioning + UI form | 🟡 PARTIAL | UI + email ada; API key tidak dipersist/divalidasi |
| U1 | Konsolidasi 4 halaman finansial | ✅ FIXED | Pembagian peran didokumentasikan & ditegaskan |
| N1 | Regresi email fulfillment | ❌ BELUM | ISO string ke `formatDate(Date)` |
| N2 | Trial abuse kredit gratis | ❌ BELUM | Celah kritis tanpa autentikasi |
| N3 | Renew IDOR + bypass billing | ❌ BELUM | Tidak di-scope ke builder |
| N4 | Typecheck server | ❌ BELUM | `includedUnits` tak dikenal |

> Status berdasarkan verifikasi kode dan pengujian otomatis (18 Sep 2026). `bun test` 82 pass / 0 fail ✅, tetapi `tsc --noEmit` ❌ dan ditemukan regresi email pada jalur pembayaran. Prioritas perbaikan: **N2 → N1 → N3 → N4 → sisa P1–P5**.