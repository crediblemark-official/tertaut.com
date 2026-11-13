# Analisis Kepatuhan Hukum & Regulasi Platform Tertaut di Indonesia

> **Dokumen Resmi Kepatuhan Hukum (Legal & Regulatory Compliance Assessment)**  
> **Badan Hukum Pengelola**: PT RETAS LINTAS BATAS  
> **Platform**: tertaut.com (Headless Developer Infrastructure Engine, MoR & Universal Licensing)  
> **Yurisdiksi**: Negara Kesatuan Republik Indonesia  
> **Terakhir Diperbarui**: November 2026

---

## 1. Ringkasan Eksekutif

Secara prinsip hukum positif di Indonesia, **platform Tertaut (`tertaut.com`) TIDAK ILEGAL**. Model bisnis penyediaan infrastruktur pengembang perangkat lunak (_Developer Infrastructure Engine_), penerbitan lisensi kriptografis (_Ed25519 Universal Licensing_), dan fasilitasi transaksi digital model _Merchant of Record_ (MoR) merupakan kegiatan usaha yang diakui secara sah dalam hukum perdata dagang (KUHPerdata Pasal 1320 & 1338) serta hukum perdagangan elektronik nasional.

Mengenai badan hukum **PT RETAS LINTAS BATAS** yang saat ini berstatus **PT Perorangan (Perseroan Perorangan)**: **HAL INI SEPENUHNYA DIBOLEHKAN DAN SAH MENURUT HUKUM INDONESIA** (berdasarkan UU Cipta Kerja dan PP No. 8 Tahun 2021). PT Perorangan berstatus badan hukum resmi yang diakui penuh untuk mendaftar PSE di Kemenkomdigi, bermitra dengan payment gateway (Xendit), maupun membuka rekening bank atas nama badan usaha.

Namun demikian, terdapat **4 (empat) pilar kepatuhan wajib (_mandatory compliance pillars_)** yang harus dipenuhi secara operasional dan administratif oleh **PT RETAS LINTAS BATAS** agar platform beroperasi 100% aman dan terlindungi dari risiko sanksi administratif, pemblokiran domain oleh Kemenkomdigi, maupun sanksi denda perpajakan.

---

## 2. Status Legalitas Badan Usaha: PT Perorangan

Banyak founder startup menanyakan apakah **Perseroan Perorangan (PT Perorangan)** sah dan diizinkan menjalankan platform digital, payment gateway, dan lisensi software.

### A. Keabsahan Hukum PT Perorangan

- **Dasar Hukum**: **UU No. 6 Tahun 2023** tentang Penetapan Perppu Cipta Kerja menjadi UU jo. **PP No. 8 Tahun 2021** tentang Modal Dasar Perseroan serta Pendirian, Perubahan, dan Pembubaran Perseroan UMK.
- **Status Badan Hukum (_Rechtspersoon_)**: PT Perorangan **adalah badan hukum resmi**, bukan sekadar usaha dagang biasa (UD/PD). Terdapat pemisahan tanggung jawab yang sah antara harta kekayaan pribadi pemilik dan harta perseroan (_limited liability_).
- **NIB & KBLI**: Memiliki Nomor Induk Berusaha (NIB) resmi yang diterbitkan OSS-RBA dan berhak mengambil kode KBLI teknologi/platform digital seperti **KBLI 63122** dan **KBLI 62019**.
- **NPWP Badan**: Memiliki NPWP Badan usaha mandiri atas nama PT Perorangan dari Direktorat Jenderal Pajak.

### B. Kemampuan Operasional PT Perorangan untuk Tertaut

1. **Pendaftaran Akun Payment Gateway (Xendit)**:
   - Xendit secara resmi menerima dan memiliki alur _onboarding_ khusus untuk tipe entitas **Perseroan Perorangan (PP)**. Dokumen yang diperlukan: KTP direktur, NPWP Pribadi, NPWP Perusahaan, NIB OSS, dan Sertifikat Pendaftaran Kemenkumham.
2. **Pendaftaran Tanda Daftar PSE di Kemenkomdigi**:
   - Sistem OSS-RBA mengizinkan PT Perorangan mengajukan perizinan berusaha penunjang (PB-UMKU) untuk **Tanda Daftar PSE Domestik** di bawah KBLI 63122.
3. **Rekening Bank Bisnis**:
   - Bank-bank umum di Indonesia (BCA, Mandiri, BRI, BNI) menerima pembukaan rekening giro/bisnis atas nama `PT [Nama Perseroan]` menggunakan NIB dan Sertifikat Kemenkumham PT Perorangan.
4. **Pengukuhan PKP (Pengusaha Kena Pajak)**:
   - PT Perorangan **berhak dan bisa dikukuhkan sebagai PKP** secara sukarela di KPP Pratama setempat apabila ingin memungut PPN 11% dan menerbitkan Faktur Pajak elektronik (_e-Faktur_).

### C. Batasan & Kapan Harus Beralih ke PT Biasa (PT Persekutuan Modal)?

Berdasarkan Pasal 9 PP No. 8 Tahun 2021, PT Perorangan wajib diubah statusnya menjadi **PT Biasa (Persekutuan Modal)** melalui akta notaris apabila:

1. **Penambahan Pemegang Saham**: Masuk co-founder baru, angel investor, atau modal ventura (pemegang saham menjadi lebih dari 1 orang).
2. **Omzet Melampaui Batas Usaha Kecil**: Peredaran bruto/omzet tahunan platform menembus **> Rp 15 Miliar per tahun**.
3. **Kebutuhan Lisensi Khusus Non-UMK**: Apabila di masa mendatang Tertaut mengajukan izin langsung ke Bank Indonesia sebagai PJP Kategori 2/3 (bukan sekadar mitra Xendit), regulasi BI umumnya mensyaratkan PT Persekutuan Modal dengan modal disetor tertentu.

> **Kesimpulan Status PT Perorangan**: Untuk tahap operasional saat ini hingga skala omzet Rp 15 Miliar/tahun, **status PT Perorangan PT RETAS LINTAS BATAS sudah sangat cukup, sah secara hukum, dan diakui penuh oleh pemerintah maupun mitra perbankan/gateway**.

---

## 3. Analisis Mendalam Berdasarkan Regulasi Indonesia

### A. Regulasi Sistem Pembayaran & Moneter (Bank Indonesia & OJK)

- **Dasar Hukum**:
  - **UU No. 4 Tahun 2023** tentang Pengembangan dan Penguatan Sektor Keuangan (UU P2SK).
  - **UU No. 3 Tahun 2011** tentang Transfer Dana.
  - **Peraturan Bank Indonesia (PBI) No. 10 Tahun 2025** tentang Pengaturan Industri Sistem Pembayaran (PBI PISP).
  - **PBI No. 22/23/PBI/2020** tentang Penyelenggara Jasa Pembayaran (PJP).

- **Alur Transaksi Teknis Tertaut**:
  - Pembeli membayar melalui metode resmi (QRIS dinamis, Virtual Account Multi-Bank, Minimarket) via integrasi payment gateway **Xendit** (`xendit-node`).
  - Saldo transaksi tercatat di database (`transactions`, `payment_operations`).
  - Pemotongan _platform fee_ 5% otomatis dihitung oleh sistem (`calculateMor`).
  - Payout/Disbursement 95% disalurkan ke rekening bank/e-wallet builder melalui API Disbursement Xendit (`src/server/services/payments/payouts.ts`).

- **Analisis Kepatuhan**:
  1. **Status Kemitraan**: Xendit memegang izin resmi Bank Indonesia sebagai **Penyelenggara Jasa Pembayaran (PJP) Kategori 1** (Payment Gateway, Penerusan Transaksi Pembayaran, dan Transfer Dana). Tertaut memanfaatkan infrastruktur berizin ini dan tidak membangun kanal kliring/switching sendiri.
  2. **Risiko Penampungan Dana Pihak Ketiga (_Custody of Funds_)**: Bank Indonesia melarang pihak non-PJP menghimpun dan meneruskan dana transaksi milik orang lain (_settlement aggregation_) tanpa izin PJP Kategori 2/3.
  3. **Mitigasi Hukum Tertaut**:
     - Di mata hukum, Tertaut memosisikan diri sebagai **Merchant of Record (MoR)**. Pembeli membeli lisensi perangkat lunak secara sah dari `PT RETAS LINTAS BATAS`.
     - Hubungan hukum antara Tertaut dan Software Builder adalah **Perjanjian Keagenan/Distribusi Lisensi Digital (_Software Distribution Agreement_)**, bukan penitipan uang simpanan. Pencairan 95% ke builder adalah pembayaran hak lisensi/royalti atas software yang berhasil didistribusikan.
     - _Rekomendasi Lanjutan_: Integrasikan fitur resmi **Xendit XenPlatform (Split Payment / Sub-Merchant)** agar segregasi dana antara fee platform dan pendapatan builder dilakukan langsung di level sistem PJP Bank Indonesia.

---

### B. Penyelenggara Sistem Elektronik (PSE) & Kemenkomdigi

- **Dasar Hukum**:
  - **UU No. 1 Tahun 2024** tentang Perubahan Kedua atas UU No. 11/2008 tentang Informasi dan Transaksi Elektronik (UU ITE).
  - **Peraturan Pemerintah (PP) No. 71 Tahun 2019** tentang Penyelenggaraan Sistem dan Transaksi Elektronik (PP PSTE).
  - **Permenkominfo No. 5 Tahun 2020 jo. No. 10 Tahun 2021** tentang Penyelenggara Sistem Elektronik Lingkup Privat.

- **Analisis Kepatuhan**:
  1. **Kewajiban Pendaftaran PSE Lingkup Privat Domestik**:
     - Karena Tertaut memfasilitasi transaksi keuangan, pengolahan data pribadi, dan perdagangan digital, platform ini **wajib terdaftar** di Kementerian Komunikasi dan Digital (Kemenkomdigi) melalui portal OSS-RBA (`pse.komdigi.go.id`).
     - _Risiko tanpa tanda daftar_: Pemutusan akses/pemblokiran domain `tertaut.com` di Indonesia serta denda administratif.
  2. **Kewajiban Moderasi Konten & Take Down (_Notice and Takedown_)**:
     - Berdasarkan Permenkominfo 5/2020 dan SE Menkominfo No. 5/2016 (_Safe Harbor_), PSE wajib memiliki kendali untuk menurunkan konten terlarang (judi online, pornografi, penipuan, malware).
     - **Kesiapan Teknis Tertaut**: Backend Tertaut telah memiliki endpoint super-admin operasional:
       - `handleToggleSuspendApp` di [`src/server/routes/panel/moderation.ts`](file:///media/rasyiqi/7653717A1C07B131/tertaut/src/server/routes/panel/moderation.ts#L39-L65).
       - `handleToggleSuspendBuilder` di [`src/server/routes/panel/moderation.ts`](file:///media/rasyiqi/7653717A1C07B131/tertaut/src/server/routes/panel/moderation.ts#L8-L34).
     - Platform siap mematuhi batas waktu takedown 1x24 jam (atau 4 jam untuk kasus mendesak seperti judi online).

---

### C. Pelindungan Data Pribadi (UU No. 27 Tahun 2022 / UU PDP)

- **Dasar Hukum**:
  - **Undang-Undang No. 27 Tahun 2022** tentang Pelindungan Data Pribadi (UU PDP).

- **Analisis Kepatuhan & Arsitektur Keamanan Data**:
  1. **Dokumen Kebijakan Privasi (`PrivacyArticles.vue`)**:
     - Dokumen hukum privasi Tertaut telah merinci 10 Pasal lengkap yang merujuk langsung ke UU PDP (Pasal 20 dasar pemrosesan yang sah, hak akses, hak perbaikan, hak penarikan persetujuan, dan hak penghapusan).
     - Larangan mutlak penjualan data pribadi kepada pihak ketiga (_No Data Brokerage Guarantee_).
     - Klausul kepatuhan khusus integrasi Google OAuth (_Google API Services User Data Policy_).
  2. **Standar Keamanan Teknis (Technical Safeguards)**:
     - **Hardware ID (HWID)**: Lisensi tidak menyimpan identitas perangkat mentah, melainkan menggunakan salted cryptographic hash (`hwid_hash` via HMAC-SHA256).
     - **Kriptografi Asimetris**: Token lisensi offline divalidasi menggunakan pasangan kunci Ed25519 tanpa membocorkan data pribadi ke jaringan publik.
     - **Vault Enkripsi**: Data kredensial gateway dan API key dienkripsi menggunakan standar AES-256-GCM.
     - **Hashing Kata Sandi**: Otentikasi berbasis Better Auth menggunakan algoritma hash satu arah yang kuat (Argon2 / bcrypt) dengan salt unik.
     - **Retensi Data Keuangan**: Penyimpanan catatan transaksi selama 5–10 tahun sesuai amanat UU KUP dan ketentuan audit finansial Bank Indonesia (dikecualikan dari penghapusan dini demi hukum).

- **Penyempurnaan Antarmuka (UI Consent)**:
  - Pada halaman checkout (`PayPaymentForm.vue` / `PayXenditForm.vue`) dan registrasi builder (`LoginView.vue`), pastikan disclaimer persetujuan dilengkapi tautan aktif (`<a>/terms</a>` dan `<a>/privacy</a>`) sebelum pengguna mengirimkan formulir (_clickwrap agreement_ sesuai Pasal 22 UU PDP).

---

### D. Perdagangan Melalui Sistem Elektronik (PMSE) & Perlindungan Konsumen

- **Dasar Hukum**:
  - **PP No. 80 Tahun 2019** tentang Perdagangan Melalui Sistem Elektronik (PMSE).
  - **Permendag No. 31 Tahun 2023** tentang Penyelenggara PMSE (PPMSE).
  - **UU No. 8 Tahun 1999** tentang Perlindungan Konsumen.

- **Analisis Kepatuhan**:
  1. **Transparansi Identitas Pelaku Usaha (Pasal 27 PP 80/2019)**:
     - Tertaut mencantumkan identitas resmi badan hukum (`PT RETAS LINTAS BATAS`), alamat domisili operasional di Sumenep, Jawa Timur, kontak telepon/WhatsApp, dan alamat email resmi pada header, footer, dan dokumen legal.
  2. **Kebijakan Pengembalian Dana (Refund Policy)**:
     - Tersedia garansi 7 hari pengembalian dana 100% apabila lisensi software mengalami cacat fungsi fatal yang tidak terselesaikan.
     - Backend memiliki automasi pembatalan transaksi, revocasi token Ed25519, pencabutan seat, dan penerusan refund ke payment gateway Xendit (`src/server/services/payments/refunds.ts`).
  3. **Saluran Pengaduan Konsumen**:
     - Tersedia kontak WhatsApp dan email resmi yang responsif untuk menyelesaikan sengketa transaksi.

---

### E. Aspek Perpajakan (PPN 11% & PPh)

- **Dasar Hukum**:
  - **UU No. 7 Tahun 2021** tentang Harmonisasi Peraturan Perpajakan (UU HPP).
  - **PMK No. 81 Tahun 2024** dan **PER-12/PJ/2025** tentang PPN PMSE dan Penunjukan Pihak Lain.
  - **UU KUP (Ketentuan Umum dan Tata Cara Perpajakan)**.

- **Perhatian Krusial (High Priority Compliance)**:
  1. **Klaim PPN 11%**:
     - Pada dokumen Syarat & Ketentuan saat ini tertera pernyataan: _"Harga sudah mencakup PPN 11% dan Faktur Pajak Resmi diterbitkan oleh PT RETAS LINTAS BATAS"_.
     - **ATURAN**:
       - Jika `PT RETAS LINTAS BATAS` **sudah dikukuhkan sebagai Pengusaha Kena Pajak (PKP)** oleh Direktorat Jenderal Pajak (DJP), klausul ini **sah dan wajib dijalankan** dengan menerbitkan e-Faktur resmi.
       - Jika PT **BELUM berstatus PKP**, badan usaha **DILARANG KERAS** memungut PPN atau menyebutkan penerbitan Faktur Pajak resmi (Pasal 39A UU KUP memuat ancaman pidana bagi penerbitan faktur pajak tanpa hak).
       - _Tindakan jika belum PKP_: Ubah redaksi dokumen legal menjadi: _"Harga yang tertera adalah harga final yang mencakup seluruh biaya platform Tertaut"_ tanpa mencantumkan kata pungutan PPN 11% hingga status PKP terbit.
  2. **Pajak Penghasilan (PPh) Builder**:
     - Tertaut mencairkan 95% penghasilan bersih kepada builder tanpa memotong PPh pasal 21/23 secara otomatis di aplikasi.
     - Syarat & Ketentuan Tertaut wajib menegaskan prinsip **Self-Assessment Tax**: masing-masing Software Builder bertanggung jawab penuh untuk menghitung, melaporkan, dan membayar kewajiban Pajak Penghasilan pribadinya / perusahaannya melalui SPT Tahunan Pajak.

---

## 3. Matriks Kepatuhan Hukum

| Aspek Regulasi         | Dasar Hukum                                |       Status Platform        | Rekomendasi Tindakan                                                       |
| :--------------------- | :----------------------------------------- | :--------------------------: | :------------------------------------------------------------------------- |
| **Sistem Pembayaran**  | PBI No. 10/2025, UU P2SK                   |  **Legal (Mitra Berizin)**   | Perjelas kontrak distribusi lisensi MoR; pertimbangkan Xendit XenPlatform. |
| **Pendaftaran PSE**    | PP 71/2019, Permenkominfo 5/2020           |    **Wajib Didaftarkan**     | Daftarkan domain `tertaut.com` ke portal PSE Komdigi via OSS-RBA.          |
| **Pelindungan Data**   | UU No. 27 Tahun 2022 (UU PDP)              |    **Sangat Baik (90%)**     | Tambahkan tautan aktif S&K dan Kebijakan Privasi di tombol checkout.       |
| **PMSE & Konsumen**    | PP 80/2019, Permendag 31/2023              |        **Terpenuhi**         | Identitas PT, refund 7 hari, dan kontak pengaduan sudah transparan.        |
| **Perpajakan PPN 11%** | UU HPP, PMK 81/2024                        | **Perlu Penyesuaian Status** | Sesuaikan klaim Faktur Pajak sesuai status PKP aktual perseroan.           |
| **Moderasi Konten**    | Permenkominfo 5/2020, SE Menkominfo 5/2016 |    **Tersedia (Teknis)**     | Tambahkan form pelaporan penyalahgunaan (_Report Abuse_) publik.           |

---

## 4. Daftar Periksa (Actionable Compliance Checklist)

Berikut langkah praktis yang disarankan bagi manajemen **PT RETAS LINTAS BATAS**:

1. **Perizinan Berusaha (OSS-RBA)**:
   - [ ] Pastikan NIB perusahaan memuat KBLI yang sesuai:
     - **KBLI 63122**: Portal Web dan/atau Platform Digital dengan Tujuan Komersial.
     - **KBLI 62019**: Aktivitas Pemrograman Komputer Lainnya.
     - **KBLI 62029**: Aktivitas Konsultasi Komputer dan Manajemen Fasilitas Komputer Lainnya.
2. **Pendaftaran PSE Komdigi**:
   - [ ] Ajukan pendaftaran Penyelenggara Sistem Elektronik (PSE) Lingkup Privat Domestik di `layanan.kominfo.go.id` / `oss.go.id`.
3. **Penyesuaian Klausul Pajak**:
   - [ ] Jika belum PKP, hapus penyebutan _"Faktur Pajak PPN 11%"_ pada landing page dan dokumen Syarat & Ketentuan.
   - [ ] Cantumkan klausul _Self-Assessment Tax_ untuk penghasilan builder.
4. **Penyempurnaan UI Checkout & Signup**:
   - [ ] Pastikan teks _"Dengan melanjutkan, Anda menyetujui Ketentuan Layanan & Kebijakan Privasi"_ di checkout dan signup memuat tautan yang bisa diklik.
5. **Klausul Ganti Rugi HAKI (_Indemnification_)**:
   - [ ] Pastikan Terms of Service memuat klausul bahwa Builder menjamin keaslian hak cipta software yang mereka jual dan membebaskan Tertaut dari segala tuntutan pelanggaran hak cipta pihak ketiga.
