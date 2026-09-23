# Environment Client (SDK Integration)

Panduan ini ditujukan bagi **pengembang yang mengintegrasikan SDK tertaut.com ke aplikasi klien** — mencakup tata cara penyimpanan dan penyediaan kredensial pada environment aplikasi frontend/klien.

## Ringkasan: 3 Nilai Wajib

| Nilai     | Contoh                | Sifat      | Dari mana                                                                    |
| --------- | --------------------- | ---------- | ---------------------------------------------------------------------------- |
| `apiKey`  | `tt_live_xxxx...`     | **Publik** | Publishable API key aplikasi — dashboard → **Aplikasi** / **Dashboard Docs** |
| `appId`   | `app_xxxx`            | Publik     | ID aplikasi (dashboard → Aplikasi)                                           |
| `baseUrl` | `https://tertaut.com` | Publik     | Server API tertaut                                                           |

- SDK tidak membaca variabel environment secara otomatis — aplikasi Anda meneruskan nilai ini ke konstruktor.
- `environment` (production/sandbox) **diturunkan secara otomatis dari prefiks `apiKey`**: `tt_live_` = produksi, `tt_test_` = sandbox. Tidak memerlukan konfigurasi flag tambahan.
- Untuk pengujian/staging, gunakan key `tt_test_...` tanpa mengubah baseUrl.

> **Ketentuan Validasi**: `apiKey` wajib berformat `tt_live_...` atau `tt_test_...`; `appId` tidak boleh kosong; `baseUrl` harus berupa URL valid berprotokol `http(s)://...` (karakter trailing slash `/` otomatis dinormalisasi).

## Menyimpan di Env Aplikasi Client

### Vite (`src/.env`)

```sh
VITE_TERTAUT_API_KEY=tt_live_xxxxxxxxxxxxxxxx
VITE_TERTAUT_APP_ID=app_xxxx
VITE_TERTAUT_BASE_URL=https://tertaut.com
```

```ts
import { Tertaut } from "@tertaut/sdk";

const tertaut = new Tertaut({
  apiKey: import.meta.env.VITE_TERTAUT_API_KEY,
  appId: import.meta.env.VITE_TERTAUT_APP_ID,
  baseUrl: import.meta.env.VITE_TERTAUT_BASE_URL,
});
```

### Next.js (`next.config` / `.env.local`)

```sh
NEXT_PUBLIC_TERTAUT_API_KEY=tt_live_xxxxxxxxxxxxxxxx
NEXT_PUBLIC_TERTAUT_APP_ID=app_xxxx
NEXT_PUBLIC_TERTAUT_BASE_URL=https://tertaut.com
```

```ts
import { Tertaut } from "@tertaut/sdk";

const tertaut = new Tertaut({
  apiKey: process.env.NEXT_PUBLIC_TERTAUT_API_KEY!,
  appId: process.env.NEXT_PUBLIC_TERTAUT_APP_ID!,
  baseUrl: process.env.NEXT_PUBLIC_TERTAUT_BASE_URL!,
});
```

> Hanya variabel dengan prefiks `NEXT_PUBLIC_` yang dapat diakses oleh browser, sehingga publishable key aman diekspos tanpa membocorkan kredensial server.

### SvelteKit (`src/.env` — prefiks `PUBLIC_`)

```sh
PUBLIC_TERTAUT_API_KEY=tt_live_xxxxxxxxxxxxxxxx
PUBLIC_TERTAUT_APP_ID=app_xxxx
PUBLIC_TERTAUT_BASE_URL=https://tertaut.com
```

### Node.js / Bun (server-side, tanpa prefiks)

```sh
TERTAUT_API_KEY=tt_live_xxxxxxxxxxxxxxxx
TERTAUT_APP_ID=app_xxxx
TERTAUT_BASE_URL=https://tertaut.com
```

```ts
const tertaut = new Tertaut({
  apiKey: process.env.TERTAUT_API_KEY!,
  appId: process.env.TERTAUT_APP_ID!,
  baseUrl: process.env.TERTAUT_BASE_URL!,
});
```

## Kapan Pakai Key Sandbox vs Live

| Skenario              | Key           | `baseUrl`                                 |
| --------------------- | ------------- | ----------------------------------------- |
| Development / testing | `tt_test_...` | `https://tertaut.com` atau server staging |
| Production / rilis    | `tt_live_...` | `https://tertaut.com`                     |

Ganti .env (mis. per-build via env CI) — tidak perlu ubah kode: `.env.development`/`.env.production` di Vite/Next langsung meresolusi nilai yang benar.

## Keamanan

- Ketiga nilai **publik** — aman di frontend/commit (pola publishable-key). Tidak ada rahasia yang bocor.
- **Jangan pernah** meletakkan Secret API key (`tt_secret_...`) di env browser/frontend. Secret hanya untuk backend Anda mengakses `/api/v1/s2s*`.

## API Key untuk Apa?

| Key                           | Dipakai untuk                                           | Tempat               |
| ----------------------------- | ------------------------------------------------------- | -------------------- |
| `tt_live_...` / `tt_test_...` | SDK (checkout, lisensi, kredit, AI) di frontend/backend | Env aplikasi client  |
| `tt_secret_...`               | Server-to-Server (`/api/v1/s2s*`)                       | Env **backend** saja |
