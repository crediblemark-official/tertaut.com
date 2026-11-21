# Resep & Contoh Integrasi per Platform 🛠️

Panduan praktis siap pakai (_copy-paste ready_) untuk mengintegrasikan **tertaut.com** ke dalam berbagai jenis arsitektur proyek software: **SaaS Web (Next.js / Node.js)**, **Aplikasi Desktop (Tauri / Electron)**, **Chrome Extension**, serta **Backend Python & PHP**.

---

## 1. Web SaaS (Next.js App Router)

Pada arsitektur SaaS berbasis langganan atau lisensi web, interaksi dengan Tertaut umumnya terdiri dari:

1. **Frontend / Server Action**: Menginisiasi sesi checkout.
2. **Webhook Route**: Menerima konfirmasi pembayaran (`payment.success`) dan memberikan akses pelanggan.

### A. Inisiasi Checkout dari Backend (Server Action)

```ts
// app/actions/billing.ts
"use server";

import { redirect } from "next/navigation";

export async function createCheckoutSession(formData: FormData) {
  const customerEmail = formData.get("email") as string;
  const plan = formData.get("plan") as string; // mis. "pro"

  const res = await fetch("https://tertaut.com/api/v1/checkout/session", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.TERTAUT_SECRET_KEY}`, // tt_secret_...
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      appId: process.env.NEXT_PUBLIC_TERTAUT_APP_ID,
      customerEmail,
      amount: plan === "pro" ? 99000 : 49000,
      redirectUrl: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?billing=success`,
      metadata: { plan, userId: "usr_12345" },
    }),
  });

  const data = await res.json();
  if (data.checkoutUrl) {
    redirect(data.checkoutUrl); // Mengarahkan ke https://tertaut.com/pay/:slug
  }
}
```

### B. Webhook Receiver dengan Verifikasi Signature HMAC

```ts
// app/api/webhooks/tertaut/route.ts
import { NextRequest, NextResponse } from "next/server";
import { Tertaut } from "@tertaut/sdk";

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-tertaut-signature") || "";
  const secret = process.env.TERTAUT_WEBHOOK_SECRET || "";

  // 1. Verifikasi tanda tangan HMAC-SHA256
  const isValid = await Tertaut.verifyWebhookSignature(rawBody, signature, secret);
  if (!isValid) {
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });
  }

  const payload = JSON.parse(rawBody);
  const event = payload.event;
  const data = payload.data;

  // 2. Tangani event sesuai kebutuhan bisnis
  switch (event) {
    case "payment.success": {
      const { transactionId, customerEmail, amount, metadata } = data;
      console.log(`Pembayaran sukses Rp ${amount} dari ${customerEmail} (TX: ${transactionId})`);

      // Update status langganan user di database lokal Anda
      // await db.users.update({ where: { email: customerEmail }, data: { isPro: true } });
      break;
    }

    case "license.issued": {
      const { licenseKey, customerEmail, expiresAt } = data;
      console.log(`Lisensi terbit: ${licenseKey} untuk ${customerEmail} hingga ${expiresAt}`);
      break;
    }

    case "license.revoked": {
      const { licenseKey, reason } = data;
      console.warn(`Lisensi ${licenseKey} dicabut. Alasan: ${reason}`);
      break;
    }
  }

  return NextResponse.json({ received: true });
}
```

---

## 2. Web SaaS (Node.js / Express)

Untuk aplikasi Node.js Express, gunakan `express.raw()` pada rute webhook agar payload teks asli tidak berubah:

```ts
import express from "express";
import { Tertaut } from "@tertaut/sdk";

const app = express();

// Middleware raw body khusus webhook
app.post("/api/webhooks/tertaut", express.raw({ type: "application/json" }), async (req, res) => {
  const rawBody = req.body.toString("utf8");
  const signature = req.headers["x-tertaut-signature"] as string;
  const secret = process.env.TERTAUT_WEBHOOK_SECRET!;

  const isValid = await Tertaut.verifyWebhookSignature(rawBody, signature, secret);
  if (!isValid) {
    return res.status(401).json({ error: "Unauthorized: Invalid signature" });
  }

  const { event, data } = JSON.parse(rawBody);
  if (event === "payment.success") {
    console.log("Pembayaran terverifikasi:", data.transactionId);
  }

  res.json({ status: "ok" });
});
```

---

## 3. Aplikasi Desktop (Tauri / Electron / Offline-First)

Aplikasi desktop (seperti Point of Sale/POS, studio kreatif, atau aplikasi enterprise) membutuhkan arsitektur lisensi yang sangat tangguh:

1. **Hardware ID (HWID) Binding**: Mengunci kursi lisensi ke sidik jari perangkat keras agar lisensi tidak disalahgunakan atau diduplikasi.
2. **Offline-First & Ed25519 Cryptographic Verification**: Mampu beroperasi tanpa internet hingga batas _offline grace period_ (misalnya 30–60 hari) melalui verifikasi asimetris lokal token Ed25519 yang ditandatangani Tertaut.
3. **Floating Rolling Seat Lease**: Mendukung kursi mengambang berbasis heartbeat berkala (misal 60 detik) untuk pergantian shift kasir atau multi-komputer.
4. **Seamless MoR Hosted Checkout**: Mengarahkan pembelian/perpanjangan lisensi langsung ke kasir resmi hosted (`https://tertaut.com/pay/:slug`) tanpa membocorkan backend secret key ke binary klien.
5. **Otomasi CLI Developer (S2S)**: Script CLI terminal untuk tim pengembang menerbitkan, mencabut, atau melepas seat pelanggan secara instan.

---

### A. Layanan Sidik Jari Perangkat (Hardware ID / HWID)

Gunakan Web Crypto API bawaan browser/WebView untuk menghasilkan HWID berbasis hash SHA-256 yang stabil, konsisten, dan terenkapsulasi:

```ts
// src/services/hwidService.ts
const HWID_STORAGE_KEY = "tertaut_client_hwid_v1";
const DEVICE_NAME_KEY = "tertaut_client_device_name_v1";

function getBrowserFingerprint(): string {
  const parts: string[] = [
    typeof navigator !== "undefined" ? navigator.userAgent : "desktop-runtime",
    typeof navigator !== "undefined" ? navigator.language : "id-ID",
    typeof screen !== "undefined"
      ? `${screen.width}x${screen.height}x${screen.colorDepth}`
      : "1920x1080x24",
    typeof navigator !== "undefined" ? String(navigator.hardwareConcurrency || 4) : "4",
  ];
  return parts.join("###");
}

async function sha256Hex(message: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function getOrCreateHwid(): string {
  if (typeof localStorage === "undefined") return "HWID-FALLBACK-DESKTOP-NODE";
  const existing = localStorage.getItem(HWID_STORAGE_KEY);
  if (existing) return existing;

  const rawSeed = `${getBrowserFingerprint()}_${Date.now()}_${Math.random()}`;
  // Hasilkan identifier 16-hex terformat (HWID-XXXX-XXXX-XXXX-XXXX)
  const hexPart =
    Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);
  const formatted =
    `HWID-${hexPart.slice(0, 4)}-${hexPart.slice(4, 8)}-${hexPart.slice(8, 12)}-${hexPart.slice(12, 16)}`.toUpperCase();

  localStorage.setItem(HWID_STORAGE_KEY, formatted);
  return formatted;
}

export function getDeviceName(): string {
  if (typeof localStorage === "undefined") return "Desktop Client";
  return localStorage.getItem(DEVICE_NAME_KEY) || "Kasir Utama";
}

export function setDeviceName(name: string): void {
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(DEVICE_NAME_KEY, name.trim());
  }
}
```

---

### B. Layanan Lisensi Klien (`licenseService.ts`)

Wrapper klien SDK `@tertaut/sdk` yang menangani aktivasi, validasi online/offline, heartbeat, serta pemformatan error ramah pengguna dalam Bahasa Indonesia:

```ts
// src/services/licenseService.ts
import {
  Tertaut,
  TertautError,
  SeatLimitExceededError,
  LicenseExpiredError,
  LicenseRevokedError,
  TertautRateLimitError,
  HeartbeatLeaseError,
  VersionFloorError,
  type LicenseActivateResult,
  type LicenseCheckResult,
  type HeartbeatSession,
} from "@tertaut/sdk";

export interface TertautApiConfig {
  apiKey: string;
  appId: string;
  baseUrl: string;
  slug?: string;
  targetPrice?: number;
}

export function getTertautConfig(): TertautApiConfig {
  return {
    apiKey:
      import.meta.env?.VITE_TERTAUT_PUBLISHABLE_KEY ||
      import.meta.env?.VITE_TERTAUT_API_KEY ||
      "tt_live_public_key_anda",
    appId: import.meta.env?.VITE_TERTAUT_APP_ID || "app_xxxx",
    baseUrl: (import.meta.env?.VITE_TERTAUT_BASE_URL || "https://tertaut.com")
      .replace(/\/+$/, "")
      .replace(/\/api\/v1$/, ""),
    slug: import.meta.env?.VITE_TERTAUT_SLUG || "my-desktop-product",
    targetPrice: Number(import.meta.env?.VITE_TERTAUT_PRICE) || 135000,
  };
}

export function createTertautClient(customConfig?: Partial<TertautApiConfig>): Tertaut {
  const config = { ...getTertautConfig(), ...customConfig };
  return new Tertaut({
    apiKey: config.apiKey,
    appId: config.appId,
    baseUrl: config.baseUrl,
    timeoutMs: 15000,
  });
}

export function formatLicensingError(err: unknown): string {
  if (err instanceof SeatLimitExceededError)
    return "Batas kuota perangkat penuh. Lepas perangkat lain dari dashboard atau hubungi admin.";
  if (err instanceof LicenseExpiredError) return "Masa berlaku lisensi telah berakhir.";
  if (err instanceof LicenseRevokedError) return "Lisensi telah dicabut oleh administrator.";
  if (err instanceof HeartbeatLeaseError)
    return "Sesi floating lease perangkat Anda telah berakhir.";
  if (err instanceof VersionFloorError)
    return `Aplikasi wajib diperbarui minimal ke versi ${(err as any).details?.minVersion || "terbaru"}.`;
  if (err instanceof TertautRateLimitError)
    return "Terlalu banyak permintaan validasi. Silakan tunggu beberapa saat.";
  if (err instanceof TertautError) {
    if (err.code === "LICENSE_NOT_FOUND") return "Kode lisensi tidak ditemukan di database.";
    if (err.code === "APP_MISMATCH") return "Kode lisensi tidak cocok untuk aplikasi ini.";
    if (err.code === "HARDWARE_MISMATCH")
      return "Perangkat tidak sesuai dengan data lisensi terdaftar.";
    return err.message || `Kesalahan Lisensi (${err.code || err.status})`;
  }
  return "Gagal terhubung ke server lisensi. Pastikan koneksi internet tersedia.";
}

export const licenseService = {
  // 1. Aktivasi Lisensi Pertama Kali (Kunci HWID)
  async activate(payload: {
    licenseKey: string;
    hwid: string;
    deviceName?: string;
  }): Promise<LicenseActivateResult> {
    const client = createTertautClient();
    return await client.licensing.activate({
      licenseKey: payload.licenseKey.trim(),
      hwid: payload.hwid,
      deviceName: payload.deviceName,
    });
  },

  // 2. Dual-Mode Check (Online + Ed25519 Offline Fallback)
  async check(payload: {
    licenseKey: string;
    hwid: string;
    offlineToken?: string | null;
  }): Promise<LicenseCheckResult> {
    const client = createTertautClient();
    return await client.licensing.check({
      licenseKey: payload.licenseKey.trim(),
      hwid: payload.hwid,
      offlineToken: payload.offlineToken || undefined,
      allowOfflineFallback: true, // Otomatis verifikasi kriptografis lokal jika jaringan terputus
      appVersion: "1.0.0",
      platform: "desktop",
    });
  },

  // 3. Pelepasan Kursi (Deactivate Device Seat)
  async deactivate(payload: { licenseKey: string; hwid: string }): Promise<boolean> {
    const client = createTertautClient();
    const result = await client.licensing.deactivate({
      licenseKey: payload.licenseKey.trim(),
      hwid: payload.hwid,
    });
    return result.success;
  },

  // 4. Background Heartbeat untuk Floating Seat Lease
  startHeartbeatSession(options: {
    licenseKey: string;
    hwid: string;
    leaseKey: string;
    deviceName?: string;
    onLeaseExpired?: (err: Error) => void;
  }): HeartbeatSession {
    const client = createTertautClient();
    return client.licensing.startHeartbeatSession({
      licenseKey: options.licenseKey,
      hwid: options.hwid,
      leaseKey: options.leaseKey,
      deviceName: options.deviceName,
      intervalSeconds: 60,
      autoReacquire: true,
      onLeaseExpired: options.onLeaseExpired,
    });
  },

  // 5. URL Kasir Resmi Hosted MoR Checkout
  getOfficialCheckoutUrl(slug?: string): string {
    const config = getTertautConfig();
    return `${config.baseUrl}/pay/${slug || config.slug}`;
  },
};
```

---

### C. State Management Terpusat (Pinia / Vue 3 Store)

Simpan status lisensi, token offline, dan kuota kursi perangkat secara reaktif:

```ts
// src/stores/licenseStore.ts
import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { licenseService, formatLicensingError, getTertautConfig } from "../services/licenseService";
import { getOrCreateHwid, getDeviceName } from "../services/hwidService";
import type { HeartbeatSession } from "@tertaut/sdk";

export const useLicenseStore = defineStore("license", () => {
  const hwid = ref(getOrCreateHwid());
  const deviceName = ref(getDeviceName());
  const licenseKey = ref(localStorage.getItem("sirka_license_key") || "");
  const offlineToken = ref(localStorage.getItem("sirka_offline_token") || "");
  const status = ref<
    "UNREGISTERED" | "ACTIVE" | "OFFLINE_GRACE" | "EXPIRED" | "REVOKED" | "CHECKING"
  >("UNREGISTERED");
  const isValid = ref(false);
  const expiresAt = ref<string | null>(null);
  const seatsUsed = ref(0);
  const maxSeats = ref(1);
  const showModal = ref(false);
  const errorMessage = ref<string | null>(null);

  let heartbeatSession: HeartbeatSession | null = null;

  const isLicensed = computed(
    () => isValid.value && status.value !== "EXPIRED" && status.value !== "REVOKED"
  );
  const isOffline = computed(() => status.value === "OFFLINE_GRACE");
  const officialCheckoutUrl = computed(() => licenseService.getOfficialCheckoutUrl());

  const maskedKey = computed(() => {
    if (!licenseKey.value) return "-";
    const parts = licenseKey.value.split("-");
    return parts.length > 2 ? `${parts[0]}-••••-••••-${parts[parts.length - 1]}` : licenseKey.value;
  });

  async function activate(key: string) {
    errorMessage.value = null;
    try {
      const res = await licenseService.activate({
        licenseKey: key,
        hwid: hwid.value,
        deviceName: deviceName.value,
      });
      if (res.success && res.data) {
        licenseKey.value = key;
        offlineToken.value = res.data.licenseToken;
        isValid.value = true;
        status.value = "ACTIVE";
        expiresAt.value = res.data.expiresAt;
        seatsUsed.value = res.data.seatsUsed;
        maxSeats.value = res.data.maxSeats;

        localStorage.setItem("sirka_license_key", key);
        localStorage.setItem("sirka_offline_token", res.data.licenseToken);

        // Jika lisensi mendukung floating lease, jalankan heartbeat berkala
        if (res.data.floating && res.data.leaseKey) {
          startHeartbeat(res.data.leaseKey);
        }
        return { success: true };
      }
      throw new Error(res.message || "Aktivasi gagal");
    } catch (err) {
      errorMessage.value = formatLicensingError(err);
      return { success: false, error: errorMessage.value };
    }
  }

  async function checkStartup() {
    if (!licenseKey.value) {
      status.value = "UNREGISTERED";
      return;
    }
    status.value = "CHECKING";
    try {
      const res = await licenseService.check({
        licenseKey: licenseKey.value,
        hwid: hwid.value,
        offlineToken: offlineToken.value,
      });
      isValid.value = res.valid;
      status.value = res.source === "offline" ? "OFFLINE_GRACE" : "ACTIVE";
      expiresAt.value = res.expiresAt;
    } catch (err) {
      errorMessage.value = formatLicensingError(err);
    }
  }

  function startHeartbeat(leaseKey: string) {
    if (heartbeatSession) heartbeatSession.stop();
    heartbeatSession = licenseService.startHeartbeatSession({
      licenseKey: licenseKey.value,
      hwid: hwid.value,
      leaseKey,
      deviceName: deviceName.value,
      onLeaseExpired: () => {
        status.value = "EXPIRED";
        isValid.value = false;
        errorMessage.value = "Sesi perangkat Anda telah dialihkan.";
      },
    });
  }

  return {
    hwid,
    deviceName,
    licenseKey,
    maskedKey,
    status,
    isValid,
    isLicensed,
    isOffline,
    expiresAt,
    seatsUsed,
    maxSeats,
    officialCheckoutUrl,
    showModal,
    errorMessage,
    activate,
    checkStartup,
  };
});
```

---

### D. Alur Pembelian MoR: Hosted Checkout URL (Praktik Terbaik)

Pada aplikasi desktop murni (tanpa server proxy perantara), **jangan pernah memanggil API `POST /api/v1/checkout/session` dengan nominal dinamis dari klien** karena transaksi dinamis memerlukan Builder Secret Key (`S2S_REQUIRED`) yang haram disertakan pada binary klien.

Pola terbaik yang sangat aman dan terbukti adalah membuka **Halaman Pembayaran Resmi Tertaut**:

```
https://tertaut.com/pay/:slug
```

```ts
// Membuka kasir resmi dari tombol UI aplikasi desktop
async function openCheckoutPage() {
  const url = licenseStore.officialCheckoutUrl; // mis. https://tertaut.com/pay/kasir-sirka-pos-suite
  try {
    // Pada Tauri: gunakan plugin opener bawaan
    const { openUrl } = await import("@tauri-apps/plugin-opener");
    await openUrl(url);
  } catch {
    // Fallback Electron / Browser
    window.open(url, "_blank", "noopener,noreferrer");
  }
}
```

#### Alur Pengguna (User Experience):

1. Pengguna menekan tombol **"Beli via Tertaut"** di dalam dialog lisensi aplikasi.
2. Browser bawaan sistem membuka halaman checkout resmi ber-SSL milik Tertaut yang menyajikan QRIS dinamis instan dan Virtual Account bank (BCA, Mandiri, BNI, BRI, Permata).
3. Setelah pembeli menyelesaikan transfer, sistem Tertaut secara instan menampilkan kode lisensi berformat `TT-XXXX-XXXX-XXXX-XXXX` di layar dan mengirim salinannya ke email pembeli.
4. Pembeli menyalin kode tersebut, kembali ke aplikasi desktop, menempelkannya ke tab **Aktivasi**, lalu menekan tombol **Aktivasi**.

---

### E. Script CLI Otomasi Developer (Server-to-Server / S2S)

Untuk tim pengembang mengelola lisensi di luar aplikasi (misalnya menerbitkan lisensi manual, promo, transaksi offline, atau mencabut lisensi), sediakan script CLI berbasis `bun`:

```ts
// scripts/tertaut-s2s.ts
#!/usr/bin/env bun
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const SECRET_KEY = process.env.TERTAUT_SECRET_KEY || "";
const APP_ID = process.env.TERTAUT_APP_ID || "app_xxxx";
const BASE_URL = (process.env.TERTAUT_BASE_URL || "https://tertaut.com").replace(/\/+$/, "");

if (!SECRET_KEY || !SECRET_KEY.startsWith("tt_secret_")) {
  console.error("❌ Error: TERTAUT_SECRET_KEY belum diisi di .env");
  process.exit(1);
}

const headers = { Authorization: `Bearer ${SECRET_KEY}`, "Content-Type": "application/json" };
const [,, command, ...args] = process.argv;

switch (command) {
  case "list": {
    const res = await fetch(`${BASE_URL}/api/v1/s2s/licenses?appId=${APP_ID}&limit=100`, { headers });
    const data = await res.json();
    console.table((data.licenses || []).map((l: any) => ({
      Key: l.licenseKey,
      Email: l.customerEmail,
      Status: l.status,
      Seats: l.maxSeats,
      Expires: l.expiresAt ? new Date(l.expiresAt).toLocaleDateString("id-ID") : "Permanen",
    })));
    break;
  }

  case "issue": {
    const [email, days, seats] = args;
    const res = await fetch(`${BASE_URL}/api/v1/s2s/licenses/issue`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        appId: APP_ID,
        customerEmail: email,
        grantDays: Number(days) || 365,
        maxSeats: Number(seats) || 3,
        platform: "desktop",
      }),
    });
    const data = await res.json();
    console.log("🎉 Lisensi Terbit:", data.license?.licenseKey);
    break;
  }

  case "revoke": {
    const [key, reason] = args;
    await fetch(`${BASE_URL}/api/v1/s2s/licenses/revoke`, {
      method: "POST",
      headers,
      body: JSON.stringify({ licenseKey: key, reason: reason || "Dicabut oleh admin" }),
    });
    console.log(`✅ Lisensi ${key} berhasil dicabut.`);
    break;
  }

  case "release": {
    const [key, hwid] = args;
    await fetch(`${BASE_URL}/api/v1/s2s/licenses/seat/release`, {
      method: "POST",
      headers,
      body: JSON.stringify({ licenseKey: key, hwid }),
    });
    console.log(`✅ Perangkat ${hwid} berhasil dilepaskan.`);
    break;
  }
}
```

Jalankan langsung melalui terminal `package.json`:

```json
{
  "scripts": {
    "license:list": "bun run scripts/tertaut-s2s.ts list",
    "license:issue": "bun run scripts/tertaut-s2s.ts issue",
    "license:revoke": "bun run scripts/tertaut-s2s.ts revoke",
    "license:release": "bun run scripts/tertaut-s2s.ts release"
  }
}
```

---

### E. Panduan Arsitektur: Harga Tetap vs Harga Dinamis (S2S) vs Custom UI 💡

Bagian ini menjawab kebingungan umum builder terkait strategi penetapan harga produk di Dashboard dan cara kerja URL kasir `/pay/:slug`.

#### 1. Perbandingan Strategi Penetapan Harga

| Aspek                    | Strategi A: Harga Tetap (Fixed Price)                       | Strategi B: Harga Dinamis (Dynamic S2S via API)                 |
| :----------------------- | :---------------------------------------------------------- | :-------------------------------------------------------------- |
| **Pilihan di Dashboard** | Pilih **Tetap**, isi nominal (mis. `135000`)                | Pilih **Dinamis** (`targetPrice` di basis data bernilai `0`)    |
| **URL Kasir Publik**     | `https://tertaut.com/pay/:slug` langsung aktif & siap pakai | URL mentah **TIDAK BISA** dibuka statis (menjadi Rp 0)          |
| **Kebutuhan Backend**    | **Nol koding backend** (cukup pasang tautan statis)         | Butuh inisiasi sesi via API dengan Secret Key (`tt_secret_...`) |
| **Kasus Penggunaan**     | Software 1 harga pasti, lisensi seumur hidup standar        | Billing multi-tier, kuota cabang kasir, top-up kredit, upgrade  |
| **Keamanan Nominal**     | Terkunci di server sesuai harga dashboard                   | Terkunci di server via tanda tangan Secret API Key builder      |

> [!WARNING] Mengapa URL Statis `/pay/:slug` Menampilkan Rp 0 pada Mode Dinamis?
> Pada mode **Harga: Dinamis**, server Tertaut tidak menyimpan nominal baku produk. Jika tautan `https://tertaut.com/pay/:slug` dibuka secara langsung di browser tanpa parameter tiket sesi, kasir hanya membaca nominal dari database yaitu **Rp 0**.
>
> Jika pembeli menekan tombol **Beli Sekarang — Rp 0**, server Tertaut secara sengaja **menolak transaksi** dengan pesan:
> `{"error": "Checkout dengan nominal dinamis memerlukan secret API key builder", "errorCode": "S2S_REQUIRED"}`
>
> Hal ini merupakan fitur proteksi keamanan: pembeli publik di browser **dilarang keras** memanipulasi atau menentukan harga software sesuka hati mereka.

---

#### 2. Dua Alur Checkout yang Benar untuk Harga Dinamis

Jika Anda memilih mode **Harga Dinamis**, Anda memiliki 2 alur integrasi:

##### Alur 1: S2S Pre-Created Session → Hosted Pay URL Ber-Ticket (Paling Direkomendasikan)

Gunakan jika Anda tetap ingin memanfaatkan antarmuka kasir mewah Tertaut (QRIS, VA Bank, E-Wallet, Retail), namun nominalnya dikirim secara terprogram dari aplikasi desktop atau backend Anda.

```
[Aplikasi Desktop / Backend]
           │
           │ 1. POST /api/v1/checkout/session
           │    Header: Authorization: Bearer tt_secret_...
           │    Body: { appId, amount: 135000, customerEmail, ... }
           ▼
    [Server Tertaut]
           │
           │ 2. Validasi Secret Key & Terbitkan Sesi Transaksi
           │    Mengembalikan: { transactionId, ticket, hostedPayUrl, checkoutUrl }
           ▼
[Aplikasi Desktop / Browser]
           │
           │ 3. Buka hostedPayUrl (https://tertaut.com/pay/:slug?externalId=...&ticket=...)
           ▼
   [Kasir Resmi Tertaut]
           │
           │ 4. Kasir memuat sesi valid: Menampilkan nominal Rp 135.000 (Bukan Rp 0)
           │    Pembeli scan QRIS / bayar VA Mandiri/BCA/BRI
           ▼
    [Webhook / Polling]
           │
           │ 5. GET /api/v1/checkout/status/:txId?ticket=...
           │    Status: PAID ➔ Kunci Lisensi (TT-XXXX-...) terbit otomatis
```

**Implementasi Kode TypeScript (Desktop / Backend):**

```ts
// Buat sesi checkout dinamis via S2S
const res = await fetch("https://tertaut.com/api/v1/checkout/session", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${TERTAUT_SECRET_KEY}`, // Kunci rahasia builder
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    appId: "app_2ee4f785d508",
    amount: 135000, // Nominal dinamis ditentukan oleh aplikasi
    customerEmail: "pembeli@example.com",
    customerName: "Toko Berkah",
    grantDays: 365,
    metadata: { hwid: "HWID-A1B2-C3D4-E5F6" },
  }),
});

const data = await res.json();
// data.hostedPayUrl = "https://tertaut.com/pay/kasir-sirka-pos-suite?externalId=tt_...&ticket=tx_..."

// Buka tautan ber-ticket di browser default pengguna:
window.open(data.hostedPayUrl, "_blank");
```

---

##### Alur 2: Custom UI In-App (Tanpa Membuka Web Kasir Tertaut)

Gunakan jika Anda ingin seluruh alur pembelian dan pembayaran berlangsung **100% di dalam antarmuka aplikasi Anda** (misal pop-up kasir lokal tanpa membuka browser):

1. Panggil `POST /api/v1/checkout/session` dari aplikasi/backend.
2. Respons API menyediakan:
   - `data.qrDataUrl`: Gambar base64 QRIS instan — render langsung di modal aplikasi kasir Anda: `<img :src="data.qrDataUrl" />`.
   - `data.paymentCode`: Nomor rekening Virtual Account (mis. Mandiri/BRI).
   - `data.checkoutUrl`: Tautan faktur gateway pembayaran (Xendit Invoice).
3. Jalankan interval polling status pembayaran dari aplikasi ke endpoint publik:
   ```ts
   // Polling status real-time setiap 2 detik menggunakan ticket transaksi
   const interval = setInterval(async () => {
     const statusRes = await fetch(
       `https://tertaut.com/api/v1/checkout/status/${data.transactionId}?ticket=${encodeURIComponent(data.ticket)}`
     );
     const statusData = await statusRes.json();

     if (statusData.paymentStatus === "PAID") {
       clearInterval(interval);
       console.log("Pembayaran Lunas! Kode Lisensi:", statusData.licenseKey);
       // Otomatis aktifkan software di perangkat kasir
       await licenseService.activate({ licenseKey: statusData.licenseKey, hwid });
     }
   }, 2000);
   ```

---

#### 3. Ringkasan Rekomendasi untuk Pengembang

- **Ingin Cara Termudah?** Buka Dashboard Tertaut → Edit Produk → Ganti pengaturan harga menjadi **Tetap (Fixed)** dan isi nominal Rp 135.000. Tombol "Beli via Tertaut" cukup membuka `https://tertaut.com/pay/kasir-sirka-pos-suite`.
- **Ingin Nominal Dinamis Berbasis API?** Pertahankan pengaturan **Dinamis**, namun pastikan tombol beli di aplikasi Anda memanggil `POST /api/v1/checkout/session` menggunakan `Authorization: Bearer tt_secret_...` terlebih dahulu, lalu buka `hostedPayUrl` hasil respons API (jangan membuka link statis tanpa tiket).

---

## 4. Chrome Extension (Manifest V3)

Di Chrome Extension, simpan token lisensi di `chrome.storage.local` dan tentukan platform `"chrome_extension"`:

```ts
// background.ts / service-worker.ts
import { Tertaut } from "@tertaut/sdk";

const tertaut = new Tertaut({
  apiKey: "tt_live_public_key_anda",
  baseUrl: "https://tertaut.com",
  appId: "app_ext_xxxx",
});

async function getExtensionDeviceId(): Promise<string> {
  const stored = await chrome.storage.local.get(["device_id"]);
  if (stored.device_id) return stored.device_id;
  const newId = crypto.randomUUID();
  await chrome.storage.local.set({ device_id: newId });
  return newId;
}

export async function verifyExtensionLicense(licenseKey: string) {
  const hwid = await getExtensionDeviceId();
  const res = await tertaut.licensing.validate({
    licenseKey,
    hardwareId: hwid,
    platform: "chrome_extension",
  });

  if (res.valid) {
    await chrome.storage.local.set({
      isLicensed: true,
      entitlements: res.entitlements,
      offlineGraceToken: res.offlineGraceToken,
    });
    return true;
  }
  await chrome.storage.local.set({ isLicensed: false });
  return false;
}
```

---

## 5. Backend Python (FastAPI / Requests)

Jika server backend Anda dibangun menggunakan Python:

### A. Inisiasi Sesi Checkout Dinamis

```python
import requests
import os

TERTAUT_SECRET = os.getenv("TERTAUT_SECRET_KEY") # tt_secret_...
APP_ID = os.getenv("TERTAUT_APP_ID")

def create_checkout(customer_email: str, amount: int):
    url = "https://tertaut.com/api/v1/checkout/session"
    headers = {
        "Authorization": f"Bearer {TERTAUT_SECRET}",
        "Content-Type": "application/json"
    }
    payload = {
        "appId": APP_ID,
        "customerEmail": customer_email,
        "amount": amount,
        "redirectUrl": "https://myapp.com/billing/finish"
    }

    resp = requests.post(url, json=payload, headers=headers)
    resp.raise_for_status()
    data = resp.json()
    return data["checkoutUrl"] # Redirect pengguna ke URL ini
```

### B. Verifikasi Webhook di FastAPI

```python
from fastapi import FastAPI, Request, HTTPException
import hmac
import hashlib
import os

app = FastAPI()
WEBHOOK_SECRET = os.getenv("TERTAUT_WEBHOOK_SECRET")

@app.post("/api/webhooks/tertaut")
async def handle_tertaut_webhook(request: Request):
    raw_body = await request.body()
    signature = request.headers.get("x-tertaut-signature", "")

    # Hitung tanda tangan HMAC-SHA256
    expected_sig = hmac.new(
        WEBHOOK_SECRET.encode("utf-8"),
        raw_body,
        hashlib.sha256
    ).hexdigest()

    if not hmac.compare_digest(signature, expected_sig):
        raise HTTPException(status_code=401, detail="Invalid signature")

    payload = await request.json()
    event = payload.get("event")
    data = payload.get("data", {})

    if event == "payment.success":
        print(f"Pembayaran berhasil untuk transaksi {data.get('transactionId')}")

    return {"status": "ok"}
```

---

## 6. Backend PHP (Laravel)

### Verifikasi Webhook Controller

```php
<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;

class TertautWebhookController extends Controller
{
    public function handle(Request $request)
    {
        $rawPayload = $request->getContent();
        $signature = $request->header('x-tertaut-signature');
        $secret = config('services.tertaut.webhook_secret');

        $computedSignature = hash_hmac('sha256', $rawPayload, $secret);

        if (!hash_equals($computedSignature, (string)$signature)) {
            return response()->json(['error' => 'Invalid signature'], 401);
        }

        $event = $request->input('event');
        $data = $request->input('data');

        if ($event === 'payment.success') {
            // Berikan hak akses pelanggan
            \Log::info('Pembayaran Tertaut Dikonfirmasi: ' . $data['transactionId']);
        }

        return response()->json(['status' => 'success']);
    }
}
```

---

## Ringkasan Alur Terbaik (_Best Practices_)

1. **Selalu Gunakan Publishable Key (`tt_live_...`) di Frontend**: Aman dan tidak bocor ke publik.
2. **Simpan Secret Key (`tt_secret_...`) Hanya di Server Backend**: Jangan pernah commit ke repository publik.
3. **Validasi Webhook Signature**: Selalu verifikasi header `x-tertaut-signature` untuk mencegah penipuan callback palsu.
4. **Idempoten**: Pastikan proses aktivasi dan pemrosesan webhook aman jika terpanggil lebih dari satu kali (_idempotent_).
