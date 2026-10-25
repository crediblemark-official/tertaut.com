<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { api } from "../lib/api";
import { dashboardEnv } from "../lib/environment";
import { CheckCircle2, RefreshCw, Ticket, Plus, BarChart3 } from "lucide-vue-next";
import type { AppItem } from "../types/app";
import type { CouponItem } from "../types/coupon";
import { useConfirm } from "../composables/useConfirm";
import CouponManager from "../components/checkout/CouponManager.vue";
import SearchPicker from "../components/common/SearchPicker.vue";

import StatsBar from "../components/common/StatsBar.vue";
import StatItem from "../components/common/StatItem.vue";

const { confirm: confirmDialog } = useConfirm();

const isCreateModalOpen = ref(false);
const showStats = ref(false);
const appsList = ref<AppItem[]>([]);
const couponsList = ref<CouponItem[]>([]);
const loadingCoupons = ref(true);
const isCreatingCoupon = ref(false);
const actionFeedback = ref<string | null>(null);
const couponSearch = ref("");
const couponAppFilter = ref("");

const filteredCouponsForStats = computed(() => {
  if (couponAppFilter.value) {
    return couponsList.value.filter((c) => c.appId === couponAppFilter.value);
  }
  return couponsList.value;
});

const totalCouponsCount = computed(() => filteredCouponsForStats.value.length);
const activeCouponsCount = computed(
  () => filteredCouponsForStats.value.filter((c) => c.isActive).length
);
const inactiveCouponsCount = computed(
  () => filteredCouponsForStats.value.filter((c) => !c.isActive).length
);
const totalRedemptionsCount = computed(() =>
  filteredCouponsForStats.value.reduce((acc, c) => acc + (c.redemptionCount || 0), 0)
);

const couponForm = ref({
  appId: "",
  code: "",
  discountPercent: 50,
  maxRedemptions: 0,
  expiresAt: "",
});

function showFeedback(message: string) {
  actionFeedback.value = message;
  setTimeout(() => {
    actionFeedback.value = null;
  }, 5000);
}

/** Beri tahu sidebar (App.vue) bahwa daftar kupon berubah agar badge ter-update. */
function notifyCouponsChanged() {
  window.dispatchEvent(new Event("tertaut:coupons-changed"));
}

async function loadApps() {
  try {
    const appsRes = await api.getApps();
    appsList.value = appsRes.apps || [];
    if (appsList.value.length > 0 && !couponForm.value.appId) {
      couponForm.value.appId = appsList.value[0].id;
    }
  } catch (e) {
    console.error("Failed to load apps:", e);
  }
}

async function loadCoupons() {
  loadingCoupons.value = true;
  try {
    const res = await api.getCoupons();
    couponsList.value = res.coupons || [];
  } catch (e) {
    console.error("Failed to load coupons:", e);
  } finally {
    loadingCoupons.value = false;
  }
}

async function handleCreateCoupon(payload: {
  appId: string;
  code: string;
  discountPercent: number;
  maxRedemptions: number;
  expiresAt?: string;
}) {
  isCreatingCoupon.value = true;
  try {
    const res = await api.createCoupon(payload);
    if (res.success && res.coupon) {
      showFeedback(
        `Kupon ${res.coupon.code} (${res.coupon.discountPercent}% diskon) berhasil dibuat dan siap ditebus.`
      );
      couponForm.value = {
        appId: couponForm.value.appId,
        code: "",
        discountPercent: 50,
        maxRedemptions: 0,
        expiresAt: "",
      };
      isCreateModalOpen.value = false;
      await loadCoupons();
      notifyCouponsChanged();
    } else {
      showFeedback(`Gagal: ${res.error || "Kupon tidak bisa dibuat."}`);
    }
  } catch (err: any) {
    showFeedback(`Error: ${err.message || "Gagal membuat kupon."}`);
  } finally {
    isCreatingCoupon.value = false;
  }
}

async function handleToggleCoupon(coupon: CouponItem) {
  try {
    const res = await api.updateCoupon(coupon.id, { isActive: !coupon.isActive });
    if (res.success) {
      showFeedback(`Kupon ${coupon.code} ${!coupon.isActive ? "diaktifkan" : "dinonaktifkan"}.`);
      await loadCoupons();
      notifyCouponsChanged();
    } else {
      showFeedback(`Gagal: ${res.error || "Status kupon tidak bisa diubah."}`);
    }
  } catch (err: any) {
    showFeedback(`Error: ${err.message || "Gagal mengubah status kupon."}`);
  }
}

async function handleDeleteCoupon(coupon: CouponItem) {
  const ok = await confirmDialog({
    title: `Hapus Kupon "${coupon.code}"?`,
    message: "Kupon akan dihapus permanen.",
    confirmText: "Hapus",
    cancelText: "Batal",
    variant: "danger",
  });
  if (!ok) return;
  try {
    const res = await api.deleteCoupon(coupon.id);
    if (res.success) {
      showFeedback(`Kupon ${coupon.code} dihapus.`);
      await loadCoupons();
      notifyCouponsChanged();
    } else {
      showFeedback(`Gagal: ${res.error || "Kupon tidak bisa dihapus."}`);
    }
  } catch (err: any) {
    showFeedback(`Error: ${err.message || "Gagal menghapus kupon."}`);
  }
}

onMounted(() => {
  loadApps();
  loadCoupons();
});

// Muat ulang saat environment Live/Sandbox berganti
watch(dashboardEnv, () => {
  couponForm.value.appId = "";
  loadApps();
  loadCoupons();
});
</script>

<template>
  <div class="animate-fadeIn pb-8">
    <!-- Macro Summary Counter -->
    <StatsBar borderless>
      <StatItem
        label="Total Kupon"
        :value="totalCouponsCount"
        sublabel="Seluruh promo software"
        :loading="loadingCoupons"
      />
      <StatItem
        label="Kupon Aktif"
        :value="activeCouponsCount"
        sublabel="Dapat digunakan saat checkout"
        variant="forest"
        bordered
        :loading="loadingCoupons"
      />
      <StatItem
        label="Total Penebusan"
        :value="totalRedemptionsCount"
        sublabel="Kali diskon digunakan"
        variant="gold"
        bordered
        :loading="loadingCoupons"
      />
      <StatItem
        label="Kupon Nonaktif"
        :value="inactiveCouponsCount"
        sublabel="Kedaluwarsa atau dimatikan"
        variant="crimson"
        bordered
        :loading="loadingCoupons"
      />
    </StatsBar>

    <!-- Unified Header & Toolbar (Edge-to-Edge Full Width & Standardized Height) -->
    <div
      class="-mx-3.5 sm:-mx-4 md:-mx-6 px-3.5 sm:px-4 md:px-6 min-h-[44px] py-1.5 sm:py-0 bg-jetblack text-white border-b border-jetblack flex items-center justify-between gap-3 overflow-x-auto no-scrollbar shadow-xs mb-0 !mt-0"
    >
      <!-- Sisi Kiri: Label Kupon & Toggle Statistik -->
      <div class="flex items-center gap-2 overflow-x-auto no-scrollbar">
        <div class="flex items-center gap-2 shrink-0">
          <Ticket class="w-3.5 h-3.5 text-gold" />
          <span class="text-xs font-bold text-white uppercase tracking-wider"> Kupon Diskon </span>
          <span
            class="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white font-mono font-bold"
          >
            {{ totalCouponsCount }} kupon
          </span>
        </div>

        <button
          type="button"
          @click="showStats = !showStats"
          :class="[
            'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold transition cursor-pointer whitespace-nowrap ml-2',
            showStats
              ? 'bg-gold text-jetblack shadow-xs'
              : 'text-white/70 hover:text-white bg-white/10 hover:bg-white/20',
          ]"
        >
          <BarChart3 class="w-3.5 h-3.5" :class="showStats ? 'text-jetblack' : 'text-gold'" />
          <span>Statistik Detail</span>
          <span v-if="showStats" class="w-1.5 h-1.5 rounded-full bg-jetblack"></span>
        </button>
      </div>

      <!-- Sisi Kanan: SearchPicker Filter, Tombol Aksi (+ Buat Kupon Baru & Segarkan) -->
      <div class="flex items-center gap-2 shrink-0">
        <SearchPicker
          v-model="couponAppFilter"
          :items="appsList"
          :dark="true"
          all-option-label="Semua Aplikasi"
          placeholder="Semua Aplikasi"
          search-placeholder="Cari software..."
          button-class="!h-7 !rounded-md !min-w-[150px] !text-xs"
        />

        <button
          type="button"
          @click="isCreateModalOpen = true"
          class="btn-gold h-7 px-3 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition cursor-pointer shadow-xs active:scale-95 shrink-0"
        >
          <Plus class="w-3.5 h-3.5 stroke-[3]" />
          <span>Buat Kupon Baru</span>
        </button>

        <button
          @click="loadCoupons"
          class="inline-flex items-center gap-1.5 px-3 h-7 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-bold text-white transition cursor-pointer shrink-0"
        >
          <RefreshCw class="w-3.5 h-3.5" :class="{ 'animate-spin': loadingCoupons }" />
          <span>Segarkan</span>
        </button>
      </div>
    </div>

    <!-- Alert Feedback -->
    <div
      v-if="actionFeedback"
      class="mb-3 p-3 rounded-xl bg-forest/10 border border-forest/30 text-forest text-xs font-bold flex items-center gap-2 animate-fadeIn"
    >
      <CheckCircle2 class="w-4 h-4 shrink-0" />
      <span>{{ actionFeedback }}</span>
    </div>

    <!-- Coupon Management Component -->
    <CouponManager
      :apps-list="appsList"
      :coupons-list="couponsList"
      :loading="loadingCoupons"
      v-model:is-create-modal-open="isCreateModalOpen"
      v-model:show-stats="showStats"
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
