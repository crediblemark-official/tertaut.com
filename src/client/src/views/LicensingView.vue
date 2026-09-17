<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { api, type AppItem, type LicenseItem, type LicensePlatform } from '../lib/api'
import { dashboardEnv } from '../lib/environment'
import { KeyRound, Plus, CheckCircle2 } from 'lucide-vue-next'
import { useClipboard } from '../composables/useClipboard'
import PlatformBadges from '../components/licensing/PlatformBadges.vue'
import LicenseTable from '../components/licensing/LicenseTable.vue'
import LicenseValidatorPanel from '../components/licensing/LicenseValidatorPanel.vue'
import IssueLicenseModal from '../components/licensing/IssueLicenseModal.vue'

const appsList = ref<AppItem[]>([])
const licensesList = ref<LicenseItem[]>([])
const loadingLicenses = ref(false)
const actionFeedback = ref<string | null>(null)
const { copy: writeClipboard } = useClipboard()

// Validation & Diagnostic Engine State
const licenseKey = ref('')
const hardwareId = ref('')
const deviceName = ref('')
const validationAppId = ref('')
const validationResult = ref<any>(null)
const loadingValidation = ref(false)

// Issue Modal State
const isIssueModalOpen = ref(false)
const isIssuing = ref(false)

async function loadData() {
  loadingLicenses.value = true
  try {
    const [appsRes, licRes] = await Promise.all([
      api.getApps(),
      api.getLicenses()
    ])
    appsList.value = appsRes.apps || []
    if (appsRes.apps && appsRes.apps.length > 0 && !validationAppId.value) {
      validationAppId.value = appsRes.apps[0].id
    }
    licensesList.value = licRes.licenses || []

    if (licensesList.value.length > 0 && !licenseKey.value) {
      selectLicenseForTest(licensesList.value[0])
    }
  } catch (err) {
    console.error('Failed to load licenses data:', err)
  } finally {
    loadingLicenses.value = false
  }
}

function selectLicenseForTest(lic: LicenseItem) {
  licenseKey.value = lic.licenseKey
  validationAppId.value = lic.appId
  hardwareId.value = lic.hardwareId || ''
  validationResult.value = null
}

async function testActivateSeat() {
  if (!licenseKey.value) return
  if (!hardwareId.value) {
    validationResult.value = { success: false, error: 'Hardware ID wajib diisi untuk aktivasi seat.' }
    return
  }
  loadingValidation.value = true
  try {
    const res = await api.activateLicense({
      licenseKey: licenseKey.value,
      appId: validationAppId.value,
      hwid: hardwareId.value,
      deviceName: deviceName.value || 'UserDevice',
    })
    validationResult.value = res
    if (res.success) {
      actionFeedback.value = 'Perangkat berhasil diaktivasi!'
      setTimeout(() => { actionFeedback.value = null }, 4000)
    }
    await loadData()
  } catch (err: any) {
    validationResult.value = { success: false, error: err.message || 'Activation failed' }
  } finally {
    loadingValidation.value = false
  }
}

async function testVerifyOnline() {
  if (!licenseKey.value) return
  loadingValidation.value = true
  try {
    const res = await api.verifyLicense({
      licenseKey: licenseKey.value,
      hwid: hardwareId.value || undefined,
    })
    validationResult.value = res
  } catch (err: any) {
    validationResult.value = { valid: false, error: err.message || 'Verify failed' }
  } finally {
    loadingValidation.value = false
  }
}

async function testDeactivateSeat(targetKey?: string, targetHwid?: string) {
  const licKey = targetKey || licenseKey.value
  const hw = targetHwid || hardwareId.value
  if (!licKey) return
  if (!hw) {
    validationResult.value = { success: false, error: 'Hardware ID wajib diisi untuk deaktivasi seat.' }
    return
  }
  loadingValidation.value = true
  try {
    const res = await api.deactivateLicense({
      licenseKey: licKey,
      hwid: hw,
    })
    validationResult.value = res
    if (res.success) {
      actionFeedback.value = 'Device seat berhasil dilepas!'
      setTimeout(() => { actionFeedback.value = null }, 4000)
    }
    await loadData()
  } catch (err: any) {
    validationResult.value = { success: false, error: err.message || 'Deactivation failed' }
  } finally {
    loadingValidation.value = false
  }
}

async function testValidation() {
  if (!licenseKey.value) return
  loadingValidation.value = true
  try {
    const res = await api.validateLicense({
      licenseKey: licenseKey.value,
      appId: validationAppId.value,
      hardwareId: hardwareId.value || undefined,
    })
    validationResult.value = res
  } catch {
    validationResult.value = { valid: false, error: 'Network error' }
  } finally {
    loadingValidation.value = false
  }
}

async function handleIssueLicense(payload: {
  appId: string
  customerEmail: string
  grantDays: number
  maxSeats: number
  platform: LicensePlatform
}) {
  isIssuing.value = true
  try {
    const res = await api.issueLicense(payload)
    if (res.success) {
      isIssueModalOpen.value = false
      actionFeedback.value = `Lisensi baru ${res.license.licenseKey} berhasil diterbitkan!`
      setTimeout(() => { actionFeedback.value = null }, 5000)
      await loadData()
      notifyLicensesChanged()
    }
  } finally {
    isIssuing.value = false
  }
}

async function revokeLicense(lic: LicenseItem) {
  if (!confirm(`Cabut akses lisensi ${lic.licenseKey}?`)) return
  try {
    const res = await api.revokeLicense(lic.licenseKey)
    if (res.success) {
      actionFeedback.value = `Lisensi ${lic.licenseKey} berhasil dicabut.`
      setTimeout(() => { actionFeedback.value = null }, 4000)
      await loadData()
      notifyLicensesChanged()
    }
  } catch (e) {
    console.error(e)
  }
}

async function unbindHardware(lic: LicenseItem) {
  try {
    const res = await api.unbindHardware(lic.licenseKey)
    if (res.success) {
      actionFeedback.value = `Hardware binding untuk ${lic.licenseKey} berhasil di-reset. Pengguna dapat aktivasi di device baru.`
      setTimeout(() => { actionFeedback.value = null }, 4000)
      await loadData()
    }
  } catch (e) {
    console.error(e)
  }
}

/** Beri tahu sidebar (App.vue) bahwa daftar lisensi berubah agar badge ter-update. */
function notifyLicensesChanged() {
  window.dispatchEvent(new Event('tertaut:licenses-changed'))
}

async function copyToClipboard(text: string) {
  const ok = await writeClipboard(text)
  if (!ok) {
    actionFeedback.value = 'Gagal menyalin ke clipboard. Salin manual dari tabel.'
    setTimeout(() => { actionFeedback.value = null }, 3000)
    return
  }
  actionFeedback.value = `Kunci lisensi ${text} disalin ke clipboard!`
  setTimeout(() => { actionFeedback.value = null }, 3000)
}

onMounted(() => {
  loadData()
})

// Muat ulang saat environment Live/Sandbox berganti
watch(dashboardEnv, () => {
  validationAppId.value = ''
  licenseKey.value = ''
  validationResult.value = null
  loadData()
})
</script>

<template>
  <div class="space-y-6 animate-fadeIn pb-12">
    <!-- Compact Action Bar -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-1 border-b border-[#111111]/10">
      <div class="flex items-center gap-2">
        <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#D4AF37]/15 border border-[#D4AF37]/35 text-[#111111] text-xs font-bold">
          <KeyRound class="w-3.5 h-3.5 text-[#D4AF37]" />
          <span>Universal Licensing</span>
        </span>
        <span class="text-xs text-[#111111]/50 font-medium hidden sm:inline">
          Hardware ID Binding • Device Seats • 30-Day Offline JWT Grace
        </span>
      </div>

      <div class="flex items-center gap-2">
        <button
          @click="isIssueModalOpen = true"
          class="btn-gold px-3 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition active:scale-95 cursor-pointer shadow-sm"
        >
          <Plus class="w-3.5 h-3.5 stroke-[3]" />
          <span>Terbitkan Lisensi Baru</span>
        </button>
      </div>
    </div>

    <!-- Alert Feedback -->
    <div
      v-if="actionFeedback"
      class="p-3 rounded-xl bg-[#0F4C3A]/10 border border-[#0F4C3A]/30 text-[#0F4C3A] text-xs font-bold flex items-center gap-2 animate-fadeIn"
    >
      <CheckCircle2 class="w-4 h-4" />
      <span>{{ actionFeedback }}</span>
    </div>

    <!-- Architectural Multi-Platform Badges -->
    <PlatformBadges />

    <!-- Active Licenses Table Component -->
    <LicenseTable
      :licenses-list="licensesList"
      :loading="loadingLicenses"
      @refresh="loadData"
      @copy="copyToClipboard"
      @select-test="selectLicenseForTest"
      @unbind-hardware="unbindHardware"
      @revoke="revokeLicense"
      @deactivate-seat="(k, h) => testDeactivateSeat(k, h)"
    />

    <!-- Diagnostic & Validation Engine Component -->
    <LicenseValidatorPanel
      :apps-list="appsList"
      :loading-validation="loadingValidation"
      :validation-result="validationResult"
      v-model:license-key="licenseKey"
      v-model:hardware-id="hardwareId"
      v-model:device-name="deviceName"
      v-model:app-id="validationAppId"
      @activate-seat="testActivateSeat"
      @verify-online="testVerifyOnline"
      @deactivate-seat="() => testDeactivateSeat()"
      @validate-standard="testValidation"
    />

    <!-- Issue License Modal Component -->
    <IssueLicenseModal
      :show="isIssueModalOpen"
      :apps-list="appsList"
      :is-issuing="isIssuing"
      :default-app-id="validationAppId"
      @close="isIssueModalOpen = false"
      @issue="handleIssueLicense"
    />
  </div>
</template>
