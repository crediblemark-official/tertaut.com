<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { Ticket, Plus, Power, Trash2, TicketPercent, Clock } from "lucide-vue-next";
import type { AppItem } from "../../types/app";
import type { CouponItem } from "../../types/coupon";
import SearchPicker from "../common/SearchPicker.vue";
import TableSkeleton from "../common/TableSkeleton.vue";
import TableContainer from "../common/TableContainer.vue";
import SearchInput from "../common/SearchInput.vue";
import StatusBadge from "../common/StatusBadge.vue";
import EmptyState from "../common/EmptyState.vue";

const props = withDefaults(
  defineProps<{
    appsList: AppItem[];
    couponsList: CouponItem[];
    loading?: boolean;
  }>(),
  {
    loading: false,
  }
);

const emit = defineEmits<{
  (e: "toggle", coupon: CouponItem): void;
  (e: "delete", coupon: CouponItem): void;
  (e: "open-create"): void;
}>();

const searchQuery = defineModel<string>("searchQuery", { default: "" });
const filterAppId = defineModel<string>("filterAppId", { default: "" });
const isMounted = ref(false);

onMounted(() => {
  isMounted.value = true;
});

const filteredCoupons = computed(() => {
  return props.couponsList.filter((c) => {
    if (filterAppId.value && c.appId !== filterAppId.value) return false;
    if (searchQuery.value.trim()) {
      const q = searchQuery.value.toLowerCase().trim();
      return c.code.toLowerCase().includes(q);
    }
    return true;
  });
});

function appLabel(appId: string | null): string {
  if (!appId) return "Global (semua app)";
  const app = props.appsList.find((a) => a.id === appId);
  return app ? app.name : appId;
}

function remainingQuota(c: CouponItem): string {
  if (c.maxRedemptions === 0) return "∞";
  return `${Math.max(0, c.maxRedemptions - c.redemptionCount)}/${c.maxRedemptions}`;
}

function isExpiringSoon(c: CouponItem): boolean {
  if (!c.expiresAt) return false;
  const daysLeft = (new Date(c.expiresAt).getTime() - Date.now()) / 86_400_000;
  return daysLeft > 0 && daysLeft <= 7;
}
</script>

<template>
  <div class="space-y-3">
    <!-- Global Search Input Teleported to Top Header (#dashboard-header-search) -->
    <Teleport v-if="isMounted" to="#dashboard-header-search">
      <SearchInput
        v-model="searchQuery"
        placeholder="Cari kode kupon..."
        wrapper-class="w-full max-w-md"
        input-class="h-8 rounded-lg bg-jetblack/5 hover:bg-jetblack/8 border-jetblack/10 hover:border-jetblack/20 focus:bg-white"
      />
    </Teleport>

    <!-- Mobile Search Input Teleported to Mobile Header (#mobile-header-search) -->
    <Teleport v-if="isMounted" to="#mobile-header-search">
      <SearchInput
        v-model="searchQuery"
        placeholder="Cari kode kupon..."
        wrapper-class="w-full"
        input-class="h-8 rounded-lg bg-jetblack/5 border-jetblack/10 focus:bg-white"
      />
    </Teleport>

    <!-- Coupons Table (Scrollable on mobile, edge-to-edge full width) -->
    <TableContainer class="!mt-0">
      <template #head>
        <tr>
          <th class="py-2.5 pr-3 pl-3.5 sm:pl-4 md:pl-6">Kode</th>
          <th class="py-2.5 px-3">Aplikasi</th>
          <th class="py-2.5 px-3">Diskon</th>
          <th class="py-2.5 px-3">Terpakai</th>
          <th class="py-2.5 px-3">Kedaluwarsa</th>
          <th class="py-2.5 px-3">Status</th>
          <th class="py-2.5 pl-3 pr-3.5 sm:pr-4 md:pr-6 text-right">Aksi</th>
        </tr>
      </template>

      <TableSkeleton v-if="loading" :columns="7" :rows="4" />
      <tr v-else-if="filteredCoupons.length === 0">
        <td colspan="7" class="py-12 px-3.5 sm:px-4 md:px-6">
          <EmptyState
            :icon="Ticket"
            title="Belum ada kupon ditemukan"
            description="Terbitkan kupon diskon pertama untuk meningkatkan penjualan aplikasi Anda."
            container-class="border-0 bg-transparent py-4"
          >
            <template #action>
              <button
                type="button"
                @click="emit('open-create')"
                class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg btn-gold text-xs font-bold transition cursor-pointer shadow-2xs mt-2"
              >
                <Plus class="w-3.5 h-3.5" />
                <span>Buat Kupon Sekarang</span>
              </button>
            </template>
          </EmptyState>
        </td>
      </tr>
      <tr
        v-else
        v-for="c in filteredCoupons"
        :key="c.id"
        class="hover:bg-jetblack/[0.02] transition-colors"
      >
        <td class="py-2.5 pr-3 pl-3.5 sm:pl-4 md:pl-6">
          <span class="font-mono font-bold text-jetblack">{{ c.code }}</span>
        </td>
        <td class="py-2.5 px-3 text-jetblack/80">{{ appLabel(c.appId) }}</td>
        <td class="py-2.5 px-3">
          <span
            class="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full bg-gold/15 border border-gold/35 text-jetblack text-[10px] font-bold"
          >
            <TicketPercent class="w-2.5 h-2.5" />
            {{ c.discountPercent }}%
          </span>
        </td>
        <td class="py-2.5 px-3 font-mono text-jetblack/80">
          {{ c.redemptionCount }} / {{ remainingQuota(c) }}
        </td>
        <td class="py-2.5 px-3 text-[11px]">
          <span
            v-if="c.expiresAt"
            class="inline-flex items-center gap-1"
            :class="isExpiringSoon(c) ? 'text-crimson font-bold' : 'text-jetblack/60'"
          >
            <Clock class="w-3 h-3" />
            {{ new Date(c.expiresAt).toLocaleDateString("id-ID") }}
          </span>
          <span v-else class="text-jetblack/40">Tanpa batas</span>
        </td>
        <td class="py-2.5 px-3">
          <StatusBadge :status="c.isActive ? 'AKTIF' : 'NONAKTIF'" />
        </td>
        <td class="py-2.5 pl-3 pr-3.5 sm:pr-4 md:pr-6 text-right">
          <div class="flex items-center justify-end gap-1">
            <button
              @click="emit('toggle', c)"
              :title="c.isActive ? 'Nonaktifkan kupon' : 'Aktifkan kupon'"
              class="p-1 rounded-md transition cursor-pointer"
              :class="
                c.isActive
                  ? 'bg-jetblack/5 text-jetblack/60 hover:bg-gold/20 hover:text-jetblack'
                  : 'bg-forest/10 text-forest hover:bg-forest/20'
              "
            >
              <Power class="w-3.5 h-3.5" />
            </button>
            <button
              @click="emit('delete', c)"
              title="Hapus kupon"
              class="p-1 rounded-md bg-crimson/10 text-crimson hover:bg-crimson/20 transition cursor-pointer"
            >
              <Trash2 class="w-3.5 h-3.5" />
            </button>
          </div>
        </td>
      </tr>
    </TableContainer>
  </div>
</template>
