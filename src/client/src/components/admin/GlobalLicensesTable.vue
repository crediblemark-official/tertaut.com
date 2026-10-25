<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { Download, Key, RotateCcw } from "lucide-vue-next";
import type { PanelLicenseItem } from "../../types/panel";
import TableContainer from "../common/TableContainer.vue";
import TableSkeleton from "../common/TableSkeleton.vue";
import SearchInput from "../common/SearchInput.vue";
import CopyButton from "../common/CopyButton.vue";
import StatusBadge from "../common/StatusBadge.vue";
import EmptyState from "../common/EmptyState.vue";
import StatsBar from "../common/StatsBar.vue";
import StatItem from "../common/StatItem.vue";

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
const modeFilter = ref("");
const isMounted = ref(false);

onMounted(() => {
  isMounted.value = true;
});

function handleExportCsv() {
  const params = new URLSearchParams();
  if (statusFilter.value) params.append("status", statusFilter.value);
  if (modeFilter.value) params.append("mode", modeFilter.value);
  const q = params.toString() ? `?${params.toString()}` : "";
  window.open(`/api/v1/panel/export/licenses${q}`, "_blank");
}

const filteredLicenses = computed(() => {
  return props.licenses.filter((lic) => {
    if (statusFilter.value && lic.status !== statusFilter.value) {
      return false;
    }
    if (modeFilter.value && (lic.mode || "live") !== modeFilter.value) {
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
    <StatsBar borderless>
      <StatItem
        label="Total Lisensi"
        :value="licenses.length"
        sublabel="Diterbitkan seluruh software"
        :loading="loading"
      />
      <StatItem
        label="Aktif (Valid)"
        :value="activeCount"
        sublabel="Hak akses aktif"
        variant="forest"
        bordered
        :loading="loading"
      />
      <StatItem
        label="Dicabut (Revoked)"
        :value="revokedCount"
        sublabel="Diblokir / dibatalkan"
        variant="crimson"
        bordered
        :loading="loading"
      />
      <StatItem
        label="Kedaluwarsa"
        :value="expiredCount"
        sublabel="Masa aktif berakhir"
        variant="gold"
        bordered
        :loading="loading"
      />
    </StatsBar>

    <!-- Global Search Input Teleported to Top Header (#admin-header-search) -->
    <Teleport v-if="isMounted" to="#admin-header-search">
      <SearchInput
        v-model="searchQuery"
        dark
        placeholder="Cari kunci lisensi, email pelanggan, software..."
        wrapper-class="w-full max-w-md"
        input-class="h-8 text-xs"
      />
    </Teleport>

    <!-- Mobile Search Input Teleported to Admin Mobile Header (#admin-mobile-header-search) -->
    <Teleport v-if="isMounted" to="#admin-mobile-header-search">
      <SearchInput
        v-model="searchQuery"
        dark
        placeholder="Cari kunci lisensi, email pelanggan, software..."
        wrapper-class="w-full"
        input-class="h-8 text-xs"
      />
    </Teleport>

    <!-- Unified Table Toolbar (Standard Tertaut Dark Bar) -->
    <div
      class="-mx-3.5 sm:-mx-4 md:-mx-6 px-3.5 sm:px-4 md:px-6 min-h-[44px] py-1.5 sm:py-0 bg-jetblack text-white border-b border-jetblack flex items-center justify-between gap-3 overflow-x-auto no-scrollbar shadow-xs mb-0 !mt-0"
    >
      <div class="flex items-center gap-2 shrink-0">
        <Key class="w-3.5 h-3.5 text-gold" />
        <span class="text-xs font-bold text-white uppercase tracking-wider">
          Daftar Lisensi Global
        </span>
        <span
          class="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white font-mono font-bold"
        >
          {{ filteredLicenses.length }} lisensi
        </span>
      </div>

      <div class="flex items-center gap-2 shrink-0">
        <!-- Mode Filter Pills -->
        <div
          class="flex items-center h-7 rounded-md bg-white/10 p-0.5 text-[10px] font-medium shrink-0"
        >
          <button
            type="button"
            @click="modeFilter = ''"
            class="px-2 h-full rounded transition cursor-pointer flex items-center"
            :class="
              modeFilter === ''
                ? 'bg-white font-bold text-jetblack'
                : 'text-white/70 hover:text-white'
            "
          >
            Semua Mode
          </button>
          <button
            type="button"
            @click="modeFilter = 'live'"
            class="px-2 h-full rounded transition cursor-pointer flex items-center"
            :class="
              modeFilter === 'live'
                ? 'bg-forest font-bold text-white'
                : 'text-white/70 hover:text-white'
            "
          >
            Live
          </button>
          <button
            type="button"
            @click="modeFilter = 'sandbox'"
            class="px-2 h-full rounded transition cursor-pointer flex items-center"
            :class="
              modeFilter === 'sandbox'
                ? 'bg-gold font-bold text-jetblack'
                : 'text-white/70 hover:text-white'
            "
          >
            Sandbox
          </button>
        </div>

        <!-- Status Filter Pills -->
        <div
          class="flex items-center h-7 rounded-md bg-white/10 p-0.5 text-[10px] font-medium shrink-0"
        >
          <button
            type="button"
            @click="statusFilter = ''"
            class="px-2 h-full rounded transition cursor-pointer flex items-center"
            :class="
              statusFilter === ''
                ? 'bg-white font-bold text-jetblack'
                : 'text-white/70 hover:text-white'
            "
          >
            Semua
          </button>
          <button
            type="button"
            @click="statusFilter = 'ACTIVE'"
            class="px-2 h-full rounded transition cursor-pointer flex items-center"
            :class="
              statusFilter === 'ACTIVE'
                ? 'bg-white font-bold text-forest'
                : 'text-white/70 hover:text-white'
            "
          >
            Active
          </button>
          <button
            type="button"
            @click="statusFilter = 'REVOKED'"
            class="px-2 h-full rounded transition cursor-pointer flex items-center"
            :class="
              statusFilter === 'REVOKED'
                ? 'bg-white font-bold text-crimson'
                : 'text-white/70 hover:text-white'
            "
          >
            Revoked
          </button>
          <button
            type="button"
            @click="statusFilter = 'EXPIRED'"
            class="px-2 h-full rounded transition cursor-pointer flex items-center"
            :class="
              statusFilter === 'EXPIRED'
                ? 'bg-white font-bold text-gold'
                : 'text-white/70 hover:text-white'
            "
          >
            Expired
          </button>
        </div>

        <!-- Ekspor CSV Button -->
        <button
          @click="handleExportCsv"
          type="button"
          class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-bold text-white transition cursor-pointer shrink-0"
          title="Unduh seluruh daftar lisensi ke format CSV"
        >
          <Download class="w-3.5 h-3.5" />
          <span>Ekspor CSV</span>
        </button>
      </div>
    </div>

    <!-- Table View -->
    <TableContainer>
      <template #head>
        <tr>
          <th class="py-2.5 pr-3 pl-3.5 sm:pl-4 md:pl-6">License Key</th>
          <th class="py-2.5 px-3">Status</th>
          <th class="py-2.5 px-3">Software</th>
          <th class="py-2.5 px-3">Pelanggan</th>
          <th class="py-2.5 px-3">Seat</th>
          <th class="py-2.5 px-3">Hardware ID</th>
          <th class="py-2.5 px-3">Kedaluwarsa</th>
          <th class="py-2.5 px-3">Diterbitkan</th>
          <th class="py-2.5 pl-3 pr-3.5 sm:pr-4 md:pr-6 text-right">Aksi</th>
        </tr>
      </template>

      <TableSkeleton v-if="loading" :columns="9" :rows="5" />
      <tr v-else-if="filteredLicenses.length === 0">
        <td colspan="9" class="py-8 px-3.5 sm:px-4 md:px-6">
          <EmptyState
            :icon="Key"
            title="Tidak ada lisensi ditemukan"
            description="Coba sesuaikan kata kunci pencarian atau filter status Anda."
            container-class="border-0 bg-transparent py-4"
          />
        </td>
      </tr>
      <tr
        v-else
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
            <span
              :class="[
                'px-1.5 py-0.2 rounded text-[9px] font-extrabold uppercase border',
                lic.mode === 'sandbox'
                  ? 'bg-amber-50 text-amber-800 border-amber-300'
                  : 'bg-emerald-50 text-emerald-800 border-emerald-300',
              ]"
            >
              {{ lic.mode || "live" }}
            </span>
            <CopyButton :text="lic.licenseKey" title="Salin License Key" />
          </div>
        </td>
        <td class="py-2.5 px-3">
          <StatusBadge :status="lic.status" />
        </td>
        <td class="py-2.5 px-3">
          <div class="font-semibold text-jetblack">{{ lic.appName }}</div>
          <div class="text-[10px] text-jetblack/50">oleh {{ lic.builderName }}</div>
        </td>
        <td class="py-2.5 px-3 text-xs text-jetblack/70">
          {{ lic.customerEmail }}
        </td>
        <td class="py-2.5 px-3">
          <span class="font-bold font-mono text-jetblack">{{ lic.usedSeats }}</span>
          <span class="text-jetblack/40 font-mono">/{{ lic.maxSeats }}</span>
        </td>
        <td class="py-2.5 px-3 text-[11px] text-jetblack/60">
          <span
            v-if="lic.hardwareId"
            class="truncate max-w-[120px] inline-block font-mono"
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
        <td class="py-2.5 px-3 text-jetblack/50 text-[11px] font-mono">
          {{ new Date(lic.createdAt).toLocaleDateString("id-ID") }}
        </td>
        <td class="py-2.5 pl-3 pr-3.5 sm:pr-4 md:pr-6 text-right">
          <div class="inline-flex items-center justify-end gap-1.5">
            <button
              v-if="lic.status === 'ACTIVE'"
              type="button"
              @click="emit('revoke', lic)"
              class="px-2.5 py-1 rounded text-[11px] font-bold border border-crimson/30 bg-white text-crimson hover:bg-crimson/10 transition cursor-pointer"
              title="Cabut lisensi ini"
            >
              Cabut (Revoke)
            </button>
            <button
              v-else-if="lic.status === 'REVOKED'"
              type="button"
              @click="emit('reactivate', lic)"
              class="px-2.5 py-1 rounded text-[11px] font-bold border border-forest/40 bg-forest/10 text-forest hover:bg-forest/20 transition cursor-pointer inline-flex items-center gap-1"
              title="Aktifkan kembali lisensi ini"
            >
              <RotateCcw class="w-3 h-3" />
              <span>Aktifkan</span>
            </button>
            <span v-else class="text-jetblack/40 text-[11px]">-</span>
          </div>
        </td>
      </tr>
    </TableContainer>
  </section>
</template>
