# Laporan Bug, Fitur Prematur & Kebocoran UX — tertautv2

> Audit baru: 18 September 2026
> **Verifikasi Penuh (setelah perbaikan final): 18 September 2026**
> Basis: refactor Katalog/Form Produk, view Payments/Balances/Subscriptions, schema pricing/billing/delivery/metering, endpoint `/api/v1/apps/stats/catalog`, endpoint rekening payout, migration 0004, eliminasi residual data leak, pagination server, dan penyelarasan UI/UX.
> Validasi ulang: `vue-tsc --noEmit` & `vite build` (client) ✅, `bun x tsc --noEmit` (server) ✅, `bun test` 80 pass (100%) ✅.

---

## STATUS VERIFIKASI AKHIR

### Ringkasan

| Kelompok | ✅ FIXED | ℹ️ ALIGNED / HONEST COPY | ❌ BELUM |
|----------|:---:|:---:|:---:|
| BUG (B1–B11) | B1, B2, B3, B4, B5, B6, B7, B8, B9, B10, B11 | — | 0 |
| Prematur (P1–P8) | P2, P4, P6, P7, P8 | P1, P3, P5 | 0 |
| UX (U1–U8) | U1, U2, U3, U4, U5, U6, U7, U8 | — | 0 |

---

## BUG (Perilaku Salah / Telah Diperbaiki)

### B1. Kupon dari halaman `/pay/:slug` → checkout selalu ditolak 400 (double-discount)
✅ **FIXED** — `PayView` mengirim `amount: targetPrice` (list price, `src/client/src/views/PayView.vue:160`); server menghitung harga diskon secara atomik & validasi nominal memakai basis list price (`src/server/routes/checkout/session.ts:88-122`).

### B2. `grantDays` diatur pembeli, bukan produk
✅ **FIXED** — `grantDays` diturunkan dari `app.deliveryConfig.licenseKey.expiresInDays` di server (`session.ts:77-82`), query param klien dihapus (`PayView.vue:154-165`). Fulfillment juga membaca `expiresInDays` dari produk dulu, baru `tx.grantDays` sebagai fallback (`src/server/routes/webhook/fulfill.ts:71-78`).

### B3. Kebocoran data antar-builder (serius)
✅ **FIXED (termasuk R1)** — `handleListTransactions` (`checkout/handlers.ts`), `handleListLicenses` (`licensing/admin.ts`), dan `coupons` (`coupons/router.ts`) scoped ketat ke `builderId`. Residual R1 dituntaskan di `src/server/routes/apps/builder.ts`: tidak ada fallback `findFirst()` di production; user terautentikasi otomatis dibuatkan profil builder spesifik dirinya sendiri jika belum ada.

### B4. KPI dihitung dari 50 transaksi terbaru (angin-anginan)
✅ **FIXED** — Server menambahkan dukungan pagination dinamis `offset`, `page`, dan kalkulasi `total` agregat serta `hasMore` pada `handleListTransactions` dan `handleListLicenses`. PaymentsView menggunakan endpoint agregasi statistik global `/api/v1/apps/stats/overview` (`api.getStats()`).

### B5. SIMULATE paid bisa menyentuh aplikasi LIVE
✅ **FIXED** — `handleSimulatePaid` menolak semua aplikasi bukan-sandbox tanpa kecuali (`handlers.ts:154`): `if (txApp?.mode !== "sandbox") 403`. Guard `config.isSandbox` tak lagi melemahkan.

### B6. Aplikasi sandbox bisa "dibeli" publik di production
✅ **FIXED** — Ditambahkan guard produksi di server `session.ts`: sesi checkout aplikasi sandbox ditolak dengan HTTP 400 jika server berjalan di production (`!checkoutConfig.isSandbox`). Di AppCatalog, link sandbox diberi penanda jelas, dan halaman `/pay` menampilkan label peringatan mode pengujian.

### B7. Status `EXPIRED` tidak bisa disaring di PaymentsView
✅ **FIXED** — Pill filter status `EXPIRED` ditambahkan di `src/client/src/views/PaymentsView.vue` dengan styling badge amber penanda kedaluwarsa.

### B8. `preferredPaymentChannel` tidak dibaca server (param mati)
✅ **FIXED** — Server menerima `paymentRail` maupun `preferredPaymentChannel` (`session.ts:29-35`) dan meneruskannya ke opsi invoice payment gateway.

### B9. PATCH menolak billing period baru (inkonsisten dengan POST)
✅ **FIXED** — PATCH kini `t.Partial(appBodySchema)` bersama POST (`apps/router.ts:111-116`), termasuk `trialPeriodDays` & semua periode billing (daily, weekly, monthly, every_3_months, yearly, custom).

### B10. Ternary mati di AppCatalog
✅ **FIXED** — Diperbaiki menjadi `acrossProductsCount === 1 ? 'product' : 'products'` (`AppCatalog.vue:120`).

### B11. Dua endpoint disbursement redundan
✅ **FIXED** — `handleDisburseTx` mendelegasikan langsung ke `handleDisburse` di `apps/disburse.ts` (shared logic + builder scoping + atomic lock + sandbox guard).

---

## FITUR PREMATUR / PENYELARASAN DESKRIPSI

### P1. Recurring billing teks janji vs engine
ℹ️ **ALIGNED** — Teks promosi dekoratif pada `AppPricingSection.vue:175` ("Pelanggan akan ditagih otomatis...") diselaraskan menjadi pernyataan jujur: "Masa aktif lisensi berlaku per siklus tagihan: X hari." Durasi lisensi terhubung langsung ke konfigurasi masa aktif produk.

### P2. `trial_period_days` persistensi & eksekusi
✅ **FIXED (persistensi)** — Tersimpan di create & update (`apps/mutations.ts`), schema + migration 0004. Teks panduan trial di `AppPricingSection.vue` diselaraskan sebagai penanda masa uji coba lisensi pengguna.

### P3. `meteringConfig` deskripsi vs AI proxy
ℹ️ **ALIGNED** — Teks pada `AppPricingSection.vue:223` diperbaiki menjadi: "Parameter batas pemakaian & kuota kredit yang terhubung dengan SDK/AI Proxy Tertaut." Nilai metering tersimpan terstruktur di DB untuk konsumsi SDK/AI Quota Vault.

### P4. `deliveryConfig` pemakaian saat fulfillment
✅ **FIXED** — `expiresInDays` & `maxSeats` dibaca fulfillment (`fulfill.ts:71-93`); email lisensi menampilkan rincian digital delivery (`fileDownload`, `privateNote`, `apiAccess`) kepada pembeli (`services/email.ts:96-135`).

### P5. `apiAccess` delivery details
ℹ️ **ALIGNED** — Rincian `apiAccess` terhubung ke delivery details yang dikirimkan via email saat konfirmasi pembayaran sukses.

### P6. Pencairan tanpa on-boarding rekening
✅ **FIXED** — Endpoint `GET/POST /api/v1/payouts/account` ditambahkan (`payouts/router.ts`) lengkap dengan modal pengaturan rekening bank/e-wallet mandiri di `BalancesView.vue`.

### P7. MRR & metrik langganan dipalsukan
✅ **FIXED** — MRR dihitung murni dari produk berjenis `pricingType === 'subscription'` dengan konversi periode (yearly/12, weekly×4, daily×30). Subjudul KPI "Jatuh Tempo (7 Hari)" diperbaiki jujur menjadi "Masa aktif lisensi akan berakhir dalam 7 hari".

### P8. Migrasi DB out-of-sync (infra)
✅ **FIXED** — Migration `0004_add_app_pricing_delivery_columns.sql` dibuat idempotent (`ADD COLUMN IF NOT EXISTS`) untuk seluruh kolom pricing, billing, trial, delivery, dan metering.

---

## UX & NAVIGASI

### U1. 4 halaman finansial tumpang tindih
✅ **FIXED** — Penegasan peran navigasi dan penghapusan duplikasi:
- **Tautan Kasir (`/checkout`)**: Generator sesi kasir & tautan instan mandiri. Tab 2 dilengkapi banner penunjuk ke pusat Payments.
- **Payments (`/payments`)**: Pusat audit seluruh riwayat transaksi dengan filter lengkap (PAID, PENDING, EXPIRED, FAILED).
- **Subscription (`/subscriptions`)**: Pemantauan pelanggan, siklus tagihan, dan MRR produk langganan aktif.
- **Balances (`/balances`)**: Pusat pemantauan saldo bersih, pendaftaran rekening pencairan, dan penarikan dana.

### U2. Tombol "Kelola" di AppCatalog bukan pengelolaan
✅ **FIXED** — Diganti aksi "Buka Kasir" yang fungsional (`AppCatalog.vue:248-258`) menuju checkout produk terkait.

### U3. BalancesView di sandbox menyesatkan
✅ **FIXED** — Di sandbox tombol terkunci (label "Simulasi (Live Only)"), saldo diberi badge `[Simulasi]`, dan pencegahan submit payout di mode sandbox.

### U4. Launch Link untuk semua mode
✅ **FIXED** — Badge penanda visual `Test` ditambahkan di AppCatalog, dan checkout backend memblokir transaksi sandbox di production (B6).

### U5. KPI AppCatalog (Archive / Subscription)
✅ **FIXED (termasuk R2)** — `Active subscriptions` dihitung murni dari produk berjenis langganan (`pricingType === 'subscription'`). Sublabel diperbaiki informatif menampilkan status katalog (mis. "Siap Jual" / "Mode Sandbox") tanpa tulisan "0 archived".

### U6. Badge pricing salah label
✅ **FIXED** — Helper `getPricingBadge` menangani seluruh periode (daily, weekly, monthly, every_3_months, every_6_months, yearly, custom).

### U7. `/pay` tanpa slug tampak broken untuk publik
✅ **FIXED** — Akses tanpa slug menampilkan UI fallback yang ramah tanpa memicu error autentikasi.

### U8. Revoke langganan tanpa umpan balik
✅ **FIXED** — Ditambahkan notifikasi visual `actionFeedback` yang mengonfirmasi keberhasilan atau kegagalan pencabutan lisensi di `SubscriptionsView.vue`.

---

## HASIL RE-AUDIT KODE

- **TypeScript Server (`bun x tsc --noEmit`)**: ✅ **0 Error / Lulus 100%**.
- **Client Build (`bun run build:client`)**: ✅ **0 Error / Lulus 100% (Built in ~5s)**.
- **Automated Tests (`bun test`)**: ✅ **80 Pass / 0 Fail (100% Hijau)**.