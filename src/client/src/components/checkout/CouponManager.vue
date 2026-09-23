<script setup lang="ts">
import type { AppItem } from "../../types/app";
import type { CouponItem } from "../../types/coupon";
import CouponStatsPanel from "./CouponStatsPanel.vue";
import CouponTable from "./CouponTable.vue";
import CouponCreateModal from "./CouponCreateModal.vue";

const props = defineProps<{
  appsList: AppItem[];
  couponsList: CouponItem[];
  loading: boolean;
}>();

const emit = defineEmits<{
  (e: "refresh"): void;
  (
    e: "create",
    payload: {
      appId: string;
      code: string;
      discountPercent: number;
      maxRedemptions: number;
      expiresAt?: string;
    }
  ): void;
  (e: "toggle", coupon: CouponItem): void;
  (e: "delete", coupon: CouponItem): void;
}>();

const isCreateModalOpen = defineModel<boolean>("isCreateModalOpen", { default: false });
const showStats = defineModel<boolean>("showStats", { default: false });

const form = defineModel<{
  appId: string;
  code: string;
  discountPercent: number;
  maxRedemptions: number;
  expiresAt: string;
}>("form", {
  default: () => ({ appId: "", code: "", discountPercent: 50, maxRedemptions: 0, expiresAt: "" }),
});

const isCreating = defineModel<boolean>("isCreating", { default: false });
const searchQuery = defineModel<string>("searchQuery", { default: "" });
const filterAppId = defineModel<string>("filterAppId", { default: "" });

function submitCreate() {
  if (!form.value.appId || !form.value.code.trim()) return;
  emit("create", {
    appId: form.value.appId,
    code: form.value.code.trim().toUpperCase(),
    discountPercent: Number(form.value.discountPercent),
    maxRedemptions: Number(form.value.maxRedemptions) || 0,
    expiresAt: form.value.expiresAt ? new Date(form.value.expiresAt).toISOString() : undefined,
  });
}
</script>

<template>
  <div class="space-y-4">
    <!-- Panel Statistik Coupon (Collapsible) -->
    <CouponStatsPanel
      v-if="showStats"
      :filter-app-id="filterAppId"
      :coupons-count="couponsList.length"
    />

    <!-- Tabel Daftar Kupon -->
    <CouponTable
      :apps-list="appsList"
      :coupons-list="couponsList"
      v-model:search-query="searchQuery"
      v-model:filter-app-id="filterAppId"
      @toggle="emit('toggle', $event)"
      @delete="emit('delete', $event)"
      @open-create="isCreateModalOpen = true"
    />

    <!-- Modal Form Buat Kupon Baru -->
    <CouponCreateModal
      :show="isCreateModalOpen"
      :apps-list="appsList"
      :is-creating="isCreating"
      v-model:form="form"
      @close="isCreateModalOpen = false"
      @submit="submitCreate"
    />
  </div>
</template>
