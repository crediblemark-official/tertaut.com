<script setup lang="ts">
import { ref, onMounted, computed, watch } from "vue";
import { api } from "../../lib/api";
import type { AppItem, DashboardStats } from "../../types/app";
import type { TransactionItem } from "../../types/transaction";
import { dashboardEnv, envPath } from "../../lib/environment";
import { formatRupiah, formatDate as formatUtilsDate } from "../../lib/utils";
import { useClipboard } from "../../composables/useClipboard";
import {
  CreditCard,
  Receipt,
  Search,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  X,
  RefreshCw,
  Zap,
  ArrowUpRight,
  ShieldCheck,
  Building2,
  Wallet,
  TicketPercent,
  Send,
  Copy,
  Check,
  Plus,
} from "lucide-vue-next";

const props = withDefaults(
  defineProps<{
    showCreateButton?: boolean;
    hideHeaderToolbar?: boolean;
  }>(),
  {
    showCreateButton: false,
    hideHeaderToolbar: false,
  }
);

const emit = defineEmits<{
  (e: "create-checkout"): void;
}>();

const env = dashboardEnv;
const loading = ref(false);
const transactions = ref<TransactionItem[]>([]);
const appsList = ref<AppItem[]>([]);
const overviewStats = ref<DashboardStats | null>(null);

const page = ref(1);
const limit = ref(25);
const total = ref(0);
const hasMore = ref(false);

const searchQuery = ref("");
const selectedStatus = ref<"ALL" | "PAID" | "PENDING" | "FAILED" | "EXPIRED">("ALL");
const selectedAppId = ref<string>("ALL");

const selectedTx = ref<TransactionItem | null>(null);
const isDetailModalOpen = ref(false);
const isSimulating = ref(false);
const simulateMsg = ref<string | null>(null);

const disburseLoading = ref<string | null>(null);
const disburseAlert = ref<string | null>(null);

const { copied: txIdCopied, copy: copyTxId } = useClipboard();

async function loadData() {
  loading.value = true;
  disburseAlert.value = null;
  try {
    const [txRes, appRes, statsRes] = await Promise.all([
      api.getTransactions({ page: page.value, limit: limit.value }),
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

const filteredTransactions = computed(() => {
  return transactions.value.filter((tx) => {
    if (selectedStatus.value !== "ALL" && tx.paymentStatus !== selectedStatus.value) {
      return false;
    }
    if (selectedAppId.value !== "ALL" && tx.appId !== selectedAppId.value) {
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
  simulateMsg.value = null;
  isDetailModalOpen.value = true;
}

function closeDetail() {
  isDetailModalOpen.value = false;
  selectedTx.value = null;
}

async function handleSimulate(txId: string) {
  isSimulating.value = true;
  simulateMsg.value = null;
  try {
    const res = await api.simulatePayment(txId);
    if (res.success) {
      simulateMsg.value = "Pembayaran berhasil disimulasikan lunas!";
      disburseAlert.value = `Berhasil! Pembayaran ${txId} disimulasikan lunas. Lisensi ${res.licenseKey || ""} diterbitkan.`;
      await loadData();
      const updated = transactions.value.find((t) => t.id === txId);
      if (updated) selectedTx.value = updated;
    } else {
      simulateMsg.value = res.message || "Gagal simulasi";
    }
  } catch (err: any) {
    simulateMsg.value = err?.message || "Error simulasi";
  } finally {
    isSimulating.value = false;
  }
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
        <div class="flex items-center gap-1.5">
          <Receipt class="w-3.5 h-3.5 text-gold" />
          <h1 class="text-xs font-bold uppercase tracking-wider text-white">
            Riwayat Transaksi & Pembayaran
          </h1>
        </div>
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
            Paid
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
            Pending
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
            Failed
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
            Expired
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
    <div
      class="-mx-3.5 sm:-mx-4 md:-mx-6 px-3.5 sm:px-4 md:px-6 grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 py-2.5 sm:py-3 border-b border-jetblack/15 bg-white"
    >
      <div class="space-y-0.5">
        <div class="text-xs font-semibold text-jetblack/60">Gross Volume (Bruto)</div>
        <div class="text-2xl font-bold text-jetblack font-mono tracking-tight">
          {{ formatRupiah(kpiStats.totalGross) }}
        </div>
        <div class="text-[11px] text-jetblack/50 font-medium">
          {{ kpiStats.paidCount }} transaksi sukses
        </div>
      </div>

      <div class="space-y-0.5 sm:border-l sm:border-jetblack/10 sm:pl-5">
        <div class="text-xs font-semibold text-jetblack/60">Net Builder (95%)</div>
        <div class="text-2xl font-bold text-forest font-mono tracking-tight">
          {{ formatRupiah(kpiStats.totalNet) }}
        </div>
        <div class="text-[11px] text-jetblack/50 font-medium">
          Fee MoR Tertaut 5% ({{ formatRupiah(kpiStats.totalFee) }})
        </div>
      </div>

      <div class="space-y-0.5 sm:border-l sm:border-jetblack/10 sm:pl-5">
        <div class="text-xs font-semibold text-jetblack/60">Transaksi Berhasil</div>
        <div class="text-2xl font-bold text-jetblack font-mono tracking-tight">
          {{ kpiStats.paidCount }}
        </div>
        <div class="text-[11px] text-jetblack/50 font-medium">
          dari total {{ kpiStats.totalCount }} pesanan
        </div>
      </div>

      <div class="space-y-0.5 sm:border-l sm:border-jetblack/10 sm:pl-5">
        <div class="text-xs font-semibold text-jetblack/60">Menunggu Pembayaran</div>
        <div class="text-2xl font-bold text-gold font-mono tracking-tight">
          {{ kpiStats.pendingCount }}
        </div>
        <div class="text-[11px] text-jetblack/50 font-medium">menunggu konfirmasi webhook</div>
      </div>
    </div>

    <!-- Edge-to-Edge Responsive Table -->
    <div class="-mx-3.5 sm:-mx-4 md:-mx-6 overflow-x-auto top-scrollbar">
      <table
        class="w-full min-w-full text-left text-xs whitespace-nowrap border-b border-jetblack/15"
      >
        <thead class="border-b border-jetblack/20 text-xs font-semibold text-jetblack/70 bg-white">
          <tr>
            <th class="py-2.5 pr-2.5 pl-3.5 sm:pl-4 md:pl-6">ID Transaksi</th>
            <th class="py-2.5 px-2.5">Email Klien / Pembeli</th>
            <th class="py-2.5 px-2.5">Aplikasi</th>
            <th class="py-2.5 px-2.5">Gross</th>
            <th class="py-2.5 px-2.5">Fee (5%)</th>
            <th class="py-2.5 px-2.5">Net (95%)</th>
            <th class="py-2.5 px-2.5">Metode</th>
            <th class="py-2.5 px-2.5">Status Bayar</th>
            <th class="py-2.5 px-2.5">Waktu</th>
            <th class="py-2.5 pl-2.5 pr-3.5 sm:pr-4 md:pr-6 text-right">Aksi</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-jetblack/15 bg-white">
          <tr v-if="filteredTransactions.length === 0">
            <td colspan="10" class="py-10 px-3.5 sm:px-4 md:px-6 text-center text-jetblack/40">
              <div class="space-y-1">
                <Receipt class="w-7 h-7 mx-auto text-jetblack/30" />
                <p class="font-semibold text-xs text-jetblack/70">
                  Tidak ada riwayat transaksi ditemukan.
                </p>
                <p class="text-[11px] text-jetblack/50">
                  Coba sesuaikan kata kunci pencarian atau filter status Anda.
                </p>
              </div>
            </td>
          </tr>
          <tr
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
                <span class="font-medium text-jetblack">{{ tx.customerEmail || "-" }}</span>
                <span
                  v-if="tx.couponCode"
                  class="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-gold/15 border border-gold/30 text-[9px] font-bold text-jetblack font-mono"
                  title="Kupon Diskon Digunakan"
                >
                  <TicketPercent class="w-2.5 h-2.5" />
                  {{ tx.couponCode }}
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
                <!-- Sandbox Simulator button for pending tx -->
                <button
                  v-if="tx.paymentStatus === 'PENDING' && env === 'sandbox'"
                  @click="handleSimulate(tx.id)"
                  :disabled="isSimulating"
                  title="Simulasikan Pembayaran Lunas (Sandbox)"
                  class="px-2 py-0.5 rounded bg-gold hover:bg-gold/90 text-jetblack text-[10.5px] font-bold transition inline-flex items-center gap-1 shadow-2xs cursor-pointer active:scale-95 disabled:opacity-50"
                >
                  <Zap class="w-2.5 h-2.5 fill-current" />
                  <span>{{ isSimulating && selectedTx?.id === tx.id ? "..." : "Simulasi" }}</span>
                </button>

                <!-- Direct Link to Customer Checkout Invoice for live pending tx -->
                <a
                  v-if="tx.xenditInvoiceUrl && tx.paymentStatus === 'PENDING' && env !== 'sandbox'"
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
        </tbody>
      </table>
    </div>

    <!-- Pagination Bar -->
    <div
      class="-mx-3.5 sm:-mx-4 md:-mx-6 px-3.5 sm:px-4 md:px-6 py-2.5 border-b border-jetblack/15 bg-white flex flex-col sm:flex-row items-center justify-between gap-3 text-xs"
    >
      <div class="text-jetblack/60">
        Menampilkan
        <span class="font-semibold text-jetblack">{{
          total > 0 ? (page - 1) * limit + 1 : 0
        }}</span>
        - <span class="font-semibold text-jetblack">{{ Math.min(page * limit, total) }}</span> dari
        <span class="font-semibold text-jetblack">{{ total }}</span> transaksi
      </div>
      <div class="flex items-center gap-2">
        <button
          type="button"
          @click="prevPage"
          :disabled="page <= 1 || loading"
          class="px-3 py-1 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-jetblack transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          Sebelumnya
        </button>
        <span class="px-2 font-mono font-medium text-jetblack">
          Hal {{ page }} / {{ totalPages }}
        </span>
        <button
          type="button"
          @click="nextPage"
          :disabled="page >= totalPages || loading"
          class="px-3 py-1 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-jetblack transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          Selanjutnya
        </button>
      </div>
    </div>

    <!-- Transaction Detail Modal -->
    <div
      v-if="isDetailModalOpen && selectedTx"
      class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-fadeIn"
      @click.self="closeDetail"
    >
      <div
        class="bg-white border border-jetblack/15 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-scaleIn flex flex-col max-h-[90vh]"
      >
        <!-- Header -->
        <div
          class="px-5 py-3.5 border-b border-jetblack/10 flex items-center justify-between bg-white shrink-0"
        >
          <div class="flex items-center gap-2">
            <div class="w-2 h-2 rounded-full bg-gold"></div>
            <h3 class="text-xs font-bold uppercase tracking-wider text-jetblack">
              Rincian Transaksi Builder & MoR
            </h3>
          </div>
          <button
            type="button"
            @click="closeDetail"
            class="text-jetblack/40 hover:text-jetblack p-1 rounded-md hover:bg-jetblack/5 transition cursor-pointer"
          >
            <X class="w-4 h-4" />
          </button>
        </div>

        <!-- Body -->
        <div class="px-5 py-4 overflow-y-auto space-y-4 text-xs">
          <!-- Top Amount Card -->
          <div class="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
            <div class="flex items-center justify-between">
              <span class="text-[11px] text-jetblack/60 font-semibold">Total Nilai Pembayaran</span>
              <span
                :class="
                  selectedTx.paymentStatus === 'PAID'
                    ? 'bg-forest/10 text-forest border-forest/20'
                    : 'bg-amber-500/10 text-amber-700 border-amber-500/20'
                "
                class="text-[10px] font-bold px-2 py-0.5 rounded-full border"
              >
                {{ selectedTx.paymentStatus === "PAID" ? "LUNAS (PAID)" : "MENUNGGU PEMBAYARAN" }}
              </span>
            </div>
            <div class="text-2xl font-mono font-bold text-jetblack">
              {{ formatRupiah(selectedTx.grossAmount) }}
            </div>
            <div class="pt-2 border-t border-slate-200 grid grid-cols-2 gap-2 text-[11px]">
              <div>
                <span class="text-jetblack/50 block">Biaya MoR Tertaut (5%):</span>
                <span class="font-mono font-bold text-red-600"
                  >- {{ formatRupiah(selectedTx.platformFee) }}</span
                >
              </div>
              <div>
                <span class="text-jetblack/50 block">Net Builder (95%):</span>
                <span class="font-mono font-bold text-forest">{{
                  formatRupiah(selectedTx.netAmount)
                }}</span>
              </div>
            </div>
          </div>

          <!-- Transaction Fields Details -->
          <div class="space-y-2.5">
            <div class="flex justify-between items-center py-1 border-b border-slate-100">
              <span class="text-jetblack/60">ID Transaksi</span>
              <div class="flex items-center gap-1.5">
                <span class="font-mono font-semibold text-jetblack">{{ selectedTx.id }}</span>
                <button
                  type="button"
                  @click="copyTxId(selectedTx.id)"
                  class="p-1 rounded text-slate-400 hover:text-slate-700 transition"
                  title="Salin ID Transaksi"
                >
                  <component :is="txIdCopied ? Check : Copy" class="w-3 h-3 text-gold" />
                </button>
              </div>
            </div>
            <div class="flex justify-between py-1 border-b border-slate-100">
              <span class="text-jetblack/60">Email Klien / Pembeli</span>
              <span class="font-semibold text-jetblack">{{ selectedTx.customerEmail || "-" }}</span>
            </div>
            <div
              v-if="selectedTx.couponCode"
              class="flex justify-between py-1 border-b border-slate-100"
            >
              <span class="text-jetblack/60">Kupon Diskon</span>
              <span
                class="font-mono font-bold text-jetblack bg-gold/15 px-1.5 py-0.2 rounded border border-gold/30"
              >
                {{ selectedTx.couponCode }}
              </span>
            </div>
            <div class="flex justify-between py-1 border-b border-slate-100">
              <span class="text-jetblack/60">Aplikasi / Software</span>
              <span class="font-semibold text-jetblack">{{ getAppName(selectedTx.appId) }}</span>
            </div>
            <div class="flex justify-between py-1 border-b border-slate-100">
              <span class="text-jetblack/60">Kanal Pembayaran</span>
              <span class="font-mono font-semibold text-jetblack uppercase">{{
                selectedTx.paymentChannel || "QRIS"
              }}</span>
            </div>
            <div class="flex justify-between py-1 border-b border-slate-100">
              <span class="text-jetblack/60">Gateway / MoR Provider</span>
              <span class="font-semibold text-jetblack uppercase">{{
                selectedTx.paymentProvider || "DANA"
              }}</span>
            </div>
            <div class="flex justify-between py-1 border-b border-slate-100">
              <span class="text-jetblack/60">Status Pencairan</span>
              <span
                class="font-semibold"
                :class="
                  selectedTx.disbursementStatus === 'COMPLETED' ? 'text-forest' : 'text-slate-600'
                "
              >
                {{
                  selectedTx.disbursementStatus === "COMPLETED"
                    ? "Sudah Ditransfer"
                    : "Menunggu Pencairan"
                }}
              </span>
            </div>
            <div class="flex justify-between py-1 border-b border-slate-100">
              <span class="text-jetblack/60">Waktu Pembayaran</span>
              <span class="text-jetblack">{{
                formatDate(selectedTx.paidAt || selectedTx.createdAt)
              }}</span>
            </div>
          </div>

          <!-- Saldo info: mengarahkan ke /balances untuk tarik dana agregat -->
          <div
            v-if="
              selectedTx.paymentStatus === 'PAID' && selectedTx.disbursementStatus !== 'COMPLETED'
            "
            class="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-start gap-2.5"
          >
            <Wallet class="w-4 h-4 text-gold shrink-0 mt-0.5" />
            <div class="space-y-1">
              <div class="text-xs font-bold text-jetblack">Saldo Menunggu Penarikan</div>
              <p class="text-[11px] text-jetblack/60">
                Net builder
                <span class="font-mono font-bold text-forest">{{
                  formatRupiah(selectedTx.netAmount)
                }}</span>
                dari transaksi ini masuk ke akumulasi saldo Anda. Penarikan dana dilakukan secara
                agregat dari seluruh software di halaman Balances.
              </p>
              <router-link
                :to="envPath(env, '/balances')"
                class="inline-flex items-center gap-1.5 mt-1 text-[11px] font-bold text-jetblack hover:text-gold transition"
              >
                <ArrowUpRight class="w-3.5 h-3.5" />
                Tarik Dana di Halaman Balances
              </router-link>
            </div>
          </div>

          <!-- Sandbox Simulator Action Inside Modal -->
          <div
            v-if="env === 'sandbox' && selectedTx.paymentStatus === 'PENDING'"
            class="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-2"
          >
            <div class="flex items-center gap-1.5 text-xs font-bold text-amber-900">
              <Zap class="w-3.5 h-3.5 text-amber-600" />
              <span>Sandbox Payment Simulator (Uji Coba Pembeli)</span>
            </div>
            <p class="text-[11px] text-amber-800/80">
              Uji coba konfirmasi pembayaran klien Anda tanpa dana nyata untuk otomatis menerbitkan
              lisensi dan memverifikasi webhook.
            </p>
            <button
              type="button"
              @click="handleSimulate(selectedTx.id)"
              :disabled="isSimulating"
              class="w-full py-2 btn-gold rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw v-if="isSimulating" class="w-3.5 h-3.5 animate-spin" />
              <span>{{
                isSimulating ? "Memproses Simulasi..." : "Simulasikan Pembayaran Lunas"
              }}</span>
            </button>
            <div v-if="simulateMsg" class="text-xs font-bold text-forest text-center pt-1">
              {{ simulateMsg }}
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div
          class="px-5 py-3 border-t border-jetblack/10 bg-slate-50/70 shrink-0 flex items-center justify-end"
        >
          <button
            type="button"
            @click="closeDetail"
            class="h-8 px-4 rounded-lg border border-slate-300 hover:bg-slate-100 text-xs font-bold text-jetblack transition cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
