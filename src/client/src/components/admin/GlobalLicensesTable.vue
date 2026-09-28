<script setup lang="ts">
import { ref, computed } from "vue";
import {
  Search,
  Download,
  Key,
  ShieldAlert,
  ShieldCheck,
  Clock,
  Copy,
  Check,
  RotateCcw,
} from "lucide-vue-next";
import type { PanelLicenseItem } from "../../types/panel";

const props = defineProps<{
  licenses: PanelLicenseItem[];
  loading?: boolean;
}>();

const emit = defineEmits<{
  (e: "revoke", lic: PanelLicenseItem): void;
  (e: "reactivate", lic: PanelLicenseItem): void;
}>();

const searchQuery = ref("");
const statusFilter = ref("");
const copiedId = ref<string | null>(null);

function copyLicenseKey(key: string, id: string) {
  navigator.clipboard.writeText(key);
  copiedId.value = id;
  setTimeout(() => {
    copiedId.value = null;
  }, 2000);
}

function handleExportCsv() {
  window.open("/api/v1/panel/export/licenses", "_blank");
}

const filteredLicenses = computed(() => {
  return props.licenses.filter((lic) => {
    if (statusFilter.value && lic.status !== statusFilter.value) {
      return false;
    }
    if (searchQuery.value.trim()) {
      const q = searchQuery.value.toLowerCase().trim();
      const matchKey = lic.licenseKey.toLowerCase().includes(q);
      const matchCust = lic.customerEmail.toLowerCase().includes(q);
      const matchApp = lic.appName.toLowerCase().includes(q);
      const matchBuilder = lic.builderEmail.toLowerCase().includes(q);
      if (!matchKey && !matchCust && !matchApp && !matchBuilder) return false;
    }
    return true;
  });
});

const activeCount = computed(() => props.licenses.filter((l) => l.status === "ACTIVE").length);
const revokedCount = computed(() => props.licenses.filter((l) => l.status === "REVOKED").length);
const expiredCount = computed(() => props.licenses.filter((l) => l.status === "EXPIRED").length);
</script>

<template>
  <section class="space-y-4">
    <!-- Macro Summary Counter -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <div class="p-3 rounded-xl border border-jetblack/15 bg-white space-y-1">
        <span class="text-[10px] font-bold uppercase tracking-wider text-jetblack/50"
          >Total Lisensi</span
        >
        <div class="text-lg font-black text-jetblack">{{ licenses.length }}</div>
      </div>
      <div class="p-3 rounded-xl border border-forest/20 bg-forest/5 space-y-1">
        <span class="text-[10px] font-bold uppercase tracking-wider text-forest"
          >Aktif (Valid)</span
        >
        <div class="text-lg font-black text-forest">{{ activeCount }}</div>
      </div>
      <div class="p-3 rounded-xl border border-red-200 bg-red-50/50 space-y-1">
        <span class="text-[10px] font-bold uppercase tracking-wider text-red-700"
          >Dicabut (Revoked)</span
        >
        <div class="text-lg font-black text-red-700">{{ revokedCount }}</div>
      </div>
      <div class="p-3 rounded-xl border border-amber-200 bg-amber-50/50 space-y-1">
        <span class="text-[10px] font-bold uppercase tracking-wider text-amber-700"
          >Kedaluwarsa</span
        >
        <div class="text-lg font-black text-amber-700">{{ expiredCount }}</div>
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
          placeholder="Cari kunci lisensi, email pelanggan, software..."
          class="w-full h-9 pl-8 pr-3 text-xs rounded-lg bg-white border border-slate-300/80 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-gold/20 focus:border-gold shadow-2xs transition"
        />
      </div>

      <div class="flex items-center gap-2">
        <select
          v-model="statusFilter"
          class="h-9 px-3 text-xs rounded-lg border border-slate-300/80 hover:border-slate-400 bg-white font-medium text-jetblack focus:outline-none focus:ring-2 focus:ring-gold/20 focus:border-gold shadow-2xs transition"
        >
          <option value="">Semua Status</option>
          <option value="ACTIVE">ACTIVE</option>
          <option value="REVOKED">REVOKED</option>
          <option value="EXPIRED">EXPIRED</option>
        </select>

        <button
          @click="handleExportCsv"
          class="h-9 px-3 rounded-lg border border-slate-300/80 hover:border-slate-400 bg-white text-jetblack text-xs font-semibold inline-flex items-center gap-1.5 shadow-2xs transition cursor-pointer"
          title="Unduh seluruh daftar lisensi ke format CSV"
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
            <th class="py-2.5 pr-3 pl-3.5 sm:pl-4 md:pl-6">License Key</th>
            <th class="py-2.5 px-3">Status</th>
            <th class="py-2.5 px-3">Software</th>
            <th class="py-2.5 px-3">Pelanggan</th>
            <th class="py-2.5 px-3">Seat</th>
            <th class="py-2.5 px-3">Hardware ID</th>
            <th class="py-2.5 px-3">Kedaluwarsa</th>
            <th class="py-2.5 px-3">Aksi</th>
            <th class="py-2.5 pl-3 pr-3.5 sm:pr-4 md:pr-6 text-right">Diterbitkan</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-jetblack/15">
          <tr v-if="filteredLicenses.length === 0">
            <td colspan="9" class="py-8 px-3.5 sm:px-4 md:px-6 text-center text-jetblack/40">
              Tidak ada lisensi ditemukan.
            </td>
          </tr>
          <tr
            v-for="lic in filteredLicenses"
            :key="lic.id"
            class="hover:bg-jetblack/[0.02] transition"
          >
            <td class="py-2.5 pr-3 pl-3.5 sm:pl-4 md:pl-6">
              <div class="flex items-center gap-2">
                <span
                  class="font-mono font-bold text-jetblack bg-jetblack/5 px-2 py-0.5 rounded border border-jetblack/10"
                >
                  {{ lic.licenseKey }}
                </span>
                <button
                  @click="copyLicenseKey(lic.licenseKey, lic.id)"
                  class="p-1 rounded hover:bg-jetblack/10 text-jetblack/60 hover:text-jetblack transition cursor-pointer"
                  title="Salin License Key"
                >
                  <Check v-if="copiedId === lic.id" class="w-3.5 h-3.5 text-forest" />
                  <Copy v-else class="w-3.5 h-3.5" />
                </button>
              </div>
            </td>
            <td class="py-2.5 px-3">
              <span
                v-if="lic.status === 'ACTIVE'"
                class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-forest/10 text-forest border border-forest/20"
              >
                <ShieldCheck class="w-3 h-3" />
                ACTIVE
              </span>
              <span
                v-else-if="lic.status === 'REVOKED'"
                class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 border border-red-200"
              >
                <ShieldAlert class="w-3 h-3" />
                REVOKED
              </span>
              <span
                v-else
                class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200"
              >
                <Clock class="w-3 h-3" />
                EXPIRED
              </span>
            </td>
            <td class="py-2.5 px-3">
              <div class="font-semibold text-jetblack">{{ lic.appName }}</div>
              <div class="text-[10px] text-jetblack/50 font-mono">oleh {{ lic.builderName }}</div>
            </td>
            <td class="py-2.5 px-3 text-[11px] text-jetblack/70 font-mono">
              {{ lic.customerEmail }}
            </td>
            <td class="py-2.5 px-3 font-mono">
              <span class="font-bold text-jetblack">{{ lic.usedSeats }}</span>
              <span class="text-jetblack/40">/{{ lic.maxSeats }}</span>
            </td>
            <td class="py-2.5 px-3 text-[11px] text-jetblack/60 font-mono">
              <span
                v-if="lic.hardwareId"
                class="truncate max-w-[120px] inline-block"
                :title="lic.hardwareId"
              >
                {{ lic.hardwareId.slice(0, 12) }}...
              </span>
              <span v-else class="text-jetblack/30 italic">Belum aktivasi</span>
            </td>
            <td class="py-2.5 px-3 text-[11px] text-jetblack/70">
              <span v-if="lic.expiresAt" class="font-mono">
                {{ new Date(lic.expiresAt).toLocaleDateString("id-ID") }}
              </span>
              <span v-else class="font-bold text-forest text-[10px] uppercase"> Lifetime </span>
            </td>
            <td class="py-2.5 px-3">
              <button
                v-if="lic.status === 'ACTIVE'"
                @click="emit('revoke', lic)"
                class="px-2.5 py-1 rounded text-[11px] font-bold border border-red-300 bg-white text-red-600 hover:bg-red-50 transition cursor-pointer"
                title="Cabut lisensi ini"
              >
                Cabut (Revoke)
              </button>
              <button
                v-else-if="lic.status === 'REVOKED'"
                @click="emit('reactivate', lic)"
                class="px-2.5 py-1 rounded text-[11px] font-bold border border-emerald-500 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition cursor-pointer inline-flex items-center gap-1"
                title="Aktifkan kembali lisensi ini"
              >
                <RotateCcw class="w-3 h-3" />
                <span>Aktifkan</span>
              </button>
              <span v-else class="text-jetblack/40 text-[11px]">-</span>
            </td>
            <td
              class="py-2.5 pl-3 pr-3.5 sm:pr-4 md:pr-6 text-right text-jetblack/50 text-[11px] font-mono"
            >
              {{ new Date(lic.createdAt).toLocaleDateString("id-ID") }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
