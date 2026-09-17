<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { api } from '../lib/api'
import { dashboardEnv } from '../lib/environment'
import { Ticket, CheckCircle2 } from 'lucide-vue-next'
import type { AppItem, CouponItem } from '../types'
import CouponManager from '../components/checkout/CouponManager.vue'

const appsList = ref<AppItem[]>([])
const couponsList = ref<CouponItem[]>([])
const loadingCoupons = ref(false)
const isCreatingCoupon = ref(false)
const actionFeedback = ref<string | null>(null)
const couponSearch = ref('')
const couponAppFilter = ref('')

const couponForm = ref({
  appId: '',
  code: '',
  discountPercent: 50,
  maxRedemptions: 0,
  expiresAt: ''
})

function showFeedback(message: string) {
  actionFeedback.value = message
  setTimeout(() => { actionFeedback.value = null }, 5000)
}

/** Beri tahu sidebar (App.vue) bahwa daftar kupon berubah agar badge ter-update. */
function notifyCouponsChanged() {
  window.dispatchEvent(new Event('tertaut:coupons-changed'))
}

async function loadApps() {
  try {
    const appsRes = await api.getApps()
    appsList.value = appsRes.apps || []
    if (appsList.value.length > 0 && !couponForm.value.appId) {
      couponForm.value.appId = appsList.value[0].id
    }
  } catch (e) {
    console.error('Failed to load apps:', e)
  }
}

async function loadCoupons() {
  loadingCoupons.value = true
  try {
    const res = await api.getCoupons()
    couponsList.value = res.coupons || []
  } catch (e) {
    console.error('Failed to load coupons:', e)
  } finally {
    loadingCoupons.value = false
  }
}

async function handleCreateCoupon(payload: {
  appId: string
  code: string
  discountPercent: number
  maxRedemptions: number
  expiresAt?: string
}) {
  isCreatingCoupon.value = true
  try {
    const res = await api.createCoupon(payload)
    if (res.success && res.coupon) {
      showFeedback(`Kupon ${res.coupon.code} (${res.coupon.discountPercent}% diskon) berhasil dibuat dan siap ditebus.`)
      couponForm.value = {
        appId: couponForm.value.appId,
        code: '',
        discountPercent: 50,
        maxRedemptions: 0,
        expiresAt: ''
      }
      await loadCoupons()
      notifyCouponsChanged()
    } else {
      showFeedback(`Gagal: ${res.error || 'Kupon tidak bisa dibuat.'}`)
    }
  } catch (err: any) {
    showFeedback(`Error: ${err.message || 'Gagal membuat kupon.'}`)
  } finally {
    isCreatingCoupon.value = false
  }
}

async function handleToggleCoupon(coupon: CouponItem) {
  try {
    const res = await api.updateCoupon(coupon.id, { isActive: !coupon.isActive })
    if (res.success) {
      showFeedback(`Kupon ${coupon.code} ${!coupon.isActive ? 'diaktifkan' : 'dinonaktifkan'}.`)
      await loadCoupons()
      notifyCouponsChanged()
    } else {
      showFeedback(`Gagal: ${res.error || 'Status kupon tidak bisa diubah.'}`)
    }
  } catch (err: any) {
    showFeedback(`Error: ${err.message || 'Gagal mengubah status kupon.'}`)
  }
}

async function handleDeleteCoupon(coupon: CouponItem) {
  if (!confirm(`Hapus kupon ${coupon.code}? Tindakan ini tidak bisa dibatalkan.`)) return
  try {
    const res = await api.deleteCoupon(coupon.id)
    if (res.success) {
      showFeedback(`Kupon ${coupon.code} dihapus.`)
      await loadCoupons()
      notifyCouponsChanged()
    } else {
      showFeedback(`Gagal: ${res.error || 'Kupon tidak bisa dihapus.'}`)
    }
  } catch (err: any) {
    showFeedback(`Error: ${err.message || 'Gagal menghapus kupon.'}`)
  }
}

onMounted(() => {
  loadApps()
  loadCoupons()
})

// Muat ulang saat environment Live/Sandbox berganti
watch(dashboardEnv, () => {
  couponForm.value.appId = ''
  loadApps()
  loadCoupons()
})
</script>

<template>
  <div class="space-y-6 animate-fadeIn pb-16">
    <!-- Compact Action Bar -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-1 border-b border-[#111111]/10">
      <div class="flex items-center gap-2">
        <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#D4AF37]/15 border border-[#D4AF37]/35 text-[#111111] text-xs font-bold">
          <Ticket class="w-3.5 h-3.5 text-[#D4AF37]" />
          <span>Kupon Diskon</span>
        </span>
        <span class="text-xs text-[#111111]/50 font-medium hidden sm:inline">
          Penebusan Otomatis di Checkout • Kuota Atomik • Statistik Harian
        </span>
      </div>
    </div>

    <!-- Alert Feedback -->
    <div
      v-if="actionFeedback"
      class="p-3 rounded-xl bg-[#0F4C3A]/10 border border-[#0F4C3A]/30 text-[#0F4C3A] text-xs font-bold flex items-center gap-2 animate-fadeIn"
    >
      <CheckCircle2 class="w-4 h-4 shrink-0" />
      <span>{{ actionFeedback }}</span>
    </div>

    <!-- Coupon Management Component -->
    <CouponManager
      :apps-list="appsList"
      :coupons-list="couponsList"
      :loading="loadingCoupons"
      v-model:form="couponForm"
      v-model:is-creating="isCreatingCoupon"
      v-model:search-query="couponSearch"
      v-model:filter-app-id="couponAppFilter"
      @refresh="loadCoupons"
      @create="handleCreateCoupon"
      @toggle="handleToggleCoupon"
      @delete="handleDeleteCoupon"
    />
  </div>
</template>
