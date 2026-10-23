<script setup lang="ts">
import { ref, computed } from "vue";
import { Terminal, Copy, Check, Sparkles } from "lucide-vue-next";
import { useClipboard } from "../../composables/useClipboard";

const props = withDefaults(
  defineProps<{
    baseUrl: string;
    originUrl: string;
    currentAppId: string;
    currentAppName?: string;
    currentAppPrice: number;
    builderApiKey: string;
    secretApiKey: string;
  }>(),
  {
    currentAppName: "Paket Pro",
  }
);

const activeTab = ref<"sdk" | "curl" | "node" | "python" | "php">("sdk");
const { copied, copy: copyClipboard } = useClipboard();

const sampleSecretKey = computed(() => props.secretApiKey || "tt_secret_live_your_key_here");

const checkoutSdkSnippet = computed(() => {
  return `import { Tertaut } from "@tertaut/sdk";

// Inisialisasi SDK klien
const tertaut = new Tertaut({
  apiKey: "${props.builderApiKey || "tt_live_public_key"}",
  baseUrl: "${props.originUrl}",
  appId: "${props.currentAppId}",
});

// 1. Buat sesi Hosted Checkout MoR (browser/klien)
const { checkoutUrl, transactionId } = await tertaut.checkout({
  amount: ${props.currentAppPrice},
  customerEmail: "pelanggan@domain.com",
  redirectUrl: "https://namasaas.com/dashboard?billing=success",
  autoRedirect: true, // Otomatis alihkan browser ke halaman pembayaran
});

// 2. Aktivasi & Binding Lisensi Perangkat
const res = await tertaut.licensing.activate({
  licenseKey: "TT-XXXX-XXXX-XXXX",
  hwid: "device_hardware_fingerprint",
  deviceName: "MacBook Pro",
});
console.log("Token offline Ed25519:", res.data.licenseToken);`;
});

const checkoutCurlSnippet = computed(() => {
  return `curl -X POST ${props.baseUrl}/checkout/session \\
  -H "Authorization: Bearer ${sampleSecretKey.value}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "appId": "${props.currentAppId}",
    "orderId": "ORD-${Date.now().toString().slice(-6)}",
    "amount": ${props.currentAppPrice},
    "customerEmail": "pelanggan@domain.com",
    "customerName": "Budi Santoso",
    "description": "Langganan ${props.currentAppName}",
    "paymentRail": "qris",
    "redirectUrl": "https://namasaas.com/dashboard?billing=success",
    "metadata": {
      "userId": "usr_9981",
      "tier": "pro"
    }
  }'`;
});

const checkoutNodeSnippet = computed(() => {
  return `import fetch from "node-fetch";

async function createCheckout() {
  const response = await fetch("${props.baseUrl}/checkout/session", {
    method: "POST",
    headers: {
      "Authorization": "Bearer ${sampleSecretKey.value}",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      appId: "${props.currentAppId}",
      orderId: "ORD-${Date.now().toString().slice(-6)}",
      amount: ${props.currentAppPrice}, // Nominal dinamis dari kalkulasi SaaS Anda
      customerEmail: "pelanggan@domain.com",
      customerName: "Budi Santoso",
      description: "Langganan ${props.currentAppName}",
      redirectUrl: "https://namasaas.com/dashboard?billing=success",
      metadata: { userId: "usr_9981", tier: "pro" }
    })
  });

  const data = await response.json();
  if (data.success) {
    // Alihkan pembeli ke halaman kasir resmi Tertaut
    console.log("Hosted Checkout URL:", data.checkoutUrl);
    // window.location.href = data.checkoutUrl;
  }
}`;
});

const checkoutPythonSnippet = computed(() => {
  return `import requests

url = "${props.baseUrl}/checkout/session"
headers = {
    "Authorization": "Bearer ${sampleSecretKey.value}",
    "Content-Type": "application/json"
}
payload = {
    "appId": "${props.currentAppId}",
    "orderId": "ORD-0091",
    "amount": ${props.currentAppPrice},
    "customerEmail": "pelanggan@domain.com",
    "customerName": "Budi Santoso",
    "description": "Langganan ${props.currentAppName}",
    "redirectUrl": "https://namasaas.com/dashboard?billing=success",
    "metadata": {"userId": "usr_9981", "tier": "pro"}
}

response = requests.post(url, json=payload, headers=headers)
data = response.json()
print("Checkout URL:", data.get("checkoutUrl"))`;
});

const checkoutPhpSnippet = computed(() => {
  return `<?php
$curl = curl_init();

$payload = [
    "appId" => "${props.currentAppId}",
    "orderId" => "ORD-" . time(),
    "amount" => ${props.currentAppPrice},
    "customerEmail" => "pelanggan@domain.com",
    "customerName" => "Budi Santoso",
    "description" => "Langganan ${props.currentAppName}",
    "redirectUrl" => "https://namasaas.com/dashboard?billing=success",
    "metadata" => ["userId" => "usr_9981", "tier" => "pro"]
];

curl_setopt_array($curl, [
    CURLOPT_URL => "${props.baseUrl}/checkout/session",
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => json_encode($payload),
    CURLOPT_HTTPHEADER => [
        "Authorization: Bearer ${sampleSecretKey.value}",
        "Content-Type: application/json"
    ],
]);

$response = curl_exec($curl);
$data = json_decode($response, true);
curl_close($curl);

// Redirect pembeli ke kasir Tertaut
header("Location: " . $data["checkoutUrl"]);
exit;`;
});

const currentSnippet = computed(() => {
  switch (activeTab.value) {
    case "sdk":
      return checkoutSdkSnippet.value;
    case "curl":
      return checkoutCurlSnippet.value;
    case "node":
      return checkoutNodeSnippet.value;
    case "python":
      return checkoutPythonSnippet.value;
    case "php":
      return checkoutPhpSnippet.value;
  }
});
</script>

<template>
  <div
    class="-mx-3.5 sm:-mx-4 md:-mx-6 px-3.5 sm:px-4 md:px-6 border-b border-jetblack/15 py-5 space-y-3"
  >
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div>
        <div class="flex items-center gap-2">
          <Terminal class="w-4 h-4 text-gold" />
          <h2 class="text-sm font-bold text-jetblack">
            Contoh Integrasi Kode (S2S Dynamic Payment &amp; SDK)
          </h2>
        </div>
        <p class="text-xs text-jetblack/60 mt-0.5">
          Gunakan cuplikan kode di bawah untuk mengintegrasikan backend SaaS Anda dengan engine MoR
          Tertaut.
        </p>
      </div>

      <!-- Language Tabs -->
      <div
        class="flex items-center p-0.5 rounded-lg bg-jetblack/5 border border-jetblack/15 overflow-x-auto top-scrollbar max-w-full"
      >
        <button
          type="button"
          v-for="tab in ['sdk', 'curl', 'node', 'python', 'php'] as const"
          :key="tab"
          @click="activeTab = tab"
          class="px-2.5 py-1 rounded text-xs font-bold transition cursor-pointer whitespace-nowrap"
          :class="
            activeTab === tab
              ? 'btn-gold shadow-xs'
              : 'text-jetblack/60 hover:text-jetblack hover:bg-white/50'
          "
        >
          {{
            tab === "sdk" ? "SDK (@tertaut/sdk)" : tab === "node" ? "Node.js" : tab.toUpperCase()
          }}
        </button>
      </div>
    </div>

    <!-- Code Box -->
    <div class="relative group">
      <button
        type="button"
        @click="copyClipboard(currentSnippet)"
        class="absolute top-3 right-3 z-10 px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[11px] font-bold transition flex items-center gap-1.5 cursor-pointer backdrop-blur-md"
      >
        <Check v-if="copied" class="w-3.5 h-3.5 text-gold stroke-[3]" />
        <Copy v-else class="w-3.5 h-3.5" />
        <span>{{ copied ? "Tersalin" : "Salin Kode" }}</span>
      </button>

      <pre
        class="p-4 rounded-xl bg-jetblack text-neutral-100 font-mono text-xs overflow-x-auto top-scrollbar leading-relaxed border border-jetblack/20"
      ><code>{{ currentSnippet }}</code></pre>
    </div>

    <!-- Webhook Verification Tip -->
    <div class="p-3 rounded-lg bg-gold/10 border border-gold/30 flex items-start gap-2.5">
      <Sparkles class="w-4 h-4 text-gold shrink-0 mt-0.5" />
      <div class="text-xs text-jetblack/80 space-y-1">
        <p class="font-bold text-jetblack">Verifikasi Keaslian Webhook di Server Anda:</p>
        <p class="leading-relaxed">
          Setiap notifikasi webhook dikirim dengan header
          <code class="font-mono bg-white/70 px-1 py-0.5 rounded text-[11px]"
            >X-Tertaut-Signature: hmac-sha256=...</code
          >. Cocokkan tanda tangan tersebut menggunakan HMAC-SHA256 bersama
          <code class="font-mono bg-white/70 px-1 py-0.5 rounded text-[11px]">Webhook Secret</code>
          Anda untuk memastikan payload benar-benar berasal dari Tertaut MoR.
        </p>
      </div>
    </div>
  </div>
</template>
