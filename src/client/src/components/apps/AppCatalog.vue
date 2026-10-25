<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import type { AppItem, CatalogKPIStats } from "../../types/app";
import { dashboardEnv, envPath } from "../../lib/environment";
import { formatRupiah } from "../../lib/utils";
import { useConfirm } from "../../composables/useConfirm";
import {
  Plus,
  ExternalLink,
  ArrowUpRight,
  Key,
  FileText,
  Lock,
  Zap,
  Sparkles,
  Wifi,
  FlaskConical,
  CheckCircle2,
  ArrowLeftRight,
  Layers,
  Pencil,
  Receipt,
  Webhook,
  Boxes,
  Trash2,
} from "lucide-vue-next";
import TableSkeleton from "../common/TableSkeleton.vue";
import TableContainer from "../common/TableContainer.vue";
import SearchInput from "../common/SearchInput.vue";
import CopyButton from "../common/CopyButton.vue";
import EmptyState from "../common/EmptyState.vue";

const props = defineProps<{
  apps: AppItem[];
  loading: boolean;
  searchQuery: string;
  stats?: CatalogKPIStats | null;
}>();

const emit = defineEmits<{
  "update:searchQuery": [value: string];
  "open-create": [];
  "toggle-mode": [app: AppItem];
  edit: [app: AppItem];
  delete: [app: AppItem];
}>();

const isMounted = ref(false);

onMounted(() => {
  isMounted.value = true;
});

const filteredApps = computed(() => {
  if (!props.searchQuery.trim()) return props.apps;
  const q = props.searchQuery.toLowerCase().trim();
  return props.apps.filter((app) => {
    const matchName = app.name.toLowerCase().includes(q);
    const matchSlug = app.slug.toLowerCase().includes(q);
    return matchName || matchSlug;
  });
});

const activeProductsCount = computed(() => filteredApps.value.length);
const archivedProductsCount = computed(() => props.stats?.archivedProducts ?? 0);
const salesCount = computed(() => props.stats?.sales30d ?? 0);
const activeSubscriptionsCount = computed(() => props.stats?.activeSubscriptions ?? 0);
const acrossProductsCount = computed(() => (filteredApps.value.length > 0 ? 1 : 0));
const customersCount = computed(() => props.stats?.customers30d ?? 0);

const { confirm: confirmDialog } = useConfirm();

async function confirmToggleMode(app: AppItem) {
  const targetMode = app.mode === "sandbox" ? "LIVE" : "SANDBOX";
  const ok = await confirmDialog({
    title: `Ubah ke Mode ${targetMode}?`,
    message:
      app.mode === "sandbox"
        ? "Pembayaran akan menggunakan gateway produksi riil."
        : "Pembayaran akan dialihkan ke simulator testing.",
    confirmText: `Aktifkan ${targetMode}`,
    cancelText: "Batal",
    variant: app.mode === "sandbox" ? "warning" : "info",
  });
  if (ok) {
    emit("toggle-mode", app);
  }
}

function getPricingBadge(app: AppItem): string {
  if (app.pricingType === "free") return "Gratis";
  if (app.pricingType === "one_time") return "Sekali";
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
</script>

<template>
  <div>
    <!-- Global Search Input Teleported to Top Header (#dashboard-header-search) -->
    <Teleport v-if="isMounted" to="#dashboard-header-search">
      <SearchInput
        :model-value="searchQuery"
        @update:model-value="emit('update:searchQuery', $event)"
        placeholder="Cari nama project, software, slug..."
        wrapper-class="w-full max-w-md"
        input-class="h-8 rounded-lg bg-jetblack/5 hover:bg-jetblack/8 border-jetblack/10 hover:border-jetblack/20 focus:bg-white"
      />
    </Teleport>

    <!-- Mobile Search Input Teleported to Mobile Header (#mobile-header-search) -->
    <Teleport v-if="isMounted" to="#mobile-header-search">
      <SearchInput
        :model-value="searchQuery"
        @update:model-value="emit('update:searchQuery', $event)"
        placeholder="Cari nama project, software, slug..."
        wrapper-class="w-full"
        input-class="h-8 rounded-lg bg-jetblack/5 border-jetblack/10 focus:bg-white"
      />
    </Teleport>

    <!-- Product Catalog Stats KPI Bar (Flush Canvas, Creem/Polar style) -->
    <div
      class="-mx-3.5 sm:-mx-4 md:-mx-6 px-3.5 sm:px-4 md:px-6 flex overflow-x-auto no-scrollbar sm:grid sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 py-2.5 sm:py-3 border-b-0 mb-0 bg-white"
    >
      <div class="space-y-0.5 shrink-0 sm:shrink min-w-[140px] sm:min-w-0">
        <div class="text-xs font-semibold text-jetblack/60">Produk Aktif</div>
        <div v-if="loading" class="space-y-1.5 py-1">
          <div class="h-7 w-14 bg-jetblack/10 rounded animate-pulse"></div>
          <div class="h-3 w-28 bg-jetblack/5 rounded animate-pulse"></div>
        </div>
        <template v-else>
          <div class="text-2xl font-bold text-jetblack font-mono tracking-tight">
            {{ activeProductsCount }}
          </div>
          <div class="text-[11px] text-jetblack/50 font-medium">
            {{
              archivedProductsCount > 0
                ? `${archivedProductsCount} diarsipkan`
                : "Semua Produk Aktif"
            }}
          </div>
        </template>
      </div>

      <div
        class="space-y-0.5 shrink-0 sm:shrink min-w-[140px] sm:min-w-0 border-l border-jetblack/10 pl-4 sm:pl-5"
      >
        <div class="text-xs font-semibold text-jetblack/60">Penjualan</div>
        <div v-if="loading" class="space-y-1.5 py-1">
          <div class="h-7 w-14 bg-jetblack/10 rounded animate-pulse"></div>
          <div class="h-3 w-24 bg-jetblack/5 rounded animate-pulse"></div>
        </div>
        <template v-else>
          <div class="text-2xl font-bold text-jetblack font-mono tracking-tight">
            {{ salesCount }}
          </div>
          <div class="text-[11px] text-jetblack/50 font-medium">30 hari terakhir</div>
        </template>
      </div>

      <div
        class="space-y-0.5 shrink-0 sm:shrink min-w-[140px] sm:min-w-0 border-l border-jetblack/10 pl-4 sm:pl-5"
      >
        <div class="text-xs font-semibold text-jetblack/60">Langganan Aktif</div>
        <div v-if="loading" class="space-y-1.5 py-1">
          <div class="h-7 w-14 bg-jetblack/10 rounded animate-pulse"></div>
          <div class="h-3 w-28 bg-jetblack/5 rounded animate-pulse"></div>
        </div>
        <template v-else>
          <div class="text-2xl font-bold text-jetblack font-mono tracking-tight">
            {{ activeSubscriptionsCount }}
          </div>
          <div class="text-[11px] text-jetblack/50 font-medium">
            dari {{ acrossProductsCount }} produk software
          </div>
        </template>
      </div>

      <div
        class="space-y-0.5 shrink-0 sm:shrink min-w-[140px] sm:min-w-0 border-l border-jetblack/10 pl-4 sm:pl-5"
      >
        <div class="text-xs font-semibold text-jetblack/60">Pelanggan Baru</div>
        <div v-if="loading" class="space-y-1.5 py-1">
          <div class="h-7 w-14 bg-jetblack/10 rounded animate-pulse"></div>
          <div class="h-3 w-24 bg-jetblack/5 rounded animate-pulse"></div>
        </div>
        <template v-else>
          <div class="text-2xl font-bold text-jetblack font-mono tracking-tight">
            {{ customersCount }}
          </div>
          <div class="text-[11px] text-jetblack/50 font-medium">30 hari terakhir</div>
        </template>
      </div>
    </div>

    <div
      class="-mx-3.5 sm:-mx-4 md:-mx-6 px-3.5 sm:px-4 md:px-6 min-h-[44px] py-2 sm:py-0 bg-jetblack text-white border-b border-jetblack flex items-center justify-between gap-2.5 overflow-x-auto no-scrollbar shadow-xs mb-0 !mt-0"
    >
      <div class="flex items-center gap-2 shrink-0">
        <Boxes class="w-3.5 h-3.5 text-gold shrink-0" />
        <span
          class="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white font-mono font-bold"
        >
          {{ apps.length }} project
        </span>
      </div>

      <div class="flex items-center gap-2 justify-end">
        <button
          @click="emit('open-create')"
          class="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg btn-gold text-xs font-bold transition shadow-2xs cursor-pointer active:scale-95 shrink-0"
        >
          <Plus class="w-3.5 h-3.5 stroke-[3]" />
          <span>Produk Baru</span>
        </button>
      </div>
    </div>

    <!-- Table View -->
    <TableContainer>
      <template #head>
        <tr>
          <th class="py-2 pr-3 pl-3.5 sm:pl-4 md:pl-6">Nama Produk</th>
          <th class="py-2 px-3">Tipe &amp; Harga</th>
          <th class="py-2 px-3">Benefits</th>
          <th class="py-2 px-3">Status Mode</th>
          <th class="py-2 px-3">Launch Link</th>
          <th class="py-2 pl-3 pr-3.5 sm:pr-4 md:pr-6 text-right">Aksi</th>
        </tr>
      </template>

      <TableSkeleton v-if="loading" :columns="6" :rows="5" />
      <tr v-else-if="filteredApps.length === 0">
        <td colspan="6" class="py-8 px-3.5 sm:px-4 md:px-6">
          <EmptyState
            :icon="Boxes"
            title="Tidak ada produk ditemukan"
            :description="
              searchQuery
                ? 'Coba sesuaikan kata kunci pencarian.'
                : 'Belum ada produk software yang dibuat.'
            "
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
        <td class="py-2.5 pr-3 pl-3.5 sm:pl-4 md:pl-6 font-bold text-jetblack">
          <div class="flex items-center gap-2">
            <div
              class="w-7 h-7 rounded-md bg-jetblack/5 border border-jetblack/10 flex items-center justify-center shrink-0 overflow-hidden"
            >
              <img v-if="app.mediaUrl" :src="app.mediaUrl" class="w-full h-full object-cover" />
              <span v-else class="text-[11px] font-mono font-bold text-jetblack/60">{{
                app.name.charAt(0)
              }}</span>
            </div>
            <div>
              <div class="flex items-center gap-1.5">
                <span class="font-bold text-jetblack leading-tight">{{ app.name }}</span>
                <span
                  class="text-[9px] px-1.5 py-0.2 rounded font-semibold"
                  :class="
                    app.appType === 'desktop_onprem'
                      ? 'bg-gold/15 text-[#8a6d1f]'
                      : 'bg-forest/10 text-forest'
                  "
                >
                  {{ app.appType === "desktop_onprem" ? "💻 DRM" : "🚀 SaaS" }}
                </span>
              </div>
              <div class="flex items-center gap-1.5 text-[10px] text-jetblack/50 font-mono">
                <span>{{ app.slug }}</span>
                <span>•</span>
                <span class="inline-flex items-center gap-1">
                  <span>{{ app.id }}</span>
                  <CopyButton
                    :text="app.id"
                    :title="`Salin App ID: ${app.id}`"
                    button-class="text-jetblack/40 hover:text-forest transition cursor-pointer p-0"
                    icon-class="w-2.5 h-2.5"
                  />
                </span>
              </div>
            </div>
          </div>
        </td>
        <td class="py-2.5 px-3">
          <div class="flex items-center gap-1.5">
            <template
              v-if="app.appType !== 'desktop_onprem' && (!app.targetPrice || app.targetPrice === 0)"
            >
              <span class="font-bold text-forest text-[11px]"> Dinamis (S2S) </span>
              <span
                class="text-[9px] px-1.5 py-0.5 rounded font-bold uppercase bg-forest/10 text-forest"
              >
                Checkout API
              </span>
            </template>
            <template v-else>
              <span
                :class="
                  app.pricingType === 'free'
                    ? 'font-bold text-jetblack text-xs'
                    : 'font-mono font-bold text-jetblack text-xs'
                "
              >
                {{ app.pricingType === "free" ? "Gratis" : formatRupiah(app.targetPrice) }}
              </span>
              <span
                class="text-[9px] px-1.5 py-0.5 rounded font-bold uppercase"
                :class="
                  app.pricingType === 'subscription'
                    ? 'bg-forest/10 text-forest'
                    : app.pricingType === 'free'
                      ? 'bg-neutral-100 text-neutral-600'
                      : 'bg-gold/15 text-[#8a6d1f]'
                "
              >
                {{ getPricingBadge(app) }}
              </span>
            </template>
          </div>
        </td>
        <td class="py-2.5 px-3">
          <div class="flex items-center gap-1">
            <span
              v-if="app.appType === 'saas_web'"
              title="Integrasi Webhook S2S (Event-Driven)"
              class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-forest/10 text-forest border border-forest/25 text-[10px] font-semibold"
            >
              <Webhook class="w-2.5 h-2.5" />
              <span>Webhook</span>
            </span>
            <span
              v-if="app.deliveryConfig?.licenseKey?.enabled"
              title="Lisensi Software"
              class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-semibold"
            >
              <Key class="w-2.5 h-2.5" />
              <span>Lisensi</span>
            </span>
            <span
              v-if="app.deliveryConfig?.licenseKey?.floating?.enabled"
              title="Lisensi Floating: lease + heartbeat berkala"
              class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-forest/10 text-forest border border-forest/25 text-[10px] font-semibold"
            >
              <Wifi class="w-2.5 h-2.5" />
              <span>Floating</span>
            </span>
            <span
              v-if="app.deliveryConfig?.apiAccess?.enabled"
              title="Akses API & Token"
              class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-forest/10 text-forest border border-forest/20 text-[10px] font-semibold"
            >
              <Zap class="w-2.5 h-2.5" />
              <span>API</span>
            </span>
            <span
              v-if="
                app.appType !== 'saas_web' &&
                !app.deliveryConfig?.licenseKey?.enabled &&
                !app.deliveryConfig?.apiAccess?.enabled
              "
              class="text-jetblack/40 text-[10px]"
            >
              Standard
            </span>
          </div>
        </td>
        <td class="py-2.5 px-3">
          <button
            type="button"
            @click="confirmToggleMode(app)"
            :title="`Klik untuk mengubah software ini ke mode ${app.mode === 'sandbox' ? 'LIVE' : 'SANDBOX'}`"
            class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold transition hover:opacity-85 cursor-pointer shadow-2xs group"
            :class="
              app.mode === 'sandbox'
                ? 'bg-gold/15 text-[#8a6d1f] border border-gold/30 hover:bg-gold/25'
                : 'bg-forest/10 text-forest border border-forest/20 hover:bg-forest/20'
            "
          >
            <FlaskConical v-if="app.mode === 'sandbox'" class="w-3 h-3 text-gold" />
            <span v-else class="w-1.5 h-1.5 rounded-full bg-forest"></span>
            <span>{{ app.mode === "sandbox" ? "Sandbox" : "Live" }}</span>
            <ArrowLeftRight
              class="w-2.5 h-2.5 opacity-40 group-hover:opacity-100 transition ml-0.5"
            />
          </button>
        </td>
        <td class="py-2.5 px-3 font-mono text-[11px]">
          <a
            :href="`/pay/${app.slug}`"
            target="_blank"
            class="text-gold hover:underline inline-flex items-center gap-1.5"
          >
            <span>/pay/{{ app.slug }}</span>
            <span
              v-if="app.mode === 'sandbox'"
              class="text-[9px] font-sans font-semibold px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-800 border border-amber-500/30 flex items-center gap-0.5"
            >
              <FlaskConical class="w-2.5 h-2.5" />
              <span>Sandbox</span>
            </span>
            <ExternalLink class="w-2.5 h-2.5" />
          </a>
        </td>
        <td class="py-2.5 pl-3 pr-3.5 sm:pr-4 md:pr-6 text-right">
          <div class="flex items-center justify-end gap-1.5">
            <router-link
              :to="envPath(dashboardEnv, '/payments?appId=' + app.id)"
              class="inline-flex items-center gap-1 text-[11px] font-bold text-forest hover:text-forest/80 transition px-2 py-1 hover:bg-forest/5 rounded-lg"
              title="Lihat Mutasi & Transaksi Aplikasi Ini di Menu Payments"
            >
              <Receipt class="w-3 h-3 text-forest" />
              <span>Transaksi</span>
            </router-link>
            <button
              type="button"
              @click="emit('edit', app)"
              class="inline-flex items-center gap-1 text-[11px] font-bold text-jetblack/70 hover:text-jetblack transition px-2 py-1 hover:bg-jetblack/5 rounded-lg cursor-pointer"
              title="Edit Konfigurasi Produk"
            >
              <Pencil class="w-3 h-3 text-jetblack/50" />
              <span>Edit</span>
            </button>
            <button
              type="button"
              @click="emit('delete', app)"
              class="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 hover:text-rose-700 transition px-2 py-1 hover:bg-rose-50 rounded-lg cursor-pointer"
              title="Hapus Project Ini"
            >
              <Trash2 class="w-3 h-3 text-rose-500" />
              <span>Hapus</span>
            </button>
            <a
              :href="`/pay/${app.slug}`"
              target="_blank"
              class="inline-flex items-center gap-1 text-[11px] font-bold text-jetblack hover:text-gold transition px-2 py-1"
              title="Buka Halaman Kasir / Pembayaran"
            >
              <span>Buka Kasir</span>
              <ArrowUpRight class="w-3 h-3" />
            </a>
          </div>
        </td>
      </tr>
    </TableContainer>
  </div>
</template>
