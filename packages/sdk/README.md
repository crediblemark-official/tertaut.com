# @tertaut/sdk

SDK ringan (< 15KB, zero dependency) untuk [tertaut.com](https://tertaut.com): checkout Merchant-of-Record, lisensi universal multi-platform, dan AI proxy.

Berjalan di Browser, Chrome Extension, Desktop (Tauri/Electron), Node.js, Bun, dan React Native.

## Instalasi

```bash
npm install @tertaut/sdk
# bun add @tertaut/sdk
# pnpm add @tertaut/sdk
```

## Mulai Cepat

```ts
import { Tertaut } from "@tertaut/sdk";

const tertaut = new Tertaut({
  appId: "app_xxx",
  // environment: "production" (default) | "sandbox"
});
```

### Checkout (Merchant of Record)

```ts
await tertaut.checkout({
  amount: 49000,
  grantDays: 30,
  customerEmail: "pembeli@example.com",
  redirectUrl: "https://app.example.com/thanks",
}); // di browser akan otomatis redirect ke halaman pembayaran
```

### Lisensi

```ts
await tertaut.licensing.activate({ licenseKey, hwid, deviceName: "MacBook Pro" });
await tertaut.licensing.validate({ licenseKey, hardwareId: hwid });
await tertaut.licensing.deactivate({ licenseKey, hwid });

// Verifikasi offline (Ed25519, Web Crypto) — tanpa memanggil server
const result = await tertaut.licensing.verifyOfflineToken(offlineToken);
if (result.valid) console.log(result.claims);
```

> Verifikasi offline tidak mengetahui revoke terbaru. Lakukan `validate()` online secara berkala.

### AI Proxy

```ts
const reply = await tertaut.aiProxy.chat({
  licenseKey,
  messages: [{ role: "user", content: "Ringkas dokumen ini" }],
});

for await (const chunk of await tertaut.aiProxy.chatStream({ licenseKey, prompt: "Halo" })) {
  process.stdout.write(chunk.text);
}
```

## API

| Anggota | Deskripsi |
| --- | --- |
| `new Tertaut({ appId, baseUrl?, environment? })` | Inisialisasi klien |
| `checkout(options)` | Buat sesi checkout MoR |
| `licensing.activate / validate / verify / deactivate` | Siklus hidup lisensi |
| `licensing.getJwks()` | Ambil public key Ed25519 |
| `licensing.verifyOfflineToken(token, options?)` | Verifikasi token offline lokal |
| `aiProxy.chat / chatStream` | AI gateway (non-streaming & streaming) |

## Lisensi

UNLICENSED — © tertaut.com. All rights reserved.
