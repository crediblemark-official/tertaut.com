# tertaut.com Docs

**Headless Developer Infrastructure Engine** untuk monetisasi, universal licensing, AI protection, dan validasi produk.

## Yang Disediakan

| Kemampuan                  | Mulai dari                                                           | Endpoint                                 |
| -------------------------- | -------------------------------------------------------------------- | ---------------------------------------- |
| Hosted Checkout & Payment  | [Get Started](/getting-started)                                      | `POST /api/v1/checkout/session`          |
| Universal Licensing        | [Get Started](/getting-started)                                      | `POST /api/v1/licensing/*`               |
| Metered Credits (Client)   | [Get Started](/getting-started#7-metered-credits)                    | `POST /api/v1/licensing/credits/consume` |
| Metered Credits (S2S)      | [Server-to-Server](/server-to-server#metered-credits)                | `POST /api/v1/s2s/credits/consume`       |
| Customer API Access        | [Getting Started](/getting-started#8-verifikasi-kunci-api-pelanggan) | `POST /api/v1/licensing/api-key/verify`  |
| AI Proxy Shield            | [SDK](/sdk)                                                          | `POST /api/v1/ai/chat`                   |
| Server-to-Server (Otomasi) | [S2S API](/server-to-server)                                         | `/api/v1/s2s/*` (Bearer `tt_secret_...`) |

## Alur Sederhana

```
1. Inisialisasi SDK  →  new Tertaut({ apiKey: "tt_live_...", baseUrl, appId })
2. Terbitkan lisensi →  checkout session ATAU POST /api/v1/s2s/licenses/issue
3. Validasi          →  POST /api/v1/licensing/verify (atau SDK licensing.validate)
4. Monetisasi pemakaian → POST /api/v1/licensing/credits/consume (idempoten, atomik)
```

```ts
import { Tertaut } from "@tertaut/sdk";

const tertaut = new Tertaut({
  apiKey: "tt_live_...",
  baseUrl: "https://tertaut.com",
  appId: "app_...",
});
```

## Navigasi

- [Getting Started](/getting-started) — integrasi end-to-end dengan contoh request & response riil
- [SDK @tertaut/sdk](/sdk) — referensi lengkap frontend SDK
- [Server-to-Server API](/server-to-server) — otomasi lisensi & kredit dari backend
- [Swagger](https://tertaut.com/swagger) — referensi seluruh REST API (OpenAPI, termasuk schema request/response)
