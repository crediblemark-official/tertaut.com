<script setup lang="ts">
import { ref, computed, onMounted, Teleport } from "vue";
import {
  ChevronDown,
  KeyRound,
  Laptop,
  Clock,
  Radio,
  Plus,
  Settings,
  ShieldCheck,
  ShoppingCart,
  UserCheck,
  RefreshCw,
  Sparkles,
  History,
} from "lucide-vue-next";
import type { LicenseConfigItem, LicenseItem } from "../../types/licensing";
import type { AppItem } from "../../types/app";
import TableContainer from "../common/TableContainer.vue";
import TableSkeleton from "../common/TableSkeleton.vue";
import StatusBadge from "../common/StatusBadge.vue";
import SearchPicker from "../common/SearchPicker.vue";
import CopyButton from "../common/CopyButton.vue";
import SearchInput from "../common/SearchInput.vue";
import EmptyState from "../common/EmptyState.vue";
import StatsBar from "../common/StatsBar.vue";
import StatItem from "../common/StatItem.vue";
import { formatRupiah, formatDate } from "../../lib/utils";

const props = defineProps<{
  configs: LicenseConfigItem[];
  loading?: boolean;
  appsList: AppItem[];
  selectedAppId?: string;
  licenses?: LicenseItem[];
}>();

const emit = defineEmits<{
  (e: "refresh"): void;
  (e: "create-config"): void;
  (e: "edit-config", config: LicenseConfigItem): void;
  (e: "issue-manual", config: LicenseConfigItem): void;
  (e: "change-expiry", license: LicenseItem): void;
  (e: "revoke", license: LicenseItem): void;
  (e: "reactivate", license: LicenseItem): void;
  (e: "unbind-hardware", license: LicenseItem): void;
  (e: "detail", license: LicenseItem): void;
  (e: "select-app", appId: string): void;
}>();

const isMounted = ref(false);
onMounted(() => {
  isMounted.value = true;
});

// Accordion expanded rows state (Set of appIds)
const expandedAppIds = ref<Set<string>>(new Set());

function toggleExpand(appId: string) {
  if (expandedAppIds.value.has(appId)) {
    expandedAppIds.value.delete(appId);
  } else {
    expandedAppIds.value.add(appId);
  }
}

function isExpanded(appId: string): boolean {
  return expandedAppIds.value.has(appId);
}

// Search and filtering state
const searchQuery = ref("");
const statusFilter = ref<"ALL" | "ENABLED" | "DISABLED">("ALL");

// Filter per config's nested license list: 'ALL' | 'CHECKOUT' | 'MANUAL'
const licenseTypeFilter = ref<Record<string, "ALL" | "CHECKOUT" | "MANUAL">>({});

function setLicenseFilter(appId: string, filter: "ALL" | "CHECKOUT" | "MANUAL") {
  licenseTypeFilter.value[appId] = filter;
}

function getLicenseFilter(appId: string): "ALL" | "CHECKOUT" | "MANUAL" {
  return licenseTypeFilter.value[appId] || "ALL";
}

const filteredConfigs = computed(() => {
  let list = props.configs || [];

  // Filter by selected project from SearchPicker
  if (props.selectedAppId && props.selectedAppId !== "ALL") {
    list = list.filter((c) => c.appId === props.selectedAppId);
  }

  // Filter by engine status
  if (statusFilter.value === "ENABLED") {
    list = list.filter((c) => c.enabled);
  } else if (statusFilter.value === "DISABLED") {
    list = list.filter((c) => !c.enabled);
  }

  // Filter by search query
  const q = searchQuery.value.trim().toLowerCase();
  if (q) {
    list = list.filter((c) => {
      const matchConfigName = c.name?.toLowerCase().includes(q);
      const matchAppName = c.appName?.toLowerCase().includes(q);
      const matchLicenses = (c.licenses || []).some(
        (lic) =>
          lic.licenseKey.toLowerCase().includes(q) || lic.customerEmail.toLowerCase().includes(q)
      );
      return matchConfigName || matchAppName || matchLicenses;
    });
  }

  return list;
});

function getFilteredLicenses(config: LicenseConfigItem): LicenseItem[] {
  let lics = config.licenses || [];
  const typeFilter = getLicenseFilter(config.appId);

  if (typeFilter === "CHECKOUT") {
    lics = lics.filter((l) => Boolean(l.transactionId));
  } else if (typeFilter === "MANUAL") {
    lics = lics.filter((l) => !l.transactionId);
  }

  const q = searchQuery.value.trim().toLowerCase();
  if (q) {
    lics = lics.filter(
      (l) => l.licenseKey.toLowerCase().includes(q) || l.customerEmail.toLowerCase().includes(q)
    );
  }

  return lics;
}

const allLicenses = computed(() => {
  if (props.licenses && props.licenses.length > 0) {
    if (props.selectedAppId && props.selectedAppId !== "ALL") {
      return props.licenses.filter((l) => l.appId === props.selectedAppId);
    }
    return props.licenses;
  }
  const cfgs =
    props.selectedAppId && props.selectedAppId !== "ALL"
      ? props.configs.filter((c) => c.appId === props.selectedAppId)
      : props.configs;
  return cfgs.flatMap((c) => c.licenses || []);
});

const totalLicensesCount = computed(() => allLicenses.value.length);
const activeLicensesCount = computed(
  () => allLicenses.value.filter((l) => l.status === "ACTIVE").length
);
const revokedLicensesCount = computed(
  () => allLicenses.value.filter((l) => l.status === "REVOKED").length
);
const expiredLicensesCount = computed(
  () => allLicenses.value.filter((l) => l.status === "EXPIRED").length
);
</script>

<template>
  <div>
    <!-- Macro Summary Counter -->
    <StatsBar borderless>
      <StatItem
        label="Total Lisensi"
        :value="totalLicensesCount"
        sublabel="Diterbitkan di platform"
        :loading="loading"
      />
      <StatItem
        label="Lisensi Aktif"
        :value="activeLicensesCount"
        sublabel="Hak akses valid"
        variant="forest"
        bordered
        :loading="loading"
      />
      <StatItem
        label="Dicabut (Revoked)"
        :value="revokedLicensesCount"
        sublabel="Akses dinonaktifkan"
        variant="crimson"
        bordered
        :loading="loading"
      />
      <StatItem
        label="Kedaluwarsa"
        :value="expiredLicensesCount"
        sublabel="Masa aktif berakhir"
        variant="gold"
        bordered
        :loading="loading"
      />
    </StatsBar>

    <!-- Global Search Input Teleported to Top Header (#dashboard-header-search) -->
    <Teleport v-if="isMounted" to="#dashboard-header-search">
      <SearchInput
        v-model="searchQuery"
        placeholder="Cari pengaturan, kunci, email..."
        wrapper-class="w-full max-w-md"
        input-class="h-8 rounded-lg bg-jetblack/5 hover:bg-jetblack/8 border-jetblack/10 hover:border-jetblack/20 focus:bg-white"
      />
    </Teleport>

    <!-- Mobile Search Input Teleported to Mobile Header (#mobile-header-search) -->
    <Teleport v-if="isMounted" to="#mobile-header-search">
      <SearchInput
        v-model="searchQuery"
        placeholder="Cari pengaturan, kunci, email..."
        wrapper-class="w-full"
        input-class="h-8 rounded-lg bg-jetblack/5 border-jetblack/10 focus:bg-white"
      />
    </Teleport>

    <!-- Unified Table Toolbar (Standard Tertaut Dark Bar with SearchPicker & Controls) -->
    <div
      class="-mx-3.5 sm:-mx-4 md:-mx-6 px-3.5 sm:px-4 md:px-6 min-h-[44px] py-1.5 sm:py-0 bg-jetblack text-white border-b border-jetblack flex items-center justify-between gap-3 overflow-x-auto no-scrollbar shadow-xs mb-0 !mt-0"
    >
      <!-- Title & Count Badge -->
      <div class="flex items-center gap-2 shrink-0">
        <KeyRound class="w-3.5 h-3.5 text-gold" />
        <h2 class="text-xs font-bold uppercase tracking-wider text-white">
          Daftar Pengaturan Lisensi
        </h2>
        <span
          class="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white font-mono font-bold"
        >
          {{ filteredConfigs.length }} skema
        </span>
      </div>

      <!-- Controls: Project SearchPicker, Status Switch, Refresh, Create Action -->
      <div class="flex items-center gap-2 shrink-0">
        <!-- SearchPicker Dropdown for Projects -->
        <SearchPicker
          :model-value="selectedAppId || ''"
          @update:model-value="emit('select-app', $event)"
          :items="appsList"
          :dark="true"
          all-option-label="Semua Project"
          placeholder="Semua Project"
          search-placeholder="Cari project software..."
          button-class="!h-7 !rounded-md !min-w-[150px] !text-xs"
        />

        <!-- Status Filter Pills -->
        <div
          class="flex items-center h-7 rounded-md bg-white/10 p-0.5 text-[10px] font-medium shrink-0"
        >
          <button
            type="button"
            @click="statusFilter = 'ALL'"
            class="px-2 h-full rounded transition cursor-pointer flex items-center"
            :class="
              statusFilter === 'ALL'
                ? 'bg-white font-bold text-jetblack'
                : 'text-white/70 hover:text-white'
            "
          >
            Semua
          </button>
          <button
            type="button"
            @click="statusFilter = 'ENABLED'"
            class="px-2 h-full rounded transition cursor-pointer flex items-center"
            :class="
              statusFilter === 'ENABLED'
                ? 'bg-white font-bold text-forest'
                : 'text-white/70 hover:text-white'
            "
          >
            Aktif
          </button>
          <button
            type="button"
            @click="statusFilter = 'DISABLED'"
            class="px-2 h-full rounded transition cursor-pointer flex items-center"
            :class="
              statusFilter === 'DISABLED'
                ? 'bg-white font-bold text-crimson'
                : 'text-white/70 hover:text-white'
            "
          >
            Nonaktif
          </button>
        </div>

        <!-- Refresh Button -->
        <button
          type="button"
          @click="emit('refresh')"
          class="p-1.5 rounded-md bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition shrink-0 cursor-pointer"
          title="Segarkan data"
        >
          <RefreshCw class="w-3.5 h-3.5" :class="{ 'animate-spin': loading }" />
        </button>

        <!-- Action Button (btn-gold) -->
        <button
          type="button"
          @click="emit('create-config')"
          class="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg btn-gold text-xs font-bold transition shadow-2xs cursor-pointer active:scale-95 shrink-0"
        >
          <Plus class="w-3.5 h-3.5 stroke-[3]" />
          <span>Buat Pengaturan Baru</span>
        </button>
      </div>
    </div>

    <!-- Standard Edge-to-Edge TableContainer -->
    <TableContainer class="!mt-0">
      <template #head>
        <tr>
          <th class="py-2.5 pr-3 pl-3.5 sm:pl-4 md:pl-6 w-8"></th>
          <th class="py-2.5 px-3">Nama Pengaturan &amp; Project</th>
          <th class="py-2.5 px-3">Batas Seats</th>
          <th class="py-2.5 px-3">Masa Berlaku</th>
          <th class="py-2.5 px-3">Offline Grace</th>
          <th class="py-2.5 px-3">Mode Engine</th>
          <th class="py-2.5 px-3">Lisensi Terbit</th>
          <th class="py-2.5 px-3">Status</th>
          <th class="py-2.5 pl-3 pr-3.5 sm:pr-4 md:pr-6 text-right">Aksi</th>
        </tr>
      </template>

      <!-- Skeleton Loading State -->
      <TableSkeleton v-if="loading" :columns="9" :rows="4" />

      <!-- Empty State -->
      <tr v-else-if="filteredConfigs.length === 0">
        <td colspan="9" class="py-8 px-3.5 sm:px-4 md:px-6">
          <EmptyState
            :icon="Settings"
            title="Belum Ada Pengaturan Lisensi"
            description="Buat pengaturan lisensi pertama Anda untuk mengatur seat, durasi, dan proteksi perangkat."
            action-text="Buat Pengaturan Sekarang"
            :action-icon="Plus"
            container-class="border-0 bg-transparent py-4"
            @action="emit('create-config')"
          />
        </td>
      </tr>

      <!-- Master Rows & Nested Accordion Content -->
      <template v-else v-for="config in filteredConfigs" :key="config.appId">
        <!-- Master Configuration Row -->
        <tr
          class="hover:bg-jetblack/[0.02] transition cursor-pointer select-none group"
          :class="isExpanded(config.appId) ? 'bg-gold/[0.04]' : ''"
          @click="toggleExpand(config.appId)"
        >
          <!-- Expand Chevron Icon -->
          <td class="py-2.5 pr-2 pl-3.5 sm:pl-4 md:pl-6 text-center w-8">
            <button
              type="button"
              class="w-6 h-6 rounded-md flex items-center justify-center text-jetblack/50 group-hover:text-jetblack transition"
            >
              <ChevronDown
                class="w-4 h-4 transition-transform duration-200"
                :class="isExpanded(config.appId) ? 'rotate-180 text-gold' : ''"
              />
            </button>
          </td>

          <!-- Name & Project -->
          <td class="py-2.5 px-3 font-medium text-jetblack">
            <div class="flex items-center gap-2">
              <span class="font-bold text-xs text-jetblack">{{ config.name }}</span>
              <span
                class="px-1.5 py-0.2 rounded-full text-[9px] font-bold uppercase tracking-wider"
                :class="
                  config.mode === 'live' ? 'bg-forest/15 text-forest' : 'bg-gold/20 text-jetblack'
                "
              >
                {{ config.mode }}
              </span>
            </div>
            <div class="text-[10.5px] text-jetblack/50 flex items-center gap-1 mt-0.5">
              <span>Project:</span>
              <span class="font-semibold text-jetblack/70">{{ config.appName }}</span>
              <span class="font-mono text-jetblack/40">({{ config.appId }})</span>
            </div>
          </td>

          <!-- Seats Limit -->
          <td class="py-2.5 px-3 font-medium text-jetblack">
            <div class="inline-flex items-center gap-1.5 text-xs">
              <Laptop class="w-3.5 h-3.5 text-gold shrink-0" />
              <span class="font-bold">{{ config.maxSeats }}</span>
              <span class="text-jetblack/70">Seats</span>
            </div>
          </td>

          <!-- Expiry Duration -->
          <td class="py-2.5 px-3 text-jetblack/80 font-medium">
            <div class="inline-flex items-center gap-1.5 text-xs">
              <Clock class="w-3.5 h-3.5 text-gold shrink-0" />
              <span :class="!config.expiresInDays ? 'text-forest font-bold' : ''">
                {{ config.expiresInDays ? `${config.expiresInDays} Hari` : "Lifetime (Selamanya)" }}
              </span>
            </div>
          </td>

          <!-- Offline Grace -->
          <td class="py-2.5 px-3 text-jetblack/70 text-xs font-medium">
            <span v-if="config.offlineGraceDays">{{ config.offlineGraceDays }} Hari</span>
            <span v-else class="text-jetblack/30">-</span>
          </td>

          <!-- Engine Mode -->
          <td class="py-2.5 px-3">
            <span
              v-if="config.floating?.enabled"
              class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gold/15 text-jetblack font-bold text-[10px]"
            >
              <Radio class="w-3 h-3 text-gold animate-pulse shrink-0" />
              <span>Floating Lease</span>
            </span>
            <span
              v-else
              class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-jetblack/5 text-jetblack/70 font-semibold text-[10px]"
            >
              <span>Standar Ed25519</span>
            </span>
          </td>

          <!-- Issued Licenses Counter -->
          <td class="py-2.5 px-3 text-jetblack">
            <div class="flex items-center gap-1.5 text-xs">
              <KeyRound class="w-3.5 h-3.5 text-gold shrink-0" />
              <span class="font-bold">{{ config.totalLicenses }}</span>
              <span class="font-semibold text-jetblack/80">Lisensi</span>
            </div>
            <div class="text-[10px] text-jetblack/50 mt-0.5">
              {{ config.checkoutLicenses }} Checkout • {{ config.manualLicenses }} Manual
            </div>
          </td>

          <!-- Engine Status -->
          <td class="py-2.5 px-3">
            <StatusBadge :status="config.enabled ? 'ACTIVE' : 'INACTIVE'" />
          </td>

          <!-- Action Buttons on Row -->
          <td class="py-2.5 pl-3 pr-3.5 sm:pr-4 md:pr-6 text-right" @click.stop>
            <div class="inline-flex items-center justify-end gap-1.5">
              <button
                type="button"
                @click="emit('edit-config', config)"
                class="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-slate-300 hover:border-slate-400 bg-white hover:bg-slate-50 text-jetblack/80 hover:text-jetblack font-bold text-xs transition cursor-pointer shadow-2xs"
                title="Ubah konfigurasi pengaturan ini"
              >
                <Settings class="w-3.5 h-3.5 text-jetblack/60" />
                <span>Edit</span>
              </button>
            </div>
          </td>
        </tr>

        <!-- ======================================================== -->
        <!-- EXPANDED ACCORDION: DAFTAR LISENSI PELANGGAN (NESTED ROW) -->
        <!-- ======================================================== -->
        <tr v-if="isExpanded(config.appId)" class="bg-[#FAFAFA]">
          <td colspan="9" class="p-0 border-b border-jetblack/15">
            <div class="px-4 py-3 sm:px-6 sm:py-4 bg-slate-50/80 border-y border-jetblack/10">
              <!-- Sub-header & Quick Type Filter -->
              <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                <div class="flex items-center gap-2">
                  <div class="w-2 h-2 rounded-full bg-gold"></div>
                  <h4 class="text-xs font-bold uppercase tracking-wider text-jetblack">
                    Daftar Lisensi Terbit: {{ config.name }}
                  </h4>
                  <span
                    class="text-[10px] px-2 py-0.5 rounded-full bg-white border border-slate-200 font-mono font-bold text-jetblack"
                  >
                    {{ getFilteredLicenses(config).length }} dari {{ config.totalLicenses }}
                  </span>
                </div>

                <div class="flex flex-wrap items-center gap-2">
                  <!-- Sub-filter Pills -->
                  <div
                    class="flex items-center gap-1 p-0.5 bg-white rounded-md border border-slate-200 shadow-2xs"
                  >
                    <button
                      type="button"
                      @click="setLicenseFilter(config.appId, 'ALL')"
                      class="px-2 py-0.5 rounded text-[10.5px] font-bold transition cursor-pointer"
                      :class="
                        getLicenseFilter(config.appId) === 'ALL'
                          ? 'bg-jetblack text-white'
                          : 'text-jetblack/60 hover:text-jetblack'
                      "
                    >
                      Semua ({{ config.totalLicenses }})
                    </button>

                    <button
                      type="button"
                      @click="setLicenseFilter(config.appId, 'CHECKOUT')"
                      class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10.5px] font-bold transition cursor-pointer"
                      :class="
                        getLicenseFilter(config.appId) === 'CHECKOUT'
                          ? 'bg-forest text-white'
                          : 'text-jetblack/60 hover:text-jetblack'
                      "
                    >
                      <ShoppingCart class="w-3 h-3" />
                      <span>Pembayaran Tertaut ({{ config.checkoutLicenses }})</span>
                    </button>

                    <button
                      type="button"
                      @click="setLicenseFilter(config.appId, 'MANUAL')"
                      class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10.5px] font-bold transition cursor-pointer"
                      :class="
                        getLicenseFilter(config.appId) === 'MANUAL'
                          ? 'bg-jetblack/80 text-white'
                          : 'text-jetblack/60 hover:text-jetblack'
                      "
                    >
                      <UserCheck class="w-3 h-3" />
                      <span>Manual ({{ config.manualLicenses }})</span>
                    </button>
                  </div>

                  <!-- Button Terbitkan Kunci in Expanded Section -->
                  <button
                    type="button"
                    @click="emit('issue-manual', config)"
                    class="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-jetblack text-white hover:bg-jetblack/90 font-bold text-[11px] transition shadow-2xs cursor-pointer shrink-0"
                    title="Terbitkan kunci manual untuk skema ini"
                  >
                    <Plus class="w-3 h-3 text-gold" />
                    <span>Terbitkan Kunci</span>
                  </button>
                </div>
              </div>

              <!-- Empty Nested State -->
              <EmptyState
                v-if="getFilteredLicenses(config).length === 0"
                :icon="KeyRound"
                title="Belum Ada Lisensi Pelanggan Terbit"
                description="Lisensi otomatis terbit saat pembeli melakukan pembayaran di checkout Tertaut, atau Anda dapat menerbitkan kunci manual."
                action-text="Terbitkan Manual"
                :action-icon="Plus"
                container-class="my-2 bg-white"
                @action="emit('issue-manual', config)"
              />

              <!-- Nested Sub-Table of Licenses -->
              <TableContainer
                v-else
                :negative-margin="false"
                wrapper-class="rounded-lg border border-slate-200 bg-white shadow-2xs"
                table-class="border-b-0 text-xs whitespace-nowrap"
                thead-class="bg-slate-100/80 border-b border-slate-200 text-[10.5px] text-jetblack/70 uppercase tracking-wider font-bold"
                tbody-class="divide-y divide-slate-100"
              >
                <template #head>
                  <tr>
                    <th class="py-2.5 px-3">Sumber Terbit</th>
                    <th class="py-2.5 px-3">Email Pembeli</th>
                    <th class="py-2.5 px-3">Kunci Serial Lisensi</th>
                    <th class="py-2.5 px-3">Perangkat Aktif</th>
                    <th class="py-2.5 px-3">Masa Berlaku</th>
                    <th class="py-2.5 px-3">Status</th>
                    <th class="py-2.5 px-3 text-right">Aksi</th>
                  </tr>
                </template>
                <tr
                  v-for="lic in getFilteredLicenses(config)"
                  :key="lic.id"
                  class="hover:bg-slate-50 transition"
                >
                  <!-- Sumber Terbit -->
                  <td class="py-2.5 px-3">
                    <div
                      v-if="lic.transactionId"
                      class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-forest/10 border border-forest/30 text-forest text-[10px] font-bold"
                    >
                      <ShoppingCart class="w-3 h-3 shrink-0" />
                      <span>Pembayaran Tertaut</span>
                    </div>
                    <div
                      v-else
                      class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-jetblack/5 border border-jetblack/15 text-jetblack/70 text-[10px] font-bold"
                    >
                      <UserCheck class="w-3 h-3 shrink-0" />
                      <span>Manual (Admin)</span>
                    </div>
                    <div v-if="lic.ltv" class="text-[10px] text-forest font-mono mt-0.5 font-bold">
                      {{ formatRupiah(lic.ltv) }}
                    </div>
                  </td>

                  <!-- Email Pembeli -->
                  <td class="py-2.5 px-3 font-medium text-jetblack">
                    <div>{{ lic.customerEmail }}</div>
                    <div v-if="lic.transactionId" class="text-[9.5px] text-jetblack/40 font-mono">
                      Ref: {{ lic.transactionId }}
                    </div>
                  </td>

                  <!-- Kunci Serial Lisensi -->
                  <td class="py-2.5 px-3 font-mono font-bold text-jetblack">
                    <div
                      class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-100 border border-slate-200"
                    >
                      <span>{{ lic.licenseKey }}</span>
                      <CopyButton :text="lic.licenseKey" title="Salin kunci lisensi" />
                    </div>
                  </td>

                  <!-- Perangkat / Seats Digunakan -->
                  <td class="py-2.5 px-3">
                    <div class="inline-flex items-center gap-1 font-bold text-jetblack">
                      <Laptop class="w-3.5 h-3.5 text-gold shrink-0" />
                      <span class="font-mono">{{ lic.seatsUsed || 0 }} / {{ lic.maxSeats }}</span>
                      <span class="text-[10px] font-normal text-jetblack/60 font-sans"
                        >Perangkat</span
                      >
                    </div>
                    <div
                      v-if="lic.hardwareId"
                      class="text-[9.5px] text-jetblack/40 font-mono truncate max-w-[110px]"
                      :title="lic.hardwareId"
                    >
                      HWID: {{ lic.hardwareId }}
                    </div>
                  </td>

                  <!-- Masa Berlaku -->
                  <td class="py-2.5 px-3 font-medium text-jetblack/80">
                    <span :class="!lic.expiresAt ? 'text-forest font-bold' : ''">
                      {{ formatDate(lic.expiresAt, { fallback: "Selamanya (Lifetime)" }) }}
                    </span>
                  </td>

                  <!-- Status -->
                  <td class="py-2.5 px-3">
                    <StatusBadge :status="lic.status" />
                  </td>

                  <!-- Aksi -->
                  <td class="py-2.5 px-3 text-right">
                    <div class="inline-flex items-center justify-end gap-1">
                      <button
                        type="button"
                        @click="emit('detail', lic)"
                        class="p-1 rounded border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 text-jetblack/70 hover:text-jetblack transition cursor-pointer shadow-2xs"
                        title="Audit Log & Riwayat Validasi"
                      >
                        <History class="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        @click="emit('change-expiry', lic)"
                        class="px-2 py-0.5 rounded border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 text-jetblack font-bold text-[10.5px] transition cursor-pointer shadow-2xs"
                        title="Perpanjang masa aktif lisensi"
                      >
                        Perpanjang
                      </button>

                      <button
                        v-if="lic.status === 'ACTIVE'"
                        type="button"
                        @click="emit('revoke', lic)"
                        class="px-2 py-0.5 rounded border border-crimson/20 bg-crimson/5 hover:bg-crimson hover:text-white text-crimson font-bold text-[10.5px] transition cursor-pointer"
                        title="Cabut lisensi"
                      >
                        Revoke
                      </button>

                      <button
                        v-else
                        type="button"
                        @click="emit('reactivate', lic)"
                        class="px-2 py-0.5 rounded border border-forest/20 bg-forest/5 hover:bg-forest hover:text-white text-forest font-bold text-[10.5px] transition cursor-pointer"
                        title="Aktifkan kembali lisensi"
                      >
                        Aktifkan
                      </button>
                    </div>
                  </td>
                </tr>
              </TableContainer>
            </div>
          </td>
        </tr>
      </template>
    </TableContainer>
  </div>
</template>
