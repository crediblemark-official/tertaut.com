<script setup lang="ts">
import { ref, computed } from "vue";
import { RefreshCw, Search, Copy, Monitor, Plus, Activity, Laptop, X } from "lucide-vue-next";
import type { LicenseItem } from "../../types/licensing";
import StatusBadge from "../common/StatusBadge.vue";
import TableSkeleton from "../common/TableSkeleton.vue";
import TableContainer from "../common/TableContainer.vue";

const props = defineProps<{
  licensesList: LicenseItem[];
  loading: boolean;
}>();

const emit = defineEmits<{
  (e: "refresh"): void;
  (e: "issue"): void;
  (e: "copy", key: string): void;
  (e: "unbindHardware", lic: LicenseItem): void;
  (e: "deactivateSeat", key: string, hwid: string): void;
  (e: "revoke", lic: LicenseItem): void;
  (e: "detail", lic: LicenseItem): void;
}>();

const searchQuery = ref("");
const platformFilter = ref<"ALL" | "desktop" | "chrome_extension" | "android" | "web" | "general">(
  "ALL"
);
const statusFilter = ref<"ALL" | "ACTIVE" | "REVOKED" | "EXPIRED">("ALL");

const filteredLicenses = computed(() => {
  return props.licensesList.filter((lic) => {
    if (platformFilter.value !== "ALL" && lic.platform !== platformFilter.value) {
      return false;
    }
    if (statusFilter.value !== "ALL" && lic.status !== statusFilter.value) {
      return false;
    }
    if (searchQuery.value.trim()) {
      const q = searchQuery.value.toLowerCase().trim();
      const matchKey = lic.licenseKey.toLowerCase().includes(q);
      const matchEmail = (lic.customerEmail || "").toLowerCase().includes(q);
      const matchApp = (lic.appId || "").toLowerCase().includes(q);
      if (!matchKey && !matchEmail && !matchApp) return false;
    }
    return true;
  });
});
</script>

<template>
  <div>
    <!-- Unified Header & Toolbar (Edge-to-Edge Full Width & Standardized Height) -->
    <div
      class="-mx-3.5 sm:-mx-4 md:-mx-6 px-3.5 sm:px-4 md:px-6 min-h-[44px] py-1.5 sm:py-0 bg-jetblack text-white border-b border-jetblack flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-xs mb-1"
    >
      <div class="flex items-center gap-2 shrink-0">
        <slot name="tabs">
          <div class="flex items-center gap-2">
            <h2 class="text-xs font-bold uppercase tracking-wider text-white">Daftar Lisensi</h2>
            <span
              class="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white font-mono font-bold"
            >
              {{ licensesList.length }} keys
            </span>
          </div>
        </slot>
      </div>

      <div class="flex items-center gap-2 overflow-x-auto no-scrollbar w-full sm:w-auto">
        <!-- Search Input -->
        <div class="relative w-full sm:w-52">
          <Search
            class="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none"
          />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Cari kunci, email, app..."
            class="w-full pl-8 pr-2.5 py-1 rounded-lg bg-white/10 border border-white/15 text-xs text-white placeholder:text-white/40 focus:outline-none focus:bg-white/15 focus:border-gold transition"
          />
        </div>

        <!-- Platform Filter -->
        <div
          class="flex items-center h-7 rounded-md bg-white/10 p-0.5 text-[10px] font-medium shrink-0"
        >
          <button
            @click="platformFilter = 'ALL'"
            :class="[
              'px-2 h-full rounded transition cursor-pointer flex items-center',
              platformFilter === 'ALL'
                ? 'bg-white font-bold text-jetblack'
                : 'text-white/70 hover:text-white',
            ]"
          >
            Semua
          </button>
          <button
            @click="platformFilter = 'desktop'"
            :class="[
              'px-2 h-full rounded transition cursor-pointer flex items-center',
              platformFilter === 'desktop'
                ? 'bg-white font-bold text-jetblack'
                : 'text-white/70 hover:text-white',
            ]"
          >
            Desktop
          </button>
          <button
            @click="platformFilter = 'chrome_extension'"
            :class="[
              'px-2 h-full rounded transition cursor-pointer flex items-center',
              platformFilter === 'chrome_extension'
                ? 'bg-white font-bold text-jetblack'
                : 'text-white/70 hover:text-white',
            ]"
          >
            Chrome
          </button>
          <button
            @click="platformFilter = 'android'"
            :class="[
              'px-2 h-full rounded transition cursor-pointer flex items-center',
              platformFilter === 'android'
                ? 'bg-white font-bold text-jetblack'
                : 'text-white/70 hover:text-white',
            ]"
          >
            Android
          </button>
        </div>

        <button
          @click="emit('refresh')"
          title="Segarkan"
          class="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer transition shrink-0"
        >
          <RefreshCw class="w-3.5 h-3.5" :class="{ 'animate-spin': loading }" />
        </button>

        <button
          @click="emit('issue')"
          class="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg btn-gold text-xs font-bold transition shadow-2xs cursor-pointer active:scale-95 shrink-0"
        >
          <Plus class="w-3.5 h-3.5 stroke-[3]" />
          <span>Terbitkan</span>
        </button>
      </div>
    </div>

    <!-- License Table (Scrollable on mobile) -->
    <TableContainer>
      <template #head>
        <tr>
          <th class="py-2.5 pr-3 pl-3.5 sm:pl-4 md:pl-6">Kunci Lisensi</th>
          <th class="py-2.5 px-3">Aplikasi</th>
          <th class="py-2.5 px-3">Email Pemilik</th>
          <th class="py-2.5 px-3">Platform</th>
          <th class="py-2.5 px-3">Kuota Seat</th>
          <th class="py-2.5 px-3">Perangkat Terikat</th>
          <th class="py-2.5 px-3">Status</th>
          <th class="py-2.5 pl-3 pr-3.5 sm:pr-4 md:pr-6 text-right">Aksi</th>
        </tr>
      </template>

      <TableSkeleton v-if="loading" :columns="8" :rows="6" />
      <tr v-else-if="filteredLicenses.length === 0">
        <td colspan="8" class="py-8 px-3.5 sm:px-4 md:px-6 text-center text-jetblack/40">
          <div class="space-y-1">
            <p class="font-semibold text-xs text-jetblack/60">Tidak ada kunci lisensi ditemukan.</p>
            <p
              class="text-[11px] text-jetblack/40"
              v-if="searchQuery || platformFilter !== 'ALL' || statusFilter !== 'ALL'"
            >
              Coba sesuaikan kata kunci pencarian atau reset filter.
            </p>
          </div>
        </td>
      </tr>
      <tr v-else v-for="lic in filteredLicenses" :key="lic.id" class="hover:bg-jetblack/[0.02]">
        <td class="py-2.5 pr-3 pl-3.5 sm:pl-4 md:pl-6 font-mono">
          <div class="inline-flex items-center gap-1.5 font-bold text-jetblack">
            <span>{{ lic.licenseKey }}</span>
            <button
              @click="emit('copy', lic.licenseKey)"
              title="Salin Kunci"
              class="text-jetblack/40 hover:text-gold cursor-pointer"
            >
              <Copy class="w-3 h-3" />
            </button>
          </div>
        </td>
        <td class="py-2.5 px-3 text-jetblack/70 font-mono text-[11px]">{{ lic.appId }}</td>
        <td class="py-2.5 px-3 text-jetblack/80">{{ lic.customerEmail }}</td>
        <td class="py-2.5 px-3 capitalize font-mono text-[11px] text-jetblack/70">
          {{ lic.platform }}
        </td>
        <!-- Kolom 1: Kuota Seat -->
        <td class="py-2.5 px-3">
          <div
            class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold border shadow-2xs whitespace-nowrap"
            :class="
              lic.seatsUsed && lic.seatsUsed >= (lic.maxSeats || 3)
                ? 'bg-crimson/10 text-crimson border-crimson/20'
                : (lic.seatsUsed || 0) > 0
                  ? 'bg-forest/10 text-forest border-forest/20'
                  : 'bg-jetblack/5 text-jetblack/60 border-jetblack/10'
            "
          >
            <Monitor
              class="w-3 h-3 shrink-0"
              :class="(lic.seatsUsed || 0) > 0 ? 'text-forest' : 'text-jetblack/40'"
            />
            <span>{{ lic.seatsUsed || 0 }} / {{ lic.maxSeats || 3 }} Seats</span>
          </div>
        </td>
        <!-- Kolom 2: Perangkat Terikat -->
        <td class="py-2.5 px-3">
          <!-- Active Device Seats List -->
          <div v-if="lic.activations && lic.activations.length > 0" class="space-y-1">
            <div
              v-for="act in lic.activations"
              :key="act.id"
              class="inline-flex items-center justify-between gap-2 px-2 py-0.5 rounded-md bg-slate-50 hover:bg-slate-100/80 border border-slate-200/80 text-[10px] text-jetblack shadow-2xs transition group"
            >
              <div class="flex items-center gap-1.5 min-w-0">
                <span class="w-1.5 h-1.5 rounded-full bg-forest shrink-0 animate-pulse" />
                <Laptop class="w-3 h-3 text-jetblack/40 shrink-0" />
                <span
                  class="font-semibold text-jetblack truncate max-w-[140px]"
                  :title="act.deviceName || 'Perangkat'"
                >
                  {{ act.deviceName || "Perangkat" }}
                </span>
                <code class="text-[9px] text-jetblack/45 font-mono shrink-0">
                  ({{ act.hwidHash.substring(0, 6) }}…)
                </code>
              </div>
              <button
                type="button"
                @click="emit('deactivateSeat', lic.licenseKey, act.hwidHash)"
                title="Lepas Seat Perangkat Ini"
                class="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-red-50 hover:bg-red-100 text-[9.5px] font-bold text-red-600 transition cursor-pointer border border-red-200/60 active:scale-95 shrink-0"
              >
                <X class="w-2.5 h-2.5" />
                <span>Lepas</span>
              </button>
            </div>
          </div>

          <!-- Fallback Primary HWID -->
          <div
            v-else-if="lic.hardwareId"
            class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-50 border border-slate-200/80 text-[9.5px] font-mono text-jetblack/60 shadow-2xs"
          >
            <span class="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0" />
            <span>Primary: {{ lic.hardwareId.substring(0, 8) }}…</span>
          </div>

          <!-- Empty State -->
          <div v-else class="text-[10px] text-jetblack/35 font-mono italic">
            Belum ada perangkat
          </div>
        </td>
        <td class="py-2.5 px-3">
          <StatusBadge :status="lic.status" />
        </td>
        <td class="py-2.5 pl-3 pr-3.5 sm:pr-4 md:pr-6 text-right space-x-1.5">
          <button
            @click="emit('detail', lic)"
            title="Detail Seats & Audit Trail"
            class="px-2 py-0.5 rounded bg-gold/10 hover:bg-gold/20 text-[10px] font-bold text-[#7a641a] transition cursor-pointer inline-flex items-center gap-1"
          >
            <Activity class="w-2.5 h-2.5" />
            Detail
          </button>
          <button
            v-if="lic.hardwareId || (lic.seatsUsed && lic.seatsUsed > 0)"
            @click="emit('unbindHardware', lic)"
            title="Reset Seluruh Device Seats"
            class="px-2 py-0.5 rounded bg-jetblack/5 hover:bg-jetblack/10 text-[10px] font-bold text-jetblack transition cursor-pointer"
          >
            Reset Seats
          </button>
          <button
            v-if="lic.status === 'ACTIVE'"
            @click="emit('revoke', lic)"
            title="Cabut Lisensi"
            class="px-2 py-0.5 rounded bg-crimson/10 hover:bg-crimson/20 text-[10px] font-bold text-crimson transition cursor-pointer"
          >
            Revoke
          </button>
        </td>
      </tr>
    </TableContainer>
  </div>
</template>
