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

## 3. Aplikasi Desktop (Electron / Tauri)

Aplikasi desktop membutuhkan sistem lisensi yang:

- Mengikat kursi lisensi ke perangkat keras (_Hardware ID / HWID_).
- Mampu berjalan saat offline (_offline-first_ berkat tanda tangan kriptografis Ed25519).
- Mendukung _floating license_ (kursi bergulir) bila lisensi dipakai bergantian di beberapa komputer.

```ts
// src/licensing.ts (Desktop App)
import { Tertaut } from "@tertaut/sdk";

const tertaut = new Tertaut({
  apiKey: "tt_live_public_key_anda",
  baseUrl: "https://tertaut.com",
  appId: "app_desktop_xxxx",
});

// A. Dapatkan Hardware ID unik (contoh fingerprint mesin)
function getMachineHwid(): string {
  // Pada Electron: gunakan node-machine-id atau hash CPU+Motherboard
  // Pada Tauri: invoke command Rust yang membaca serial hardware
  return "MACHINE-UUID-OR-HASH-SHA256";
}

// B. Aktivasi Lisensi Baru Pertama Kali
export async function activateApp(licenseKey: string) {
  const hwid = getMachineHwid();
  const res = await tertaut.licensing.activate({
    licenseKey,
    hwid,
    deviceName: "Laptop Kerja",
  });

  if (res.success && res.data) {
    // Simpan token offline Ed25519 di penyimpanan aman (mis. keytar / secure storage)
    localStorage.setItem("tt_offline_token", res.data.licenseToken);
    localStorage.setItem("tt_license_key", licenseKey);
    return res.data;
  }
  throw new Error(res.message || "Aktivasi gagal");
}

// C. Smart Check saat Aplikasi Dibuka (Online + Offline Fallback)
export async function checkAccessOnStartup() {
  const licenseKey = localStorage.getItem("tt_license_key") || "";
  const offlineToken = localStorage.getItem("tt_offline_token") || "";
  const hwid = getMachineHwid();

  const check = await tertaut.licensing.check({
    licenseKey,
    hwid,
    offlineToken,
    allowOfflineFallback: true, // Bila internet mati, verifikasi offline token Ed25519
  });

  if (!check.valid) {
    console.error("Akses ditolak:", check.reason);
    return false;
  }

  console.log(`Akses aktif (${check.source}) - Kadaluwarsa:`, check.expiresAt);
  // Cek feature flag
  if (check.hasFeature("export_4k")) {
    // Aktifkan fitur export 4k
  }
  return true;
}

// D. Floating License (Rolling Seat Lease) di Background
export function startSeatLease(leaseKey: string) {
  const licenseKey = localStorage.getItem("tt_license_key") || "";
  const hwid = getMachineHwid();

  const session = tertaut.licensing.startHeartbeatSession({
    licenseKey,
    hwid,
    leaseKey,
    intervalSeconds: 60,
    onSuccess: (res) => console.log("Seat diperpanjang hingga:", res.leaseExpiresAt),
    onLeaseExpired: () => {
      alert("Sesi perangkat Anda telah habis atau dialihkan ke komputer lain.");
      // Kunci akses UI aplikasi
    },
  });

  return session; // Panggil session.stop() saat aplikasi ditutup
}
```

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
