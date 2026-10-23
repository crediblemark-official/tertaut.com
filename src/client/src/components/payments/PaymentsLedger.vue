<script setup lang="ts">
import { ref, onMounted, computed, watch } from "vue";
import { useRoute } from "vue-router";
import { api } from "../../lib/api";
import type { AppItem, DashboardStats } from "../../types/app";
import type { TransactionItem } from "../../types/transaction";
import { dashboardEnv, envPath } from "../../lib/environment";
import { formatRupiah, formatDate as formatUtilsDate } from "../../lib/utils";
import {
  CreditCard,
  Receipt,
  Search,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  RefreshCw,
  Plus,
} from "lucide-vue-next";
import TableSkeleton from "../common/TableSkeleton.vue";
import TableContainer from "../common/TableContainer.vue";
import TablePagination from "../common/TablePagination.vue";
import StatsBar from "../common/StatsBar.vue";
import StatItem from "../common/StatItem.vue";
import SearchPicker from "../common/SearchPicker.vue";
import PaymentDetailModal from "./PaymentDetailModal.vue";

const props = withDefaults(
  defineProps<{
    showCreateButton?: boolean;
    hideHeaderToolbar?: boolean;
    filterAppId?: string;
  }>(),
  {
    showCreateButton: false,
    hideHeaderToolbar: false,
  }
);

const emit = defineEmits<{
  (e: "create-checkout"): void;
}>();

const route = useRoute();
const env = dashboardEnv;
const loading = ref(true);
const transactions = ref<TransactionItem[]>([]);
const appsList = ref<AppItem[]>([]);
const overviewStats = ref<DashboardStats | null>(null);

const page = ref(1);
const limit = ref(25);
const total = ref(0);
const hasMore = ref(false);

const searchQuery = ref("");
const selectedStatus = ref<"ALL" | "PAID" | "PENDING" | "FAILED" | "EXPIRED">("ALL");
const selectedAppId = ref<string>(
  props.filterAppId ||
    (typeof route?.query?.appId === "string" && route.query.appId !== "ALL"
      ? route.query.appId
      : "")
);

const selectedTx = ref<TransactionItem | null>(null);
const isDetailModalOpen = ref(false);

const disburseLoading = ref<string | null>(null);
const disburseAlert = ref<string | null>(null);

async function loadData() {
  loading.value = true;
  disburseAlert.value = null;
  try {
    const [txRes, appRes, statsRes] = await Promise.all([
      api.getTransactions({
        page: page.value,
        limit: limit.value,
        appId:
          props.filterAppId ||
          (selectedAppId.value && selectedAppId.value !== "ALL" ? selectedAppId.value : undefined),
      }),
      api.getApps(),
      api.getStats().catch(() => null),
    ]);
    transactions.value = txRes.transactions || [];
    total.value = txRes.total ?? transactions.value.length;
    hasMore.value = txRes.hasMore ?? false;
    appsList.value = appRes.apps || [];
    overviewStats.value = statsRes;
  } catch (err) {
    console.error("Gagal memuat data payments/riwayat transaksi:", err);
  } finally {
    loading.value = false;
  }
}

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / limit.value)));

function prevPage() {
  if (page.value > 1) {
    page.value--;
    loadData();
  }
}

function nextPage() {
  if (page.value < totalPages.value) {
    page.value++;
    loadData();
  }
}

onMounted(loadData);
watch(env, () => {
  page.value = 1;
  loadData();
});
watch(
  () => props.filterAppId,
  (newId) => {
    selectedAppId.value = newId || "ALL";
    page.value = 1;
    loadData();
  }
);
watch(
  () => route?.query?.appId,
  (newId) => {
    if (typeof newId === "string" && !props.filterAppId) {
      selectedAppId.value = newId;
      page.value = 1;
      loadData();
    }
  }
);
watch(selectedAppId, (newId, oldId) => {
  if (newId !== oldId) {
    page.value = 1;
    loadData();
  }
});

const filteredTransactions = computed(() => {
  return transactions.value.filter((tx) => {
    if (selectedStatus.value !== "ALL" && tx.paymentStatus !== selectedStatus.value) {
      return false;
    }
    if (selectedAppId.value && selectedAppId.value !== "ALL" && tx.appId !== selectedAppId.value) {
      return false;
    }
    if (searchQuery.value.trim()) {
      const q = searchQuery.value.toLowerCase().trim();
      const matchEmail = tx.customerEmail?.toLowerCase().includes(q);
      const matchId = tx.id.toLowerCase().includes(q);
      const matchExt = tx.xenditExternalId?.toLowerCase().includes(q);
      const matchChannel = tx.paymentChannel?.toLowerCase().includes(q);
      const matchCoupon = tx.couponCode?.toLowerCase().includes(q);
      if (!matchEmail && !matchId && !matchExt && !matchChannel && !matchCoupon) return false;
    }
    return true;
  });
});

const kpiStats = computed(() => {
  const paidTxs = transactions.value.filter((t) => t.paymentStatus === "PAID");
  const totalGross =
    overviewStats.value?.totalGMV ?? paidTxs.reduce((acc, t) => acc + (t.grossAmount || 0), 0);
  const totalNet =
    overviewStats.value?.netEarnings ?? paidTxs.reduce((acc, t) => acc + (t.netAmount || 0), 0);
  const totalFee =
    overviewStats.value?.platformFeeCollected ??
    paidTxs.reduce((acc, t) => acc + (t.platformFee || 0), 0);
  const paidCount = overviewStats.value?.totalTransactions ?? paidTxs.length;
  const pendingCount = transactions.value.filter((t) => t.paymentStatus === "PENDING").length;

  return {
    totalGross,
    totalNet,
    totalFee,
    paidCount,
    pendingCount,
    totalCount: total.value || transactions.value.length,
  };
});

function openDetail(tx: TransactionItem) {
  selectedTx.value = tx;
  isDetailModalOpen.value = true;
}

function closeDetail() {
  isDetailModalOpen.value = false;
  selectedTx.value = null;
}

function getAppName(appId: string): string {
  const app = appsList.value.find((a) => a.id === appId);
  return app ? app.name : appId;
}

function formatDate(dateStr?: string | null): string {
  return formatUtilsDate(dateStr, { includeTime: true });
}

defineExpose({
  refresh: loadData,
});
</script>

<template>
  <div class="space-y-3">
    <!-- Header & Action Toolbar (Edge-to-Edge Full Width Standard) -->
    <div
      v-if="!hideHeaderToolbar"
      class="-mx-3.5 sm:-mx-4 md:-mx-6 px-3.5 sm:px-4 md:px-6 min-h-[44px] py-1.5 sm:py-0 bg-jetblack text-white border-b border-jetblack flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-xs"
    >
      <div class="flex items-center gap-2">
        <Receipt class="w-3.5 h-3.5 text-gold shrink-0" />
        <span
          class="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white font-mono font-bold"
        >
          {{ kpiStats.totalCount }} total
        </span>
        <span
          class="px-2 py-0.5 rounded-md font-bold text-[10px]"
          :class="env === 'sandbox' ? 'bg-gold text-jetblack' : 'bg-forest text-white'"
        >
          {{ env === "sandbox" ? "Sandbox" : "Live" }}
        </span>
      </div>

      <div class="flex items-center gap-2 overflow-x-auto no-scrollbar w-full sm:w-auto">
        <!-- Shortcut to Balances (saldo dikelola secara agregat di /balances) -->
        <router-link
          :to="envPath(env, '/balances')"
          class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition flex items-center gap-1.5 shrink-0"
          title="Saldo pencairan dikelola secara agregat di halaman Balances"
        >
          <Wallet class="w-3.5 h-3.5 text-gold" />
          <span>Kelola Saldo</span>
          <ArrowUpRight class="w-3 h-3 text-white/50" />
        </router-link>

        <!-- Shortcut to Create Checkout -->
        <button
          v-if="showCreateButton"
          type="button"
          @click="emit('create-checkout')"
          class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gold hover:bg-gold-hover text-jetblack text-xs font-bold transition shadow-2xs cursor-pointer shrink-0"
        >
          <Plus class="w-3.5 h-3.5" />
          <span>Buat Checkout</span>
        </button>

        <!-- Search Input -->
        <div class="relative w-full sm:w-56">
          <Search
            class="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none"
          />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Cari ID, email, kupon..."
            class="w-full pl-8 pr-2.5 py-1 rounded-lg bg-white/10 border border-white/15 text-xs text-white placeholder:text-white/40 focus:outline-none focus:bg-white/15 focus:border-gold transition"
          />
        </div>

        <!-- Filter Per Project Dropdown -->
        <SearchPicker
          v-model="selectedAppId"
          :items="appsList"
          :dark="true"
          all-option-label="Semua Project"
          placeholder="Semua Project"
          search-placeholder="Cari software SaaS..."
          button-class="!h-7 !rounded-md !min-w-[150px] !text-xs"
        />

        <!-- Status Filter Pills -->
        <div
          class="flex items-center h-7 rounded-md bg-white/10 p-0.5 text-[10px] font-medium shrink-0"
        >
          <button
            @click="selectedStatus = 'ALL'"
            :class="[
              'px-2 h-full rounded transition cursor-pointer flex items-center',
              selectedStatus === 'ALL'
                ? 'bg-white font-bold text-jetblack'
                : 'text-white/70 hover:text-white',
            ]"
          >
            Semua
          </button>
          <button
            @click="selectedStatus = 'PAID'"
            :class="[
              'px-2 h-full rounded transition cursor-pointer flex items-center',
              selectedStatus === 'PAID'
                ? 'bg-white font-bold text-jetblack'
                : 'text-white/70 hover:text-white',
            ]"
          >
            Lunas
          </button>
          <button
            @click="selectedStatus = 'PENDING'"
            :class="[
              'px-2 h-full rounded transition cursor-pointer flex items-center',
              selectedStatus === 'PENDING'
                ? 'bg-white font-bold text-jetblack'
                : 'text-white/70 hover:text-white',
            ]"
          >
            Menunggu
          </button>
          <button
            @click="selectedStatus = 'FAILED'"
            :class="[
              'px-2 h-full rounded transition cursor-pointer flex items-center',
              selectedStatus === 'FAILED'
                ? 'bg-white font-bold text-jetblack'
                : 'text-white/70 hover:text-white',
            ]"
          >
            Gagal
          </button>
          <button
            @click="selectedStatus = 'EXPIRED'"
            :class="[
              'px-2 h-full rounded transition cursor-pointer flex items-center',
              selectedStatus === 'EXPIRED'
                ? 'bg-white font-bold text-jetblack'
                : 'text-white/70 hover:text-white',
            ]"
          >
            Kedaluwarsa
          </button>
        </div>

        <!-- Refresh Button -->
        <button
          @click="loadData"
          title="Segarkan data transaksi"
          class="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer transition shrink-0"
        >
          <RefreshCw class="w-3.5 h-3.5" :class="{ 'animate-spin': loading }" />
        </button>
      </div>
    </div>

    <!-- Alert Banner (Disbursement, Simulation, or Error) -->
    <div
      v-if="disburseAlert"
      :class="[
        'p-3 rounded-lg text-xs font-bold flex items-center justify-between transition animate-fadeIn',
        disburseAlert.startsWith('Error') ||
        disburseAlert.startsWith('Peringatan') ||
        disburseAlert.startsWith('Gagal')
          ? 'bg-amber-50 border border-amber-200 text-amber-900'
          : 'bg-forest/10 border border-forest/25 text-forest',
      ]"
    >
      <div class="flex items-center gap-2">
        <component
          :is="
            disburseAlert.startsWith('Error') ||
            disburseAlert.startsWith('Peringatan') ||
            disburseAlert.startsWith('Gagal')
              ? AlertTriangle
              : CheckCircle2
          "
          class="w-4 h-4 shrink-0"
        />
        <span>{{ disburseAlert }}</span>
      </div>
      <button @click="disburseAlert = null" class="text-xs underline cursor-pointer ml-3 shrink-0">
        Tutup
      </button>
    </div>

    <!-- KPI Stats Summary Bar -->
    <StatsBar>
      <StatItem
        label="Penjualan Bruto"
        :value="formatRupiah(kpiStats.totalGross)"
        :sublabel="`${kpiStats.paidCount} transaksi berhasil`"
        :loading="loading"
      />

      <StatItem
        label="Penghasilan Bersih (95%)"
        :value="formatRupiah(kpiStats.totalNet)"
        :sublabel="`Biaya platform 5% (${formatRupiah(kpiStats.totalFee)})`"
        variant="forest"
        bordered
        :loading="loading"
      />

      <StatItem
        label="Transaksi Berhasil"
        :value="kpiStats.paidCount"
        :sublabel="`dari total ${kpiStats.totalCount} pesanan`"
        bordered
        :loading="loading"
      />

      <StatItem
        label="Menunggu Pembayaran"
        :value="kpiStats.pendingCount"
        sublabel="menunggu konfirmasi pelanggan"
        variant="gold"
        bordered
        :loading="loading"
      />
    </StatsBar>

    <!-- Edge-to-Edge Responsive Table -->
    <TableContainer tbody-class="bg-white">
      <template #head>
        <tr>
          <th class="py-2.5 pr-2.5 pl-3.5 sm:pl-4 md:pl-6">ID Transaksi</th>
          <th class="py-2.5 px-2.5">Pelanggan</th>
          <th class="py-2.5 px-2.5">Aplikasi</th>
          <th class="py-2.5 px-2.5">Total Bruto</th>
          <th class="py-2.5 px-2.5">Biaya (5%)</th>
          <th class="py-2.5 px-2.5">Hak Bersih</th>
          <th class="py-2.5 px-2.5">Metode Bayar</th>
          <th class="py-2.5 px-2.5">Status</th>
          <th class="py-2.5 px-2.5">Waktu</th>
          <th class="py-2.5 pl-2.5 pr-3.5 sm:pr-4 md:pr-6 text-right">Aksi</th>
        </tr>
      </template>

      <TableSkeleton v-if="loading" :columns="10" :rows="6" />
      <tr v-else-if="filteredTransactions.length === 0">
        <td colspan="10" class="py-10 px-3.5 sm:px-4 md:px-6 text-center text-jetblack/40">
          <div class="space-y-1">
            <Receipt class="w-7 h-7 mx-auto text-jetblack/30" />
            <p class="font-semibold text-xs text-jetblack/70">
              Belum ada riwayat transaksi ditemukan.
            </p>
            <p class="text-[11px] text-jetblack/50">
              Coba sesuaikan kata kunci pencarian atau filter status Anda.
            </p>
          </div>
        </td>
      </tr>
      <tr
        v-else
        v-for="tx in filteredTransactions"
        :key="tx.id"
        class="hover:bg-slate-50/70 transition group cursor-pointer"
        @click="openDetail(tx)"
      >
        <td class="py-3 pr-2.5 pl-3.5 sm:pl-4 md:pl-6 font-mono font-bold text-jetblack">
          <div class="flex items-center gap-1.5">
            <span>{{ tx.id }}</span>
            <span
              v-if="env === 'sandbox'"
              class="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-gold/15 text-[#8a6d1f] border border-gold/30"
            >
              SIM
            </span>
          </div>
        </td>
        <td class="py-3 px-2.5">
          <div class="flex items-center gap-1.5">
            <div>
              <div class="font-medium text-jetblack leading-tight">
                {{ tx.customerEmail || "-" }}
              </div>
              <div
                v-if="tx.customerName"
                class="text-[10.5px] text-jetblack/50 leading-tight mt-0.5"
              >
                {{ tx.customerName }}
              </div>
            </div>
            <span
              v-if="tx.couponCode"
              class="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-gold/15 border border-gold/30 text-[9px] font-bold text-jetblack font-mono shrink-0"
              title="Kupon Diskon Digunakan"
            >
              <TicketPercent class="w-2.5 h-2.5" />
              {{ tx.couponCode }}
            </span>
            <span
              v-if="tx.metadata && Object.keys(tx.metadata).length > 0"
              class="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-jetblack/5 border border-jetblack/15 text-[9px] font-bold text-jetblack/70 font-mono shrink-0"
              title="Membawa metadata kustom SaaS"
            >
              META
            </span>
          </div>
        </td>
        <td class="py-3 px-2.5">
          <span class="font-medium text-jetblack/80">{{ getAppName(tx.appId) }}</span>
        </td>
        <td class="py-3 px-2.5 font-mono font-bold text-jetblack">
          {{ formatRupiah(tx.grossAmount) }}
        </td>
        <td class="py-3 px-2.5 font-mono text-red-600 text-[11px]">
          -{{ formatRupiah(tx.platformFee) }}
        </td>
        <td class="py-3 px-2.5 font-mono font-bold text-forest">
          {{ formatRupiah(tx.netAmount) }}
        </td>
        <td class="py-3 px-2.5">
          <span
            class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10.5px] font-medium bg-slate-100 text-slate-700"
          >
            <CreditCard class="w-3 h-3 text-gold" />
            <span>{{ tx.paymentChannel || "QRIS / VA" }}</span>
          </span>
        </td>
        <td class="py-3 px-2.5">
          <span
            :class="[
              'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider',
              tx.paymentStatus === 'PAID'
                ? 'bg-forest/10 text-forest border border-forest/30'
                : tx.paymentStatus === 'PENDING'
                  ? 'bg-gold/15 text-[#8a6d1f] border border-gold/30'
                  : 'bg-red-50 text-red-600 border border-red-200',
            ]"
          >
            <span
              class="w-1.5 h-1.5 rounded-full"
              :class="
                tx.paymentStatus === 'PAID'
                  ? 'bg-forest'
                  : tx.paymentStatus === 'PENDING'
                    ? 'bg-gold'
                    : 'bg-red-500'
              "
            ></span>
            {{ tx.paymentStatus }}
          </span>
        </td>

        <td class="py-3 px-2.5 text-[11px] text-jetblack/60 font-mono">
          {{ formatDate(tx.paidAt || tx.createdAt) }}
        </td>
        <td class="py-3 pl-2.5 pr-3.5 sm:pr-4 md:pr-6 text-right" @click.stop>
          <div class="flex items-center justify-end gap-1.5">
            <!-- Direct Link to Customer Checkout Invoice for pending tx -->
            <a
              v-if="tx.xenditInvoiceUrl && tx.paymentStatus === 'PENDING'"
              :href="tx.xenditInvoiceUrl"
              target="_blank"
              title="Buka Tautan Kasir / Invoice Pembeli"
              class="px-2 py-0.5 rounded bg-jetblack text-white hover:bg-jetblack-hover text-[10.5px] font-bold transition inline-flex items-center gap-1"
            >
              <ExternalLink class="w-2.5 h-2.5" />
              <span>Link Kasir</span>
            </a>

            <!-- Detail Modal Button -->
            <button
              type="button"
              @click="openDetail(tx)"
              class="px-2 py-0.5 rounded-md text-[11px] font-semibold border border-slate-300 hover:bg-jetblack hover:text-white hover:border-jetblack transition cursor-pointer"
            >
              Detail
            </button>
          </div>
        </td>
      </tr>
    </TableContainer>

    <!-- Pagination Bar -->
    <TablePagination
      v-model:page="page"
      :total-pages="totalPages"
      :total="total"
      :limit="limit"
      :loading="loading"
      item-label="transaksi"
      @prev="prevPage"
      @next="nextPage"
    />

    <!-- Transaction Detail Modal -->
    <PaymentDetailModal
      :is-open="isDetailModalOpen"
      :transaction="selectedTx"
      :apps-list="appsList"
      :env="env"
      @close="closeDetail"
    />
  </div>
</template>
