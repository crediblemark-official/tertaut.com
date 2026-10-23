import { swagger } from "@elysiajs/swagger";

/**
 * Konfigurasi OpenAPI / Swagger documentation untuk developer API tertaut.com
 */
export const configureSwagger = () =>
  swagger({
    path: "/swagger",
    provider: "swagger-ui",
    exclude: [
      // Internal admin panel (hanya untuk dashboard internal, bukan API builder)
      /^\/api\/v1\/panel/,
      /^\/panel/,
      // Webhook callback (server-to-server, bukan untuk builder)
      /^\/webhook/,
      /^\/webhooks/,
      /^\/api\/v1\/webhook/,
      /^\/api\/v1\/webhooks/,
      /^\/api\/v1\/checkout\/webhook/,
      // Duplikat root-level (path kanonik sudah di /api/v1/...)
      /^\/checkout\//,
      /^\/badge\//,
      // Alias legacy duplikat
      /^\/api\/v1\/license\//,
      // Manajemen aplikasi via dashboard (kelola lewat UI; programatik pakai S2S)
      /^\/api\/v1\/apps\/$/,
      /^\/api\/v1\/apps\/[^/]+$/,
      /^\/api\/v1\/apps\/stats/,
      /^\/api\/v1\/apps\/check-slug/,
      /^\/api\/v1\/apps\/me/,
      /^\/api\/v1\/apps\/rotate-secret-api-key/,
      /^\/api\/v1\/apps\/[^/]+\/rotate-api-key/,
      /^\/api\/v1\/apps\/[^/]+\/mode/,
      /^\/api\/v1\/apps\/disburse/,
      // Operasi uang & dashboard checkout (bukan konsumen external)
      /^\/api\/v1\/checkout\/transactions/,
      /^\/api\/v1\/checkout\/disburse/,
      /^\/api\/v1\/payouts/,
      // Manajemen kupon via dashboard
      /^\/api\/v1\/coupons/,
      // Launch kit dashboard
      /^\/api\/v1\/launch/,
      // Admin lisensi dashboard (programatik: S2S /licenses/issue|revoke)
      /^\/api\/v1\/licensing\/list/,
      /^\/api\/v1\/licensing\/issue/,
      /^\/api\/v1\/licensing\/revoke/,
      /^\/api\/v1\/licensing\/unbind-hardware/,
      /^\/api\/v1\/licensing\/renew/,
      /^\/api\/v1\/licensing\/seats/,
      /^\/api\/v1\/licensing\/events/,
      /^\/api\/v1\/licensing\/webhooks/,
      // Endpoint internal yang tidak dipakai SDK/docs (bukan API builder)
      /^\/api\/v1\/health\//,
      /^\/api\/v1\/apps\/by-slug\//,
      /^\/api\/v1\/checkout\/preview-coupon/,
      // Internal banner pengumuman frontend
      /^\/api\/v1\/announcement/,
      // Internal OG image generator
      /^\/api\/v1\/og/,
      // Legacy duplicate alias: gunakan /api/v1/checkout/channels
      /^\/api\/v1\/checkout\/consult-pay/,
      // Legacy duplicate alias: gunakan /api/v1/sandbox/simulate-payment
      /^\/api\/v1\/checkout\/simulate-payment/,
      // Internal test webhook callback (bukan API publik)
      /^\/api\/v1\/sandbox\/webhook/,
      // Legacy badge direct path (kanonik: /api/v1/widgets/badge/...)
      /^\/api\/v1\/badge\//,
    ],
    documentation: {
      info: {
        title: "tertaut.com Developer API",
        version: "2.2.3",
        description:
          "Spesifikasi OpenAPI resmi untuk platform **tertaut.com** — Merchant of Record (MoR) dan Lisensi Kriptografis Offline-First (Ed25519) untuk software builder di Indonesia.\n\n" +
          "### 🛡️ Skema Autentikasi:\n" +
          "- **`BuilderSecretKey` (`Bearer tt_secret_...`)**: Wajib untuk seluruh endpoint Server-to-Server (`/api/v1/s2s/*`). Ambil secret key Anda di halaman Dashboard > Developer. Jangan pernah mengekspos secret key ini di aplikasi klien/frontend.\n" +
          "- **`LicenseToken` (`Bearer <token>`)**: Digunakan oleh perangkat klien setelah aktivasi lisensi (`POST /api/v1/licensing/activate`) untuk membuktikan kepemilikan lisensi secara offline.\n\n" +
          "### 📦 Integrasi SDK Resmi:\n" +
          "Gunakan library resmi [`@tertaut/sdk`](https://www.npmjs.com/package/@tertaut/sdk) (`npm install @tertaut/sdk`) untuk TypeScript/JavaScript, browser, Bun, Node.js, Tauri, dan Electron.",
      },
      tags: [
        {
          name: "MoR Checkout",
          description:
            "Alur pembayaran Merchant of Record (QRIS & Virtual Account), e-receipt resmi (PPN 11%), kupon diskon, dan status polling.",
        },
        {
          name: "Universal Licensing",
          description:
            "Validasi lisensi multi-platform, binding hardware ID perangkat, aktivasi floating seat, dan token offline Ed25519.",
        },
        {
          name: "S2S API",
          description:
            "Endpoint Server-to-Server terproteksi secret API key untuk otomasi backend (issuance, revoke, batch ops, transfer, webhooks).",
        },
      ],
      components: {
        securitySchemes: {
          BuilderSecretKey: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT",
            description:
              "Secret API key builder (tt_secret_...) dari halaman Dashboard Docs. Wajib untuk seluruh endpoint Server-to-Server (/api/v1/s2s/*). Jangan pernah simpan di frontend.",
          },
          LicenseToken: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT",
            description:
              "Offline license token (JWT) hasil POST /api/v1/licensing/activate — atau sertakan licenseKey di body/query untuk verifikasi lisensi offline.",
          },
        },
      },
    },
  });
