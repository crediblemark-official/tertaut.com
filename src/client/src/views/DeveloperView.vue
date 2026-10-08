<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { api } from "../lib/api";
import { dashboardEnv, envPath } from "../lib/environment";
import { useClipboard } from "../composables/useClipboard";
import { useConfirm } from "../composables/useConfirm";
import type { AppItem } from "../types/app";
import {
  KeyRound,
  ShieldAlert,
  Copy,
  Check,
  Eye,
  EyeOff,
  RefreshCw,
  Terminal,
  Code2,
  Webhook,
  Send,
  Plus,
  Trash2,
  ExternalLink,
  Lock,
  Globe,
  Radio,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileJson,
} from "lucide-vue-next";

const env = dashboardEnv;
const { copied, copy: copyClipboard } = useClipboard();
const { confirm: confirmDialog } = useConfirm();

const loading = ref(true);
const builderId = ref("");
const builderEmail = ref("");
const builderName = ref("");
const builderApiKey = ref("");
const secretApiKey = ref("");
const revealSecret = ref(false);
const rotatingSecret = ref(false);

const appsList = ref<AppItem[]>([]);
const endpoints = ref<any[]>([]);
const loadingEndpoints = ref(false);

const deliveries = ref<any[]>([]);
const loadingDeliveries = ref(false);
const retryingDeliveryId = ref<string | null>(null);
const selectedDelivery = ref<any | null>(null);
const isDeliveryModalOpen = ref(false);

const feedback = ref<{ type: "success" | "error"; text: string } | null>(null);
function setFeedback(type: "success" | "error", text: string) {
  feedback.value = { type, text };
  setTimeout(() => {
    feedback.value = null;
  }, 4500);
}

// Active code snippet tab
const activeTab = ref<"curl" | "node" | "python" | "php">("curl");
const activeSection = ref<"checkout" | "webhook">("checkout");

// Create Webhook modal state
const isWebhookModalOpen = ref(false);
const webhookUrlInput = ref("");
const isSubmittingWebhook = ref(false);
const webhookError = ref<string | null>(null);

const baseUrl = computed(() => {
  if (typeof window !== "undefined") {
    return `${window.location.origin}/api/v1`;
  }
  return "https://tertaut.com/api/v1";
});

const displayedSecretKey = computed(() => {
  const key = secretApiKey.value;
  if (!key) return "tt_secret_live_••••••••••••••••";
  if (revealSecret.value) return key;
  if (key.length <= 14) return "•".repeat(24);
  return key.slice(0, 10) + "•".repeat(key.length - 14) + key.slice(-4);
});

async function loadBuilderData() {
  loading.value = true;
  try {
    const [meRes, appsRes] = await Promise.all([api.getBuilderMyself(), api.getApps(env.value)]);

    if (meRes.success && meRes.builder) {
      builderId.value = meRes.builder.id;
      builderEmail.value = meRes.builder.email;
      builderName.value = meRes.builder.name;
      builderApiKey.value = meRes.builder.apiKey || "";
      secretApiKey.value = meRes.builder.secretApiKey || "";
    }
    appsList.value = appsRes.apps || [];
  } catch (err: any) {
    console.error("Gagal memuat kredensial builder:", err);
  } finally {
    loading.value = false;
  }
}

async function loadWebhooks() {
  loadingEndpoints.value = true;
  try {
    const res = await api.getWebhooks();
    endpoints.value = res.webhooks || [];
  } catch (err: any) {
    console.error("Gagal memuat webhooks:", err);
  } finally {
    loadingEndpoints.value = false;
  }
}

async function loadDeliveries() {
  loadingDeliveries.value = true;
  try {
    const res = await api.getWebhookDeliveries(30);
    deliveries.value = res.deliveries || [];
  } catch (err: any) {
    console.error("Gagal memuat log webhook:", err);
  } finally {
    loadingDeliveries.value = false;
  }
}

onMounted(() => {
  loadBuilderData();
  loadWebhooks();
  loadDeliveries();
});

watch(env, () => {
  loadBuilderData();
  loadWebhooks();
  loadDeliveries();
});

async function handleRotateSecret() {
  const ok = await confirmDialog({
    title: "Rotasi Secret API Key?",
    message:
      "Kunci lama akan langsung tidak berlaku. Anda harus memperbarui konfigurasi di server backend SaaS Anda agar permintaan checkout S2S tetap berjalan normal.",
    confirmText: "Ya, Rotasi Kunci Sekarang",
    cancelText: "Batal",
    variant: "danger",
  });
  if (!ok) return;

  rotatingSecret.value = true;
  try {
    const res = await api.rotateBuilderSecret();
    if (res.success && res.secretApiKey) {
      secretApiKey.value = res.secretApiKey;
      revealSecret.value = true;
      setFeedback("success", "Secret API key berhasil diperbarui!");
    } else {
      setFeedback("error", res.error || "Gagal merotasi secret key");
    }
  } catch (err: any) {
    setFeedback("error", err?.message || "Terjadi kesalahan saat rotasi key");
  } finally {
    rotatingSecret.value = false;
  }
}

async function handleCreateWebhook() {
  if (!webhookUrlInput.value.trim().startsWith("http")) {
    webhookError.value = "URL webhook harus valid dan diawali http:// atau https://";
    return;
  }
  isSubmittingWebhook.value = true;
  webhookError.value = null;
  try {
    const res = await api.createWebhook({
      url: webhookUrlInput.value.trim(),
      events: ["payment.success", "payment.failed"],
    });
    if (res.success) {
      isWebhookModalOpen.value = false;
      webhookUrlInput.value = "";
      setFeedback("success", "Endpoint webhook berhasil didaftarkan!");
      await loadWebhooks();
    } else {
      webhookError.value = res.error || "Gagal mendaftarkan webhook";
    }
  } catch (err: any) {
    webhookError.value = err?.message || "Terjadi kesalahan";
  } finally {
    isSubmittingWebhook.value = false;
  }
}

async function handleDeleteWebhook(id: string) {
  const ok = await confirmDialog({
    title: "Hapus Endpoint Webhook?",
    message: "Server Anda tidak akan lagi menerima notifikasi pembayaran dari endpoint ini.",
    confirmText: "Hapus",
    cancelText: "Batal",
    variant: "danger",
  });
  if (!ok) return;

  try {
    const res = await api.deleteWebhook(id);
    if (res.success) {
      setFeedback("success", "Endpoint webhook berhasil dihapus.");
      await loadWebhooks();
    }
  } catch (err: any) {
    setFeedback("error", err?.message || "Gagal menghapus webhook");
  }
}

async function handleTestWebhook(id: string) {
  try {
    const res = await api.testWebhook(id);
    if (res.success) {
      setFeedback("success", "Test ping delivery berhasil dikirim ke server Anda!");
      await loadDeliveries();
    } else {
      setFeedback("error", `Test delivery gagal: ${res.error || "Server tidak merespons"}`);
    }
  } catch (err: any) {
    setFeedback("error", err?.message || "Gagal menguji endpoint");
  }
}

async function handleRetryDelivery(id: string) {
  retryingDeliveryId.value = id;
  try {
    const res = await api.retryWebhookDelivery(id);
    if (res.success) {
      setFeedback("success", "Pengiriman webhook berhasil dicoba ulang!");
      await loadDeliveries();
    } else {
      setFeedback("error", res.error || "Gagal mengirim ulang webhook");
    }
  } catch (err: any) {
    setFeedback("error", err?.message || "Terjadi kesalahan sistem");
  } finally {
    retryingDeliveryId.value = null;
  }
}

function openDeliveryDetail(item: any) {
  selectedDelivery.value = item;
  isDeliveryModalOpen.value = true;
}

function getEndpointUrl(endpointId: string) {
  const ep = endpoints.value.find((e) => e.id === endpointId);
  return ep ? ep.url : endpointId || "-";
}

function formatTimestamp(dt: string | Date | null | undefined) {
  if (!dt) return "-";
  const d = new Date(dt);
  return d.toLocaleString("id-ID", {
    dateStyle: "short",
    timeStyle: "medium",
  });
}

// Sample target app for code preview
const sampleAppId = computed(() => appsList.value[0]?.id || "app_my_saas_01");
const sampleSecretKey = computed(() => secretApiKey.value || "tt_secret_live_your_key_here");

// Code Generator
const checkoutCurlSnippet = computed(() => {
  return `curl -X POST ${baseUrl.value}/checkout/session \\
  -H "Authorization: Bearer ${sampleSecretKey.value}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "appId": "${sampleAppId.value}",
    "orderId": "ORD-${Date.now().toString().slice(-6)}",
    "amount": 135000,
    "customerEmail": "pelanggan@domain.com",
    "customerName": "Budi Santoso",
    "description": "Langganan Paket Pro (3 Seats)",
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
  const response = await fetch("${baseUrl.value}/checkout/session", {
    method: "POST",
    headers: {
      "Authorization": "Bearer ${sampleSecretKey.value}",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      appId: "${sampleAppId.value}",
      orderId: "ORD-${Date.now().toString().slice(-6)}",
      amount: 135000, // Nominal dinamis dari kalkulasi SaaS Anda
      customerEmail: "pelanggan@domain.com",
      customerName: "Budi Santoso",
      description: "Langganan Paket Pro (3 Seats)",
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

url = "${baseUrl.value}/checkout/session"
headers = {
    "Authorization": "Bearer ${sampleSecretKey.value}",
    "Content-Type": "application/json"
}
payload = {
    "appId": "${sampleAppId.value}",
    "orderId": "ORD-0091",
    "amount": 135000,
    "customerEmail": "pelanggan@domain.com",
    "customerName": "Budi Santoso",
    "description": "Langganan Paket Pro (3 Seats)",
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
    "appId" => "${sampleAppId.value}",
    "orderId" => "ORD-" . time(),
    "amount" => 135000,
    "customerEmail" => "pelanggan@domain.com",
    "customerName" => "Budi Santoso",
    "description" => "Langganan Paket Pro (3 Seats)",
    "redirectUrl" => "https://namasaas.com/dashboard?billing=success",
    "metadata" => ["userId" => "usr_9981", "tier" => "pro"]
];

curl_setopt_array($curl, [
    CURLOPT_URL => "${baseUrl.value}/checkout/session",
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

const webhookNodeSnippet = computed(() => {
  return `import crypto from "crypto";

// Handler Webhook Express / Elysia / Fastify
export function handleTertautWebhook(req, res) {
  const signatureHeader = req.headers["x-tertaut-signature"] || req.headers["x-hub-signature-256"];
  const webhookSecret = "tt_whsec_your_endpoint_secret"; // Dari daftar webhook di atas

  // 1. Verifikasi keaslian signature HMAC
  const hmac = crypto.createHmac("sha256", webhookSecret);
  const digest = "hmac-sha256=" + hmac.update(req.rawBody || JSON.stringify(req.body)).digest("hex");

  if (signatureHeader !== digest) {
    return res.status(401).send("Invalid Signature");
  }

  // 2. Proses event sukses pembayaran
  const event = req.body;
  if (event.event === "payment.success") {
    const { transactionId, orderId, amount, customerEmail, metadata } = event.data;
    console.log(\`Pembayaran sukses untuk Order \${orderId}: Rp \${amount}\`);
    // Aktifkan kuota / upgrade paket pengguna di database SaaS Anda
  }

  res.status(200).json({ received: true });
}`;
});
</script>

<template>
  <div class="animate-fadeIn pb-16 max-w-6xl mx-auto space-y-6">
    <!-- Feedback Toast -->
    <div
      v-if="feedback"
      class="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 text-xs font-semibold rounded-xl shadow-xl transition-all"
      :class="feedback.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'"
    >
      <CheckCircle2 v-if="feedback.type === 'success'" class="w-4 h-4 shrink-0" />
      <AlertTriangle v-else class="w-4 h-4 shrink-0" />
      <span>{{ feedback.text }}</span>
      <button
        type="button"
        @click="feedback = null"
        class="text-white/80 hover:text-white font-bold ml-2 cursor-pointer"
      >
        ×
      </button>
    </div>

    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <div class="flex items-center gap-2">
          <h1 class="text-xl font-extrabold text-jetblack font-mono tracking-tight">
            Developer Portal
          </h1>
          <span
            class="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider"
            :class="
              env === 'sandbox'
                ? 'bg-amber-100 text-amber-800 border border-amber-300'
                : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
            "
          >
            {{ env }} Mode
          </span>
        </div>
        <p class="text-xs text-jetblack/60 mt-0.5">
          Kelola kredensial API pengembang (S2S), endpoint notifikasi webhook, dan integrasi Tertaut
          MoR.
        </p>
      </div>

      <div class="flex items-center gap-2">
        <a
          href="/docs/"
          target="_blank"
          class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-jetblack/15 text-xs font-semibold text-jetblack hover:bg-jetblack/5 transition"
        >
          <Code2 class="w-3.5 h-3.5 text-gold" />
          <span>Panduan SDK & API</span>
          <ExternalLink class="w-3 h-3 opacity-50" />
        </a>
      </div>
    </div>

    <!-- Kredensial Pengembang (Grid 2 Kolom) -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <!-- 1. Secret API Key (S2S) -->
      <div class="p-5 rounded-2xl bg-white border border-jetblack/10 shadow-2xs space-y-4">
        <div class="flex items-start justify-between">
          <div>
            <div class="flex items-center gap-2">
              <KeyRound class="w-4 h-4 text-rose-600" />
              <h2 class="text-xs font-bold uppercase tracking-wider text-jetblack">
                Secret API Key (S2S)
              </h2>
            </div>
            <p class="text-[11px] text-jetblack/50 mt-0.5">
              Dipakai di backend server SaaS Anda untuk membuat sesi checkout dinamis.
            </p>
          </div>
          <span
            class="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-50 text-rose-700 border border-rose-200"
          >
            PRIVATE
          </span>
        </div>

        <div class="space-y-1.5">
          <div
            class="flex items-center justify-between p-2.5 rounded-xl bg-jetblack/5 border border-jetblack/10 font-mono text-xs text-jetblack"
          >
            <span class="truncate mr-2 select-all">{{ displayedSecretKey }}</span>
            <div class="flex items-center gap-1 shrink-0">
              <button
                type="button"
                @click="revealSecret = !revealSecret"
                class="p-1 rounded hover:bg-jetblack/10 text-jetblack/60 hover:text-jetblack transition cursor-pointer"
                :title="revealSecret ? 'Sembunyikan' : 'Tampilkan'"
              >
                <EyeOff v-if="revealSecret" class="w-3.5 h-3.5" />
                <Eye v-else class="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                @click="copyClipboard(secretApiKey)"
                class="p-1 rounded hover:bg-jetblack/10 text-jetblack/60 hover:text-jetblack transition cursor-pointer"
                title="Salin Secret Key"
              >
                <Check v-if="copied" class="w-3.5 h-3.5 text-forest stroke-[3]" />
                <Copy v-else class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <p class="text-[10px] text-rose-600/90 font-medium">
            ⚠️ Jangan pernah letakkan kunci ini di kodingan frontend (browser/klien).
          </p>
        </div>

        <div class="pt-2 border-t border-jetblack/10 flex items-center justify-between">
          <span class="text-[10px] text-jetblack/50">Diperbarui: Otomatis</span>
          <button
            type="button"
            :disabled="rotatingSecret"
            @click="handleRotateSecret"
            class="inline-flex items-center gap-1.5 text-xs font-bold text-rose-600 hover:text-rose-700 transition cursor-pointer disabled:opacity-50"
          >
            <RefreshCw class="w-3 h-3" :class="{ 'animate-spin': rotatingSecret }" />
            <span>Rotasi Secret Key</span>
          </button>
        </div>
      </div>

      <!-- 2. Client / Publishable Key & API Base URL -->
      <div class="p-5 rounded-2xl bg-white border border-jetblack/10 shadow-2xs space-y-4">
        <div class="flex items-start justify-between">
          <div>
            <div class="flex items-center gap-2">
              <Globe class="w-4 h-4 text-forest" />
              <h2 class="text-xs font-bold uppercase tracking-wider text-jetblack">
                API Base URL &amp; Client Key
              </h2>
            </div>
            <p class="text-[11px] text-jetblack/50 mt-0.5">
              Alamat endpoint resmi Tertaut dan identitas builder pengembang.
            </p>
          </div>
          <span
            class="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-forest/10 text-forest border border-forest/20"
          >
            PUBLIC
          </span>
        </div>

        <div class="space-y-3">
          <div>
            <label
              class="block text-[10px] font-bold uppercase tracking-wider text-jetblack/50 mb-1"
            >
              Base URL Endpoint
            </label>
            <div
              class="flex items-center justify-between p-2 rounded-xl bg-jetblack/5 border border-jetblack/10 font-mono text-xs text-jetblack"
            >
              <span class="truncate mr-2">{{ baseUrl }}</span>
              <button
                type="button"
                @click="copyClipboard(baseUrl)"
                class="p-1 rounded hover:bg-jetblack/10 text-jetblack/60 hover:text-jetblack transition cursor-pointer"
                title="Salin Base URL"
              >
                <Copy class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div>
            <label
              class="block text-[10px] font-bold uppercase tracking-wider text-jetblack/50 mb-1"
            >
              Publishable Client Key
            </label>
            <div
              class="flex items-center justify-between p-2 rounded-xl bg-jetblack/5 border border-jetblack/10 font-mono text-xs text-jetblack"
            >
              <span class="truncate mr-2">{{ builderApiKey || "tt_live_public_key" }}</span>
              <button
                type="button"
                @click="copyClipboard(builderApiKey)"
                class="p-1 rounded hover:bg-jetblack/10 text-jetblack/60 hover:text-jetblack transition cursor-pointer"
                title="Salin Public Key"
              >
                <Copy class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        <div class="pt-2 border-t border-jetblack/10 text-[10px] text-jetblack/50">
          Akun Builder: <strong class="text-jetblack">{{ builderEmail }}</strong>
        </div>
      </div>
    </div>

    <!-- Webhook Endpoints (Outbox Notifikasi) -->
    <div class="p-6 rounded-2xl bg-white border border-jetblack/10 shadow-2xs space-y-4">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div class="flex items-center gap-2">
            <Webhook class="w-4 h-4 text-gold" />
            <h2 class="text-sm font-bold text-jetblack">
              Webhook Endpoints (Notifikasi Pembayaran)
            </h2>
          </div>
          <p class="text-xs text-jetblack/60 mt-0.5">
            Tertaut mengirimkan notifikasi HTTP POST bertanda tangan HMAC saat transaksi berhasil
            (payment.success).
          </p>
        </div>

        <button
          type="button"
          @click="isWebhookModalOpen = true"
          class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-jetblack text-white hover:bg-jetblack/90 text-xs font-bold transition cursor-pointer shadow-xs"
        >
          <Plus class="w-3.5 h-3.5 text-gold" />
          <span>Tambah Endpoint Webhook</span>
        </button>
      </div>

      <!-- Table of Registered Webhooks -->
      <div class="overflow-x-auto top-scrollbar -mx-6 px-6">
        <table class="w-full text-left text-xs whitespace-nowrap border-b border-jetblack/10">
          <thead
            class="border-b border-jetblack/15 text-[11px] font-semibold text-jetblack/70 bg-jetblack/[0.02]"
          >
            <tr>
              <th class="py-2.5 px-3">URL Endpoint</th>
              <th class="py-2.5 px-3">Webhook Secret (HMAC)</th>
              <th class="py-2.5 px-3">Events Langganan</th>
              <th class="py-2.5 px-3">Status</th>
              <th class="py-2.5 px-3 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-jetblack/10">
            <tr v-if="loadingEndpoints">
              <td colspan="5" class="py-6 text-center text-jetblack/40">Memuat endpoints...</td>
            </tr>
            <tr v-else-if="endpoints.length === 0">
              <td colspan="5" class="py-6 text-center text-jetblack/50">
                Belum ada endpoint webhook terdaftar. Klik tombol di atas untuk menambahkan URL
                webhook backend SaaS Anda.
              </td>
            </tr>
            <tr
              v-else
              v-for="ep in endpoints"
              :key="ep.id"
              class="hover:bg-jetblack/[0.02] transition"
            >
              <td class="py-3 px-3 font-mono font-semibold text-jetblack">
                {{ ep.url }}
              </td>
              <td class="py-3 px-3 font-mono text-jetblack/70">
                <div class="flex items-center gap-1.5">
                  <span class="bg-jetblack/5 px-1.5 py-0.5 rounded text-[10px]">
                    {{ ep.secret ? ep.secret.slice(0, 10) + "••••" : "tt_whsec_••••" }}
                  </span>
                  <button
                    type="button"
                    @click="copyClipboard(ep.secret)"
                    class="hover:text-forest transition p-0.5"
                    title="Salin Webhook Secret"
                  >
                    <Copy class="w-3 h-3" />
                  </button>
                </div>
              </td>
              <td class="py-3 px-3">
                <span
                  class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200"
                >
                  {{ ep.events?.length ? ep.events.join(", ") : "Semua Event" }}
                </span>
              </td>
              <td class="py-3 px-3">
                <span
                  class="px-2 py-0.5 rounded-full text-[10px] font-bold"
                  :class="
                    ep.isActive
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-neutral-100 text-neutral-500'
                  "
                >
                  {{ ep.isActive ? "Aktif" : "Nonaktif" }}
                </span>
              </td>
              <td class="py-3 px-3 text-right">
                <div class="flex items-center justify-end gap-1">
                  <button
                    type="button"
                    @click="handleTestWebhook(ep.id)"
                    class="px-2 py-1 rounded text-[11px] font-bold text-forest hover:bg-forest/10 transition inline-flex items-center gap-1 cursor-pointer"
                    title="Kirim payload ping uji coba ke endpoint ini"
                  >
                    <Send class="w-2.5 h-2.5" />
                    <span>Test Ping</span>
                  </button>
                  <button
                    type="button"
                    @click="handleDeleteWebhook(ep.id)"
                    class="px-2 py-1 rounded text-[11px] font-bold text-rose-600 hover:bg-rose-50 transition p-1 cursor-pointer"
                    title="Hapus webhook"
                  >
                    <Trash2 class="w-3 h-3" />
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Webhook Outbox Delivery Logs -->
    <div class="p-6 rounded-2xl bg-white border border-jetblack/10 shadow-2xs space-y-4">
      <div
        class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-jetblack/10 pb-4"
      >
        <div>
          <div class="flex items-center gap-2">
            <Radio class="w-4 h-4 text-emerald-600 animate-pulse" />
            <h2 class="text-sm font-bold text-jetblack">
              Riwayat Pengiriman Webhook (Outbox Logs)
            </h2>
          </div>
          <p class="text-xs text-jetblack/60 mt-0.5">
            Log dispatch webhook real-time ke server Anda dengan status pengiriman dan kemampuan
            retry manual.
          </p>
        </div>
        <button
          type="button"
          @click="loadDeliveries"
          :disabled="loadingDeliveries"
          class="px-3 py-1.5 rounded-xl border border-jetblack/15 text-xs font-bold text-jetblack/70 hover:text-jetblack hover:bg-jetblack/5 inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50 self-start sm:self-auto"
        >
          <RefreshCw class="w-3.5 h-3.5" :class="{ 'animate-spin': loadingDeliveries }" />
          <span>Muat Ulang Log</span>
        </button>
      </div>

      <div v-if="loadingDeliveries" class="py-8 text-center text-xs text-jetblack/50">
        Memuat log pengiriman webhook...
      </div>

      <div
        v-else-if="deliveries.length === 0"
        class="py-8 text-center border border-dashed border-jetblack/15 rounded-xl"
      >
        <Radio class="w-8 h-8 text-jetblack/20 mx-auto mb-2" />
        <p class="text-xs font-bold text-jetblack">Belum ada pengiriman webhook</p>
        <p class="text-[11px] text-jetblack/50 mt-1 max-w-sm mx-auto">
          Log pengiriman akan muncul secara otomatis ketika terjadi event pembayaran atau saat Anda
          menguji endpoint dengan Test Ping.
        </p>
      </div>

      <div v-else class="overflow-x-auto">
        <table class="w-full text-left text-xs">
          <thead>
            <tr
              class="border-b border-jetblack/10 text-jetblack/50 font-bold uppercase tracking-wider text-[10px]"
            >
              <th class="py-2.5 px-3">Status</th>
              <th class="py-2.5 px-3">Event</th>
              <th class="py-2.5 px-3">Target Endpoint</th>
              <th class="py-2.5 px-3 text-center">Percobaan</th>
              <th class="py-2.5 px-3">Terakhir Dicoba</th>
              <th class="py-2.5 px-3 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-jetblack/5">
            <tr v-for="del in deliveries" :key="del.id" class="hover:bg-jetblack/2 transition">
              <td class="py-3 px-3">
                <span
                  v-if="del.status === 'SENT'"
                  class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200"
                >
                  <CheckCircle2 class="w-3 h-3 text-emerald-600" />
                  <span>Terkirim</span>
                </span>
                <span
                  v-else-if="del.status === 'FAILED'"
                  class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200"
                >
                  <AlertTriangle class="w-3 h-3 text-rose-600" />
                  <span>Gagal</span>
                </span>
                <span
                  v-else
                  class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200"
                >
                  <Clock class="w-3 h-3 text-amber-600" />
                  <span>Pending</span>
                </span>
              </td>
              <td class="py-3 px-3">
                <span
                  class="font-mono text-[11px] font-bold text-jetblack bg-jetblack/5 px-2 py-0.5 rounded"
                >
                  {{ del.event || del.payload?.event || "event" }}
                </span>
              </td>
              <td class="py-3 px-3">
                <div
                  class="font-mono text-[11px] text-jetblack truncate max-w-[220px]"
                  :title="getEndpointUrl(del.endpointId)"
                >
                  {{ getEndpointUrl(del.endpointId) }}
                </div>
              </td>
              <td class="py-3 px-3 text-center">
                <span class="text-xs font-semibold text-jetblack/70">
                  {{ del.attempts || 1 }}x
                </span>
              </td>
              <td class="py-3 px-3 text-jetblack/60 text-[11px]">
                {{ formatTimestamp(del.lastAttemptAt || del.createdAt) }}
              </td>
              <td class="py-3 px-3 text-right">
                <div class="flex items-center justify-end gap-1.5">
                  <button
                    type="button"
                    @click="openDeliveryDetail(del)"
                    class="px-2 py-1 rounded text-[11px] font-bold text-jetblack/70 hover:bg-jetblack/5 transition inline-flex items-center gap-1 cursor-pointer"
                    title="Lihat detail payload JSON"
                  >
                    <FileJson class="w-3 h-3 text-gold" />
                    <span>Payload</span>
                  </button>
                  <button
                    type="button"
                    :disabled="retryingDeliveryId === del.id"
                    @click="handleRetryDelivery(del.id)"
                    class="px-2 py-1 rounded text-[11px] font-bold text-forest hover:bg-forest/10 transition inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    title="Coba kirim ulang webhook sekarang"
                  >
                    <RefreshCw
                      class="w-3 h-3"
                      :class="{ 'animate-spin': retryingDeliveryId === del.id }"
                    />
                    <span>{{ retryingDeliveryId === del.id ? "Mengirim..." : "Retry" }}</span>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Code Examples & Quickstart Sandbox (Tabbed) -->
    <div class="p-6 rounded-2xl bg-white border border-jetblack/10 shadow-2xs space-y-4">
      <div
        class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-jetblack/10 pb-4"
      >
        <div>
          <div class="flex items-center gap-2">
            <Terminal class="w-4 h-4 text-jetblack" />
            <h2 class="text-sm font-bold text-jetblack">
              Contoh Integrasi Kode (S2S Dynamic Payment)
            </h2>
          </div>
          <p class="text-xs text-jetblack/60 mt-0.5">
            Panggil endpoint ini dari backend SaaS Anda untuk membuat sesi bayar instan dengan
            nominal bebas.
          </p>
        </div>

        <!-- Language Tabs -->
        <div class="flex items-center p-1 rounded-xl bg-jetblack/5 border border-jetblack/10">
          <button
            type="button"
            v-for="tab in ['curl', 'node', 'python', 'php'] as const"
            :key="tab"
            @click="activeTab = tab"
            class="px-3 py-1 rounded-lg text-xs font-bold capitalize transition cursor-pointer"
            :class="
              activeTab === tab
                ? 'bg-jetblack text-white shadow-xs'
                : 'text-jetblack/60 hover:text-jetblack'
            "
          >
            {{ tab === "node" ? "Node.js" : tab }}
          </button>
        </div>
      </div>

      <!-- Code Box -->
      <div class="relative group">
        <button
          type="button"
          @click="
            copyClipboard(
              activeTab === 'curl'
                ? checkoutCurlSnippet
                : activeTab === 'node'
                  ? checkoutNodeSnippet
                  : activeTab === 'python'
                    ? checkoutPythonSnippet
                    : checkoutPhpSnippet
            )
          "
          class="absolute top-3 right-3 z-10 px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[11px] font-bold transition flex items-center gap-1.5 cursor-pointer backdrop-blur-md"
        >
          <Check v-if="copied" class="w-3.5 h-3.5 text-gold stroke-[3]" />
          <Copy v-else class="w-3.5 h-3.5" />
          <span>{{ copied ? "Tersalin" : "Salin Kode" }}</span>
        </button>

        <pre
          class="p-4 rounded-xl bg-jetblack text-neutral-100 font-mono text-xs overflow-x-auto top-scrollbar leading-relaxed"
        ><code>{{
          activeTab === 'curl'
            ? checkoutCurlSnippet
            : activeTab === 'node'
              ? checkoutNodeSnippet
              : activeTab === 'python'
                ? checkoutPythonSnippet
                : checkoutPhpSnippet
        }}</code></pre>
      </div>

      <!-- Webhook Verification Tip -->
      <div class="p-4 rounded-xl bg-gold/10 border border-gold/30 flex items-start gap-3">
        <Sparkles class="w-4 h-4 text-gold shrink-0 mt-0.5" />
        <div class="text-xs text-jetblack/80 space-y-1">
          <p class="font-bold text-jetblack">Verifikasi Keaslian Webhook di Server Anda:</p>
          <p>
            Setiap notifikasi webhook dikirim dengan header
            <code>X-Tertaut-Signature: hmac-sha256=...</code>. Cocokkan tanda tangan tersebut
            menggunakan HMAC-SHA256 bersama <code>Webhook Secret</code> Anda untuk memastikan
            payload benar-benar berasal dari Tertaut MoR.
          </p>
        </div>
      </div>
    </div>

    <!-- Modal Tambah Webhook -->
    <div
      v-if="isWebhookModalOpen"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-jetblack/60 backdrop-blur-xs animate-fadeIn"
    >
      <div
        class="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-jetblack/10 space-y-4"
      >
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <Webhook class="w-4 h-4 text-gold" />
            <h3 class="text-sm font-bold text-jetblack">Daftarkan Endpoint Webhook</h3>
          </div>
          <button
            type="button"
            @click="isWebhookModalOpen = false"
            class="text-jetblack/40 hover:text-jetblack cursor-pointer font-bold"
          >
            ×
          </button>
        </div>

        <div class="space-y-3">
          <div>
            <label class="block text-xs font-bold text-jetblack mb-1">
              URL Webhook Server SaaS
            </label>
            <input
              v-model="webhookUrlInput"
              type="url"
              placeholder="https://api.namasaas.com/webhooks/tertaut"
              class="w-full px-3 py-2 rounded-lg bg-white border border-jetblack/15 text-xs text-jetblack placeholder:text-jetblack/35 focus:outline-none focus:border-gold"
            />
            <p class="text-[10px] text-jetblack/50 mt-1">
              Endpoint ini wajib dapat diakses publik dan menerima HTTP POST request.
            </p>
          </div>

          <div
            v-if="webhookError"
            class="p-2.5 rounded-lg bg-rose-50 text-rose-700 text-xs font-medium"
          >
            {{ webhookError }}
          </div>
        </div>

        <div class="flex items-center justify-end gap-2 pt-2 border-t border-jetblack/10">
          <button
            type="button"
            @click="isWebhookModalOpen = false"
            class="px-3 py-1.5 rounded-lg border border-jetblack/15 text-xs font-bold text-jetblack/70 hover:text-jetblack cursor-pointer"
          >
            Batal
          </button>
          <button
            type="button"
            :disabled="isSubmittingWebhook"
            @click="handleCreateWebhook"
            class="px-4 py-1.5 rounded-lg bg-jetblack text-white hover:bg-jetblack/90 text-xs font-bold cursor-pointer disabled:opacity-50"
          >
            {{ isSubmittingWebhook ? "Mendaftarkan..." : "Daftarkan Endpoint" }}
          </button>
        </div>
      </div>
    </div>

    <!-- Modal Payload Detail Webhook -->
    <div
      v-if="isDeliveryModalOpen && selectedDelivery"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-jetblack/60 backdrop-blur-xs animate-fadeIn"
    >
      <div
        class="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-jetblack/10 space-y-4 max-h-[90vh] flex flex-col"
      >
        <div class="flex items-center justify-between border-b border-jetblack/10 pb-3">
          <div class="flex items-center gap-2">
            <Radio class="w-4 h-4 text-emerald-600" />
            <h3 class="text-sm font-bold text-jetblack">Detail Pengiriman Webhook</h3>
          </div>
          <button
            type="button"
            @click="isDeliveryModalOpen = false"
            class="text-jetblack/40 hover:text-jetblack cursor-pointer font-bold"
          >
            ×
          </button>
        </div>

        <div class="space-y-3 overflow-y-auto flex-1 pr-1 text-xs">
          <div class="grid grid-cols-2 gap-2 p-3 rounded-xl bg-jetblack/5">
            <div>
              <span class="text-[10px] text-jetblack/50 uppercase font-bold block"
                >Delivery ID</span
              >
              <span class="font-mono text-jetblack font-bold text-[11px] truncate block">{{
                selectedDelivery.id
              }}</span>
            </div>
            <div>
              <span class="text-[10px] text-jetblack/50 uppercase font-bold block">Event</span>
              <span class="font-mono text-jetblack font-bold text-[11px]">{{
                selectedDelivery.event
              }}</span>
            </div>
            <div>
              <span class="text-[10px] text-jetblack/50 uppercase font-bold block">Status</span>
              <span
                class="font-bold text-[11px]"
                :class="selectedDelivery.status === 'SENT' ? 'text-emerald-600' : 'text-rose-600'"
              >
                {{ selectedDelivery.status }}
              </span>
            </div>
            <div>
              <span class="text-[10px] text-jetblack/50 uppercase font-bold block">Percobaan</span>
              <span class="font-bold text-[11px]">{{ selectedDelivery.attempts }}x</span>
            </div>
          </div>

          <div>
            <div class="flex items-center justify-between mb-1.5">
              <span class="text-xs font-bold text-jetblack">HTTP Request Payload (JSON)</span>
              <button
                type="button"
                @click="copyClipboard(JSON.stringify(selectedDelivery.payload, null, 2))"
                class="inline-flex items-center gap-1 text-[11px] font-bold text-forest hover:underline cursor-pointer"
              >
                <Copy class="w-3 h-3" />
                <span>Salin JSON</span>
              </button>
            </div>
            <pre
              class="p-3 rounded-xl bg-jetblack text-jetblack-100 font-mono text-[11px] overflow-x-auto max-h-64 leading-relaxed border border-jetblack/20"
              >{{ JSON.stringify(selectedDelivery.payload, null, 2) }}</pre>
          </div>
        </div>

        <div class="flex items-center justify-between pt-3 border-t border-jetblack/10">
          <button
            type="button"
            :disabled="retryingDeliveryId === selectedDelivery.id"
            @click="handleRetryDelivery(selectedDelivery.id)"
            class="px-3.5 py-1.5 rounded-lg bg-forest text-white hover:bg-forest/90 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw
              class="w-3 h-3"
              :class="{ 'animate-spin': retryingDeliveryId === selectedDelivery.id }"
            />
            <span>Kirim Ulang Sekarang</span>
          </button>
          <button
            type="button"
            @click="isDeliveryModalOpen = false"
            class="px-4 py-1.5 rounded-lg border border-jetblack/15 text-xs font-bold text-jetblack/70 hover:text-jetblack cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
