<script setup lang="ts">
import { ref, onMounted, computed, watch } from "vue";
import { api } from "../lib/api";
import type { TransactionItem } from "../types/transaction";
import { dashboardEnv, envPath } from "../lib/environment";
import { formatRupiah, formatDate as formatUtilsDate } from "../lib/utils";
import { AlertCircle, RefreshCw, Building2, Send, Landmark, CheckCircle2 } from "lucide-vue-next";
import TableSkeleton from "../components/common/TableSkeleton.vue";
import TableContainer from "../components/common/TableContainer.vue";
import SearchInput from "../components/common/SearchInput.vue";
import StatusBadge from "../components/common/StatusBadge.vue";
import EmptyState from "../components/common/EmptyState.vue";
import BaseModal from "../components/common/BaseModal.vue";

const env = dashboardEnv;
const loading = ref(true);
const transactions = ref<TransactionItem[]>([]);

const isPayoutModalOpen = ref(false);
const payoutAmount = ref<number>(0);
const isSubmittingPayout = ref(false);
const payoutError = ref<string | null>(null);
const payoutSuccess = ref<string | null>(null);

const disbSearchQuery = ref("");

async function loadData() {
  loading.value = true;
  try {
    const [txRes] = await Promise.all([api.getTransactions()]);
    transactions.value = txRes.transactions || [];
  } catch (err) {
    console.error("Gagal memuat data balances:", err);
  } finally {
    loading.value = false;
  }
}

const isMounted = ref(false);

onMounted(() => {
  isMounted.value = true;
  loadData();
});
watch(env, loadData);

// ── KPI ──────────────────────────────────────────────────────────
const balanceKPIs = computed(() => {
  const paidTxs = transactions.value.filter((t) => t.paymentStatus === "PAID");

  const availableTxs = paidTxs.filter(
    (t) => t.disbursementStatus === "PENDING" || !t.disbursementStatus
  );
  const availableBalance = availableTxs.reduce((acc, t) => acc + (t.netAmount || 0), 0);

  const processingTxs = paidTxs.filter((t) => t.disbursementStatus === "PROCESSING");
  const processingBalance = processingTxs.reduce((acc, t) => acc + (t.netAmount || 0), 0);

  const completedTxs = paidTxs.filter((t) => t.disbursementStatus === "COMPLETED");
  const totalPaidOut = completedTxs.reduce((acc, t) => acc + (t.netAmount || 0), 0);

  const totalFeeMoR = paidTxs.reduce((acc, t) => acc + (t.platformFee || 0), 0);

  return {
    availableBalance,
    processingBalance,
    totalPaidOut,
    totalFeeMoR,
    availableCount: availableTxs.length,
  };
});

// ── Disbursement groups (COMPLETED + PROCESSING) ──────────────────
interface DisbursementGroup {
  disbursementId: string;
  status: "COMPLETED" | "PROCESSING";
  totalNet: number;
  latestDate: string | null;
}

const disbursementGroups = computed((): DisbursementGroup[] => {
  const paidTxs = transactions.value.filter((t) => t.paymentStatus === "PAID");
  const disbursed = paidTxs.filter(
    (t) =>
      (t.disbursementStatus === "COMPLETED" || t.disbursementStatus === "PROCESSING") &&
      t.disbursementId
  );

  const map = new Map<string, DisbursementGroup>();
  for (const tx of disbursed) {
    const key = tx.disbursementId!;
    if (!map.has(key)) {
      map.set(key, {
        disbursementId: key,
        status: tx.disbursementStatus as "COMPLETED" | "PROCESSING",
        totalNet: 0,
        latestDate: null,
      });
    }
    const g = map.get(key)!;
    g.totalNet += tx.netAmount || 0;
    const d = tx.paidAt || tx.createdAt;
    if (d && (!g.latestDate || d > g.latestDate)) g.latestDate = d;
  }

  const q = disbSearchQuery.value.toLowerCase().trim();
  let groups = [...map.values()];
  if (q) {
    groups = groups.filter((g) => g.disbursementId.toLowerCase().includes(q));
  }

  return groups.sort((a, b) => {
    if (!a.latestDate) return 1;
    if (!b.latestDate) return -1;
    return b.latestDate.localeCompare(a.latestDate);
  });
});

// ── Helpers ────────────────────────────────────────────────────────
function openPayoutModal() {
  payoutAmount.value = balanceKPIs.value.availableBalance;
  payoutError.value = null;
  payoutSuccess.value = null;
  isPayoutModalOpen.value = true;
}

function closePayoutModal() {
  isPayoutModalOpen.value = false;
}

function setMaxPayout() {
  payoutAmount.value = balanceKPIs.value.availableBalance;
}

async function handleRequestPayout() {
  payoutError.value = null;
  payoutSuccess.value = null;

  if (env.value === "sandbox") {
    payoutError.value =
      "Pencairan dana nyata hanya tersedia di mode LIVE. Di mode Sandbox, saldo bersifat simulasi.";
    return;
  }

  if (payoutAmount.value < 50000) {
    payoutError.value = "Batas minimum pencairan adalah Rp 50.000.";
    return;
  }

  if (payoutAmount.value > balanceKPIs.value.availableBalance) {
    payoutError.value = "Nominal melebihi saldo tersedia yang dapat ditarik.";
    return;
  }

  isSubmittingPayout.value = true;
  try {
    const res = await api.triggerPayout(payoutAmount.value);
    if (res.success) {
      payoutSuccess.value = res.message || "Permintaan pencairan dana berhasil diproses!";
      await loadData();
      setTimeout(() => {
        closePayoutModal();
      }, 1500);
    } else {
      payoutError.value = res.error || "Gagal memproses pencairan.";
    }
  } catch (err: any) {
    payoutError.value = err?.message || "Terjadi kesalahan sistem.";
  } finally {
    isSubmittingPayout.value = false;
  }
}

function formatDate(dateStr?: string | null): string {
  return formatUtilsDate(dateStr, { includeTime: true });
}
</script>

<template>
  <div class="animate-fadeIn pb-12">
    <!-- Global Search Input Teleported to Top Header (#dashboard-header-search) -->
    <Teleport v-if="isMounted" to="#dashboard-header-search">
      <SearchInput
        v-model="disbSearchQuery"
        placeholder="Cari ID pencairan dana..."
        wrapper-class="w-full max-w-md"
        input-class="h-8 rounded-lg bg-jetblack/5 hover:bg-jetblack/8 border-jetblack/10 hover:border-jetblack/20 focus:bg-white"
      />
    </Teleport>

    <!-- Mobile Search Input Teleported to Mobile Header (#mobile-header-search) -->
    <Teleport v-if="isMounted" to="#mobile-header-search">
      <SearchInput
        v-model="disbSearchQuery"
        placeholder="Cari ID pencairan dana..."
        wrapper-class="w-full"
        input-class="h-8 rounded-lg bg-jetblack/5 border-jetblack/10 focus:bg-white"
      />
    </Teleport>

    <!-- KPI Bar -->
    <div
      class="-mx-3.5 sm:-mx-4 md:-mx-6 px-3.5 sm:px-4 md:px-6 grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 py-2.5 sm:py-3 border-b-0 mb-0 bg-white"
    >
      <div class="space-y-0.5">
        <div class="text-xs font-semibold text-jetblack/60 flex items-center gap-1.5">
          <span>Saldo Tersedia</span>
          <span
            v-if="env === 'sandbox'"
            class="text-[9px] px-1.5 rounded bg-amber-500/15 text-amber-800 font-bold uppercase"
            >Simulasi</span
          >
        </div>
        <div v-if="loading" class="space-y-1.5 py-1">
          <div class="h-7 w-28 bg-jetblack/10 rounded animate-pulse"></div>
          <div class="h-3 w-36 bg-jetblack/5 rounded animate-pulse"></div>
        </div>
        <template v-else>
          <div class="text-2xl font-bold text-jetblack font-mono tracking-tight">
            {{ formatRupiah(balanceKPIs.availableBalance) }}
          </div>
          <div class="text-[11px] text-jetblack/50 font-medium">
            Dari {{ balanceKPIs.availableCount }} penjualan · Min tarik Rp 50.000
          </div>
        </template>
      </div>

      <div class="space-y-0.5 sm:border-l sm:border-jetblack/10 sm:pl-5">
        <div class="text-xs font-semibold text-jetblack/60">Sedang Diproses</div>
        <div v-if="loading" class="space-y-1.5 py-1">
          <div class="h-7 w-28 bg-gold/15 rounded animate-pulse"></div>
          <div class="h-3 w-32 bg-gold/10 rounded animate-pulse"></div>
        </div>
        <template v-else>
          <div class="text-2xl font-bold text-gold font-mono tracking-tight">
            {{ formatRupiah(balanceKPIs.processingBalance) }}
          </div>
          <div class="text-[11px] text-jetblack/50 font-medium">Dalam antrean settlement bank</div>
        </template>
      </div>

      <div class="space-y-0.5 sm:border-l sm:border-jetblack/10 sm:pl-5">
        <div class="text-xs font-semibold text-jetblack/60">Total Telah Dicairkan</div>
        <div v-if="loading" class="space-y-1.5 py-1">
          <div class="h-7 w-28 bg-forest/15 rounded animate-pulse"></div>
          <div class="h-3 w-32 bg-forest/10 rounded animate-pulse"></div>
        </div>
        <template v-else>
          <div class="text-2xl font-bold text-forest font-mono tracking-tight">
            {{ formatRupiah(balanceKPIs.totalPaidOut) }}
          </div>
          <div class="text-[11px] text-jetblack/50 font-medium">
            {{ disbursementGroups.length }} batch transfer ke rekening
          </div>
        </template>
      </div>

      <div class="space-y-0.5 sm:border-l sm:border-jetblack/10 sm:pl-5">
        <div class="text-xs font-semibold text-jetblack/60">Fee Managed Payment (5%)</div>
        <div v-if="loading" class="space-y-1.5 py-1">
          <div class="h-7 w-28 bg-jetblack/10 rounded animate-pulse"></div>
          <div class="h-3 w-32 bg-jetblack/5 rounded animate-pulse"></div>
        </div>
        <template v-else>
          <div class="text-2xl font-bold text-jetblack font-mono tracking-tight">
            {{ formatRupiah(balanceKPIs.totalFeeMoR) }}
          </div>
          <div class="text-[11px] text-jetblack/50 font-medium">
            Biaya infrastruktur Managed Payment
          </div>
        </template>
      </div>
    </div>

    <!-- Unified Header & Toolbar -->
    <div
      class="-mx-3.5 sm:-mx-4 md:-mx-6 px-3.5 sm:px-4 md:px-6 min-h-[44px] py-1.5 sm:py-0 bg-jetblack text-white border-b border-jetblack flex items-center justify-between gap-3 overflow-x-auto no-scrollbar shadow-xs mb-0 !mt-0"
    >
      <div class="flex items-center gap-2 shrink-0">
        <Landmark class="w-3.5 h-3.5 text-gold shrink-0" />
        <span class="text-xs font-bold text-white">Riwayat Pencairan</span>
        <span
          class="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white font-mono font-bold"
        >
          {{ disbursementGroups.length }} batch
        </span>
        <span
          class="px-2 py-0.5 rounded-md font-bold text-[10px]"
          :class="env === 'sandbox' ? 'bg-gold text-jetblack' : 'bg-forest text-white'"
        >
          {{ env === "sandbox" ? "Sandbox" : "Live" }}
        </span>
      </div>

      <div class="flex items-center gap-2 shrink-0">
        <button
          @click="loadData"
          title="Segarkan"
          class="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer transition shrink-0"
        >
          <RefreshCw class="w-3.5 h-3.5" :class="{ 'animate-spin': loading }" />
        </button>

        <button
          type="button"
          @click="env === 'sandbox' ? null : openPayoutModal()"
          :disabled="env === 'sandbox'"
          :class="[
            'inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all duration-150 shadow-2xs shrink-0',
            env === 'sandbox'
              ? 'bg-white/15 text-white/40 cursor-not-allowed'
              : 'btn-gold cursor-pointer hover:scale-[1.02] active:scale-[0.98]',
          ]"
          :title="
            env === 'sandbox'
              ? 'Pencairan dana hanya tersedia di mode LIVE'
              : 'Tarik Saldo Tersedia'
          "
        >
          <Send class="w-3.5 h-3.5 stroke-[2.5]" />
          <span>{{ env === "sandbox" ? "Simulasi" : "Tarik" }}</span>
        </button>
      </div>
    </div>

    <TableContainer>
      <template #head>
        <tr>
          <th class="py-2.5 pr-3 pl-3.5 sm:pl-4 md:pl-6">ID Pencairan</th>
          <th class="py-2.5 px-3">Total Dicairkan (Net)</th>
          <th class="py-2.5 px-3">Status</th>
          <th class="py-2.5 pl-3 pr-3.5 sm:pr-4 md:pr-6 text-right">Tanggal</th>
        </tr>
      </template>

      <TableSkeleton v-if="loading" :columns="4" :rows="4" />
      <tr v-else-if="disbursementGroups.length === 0">
        <td colspan="4" class="py-10 px-3.5 sm:px-4 md:px-6">
          <EmptyState
            :icon="Landmark"
            title="Belum ada riwayat pencairan"
            description="Pencairan akan muncul di sini setelah Anda menarik saldo ke rekening bank."
            container-class="border-0 bg-transparent py-4"
          />
        </td>
      </tr>

      <tr
        v-for="group in disbursementGroups"
        :key="group.disbursementId"
        class="hover:bg-slate-50/80 transition"
      >
        <td
          class="py-2.5 pr-3 pl-3.5 sm:pl-4 md:pl-6 font-mono font-bold text-jetblack text-[11px]"
        >
          {{ group.disbursementId }}
        </td>
        <td class="py-2.5 px-3 font-mono font-bold text-forest text-xs">
          {{ formatRupiah(group.totalNet) }}
        </td>
        <td class="py-2.5 px-3">
          <StatusBadge
            :status="group.status"
            :label="group.status === 'COMPLETED' ? 'Dicairkan' : 'Diproses'"
          />
        </td>
        <td
          class="py-2.5 pl-3 pr-3.5 sm:pr-4 md:pr-6 text-right text-[11px] text-jetblack/60 font-mono"
        >
          {{ formatDate(group.latestDate) }}
        </td>
      </tr>
    </TableContainer>

    <!-- Request Payout Modal -->
    <BaseModal
      :show="isPayoutModalOpen"
      title="Permintaan Pencairan Saldo"
      max-width="max-w-md"
      @close="closePayoutModal"
    >
      <template #title-icon>
        <div class="w-2 h-2 rounded-full bg-gold"></div>
      </template>

      <form @submit.prevent="handleRequestPayout" class="divide-y divide-jetblack/10 text-xs">
        <!-- Saldo Tersedia -->
        <div class="px-5 py-3.5 bg-jetblack/[0.02] space-y-1">
          <span class="text-[11px] text-jetblack/60 font-semibold">Saldo Siap Tarik</span>
          <div class="text-2xl font-mono tracking-wider font-bold text-jetblack">
            {{ formatRupiah(balanceKPIs.availableBalance) }}
          </div>
          <p class="text-[10.5px] text-jetblack/55">
            Akumulasi net builder setelah potongan fee platform 5%.
          </p>
        </div>

        <div class="px-5 py-4 space-y-4">
          <!-- Nominal Input -->
          <div>
            <div class="flex items-center justify-between mb-1">
              <label class="block font-bold text-jetblack">Jumlah Penarikan (Rp)</label>
              <button
                type="button"
                @click="setMaxPayout"
                class="text-[11px] font-bold text-[#8a6d1f] hover:text-gold cursor-pointer"
              >
                Tarik Semua
              </button>
            </div>
            <div class="relative">
              <span
                class="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-jetblack/40"
                >Rp</span
              >
              <input
                v-model.number="payoutAmount"
                type="number"
                min="50000"
                :max="balanceKPIs.availableBalance"
                placeholder="50000"
                required
                class="w-full h-9 pl-9 pr-3 rounded-lg bg-white border border-slate-300 hover:border-slate-400 focus:border-gold focus:ring-2 focus:ring-gold/20 text-xs font-mono font-bold text-jetblack outline-none transition shadow-2xs"
              />
            </div>
            <p class="text-[10px] text-jetblack/50 mt-1">Minimal penarikan dana Rp 50.000.</p>
          </div>

          <!-- Payout Destination (Hairline Well) -->
          <div class="py-2.5 border-y border-jetblack/10 flex items-start gap-2.5">
            <Building2 class="w-4 h-4 text-gold shrink-0 mt-0.5" />
            <div>
              <div class="font-bold text-jetblack">Rekening Tujuan</div>
              <div class="text-[11px] text-jetblack/60 mt-0.5">
                Transfer diproses ke rekening bank / DANA bisnis di
                <router-link
                  :to="envPath(env, '/profile')"
                  @click="closePayoutModal"
                  class="font-bold text-jetblack underline decoration-gold underline-offset-2 hover:text-[#8a6d1f]"
                  >Profil Builder</router-link
                >
                Anda.
              </div>
            </div>
          </div>

          <div
            v-if="payoutError"
            class="p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2"
          >
            <AlertCircle class="w-4 h-4 shrink-0" />
            <span>{{ payoutError }}</span>
          </div>

          <div
            v-if="payoutSuccess"
            class="p-2.5 rounded-lg bg-forest/10 border border-forest/20 text-forest text-xs flex items-center gap-2"
          >
            <CheckCircle2 class="w-4 h-4 shrink-0" />
            <span>{{ payoutSuccess }}</span>
          </div>
        </div>

        <div class="px-5 py-3 flex items-center justify-end gap-2 bg-jetblack/[0.015]">
          <button
            type="button"
            @click="closePayoutModal"
            class="h-9 px-4 rounded-lg border border-slate-300 hover:bg-slate-100 text-xs font-bold text-jetblack transition cursor-pointer"
          >
            Batal
          </button>
          <button
            type="submit"
            :disabled="
              isSubmittingPayout || balanceKPIs.availableBalance < 50000 || payoutAmount < 50000
            "
            class="h-9 px-4 btn-gold rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 hover:scale-[1.02] active:scale-[0.98] transition-all duration-150 shadow-2xs"
          >
            <RefreshCw v-if="isSubmittingPayout" class="w-3.5 h-3.5 animate-spin" />
            <span>{{ isSubmittingPayout ? "Memproses..." : "Konfirmasi" }}</span>
          </button>
        </div>
      </form>
    </BaseModal>
  </div>
</template>
