# Demo Checkout & Sandbox Testing

Halaman demo checkout (`/demo/checkout/:slug?`) disediakan untuk memfasilitasi pengujian alur antarmuka pembayaran, integrasi webhook, penukaran kupon diskon, serta simulasi penerbitan lisensi tanpa menggunakan uang riil.

---

## 1. Akses Halaman Demo

Secara default, Tertaut menyediakan produk demo bawaan bernama **FastMail AI Summarizer** (`fastmail-ai`) seharga Rp 49.000:

- **Produksi (Live Review)**:  
  `https://tertaut.com/demo/checkout/fastmail-ai`
- **Lokal (Development)**:  
  `http://localhost:5173/demo/checkout/fastmail-ai`

> **Data Fallback Otomatis**: Jika database pengujian Anda belum menjalankan database seed, halaman demo akan secara otomatis menginisialisasi produk `fastmail-ai` agar demo tetap berjalan mulus.

---

## 2. Parameter URL Kustomisasi

Anda dapat mengatur default tab pembayaran, bank virtual account, maupun e-wallet melalui URL query parameters:

| Parameter      | Pilihan Nilai                               | Keterangan                                      |
| :------------- | :------------------------------------------ | :---------------------------------------------- |
| `rail`         | `qris`, `va`, `ewallet`, `card`, `retail`   | Menentukan metode pembayaran default yang aktif |
| `bank`         | `BCA`, `BNI`, `BRI`, `MANDIRI`, `PERMATA`   | Menentukan bank default untuk Virtual Account   |
| `ewallet`      | `OVO`, `DANA`, `SHOPEEPAY`, `LINKAJA`       | Menentukan channel e-wallet default             |
| `outlet`       | `ALFAMART`, `INDOMARET`                     | Menentukan gerai retail default                 |
| `amount`       | Angka (misal: `75000`)                      | Menimpa nominal pembayaran untuk pengujian      |
| `redirect_url` | URL valid (misal: `https://app.com/finish`) | URL pengalihan setelah pembayaran selesai       |

### Contoh Kombinasi URL:

- **Virtual Account BCA**:  
  `/demo/checkout/fastmail-ai?rail=va&bank=BCA`
- **QRIS Dinamis**:  
  `/demo/checkout/fastmail-ai?rail=qris`
- **E-Wallet OVO dengan Nominal Custom**:  
  `/demo/checkout/fastmail-ai?rail=ewallet&ewallet=OVO&amount=99000`

---

## 3. Fitur Pengujian Sandbox

### A. Simulasi Pembayaran Instan

Pada mode demo / sandbox, antarmuka checkout menyediakan tombol simulasi pembayaran. Anda dapat mengklik tombol ini untuk menyelesaikan transaksi seketika tanpa menembak gateway perbankan nyata.

### B. Pengujian Kupon Diskon

Gunakan kode kupon uji coba berikut untuk menguji kalkulasi diskon otomatis:

- **Kode Kupon**: `LAUNCH2026`
- **Benefit**: Potongan harga 20% otomatis dihitung pada rincian pesanan.

### C. Alur Pasca Pembayaran

Setelah simulasi pembayaran berhasil:

1. Sesi pembayaran ditandai sebagai `PAID`.
2. Lisensi software baru diterbitkan secara otomatis dengan algoritma Ed25519.
3. Pembeli dialihkan ke halaman finish receipt resmi atau `redirectUrl` yang ditentukan.
