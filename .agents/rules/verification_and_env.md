# Aturan Verifikasi & Penyelarasan Environment

## 1. Verifikasi Menyeluruh Sebelum Mengklaim Selesai
- **Dilarang keras menyatakan tugas selesai** hanya karena pengecekan sintaksis, build script, atau `docker compose config` berhasil lolos tanpa error.
- Sebelum menyatakan selesai, selalu lakukan pengecekan substansi secara langsung:
  - Bandingkan file yang diubah terhadap sumber acuan riil baris demi baris (misalnya: membandingkan variabel di `docker-compose.yml` langsung dengan isi `.env` aktif).
  - Pastikan tidak ada variabel phantom, variabel ekstra, atau asumsi yang belum dikonfirmasi kebenarannya.

## 2. Integritas Environment & Deployment
- File konfigurasi deployment (`docker-compose.yml`) harus selaras persis 1:1 dengan `.env` riil pengguna.
- Jangan menambahkan variabel internal, default tambahan, atau placeholder yang tidak ada di `.env`, terutama jika variabel tersebut sudah memiliki fallback bawaan di kode atau di `Dockerfile`.
- Pastikan tidak ada variabel ganda atau ketidaksesuaian penamaan antara kode, file env, dan orchestration docker.
