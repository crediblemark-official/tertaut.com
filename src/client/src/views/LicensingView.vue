<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { api, type AppItem, type LicenseItem, type LicensePlatform } from '../lib/api'
import { dashboardEnv } from '../lib/environment'
import { CheckCircle2 } from 'lucide-vue-next'
import { useClipboard } from '../composables/useClipboard'
import LicenseTable from '../components/licensing/LicenseTable.vue'
import IssueLicenseModal from '../components/licensing/IssueLicenseModal.vue'

const appsList = ref<AppItem[]>([])
const licensesList = ref<LicenseItem[]>([])
const loadingLicenses = ref(false)
const actionFeedback = ref<string | null>(null)
let feedbackTimer: ReturnType<typeof setTimeout> | null = null
const { copy: writeClipboard } = useClipboard()

// Issue Modal State
const isIssueModalOpen = ref(false)
const isIssuing = ref(false)

function setFeedback(msg: string, timeoutMs = 4000) {
  if (feedbackTimer) clearTimeout(feedbackTimer)
  actionFeedback.value = msg
  feedbackTimer = setTimeout(() => {
    actionFeedback.value = null
    feedbackTimer = null
  }, timeoutMs)
}

onUnmounted(() => {
  if (feedbackTimer) {
    clearTimeout(feedbackTimer)
    feedbackTimer = null
  }
})

async function loadData() {
  loadingLicenses.value = true
  try {
    const [appsRes, licRes] = await Promise.all([
      api.getApps(),
      api.getLicenses()
    ])
    appsList.value = appsRes.apps || []
    licensesList.value = licRes.licenses || []
  } catch (err) {
    console.error('Failed to load licenses data:', err)
  } finally {
    loadingLicenses.value = false
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
    if (res.success && res.license) {
      isIssueModalOpen.value = false
      setFeedback(`Lisensi baru ${res.license.licenseKey || ''} berhasil diterbitkan!`, 5000)
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
      setFeedback(`Lisensi ${lic.licenseKey} berhasil dicabut.`, 4000)
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
      setFeedback(`Hardware binding untuk ${lic.licenseKey} berhasil di-reset. Pengguna dapat aktivasi di device baru.`, 4000)
      await loadData()
    }
  } catch (e) {
    console.error(e)
  }
}

async function handleDeactivateSeat(licenseKey: string, hwid: string) {
  try {
    const res = await api.deactivateLicense({ licenseKey, hwid })
    if (res.success) {
      setFeedback('Device seat berhasil dilepas!', 4000)
      await loadData()
    } else {
      setFeedback(`Gagal: ${res.error || 'Seat tidak bisa dilepas'}`, 4000)
    }
  } catch (e: any) {
    setFeedback(`Error: ${e?.message || 'Terjadi kesalahan'}`, 4000)
  }
}

/** Beri tahu sidebar (App.vue) bahwa daftar lisensi berubah agar badge ter-update. */
function notifyLicensesChanged() {
  window.dispatchEvent(new Event('tertaut:licenses-changed'))
}

async function copyToClipboard(text: string) {
  const ok = await writeClipboard(text)
  if (!ok) {
    setFeedback('Gagal menyalin ke clipboard. Salin manual dari tabel.', 3000)
    return
  }
  setFeedback(`Kunci lisensi ${text} disalin ke clipboard!`, 3000)
}

onMounted(() => {
  loadData()
})

// Muat ulang saat environment Live/Sandbox berganti
watch(dashboardEnv, () => {
  loadData()
})
</script>

<template>
  <div class="animate-fadeIn pb-12">
    <!-- Active Licenses Table Component -->
    <LicenseTable
      :licenses-list="licensesList"
      :loading="loadingLicenses"
      @refresh="loadData"
      @issue="isIssueModalOpen = true"
      @copy="copyToClipboard"
      @unbind-hardware="unbindHardware"
      @deactivate-seat="handleDeactivateSeat"
      @revoke="revokeLicense"
    />

    <!-- Alert Feedback -->
    <div
      v-if="actionFeedback"
      class="mt-3 p-3 rounded-xl bg-[#0F4C3A]/10 border border-[#0F4C3A]/30 text-[#0F4C3A] text-xs font-bold flex items-center gap-2 animate-fadeIn"
    >
      <CheckCircle2 class="w-4 h-4" />
      <span>{{ actionFeedback }}</span>
    </div>

    <!-- Issue License Modal Component -->
    <IssueLicenseModal
      :show="isIssueModalOpen"
      :apps-list="appsList"
      :is-issuing="isIssuing"
      :default-app-id="appsList.length > 0 ? appsList[0].id : ''"
      @close="isIssueModalOpen = false"
      @issue="handleIssueLicense"
    />
  </div>
</template>

