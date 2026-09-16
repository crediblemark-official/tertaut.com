# SPESIFIKASI PRODUK DETIL (PRD) — MODUL 4: AI API PROXY SHIELD & COST GUARDRAILS

**Versi**: 3.0 (Serverless AI Gateway with Encrypted Vault & Token Guardrails)  
**Status**: Approved for Engineering  
**Modul Parent**: tertaut.com (Engine Infrastructure)  
**Tech Stack Alignment**: ElysiaJS (Bun) + SSE (Server-Sent Events) + AES-256-GCM Vault + PostgreSQL / SQLite  

---

## 1. Metadata Dokumen

| Parameter | Detail |
|---|---|
| **Nama Modul** | AI API Proxy Shield & Cost Guardrails |
| **Kode Modul** | MOD-04 |
| **Target User** | AI App Builders, Chrome Extension Creators, Desktop App Developers (Tauri/Electron), Mobile Developers |
| **Tujuan Utama** | Mengamankan API Key provider AI (OpenAI, Anthropic, Gemini, DeepSeek) agar tidak bocor di client-side, serta mengendalikan penggunaan token dan kuota secara presisi. |
| **Mekanisme Keamanan** | AES-256-GCM Secret Vault + Dynamic Rate Limiting + License JWT Binding |
| **Integrasi Utama** | Modul 3 (Universal Licensing Engine) & `@tertaut/sdk` |

---

## 2. Ringkasan & Visi Modul

Modul 4 menyelesaikan masalah terbesar pengembang aplikasi berbasis AI (*client-side AI apps*): **kebocoran kredensial dan pembengkakan tagihan API tak terkendali**.

Ketika vibe coder membuat ekstensi Chrome atau aplikasi desktop yang memanggil AI (misalnya OpenAI, Anthropic, Gemini API), menanamkan API Key langsung di dalam kode client-side sangat berbahaya karena kunci tersebut mudah diekstrak melalui *decompilation* atau *network inspection*. Jika kunci bocor, orang tak dikenal dapat menguras kuota API milik builder.

Modul 4 hadir sebagai **AI Proxy Gateway** yang aman dan ringan:
- **Encrypted Vault**: API Key rahasia disimpan di server `tertaut.com` terenkripsi aman (AES-256-GCM).
- **Zero-Trust Client SDK**: Aplikasi pengguna akhir (client) hanya mengirimkan Lisensi JWT valid dari Modul 3. Server `tertaut.com` menyuntikkan API Key resmi dan meneruskan permintaan ke provider AI.
- **Cost Guardrails & Token Metering**: Membatasi jumlah request, penggunaan input/output token, serta menetapkan batas pengeluaran harian/bulanan per pengguna atau per aplikasi.

---

## 3. Spesifikasi Arsitektur AI Proxy

```
[ Client App (Chrome Ext / Desktop / Mobile) ]
                      │
                      │ (1) Send Request + License JWT
                      ▼
        [ ElysiaJS AI Proxy Shield ]
                      │
                      ├── (2) Validate License JWT (Modul 3 Engine)
                      ├── (3) Check Rate Limit & Token Usage Quota
                      ├── (4) Decrypt Provider API Key from Vault (AES-256-GCM)
                      │
                      ▼ (5) Forward Request with Injected Key
            [ AI Provider API ]
    (OpenAI / Anthropic / Gemini / DeepSeek)
                      │
                      ▼ (6) Streaming SSE Response Relay
        [ ElysiaJS AI Proxy Shield ]
                      │
                      ▼ (7) Relay Stream & Record Token Usage
[ Client App (UI Render) ]
```

---

## 4. Persyaratan Fungsional (Functional Requirements)

### 4.1 Encrypted Vault & Provider Key Management
- **FR-1.1 (Multi-Provider Support)**: Vault mendukung penyimpanan API Key dari berbagai provider populer:
  - **OpenAI**: `gpt-4o`, `gpt-4o-mini`, dll.
  - **Anthropic**: `claude-3-5-sonnet`, `claude-3-opus`, dll.
  - **Google Gemini**: `gemini-1.5-pro`, `gemini-1.5-flash`, dll.
  - **DeepSeek**: `deepseek-chat` (DeepSeek-V3), `deepseek-reasoner` (DeepSeek-R1).
  - **Custom OpenAI-Compatible Endpoints**: Ollama, Groq, Together AI.
- **FR-1.2 (Vault Encryption)**: Seluruh API Key disimpan pada database dalam format terenkripsi menggunakan algoritma AES-256-GCM dengan Kunci Master (*Master Key*) yang diisolasi di lingkungan server.

### 4.2 License-Aware Authentication & Verification
- **FR-2.1 (Entitlement Validation)**: Setiap panggilan ke endpoint AI Proxy wajib menyertakan token Lisensi JWT valid yang diproduksi oleh Modul 3 (atau Authorization Header).
- **FR-2.2 (Kill-Switch Active Status Check)**: Panggilan ditolak dengan kode status `403 License Suspended/Revoked` apabila lisensi dalam status terblokir (`REVOKED` atau `EXPIRED`).

### 4.3 Token Metering & Cost Guardrails
- **FR-3.1 (Usage Metering)**: Sistem mencatat jumlah prompt tokens ($T_{\text{in}}$) dan completion tokens ($T_{\text{out}}$) untuk setiap panggilan API.
- **FR-3.2 (Quota Allocation Engine)**: Builder dapat mengonfigurasi batas penggunaan untuk pengguna akhir:
  - **Strict Request Rate Limit**: Maksimal $R_{\text{max}}$ panggilan per menit (misal: $15\text{ req/min}$).
  - **Daily Token Cap**: Maksimal kuota token harian ($T_{\text{daily}} \le T_{\text{max}}$).
  - **Monthly Budget Ceiling**: Batas anggaran maksimum bulanan builder dalam IDR.
- **FR-3.3 (Auto Cut-Off / Cost Ceiling)**: Apabila pengguna melebihi kuota harian atau aplikasi mencapai anggaran maksimum bulanan, sistem otomatis menolak permintaan berikutnya dengan kode status `429 Quota Exceeded`.

### 4.4 Low-Latency Streaming Relay (SSE)
- **FR-4.1 (Server-Sent Events Support)**: Proxy wajib mendukung penyaluran ulang (*streaming relay*) berbasis Server-Sent Events (SSE) tanpa memutus atau menunda chunk data dari provider AI.
- **FR-4.2 (Zero-Storage Privacy Rule)**: Proxy **TIDAK MENYIMPAN** isi teks prompt atau jawaban AI dari pengguna akhir ke database. Hanya jumlah statistik token yang dicatat untuk keperluan rekonsiliasi kuota dan audit.

---

## 5. End-to-End Workflows

### 5.1 Builder Setup Workflow
1. Builder masuk ke Dashboard tertaut.com $\rightarrow$ Menu **AI Proxy Shield**.
2. Builder menambahkan provider baru (misal: OpenAI) dan memasukkan API Key `sk-proj-...`.
3. Backend ElysiaJS mengenkripsi kunci menggunakan AES-256-GCM dan menyimpannya ke database vault.
4. Builder menentukan aturan kuota (misal: Maksimal $50.000$ token per hari per pengguna lisensi Pro).
5. Builder mendapatkan `modelAlias` (misal: `fast-summary-model`) untuk digunakan pada `@tertaut/sdk`.

### 5.2 Client Application Execution Workflow
1. Pengguna akhir membuka aplikasi desktop/ekstensi Chrome dan mengetikkan prompt.
2. SDK mengirimkan request ke `POST /api/v1/ai/chat` membawa payload:
   - Header `Authorization: Bearer {LICENSE_JWT}`
   - Body `modelAlias`, `messages`, dan parameter `stream: true`.
3. Proxy memverifikasi JWT via Modul 3, memastikan kuota token pengguna masih mencukupi.
4. Proxy mengonversi `modelAlias` menjadi provider asli, mendekripsi API Key terkait dari Vault.
5. Proxy meneruskan request ke API resmi provider AI.
6. Response berupa aliran data (*stream*) diteruskan secara real-time ke SDK client.
7. Setelah aliran selesai, Proxy menghitung penggunaan token aktual ($T_{\text{in}} + T_{\text{out}}$) dan memperbarui tabel statistik kuota.

---

## 6. Skema Data (Database Schema)

```sql
-- Tabel Vault Kunci Provider AI (Terenkripsi AES-256-GCM)
CREATE TABLE ai_provider_keys (
    id VARCHAR(36) PRIMARY KEY,
    builder_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider_name VARCHAR(50) NOT NULL, -- OPENAI, ANTHROPIC, GEMINI, DEEPSEEK, CUSTOM
    key_name VARCHAR(100) NOT NULL,    -- Contoh: "OpenAI Production Key"
    encrypted_api_key TEXT NOT NULL,   -- Hasil enkripsi AES-256-GCM
    iv_vector VARCHAR(100) NOT NULL,
    base_url TEXT,                     -- Kosong jika menggunakan default provider endpoint
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_ai_keys_builder ON ai_provider_keys(builder_id);

-- Tabel Konfigurasi Model & Guardrails Aplikasi
CREATE TABLE ai_app_configs (
    id VARCHAR(36) PRIMARY KEY,
    app_id VARCHAR(36) NOT NULL REFERENCES checkout_apps(id) ON DELETE CASCADE,
    provider_key_id VARCHAR(36) NOT NULL REFERENCES ai_provider_keys(id) ON DELETE RESTRICT,
    model_alias VARCHAR(100) NOT NULL,  -- Contoh: "fast-summary-model"
    target_model_name VARCHAR(100) NOT NULL, -- Contoh: "gpt-4o-mini"
    max_requests_per_min INT DEFAULT 15,
    daily_token_limit INT DEFAULT 100000, -- 0 = Unlimited
    monthly_budget_idr DECIMAL(12, 2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_app_model_alias UNIQUE(app_id, model_alias)
);

CREATE INDEX idx_ai_configs_app ON ai_app_configs(app_id);

-- Tabel Log Penggunaan Token (Statistik Anonim)
CREATE TABLE ai_usage_logs (
    id VARCHAR(36) PRIMARY KEY,
    license_id VARCHAR(36) REFERENCES licenses(id) ON DELETE SET NULL,
    app_id VARCHAR(36) NOT NULL REFERENCES checkout_apps(id) ON DELETE CASCADE,
    model_alias VARCHAR(100) NOT NULL,
    prompt_tokens INT NOT NULL DEFAULT 0,
    completion_tokens INT NOT NULL DEFAULT 0,
    total_tokens INT NOT NULL DEFAULT 0,
    response_time_ms INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_ai_usage_license ON ai_usage_logs(license_id);
CREATE INDEX idx_ai_usage_app_time ON ai_usage_logs(app_id, created_at);
```

---

## 7. Spesifikasi API & SDK Contract

### 7.1 Backend API Endpoints (ElysiaJS Backend)

#### A. Execute AI Chat Stream / Non-Stream
- **Endpoint**: `POST /api/v1/ai/chat` (dan alias `/api/v1/ai-proxy/chat`)
- **Headers**:
  - `Authorization: Bearer {LICENSE_JWT_TOKEN}`
  - `Content-Type: application/json`
- **Payload**:
```json
{
  "modelAlias": "fast-summary-model",
  "messages": [
    {
      "role": "system",
      "content": "You are a helpful reading assistant."
    },
    {
      "role": "user",
      "content": "Ringkas artikel berikut..."
    }
  ],
  "temperature": 0.7,
  "stream": true
}
```
- **Response (200 OK - SSE Stream)**:
```text
data: {"id":"chatcmpl-123","choices":[{"delta":{"content":"Ringkasan"}}]}

data: {"id":"chatcmpl-123","choices":[{"delta":{"content":" artikel..."}}]}

data: [DONE]
```

#### B. Fetch Usage Quota Status
- **Endpoint**: `GET /api/v1/ai/quota-status` (dan alias `/api/v1/ai-proxy/quota-status`)
- **Headers**: `Authorization: Bearer {LICENSE_JWT_TOKEN}`
- **Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "dailyTokensUsed": 14200,
    "dailyTokenLimit": 100000,
    "remainingTokens": 85800,
    "resetInSeconds": 34200
  }
}
```

### 7.2 `@tertaut/sdk` Integration Example

```typescript
import { Tertaut } from '@tertaut/sdk';

const tertaut = new Tertaut({ appId: 'app_987123' });

async function runAISummary() {
  const stream = await tertaut.aiProxy.chatStream({
    licenseToken: userSavedJwt,
    modelAlias: 'fast-summary-model',
    messages: [
      { role: 'user', content: 'Ringkas teks ini...' }
    ]
  });

  for await (const chunk of stream) {
    console.log(chunk.text);
  }
}
```

---

## 8. Persyaratan Non-Fungsional (NFR)

- **Latensi Overhead Minim**: Latensi tambahan yang disebabkan oleh verifikasi token dan enkripsi Vault pada proxy wajib $< 50\text{ ms}$.
- **Zero Text Retention (Privasi)**: Server dilarang menyimpan teks prompt atau tanggapan pengguna ke basis data atau berkas log internal untuk menjamin privasi pengguna akhir.
- **High Throughput Streaming**: Pipa transmisi SSE wajib dapat menangani hingga $1.000$ koneksi streaming paralel per node instance ElysiaJS tanpa kebocoran memori (*memory leak*).
- **Graceful Upstream Handling**: Memberikan pesan kesalahan terstruktur jika upstream AI provider mengalami *rate-limit* atau gangguan koneksi jaringan.