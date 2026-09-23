# Studi Dokumentasi Resmi DANA — Referensi API & Gap Analysis (2026-09-21)

> Sumber: [DANA API Documentation v2](https://dashboard.dana.id/api-docs-v2/) (diakses 21 Sep 2026) dan repo SDK resmi [dana-id/dana-node](https://github.com/dana-id/dana-node).
> Dokumen ini melengkapi `DANA_INTEGRATION.md` (yang fokus pada proses UAT/go-live). Di sini fokusnya: **spesifikasi teknis API sesuai dokumentasi resmi** dan **pemetaan ke implementasi tertaut.com**.
>
> Tips akses: situs docs DANA adalah SPA berat yang sering timeout via `curl`/fetch biasa. Gunakan `https://r.jina.ai/<URL-halaman>` untuk membaca konten halaman sebagai teks, atau baca repo SDK `dana-id/dana-node` (dokumentasi per-API ada di bagian "Documentation" README-nya).

---

## 1. Arsitektur Produk API DANA

| API                                                                                                                      | Keterangan                                                                                                                 | Status di tertaut.com                               |
| ------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| **Gapura Payment Gateway**                                                                                               | Hosted Checkout (`REDIRECT`) & Custom Checkout (`API`). API: Consult Pay, Create Order, Finish Notify, Query/Cancel/Refund | ✅ dipakai via `dana-node` SDK (`services/dana.ts`) |
| **Disbursement to Bank / Balance**                                                                                       | Payout ke rekening bank: Transfer to Bank, Account Inquiry, Check Balance, Transfer Notify                                 | ⚠️ dipakai sebagian (`transferToBank` saja)         |
| **Merchant Management**                                                                                                  | Shop, Division (sub-merchant)                                                                                              | ❌ belum dipakai                                    |
| **DANA Widget** (Binding/Non-Binding), **QRIS (Acquirer)**, **OTC**, **Remittance**, **Subscription**, **Digital Goods** | Solusi lain                                                                                                                | ❌ belum dipakai                                    |

Standar SNAP (Bank Indonesia) yang relevan:

- Service code: **54** = Create Order, **56** = Finish Notify (terlihat dari response code `2005400` / `2005600`, dan `54xx`/`56xx`).
- Expected timeout server: **8 detik**.
- Format uang ISO-4217: string 2 desimal → `"10000.00"` untuk IDR 10.000.
- Waktu: `YYYY-MM-DDTHH:mm:ss+07:00` (WIB, GMT+7).

---

## 2. Alur Gapura Custom Checkout (yang diikuti `checkout/session.ts`)

```
Consult Pay → Create Order → tampilkan VA/QRIS/redirect ke buyer
    → buyer bayar di DANA
    → (a) Finish Notify webhook ke server  (sumber kebenaran status)
    → (b) Redirect browser ke PAY_RETURN
```

Aturan penting dari docs:

- `urlParams` (Create Order) **wajib** memuat type `NOTIFICATION` + `PAY_RETURN`, masing-masing dengan `isDeeplink`. → ✅ kode sudah mengirim keduanya (`services/dana.ts`).
- Sandbox: `validUpTo` **≤ 30 menit** dari waktu request. → ✅ kode pakai 20 menit (`formatWibIso`).
- `partnerReferenceNo` untuk QRIS **maksimal 25 karakter**. → ✅ kode `.slice(0, 25)`.
- **Idempotency key Create Order = `merchantId + partnerReferenceNo`**: retry setelah timeout **wajib** memakai `partnerReferenceNo` yang sama; jika payload berbeda dengan key sama → `4045418` (inconsistent request).
- Sandbox `payMethod` yang tersedia: `BALANCE, CREDIT_CARD, DEBIT_CARD, VIRTUAL_ACCOUNT, NETWORK_PAY`; `payOption`: `CARD, QRIS, BRI, PANIN, CIMB, BTPN`. (Perhatikan: opsi bank sandbox terbatas — ini alasan mapping `optionMap` di `services/dana.ts` memaksa `VIRTUAL_ACCOUNT_BRI` saat sandbox.)
- `scenario` di `additionalInfo.order`: wajib `API` (custom checkout, merchant punya UI sendiri) atau `REDIRECT` (hosted page DANA).
- Untuk QRIS wajib `externalStoreId` (conditional `Y:= Implement QRIS Payment Method`). → ✅ kode mengirim saat rail qris.

---

## 3. Finish Notify (`POST /v1.0/debit/notify`) — webhook pembayaran

Headers yang dikirim DANA: `Content-Type`, `X-TIMESTAMP` (WIB), `X-SIGNATURE`, `ORIGIN`, `X-PARTNER-ID`, `X-EXTERNAL-ID`, `CHANNEL-ID`.

Field body penting:

| Field                                                             | Arti                                                                        |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `originalPartnerReferenceNo`                                      | ID transaksi di sistem merchant (= `externalId` kita `tt_...`)              |
| `originalReferenceNo`                                             | ID transaksi di sistem DANA                                                 |
| `originalExternalId`                                              | X-EXTERNAL-ID dari header saat Create Order                                 |
| `merchantId` / `subMerchantId` / `externalStoreId`                | Identitas merchant/store                                                    |
| `amount.value/currency`                                           | Nominal transaksi (2 desimal)                                               |
| `latestTransactionStatus`                                         | **`00` = Success**, `05` = Cancelled/expired                                |
| `transactionStatusDesc`                                           | Deskripsi status                                                            |
| `additionalInfo.paymentInfo.payOptionInfos[].payMethod/payOption` | Metode pembayaran yang dipakai (mis. `NETWORK_PAY` + `NETWORK_PAY_PG_QRIS`) |

Respons yang diharapkan DANA (HTTP 200):

```json
{ "responseCode": "2005600", "responseMessage": "Successful" }
```

Pemetaan ke `routes/webhook/dana.ts`:

- ✅ Deteksi format SNAP (`latestTransactionStatus`) vs legacy (`orderStatus`) sudah benar; `00` → success, `05`/`06` → expired/failed.
- ✅ Ekstraksi identifier menjangkau `originalPartnerReferenceNo` & `originalReferenceNo`.
- ✅ Ack SNAP `2005600` dikembalikan untuk jalur SNAP; legacy mempertahankan payload kaya.
- ✅ Skenario UAT `11011` (sukses) / `11012` (error) di-handle khusus di sandbox — konsisten dengan skenario UAT resmi.

---

## 4. ⚠️ Verifikasi Signature Webhook (GAP #1 — paling kritis)

Format `X-SIGNATURE` SNAP (docs: _Authentication Asymmetric SNAP_):

```
stringToSign = <HTTP METHOD> + ":" + <RELATIVE PATH URL> + ":" +
               Lowercase(HexEncode(SHA-256(minified <HTTP BODY>))) + ":" +
               <X-TIMESTAMP>
```

- Diverifikasi dengan **DANA public key** (RSA-2048, SHA-256, hasil Base64) — BUKAN public key milik merchant.
- Header peserta: `X-TIMESTAMP` wajib disertakan saat verifikasi.
- SDK `dana-node` menyediakan `WebhookParser.parseWebhook(httpMethod, relativePathUrl, headers, body)` yang melakukan semuanya; ia melempar error jika signature tidak valid. Docs menekankan: _"Never trust webhook data unless it passes verification."_
- Untuk request keluar (Create Order dll), signature dibuat dari `X-CLIENT-KEY|X-TIMESTAMP` (asymmetric) + field di atas — SDK menanganinya otomatis.

**Kondisi di kode:** `DanaService.verifyWebhook()` hanya memakai `WebhookParser` bila dipanggil dengan `options.method` + `options.path`. Kedua pemanggil di `routes/webhook/dana.ts` (baris ±65 dan ±187) **tidak meneruskan** argumen tersebut, sehingga:

1. Parser SNAP tidak pernah dieksekusi;
2. Kode jatuh ke fallback `crypto.createVerify("SHA256").update(body)` yang memverifikasi signature **terhadap raw body saja** — bukan format `method:path:hash:timestamp` DANA;
3. Webhook asli production dari DANA akan gagal verifikasi (atau lebih buruk: policy fallback membuat verifikasi bisa terlewati di kondisi tertentu, mis. sandbox tanpa public key).

**Rekomendasi perbaikan:** teruskan `method: "POST"` dan `path` yang sesuai rute (`/v1.0/debit/notify` atau `/v1.0/emoney/transfer-bank-notify.htm`) dari handler ke `verifyWebhook`, pastikan `DANA_PUBLIC_KEY` terpasang di production, dan kelola `X-TIMESTAMP` (parser SDK yang menanganinya).

---

## 5. Disbursement to Bank — flow resmi (GAP #2)

Urutan resmi dari docs:

1. **Check Disbursement Account API** — cek saldo merchant deposit account sebelum transfer.
2. **Transfer to Bank Account Inquiry API** — validasi rekening tujuan ke bank (request: `customerNumber`, `beneficiaryAccountNumber`, `amount`, `additionalInfo.fundType`, `additionalInfo.beneficiaryBankCode`).
3. **Transfer to Bank API** — eksekusi transfer.
4. Respons awal biasanya **`2024300` "Request in Progress"** — transfer belum final.
5. Bila `needNotify == true`, DANA memanggil **Transfer to Bank Notify API** webhook (`/v1.0/emoney/transfer-bank-notify.htm`) dengan status final.

**Kondisi di kode (`DanaService.createDisbursement`):**

- Tidak ada inquiry & tidak ada cek saldo sebelum transfer.
- Status di-hardcode `COMPLETED` untuk semua respons SDK yang tidak throw, padahal DANA lazim membalas `2024300` (in-progress). Ledger bisa mencatat "sudah cair" padahal masih diproses.
- Webhook notify final sudah terdaftar di `snapBiWebhookRoutes` dan `handleDanaDisburseNotifyWebhook` sudah meng-update `disbursementStatus` — tetapi karena status awal langsung `COMPLETED`, update webhook-nya kehilangan peran (guard `inArray(disbursementStatus, ["PROCESSING","PENDING"])` tidak akan match).

**Rekomendasi:** map `2004300`/`2001800` → tetap validasi, `2024300` → `PROCESSING`, dan perlakukan webhook notify sebagai satu-satunya sumber status terminal (`COMPLETED`/`FAILED`). Tambahkan inquiry bila ingin menolak rekening salah sebelum transfer (mengurangi kasus dana tersendat).

---

## 6. Create Order — kepatuhan field (GAP #3 kecil)

Sudah sesuai: `amount.value` 2 desimal, `payOptionDetails[].transAmount`, `additionalInfo.mcc`, `envInfo.sourcePlatform: "IPG"`, `envInfo.orderTerminalType: "WEB"`, `additionalInfo.order.scenario`, `externalStoreId` untuk QRIS.

Perlu perhatian:

- Docs menandai `additionalInfo.order.buyer` **Required** dengan sub-field `externalUserId` **Required** — kode mengirim `buyer: {}` kosong. Validator production dapat menolak payload. Isi minimal `externalUserId` (mis. hash email buyer).
- Idempotency retry: jika `createOrder` timeout, **pakai `partnerReferenceNo` yang sama** — jangan generate externalId baru (saat ini retry dari user akan membuat session/externalId baru; tidak fatal, tapi boros order di sisi DANA).

---

## 7. Autentikasi & Kredensial (ringkas)

- Sandbox: daftar di `dashboard.dana.id/sandbox/` → dapat URL sandbox, Merchant ID, Client ID (= `X-PARTNER-ID`), Client Secret, Public Key (DANA), Private Key (merchant).
- Production: generate sendiri pasangan kunci RSA-2048 (`openssl genrsa` PKCS#1 → `pkcs8` untuk PKCS#8 → `rsa -pubout` untuk public key), upload **public key merchant** ke Merchant Portal. **DANA public key** (untuk verifikasi webhook) didapat dari docs/portal atau tim integrasi via Discord developer DANA.
- Env vars SDK `dana-node`: `ENV/DANA_ENV`, `X_PARTNER_ID`, `PRIVATE_KEY(_PATH)`, `DANA_PUBLIC_KEY(_PATH)`, `ORIGIN`, `CLIENT_SECRET` (wajib untuk Disbursement API), `X_DEBUG=true` menampilkan `additionalInfo.debugMessage` saat gagal.
- Kode `verifyWebhook` juga mendukung `signature` / `x-signature` / `X-SIGNATURE` — sesuai SNAP nama header resminya `X-SIGNATURE`.

---

## 8. Proses Go-Live (konteks operasional)

1. Sandbox: jalankan semua **mandatory scenario UAT** di _Integration Checklist_ (`dashboard.dana.id/sandbox/golive`). Test suite otomatis resmi: `github.com/dana-id/uat-script` (< 15 menit).
2. Tanda tangani **UAT Sign-Off Report** di portal (✅ sudah dilakukan 17 Sep 2026 — lihat `DANA_INTEGRATION.md`).
3. Devsite testing ASPI/SNAP (berjalan otomatis).
4. Submit pilot testing documents + verifikasi E2E (✅ arsip `pilot_testing_filled.zip`).
5. Production: pasang kredensial live + kunci (`.env`/Dokploy), lalu aktifkan.

---

## 9. Ringkasan Gap & Rekomendasi

| #   | Temuan                                                                                                                                                  | Dampak                                                                                | Prioritas                            |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------ |
| 1   | Verifikasi `X-SIGNATURE` SNAP tidak pernah memakai `WebhookParser` (handler tidak meneruskan `method`/`path`); fallback memverifikasi format yang salah | Webhook production ditolak ATAU verifikasi bisa terlewati → risiko keamanan finansial | 🔴 Kritis — perbaiki sebelum go-live |
| 2   | `createDisbursement` hardcode `COMPLETED`; tidak menghormati `2024300` in-progress; inquiry & cek saldo tidak dipakai                                   | Ledger pencarian dana tidak akurat; webhook final kehilangan fungsi                   | 🟠 Tinggi                            |
| 3   | `additionalInfo.order.buyer.externalUserId` (Required per docs) dikirim kosong                                                                          | Potensi penolakan Create Order di production                                          | 🟡 Sedang                            |
| 4   | Retry Create Order belum memanfaatkan idempotency key `merchantId+partnerReferenceNo`                                                                   | Order duplikat di sisi DANA saat retry                                                | 🟢 Rendah                            |

> Setelah perbaikan #1, wajib re-test UAT Finish Notify (nominal `11011` sukses, `11012` error, plus skenario signature unauthorized `4015600`) karena perilaku verifikasi akan berubah.
