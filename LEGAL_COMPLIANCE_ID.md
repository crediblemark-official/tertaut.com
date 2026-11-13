# Analisis Kepatuhan Regulasi & Hukum Indonesia — tertaut.com

> **Entitas Pengelola**: PT RETAS LINTAS BATAS  
> **Platform**: tertaut.com (Merchant of Record & Universal Licensing Engine)  
> **Status Kepatuhan**: Secara prinsip **LEGAL** dengan kewajiban pemenuhan administratif.  
> **Dokumentasi Lengkap**: Lihat [`docs/legal/compliance.md`](file:///media/rasyiqi/7653717A1C07B131/tertaut/docs/legal/compliance.md) atau buka situs dokumentasi di `/docs/legal/compliance`.

---

## Ringkasan Eksekutif

Platform **Tertaut (`tertaut.com`)** yang dioperasikan oleh **PT RETAS LINTAS BATAS** adalah sistem _Developer Infrastructure Engine_ yang menyediakan solusi monetisasi, penerbitan lisensi perangkat lunak kriptografis (Ed25519), dan model _Merchant of Record_ (MoR) dengan bagi hasil 95% net payout untuk builder.

### Status Badan Usaha: PT Perorangan (Perseroan Perorangan)

**Apakah boleh saat ini berstatus PT Perorangan?**  
**YA, SANGAT BOLEH DAN 100% SAH.**  
Berdasarkan UU Cipta Kerja (UU No. 6/2023) dan PP No. 8 Tahun 2021:

- PT Perorangan adalah **badan hukum resmi** di Indonesia dengan pemisahan harta pribadi vs perseroan (_limited liability_).
- Diakui penuh oleh **Kemenkomdigi** untuk mendaftar PSE Lingkup Privat Domestik (KBLI 63122).
- Diakui dan memiliki jalur _onboarding_ resmi di **Xendit** untuk live payment gateway & disbursement.
- Berhak membuka rekening bank atas nama PT dan berhak mengajukan Pengukuhan Pengusaha Kena Pajak (PKP) ke Kantor Pelayanan Pajak (KPP).
- **Kapan wajib upgrade ke PT Biasa?** Hanya jika omzet tahunan melampaui **Rp 15 Miliar/tahun** atau ada penambahan pemegang saham (investor/co-founder).

---

## Pilar Regulasi Utama di Indonesia

1. **Sistem Pembayaran (Bank Indonesia / UU P2SK No. 4/2023 & PBI No. 10/2025)**:
   - Pembayaran diproses menggunakan mitra berizin Bank Indonesia (**Xendit** sebagai PJP Kategori 1).
   - Hubungan hukum dengan builder adalah **Perjanjian Distribusi Lisensi Software (MoR)**, di mana Tertaut menjual lisensi atas nama sendiri dan membayar komisi/royalti kepada builder.

2. **Penyelenggara Sistem Elektronik (PSE Lingkup Privat - Kemenkomdigi / PP 71/2019 & Permenkominfo 5/2020)**:
   - Wajib mendaftarkan sistem di portal PSE Komdigi (`pse.komdigi.go.id`) via OSS-RBA dengan KBLI 63122 (Platform Digital Komersial).
   - Fitur moderasi konten & suspend aplikasi sudah diimplementasikan di level teknis (`handleToggleSuspendApp` & `handleToggleSuspendBuilder`).

3. **Pelindungan Data Pribadi (UU No. 27 Tahun 2022 / UU PDP)**:
   - Dokumen Kebijakan Privasi di platform (`PrivacyArticles.vue`) sudah memuat 10 pasal kepatuhan UU PDP (dasar pemrosesan, hak subjek data, retensi 5–10 tahun sesuai UU KUP, dan garansi bebas jual data).
   - Data Hardware ID (HWID) dienkripsi dengan _Salted HMAC-SHA256_ dan lisensi divalidasi dengan kriptografi asimetris Ed25519.

4. **Perdagangan Melalui Sistem Elektronik & Konsumen (PP 80/2019 & Kemendag)**:
   - Identitas badan hukum transparan di Terms, Privacy, dan Footer.
   - Kebijakan garansi pengembalian dana 100% dalam 7 hari (`RefundView.vue`) dan automasi revocasi lisensi di backend (`refunds.ts`).

5. **Aspek Perpajakan (UU HPP & PMK 81/2024)**:
   - **Catatan Kritis**: Jika PT belum berstatus PKP (Pengusaha Kena Pajak), dilarang menyebut pungutan PPN 11% dan penerbitan Faktur Pajak. Builder bertanggung jawab secara mandiri atas PPh mereka (_Self-Assessment Tax_).

---

## Checklist Kepatuhan Manajemen

- [ ] Pastikan NIB perusahaan memuat KBLI 63122, 62019, dan 62029.
- [ ] Daftarkan sistem di PSE Lingkup Privat Domestik Kemenkomdigi.
- [ ] Sesuaikan klausul Faktur Pajak PPN 11% sesuai status PKP aktual PT RETAS LINTAS BATAS.
- [ ] Tambahkan tautan aktif `Terms` dan `Privacy` pada formulir checkout dan registrasi akun.

Untuk rincian hukum per pasal undang-undang, silakan baca [Dokumen Analisis Lengkap](file:///media/rasyiqi/7653717A1C07B131/tertaut/docs/legal/compliance.md).
