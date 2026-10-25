<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { Download, AppWindow, ExternalLink, Tag, Key } from "lucide-vue-next";
import type { PanelAppItem } from "../../types/panel";
import TableContainer from "../common/TableContainer.vue";
import TableSkeleton from "../common/TableSkeleton.vue";
import SearchInput from "../common/SearchInput.vue";
import StatusBadge from "../common/StatusBadge.vue";
import EmptyState from "../common/EmptyState.vue";
import StatsBar from "../common/StatsBar.vue";
import StatItem from "../common/StatItem.vue";

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
const isMounted = ref(false);

onMounted(() => {
  isMounted.value = true;
});

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
    <StatsBar borderless>
      <StatItem
        label="Total Software"
        :value="apps.length"
        sublabel="Terdaftar di platform"
        :loading="loading"
      />
      <StatItem
        label="Mode Live"
        :value="liveCount"
        sublabel="Produksi aktif"
        variant="forest"
        bordered
        :loading="loading"
      />
      <StatItem
        label="Mode Sandbox"
        :value="sandboxCount"
        sublabel="Tahap pengujian"
        variant="gold"
        bordered
        :loading="loading"
      />
      <StatItem
        label="Dibekukan"
        :value="suspendedCount"
        sublabel="Akses dinonaktifkan"
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
        placeholder="Cari software, slug, nama builder..."
        wrapper-class="w-full max-w-md"
        input-class="h-8 text-xs"
      />
    </Teleport>

    <!-- Mobile Search Input Teleported to Admin Mobile Header (#admin-mobile-header-search) -->
    <Teleport v-if="isMounted" to="#admin-mobile-header-search">
      <SearchInput
        v-model="searchQuery"
        dark
        placeholder="Cari software, slug, nama builder..."
        wrapper-class="w-full"
        input-class="h-8 text-xs"
      />
    </Teleport>

    <!-- Unified Table Toolbar (Standard Tertaut Dark Bar) -->
    <div
      class="-mx-3.5 sm:-mx-4 md:-mx-6 px-3.5 sm:px-4 md:px-6 min-h-[44px] py-1.5 sm:py-0 bg-jetblack text-white border-b border-jetblack flex items-center justify-between gap-3 overflow-x-auto no-scrollbar shadow-xs mb-0 !mt-0"
    >
      <div class="flex items-center gap-2 shrink-0">
        <AppWindow class="w-3.5 h-3.5 text-gold" />
        <span class="text-xs font-bold text-white uppercase tracking-wider">
          Direktori Software
        </span>
        <span
          class="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white font-mono font-bold"
        >
          {{ filteredApps.length }} software
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
            @click="statusFilter = 'active'"
            class="px-2 h-full rounded transition cursor-pointer flex items-center"
            :class="
              statusFilter === 'active'
                ? 'bg-white font-bold text-forest'
                : 'text-white/70 hover:text-white'
            "
          >
            Aktif
          </button>
          <button
            type="button"
            @click="statusFilter = 'suspended'"
            class="px-2 h-full rounded transition cursor-pointer flex items-center"
            :class="
              statusFilter === 'suspended'
                ? 'bg-white font-bold text-crimson'
                : 'text-white/70 hover:text-white'
            "
          >
            Dibekukan
          </button>
        </div>

        <!-- Ekspor CSV Button -->
        <button
          @click="handleExportCsv"
          type="button"
          class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-bold text-white transition cursor-pointer shrink-0"
          title="Unduh seluruh direktori software ke format CSV"
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
          <th class="py-2.5 pr-3 pl-3.5 sm:pl-4 md:pl-6">Software</th>
          <th class="py-2.5 px-3">Status</th>
          <th class="py-2.5 px-3">Builder</th>
          <th class="py-2.5 px-3">Mode</th>
          <th class="py-2.5 px-3">Harga &amp; Tipe</th>
          <th class="py-2.5 px-3">Lisensi</th>
          <th class="py-2.5 px-3">Total GMV</th>
          <th class="py-2.5 px-3">Delivery</th>
          <th class="py-2.5 px-3">Dibuat</th>
          <th class="py-2.5 pl-3 pr-3.5 sm:pr-4 md:pr-6 text-right">Moderasi</th>
        </tr>
      </template>

      <TableSkeleton v-if="loading" :columns="10" :rows="5" />
      <tr v-else-if="filteredApps.length === 0">
        <td colspan="10" class="py-8 px-3.5 sm:px-4 md:px-6">
          <EmptyState
            :icon="AppWindow"
            title="Tidak ada software ditemukan"
            description="Coba sesuaikan kata kunci pencarian atau filter status Anda."
            container-class="border-0 bg-transparent py-4"
          />
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
          <StatusBadge :status="app.isSuspended ? 'DIBEKUKAN' : 'AKTIF'" />
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
        <td class="py-2.5 px-3 text-jetblack/50 text-[11px] font-mono">
          {{ new Date(app.createdAt).toLocaleDateString("id-ID") }}
        </td>
        <td class="py-2.5 pl-3 pr-3.5 sm:pr-4 md:pr-6 text-right">
          <div class="inline-flex items-center justify-end gap-1.5">
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
                  ? 'border-forest/40 bg-forest/10 text-forest hover:bg-forest/20'
                  : 'border-crimson/30 bg-white text-crimson hover:bg-crimson/10',
              ]"
            >
              {{ app.isSuspended ? "Aktifkan" : "Bekukan" }}
            </button>
          </div>
        </td>
      </tr>
    </TableContainer>
  </section>
</template>
