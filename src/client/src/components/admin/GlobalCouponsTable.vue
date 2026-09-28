<script setup lang="ts">
import { ref, computed } from "vue";
import {
  Search,
  Plus,
  Ticket,
  Globe,
  AppWindow,
  Trash2,
  Power,
  Calendar,
  Percent,
} from "lucide-vue-next";
import type { PanelCouponItem } from "../../types/panel";

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
</script>

<template>
  <section class="space-y-4">
    <!-- Macro Summary Counter -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <div class="p-3 rounded-xl border border-jetblack/15 bg-white space-y-1">
        <span class="text-[10px] font-bold uppercase tracking-wider text-jetblack/50"
          >Total Kupon</span
        >
        <div class="text-lg font-black text-jetblack">{{ coupons.length }}</div>
      </div>
      <div class="p-3 rounded-xl border border-gold/25 bg-gold/5 space-y-1">
        <span class="text-[10px] font-bold uppercase tracking-wider text-[#8a6d1f]"
          >Kupon Global</span
        >
        <div class="text-lg font-black text-[#8a6d1f]">{{ globalCount }}</div>
      </div>
      <div class="p-3 rounded-xl border border-forest/20 bg-forest/5 space-y-1">
        <span class="text-[10px] font-bold uppercase tracking-wider text-forest">Kupon Aktif</span>
        <div class="text-lg font-black text-forest">{{ activeCount }}</div>
      </div>
      <div
        class="p-3 rounded-xl border border-jetblack/10 bg-jetblack/5 flex items-center justify-between"
      >
        <div>
          <span class="text-[10px] font-bold uppercase tracking-wider text-jetblack/60"
            >Aksi Cepat</span
          >
          <div class="text-xs font-bold text-jetblack">Buat Promo</div>
        </div>
        <button
          @click="showCreateModal = true"
          class="h-8 px-3 rounded-lg btn-gold text-xs font-bold inline-flex items-center gap-1.5 shadow-2xs cursor-pointer active:scale-95"
        >
          <Plus class="w-3.5 h-3.5" />
          <span>Kupon Baru</span>
        </button>
      </div>
    </div>

    <!-- Filter & Search Bar -->
    <div
      class="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-jetblack/10"
    >
      <div class="relative flex-1 max-w-sm">
        <Search class="w-3.5 h-3.5 text-jetblack/40 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Cari kode kupon, target software..."
          class="w-full h-9 pl-8 pr-3 text-xs rounded-lg bg-white border border-slate-300/80 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-gold/20 focus:border-gold shadow-2xs transition"
        />
      </div>

      <div class="flex items-center gap-2">
        <button
          @click="showCreateModal = true"
          class="h-9 px-3.5 rounded-lg btn-gold text-xs font-bold inline-flex items-center gap-1.5 shadow-2xs cursor-pointer"
        >
          <Plus class="w-3.5 h-3.5" />
          <span>Buat Kupon Global</span>
        </button>
      </div>
    </div>

    <!-- Table View -->
    <div class="-mx-3.5 sm:-mx-4 md:-mx-6 overflow-x-auto top-scrollbar">
      <table
        class="w-full min-w-full text-left text-xs whitespace-nowrap border-b border-jetblack/15"
      >
        <thead class="border-b border-jetblack/20 text-xs font-semibold text-jetblack/70 bg-white">
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
        </thead>
        <tbody class="divide-y divide-jetblack/15">
          <tr v-if="filteredCoupons.length === 0">
            <td colspan="8" class="py-8 px-3.5 sm:px-4 md:px-6 text-center text-jetblack/40">
              Tidak ada kupon diskon ditemukan.
            </td>
          </tr>
          <tr v-for="c in filteredCoupons" :key="c.id" class="hover:bg-jetblack/[0.02] transition">
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
            <td class="py-2.5 px-3 font-mono font-black text-forest">
              {{ c.discountPercent }}% OFF
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
              <span
                :class="[
                  'px-2 py-0.5 rounded-full text-[10px] font-bold inline-block',
                  c.isActive
                    ? 'bg-forest/10 text-forest border border-forest/20'
                    : 'bg-red-100 text-red-700 border border-red-200',
                ]"
              >
                {{ c.isActive ? "AKTIF" : "NONAKTIF" }}
              </span>
            </td>
            <td class="py-2.5 px-3 text-[11px] text-jetblack/70 font-mono">
              {{ c.expiresAt ? new Date(c.expiresAt).toLocaleDateString("id-ID") : "Selamanya" }}
            </td>
            <td class="py-2.5 px-3">
              <div class="flex items-center gap-1.5">
                <button
                  @click="emit('toggle', c.id)"
                  :class="[
                    'px-2 py-1 rounded text-[11px] font-bold border transition cursor-pointer',
                    c.isActive
                      ? 'border-slate-300 bg-white text-jetblack/70 hover:bg-slate-50'
                      : 'border-emerald-500 bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
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
        </tbody>
      </table>
    </div>

    <!-- Create Global Coupon Modal -->
    <div
      v-if="showCreateModal"
      class="fixed inset-0 bg-jetblack/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn"
    >
      <div
        class="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4 border border-jetblack/10"
      >
        <div class="flex items-center justify-between pb-2 border-b border-jetblack/10">
          <div class="flex items-center gap-2">
            <Ticket class="w-5 h-5 text-gold" />
            <h3 class="font-extrabold text-sm text-jetblack">Buat Kupon Global Baru</h3>
          </div>
          <button
            @click="showCreateModal = false"
            class="text-jetblack/40 hover:text-jetblack text-sm"
          >
            ✕
          </button>
        </div>

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

        <div class="flex justify-end gap-2 pt-3 border-t border-jetblack/10">
          <button
            @click="showCreateModal = false"
            class="px-3.5 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-jetblack/70 hover:bg-slate-50"
          >
            Batal
          </button>
          <button
            @click="handleCreate"
            class="px-4 py-1.5 rounded-lg btn-gold text-xs font-bold inline-flex items-center gap-1.5"
          >
            <span>Simpan &amp; Aktifkan</span>
          </button>
        </div>
      </div>
    </div>
  </section>
</template>
