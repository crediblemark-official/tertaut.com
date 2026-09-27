# Dokumentasi URL Demo Checkout & Pengajuan Audit Gateway

Halaman demo checkout pada Tertaut (`/demo/checkout/:slug?`) dirancang terpisah dari halaman checkout produksi (`/pay/:slug?`). Halaman ini digunakan khusus untuk **pengajuan audit mitra payment gateway**, peninjauan integrasi sandbox, dan pengujian alur pembayaran tanpa mempengaruhi konfigurasi gateway global platform.

---

## 1. Daftar URL Demo per Payment Gateway

### A. XenithPay (Pengajuan & Audit Mitra)

Digunakan untuk demonstrasi pembayaran QRIS dan Virtual Account (BNI, Mandiri, BRI, Permata) via XenithPay:

- **Produksi (Live Review)**:  
  `https://tertaut.com/demo/checkout/fastmail-ai?gateway=xenith`
- **Lokal (Development)**:  
  `http://localhost:5173/demo/checkout/fastmail-ai?gateway=xenith`

_(Alias parameter: `?gateway=xenithpay`)_

---

### B. DANA (Pengajuan DANA Enterprise / Merchant of Record)

Digunakan untuk demonstrasi pembayaran QRIS dan DANA Wallet:

- **Produksi (Live Review)**:  
  `https://tertaut.com/demo/checkout/fastmail-ai?gateway=dana`
- **Lokal (Development)**:  
  `http://localhost:5173/demo/checkout/fastmail-ai?gateway=dana`

---

### C. Xendit (Pengajuan & Sandbox Review)

Digunakan untuk demonstrasi QRIS dan Virtual Account Xendit:

- **Produksi (Live Review)**:  
  `https://tertaut.com/demo/checkout/fastmail-ai?gateway=xendit`
- **Lokal (Development)**:  
  `http://localhost:5173/demo/checkout/fastmail-ai?gateway=xendit`

---

## 2. Parameter URL Opsional

Selain `gateway`, URL demo mendukung parameter kustomisasi berikut:

| Parameter | Pilihan Nilai                             | Keterangan                                                |
| :-------- | :---------------------------------------- | :-------------------------------------------------------- |
| `gateway` | `xenith` / `xenithpay`, `dana`, `xendit`  | Menentukan antarmuka payment gateway                      |
| `rail`    | `qris`, `va`, `ewallet`, `card`, `retail` | Memilih default tab pembayaran yang terbuka               |
| `bank`    | `BNI`, `MANDIRI`, `BRI`, `PERMATA`, `BCA` | Memilih bank default jika memilih channel Virtual Account |
| `amount`  | Nilai angka (misal: `50000`)              | Mengubah nominal harga uji coba secara dinamis            |

### Contoh Kombinasi URL:

- Langsung ke VA BNI XenithPay:  
  `https://tertaut.com/demo/checkout/fastmail-ai?gateway=xenith&rail=va&bank=BNI`
- Langsung ke QRIS XenithPay:  
  `https://tertaut.com/demo/checkout/fastmail-ai?gateway=xenith&rail=qris`

---

## 3. Data Produk Demo (Fail-safe)

Halaman `/demo/checkout/fastmail-ai` memiliki data fallback otomatis produk **FastMail AI Summarizer** (Rp 49.000) sehingga halaman akan selalu berhasil dibuka meskipun database lokal atau environment staging belum menjalankan seed produk.

## 4. Kupon Uji Coba

- **Kode**: `LAUNCH2026` (Memberikan potongan harga 20% otomatis pada form demo checkout).
