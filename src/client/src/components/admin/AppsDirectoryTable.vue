<script setup lang="ts">
import { ref, computed } from "vue";
import {
  Search,
  Download,
  AppWindow,
  ExternalLink,
  ShieldAlert,
  ShieldCheck,
  Tag,
  Key,
} from "lucide-vue-next";
import type { PanelAppItem } from "../../types/panel";
import TableSkeleton from "../common/TableSkeleton.vue";

const props = defineProps<{
  apps: PanelAppItem[];
  loading?: boolean;
}>();

const emit = defineEmits<{
  (e: "toggleSuspend", appId: string): void;
}>();

const searchQuery = ref("");
const modeFilter = ref("");
const statusFilter = ref("");

function handleExportCsv() {
  window.open("/api/v1/panel/export/apps", "_blank");
}

const filteredApps = computed(() => {
  return props.apps.filter((app) => {
    if (modeFilter.value && app.mode !== modeFilter.value) {
      return false;
    }
    if (statusFilter.value === "active" && app.isSuspended) {
      return false;
    }
    if (statusFilter.value === "suspended" && !app.isSuspended) {
      return false;
    }
    if (searchQuery.value.trim()) {
      const q = searchQuery.value.toLowerCase().trim();
      const matchName = app.name.toLowerCase().includes(q);
      const matchSlug = app.slug.toLowerCase().includes(q);
      const matchBuilder = app.builderName.toLowerCase().includes(q);
      const matchEmail = app.builderEmail.toLowerCase().includes(q);
      if (!matchName && !matchSlug && !matchBuilder && !matchEmail) return false;
    }
    return true;
  });
});

const liveCount = computed(() => props.apps.filter((a) => a.mode === "live").length);
const sandboxCount = computed(() => props.apps.filter((a) => a.mode === "sandbox").length);
const suspendedCount = computed(() => props.apps.filter((a) => a.isSuspended).length);
</script>

<template>
  <section class="space-y-4">
    <!-- Macro Summary Counter -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <div class="p-3 rounded-xl border border-jetblack/15 bg-white space-y-1">
        <span class="text-[10px] font-bold uppercase tracking-wider text-jetblack/50"
          >Total Software</span
        >
        <div v-if="loading" class="h-6 w-10 bg-jetblack/10 rounded animate-pulse mt-0.5"></div>
        <div v-else class="text-lg font-black text-jetblack">{{ apps.length }}</div>
      </div>
      <div class="p-3 rounded-xl border border-forest/20 bg-forest/5 space-y-1">
        <span class="text-[10px] font-bold uppercase tracking-wider text-forest">Mode Live</span>
        <div v-if="loading" class="h-6 w-10 bg-forest/20 rounded animate-pulse mt-0.5"></div>
        <div v-else class="text-lg font-black text-forest">{{ liveCount }}</div>
      </div>
      <div class="p-3 rounded-xl border border-gold/25 bg-gold/5 space-y-1">
        <span class="text-[10px] font-bold uppercase tracking-wider text-[#8a6d1f]"
          >Mode Sandbox</span
        >
        <div v-if="loading" class="h-6 w-10 bg-gold/25 rounded animate-pulse mt-0.5"></div>
        <div v-else class="text-lg font-black text-[#8a6d1f]">{{ sandboxCount }}</div>
      </div>
      <div class="p-3 rounded-xl border border-red-200 bg-red-50/50 space-y-1">
        <span class="text-[10px] font-bold uppercase tracking-wider text-red-700">Dibekukan</span>
        <div v-if="loading" class="h-6 w-10 bg-red-200 rounded animate-pulse mt-0.5"></div>
        <div v-else class="text-lg font-black text-red-700">{{ suspendedCount }}</div>
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
          placeholder="Cari software, slug, nama builder..."
          class="w-full h-9 pl-8 pr-3 text-xs rounded-lg bg-white border border-slate-300/80 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-gold/20 focus:border-gold shadow-2xs transition"
        />
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <select
          v-model="modeFilter"
          class="h-9 px-3 text-xs rounded-lg border border-slate-300/80 hover:border-slate-400 bg-white font-medium text-jetblack focus:outline-none focus:ring-2 focus:ring-gold/20 focus:border-gold shadow-2xs transition"
        >
          <option value="">Semua Mode</option>
          <option value="live">Mode Live</option>
          <option value="sandbox">Mode Sandbox</option>
        </select>

        <select
          v-model="statusFilter"
          class="h-9 px-3 text-xs rounded-lg border border-slate-300/80 hover:border-slate-400 bg-white font-medium text-jetblack focus:outline-none focus:ring-2 focus:ring-gold/20 focus:border-gold shadow-2xs transition"
        >
          <option value="">Semua Status</option>
          <option value="active">Aktif</option>
          <option value="suspended">Dibekukan</option>
        </select>

        <button
          @click="handleExportCsv"
          class="h-9 px-3 rounded-lg border border-slate-300/80 hover:border-slate-400 bg-white text-jetblack text-xs font-semibold inline-flex items-center gap-1.5 shadow-2xs transition cursor-pointer"
          title="Unduh seluruh data software ke format CSV"
        >
          <Download class="w-3.5 h-3.5" />
          <span>Ekspor CSV</span>
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
            <th class="py-2.5 pr-3 pl-3.5 sm:pl-4 md:pl-6">Software</th>
            <th class="py-2.5 px-3">Status</th>
            <th class="py-2.5 px-3">Builder</th>
            <th class="py-2.5 px-3">Mode</th>
            <th class="py-2.5 px-3">Harga &amp; Tipe</th>
            <th class="py-2.5 px-3">Lisensi</th>
            <th class="py-2.5 px-3">Total GMV</th>
            <th class="py-2.5 px-3">Delivery</th>
            <th class="py-2.5 px-3">Moderasi</th>
            <th class="py-2.5 pl-3 pr-3.5 sm:pr-4 md:pr-6 text-right">Dibuat</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-jetblack/15">
          <TableSkeleton v-if="loading" :columns="10" :rows="5" />
          <tr v-else-if="filteredApps.length === 0">
            <td colspan="10" class="py-8 px-3.5 sm:px-4 md:px-6 text-center text-jetblack/40">
              Tidak ada software ditemukan.
            </td>
          </tr>
          <tr
            v-else
            v-for="app in filteredApps"
            :key="app.id"
            class="hover:bg-jetblack/[0.02] transition"
          >
            <td class="py-2.5 pr-3 pl-3.5 sm:pl-4 md:pl-6">
              <div class="font-bold text-jetblack flex items-center gap-1.5">
                <AppWindow class="w-3.5 h-3.5 text-gold" />
                <span>{{ app.name }}</span>
              </div>
              <div class="text-[10.5px] text-jetblack/50 font-mono mt-0.5">/{{ app.slug }}</div>
            </td>
            <td class="py-2.5 px-3">
              <span
                v-if="app.isSuspended"
                class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 border border-red-200"
              >
                <ShieldAlert class="w-3 h-3" />
                DIBEKUKAN
              </span>
              <span
                v-else
                class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200"
              >
                <ShieldCheck class="w-3 h-3" />
                AKTIF
              </span>
            </td>
            <td class="py-2.5 px-3">
              <div class="font-semibold text-jetblack">{{ app.builderName }}</div>
              <div class="text-[10px] text-jetblack/50 font-mono">{{ app.builderEmail }}</div>
            </td>
            <td class="py-2.5 px-3">
              <span
                :class="[
                  'px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider',
                  app.mode === 'live'
                    ? 'bg-forest/10 text-forest border border-forest/20'
                    : 'bg-gold/15 text-[#8a6d1f] border border-gold/30',
                ]"
              >
                {{ app.mode }}
              </span>
            </td>
            <td class="py-2.5 px-3">
              <div class="font-mono font-bold text-jetblack">
                Rp {{ app.targetPrice.toLocaleString("id-ID") }}
              </div>
              <div class="text-[10px] text-jetblack/50 uppercase font-medium">
                {{ app.pricingType.replace("_", " ") }}
              </div>
            </td>
            <td class="py-2.5 px-3">
              <span class="font-bold text-jetblack font-mono">{{ app.licenseCount }}</span>
              <span class="text-jetblack/50 text-[10px] ml-1">terbit</span>
            </td>
            <td class="py-2.5 px-3 font-mono font-bold text-forest">
              Rp {{ app.totalGMV.toLocaleString("id-ID") }}
            </td>
            <td class="py-2.5 px-3">
              <span
                class="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-jetblack/5 text-[10px] font-medium text-jetblack/70"
              >
                <Tag class="w-2.5 h-2.5 text-jetblack/40" />
                {{ app.deliveryType.replace("_", " ") }}
              </span>
            </td>
            <td class="py-2.5 px-3">
              <div class="flex items-center gap-1.5">
                <a
                  :href="app.mode === 'live' ? `/pay/${app.slug}` : `/demo/checkout/${app.slug}`"
                  target="_blank"
                  class="px-2 py-1 rounded text-[11px] font-semibold border border-jetblack/15 bg-white text-jetblack/70 hover:text-jetblack hover:bg-jetblack/5 inline-flex items-center gap-1 shadow-2xs"
                  title="Lihat halaman checkout produk"
                >
                  <ExternalLink class="w-3 h-3" />
                  <span>Lihat</span>
                </a>
                <button
                  @click="emit('toggleSuspend', app.id)"
                  :class="[
                    'px-2 py-1 rounded text-[11px] font-bold border transition cursor-pointer',
                    app.isSuspended
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                      : 'border-red-300 bg-white text-red-600 hover:bg-red-50',
                  ]"
                >
                  {{ app.isSuspended ? "Aktifkan" : "Bekukan" }}
                </button>
              </div>
            </td>
            <td
              class="py-2.5 pl-3 pr-3.5 sm:pr-4 md:pr-6 text-right text-jetblack/50 text-[11px] font-mono"
            >
              {{ new Date(app.createdAt).toLocaleDateString("id-ID") }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
