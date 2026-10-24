# Selamat Datang di Dokumentasi tertaut.com 👋

**tertaut.com** adalah platform infrastruktur yang dirancang khusus untuk mempermudah developer dan builder dalam memonetisasi aplikasi serta mengelola lisensi software modern (kuota perangkat/seat, floating lease, hingga verifikasi kunci API pelanggan).

## 🚀 Fitur Utama

| Fitur & Solusi                             | Mulai Pelajari                                                                  | Endpoint Utama                           |
| ------------------------------------------ | ------------------------------------------------------------------------------- | ---------------------------------------- |
| **Hosted Checkout & Pembayaran**           | [Panduan Mulai Cepat](/guide/getting-started)                                   | `POST /api/v1/checkout/session`          |
| **Universal Licensing (Seats & Floating)** | [Panduan Mulai Cepat](/guide/getting-started)                                   | `POST /api/v1/licensing/*`               |
| **Akses Kunci API Pelanggan**              | [Verifikasi Kunci API](/guide/getting-started#7-verifikasi-kunci-api-pelanggan) | `POST /api/v1/licensing/api-key/verify`  |
| **Otomasi Backend (Server-to-Server)**     | [Dokumentasi S2S](/api/server-to-server)                                        | `/api/v1/s2s/*` (Bearer `tt_secret_...`) |

## 💡 Alur Cepat Integrasi

Hanya dengan 3 langkah praktis untuk mulai:

```
1. Pasang & Inisialisasi SDK  →  new Tertaut({ apiKey: "tt_live_...", baseUrl, appId })
2. Pembayaran & Terbitkan     →  Lewat checkout session otomatis ATAU POST /api/v1/s2s/licenses/issue
3. Aktivasi & Validasi        →  POST /api/v1/licensing/verify (atau SDK licensing.heartbeat)
```

Contoh inisialisasi pada aplikasi Anda:

```ts
import { Tertaut } from "@tertaut/sdk";

const tertaut = new Tertaut({
  apiKey: "tt_live_...", // Kunci publik aplikasi Anda
  baseUrl: "https://tertaut.com",
  appId: "app_...", // ID aplikasi dari dashboard
});
```

## 📚 Jelajahi Panduan

- [Panduan Mulai Cepat](/guide/getting-started) — Tutorial langkah demi langkah dari setup hingga menerima pembayaran pertama.
- [Konfigurasi .env](/guide/environment) — Panduan aman mengonfigurasi environment variables di Vite, Next.js, dan Nuxt.
- [SDK @tertaut/sdk](/api/sdk) — Referensi lengkap method dan error handling SDK frontend.
- [API Server-ke-Server](/api/server-to-server) — Otomasi pencatatan dan penerbitan lisensi langsung dari server Anda.
- [API Playground (Swagger)](https://tertaut.com/swagger) — Uji coba interaktif langsung ke seluruh endpoint REST API tertaut.com.
- [Spesifikasi AI & LLM (llms.txt)](/docs/llms.txt) — Panduan format ringkas dan terstruktur khusus untuk AI agents dan Large Language Models.
