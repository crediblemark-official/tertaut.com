<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { Building2, Download, Layers, ExternalLink, ChevronDown } from "lucide-vue-next";
import type { PanelBuilderItem } from "../../types/panel";
import TableContainer from "../common/TableContainer.vue";
import TableSkeleton from "../common/TableSkeleton.vue";
import SearchInput from "../common/SearchInput.vue";
import StatusBadge from "../common/StatusBadge.vue";
import EmptyState from "../common/EmptyState.vue";
import StatsBar from "../common/StatsBar.vue";
import StatItem from "../common/StatItem.vue";

const props = defineProps<{
  builders: PanelBuilderItem[];
  loading?: boolean;
}>();

const emit = defineEmits<{
  (e: "toggleSuspend", builderId: string): void;
}>();

const searchQuery = ref("");
const isMounted = ref(false);

const expandedBuilders = ref<Record<string, boolean>>({});

function toggleExpand(builderId: string) {
  expandedBuilders.value[builderId] = !expandedBuilders.value[builderId];
}

onMounted(() => {
  isMounted.value = true;
});

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
    <!-- Macro Summary Counter -->
    <StatsBar borderless>
      <StatItem
        label="Total Builder"
        :value="builders.length"
        sublabel="Akun developer terdaftar"
        :loading="loading"
      />
      <StatItem
        label="Builder Aktif"
        :value="builders.filter((b) => !b.isSuspended).length"
        sublabel="Status operasional normal"
        variant="forest"
        bordered
        :loading="loading"
      />
      <StatItem
        label="Rekening Terverifikasi"
        :value="
          builders.filter(
            (b) => b.bankAccount?.accountNumber || b.disbursementAccount?.accountNumber
          ).length
        "
        sublabel="Siap menerima pencairan"
        variant="gold"
        bordered
        :loading="loading"
      />
      <StatItem
        label="Ditangguhkan"
        :value="builders.filter((b) => b.isSuspended).length"
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
        placeholder="Cari nama builder, email, atau rekening..."
        wrapper-class="w-full max-w-md"
        input-class="h-8 text-xs"
      />
    </Teleport>

    <!-- Mobile Search Input Teleported to Admin Mobile Header (#admin-mobile-header-search) -->
    <Teleport v-if="isMounted" to="#admin-mobile-header-search">
      <SearchInput
        v-model="searchQuery"
        dark
        placeholder="Cari nama builder, email, atau rekening..."
        wrapper-class="w-full"
        input-class="h-8 text-xs"
      />
    </Teleport>

    <!-- Unified Table Toolbar (Standard Tertaut Dark Bar) -->
    <div
      class="-mx-3.5 sm:-mx-4 md:-mx-6 px-3.5 sm:px-4 md:px-6 min-h-[44px] py-1.5 sm:py-0 bg-jetblack text-white border-b border-jetblack flex items-center justify-between gap-3 overflow-x-auto no-scrollbar shadow-xs mb-0 !mt-0"
    >
      <div class="flex items-center gap-2 shrink-0">
        <Building2 class="w-3.5 h-3.5 text-gold" />
        <span class="text-xs font-bold text-white uppercase tracking-wider">
          Direktori Builder
        </span>
        <span
          class="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white font-mono font-bold"
        >
          {{ filteredBuilders.length }} builder
        </span>
      </div>

      <div class="flex items-center gap-2 shrink-0">
        <button
          @click="handleExportCsv"
          type="button"
          class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-bold text-white transition cursor-pointer shrink-0"
          title="Unduh seluruh data direktori builder ke format CSV"
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
          <th class="py-2.5 pr-3 pl-3.5 sm:pl-4 md:pl-6">Builder</th>
          <th class="py-2.5 px-3">Status</th>
          <th class="py-2.5 px-3">Email</th>
          <th class="py-2.5 px-3">Rekening Pencairan</th>
          <th class="py-2.5 px-3">Aplikasi</th>
          <th class="py-2.5 px-3">Total GMV</th>
          <th class="py-2.5 px-3">Net 95%</th>
          <th class="py-2.5 px-3">Terdaftar</th>
          <th class="py-2.5 pl-3 pr-3.5 sm:pr-4 md:pr-6 text-right">Aksi Moderasi</th>
        </tr>
      </template>

      <TableSkeleton v-if="loading" :columns="9" :rows="5" />
      <tr v-else-if="filteredBuilders.length === 0">
        <td colspan="9" class="py-8 px-3.5 sm:px-4 md:px-6">
          <EmptyState
            :icon="Building2"
            title="Tidak ada data builder ditemukan"
            description="Coba sesuaikan kata kunci pencarian Anda."
            container-class="border-0 bg-transparent py-4"
          />
        </td>
      </tr>
      <template v-for="b in filteredBuilders" :key="b.id">
        <tr
          class="hover:bg-jetblack/[0.02] transition"
          :class="{ 'bg-jetblack/[0.02]': expandedBuilders[b.id] }"
        >
          <td class="py-2.5 pr-3 pl-3.5 sm:pl-4 md:pl-6 font-bold text-jetblack">
            {{ b.name || "Builder" }}
          </td>
          <td class="py-2.5 px-3">
            <StatusBadge :status="b.isSuspended ? 'DIBEKUKAN' : 'AKTIF'" />
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
                  b.bankAccount?.accountHolder || b.disbursementAccount?.accountHolderName || b.name
                }}
              </div>
            </div>
            <span v-else class="text-jetblack/40 italic">Belum dikonfigurasi</span>
          </td>
          <td class="py-2.5 px-3">
            <button
              v-if="b.apps && b.apps.length > 0"
              type="button"
              @click="toggleExpand(b.id)"
              class="group inline-flex items-center gap-1.5 font-bold text-xs text-jetblack hover:text-forest transition cursor-pointer"
              :title="expandedBuilders[b.id] ? 'Tutup daftar software' : 'Lihat daftar software'"
            >
              <span>{{ b.appCount ?? b.totalApps ?? b.apps.length }} Software</span>
              <ChevronDown
                class="w-3.5 h-3.5 text-jetblack/40 group-hover:text-forest transition-transform duration-200"
                :class="{ 'rotate-180': expandedBuilders[b.id] }"
              />
            </button>
            <span v-else class="font-bold text-xs text-jetblack/50"> 0 Software </span>
          </td>
          <td class="py-2.5 px-3 font-mono font-bold text-jetblack">
            Rp {{ (b.totalSales ?? b.totalGMV ?? 0).toLocaleString("id-ID") }}
          </td>
          <td class="py-2.5 px-3 font-mono font-bold text-forest">
            Rp {{ (b.builderNetRevenue ?? b.totalNetEarnings ?? 0).toLocaleString("id-ID") }}
          </td>
          <td class="py-2.5 px-3 text-jetblack/50 text-[11px] font-mono">
            {{ b.createdAt ? new Date(b.createdAt).toLocaleDateString("id-ID") : "-" }}
          </td>
          <td class="py-2.5 pl-3 pr-3.5 sm:pr-4 md:pr-6 text-right">
            <div class="inline-flex items-center justify-end">
              <button
                @click="emit('toggleSuspend', b.id)"
                :class="[
                  'px-2.5 py-1 rounded text-[11px] font-bold border transition cursor-pointer',
                  b.isSuspended
                    ? 'border-forest/40 bg-forest/10 text-forest hover:bg-forest/20'
                    : 'border-crimson/30 bg-white text-crimson hover:bg-crimson/10',
                ]"
              >
                {{ b.isSuspended ? "Aktifkan" : "Bekukan" }}
              </button>
            </div>
          </td>
        </tr>

        <!-- Expanded Software Row -->
        <tr v-if="expandedBuilders[b.id]" class="bg-slate-50/70">
          <td colspan="9" class="p-3.5 sm:p-4 whitespace-normal border-b border-jetblack/15">
            <div class="space-y-2.5">
              <!-- Sub-header -->
              <div class="flex items-center justify-between gap-3">
                <div class="flex items-center gap-2">
                  <div class="w-2 h-2 rounded-full bg-gold"></div>
                  <h4 class="text-xs font-bold uppercase tracking-wider text-jetblack">
                    Daftar Software: {{ b.name || "Builder" }}
                  </h4>
                  <span
                    class="text-[10px] px-2 py-0.5 rounded-full bg-white border border-slate-200 font-mono font-bold text-jetblack"
                  >
                    {{ b.apps?.length || 0 }} Software
                  </span>
                  <span class="text-[11px] text-jetblack/50 font-mono hidden sm:inline">
                    • {{ b.email }}
                  </span>
                </div>
                <button
                  type="button"
                  @click="toggleExpand(b.id)"
                  class="text-[11px] font-semibold text-jetblack/60 hover:text-jetblack transition cursor-pointer px-2 py-0.5 rounded hover:bg-jetblack/5"
                >
                  Tutup ✕
                </button>
              </div>

              <!-- Nested List / Table of Apps -->
              <div
                v-if="b.apps && b.apps.length > 0"
                class="rounded-lg border border-slate-200 bg-white shadow-2xs overflow-hidden"
              >
                <table class="w-full text-left text-xs whitespace-nowrap">
                  <thead
                    class="bg-slate-100/80 border-b border-slate-200 text-[10.5px] text-jetblack/70 uppercase tracking-wider font-bold"
                  >
                    <tr>
                      <th class="py-2 px-3.5">Software</th>
                      <th class="py-2 px-3">Slug URL</th>
                      <th class="py-2 px-3">Mode</th>
                      <th class="py-2 px-3">Status</th>
                      <th class="py-2 px-3.5 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-100">
                    <tr v-for="app in b.apps" :key="app.id" class="hover:bg-slate-50 transition">
                      <td class="py-2 px-3.5 font-bold text-jetblack">
                        {{ app.name }}
                      </td>
                      <td class="py-2 px-3 font-mono text-[11px] text-jetblack/60">
                        /v/{{ app.slug }}
                      </td>
                      <td class="py-2 px-3">
                        <span
                          :class="[
                            'text-[9px] font-mono px-1.5 py-0.5 rounded font-bold uppercase',
                            app.mode === 'LIVE'
                              ? 'bg-forest/10 text-forest border border-forest/20'
                              : 'bg-amber-500/10 text-amber-700 border border-amber-500/20',
                          ]"
                        >
                          {{ app.mode || "SANDBOX" }}
                        </span>
                      </td>
                      <td class="py-2 px-3">
                        <span
                          v-if="app.isSuspended"
                          class="inline-flex items-center gap-1 text-[10px] font-mono font-bold uppercase text-crimson"
                        >
                          <span class="w-1.5 h-1.5 rounded-full bg-crimson"></span>
                          DIBEKUKAN
                        </span>
                        <span
                          v-else
                          class="inline-flex items-center gap-1 text-[10px] font-mono font-bold uppercase text-forest"
                        >
                          <span class="w-1.5 h-1.5 rounded-full bg-forest"></span>
                          AKTIF
                        </span>
                      </td>
                      <td class="py-2 px-3.5 text-right">
                        <a
                          :href="`/v/${app.slug}`"
                          target="_blank"
                          rel="noopener noreferrer"
                          class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10.5px] font-semibold border border-jetblack/15 bg-white hover:bg-jetblack hover:text-white transition cursor-pointer"
                          title="Buka halaman checkout software"
                        >
                          <span>Lihat Halaman</span>
                          <ExternalLink class="w-2.5 h-2.5" />
                        </a>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div
                v-else
                class="py-4 text-center text-xs text-jetblack/40 italic bg-white rounded-lg border border-slate-200"
              >
                Builder ini belum memiliki software terdaftar.
              </div>
            </div>
          </td>
        </tr>
      </template>
    </TableContainer>
  </section>
</template>
