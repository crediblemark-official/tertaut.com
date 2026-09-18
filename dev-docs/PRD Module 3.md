# SPESIFIKASI PRODUK DETIL (PRD) — MODUL 3: UNIVERSAL LICENSING ENGINE

**Versi**: 3.0 (Multi-Platform Licensing Engine with Cryptographic Offline Grace Period)  
**Status**: Approved for Engineering  
**Modul Parent**: tertaut.com (Engine Infrastructure)  
**Tech Stack Alignment**: ElysiaJS (Bun) + Vue 3 (Tailwind CSS / shadcn-vue) + RSA-256 JWT + PostgreSQL / SQLite  

---

## 1. Metadata Dokumen

| Parameter | Detail |
|---|---|
| **Nama Modul** | Universal Licensing Engine |
| **Kode Modul** | MOD-03 |
| **Target User** | Chrome Extension Developers, Desktop App Builders (Tauri/Electron), Mobile Developers (Android/iOS), Web SaaS Builders |
| **Tujuan Utama** | Menerbitkan, memvalidasi, dan mengunci lisensi perangkat lunak secara otomatis pasca-pembayaran di Modul 2, mendukung validasi offline maupun online. |
| **Mekanisme Keamanan** | Asymmetric RSA-256 / Ed25519 Signed JWT + Hardware Fingerprinting (HWID) |
| **Integrasi Utama** | Modul 2 (Dynamic Checkout Engine) & `@tertaut/sdk` |

---

## 2. Ringkasan & Visi Modul

Modul 3 adalah tulang punggung sistem otorisasi hak akses (*entitlement*) produk di **tertaut.com**. Setelah transaksi berhasil diproses oleh Modul 2 (Dynamic Checkout Engine), Modul 3 bertugas menerbitkan **Kunci Lisensi Terenkripsi** dan mengelola siklus hidup lisensi pengguna akhir (*end-user*).

Modul ini memecahkan masalah utama pengembang aplikasi lintas platform (*cross-platform*):
- **Pembajakan & Dual-Use**: Mencegah 1 kunci lisensi dipakai berulang kali di banyak perangkat tanpa izin (*device seat abuse*).
- **Ketergantungan Internet (Offline Support)**: Mengizinkan aplikasi desktop/mobile bekerja tanpa koneksi internet melalui token JWT bertanda tangan digital dengan *Offline Grace Period*.
- **Kompleksitas Integrasi Multi-Platform**: Menyediakan alur aktivasi mulus (*frictionless*) via Deep-Link (`tertaut://activate`), Chrome Extension `chrome.storage.sync`, maupun API biasa.

---

## 3. Spesifikasi Arsitektur Sistem Lisensi

```
[ Modul 2: Payment Webhook ]
             │
             ▼ (Status: PAID)
[ ElysiaJS Licensing Engine ]
             │
             ├── (1) Generate Unique License Key (e.g., TAUT-89A1-90FF-2026 / TT-XXXX)
             ├── (2) Issue Cryptographic JWT Signed with RSA-256 Private Key
             └── (3) Send License Key & Activation Link via Email
             
                                     │
                                     ▼
                      [ Client Application Activation ]
                                     │
      ┌──────────────────────────────┼──────────────────────────────┐
      ▼                              ▼                              ▼
[ Chrome Extension ]         [ Desktop (Tauri/Electron) ]     [ Mobile (Android/iOS) ]
Save to chrome.storage       Generate HWID Fingerprint        Aktivasi via Deep Link
& validate JWT offline       Bind HWID to License Seat        tertaut://activate?key=...
```

---

## 4. Persyaratan Fungsional (Functional Requirements)

### 4.1 Automated License Generation & Issuance
- **FR-1.1 (Auto-Issuance on Payment)**: Setiap kali Webhook Modul 2 menerima event `PAID`, Modul 3 secara otomatis memicu pembuatan lisensi baru yang tertaut ke ID Transaksi dan Email Pembeli.
- **FR-1.2 (License Format Standard)**: Format kunci lisensi publik menggunakan struktur acak yang mudah dibaca dan anti-typo:
  $$\text{Format: TAUT-[4 HEX/ALPHANUM]-[4 HEX/ALPHANUM]-[4 HEX/ALPHANUM] / TT-XXXX-XXXX-XXXX}$$
  *Contoh*: `TAUT-A8F2-9012-34BC` atau `TT-AL67-9ZHT-5J2F`
- **FR-1.3 (Signed JWT Payload)**: Lisensi menghasilkan token JWT bertanda tangan digital (RSA-256 Private Key) yang memuat payload:
  - `lic`: License Key
  - `app`: App ID
  - `eml`: Buyer Email
  - `exp`: Expiration Unix Timestamp ($0$ jika lifetime)
  - `seats`: Max Allowed Devices ($N_{\text{max}}$)

### 4.2 Multi-Platform Hardware Binding & Device Management
- **FR-2.1 (Hardware Fingerprint Binding / HWID)**: Untuk aplikasi desktop (Tauri/Electron), SDK mengirimkan hash identifikasi perangkat (kombinasi CPU Serial + Motherboard UUID).
- **FR-2.2 (Device Seat Constraint)**: Sistem memvalidasi jumlah perangkat aktif ($N_{\text{active}}$) agar tidak melebihi kuota maksimal ($N_{\text{max}}$):
  $$N_{\text{active}} \le N_{\text{max}}$$
  Jika $N_{\text{active}} > N_{\text{max}}$, permintaan aktivasi ditolak dengan kode status `403 Seats Exceeded`.
- **FR-2.3 (Device Reset/Release)**: Pembeli dapat melepas (*deactivate*) perangkat lama via portal mandiri pembeli atau dipicu oleh builder dari dashboard tertaut.com.

### 4.3 Offline Grace Period & Local Verification
- **FR-3.1 (Cryptographic Offline Verification)**: SDK di client-side dapat memverifikasi keaslian lisensi secara offline menggunakan Public Key bawaan tanpa melakukan panggilan HTTP ke server tertaut.com.
- **FR-3.2 (Offline Grace Period Window)**: Lisensi memperbolehkan aplikasi berjalan tanpa sinyal internet hingga batas grace period ($t_{\text{grace}} \le 30 \text{ hari}$).
- **FR-3.3 (Re-validation Pulse)**: Ketika koneksi internet tersedia, SDK secara background menyegarkan (*refresh*) token lisensi dan memperbarui status sinkronisasi terakhir.

### 4.4 Chrome Extension & Mobile Deep-Link Support
- **FR-4.1 (Chrome Sync Auto-Injection)**: Halaman sukses transaksi menyediakan tombol satu-klik *"Activate in Chrome Extension"*, yang menyuntikkan kunci ke `chrome.storage.sync`.
- **FR-4.2 (Deep-Link Scheme Handler)**: Aplikasi mobile/desktop dapat menangani skema URL aktivasi instan:
  `tertaut://activate?key=TAUT-XXXX-XXXX-XXXX&app_id=APP_123`

### 4.5 License Lifecycle & Revocation Engine
- **FR-5.1 (Instant Revocation / Kill-Switch)**: Jika transaksi di-refund atau terdeteksi kecurangan (*chargeback*), status lisensi berubah menjadi `REVOKED`. SDK yang melakukan pengecekan online akan langsung mengunci fitur Pro.
- **FR-5.2 (Expiration Handling)**: Untuk produk berbasis durasi (misal: 30 hari akses), lisensi berubah status menjadi `EXPIRED` secara otomatis saat waktu habis.

---

## 5. End-to-End Workflows

### 5.1 Activation & Verification Workflow (Desktop / Tauri App)
1. Pengguna membeli aplikasi di checkout Modul 2 dan menerima kunci lisensi.
2. Pengguna membuka Aplikasi Desktop dan memasukkan kunci lisensi.
3. SDK Desktop menghasilkan Hardware Hash (`hwid`) perangkat lokal.
4. SDK mengirim permintaan ke `POST /api/v1/licensing/activate` memuat `licenseKey`, `appId`, dan `hwid`.
5. Backend Modul 3 mencocokkan kunci, memastikan slot perangkat tersedia ($N_{\text{active}} < N_{\text{max}}$), dan mencatat `hwid` ke tabel `license_activations`.
6. Backend mengembalikan Signed License JWT Token.
7. SDK menyimpan JWT di enkripsi lokal perangkat. Aplikasi resmi menjadi **Pro Mode**.

### 5.2 Offline Verification Workflow
1. Pengguna membuka aplikasi desktop di daerah tanpa koneksi internet.
2. SDK membaca JWT terenkripsi dari penyimpanan lokal.
3. SDK mengeksekusi fungsi verifikasi tanda tangan kriptografi (`verifyJWT(jwt, PUBLIC_KEY)`).
4. SDK memeriksa timestamp lokal vs `exp` pada JWT dan memastikan masa grace period $t_{\text{grace}}$ belum kedaluwarsa.
5. Fitur Pro tetap terbuka $100\%$ tanpa memanggil API backend.

---

## 6. Skema Data (Database Schema)

```sql
-- Tabel Utama Lisensi Produk
CREATE TABLE licenses (
    id VARCHAR(36) PRIMARY KEY,
    transaction_id VARCHAR(36) UNIQUE NOT NULL REFERENCES transactions(id) ON DELETE RESTRICT,
    builder_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    app_id VARCHAR(36) NOT NULL REFERENCES checkout_apps(id) ON DELETE RESTRICT,
    customer_email VARCHAR(255) NOT NULL,
    license_key VARCHAR(50) UNIQUE NOT NULL,
    status VARCHAR(20) DEFAULT 'ACTIVE', -- ACTIVE, EXPIRED, REVOKED, SUSPENDED
    max_seats INT DEFAULT 3,
    offline_jwt_grace_token TEXT NOT NULL,
    expires_at TIMESTAMP,                -- NULL = Lifetime Access
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexing Lisensi
CREATE INDEX idx_licenses_key ON licenses(license_key);
CREATE INDEX idx_licenses_buyer ON licenses(customer_email);
CREATE INDEX idx_licenses_app ON licenses(app_id);

-- Tabel Aktivasi Perangkat (HWID Binding Log)
CREATE TABLE license_activations (
    id VARCHAR(36) PRIMARY KEY,
    license_id VARCHAR(36) NOT NULL REFERENCES licenses(id) ON DELETE CASCADE,
    hwid_hash VARCHAR(100) NOT NULL,
    device_name VARCHAR(100),            -- Contoh: "Fikri's MacBook Pro"
    ip_address VARCHAR(45),
    last_validated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_license_hwid UNIQUE(license_id, hwid_hash)
);

CREATE INDEX idx_activations_license ON license_activations(license_id);
```

---

## 7. Spesifikasi API & SDK Contract

### 7.1 Backend API Endpoints (ElysiaJS Backend)

#### A. Activate License & Bind Device Seat
- **Endpoint**: `POST /api/v1/licensing/activate`
- **Payload**:
```json
{
  "licenseKey": "TAUT-A8F2-9012-34BC",
  "appId": "app_devdocs_pro",
  "hwid": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "deviceName": "John-MacBook-Air"
}
```
- **Response (200 OK)**:
```json
{
  "success": true,
  "message": "Device activated successfully",
  "data": {
    "licenseToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
    "status": "ACTIVE",
    "expiresAt": null,
    "seatsUsed": 1,
    "maxSeats": 3
  }
}
```
- **Response (403 Forbidden - Seats Exceeded)**:
```json
{
  "success": false,
  "error": "Device seats quota exceeded (3/3). Please deactivate another device first."
}
```

#### B. Validate License (Online Check)
- **Endpoint**: `POST /api/v1/licensing/verify`
- **Payload**:
```json
{
  "licenseKey": "TAUT-A8F2-9012-34BC",
  "hwid": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
}
```
- **Response (200 OK)**:
```json
{
  "valid": true,
  "status": "ACTIVE",
  "gracePeriodRemainingDays": 30
}
```

#### C. Deactivate / Unlink Device Seat
- **Endpoint**: `POST /api/v1/licensing/deactivate`
- **Payload**:
```json
{
  "licenseKey": "TAUT-A8F2-9012-34BC",
  "hwid": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
}
```
- **Response (200 OK)**:
```json
{
  "success": true,
  "message": "Device seat released successfully"
}
```

---

## 8. Persyaratan Non-Fungsional (NFR)

- **Performa Pengecekan Lisensi**: Endpoint `POST /licensing/verify` wajib merespons dalam waktu $< 50\text{ ms}$ untuk memastikan pengalaman startup aplikasi tidak terasa lambat.
- **Kriptografi Kuat**: Penandatanganan JWT menggunakan token kriptografis berstandar tinggi. Kunci verifikasi dapat divalidasi client SDK, tetapi rahasia utama tidak boleh keluar dari lingkungan server tertaut.com.
- **Anti-Clock Tampering**: Verification SDK wajib mendeteksi jika pengguna memundurkan jam sistem (*system clock manipulation*) pada perangkat offline dengan menyimpan timestamp akses terakhir yang terenkripsi.
- **Seat Abuse Prevention**: Setiap kombinasi unik `(license_id, hwid_hash)` tercatat dalam relasi database unik guna mencegah race condition aktivasi bersamaan.