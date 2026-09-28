<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useRouter, useRoute } from "vue-router";
import { api } from "../lib/api";
import type {
  PanelStats,
  PanelBuilderItem,
  PanelTransactionItem,
  PanelAppItem,
  PanelLicenseItem,
  PanelCouponItem,
  PanelAuditLogItem,
  PanelUserItem,
} from "../types/panel";
import { authClient } from "../lib/auth";
import {
  ShieldAlert,
  Building2,
  Receipt,
  Server,
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  Sliders,
  AppWindow,
  Key,
  Ticket,
  Activity,
  Users,
} from "lucide-vue-next";
import AdminSidebar from "../components/admin/AdminSidebar.vue";
import AdminTopHeader from "../components/admin/AdminTopHeader.vue";
import AdminMobileNav from "../components/admin/AdminMobileNav.vue";
import PlatformKpiCards from "../components/admin/PlatformKpiCards.vue";
import BatchPayoutBanner from "../components/admin/BatchPayoutBanner.vue";
import OverviewPreviews from "../components/admin/OverviewPreviews.vue";
import { useConfirm } from "../composables/useConfirm";

import BuilderDirectoryTable from "../components/admin/BuilderDirectoryTable.vue";
import AppsDirectoryTable from "../components/admin/AppsDirectoryTable.vue";
import GlobalLicensesTable from "../components/admin/GlobalLicensesTable.vue";
import GlobalLedgerTable from "../components/admin/GlobalLedgerTable.vue";
import GlobalCouponsTable from "../components/admin/GlobalCouponsTable.vue";
import AuditLogsTable from "../components/admin/AuditLogsTable.vue";
import UsersDirectoryTable from "../components/admin/UsersDirectoryTable.vue";
import SystemTelemetryCard from "../components/admin/SystemTelemetryCard.vue";
import PlatformSettingsCard from "../components/admin/PlatformSettingsCard.vue";

const route = useRoute();
const router = useRouter();
const session = authClient.useSession();
const adminName = computed(() => session.value?.data?.user?.name || "Administrator");
const adminEmail = computed(() => session.value?.data?.user?.email || "");
const adminInitial = computed(() => (adminName.value[0] || "A").toUpperCase());

const stats = ref<PanelStats | null>(null);
const builders = ref<PanelBuilderItem[]>([]);
const apps = ref<PanelAppItem[]>([]);
const licenses = ref<PanelLicenseItem[]>([]);
const transactions = ref<PanelTransactionItem[]>([]);
const coupons = ref<PanelCouponItem[]>([]);
const auditLogs = ref<PanelAuditLogItem[]>([]);
const users = ref<PanelUserItem[]>([]);

const loading = ref(true);
const refreshing = ref(false);

const VALID_TABS = [
  "overview",
  "builders",
  "apps",
  "licenses",
  "ledger",
  "coupons",
  "audit",
  "users",
  "system",
  "settings",
] as const;
type TabType = (typeof VALID_TABS)[number];

const activeTab = computed<TabType>({
  get() {
    const t = String(route.params.tab || "").toLowerCase() as TabType;
    return VALID_TABS.includes(t) ? t : "overview";
  },
  set(newTab) {
    const target = newTab === "overview" ? "/panel" : `/panel/${newTab}`;
    if (route.path !== target) {
      router.push(target);
    }
  },
});

// Search & Filters
const txStatusFilter = ref<string>("");
const txSearchQuery = ref<string>("");

// Batch Payout state
const isProcessingPayout = ref(false);
const payoutResult = ref<any>(null);
const alertMessage = ref<{ type: "success" | "error"; text: string } | null>(null);
let alertTimer: ReturnType<typeof setTimeout> | null = null;

function showAlert(type: "success" | "error", text: string) {
  if (alertTimer) clearTimeout(alertTimer);
  alertMessage.value = { type, text };
  alertTimer = setTimeout(() => {
    alertMessage.value = null;
    alertTimer = null;
  }, 4500);
}

onUnmounted(() => {
  if (alertTimer) {
    clearTimeout(alertTimer);
    alertTimer = null;
  }
});

async function loadAllData() {
  refreshing.value = true;
  try {
    const [statsRes, buildersRes, appsRes, licRes, txRes, cpnRes, auditRes, usersRes] =
      await Promise.all([
        api.getPanelStats(),
        api.getPanelBuilders(),
        api.getPanelApps(250),
        api.getPanelLicenses(250),
        api.getPanelTransactions(150, txStatusFilter.value || undefined),
        api.getPanelCoupons(),
        api.getPanelAuditLogs(150),
        api.getPanelUsers(200),
      ]);

    if (statsRes.success) {
      stats.value = statsRes.data;
    }
    if (buildersRes.success) {
      builders.value = buildersRes.builders;
    }
    if (appsRes.success) {
      apps.value = appsRes.apps;
    }
    if (licRes.success) {
      licenses.value = licRes.licenses;
    }
    if (txRes.success) {
      transactions.value = txRes.transactions;
    }
    if (cpnRes.success) {
      coupons.value = cpnRes.coupons;
    }
    if (auditRes.success) {
      auditLogs.value = auditRes.logs;
    }
    if (usersRes.success) {
      users.value = usersRes.users;
    }
  } catch (err: any) {
    showAlert("error", err.message || "Gagal memuat data Super Admin Panel.");
  } finally {
    loading.value = false;
    refreshing.value = false;
  }
}

const { confirm: confirmDialog } = useConfirm();

async function handleTriggerBatchPayout() {
  const count = stats.value?.pendingDisbursementsCount || 0;
  const amount = (stats.value?.pendingDisbursementsAmount || 0).toLocaleString("id-ID");
  const confirmed = await confirmDialog({
    title: "Konfirmasi Batch Payout",
    message: `Eksekusi batch payout untuk ${count} transaksi tertunda senilai Rp ${amount}?`,
    confirmText: "Ya, Eksekusi Payout",
    variant: "warning",
  });
  if (!confirmed) {
    return;
  }

  isProcessingPayout.value = true;
  payoutResult.value = null;

  try {
    const res = await api.triggerBatchPayout();
    if (res.success) {
      payoutResult.value = res;
      showAlert("success", res.message || "Batch payout berhasil dieksekusi!");
      await loadAllData();
    } else {
      showAlert("error", res.error || "Gagal memproses batch payout.");
    }
  } catch (err: any) {
    showAlert("error", err.message || "Terjadi kesalahan sistem saat mengeksekusi batch payout.");
  } finally {
    isProcessingPayout.value = false;
  }
}

async function handleLogout() {
  try {
    await authClient.signOut();
  } catch {}
  router.push("/login");
}

async function handleRefundTransaction(tx: PanelTransactionItem) {
  const confirmed = await confirmDialog({
    title: "Konfirmasi Refund Transaksi",
    message: `Kembalikan dana sebesar Rp ${tx.grossAmount.toLocaleString("id-ID")} untuk transaksi ${tx.id}? Lisensi terkait akan otomatis dicabut (REVOKED).`,
    confirmText: "Ya, Refund Transaksi",
    variant: "danger",
  });
  if (!confirmed) return;

  try {
    const res = await api.refundTransaction(tx.id, "Refund diminta oleh Super Admin");
    if (res.success) {
      showAlert("success", res.message || "Transaksi berhasil di-refund.");
      await loadAllData();
    } else {
      showAlert("error", res.error || "Gagal memproses refund.");
    }
  } catch (err: any) {
    showAlert("error", err.message || "Terjadi kesalahan saat memproses refund.");
  }
}

async function handleToggleSuspendBuilder(builderId: string) {
  const target = builders.value.find((b) => b.id === builderId);
  const actionName = target?.isSuspended ? "mengaktifkan kembali" : "membekukan";
  const confirmed = await confirmDialog({
    title: target?.isSuspended ? "Aktifkan Builder" : "Bekukan Builder",
    message: `Apakah Anda yakin ingin ${actionName} builder ${target?.name || builderId}?`,
    confirmText: target?.isSuspended ? "Ya, Aktifkan" : "Ya, Bekukan",
    variant: target?.isSuspended ? "info" : "warning",
  });
  if (!confirmed) return;

  try {
    const res = await api.toggleBuilderSuspend(builderId);
    if (res.success) {
      showAlert("success", res.message);
      await loadAllData();
    } else {
      showAlert("error", res.error || "Gagal mengubah status builder.");
    }
  } catch (err: any) {
    showAlert("error", err.message || "Terjadi kesalahan saat mengubah status builder.");
  }
}

async function handleToggleSuspendApp(appId: string) {
  const target = apps.value.find((a) => a.id === appId);
  const actionName = target?.isSuspended ? "mengaktifkan kembali" : "membekukan";
  const confirmed = await confirmDialog({
    title: target?.isSuspended ? "Aktifkan Software" : "Bekukan Software",
    message: `Apakah Anda yakin ingin ${actionName} software ${target?.name || appId}? Pembelian baru akan ${target?.isSuspended ? "diizinkan" : "ditolak"}.`,
    confirmText: target?.isSuspended ? "Ya, Aktifkan" : "Ya, Bekukan",
    variant: target?.isSuspended ? "info" : "warning",
  });
  if (!confirmed) return;

  try {
    const res = await api.toggleAppSuspend(appId);
    if (res.success) {
      showAlert("success", res.message);
      await loadAllData();
    } else {
      showAlert("error", res.error || "Gagal mengubah status software.");
    }
  } catch (err: any) {
    showAlert("error", err.message || "Terjadi kesalahan saat mengubah status software.");
  }
}

async function handleRevokeLicense(lic: PanelLicenseItem) {
  const confirmed = await confirmDialog({
    title: "Cabut Lisensi Software",
    message: `Apakah Anda yakin ingin mencabut lisensi ${lic.licenseKey} milik ${lic.customerEmail}? Token offline akan otomatis di-denylist.`,
    confirmText: "Ya, Cabut Lisensi",
    variant: "danger",
  });
  if (!confirmed) return;

  try {
    const res = await api.revokePanelLicense(lic.id, "Pencabutan manual dari Super Admin Panel");
    if (res.success) {
      showAlert("success", res.message);
      await loadAllData();
    } else {
      showAlert("error", res.error || "Gagal mencabut lisensi.");
    }
  } catch (err: any) {
    showAlert("error", err.message || "Terjadi kesalahan saat mencabut lisensi.");
  }
}

async function handleReactivateLicense(lic: PanelLicenseItem) {
  const confirmed = await confirmDialog({
    title: "Aktifkan Kembali Lisensi",
    message: `Aktifkan kembali lisensi ${lic.licenseKey} untuk ${lic.customerEmail}?`,
    confirmText: "Ya, Aktifkan",
    variant: "info",
  });
  if (!confirmed) return;

  try {
    const res = await api.reactivatePanelLicense(lic.id);
    if (res.success) {
      showAlert("success", res.message);
      await loadAllData();
    } else {
      showAlert("error", res.error || "Gagal mengaktifkan lisensi.");
    }
  } catch (err: any) {
    showAlert("error", err.message || "Terjadi kesalahan saat mengaktifkan lisensi.");
  }
}

async function handleCreateCoupon(payload: {
  code: string;
  discountPercent: number;
  maxRedemptions: number;
  expiresAt?: string;
}) {
  try {
    const res = await api.createGlobalCoupon(payload);
    if (res.success) {
      showAlert("success", res.message);
      await loadAllData();
    } else {
      showAlert("error", res.error || "Gagal membuat kupon global.");
    }
  } catch (err: any) {
    showAlert("error", err.message || "Terjadi kesalahan saat membuat kupon.");
  }
}

async function handleToggleCoupon(couponId: string) {
  try {
    const res = await api.togglePanelCoupon(couponId);
    if (res.success) {
      showAlert("success", res.message);
      await loadAllData();
    } else {
      showAlert("error", res.error || "Gagal mengubah status kupon.");
    }
  } catch (err: any) {
    showAlert("error", err.message || "Terjadi kesalahan saat mengubah status kupon.");
  }
}

async function handleDeleteCoupon(couponId: string) {
  const confirmed = await confirmDialog({
    title: "Hapus Kupon Diskon",
    message: "Apakah Anda yakin ingin menghapus kupon diskon ini secara permanen?",
    confirmText: "Ya, Hapus Kupon",
    variant: "danger",
  });
  if (!confirmed) return;

  try {
    const res = await api.deletePanelCoupon(couponId);
    if (res.success) {
      showAlert("success", res.message || "Kupon diskon berhasil dihapus.");
      await loadAllData();
    } else {
      showAlert("error", res.error || "Gagal menghapus kupon.");
    }
  } catch (err: any) {
    showAlert("error", err.message || "Terjadi kesalahan saat menghapus kupon.");
  }
}

async function handleUpdateUserRole(userId: string, role: string) {
  try {
    const res = await api.updateUserRole(userId, role);
    if (res.success) {
      showAlert("success", res.message);
      await loadAllData();
    } else {
      showAlert("error", res.error || "Gagal memperbarui role pengguna.");
    }
  } catch (err: any) {
    showAlert("error", err.message || "Terjadi kesalahan saat memperbarui role.");
  }
}

async function handleToggleUserBan(userId: string) {
  try {
    const res = await api.toggleUserBan(userId);
    if (res.success) {
      showAlert("success", res.message);
      await loadAllData();
    } else {
      showAlert("error", res.error || "Gagal mengubah status blokir pengguna.");
    }
  } catch (err: any) {
    showAlert("error", err.message || "Terjadi kesalahan saat memproses blokir.");
  }
}

const adminNavItems = computed(() => [
  {
    key: "overview",
    name: "Ringkasan Platform",
    icon: TrendingUp,
    category: "Ringkasan",
  },
  {
    key: "builders",
    name: "Direktori Builder",
    icon: Building2,
    badge: builders.value.length,
    category: "Direktori & Katalog",
  },
  {
    key: "apps",
    name: "Direktori Software",
    icon: AppWindow,
    badge: apps.value.length,
    category: "Direktori & Katalog",
  },
  {
    key: "users",
    name: "Pengguna & Akses",
    icon: Users,
    badge: users.value.length,
    category: "Direktori & Katalog",
  },
  {
    key: "ledger",
    name: "Ledger Transaksi",
    icon: Receipt,
    badge: transactions.value.length,
    category: "Operasional & Lisensi",
  },
  {
    key: "licenses",
    name: "Lisensi Software",
    icon: Key,
    badge: licenses.value.length,
    category: "Operasional & Lisensi",
  },
  {
    key: "coupons",
    name: "Kupon Diskon",
    icon: Ticket,
    badge: coupons.value.length,
    category: "Operasional & Lisensi",
  },
  {
    key: "audit",
    name: "Audit Trail & Log",
    icon: Activity,
    category: "Keamanan & Sistem",
  },
  {
    key: "system",
    name: "System & Telemetri",
    icon: Server,
    category: "Keamanan & Sistem",
  },
  {
    key: "settings",
    name: "Pengaturan Platform",
    icon: Sliders,
    category: "Keamanan & Sistem",
  },
]);

const currentNavItem = computed(() => {
  return adminNavItems.value.find((item) => item.key === activeTab.value) || adminNavItems.value[0];
});

onMounted(() => {
  loadAllData();
});
</script>

<template>
  <div
    class="min-h-screen bg-white text-jetblack flex flex-col md:flex-row font-sans pb-24 md:pb-0"
  >
    <!-- Dedicated Super Admin Sidebar -->
    <AdminSidebar
      :active-tab="activeTab"
      :admin-nav-items="adminNavItems"
      :admin-name="adminName"
      :admin-email="adminEmail"
      :admin-initial="adminInitial"
      @update:active-tab="activeTab = $event as any"
      @logout="handleLogout"
    />

    <!-- Main Content Area with Desktop Top Bar -->
    <div class="flex-1 flex flex-col min-w-0">
      <!-- Admin Top Header (Desktop & Mobile) -->
      <AdminTopHeader
        :current-nav-item="currentNavItem"
        :refreshing="refreshing"
        @refresh="loadAllData"
      />

      <!-- Main Workspace Container -->
      <main
        class="flex-1 min-w-0 px-3.5 py-4 sm:px-4 sm:py-5 md:px-6 md:py-6 overflow-y-auto w-full"
      >
        <div class="space-y-6 animate-fadeIn pb-28 md:pb-12">
          <!-- Toast Alert -->
          <div
            v-if="alertMessage"
            :class="[
              'p-3.5 rounded-lg text-xs font-semibold flex items-center justify-between shadow-xs transition',
              alertMessage.type === 'success' ? 'bg-forest text-white' : 'bg-[#B91C1C] text-white',
            ]"
          >
            <div class="flex items-center gap-2">
              <CheckCircle2
                v-if="alertMessage.type === 'success'"
                class="w-4 h-4 text-emerald-300"
              />
              <AlertTriangle v-else class="w-4 h-4 text-rose-300" />
              <span>{{ alertMessage.text }}</span>
            </div>
            <button
              @click="alertMessage = null"
              class="opacity-75 hover:opacity-100 p-1 cursor-pointer"
            >
              ✕
            </button>
          </div>

          <!-- TAB 1: OVERVIEW / RINGKASAN PLATFORM -->
          <div v-if="activeTab === 'overview'" class="space-y-6">
            <div class="flex items-center justify-between gap-3 pb-1 border-b border-jetblack/10">
              <div class="flex items-center gap-2.5">
                <h1 class="text-base font-extrabold text-jetblack">Ringkasan Ekosistem Platform</h1>
                <span
                  class="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-gold/15 text-[#8a6d1f] text-[11px] font-bold border border-gold/30"
                >
                  <ShieldAlert class="w-3 h-3 text-gold" />
                  MoR Core
                </span>
              </div>
              <span class="text-xs text-jetblack/50 font-mono"
                >Multi-Gateway MoR • 5% Platform Fee Cut</span
              >
            </div>

            <!-- Macro Platform KPI Cards Component -->
            <PlatformKpiCards :stats="stats" />

            <!-- Quick Action Banner for Batch Payout Component -->
            <BatchPayoutBanner
              :stats="stats"
              :is-processing-payout="isProcessingPayout"
              :payout-result="payoutResult"
              @trigger-payout="handleTriggerBatchPayout"
            />

            <!-- Overview Quick Previews: 2-Column Split -->
            <OverviewPreviews
              :builders="builders"
              :transactions="transactions"
              @select-tab="activeTab = $event"
            />
          </div>

          <!-- TAB 2: BUILDERS DIRECTORY -->
          <div v-else-if="activeTab === 'builders'" class="space-y-4">
            <div class="flex items-center justify-between gap-3 pb-1 border-b border-jetblack/10">
              <h1 class="text-base font-extrabold text-jetblack">Direktori Builder Terdaftar</h1>
              <span class="text-xs text-jetblack/50 font-mono"
                >{{ builders.length }} Builder Aktif</span
              >
            </div>
            <BuilderDirectoryTable
              :builders="builders"
              @toggle-suspend="handleToggleSuspendBuilder"
            />
          </div>

          <!-- TAB 3: APPS DIRECTORY -->
          <div v-else-if="activeTab === 'apps'" class="space-y-4">
            <div class="flex items-center justify-between gap-3 pb-1 border-b border-jetblack/10">
              <h1 class="text-base font-extrabold text-jetblack">
                Direktori Seluruh Software &amp; Aplikasi
              </h1>
              <span class="text-xs text-jetblack/50 font-mono"
                >{{ apps.length }} Software Tercatat</span
              >
            </div>
            <AppsDirectoryTable :apps="apps" @toggle-suspend="handleToggleSuspendApp" />
          </div>

          <!-- TAB 4: GLOBAL LICENSES -->
          <div v-else-if="activeTab === 'licenses'" class="space-y-4">
            <div class="flex items-center justify-between gap-3 pb-1 border-b border-jetblack/10">
              <h1 class="text-base font-extrabold text-jetblack">
                Manajemen Lisensi Global &amp; Anti-Piracy
              </h1>
              <span class="text-xs text-jetblack/50 font-mono"
                >{{ licenses.length }} Lisensi Terdaftar</span
              >
            </div>
            <GlobalLicensesTable
              :licenses="licenses"
              @revoke="handleRevokeLicense"
              @reactivate="handleReactivateLicense"
            />
          </div>

          <!-- TAB 5: GLOBAL LEDGER -->
          <div v-else-if="activeTab === 'ledger'" class="space-y-4">
            <div class="flex items-center justify-between gap-3 pb-1 border-b border-jetblack/10">
              <h1 class="text-base font-extrabold text-jetblack">Ledger Transaksi Global</h1>
              <span class="text-xs text-jetblack/50 font-mono"
                >{{ transactions.length }} Transaksi Tercatat</span
              >
            </div>
            <GlobalLedgerTable
              :transactions="transactions"
              v-model:status-filter="txStatusFilter"
              v-model:search-query="txSearchQuery"
              @filter-change="loadAllData"
              @refund="handleRefundTransaction"
            />
          </div>

          <!-- TAB 6: GLOBAL COUPONS -->
          <div v-else-if="activeTab === 'coupons'" class="space-y-4">
            <div class="flex items-center justify-between gap-3 pb-1 border-b border-jetblack/10">
              <h1 class="text-base font-extrabold text-jetblack">
                Kupon Diskon Global &amp; Promosi Platform
              </h1>
              <span class="text-xs text-jetblack/50 font-mono"
                >{{ coupons.length }} Kupon Aktif</span
              >
            </div>
            <GlobalCouponsTable
              :coupons="coupons"
              @create="handleCreateCoupon"
              @toggle="handleToggleCoupon"
              @delete="handleDeleteCoupon"
            />
          </div>

          <!-- TAB 7: AUDIT LOGS -->
          <div v-else-if="activeTab === 'audit'" class="space-y-4">
            <div class="flex items-center justify-between gap-3 pb-1 border-b border-jetblack/10">
              <h1 class="text-base font-extrabold text-jetblack">
                Audit Trail &amp; Log Keamanan Sistem
              </h1>
              <span class="text-xs text-jetblack/50 font-mono"
                >{{ auditLogs.length }} Aktivitas Terekam</span
              >
            </div>
            <AuditLogsTable :logs="auditLogs" @refresh="loadAllData" />
          </div>

          <!-- TAB 8: USERS DIRECTORY -->
          <div v-else-if="activeTab === 'users'" class="space-y-4">
            <div class="flex items-center justify-between gap-3 pb-1 border-b border-jetblack/10">
              <h1 class="text-base font-extrabold text-jetblack">
                Manajemen Pengguna &amp; Hak Akses
              </h1>
              <span class="text-xs text-jetblack/50 font-mono"
                >{{ users.length }} Pengguna Terdaftar</span
              >
            </div>
            <UsersDirectoryTable
              :users="users"
              :current-admin-email="adminEmail"
              @update-role="handleUpdateUserRole"
              @toggle-ban="handleToggleUserBan"
            />
          </div>

          <!-- TAB 9: SYSTEM TELEMETRY -->
          <div v-else-if="activeTab === 'system'" class="space-y-4">
            <div class="flex items-center justify-between gap-3 pb-1 border-b border-jetblack/10">
              <h1 class="text-base font-extrabold text-jetblack">
                System Health &amp; Telemetri Engine
              </h1>
              <span class="text-xs text-emerald-600 font-bold flex items-center gap-1">
                <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                All Systems Operational
              </span>
            </div>
            <SystemTelemetryCard :stats="stats" />
          </div>

          <!-- TAB 10: PLATFORM SETTINGS & MODERATION -->
          <div v-else-if="activeTab === 'settings'" class="space-y-4">
            <div class="flex items-center justify-between gap-3 pb-1 border-b border-jetblack/10">
              <h1 class="text-base font-extrabold text-jetblack">
                Pengaturan Platform &amp; Moderasi
              </h1>
            </div>
            <PlatformSettingsCard @alert="showAlert($event.type, $event.text)" />
          </div>
        </div>
      </main>
    </div>

    <!-- Mobile Bottom Navigation Bar for Admin -->
    <AdminMobileNav
      :active-tab="activeTab"
      :admin-nav-items="adminNavItems"
      @update:active-tab="activeTab = $event as any"
    />
  </div>
</template>
