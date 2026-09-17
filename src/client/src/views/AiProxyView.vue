<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import {
  api,
  type AppItem,
  type VaultCredentialItem,
  type AiProxyLogItem,
  type AiQuotaStatus,
  type AiProvider
} from '../lib/api'
import { dashboardEnv } from '../lib/environment'
import { Bot, RefreshCw, CheckCircle2 } from 'lucide-vue-next'
import TokenGuardrailsWidget from '../components/aiproxy/TokenGuardrailsWidget.vue'
import SecurityPillars from '../components/aiproxy/SecurityPillars.vue'
import VaultCredentialsManager from '../components/aiproxy/VaultCredentialsManager.vue'
import AiProxyAuditTable from '../components/aiproxy/AiProxyAuditTable.vue'
import AiStreamingPlayground from '../components/aiproxy/AiStreamingPlayground.vue'

const appsList = ref<AppItem[]>([])
const selectedAppId = ref('')

const vaultCreds = ref<VaultCredentialItem[]>([])
const proxyLogs = ref<AiProxyLogItem[]>([])
const loadingVault = ref(false)

// Add/Edit Vault Key State
const newProvider = ref<AiProvider>('gemini')
const newRawKey = ref('')
const newBudget = ref(500000)
const isSavingKey = ref(false)
const vaultAlert = ref<string | null>(null)

// AI Chat Playground & Guardrails State
const licenseKey = ref('')
const modelAlias = ref('fast-summary-model')
const streamMode = ref(true)
const userPrompt = ref('Rangkumkan email penting dari investor ini dalam 3 poin actionable.')
const loading = ref(false)
const aiResult = ref<any>(null)
const streamedText = ref('')
const quotaStatus = ref<AiQuotaStatus | null>(null)

async function loadAppsAndData() {
  try {
    const [appsRes, licRes] = await Promise.all([
      api.getApps(),
      api.getLicenses(),
    ])
    appsList.value = appsRes.apps || []
    if (appsRes.apps && appsRes.apps.length > 0 && !selectedAppId.value) {
      selectedAppId.value = appsRes.apps[0].id
    }
    const matchingLic = (licRes.licenses || []).find(
      (l) => l.appId === selectedAppId.value && l.status === 'ACTIVE'
    )
    if (matchingLic) {
      licenseKey.value = matchingLic.licenseKey
    } else if ((licRes.licenses || []).length > 0) {
      licenseKey.value = licRes.licenses[0].licenseKey
    }
  } catch (err) {
    console.error('Failed to load apps & licenses:', err)
  }

  await fetchData()
}

async function fetchQuota() {
  if (!licenseKey.value) return
  try {
    const res = await api.getAiQuotaStatus(licenseKey.value, modelAlias.value)
    if (res.success && res.data) {
      quotaStatus.value = res.data
    }
  } catch (err) {
    console.error('Failed to fetch quota:', err)
  }
}

async function fetchData() {
  loadingVault.value = true
  try {
    const [vaultRes, logsRes] = await Promise.all([
      api.getAiVault(selectedAppId.value),
      api.getAiProxyLogs(selectedAppId.value),
    ])
    vaultCreds.value = vaultRes.credentials || []
    proxyLogs.value = logsRes.logs || []
    await fetchQuota()
  } catch (err) {
    console.error('Failed to load AI Vault data:', err)
  } finally {
    loadingVault.value = false
  }
}

async function saveKeyToVault() {
  if (!newRawKey.value) return
  isSavingKey.value = true
  try {
    const res = await api.saveAiVault({
      appId: selectedAppId.value,
      provider: newProvider.value,
      rawApiKey: newRawKey.value,
      monthlyBudgetLimit: newBudget.value,
    })
    if (res.success) {
      vaultAlert.value = res.message || 'Kredensial berhasil disimpan ke Vault!'
      newRawKey.value = ''
      setTimeout(() => {
        vaultAlert.value = null
      }, 5000)
      await fetchData()
    }
  } finally {
    isSavingKey.value = false
  }
}

async function toggleKillSwitch(cred: VaultCredentialItem) {
  try {
    const res = await api.toggleAiKillSwitch({
      appId: selectedAppId.value,
      provider: cred.provider,
    })
    if (res.success) {
      vaultAlert.value = res.message || 'Status Kill-Switch berhasil diubah.'
      setTimeout(() => {
        vaultAlert.value = null
      }, 4000)
      await fetchData()
    }
  } catch (e) {
    console.error(e)
  }
}

async function testAiCall() {
  if (!userPrompt.value) return
  loading.value = true
  streamedText.value = ''
  aiResult.value = null

  const startT = Date.now()

  try {
    if (streamMode.value) {
      aiResult.value = {
        isStreaming: true,
        text: '',
        provider: newProvider.value,
        model: modelAlias.value,
      }
      await api.streamAiChat(
        {
          licenseKey: licenseKey.value,
          appId: selectedAppId.value,
          modelAlias: modelAlias.value,
          prompt: userPrompt.value,
        },
        (chunk) => {
          streamedText.value += chunk
          aiResult.value.text = streamedText.value
        }
      )
      aiResult.value.isStreaming = false
      aiResult.value.latencyMs = Date.now() - startT
    } else {
      const res = await api.testAiProxy({
        licenseKey: licenseKey.value,
        appId: selectedAppId.value,
        prompt: userPrompt.value,
        modelAlias: modelAlias.value,
        stream: false,
      })
      aiResult.value = res
    }
    await fetchData()
  } catch (err: any) {
    aiResult.value = {
      error: 'GATEWAY_ERROR',
      message: err.message || 'Gagal memanggil AI Proxy Shield',
    }
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadAppsAndData()
})

// Muat ulang saat environment Live/Sandbox berganti
watch(dashboardEnv, () => {
  selectedAppId.value = ''
  vaultCreds.value = []
  proxyLogs.value = []
  loadAppsAndData()
})
</script>

<template>
  <div class="space-y-6 animate-fadeIn pb-12">
    <!-- Compact Action Bar -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-1 border-b border-[#111111]/10">
      <div class="flex items-center gap-2">
        <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#D4AF37]/15 border border-[#D4AF37]/35 text-[#111111] text-xs font-bold">
          <Bot class="w-3.5 h-3.5 text-[#D4AF37]" />
          <span>AI Proxy Shield</span>
        </span>
        <span class="text-xs text-[#111111]/50 font-medium hidden sm:inline">
          AES-256-GCM Vault • SSE Streaming • Zero Prompt Retention
        </span>
      </div>

      <div class="flex items-center gap-2">
        <select
          v-model="selectedAppId"
          @change="fetchData"
          class="text-xs font-bold bg-[#FFFFFF] border border-[#111111]/15 rounded-lg px-2.5 py-1.5 text-[#111111] focus:outline-none focus:border-[#D4AF37]"
        >
          <option v-for="app in appsList" :key="app.id" :value="app.id">
            {{ app.name }}
          </option>
        </select>

        <button
          @click="fetchData"
          class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#111111]/5 hover:bg-[#111111]/10 text-[#111111] text-xs font-bold transition shrink-0 cursor-pointer"
        >
          <RefreshCw class="w-3 h-3" />
          <span>Segarkan</span>
        </button>
      </div>
    </div>

    <!-- Alert Banner -->
    <div
      v-if="vaultAlert"
      class="p-3 rounded-xl bg-[#0F4C3A]/10 border border-[#0F4C3A]/25 text-[#0F4C3A] text-xs font-bold flex items-center justify-between"
    >
      <div class="flex items-center gap-1.5">
        <CheckCircle2 class="w-4 h-4 shrink-0" />
        <span>{{ vaultAlert }}</span>
      </div>
      <button @click="vaultAlert = null" class="text-xs underline cursor-pointer">Tutup</button>
    </div>

    <!-- Token Metering & Guardrails Live Widget Component -->
    <TokenGuardrailsWidget :quota-status="quotaStatus" />

    <!-- Security Pillars Component -->
    <SecurityPillars />

    <!-- Vault Manager & Cost Guardrail Component -->
    <VaultCredentialsManager
      :vault-creds="vaultCreds"
      :is-saving-key="isSavingKey"
      v-model:provider="newProvider"
      v-model:raw-key="newRawKey"
      v-model:budget="newBudget"
      @save="saveKeyToVault"
      @toggle-kill-switch="toggleKillSwitch"
    />

    <!-- Live Proxy Audit Logs Table Component -->
    <AiProxyAuditTable
      :proxy-logs="proxyLogs"
      @refresh="fetchData"
    />

    <!-- Interactive AI Chat Shield Test Component -->
    <AiStreamingPlayground
      :loading="loading"
      :ai-result="aiResult"
      v-model:license-key="licenseKey"
      v-model:model-alias="modelAlias"
      v-model:stream-mode="streamMode"
      v-model:user-prompt="userPrompt"
      @test-ai-call="testAiCall"
    />
  </div>
</template>
