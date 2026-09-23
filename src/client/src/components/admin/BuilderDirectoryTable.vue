<script setup lang="ts">
import { ref, computed } from "vue";
import { Search, Building2, Download, ShieldAlert, ShieldCheck } from "lucide-vue-next";
import type { PanelBuilderItem } from "../../types/panel";

const props = defineProps<{
  builders: PanelBuilderItem[];
}>();

const emit = defineEmits<{
  (e: "toggleSuspend", builderId: string): void;
}>();

const searchQuery = ref("");

function handleExportCsv() {
  window.open("/api/v1/panel/export/builders", "_blank");
}

const filteredBuilders = computed(() => {
  if (!searchQuery.value.trim()) return props.builders;
  const q = searchQuery.value.toLowerCase().trim();
  return props.builders.filter((b) => {
    const matchName = (b.name || "").toLowerCase().includes(q);
    const matchEmail = (b.email || "").toLowerCase().includes(q);
    const matchBank = (b.bankAccount?.bankName || b.disbursementAccount?.bankCode || "")
      .toLowerCase()
      .includes(q);
    return matchName || matchEmail || matchBank;
  });
});
</script>

<template>
  <section class="space-y-4">
    <!-- Search & Info Bar -->
    <div
      class="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-jetblack/10"
    >
      <div class="relative flex-1 max-w-sm">
        <Search class="w-3.5 h-3.5 text-jetblack/40 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Cari nama builder, email, atau rekening..."
          class="w-full h-9 pl-8 pr-3 text-xs rounded-lg bg-white border border-slate-300/80 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-gold/20 focus:border-gold shadow-2xs transition"
        />
      </div>
      <div class="flex items-center gap-3">
        <button
          @click="handleExportCsv"
          class="h-9 px-3 rounded-lg border border-slate-300/80 hover:border-slate-400 bg-white text-jetblack text-xs font-semibold inline-flex items-center gap-1.5 shadow-2xs transition cursor-pointer"
          title="Unduh seluruh data direktori builder ke format CSV"
        >
          <Download class="w-3.5 h-3.5" />
          <span>Ekspor CSV</span>
        </button>
        <div class="text-xs text-jetblack/60 font-medium">
          Total <strong>{{ filteredBuilders.length }}</strong> dari
          <strong>{{ builders.length }}</strong> builder
        </div>
      </div>
    </div>

    <!-- Table View (Responsive Table with Horizontal Scroll on Mobile) -->
    <div class="-mx-3.5 sm:-mx-4 md:-mx-6 overflow-x-auto top-scrollbar">
      <table
        class="w-full min-w-full text-left text-xs whitespace-nowrap border-b border-jetblack/15"
      >
        <thead class="border-b border-jetblack/20 text-xs font-semibold text-jetblack/70 bg-white">
          <tr>
            <th class="py-2.5 pr-3 pl-3.5 sm:pl-4 md:pl-6">Builder</th>
            <th class="py-2.5 px-3">Status</th>
            <th class="py-2.5 px-3">Email</th>
            <th class="py-2.5 px-3">Rekening Pencairan</th>
            <th class="py-2.5 px-3">Aplikasi</th>
            <th class="py-2.5 px-3">Total GMV</th>
            <th class="py-2.5 px-3">Net 95%</th>
            <th class="py-2.5 px-3">Aksi Moderasi</th>
            <th class="py-2.5 pl-3 pr-3.5 sm:pr-4 md:pr-6 text-right">Terdaftar</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-jetblack/15">
          <tr v-if="filteredBuilders.length === 0">
            <td colspan="9" class="py-8 px-3.5 sm:px-4 md:px-6 text-center text-jetblack/40">
              Tidak ada data builder ditemukan.
            </td>
          </tr>
          <tr v-for="b in filteredBuilders" :key="b.id" class="hover:bg-jetblack/[0.02] transition">
            <td class="py-2.5 pr-3 pl-3.5 sm:pl-4 md:pl-6 font-bold text-jetblack">
              {{ b.name || "Builder" }}
            </td>
            <td class="py-2.5 px-3">
              <span
                v-if="b.isSuspended"
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
            <td class="py-2.5 px-3 text-[11px] text-jetblack/70 font-mono">
              {{ b.email }}
            </td>
            <td class="py-2.5 px-3 text-jetblack/80">
              <div v-if="b.bankAccount || b.disbursementAccount" class="space-y-0.5">
                <div class="font-semibold text-jetblack">
                  {{ b.bankAccount?.bankName || b.disbursementAccount?.bankCode || "BCA" }} •
                  {{ b.bankAccount?.accountNumber || b.disbursementAccount?.accountNumber }}
                </div>
                <div class="text-[10px] text-jetblack/50">
                  a.n.
                  {{
                    b.bankAccount?.accountHolder ||
                    b.disbursementAccount?.accountHolderName ||
                    b.name
                  }}
                </div>
              </div>
              <span v-else class="text-jetblack/40 italic">Belum dikonfigurasi</span>
            </td>
            <td class="py-2.5 px-3">
              <div class="font-bold text-jetblack">
                {{ b.appCount ?? b.totalApps ?? (b.apps?.length || 0) }} Software
              </div>
              <div v-if="b.apps && b.apps.length > 0" class="flex flex-wrap gap-1 mt-1 max-w-xs">
                <span
                  v-for="app in b.apps"
                  :key="app.id"
                  class="inline-flex items-center px-1.5 py-0.2 rounded text-[9.5px] font-medium bg-jetblack/5 text-jetblack/75"
                >
                  {{ app.name }}
                </span>
              </div>
            </td>
            <td class="py-2.5 px-3 font-mono font-bold text-jetblack">
              Rp {{ (b.totalSales ?? b.totalGMV ?? 0).toLocaleString("id-ID") }}
            </td>
            <td class="py-2.5 px-3 font-mono font-bold text-forest">
              Rp {{ (b.builderNetRevenue ?? b.totalNetEarnings ?? 0).toLocaleString("id-ID") }}
            </td>
            <td class="py-2.5 px-3">
              <button
                @click="emit('toggleSuspend', b.id)"
                :class="[
                  'px-2.5 py-1 rounded text-[11px] font-bold border transition cursor-pointer',
                  b.isSuspended
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                    : 'border-red-300 bg-white text-red-600 hover:bg-red-50',
                ]"
              >
                {{ b.isSuspended ? "Aktifkan" : "Bekukan" }}
              </button>
            </td>
            <td class="py-2.5 pl-3 pr-3.5 sm:pr-4 md:pr-6 text-right text-jetblack/50 text-[11px]">
              {{ b.createdAt ? new Date(b.createdAt).toLocaleDateString("id-ID") : "-" }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
