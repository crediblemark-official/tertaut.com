<script setup lang="ts">
import { ref, onMounted, computed, watch } from "vue";
import { api } from "../lib/api";
import type { AppItem } from "../types/app";
import type { LicenseItem } from "../types/licensing";
import type { TransactionItem } from "../types/transaction";
import { dashboardEnv } from "../lib/environment";
import { formatRupiah, formatDate } from "../lib/utils";
import { useConfirm } from "../composables/useConfirm";
import {
  Repeat,
  Users,
  TrendingUp,
  AlertTriangle,
  Search,
  Filter,
  RefreshCw,
  Sparkles,
  ChevronRight,
  Calendar,
  CreditCard,
  KeyRound,
  ShieldCheck,
  Ban,
} from "lucide-vue-next";
import TableSkeleton from "../components/common/TableSkeleton.vue";
import TableContainer from "../components/common/TableContainer.vue";
import TablePagination from "../components/common/TablePagination.vue";
import StatsBar from "../components/common/StatsBar.vue";
import StatItem from "../components/common/StatItem.vue";
import SearchPicker from "../components/common/SearchPicker.vue";
import SearchInput from "../components/common/SearchInput.vue";
import StatusBadge from "../components/common/StatusBadge.vue";
import CopyButton from "../components/common/CopyButton.vue";
import EmptyState from "../components/common/EmptyState.vue";
import BaseModal from "../components/common/BaseModal.vue";

export interface SubscriptionItem extends LicenseItem {
  ltv: number;
  isTrial: boolean;
  billingInterval: string;
  appName: string;
}

const env = dashboardEnv;
const loading = ref(true);
const licenses = ref<LicenseItem[]>([]);
const transactions = ref<TransactionItem[]>([]);
const appsList = ref<AppItem[]>([]);
const kpiStats = ref({
  activeCount: 0,
  activeRecurringCount: 0,
  totalCount: 0,
  monthlyEquivalent: 0,
  avgLtv: 0,
  expiringSoon: 0,
});

const page = ref(1);
const limit = ref(25);
const total = ref(0);
const hasMore = ref(false);

const searchQuery = ref("");
const selectedStatus = ref<"ALL" | "ACTIVE" | "EXPIRED" | "REVOKED">("ALL");
const selectedAppId = ref<string>("");

const selectedSub = ref<SubscriptionItem | null>(null);
const isDetailModalOpen = ref(false);
const isRevoking = ref(false);

async function loadData() {
  loading.value = true;
  try {
    const [licRes, statsRes, appRes] = await Promise.all([
      api.getLicenses({ page: page.value, limit: limit.value }),
      api.getSubscriptionStats(),
      api.getApps(),
    ]);
    licenses.value = licRes.licenses || [];
    total.value = licRes.total ?? licenses.value.length;
    hasMore.value = licRes.hasMore ?? false;
    kpiStats.value = statsRes.stats;
    appsList.value = appRes.apps || [];
  } catch (err) {
    console.error("Gagal memuat data subscriptions:", err);
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

const isMounted = ref(false);

onMounted(() => {
  isMounted.value = true;
  loadData();
});
watch(env, () => {
  page.value = 1;
  loadData();
});

function getAppName(appId: string): string {
  const app = appsList.value.find((a: AppItem) => a.id === appId);
  return app ? app.name : appId;
}

function getAppPrice(appId: string): number {
  const app = appsList.value.find((a: AppItem) => a.id === appId);
  return app?.targetPrice || 49000;
}

function getAppBillingInterval(appId: string): string {
  const app = appsList.value.find((a: AppItem) => a.id === appId);
  if (app?.pricingType !== "subscription") {
    return "Lisensi Lifetime / Sekali";
  }
  const period = app.billingPeriod;
  if (period === "daily") return "Harian";
  if (period === "weekly") return "Mingguan";
  if (period === "monthly") return "Bulanan";
  if (period === "every_3_months") return "3 Bulan";
  if (period === "every_6_months") return "6 Bulan";
  if (period === "yearly") return "Tahunan";
  if (period === "custom") return "Kustom";
  return "Berulang";
}

const subscriptionsList = computed<SubscriptionItem[]>(() => {
  return licenses.value.map((lic: LicenseItem) => {
    const ltv = lic.ltv || 0;
    const app = appsList.value.find((a: AppItem) => a.id === lic.appId);
    const isTrial = lic.isTrial === true;
    return {
      ...lic,
      ltv,
      isTrial,
      billingInterval: getAppBillingInterval(lic.appId),
      appName: getAppName(lic.appId),
    };
  });
});

const filteredSubscriptions = computed<SubscriptionItem[]>(() => {
  return subscriptionsList.value.filter((sub: SubscriptionItem) => {
    if (selectedStatus.value !== "ALL" && sub.status !== selectedStatus.value) {
      return false;
    }
    if (selectedAppId.value && selectedAppId.value !== "ALL" && sub.appId !== selectedAppId.value) {
      return false;
    }
    if (searchQuery.value.trim()) {
      const q = searchQuery.value.toLowerCase().trim();
      const matchEmail = sub.customerEmail.toLowerCase().includes(q);
      const matchKey = sub.licenseKey.toLowerCase().includes(q);
      const matchApp = sub.appName.toLowerCase().includes(q);
      if (!matchEmail && !matchKey && !matchApp) return false;
    }
    return true;
  });
});

const actionFeedback = ref<string | null>(null);

async function openDetail(sub: SubscriptionItem) {
  selectedSub.value = sub;
  isDetailModalOpen.value = true;
  transactions.value = [];
  try {
    const result = await api.getTransactions({
      appId: sub.appId,
      customerEmail: sub.customerEmail,
      limit: 50,
    });
    if (selectedSub.value?.licenseKey === sub.licenseKey)
      transactions.value = result.transactions || [];
  } catch {
    actionFeedback.value = "Gagal memuat riwayat pembayaran pelanggan";
  }
}

function closeDetail() {
  isDetailModalOpen.value = false;
  selectedSub.value = null;
}

const linkedTransactions = computed(() => {
  if (!selectedSub.value) return [];
  return transactions.value.filter((tx) => {
    return (
      tx.customerEmail.toLowerCase() === selectedSub.value?.customerEmail.toLowerCase() &&
      tx.appId === selectedSub.value?.appId
    );
  });
});

const { confirm: confirmDialog } = useConfirm();

async function handleRevoke(key: string) {
  const ok = await confirmDialog({
    title: "Cabut Lisensi?",
    message: `Akses lisensi "${key}" akan segera dihentikan.`,
    confirmText: "Cabut",
    cancelText: "Batal",
    variant: "danger",
  });
  if (!ok) return;
  isRevoking.value = true;
  actionFeedback.value = null;
  try {
    const res = await api.revokeLicense(key);
    if (res.success) {
      actionFeedback.value = `Lisensi ${key} berhasil dicabut.`;
      await loadData();
      closeDetail();
      setTimeout(() => {
        actionFeedback.value = null;
      }, 5000);
    } else {
      actionFeedback.value = `Gagal mencabut lisensi: ${res.error || "Terjadi kesalahan"}`;
    }
  } catch (err: any) {
    actionFeedback.value = `Error: ${err?.message || "Gagal mencabut lisensi"}`;
  } finally {
    isRevoking.value = false;
  }
}

function formatSubDate(dateStr?: string | null): string {
  return formatDate(dateStr, { fallback: "Masa aktif permanen" });
}
</script>

<template>
  <div class="animate-fadeIn pb-12">
    <!-- Global Search Input Teleported to Top Header (#dashboard-header-search) -->
    <Teleport v-if="isMounted" to="#dashboard-header-search">
      <SearchInput
        v-model="searchQuery"
        placeholder="Cari email, kunci, software SaaS..."
        wrapper-class="w-full max-w-md"
        input-class="h-8 rounded-lg bg-jetblack/5 hover:bg-jetblack/8 border-jetblack/10 hover:border-jetblack/20 focus:bg-white"
      />
    </Teleport>

    <!-- Mobile Search Input Teleported to Mobile Header (#mobile-header-search) -->
    <Teleport v-if="isMounted" to="#mobile-header-search">
      <SearchInput
        v-model="searchQuery"
        placeholder="Cari email, kunci, software SaaS..."
        wrapper-class="w-full"
        input-class="h-8 rounded-lg bg-jetblack/5 border-jetblack/10 focus:bg-white"
      />
    </Teleport>

    <!-- Stats KPI Bar -->
    <StatsBar borderless>
      <StatItem
        label="Langganan Aktif"
        :value="kpiStats.activeCount"
        :sublabel="`dari total ${kpiStats.totalCount} entitas langganan`"
        variant="forest"
        :loading="loading"
      />

      <StatItem
        label="Nilai Akses Aktif / Bulan"
        :value="formatRupiah(kpiStats.monthlyEquivalent)"
        sublabel="Estimasi omzet bulanan"
        bordered
        :loading="loading"
      />

      <StatItem
        label="Rata-rata Pembayaran per Pelanggan"
        :value="formatRupiah(kpiStats.avgLtv)"
        sublabel="Rata-rata LTV pelanggan"
        bordered
        :loading="loading"
      />

      <StatItem
        label="Jatuh Tempo (7 Hari)"
        :value="kpiStats.expiringSoon"
        sublabel="Masa aktif lisensi akan berakhir dalam 7 hari"
        variant="gold"
        bordered
        :loading="loading"
      />
    </StatsBar>

    <!-- Unified Header & Toolbar (Edge-to-Edge Full Width & Standardized Height) -->
    <div
      class="-mx-3.5 sm:-mx-4 md:-mx-6 px-3.5 sm:px-4 md:px-6 min-h-[44px] py-1.5 sm:py-0 bg-jetblack text-white border-b border-jetblack flex items-center justify-between gap-3 overflow-x-auto no-scrollbar shadow-xs mb-0 !mt-0"
    >
      <div class="flex items-center gap-2 shrink-0">
        <Repeat class="w-3.5 h-3.5 text-gold shrink-0" />
        <span
          class="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white font-mono font-bold"
        >
          {{ subscriptionsList.length }} subs
        </span>
        <span
          class="px-2 py-0.5 rounded-md font-bold text-[10px]"
          :class="env === 'sandbox' ? 'bg-gold text-jetblack' : 'bg-forest text-white'"
        >
          {{ env === "sandbox" ? "Sandbox" : "Live" }}
        </span>
      </div>

      <div class="flex items-center gap-2 shrink-0">
        <!-- Filter Per Project Dropdown -->
        <SearchPicker
          v-model="selectedAppId"
          :items="appsList"
          :dark="true"
          all-option-label="Semua Aplikasi"
          placeholder="Semua Aplikasi"
          search-placeholder="Cari software SaaS..."
          button-class="!h-7 !rounded-md !min-w-[150px] !text-xs"
        />

        <!-- Status Filter Pill -->
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
            @click="selectedStatus = 'ACTIVE'"
            :class="[
              'px-2 h-full rounded transition cursor-pointer flex items-center',
              selectedStatus === 'ACTIVE'
                ? 'bg-white font-bold text-jetblack'
                : 'text-white/70 hover:text-white',
            ]"
          >
            Aktif
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
          <button
            @click="selectedStatus = 'REVOKED'"
            :class="[
              'px-2 h-full rounded transition cursor-pointer flex items-center',
              selectedStatus === 'REVOKED'
                ? 'bg-white font-bold text-jetblack'
                : 'text-white/70 hover:text-white',
            ]"
          >
            Dicabut
          </button>
        </div>

        <button
          @click="loadData"
          title="Segarkan"
          class="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer transition shrink-0"
        >
          <RefreshCw class="w-3.5 h-3.5" :class="{ 'animate-spin': loading }" />
        </button>
      </div>
    </div>

    <!-- Edge-to-Edge Table -->
    <TableContainer>
      <template #head>
        <tr>
          <th class="py-2.5 pr-3 pl-3.5 sm:pl-4 md:pl-6">Pelanggan</th>
          <th class="py-2.5 px-3">Produk Software</th>
          <th class="py-2.5 px-3">Kunci Lisensi</th>
          <th class="py-2.5 px-3">Siklus</th>
          <th class="py-2.5 px-3">Total Pembayaran</th>
          <th class="py-2.5 px-3">Status</th>
          <th class="py-2.5 px-3">Jatuh Tempo</th>
          <th class="py-2.5 pl-3 pr-3.5 sm:pr-4 md:pr-6 text-right">Aksi</th>
        </tr>
      </template>

      <TableSkeleton v-if="loading" :columns="8" :rows="5" />
      <tr v-else-if="filteredSubscriptions.length === 0">
        <td colspan="8" class="py-8 px-3.5 sm:px-4 md:px-6">
          <EmptyState
            :icon="Repeat"
            title="Tidak ada langganan ditemukan"
            description="Coba sesuaikan kata kunci pencarian atau filter status."
            container-class="border-0 bg-transparent py-4"
          />
        </td>
      </tr>
      <tr
        v-else
        v-for="sub in filteredSubscriptions"
        :key="sub.id"
        class="hover:bg-slate-50/70 transition group cursor-pointer"
        @click="openDetail(sub)"
      >
        <td class="py-2.5 pr-3 pl-3.5 sm:pl-4 md:pl-6 font-medium text-jetblack">
          {{ sub.customerEmail }}
        </td>
        <td class="py-2.5 px-3">
          <span class="font-medium text-jetblack/80">{{ sub.appName }}</span>
        </td>
        <td class="py-2.5 px-3 font-mono text-[11px] text-jetblack">
          <div class="flex items-center gap-1">
            <span class="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200">
              {{ sub.licenseKey.slice(0, 10) }}...
            </span>
            <CopyButton
              :text="sub.licenseKey"
              :title="`Salin License Key: ${sub.licenseKey}`"
              icon-class="w-2.5 h-2.5"
            />
          </div>
        </td>
        <td class="py-2.5 px-3 text-jetblack/70">
          {{ sub.billingInterval }}
        </td>
        <td class="py-2.5 px-3 font-mono font-bold text-forest">
          {{ formatRupiah(sub.ltv) }}
        </td>
        <td class="py-2.5 px-3">
          <StatusBadge :status="sub.status" />
        </td>
        <td class="py-2.5 px-3 text-[11px] text-jetblack/60 font-mono">
          {{ formatSubDate(sub.expiresAt) }}
        </td>
        <td class="py-2.5 pl-3 pr-3.5 sm:pr-4 md:pr-6 text-right" @click.stop>
          <button
            type="button"
            @click="openDetail(sub)"
            class="px-2.5 py-1 rounded-md text-xs font-semibold border border-slate-300 hover:bg-jetblack hover:text-white hover:border-jetblack transition cursor-pointer"
          >
            Kelola
          </button>
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
      item-label="langganan"
      @prev="prevPage"
      @next="nextPage"
    />

    <!-- Subscription Detail Modal -->
    <BaseModal
      :show="isDetailModalOpen && !!selectedSub"
      title="Rincian Langganan & Total Pembayaran"
      max-width="max-w-lg"
      @close="closeDetail"
    >
      <template #title-icon>
        <div class="w-2 h-2 rounded-full bg-gold"></div>
      </template>

      <!-- Body -->
      <div v-if="selectedSub" class="p-5 space-y-4 text-xs">
        <!-- Top LTV Card -->
        <div class="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
          <div class="flex items-center justify-between">
            <span class="text-[11px] text-jetblack/60 font-semibold"
              >Total Nilai Seumur Hidup (Lifetime Value)</span
            >
            <StatusBadge :status="selectedSub.status" />
          </div>
          <div class="text-2xl font-mono font-bold text-forest">
            {{ formatRupiah(selectedSub.ltv) }}
          </div>
          <p class="text-[10px] text-jetblack/50">
            Total akumulasi pendapatan yang telah dibayarkan oleh pelanggan ini untuk produk
            {{ selectedSub.appName }}.
          </p>
        </div>

        <!-- Subscription Metadata -->
        <div class="space-y-2.5">
          <div class="flex justify-between py-1 border-b border-slate-100">
            <span class="text-jetblack/60">Pelanggan</span>
            <span class="font-semibold text-jetblack">{{ selectedSub.customerEmail }}</span>
          </div>
          <div class="flex justify-between py-1 border-b border-slate-100">
            <span class="text-jetblack/60">Produk</span>
            <span class="font-semibold text-jetblack">{{ selectedSub.appName }}</span>
          </div>
          <div class="flex justify-between items-center py-1 border-b border-slate-100">
            <span class="text-jetblack/60">Kunci Lisensi</span>
            <div class="flex items-center gap-1.5 font-mono font-bold text-jetblack">
              <span>{{ selectedSub.licenseKey }}</span>
              <CopyButton :text="selectedSub.licenseKey" title="Salin Kunci" />
            </div>
          </div>
          <div class="flex justify-between py-1 border-b border-slate-100">
            <span class="text-jetblack/60">Max Device Seats</span>
            <span class="font-semibold text-jetblack">{{ selectedSub.maxSeats }} Seats</span>
          </div>
          <div class="flex justify-between py-1 border-b border-slate-100">
            <span class="text-jetblack/60">Masa Berlaku</span>
            <span class="font-semibold text-jetblack">{{
              formatSubDate(selectedSub.expiresAt)
            }}</span>
          </div>
        </div>

        <!-- Linked Transactions List -->
        <div class="space-y-2">
          <div class="text-[11px] uppercase font-bold text-jetblack/70 tracking-wider">
            50 Pembayaran Terbaru Pelanggan Ini
          </div>
          <div
            v-if="linkedTransactions.length === 0"
            class="p-3 text-center text-slate-400 bg-slate-50 rounded-lg text-xs"
          >
            Belum ada transaksi tercatat.
          </div>
          <div v-else class="space-y-1.5 max-h-40 overflow-y-auto">
            <div
              v-for="tx in linkedTransactions"
              :key="tx.id"
              class="p-2 rounded-lg bg-slate-50 border border-slate-200/70 flex items-center justify-between text-xs"
            >
              <div>
                <div class="font-mono font-bold text-jetblack">{{ tx.id }}</div>
                <div class="text-[10px] text-jetblack/50">
                  {{ formatDate(tx.paidAt || tx.createdAt, { includeTime: true }) }} •
                  {{ tx.paymentChannel || "QRIS" }}
                </div>
              </div>
              <div class="text-right">
                <div class="font-mono font-bold text-forest">
                  {{ formatRupiah(tx.grossAmount) }}
                </div>
                <div class="mt-0.5">
                  <StatusBadge :status="tx.paymentStatus" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <template #footer>
        <div class="flex items-center justify-between">
          <button
            v-if="selectedSub && selectedSub.status === 'ACTIVE'"
            type="button"
            @click="handleRevoke(selectedSub.licenseKey)"
            :disabled="isRevoking"
            class="px-3 h-8 rounded-lg border border-crimson/20 bg-crimson/5 hover:bg-crimson hover:text-white text-xs font-bold text-crimson transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
          >
            <Ban class="w-3.5 h-3.5" />
            <span>{{ isRevoking ? "Mencabut..." : "Cabut Lisensi" }}</span>
          </button>
          <div v-else></div>

          <button
            type="button"
            @click="closeDetail"
            class="h-8 px-4 rounded-lg border border-slate-300 hover:bg-slate-100 text-xs font-bold text-jetblack transition cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </template>
    </BaseModal>
  </div>
</template>
