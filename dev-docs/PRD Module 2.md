# SPESIFIKASI PRODUK DETIL (PRD) — MODUL 2: DYNAMIC CHECKOUT ENGINE & MOR PAYMENTS (XENDIT)

**Versi**: 3.0 (Standalone MoR Engine with Xendit Multi-Payment & Auto-Disbursement)  
**Status**: Approved for Engineering  
**Modul Parent**: tertaut.com (Engine Infrastructure)  
**Tech Stack Alignment**: ElysiaJS (Bun) + Vue 3 (Tailwind CSS / shadcn-vue) + Xendit API + PostgreSQL / SQLite  

---

## 1. Metadata Dokumen

| Parameter | Detail |
|---|---|
| **Nama Modul** | Dynamic Checkout Engine & Merchant of Record (MoR) Payments |
| **Kode Modul** | MOD-02 |
| **Target User** | Vibe Coders, Solo Builders, Indie Hackers, Cross-Platform Developers |
| **Tujuan Utama** | Memungkinkan builder menerima pembayaran QRIS, Virtual Account, dan E-Wallet secara instan tanpa perlu registrasi Payment Gateway (PG) atau mendirikan entitas hukum (PT/CV). |
| **Model Finansial** | Merchant of Record (MoR) — Platform Fee $5\%$ per transaksi sukses, $95\%$ diteruskan ke builder. |
| **Integrasi Utama** | Xendit Invoice API & Xendit Disbursement/Payout API |

---

## 2. Ringkasan & Visi Modul

Modul 2 adalah inti monetisasi finansial dari **tertaut.com**. Menggunakan pendekatan **Merchant of Record (MoR)**, tertaut.com bertindak sebagai penjual resmi secara hukum dan teknis terhadap pembeli akhir.

Hal ini membebaskan builder dari kerumitan:
- Pendaftaran Payment Gateway yang membutuhkan verifikasi entitas hukum (PT/CV).
- Penanganan rekonsiliasi, pajak transaksi, dan integrasi API pembayaran yang rumit.
- Pembuatan alur pencairan dana (*disbursement*) manual.

---

## 3. Spesifikasi Arsitektur Transaksi MoR

```
[ Buyer ] ────> (1) Klik "Beli" / Access Checkout
                     │
                     ▼
        [ tertaut.com Hosted Checkout ] ───(2) Create Invoice───► [ Xendit API ]
                     │                                                   │
                     │ (3) Bayar via QRIS / VA / E-Wallet                │
                     ▼                                                   │
        [ Buyer Pays Successfully ]                                      │
                     │                                                   │
                     │◄───────────── (4) Webhook Callback ───────────────┘
                     ▼
        [ ElysiaJS Webhook Handler ]
                     │
                     ├──► (5A) Split Balance:
                     │    ├── Platform Revenue = Amount * 0.05
                     │    └── Builder Net Balance = Amount * 0.95
                     │
                     ├──► (5B) Pemicu Modul 3: Penerbitan Lisensi JWT
                     │
                     └──► (5C) Trigger Auto-Disbursement (Jadwal / Threshold)
                                  │
                                  ▼
                         [ Xendit Disbursement API ] ───► [ Rekening Bank Builder ]
```

---

## 4. Persyaratan Fungsional (Functional Requirements)

### 4.1 Dynamic & Headless Checkout Links
- **FR-1.1 (Hosted Checkout Page)**: Sistem menyediakan halaman checkout publik di `tertaut.com/pay/:checkout_slug` atau via parameter URL dinamis (`tertaut.com/pay?app_id=...&amount=...`).
- **FR-1.2 (Dynamic Payload Ingestion)**: Checkout dapat menerima parameter transaksi langsung dari SDK/API, mencakup:
  - `amount` (Nominal transaksi dalam IDR)
  - `product_name` (Nama produk/akses)
  - `grant_days` (Masa aktif lisensi dalam hari, default: lifetime / 365 hari)
  - `redirect_url` (URL tujuan setelah pembayaran sukses)

### 4.2 Xendit Multi-Payment Integration
- **FR-2.1 (Multi-Rail Payment Support)**: Mendukung metode pembayaran lokal Indonesia via Xendit:
  - **QRIS**: GoPay, OVO, DANA, LinkAja, ShopeePay, BCA QRIS, dll.
  - **Virtual Account (VA)**: BCA, Mandiri, BRI, BNI, Permata, BSI.
  - **E-Wallet Direct**: OVO, ShopeePay, DANA.
- **FR-2.2 (Invoice Expiration & Auto-Cancel)**: Invoice pembayaran secara otomatis kadaluwarsa dalam waktu $15\text{ menit}$ (untuk QRIS) atau $24\text{ jam}$ (untuk Virtual Account) jika tidak dibayar.

### 4.3 Split Ledger & Fee Calculation Engine
- **FR-3.1 (Automated Platform Fee Calculation)**: Untuk setiap transaksi status `COMPLETED` / `PAID`, sistem menghitung pembagian dana:
  $$\text{Platform Fee} = \text{Gross Amount} \times 0.05$$
  $$\text{Builder Net Amount} = \text{Gross Amount} - \text{Platform Fee} \quad (95\%)$$
- **FR-3.2 (Ledger Record)**: Setiap transaksi mencatatkan riwayat keuangan yang tidak dapat diubah (*immutable transaction log*) ke tabel `transactions` dan memperbarui saldo builder.

### 4.4 Automated Builder Disbursement (Payouts)
- **FR-4.1 (Bank Account Configuration)**: Builder dapat mendaftarkan rekening bank lokal atau e-wallet (BCA, Mandiri, BRI, GoPay, OVO, dll.) pada dashboard tertaut.com.
- **FR-4.2 (Disbursement Trigger)**: Pencairan dana bersih (*Net Balance*) dapat dipicu secara:
  - **Otomatis (Scheduled/Threshold)**: Setiap kali saldo mencapai minimum $\ge \text{Rp } 50.000$ atau jadwal mingguan.
  - **Manual Request**: Dipicu langsung oleh builder via dashboard (*One-Click Disburse*).
- **FR-4.3 (Xendit Payout Execution)**: Sistem memanggil Xendit Disbursement API untuk mentransfer dana secara real-time ke rekening builder.

### 4.5 Live Transition from Smoke Test / Fake Door (Modul 1 Handoff)
- **FR-5.1 (Status Switch Handoff)**: Saat kampanye di Modul 1 dialihkan dari `smoke_test` / `ACTIVE_FAKEDOOR` ke `live` / `LIVE_CHECKOUT`, URL `/v/:slug` secara otomatis mengarahkan pengunjung ke alur checkout pembayaran aktif Modul 2.

---

## 5. End-to-End Workflows

### 5.1 Buyer Payment Workflow
1. Pembeli membuka `tertaut.com/pay/:slug` atau mengklik tombol "Beli" pada SDK.
2. Backend ElysiaJS memanggil Xendit Invoice API untuk menerbitkan sesi pembayaran unik.
3. Pembeli memilih metode pembayaran (misal: QRIS).
4. Pembeli memindai QRIS dan menyelesaikan pembayaran di aplikasi e-banking/e-wallet.
5. Xendit mengirimkan Webhook Callback ke server tertaut.com.
6. Sistem memverifikasi token Webhook, memperbarui status transaksi menjadi `PAID`, mencatat ledger, dan memicu pembuatan lisensi (Modul 3).
7. Pembeli di-redirect ke halaman sukses dan menerima kunci lisensi via email & layar.

### 5.2 Builder Payout Workflow
1. Builder memiliki Saldo Terkumpul (Net Balance) $\ge \text{Rp } 50.000$.
2. Builder menekan tombol "Withdraw Funds / Cairkan" di Dashboard tertaut.com.
3. Backend memvalidasi rekening tujuan dan memanggil Xendit Disbursement API (`POST /disbursements`).
4. Xendit memproses transfer bank secara real-time.
5. Xendit mengirimkan status konfirmasi disbursement $\rightarrow$ Status transaksi menjadi `COMPLETED` dan saldo tercatat resmi.

---

## 6. Skema Data (Database Schema)

```sql
-- Tabel Produk / Aplikasi Terdaftar untuk Checkout
CREATE TABLE checkout_apps (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    app_name VARCHAR(150) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    price DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    grant_days INT DEFAULT 0, -- 0 = Lifetime Access
    redirect_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexing Aplikasi
CREATE INDEX idx_checkout_apps_slug ON checkout_apps(slug);
CREATE INDEX idx_checkout_apps_user ON checkout_apps(user_id);

-- Tabel Transaksi Finansial (Ledger Transaksi)
CREATE TABLE transactions (
    id VARCHAR(36) PRIMARY KEY,
    app_id VARCHAR(36) NOT NULL REFERENCES checkout_apps(id) ON DELETE RESTRICT,
    builder_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    xendit_invoice_id VARCHAR(100) UNIQUE NOT NULL,
    xendit_external_id VARCHAR(100) UNIQUE NOT NULL,
    buyer_email VARCHAR(255) NOT NULL,
    gross_amount DECIMAL(12, 2) NOT NULL,
    platform_fee DECIMAL(12, 2) NOT NULL, -- 5%
    net_amount DECIMAL(12, 2) NOT NULL,    -- 95%
    payment_method VARCHAR(50),            -- QRIS, VA_BCA, EWALLET_OVO
    status VARCHAR(20) DEFAULT 'PENDING',  -- PENDING, PAID, EXPIRED, FAILED
    paid_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_transactions_builder ON transactions(builder_id);
CREATE INDEX idx_transactions_xendit_inv ON transactions(xendit_invoice_id);

-- Tabel Saldo & Payout Builder
CREATE TABLE builder_balances (
    builder_id VARCHAR(36) PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    accumulated_net_balance DECIMAL(12, 2) DEFAULT 0.00,
    withdrawn_balance DECIMAL(12, 2) DEFAULT 0.00,
    bank_code VARCHAR(50),                 -- BCA, MANDIRI, BNI, GOPAY
    account_number VARCHAR(100),
    account_holder_name VARCHAR(150),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabel Riwayat Disbursement (Pencairan Dana)
CREATE TABLE disbursements (
    id VARCHAR(36) PRIMARY KEY,
    builder_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    xendit_disbursement_id VARCHAR(100) UNIQUE NOT NULL,
    amount DECIMAL(12, 2) NOT NULL,
    bank_code VARCHAR(50) NOT NULL,
    account_number VARCHAR(100) NOT NULL,
    status VARCHAR(20) DEFAULT 'PENDING', -- PENDING, COMPLETED, FAILED
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 7. Spesifikasi API & Webhook Contract

### 7.1 Public API Endpoints (ElysiaJS Backend)

#### A. Create Checkout Invoice Session
- **Endpoint**: `POST /api/v1/checkout/session`
- **Payload**:
```json
{
  "appSlug": "fastmail-ai",
  "buyerEmail": "pembeli@gmail.com",
  "customAmount": 49000,
  "grantDays": 365,
  "redirectUrl": "https://situsbisnis.com/success"
}
```
- **Response (201 Created)**:
```json
{
  "success": true,
  "data": {
    "sessionId": "chk_9012ab34",
    "xenditInvoiceUrl": "https://checkout.xendit.co/web/65123abc...",
    "expiresAt": "2026-09-10T12:00:00Z"
  }
}
```

#### B. Xendit Webhook Handler (Invoice Paid)
- **Endpoint**: `POST /api/v1/checkout/webhook/xendit` (dan `/api/v1/webhooks/xendit/invoice`)
- **Headers**: `x-callback-token: {XENDIT_CALLBACK_TOKEN}`
- **Payload Contoh (Xendit Standard Payload)**:
```json
{
  "id": "65123abc...",
  "external_id": "tx_tertaut_897123",
  "status": "PAID",
  "amount": 49000,
  "payer_email": "pembeli@gmail.com",
  "payment_method": "QRIS",
  "paid_at": "2026-09-10T11:05:00.000Z"
}
```
- **Response (200 OK)**:
```json
{
  "status": "success",
  "message": "Transaction verified and balance updated"
}
```

#### C. Trigger Builder Payout (Disbursement)
- **Endpoint**: `POST /api/v1/checkout/disburse/:transactionId` (dan `POST /api/v1/payouts/trigger`)
- **Payload**:
```json
{
  "amount": 250000
}
```
- **Response (200 OK)**:
```json
{
  "success": true,
  "message": "Disbursement requested successfully",
  "data": {
    "disbursementId": "disb_7812903",
    "status": "COMPLETED"
  }
}
```

---

## 8. Persyaratan Non-Fungsional (NFR)
- **Idempotensi Webhook**: Endpoint `POST /webhooks/xendit/invoice` wajib menangani sifat idempotent. Jika Xendit mengirim callback berulang untuk invoice ID yang sama, sistem hanya memproses penambahan saldo & lisensi tepat 1 kali.
- **Webhook Security**: Wajib memvalidasi token rahasia `x-callback-token` pada setiap Webhook yang masuk dari Xendit untuk mencegah transaksi palsu.
- **Presisi Finansial**: Seluruh perhitungan nominal mata uang wajib menggunakan kalkulasi bulat (*integer* atau pembulatan presisi) untuk mencegah akumulasi *floating-point error*.
- **Auditability**: Setiap perubahan saldo wajib tercatat pada riwayat `transactions` atau `disbursements` untuk memudahkan rekonsiliasi audit keuangan.