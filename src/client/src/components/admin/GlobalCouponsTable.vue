<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { Plus, Ticket, Globe, AppWindow, Trash2, Power } from "lucide-vue-next";
import type { PanelCouponItem } from "../../types/panel";
import TableContainer from "../common/TableContainer.vue";
import TableSkeleton from "../common/TableSkeleton.vue";
import SearchInput from "../common/SearchInput.vue";
import StatusBadge from "../common/StatusBadge.vue";
import EmptyState from "../common/EmptyState.vue";
import BaseModal from "../common/BaseModal.vue";
import StatsBar from "../common/StatsBar.vue";
import StatItem from "../common/StatItem.vue";

const props = defineProps<{
  coupons: PanelCouponItem[];
  loading?: boolean;
}>();

const emit = defineEmits<{
  (
    e: "create",
    payload: { code: string; discountPercent: number; maxRedemptions: number; expiresAt?: string }
  ): void;
  (e: "toggle", couponId: string): void;
  (e: "delete", couponId: string): void;
}>();

const searchQuery = ref("");
const showCreateModal = ref(false);
const isMounted = ref(false);

onMounted(() => {
  isMounted.value = true;
});

const newCode = ref("");
const newDiscount = ref<number>(20);
const newMaxRedemptions = ref<number>(50);
const newExpiresAt = ref("");

function handleCreate() {
  if (!newCode.value.trim() || newDiscount.value < 1) return;
  emit("create", {
    code: newCode.value.trim().toUpperCase(),
    discountPercent: Number(newDiscount.value),
    maxRedemptions: Number(newMaxRedemptions.value) || 0,
    expiresAt: newExpiresAt.value || undefined,
  });
  newCode.value = "";
  newDiscount.value = 20;
  newMaxRedemptions.value = 50;
  newExpiresAt.value = "";
  showCreateModal.value = false;
}

const filteredCoupons = computed(() => {
  if (!searchQuery.value.trim()) return props.coupons;
  const q = searchQuery.value.toLowerCase().trim();
  return props.coupons.filter((c) => {
    return (
      c.code.toLowerCase().includes(q) ||
      c.appName.toLowerCase().includes(q) ||
      (c.appSlug && c.appSlug.toLowerCase().includes(q))
    );
  });
});

const globalCount = computed(() => props.coupons.filter((c) => c.isGlobal).length);
const activeCount = computed(() => props.coupons.filter((c) => c.isActive).length);
const inactiveCount = computed(() => props.coupons.filter((c) => !c.isActive).length);
</script>

<template>
  <section class="space-y-4">
    <!-- Macro Summary Counter -->
    <StatsBar borderless>
      <StatItem
        label="Total Kupon"
        :value="coupons.length"
        sublabel="Seluruh promo platform"
        :loading="loading"
      />
      <StatItem
        label="Kupon Global"
        :value="globalCount"
        sublabel="Berlaku semua software"
        variant="gold"
        bordered
        :loading="loading"
      />
      <StatItem
        label="Kupon Aktif"
        :value="activeCount"
        sublabel="Dapat digunakan saat checkout"
        variant="forest"
        bordered
        :loading="loading"
      />
      <StatItem
        label="Kupon Nonaktif"
        :value="inactiveCount"
        sublabel="Kedaluwarsa atau dimatikan"
        variant="crimson"
        bordered
        :loading="loading"
      />
    </StatsBar>

    <!-- Global Search Input Teleported to Top Header (#admin-header-search) -->
    <Teleport v-if="isMounted" to="#admin-header-search">
      <SearchInput
        v-model="searchQuery"
        dark
        placeholder="Cari kode kupon, target software..."
        wrapper-class="w-full max-w-md"
        input-class="h-8 text-xs"
      />
    </Teleport>

    <!-- Mobile Search Input Teleported to Admin Mobile Header (#admin-mobile-header-search) -->
    <Teleport v-if="isMounted" to="#admin-mobile-header-search">
      <SearchInput
        v-model="searchQuery"
        dark
        placeholder="Cari kode kupon, target software..."
        wrapper-class="w-full"
        input-class="h-8 text-xs"
      />
    </Teleport>

    <!-- Unified Table Toolbar (Standard Tertaut Dark Bar) -->
    <div
      class="-mx-3.5 sm:-mx-4 md:-mx-6 px-3.5 sm:px-4 md:px-6 min-h-[44px] py-1.5 sm:py-0 bg-jetblack text-white border-b border-jetblack flex items-center justify-between gap-3 overflow-x-auto no-scrollbar shadow-xs mb-0 !mt-0"
    >
      <div class="flex items-center gap-2 shrink-0">
        <Ticket class="w-3.5 h-3.5 text-gold" />
        <span class="text-xs font-bold text-white uppercase tracking-wider">
          Kupon Global Platform
        </span>
        <span
          class="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white font-mono font-bold"
        >
          {{ filteredCoupons.length }} kupon
        </span>
      </div>

      <div class="flex items-center gap-2 shrink-0">
        <button
          type="button"
          @click="showCreateModal = true"
          class="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg btn-gold text-xs font-bold transition shadow-2xs cursor-pointer active:scale-95 shrink-0"
        >
          <Plus class="w-3.5 h-3.5 stroke-[3]" />
          <span>Buat Kupon Global</span>
        </button>
      </div>
    </div>

    <!-- Table View -->
    <TableContainer>
      <template #head>
        <tr>
          <th class="py-2.5 pr-3 pl-3.5 sm:pl-4 md:pl-6">Kode Kupon</th>
          <th class="py-2.5 px-3">Cakupan</th>
          <th class="py-2.5 px-3">Diskon</th>
          <th class="py-2.5 px-3">Penggunaan / Kuota</th>
          <th class="py-2.5 px-3">Status</th>
          <th class="py-2.5 px-3">Kedaluwarsa</th>
          <th class="py-2.5 px-3">Aksi</th>
          <th class="py-2.5 pl-3 pr-3.5 sm:pr-4 md:pr-6 text-right">Dibuat</th>
        </tr>
      </template>

      <TableSkeleton v-if="loading" :columns="8" :rows="4" />
      <tr v-else-if="filteredCoupons.length === 0">
        <td colspan="8" class="py-8 px-3.5 sm:px-4 md:px-6">
          <EmptyState
            :icon="Ticket"
            title="Tidak ada kupon diskon ditemukan"
            description="Coba sesuaikan kata kunci pencarian Anda."
            container-class="border-0 bg-transparent py-4"
          />
        </td>
      </tr>
      <tr
        v-else
        v-for="c in filteredCoupons"
        :key="c.id"
        class="hover:bg-jetblack/[0.02] transition"
      >
        <td class="py-2.5 pr-3 pl-3.5 sm:pl-4 md:pl-6">
          <div class="flex items-center gap-1.5">
            <Ticket class="w-3.5 h-3.5 text-gold shrink-0" />
            <span
              class="font-mono font-bold text-jetblack bg-gold/15 text-[#8a6d1f] px-2 py-0.5 rounded border border-gold/30"
            >
              {{ c.code }}
            </span>
          </div>
        </td>
        <td class="py-2.5 px-3">
          <span
            v-if="c.isGlobal"
            class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200"
          >
            <Globe class="w-3 h-3" />
            Global (Semua Software)
          </span>
          <span
            v-else
            class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-jetblack/5 text-jetblack/80"
          >
            <AppWindow class="w-3 h-3 text-jetblack/50" />
            {{ c.appName }}
          </span>
        </td>
        <td class="py-2.5 px-3 font-bold text-forest text-xs">
          <span class="font-mono font-black">{{ c.discountPercent }}%</span>
          <span class="text-[10px] font-semibold uppercase tracking-wider ml-1">OFF</span>
        </td>
        <td class="py-2.5 px-3">
          <div class="flex items-center gap-2">
            <span class="font-mono font-bold text-jetblack">{{ c.redemptionCount }}</span>
            <span class="text-jetblack/40 font-mono">
              / {{ c.maxRedemptions === 0 ? "∞" : c.maxRedemptions }}
            </span>
          </div>
        </td>
        <td class="py-2.5 px-3">
          <StatusBadge :status="c.isActive ? 'AKTIF' : 'NONAKTIF'" />
        </td>
        <td class="py-2.5 px-3 text-[11px] text-jetblack/70">
          <span v-if="c.expiresAt" class="font-mono">{{
            new Date(c.expiresAt).toLocaleDateString("id-ID")
          }}</span>
          <span v-else class="text-forest font-semibold">Selamanya</span>
        </td>
        <td class="py-2.5 px-3">
          <div class="flex items-center gap-1.5">
            <button
              @click="emit('toggle', c.id)"
              :class="[
                'px-2 py-1 rounded text-[11px] font-bold border transition cursor-pointer',
                c.isActive
                  ? 'border-slate-300 bg-white text-jetblack/70 hover:bg-slate-50'
                  : 'border-forest/40 bg-forest/10 text-forest hover:bg-forest/20',
              ]"
              :title="c.isActive ? 'Nonaktifkan kupon' : 'Aktifkan kupon'"
            >
              <Power class="w-3 h-3" />
            </button>
            <button
              @click="emit('delete', c.id)"
              class="p-1 rounded text-red-600 hover:bg-red-50 border border-red-200 transition cursor-pointer"
              title="Hapus kupon"
            >
              <Trash2 class="w-3.5 h-3.5" />
            </button>
          </div>
        </td>
        <td
          class="py-2.5 pl-3 pr-3.5 sm:pr-4 md:pr-6 text-right text-jetblack/50 text-[11px] font-mono"
        >
          {{ new Date(c.createdAt).toLocaleDateString("id-ID") }}
        </td>
      </tr>
    </TableContainer>

    <!-- Create Global Coupon Modal -->
    <BaseModal
      :show="showCreateModal"
      title="Buat Kupon Global Baru"
      @close="showCreateModal = false"
    >
      <template #title-icon>
        <Ticket class="w-4 h-4 text-gold" />
      </template>

      <div class="p-6 space-y-4">
        <div class="space-y-3 text-xs">
          <div>
            <label class="font-bold text-jetblack block mb-1">Kode Kupon</label>
            <input
              v-model="newCode"
              type="text"
              placeholder="Misal: PROMO2026, HEMAT25"
              class="w-full h-9 px-3 uppercase rounded-lg border border-slate-300 font-mono font-bold focus:border-gold focus:outline-none"
            />
            <p class="text-[10.5px] text-jetblack/50 mt-1">
              Berlaku untuk seluruh software yang ada di tertaut.com
            </p>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="font-bold text-jetblack block mb-1">Diskon (%)</label>
              <input
                v-model.number="newDiscount"
                type="number"
                min="1"
                max="100"
                class="w-full h-9 px-3 rounded-lg border border-slate-300 font-bold focus:border-gold focus:outline-none"
              />
            </div>
            <div>
              <label class="font-bold text-jetblack block mb-1">Kuota Maksimal</label>
              <input
                v-model.number="newMaxRedemptions"
                type="number"
                min="0"
                placeholder="0 = Tanpa batas"
                class="w-full h-9 px-3 rounded-lg border border-slate-300 focus:border-gold focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label class="font-bold text-jetblack block mb-1">Tanggal Kedaluwarsa (Opsional)</label>
            <input
              v-model="newExpiresAt"
              type="date"
              class="w-full h-9 px-3 rounded-lg border border-slate-300 focus:border-gold focus:outline-none"
            />
          </div>
        </div>
      </div>

      <template #footer>
        <div class="flex justify-end gap-2">
          <button
            @click="showCreateModal = false"
            class="px-3.5 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-jetblack/70 hover:bg-slate-50 cursor-pointer"
          >
            Batal
          </button>
          <button
            @click="handleCreate"
            class="px-4 py-1.5 rounded-lg btn-gold text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-2xs"
          >
            <span>Simpan &amp; Aktifkan</span>
          </button>
        </div>
      </template>
    </BaseModal>
  </section>
</template>
