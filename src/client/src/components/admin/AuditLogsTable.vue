<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import {
  Shield,
  Activity,
  UserCheck,
  Server,
  Terminal,
  Laptop,
  ChevronDown,
  ChevronRight,
  RefreshCw,
} from "lucide-vue-next";
import type { PanelAuditLogItem } from "../../types/panel";
import TableContainer from "../common/TableContainer.vue";
import TableSkeleton from "../common/TableSkeleton.vue";
import SearchInput from "../common/SearchInput.vue";
import EmptyState from "../common/EmptyState.vue";
import StatsBar from "../common/StatsBar.vue";
import StatItem from "../common/StatItem.vue";

const props = defineProps<{
  logs: PanelAuditLogItem[];
  loading?: boolean;
}>();

const emit = defineEmits<{
  (e: "refresh"): void;
}>();

const searchQuery = ref("");
const actorFilter = ref("");
const expandedRowId = ref<string | null>(null);
const isMounted = ref(false);

onMounted(() => {
  isMounted.value = true;
});

function toggleRow(id: string) {
  expandedRowId.value = expandedRowId.value === id ? null : id;
}

const filteredLogs = computed(() => {
  return props.logs.filter((log) => {
    if (actorFilter.value && log.actorType !== actorFilter.value) {
      return false;
    }
    if (searchQuery.value.trim()) {
      const q = searchQuery.value.toLowerCase().trim();
      const matchEvent = log.event.toLowerCase().includes(q);
      const matchKey = (log.licenseKey || "").toLowerCase().includes(q);
      const matchLicId = (log.licenseId || "").toLowerCase().includes(q);
      const matchApp = (log.appId || "").toLowerCase().includes(q);
      const matchIp = (log.ipAddress || "").toLowerCase().includes(q);
      if (!matchEvent && !matchKey && !matchLicId && !matchApp && !matchIp) return false;
    }
    return true;
  });
});
</script>

<template>
  <section class="space-y-4">
    <!-- Macro Summary Counter -->
    <StatsBar borderless>
      <StatItem
        label="Total Log Terekam"
        :value="logs.length"
        sublabel="Aktivitas audit sistem"
        :loading="loading"
      />
      <StatItem
        label="Aksi Admin"
        :value="logs.filter((l) => l.actorType === 'ADMIN').length"
        sublabel="Operasi super administrator"
        variant="gold"
        bordered
        :loading="loading"
      />
      <StatItem
        label="Aksi Builder"
        :value="logs.filter((l) => l.actorType === 'BUILDER').length"
        sublabel="Aktivitas developer software"
        variant="forest"
        bordered
        :loading="loading"
      />
      <StatItem
        label="Client & S2S"
        :value="logs.filter((l) => ['S2S', 'CLIENT'].includes(l.actorType)).length"
        sublabel="Validasi & API otomatis"
        bordered
        :loading="loading"
      />
    </StatsBar>

    <!-- Global Search Input Teleported to Top Header (#admin-header-search) -->
    <Teleport v-if="isMounted" to="#admin-header-search">
      <SearchInput
        v-model="searchQuery"
        dark
        placeholder="Cari event, license key, IP address..."
        wrapper-class="w-full max-w-md"
        input-class="h-8 text-xs"
      />
    </Teleport>

    <!-- Mobile Search Input Teleported to Admin Mobile Header (#admin-mobile-header-search) -->
    <Teleport v-if="isMounted" to="#admin-mobile-header-search">
      <SearchInput
        v-model="searchQuery"
        dark
        placeholder="Cari event, license key, IP address..."
        wrapper-class="w-full"
        input-class="h-8 text-xs"
      />
    </Teleport>

    <!-- Unified Table Toolbar (Standard Tertaut Dark Bar) -->
    <div
      class="-mx-3.5 sm:-mx-4 md:-mx-6 px-3.5 sm:px-4 md:px-6 min-h-[44px] py-1.5 sm:py-0 bg-jetblack text-white border-b border-jetblack flex items-center justify-between gap-3 overflow-x-auto no-scrollbar shadow-xs mb-0 !mt-0"
    >
      <div class="flex items-center gap-2 shrink-0">
        <Shield class="w-3.5 h-3.5 text-gold" />
        <span class="text-xs font-bold text-white uppercase tracking-wider">
          Audit Trail & Security Logs
        </span>
        <span
          class="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white font-mono font-bold"
        >
          {{ filteredLogs.length }} events
        </span>
      </div>

      <div class="flex items-center gap-2 shrink-0">
        <!-- Actor Filter Pills -->
        <div
          class="flex items-center h-7 rounded-md bg-white/10 p-0.5 text-[10px] font-medium shrink-0"
        >
          <button
            type="button"
            @click="actorFilter = ''"
            class="px-2 h-full rounded transition cursor-pointer flex items-center"
            :class="
              actorFilter === ''
                ? 'bg-white font-bold text-jetblack'
                : 'text-white/70 hover:text-white'
            "
          >
            Semua Aktor
          </button>
          <button
            type="button"
            @click="actorFilter = 'ADMIN'"
            class="px-2 h-full rounded transition cursor-pointer flex items-center"
            :class="
              actorFilter === 'ADMIN'
                ? 'bg-gold font-bold text-jetblack'
                : 'text-white/70 hover:text-white'
            "
          >
            Admin
          </button>
          <button
            type="button"
            @click="actorFilter = 'BUILDER'"
            class="px-2 h-full rounded transition cursor-pointer flex items-center"
            :class="
              actorFilter === 'BUILDER'
                ? 'bg-forest font-bold text-white'
                : 'text-white/70 hover:text-white'
            "
          >
            Builder
          </button>
          <button
            type="button"
            @click="actorFilter = 'S2S'"
            class="px-2 h-full rounded transition cursor-pointer flex items-center"
            :class="
              actorFilter === 'S2S'
                ? 'bg-white font-bold text-jetblack'
                : 'text-white/70 hover:text-white'
            "
          >
            S2S
          </button>
          <button
            type="button"
            @click="actorFilter = 'CLIENT'"
            class="px-2 h-full rounded transition cursor-pointer flex items-center"
            :class="
              actorFilter === 'CLIENT'
                ? 'bg-white font-bold text-jetblack'
                : 'text-white/70 hover:text-white'
            "
          >
            Client
          </button>
        </div>

        <!-- Refresh Button -->
        <button
          type="button"
          @click="emit('refresh')"
          class="p-1.5 rounded-md bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition shrink-0 cursor-pointer"
          title="Segarkan data log audit"
        >
          <RefreshCw class="w-3.5 h-3.5" :class="{ 'animate-spin': loading }" />
        </button>
      </div>
    </div>

    <!-- Table View -->
    <TableContainer>
      <template #head>
        <tr>
          <th class="py-2.5 pr-3 pl-3.5 sm:pl-4 md:pl-6 w-8"></th>
          <th class="py-2.5 px-3">Waktu</th>
          <th class="py-2.5 px-3">Aktor</th>
          <th class="py-2.5 px-3">Event</th>
          <th class="py-2.5 px-3">Target License / App</th>
          <th class="py-2.5 px-3">IP Address</th>
          <th class="py-2.5 pl-3 pr-3.5 sm:pr-4 md:pr-6 text-right">Detail Payload</th>
        </tr>
      </template>

      <TableSkeleton v-if="loading" :columns="7" :rows="5" />
      <tr v-else-if="filteredLogs.length === 0">
        <td colspan="7" class="py-8 px-3.5 sm:px-4 md:px-6">
          <EmptyState
            :icon="Activity"
            title="Tidak ada log aktivitas ditemukan"
            description="Coba sesuaikan kata kunci pencarian atau filter aktor Anda."
            container-class="border-0 bg-transparent py-4"
          />
        </td>
      </tr>
      <template v-else v-for="log in filteredLogs" :key="log.id">
        <tr @click="toggleRow(log.id)" class="hover:bg-jetblack/[0.02] transition cursor-pointer">
          <td class="py-2.5 pr-2 pl-3.5 sm:pl-4 md:pl-6 text-jetblack/40">
            <ChevronDown v-if="expandedRowId === log.id" class="w-3.5 h-3.5" />
            <ChevronRight v-else class="w-3.5 h-3.5" />
          </td>
          <td class="py-2.5 px-3 text-[11px] text-jetblack/70 font-mono">
            {{ new Date(log.createdAt).toLocaleString("id-ID") }}
          </td>
          <td class="py-2.5 px-3">
            <span
              v-if="log.actorType === 'ADMIN'"
              class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-gold/15 text-[#8a6d1f] border border-gold/30"
            >
              <Shield class="w-3 h-3 text-gold" />
              ADMIN
            </span>
            <span
              v-else-if="log.actorType === 'BUILDER'"
              class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-forest/10 text-forest border border-forest/20"
            >
              <UserCheck class="w-3 h-3" />
              BUILDER
            </span>
            <span
              v-else-if="log.actorType === 'S2S'"
              class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 border border-blue-200"
            >
              <Terminal class="w-3 h-3" />
              S2S API
            </span>
            <span
              v-else-if="log.actorType === 'CLIENT'"
              class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200"
            >
              <Laptop class="w-3 h-3" />
              CLIENT
            </span>
            <span
              v-else
              class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-700 border border-purple-200"
            >
              <Server class="w-3 h-3" />
              SYSTEM
            </span>
          </td>
          <td class="py-2.5 px-3 font-mono font-bold text-jetblack text-xs">
            {{ log.event }}
          </td>
          <td class="py-2.5 px-3">
            <div v-if="log.licenseKey" class="font-mono font-semibold text-jetblack text-[11px]">
              {{ log.licenseKey }}
            </div>
            <div v-else-if="log.appId" class="text-jetblack/60 font-mono text-[10.5px]">
              app: {{ log.appId }}
            </div>
            <span v-else class="text-jetblack/30">-</span>
          </td>
          <td class="py-2.5 px-3 text-[11px] font-mono text-jetblack/60">
            {{ log.ipAddress || "-" }}
          </td>
          <td class="py-2.5 pl-3 pr-3.5 sm:pr-4 md:pr-6 text-right">
            <span class="text-[10.5px] text-gold font-bold underline">
              {{ expandedRowId === log.id ? "Tutup" : "Lihat JSON" }}
            </span>
          </td>
        </tr>
        <!-- Expanded Payload Row -->
        <tr v-if="expandedRowId === log.id" class="bg-jetblack/[0.03]">
          <td colspan="7" class="py-3 px-6">
            <div
              class="p-3 rounded-lg bg-jetblack text-white font-mono text-[11px] overflow-x-auto space-y-1"
            >
              <div class="text-gold font-bold text-[10px] uppercase">Payload Event Data:</div>
              <pre class="text-white/80 whitespace-pre-wrap">{{
                JSON.stringify(log.payload, null, 2)
              }}</pre>
            </div>
          </td>
        </tr>
      </template>
    </TableContainer>
  </section>
</template>
