<script setup lang="ts">
import { ref, computed } from "vue";
import {
  Search,
  Shield,
  Activity,
  UserCheck,
  Server,
  Terminal,
  Laptop,
  ChevronDown,
  ChevronRight,
} from "lucide-vue-next";
import type { PanelAuditLogItem } from "../../types/panel";
import TableSkeleton from "../common/TableSkeleton.vue";

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
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <div class="p-3 rounded-xl border border-jetblack/15 bg-white space-y-1">
        <span class="text-[10px] font-bold uppercase tracking-wider text-jetblack/50"
          >Total Log Terekam</span
        >
        <div v-if="loading" class="h-6 w-10 bg-jetblack/10 rounded animate-pulse mt-0.5"></div>
        <div v-else class="text-lg font-black text-jetblack">{{ logs.length }}</div>
      </div>
      <div class="p-3 rounded-xl border border-gold/25 bg-gold/5 space-y-1">
        <span class="text-[10px] font-bold uppercase tracking-wider text-[#8a6d1f]"
          >Aksi Admin</span
        >
        <div v-if="loading" class="h-6 w-10 bg-gold/25 rounded animate-pulse mt-0.5"></div>
        <div v-else class="text-lg font-black text-[#8a6d1f]">
          {{ logs.filter((l) => l.actorType === "ADMIN").length }}
        </div>
      </div>
      <div class="p-3 rounded-xl border border-forest/20 bg-forest/5 space-y-1">
        <span class="text-[10px] font-bold uppercase tracking-wider text-forest">Aksi Builder</span>
        <div v-if="loading" class="h-6 w-10 bg-forest/20 rounded animate-pulse mt-0.5"></div>
        <div v-else class="text-lg font-black text-forest">
          {{ logs.filter((l) => l.actorType === "BUILDER").length }}
        </div>
      </div>
      <div class="p-3 rounded-xl border border-blue-200 bg-blue-50/50 space-y-1">
        <span class="text-[10px] font-bold uppercase tracking-wider text-blue-700"
          >Client &amp; S2S</span
        >
        <div v-if="loading" class="h-6 w-10 bg-blue-200 rounded animate-pulse mt-0.5"></div>
        <div v-else class="text-lg font-black text-blue-700">
          {{ logs.filter((l) => ["S2S", "CLIENT"].includes(l.actorType)).length }}
        </div>
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
          placeholder="Cari event, license key, IP address..."
          class="w-full h-9 pl-8 pr-3 text-xs rounded-lg bg-white border border-slate-300/80 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-gold/20 focus:border-gold shadow-2xs transition"
        />
      </div>

      <div class="flex items-center gap-2">
        <select
          v-model="actorFilter"
          class="h-9 px-3 text-xs rounded-lg border border-slate-300/80 hover:border-slate-400 bg-white font-medium text-jetblack focus:outline-none focus:ring-2 focus:ring-gold/20 focus:border-gold shadow-2xs transition"
        >
          <option value="">Semua Aktor</option>
          <option value="ADMIN">ADMIN</option>
          <option value="BUILDER">BUILDER</option>
          <option value="S2S">S2S</option>
          <option value="CLIENT">CLIENT</option>
          <option value="SYSTEM">SYSTEM</option>
        </select>
      </div>
    </div>

    <!-- Table View -->
    <div class="-mx-3.5 sm:-mx-4 md:-mx-6 overflow-x-auto top-scrollbar">
      <table
        class="w-full min-w-full text-left text-xs whitespace-nowrap border-b border-jetblack/15"
      >
        <thead class="border-b border-jetblack/20 text-xs font-semibold text-jetblack/70 bg-white">
          <tr>
            <th class="py-2.5 pr-3 pl-3.5 sm:pl-4 md:pl-6 w-8"></th>
            <th class="py-2.5 px-3">Waktu</th>
            <th class="py-2.5 px-3">Aktor</th>
            <th class="py-2.5 px-3">Event</th>
            <th class="py-2.5 px-3">Target License / App</th>
            <th class="py-2.5 px-3">IP Address</th>
            <th class="py-2.5 pl-3 pr-3.5 sm:pr-4 md:pr-6 text-right">Detail Payload</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-jetblack/15">
          <TableSkeleton v-if="loading" :columns="7" :rows="5" />
          <tr v-else-if="filteredLogs.length === 0">
            <td colspan="7" class="py-8 px-3.5 sm:px-4 md:px-6 text-center text-jetblack/40">
              Tidak ada log aktivitas ditemukan.
            </td>
          </tr>
          <template v-else v-for="log in filteredLogs" :key="log.id">
            <tr
              @click="toggleRow(log.id)"
              class="hover:bg-jetblack/[0.02] transition cursor-pointer"
            >
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
                <div
                  v-if="log.licenseKey"
                  class="font-mono font-semibold text-jetblack text-[11px]"
                >
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
        </tbody>
      </table>
    </div>
  </section>
</template>
