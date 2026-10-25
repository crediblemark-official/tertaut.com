<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { Download, RotateCcw, Receipt } from "lucide-vue-next";
import type { PanelTransactionItem } from "../../types/panel";
import TableSkeleton from "../common/TableSkeleton.vue";
import TableContainer from "../common/TableContainer.vue";
import SearchInput from "../common/SearchInput.vue";
import StatusBadge from "../common/StatusBadge.vue";
import EmptyState from "../common/EmptyState.vue";
import StatsBar from "../common/StatsBar.vue";
import StatItem from "../common/StatItem.vue";

const props = defineProps<{
  transactions: PanelTransactionItem[];
  loading?: boolean;
}>();

const statusFilter = defineModel<string>("statusFilter", { default: "" });
const searchQuery = defineModel<string>("searchQuery", { default: "" });
const modeFilter = ref<string>("");
const isMounted = ref(false);

onMounted(() => {
  isMounted.value = true;
});

const emit = defineEmits<{
  (e: "filterChange"): void;
  (e: "refund", tx: PanelTransactionItem): void;
}>();

function handleExportCsv() {
  const params = new URLSearchParams();
  if (statusFilter.value) params.append("status", statusFilter.value);
  if (modeFilter.value) params.append("mode", modeFilter.value);
  const q = params.toString() ? `?${params.toString()}` : "";
  window.open(`/api/v1/panel/export/transactions${q}`, "_blank");
}

const filteredTransactions = computed(() => {
  return props.transactions.filter((tx) => {
    if (statusFilter.value && tx.paymentStatus !== statusFilter.value) {
      return false;
    }
    if (modeFilter.value && (tx.mode || "live") !== modeFilter.value) {
      return false;
    }
    if (searchQuery.value.trim()) {
      const q = searchQuery.value.toLowerCase().trim();
      const matchApp = (tx.appName || "").toLowerCase().includes(q);
      const matchCust = (tx.customerEmail || "").toLowerCase().includes(q);
      const matchBuilder = (tx.builderEmail || "").toLowerCase().includes(q);
      const matchId = (tx.id || "").toLowerCase().includes(q);
      if (!matchApp && !matchCust && !matchBuilder && !matchId) return false;
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
        label="Total Transaksi"
        :value="transactions.length"
        sublabel="Seluruh entitas ledger"
        :loading="loading"
      />
      <StatItem
        label="Transaksi Berhasil"
        :value="transactions.filter((t) => t.paymentStatus === 'PAID').length"
        sublabel="Settlement sukses"
        variant="forest"
        bordered
        :loading="loading"
      />
      <StatItem
        label="Menunggu Pembayaran"
        :value="transactions.filter((t) => t.paymentStatus === 'PENDING').length"
        sublabel="Menunggu pembayaran pembeli"
        variant="gold"
        bordered
        :loading="loading"
      />
      <StatItem
        label="Gagal / Refunded"
        :value="
          transactions.filter((t) => ['FAILED', 'EXPIRED', 'REFUNDED'].includes(t.paymentStatus))
            .length
        "
        sublabel="Batal atau dikembalikan"
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
        placeholder="Cari transaksi, app, pembeli, builder..."
        wrapper-class="w-full max-w-md"
        input-class="h-8 text-xs"
      />
    </Teleport>

    <!-- Mobile Search Input Teleported to Admin Mobile Header (#admin-mobile-header-search) -->
    <Teleport v-if="isMounted" to="#admin-mobile-header-search">
      <SearchInput
        v-model="searchQuery"
        dark
        placeholder="Cari transaksi, app, pembeli, builder..."
        wrapper-class="w-full"
        input-class="h-8 text-xs"
      />
    </Teleport>

    <!-- Unified Table Toolbar (Standard Tertaut Dark Bar) -->
    <div
      class="-mx-3.5 sm:-mx-4 md:-mx-6 px-3.5 sm:px-4 md:px-6 min-h-[44px] py-1.5 sm:py-0 bg-jetblack text-white border-b border-jetblack flex items-center justify-between gap-3 overflow-x-auto no-scrollbar shadow-xs mb-0 !mt-0"
    >
      <div class="flex items-center gap-2 shrink-0">
        <Receipt class="w-3.5 h-3.5 text-gold" />
        <span class="text-xs font-bold text-white uppercase tracking-wider">
          Ledger Transaksi Platform
        </span>
        <span
          class="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white font-mono font-bold"
        >
          {{ filteredTransactions.length }} transaksi
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
            @click="
              statusFilter = '';
              emit('filterChange');
            "
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
            @click="
              statusFilter = 'PAID';
              emit('filterChange');
            "
            class="px-2 h-full rounded transition cursor-pointer flex items-center"
            :class="
              statusFilter === 'PAID'
                ? 'bg-white font-bold text-forest'
                : 'text-white/70 hover:text-white'
            "
          >
            Paid
          </button>
          <button
            type="button"
            @click="
              statusFilter = 'PENDING';
              emit('filterChange');
            "
            class="px-2 h-full rounded transition cursor-pointer flex items-center"
            :class="
              statusFilter === 'PENDING'
                ? 'bg-white font-bold text-gold'
                : 'text-white/70 hover:text-white'
            "
          >
            Pending
          </button>
          <button
            type="button"
            @click="
              statusFilter = 'FAILED';
              emit('filterChange');
            "
            class="px-2 h-full rounded transition cursor-pointer flex items-center"
            :class="
              statusFilter === 'FAILED'
                ? 'bg-white font-bold text-crimson'
                : 'text-white/70 hover:text-white'
            "
          >
            Failed
          </button>
          <button
            type="button"
            @click="
              statusFilter = 'REFUNDED';
              emit('filterChange');
            "
            class="px-2 h-full rounded transition cursor-pointer flex items-center"
            :class="
              statusFilter === 'REFUNDED'
                ? 'bg-white font-bold text-purple-400'
                : 'text-white/70 hover:text-white'
            "
          >
            Refunded
          </button>
        </div>

        <!-- Ekspor CSV Button -->
        <button
          @click="handleExportCsv"
          type="button"
          class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-bold text-white transition cursor-pointer shrink-0"
          title="Unduh seluruh data ledger transaksi ke format CSV"
        >
          <Download class="w-3.5 h-3.5" />
          <span>Ekspor CSV</span>
        </button>
      </div>
    </div>

    <!-- Table View (Responsive Table with Horizontal Scroll on Mobile) -->
    <TableContainer>
      <template #head>
        <tr>
          <th class="py-2.5 pr-3 pl-3.5 sm:pl-4 md:pl-6">Tanggal</th>
          <th class="py-2.5 px-3">TX ID</th>
          <th class="py-2.5 px-3">Aplikasi</th>
          <th class="py-2.5 px-3">Builder</th>
          <th class="py-2.5 px-3">Pelanggan</th>
          <th class="py-2.5 px-3">Gross (GMV)</th>
          <th class="py-2.5 px-3">MoR 5%</th>
          <th class="py-2.5 px-3">Net 95%</th>
          <th class="py-2.5 px-3">Status</th>
          <th class="py-2.5 px-3">Disbursement</th>
          <th class="py-2.5 pl-3 pr-3.5 sm:pr-4 md:pr-6 text-right">Aksi</th>
        </tr>
      </template>
      <TableSkeleton v-if="loading" :columns="11" :rows="5" />
      <tr v-else-if="filteredTransactions.length === 0">
        <td colspan="11" class="py-8 px-3.5 sm:px-4 md:px-6">
          <EmptyState
            :icon="Receipt"
            title="Tidak ada transaksi ditemukan"
            description="Coba sesuaikan kata kunci pencarian atau filter status Anda."
            container-class="border-0 bg-transparent py-4"
          />
        </td>
      </tr>
      <tr
        v-else
        v-for="tx in filteredTransactions"
        :key="tx.id"
        class="hover:bg-jetblack/[0.02] transition"
      >
        <td class="py-2.5 pr-3 pl-3.5 sm:pl-4 md:pl-6 text-[11px] text-jetblack/70 font-mono">
          {{ new Date(tx.createdAt).toLocaleDateString("id-ID") }}
        </td>
        <td class="py-2.5 px-3 font-mono font-bold text-[11px] text-jetblack">
          <div class="flex items-center gap-1.5">
            <span>{{ tx.id.slice(0, 10) }}...</span>
            <span
              :class="[
                'px-1.5 py-0.2 rounded text-[9px] font-extrabold uppercase border',
                tx.mode === 'sandbox'
                  ? 'bg-amber-50 text-amber-800 border-amber-300'
                  : 'bg-emerald-50 text-emerald-800 border-emerald-300',
              ]"
            >
              {{ tx.mode || "live" }}
            </span>
          </div>
        </td>
        <td class="py-2.5 px-3 font-semibold text-jetblack">{{ tx.appName }}</td>
        <td class="py-2.5 px-3 text-jetblack/70 text-xs">
          {{ tx.builderEmail }}
        </td>
        <td class="py-2.5 px-3 text-jetblack/70 text-xs">
          {{ tx.customerEmail }}
        </td>
        <td class="py-2.5 px-3 font-mono font-bold text-jetblack">
          Rp {{ tx.grossAmount.toLocaleString("id-ID") }}
        </td>
        <td class="py-2.5 px-3 font-mono font-bold text-[#996515]">
          Rp {{ tx.platformFee.toLocaleString("id-ID") }}
        </td>
        <td class="py-2.5 px-3 font-mono font-bold text-forest">
          Rp {{ tx.netAmount.toLocaleString("id-ID") }}
        </td>
        <td class="py-2.5 px-3">
          <StatusBadge :status="tx.paymentStatus" />
        </td>
        <td class="py-2.5 px-3">
          <StatusBadge :status="tx.disbursementStatus" />
        </td>
        <td class="py-2.5 pl-3 pr-3.5 sm:pr-4 md:pr-6 text-right">
          <div class="inline-flex items-center gap-1.5">
            <router-link
              :to="`/invoice/${tx.id}`"
              target="_blank"
              class="p-1 rounded text-jetblack/60 hover:text-jetblack hover:bg-jetblack/5 transition cursor-pointer"
              title="Lihat Faktur / E-Receipt"
            >
              <Receipt class="w-3.5 h-3.5" />
            </router-link>
            <button
              v-if="tx.paymentStatus === 'PAID'"
              :disabled="['PROCESSING', 'UNKNOWN', 'COMPLETED'].includes(tx.refundStatus || '')"
              @click="emit('refund', tx)"
              class="px-2 py-0.5 rounded text-[10px] font-bold border border-crimson/30 bg-white text-crimson hover:bg-crimson/10 transition cursor-pointer inline-flex items-center gap-1"
              title="Kembalikan dana ke pembeli & cabut lisensi otomatis"
            >
              <RotateCcw class="w-3 h-3" />
              <span>{{
                ["PROCESSING", "UNKNOWN"].includes(tx.refundStatus || "")
                  ? "Refund diproses"
                  : "Refund"
              }}</span>
            </button>
          </div>
        </td>
      </tr>
    </TableContainer>
  </section>
</template>
