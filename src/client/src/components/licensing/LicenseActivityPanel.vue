<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from "vue";
import {
  X,
  Monitor,
  Activity,
  RefreshCw,
  Wifi,
  WifiOff,
  AlertTriangle,
  Copy,
  Check,
  Calendar,
} from "lucide-vue-next";
import { api } from "../../lib/api";
import { useClipboard } from "../../composables/useClipboard";
import type {
  LicenseItem,
  SeatsResponse,
  LicenseEventItem,
  LicenseSeatItem,
} from "../../types/licensing";
import { useConfirm } from "../../composables/useConfirm";
import LicenseSeatsTab from "./LicenseSeatsTab.vue";
import LicenseAuditTab from "./LicenseAuditTab.vue";

const props = defineProps<{
  license: LicenseItem | null;
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "deactivateSeat", key: string, hwid: string): void;
}>();

const tab = ref<"seats" | "audit">("seats");
const loadingSeats = ref(false);
const loadingEvents = ref(false);
const seatsData = ref<SeatsResponse | null>(null);
const events = ref<LicenseEventItem[]>([]);
const errorMsg = ref<string | null>(null);
let pollTimer: ReturnType<typeof setInterval> | null = null;

const { copied: keyCopied, copy: copyKey } = useClipboard();
const { confirm: confirmDialog } = useConfirm();

async function loadSeats() {
  if (!props.license) return;
  loadingSeats.value = true;
  errorMsg.value = null;
  try {
    const res = await api.getLicenseSeats(props.license.licenseKey);
    if (res.success) {
      seatsData.value = res;
    } else {
      errorMsg.value = "Gagal memuat data seats.";
    }
  } catch (e: any) {
    errorMsg.value = `Error: ${e?.message || "Terjadi kesalahan"}`;
  } finally {
    loadingSeats.value = false;
  }
}

async function loadEvents() {
  if (!props.license) return;
  loadingEvents.value = true;
  try {
    const res = await api.getLicenseEvents({ licenseKey: props.license.licenseKey, limit: 50 });
    if (res.success) {
      events.value = res.events || [];
    }
  } catch (e: any) {
    console.error(e);
  } finally {
    loadingEvents.value = false;
  }
}

function switchTab(t: "seats" | "audit") {
  tab.value = t;
  if (t === "seats") loadSeats();
  else loadEvents();
}

async function handleDeactivate(seat: LicenseSeatItem) {
  if (!props.license) return;
  if (seat.leaseActive) {
    const ok = await confirmDialog({
      title: "Lepas Seat & Floating Lease?",
      message:
        "Perangkat ini masih memegang lease floating aktif. Lepas seat sekaligus melepas lease perangkat ini?",
      confirmText: "Lepas Seat",
      cancelText: "Batal",
      variant: "danger",
    });
    if (!ok) return;
  }
  emit("deactivateSeat", props.license.licenseKey, seat.hwidHash);
  await loadSeats();
}

function fmt(iso: string | null | undefined): string {
  if (!iso) return "Permanen (Lifetime)";
  return new Date(iso).toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

watch(
  () => props.license,
  (val) => {
    if (!val) return;
    errorMsg.value = null;
    loadSeats();
  },
  { immediate: true }
);

onMounted(() => {
  if (props.license) loadSeats();
  pollTimer = setInterval(() => {
    if (props.license && tab.value === "seats" && !document.hidden) loadSeats();
  }, 15000);
});

onUnmounted(() => {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
});
</script>

<template>
  <div
    v-if="license"
    class="fixed inset-0 bg-jetblack/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 animate-fadeIn"
    @click.self="emit('close')"
  >
    <div
      class="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl border border-jetblack/15 animate-scaleIn overflow-hidden"
    >
      <!-- Header (Dark Luxury Header) -->
      <div
        class="px-5 py-3.5 bg-jetblack text-white flex items-center justify-between gap-3 shrink-0"
      >
        <div class="min-w-0">
          <div class="flex items-center gap-2">
            <div class="w-6 h-6 rounded-md bg-gold/15 flex items-center justify-center text-gold">
              <Activity class="w-3.5 h-3.5" />
            </div>
            <h3 class="text-xs font-bold uppercase tracking-wider text-white">Detail Lisensi</h3>
          </div>
          <div class="flex items-center gap-2 mt-1">
            <div
              class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-white/10 text-white font-mono text-[11px] font-bold"
            >
              <span>{{ license.licenseKey }}</span>
              <button
                type="button"
                @click="copyKey(license.licenseKey)"
                class="text-white/60 hover:text-gold cursor-pointer transition"
                title="Salin Kunci Lisensi"
              >
                <Check v-if="keyCopied" class="w-3 h-3 text-emerald-400" />
                <Copy v-else class="w-3 h-3" />
              </button>
            </div>
            <span class="text-white/30 text-xs">•</span>
            <span class="text-xs text-white/70 truncate">{{ license.customerEmail }}</span>
          </div>
        </div>

        <button
          type="button"
          @click="emit('close')"
          class="text-white/50 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition cursor-pointer shrink-0"
          title="Tutup Modal"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Tabs Bar & Action Toolbar (Integrated Segarkan Button) -->
      <div
        class="flex items-center justify-between border-b border-jetblack/10 px-5 bg-white shrink-0"
      >
        <div class="flex gap-6">
          <button
            type="button"
            @click="switchTab('seats')"
            :class="[
              'py-3 text-xs font-bold transition cursor-pointer relative flex items-center gap-2',
              tab === 'seats' ? 'text-jetblack' : 'text-jetblack/40 hover:text-jetblack/70',
            ]"
          >
            <Monitor
              class="w-3.5 h-3.5"
              :class="tab === 'seats' ? 'text-gold' : 'text-jetblack/40'"
            />
            <span>Seat Perangkat</span>
            <span
              class="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold"
              :class="
                tab === 'seats' ? 'bg-gold/20 text-jetblack' : 'bg-jetblack/5 text-jetblack/50'
              "
            >
              {{ seatsData?.seatsUsed ?? license.seatsUsed ?? 0 }} / {{ license.maxSeats }}
            </span>
            <span v-if="tab === 'seats'" class="absolute left-0 right-0 -bottom-px h-0.5 bg-gold" />
          </button>

          <button
            type="button"
            @click="switchTab('audit')"
            :class="[
              'py-3 text-xs font-bold transition cursor-pointer relative flex items-center gap-2',
              tab === 'audit' ? 'text-jetblack' : 'text-jetblack/40 hover:text-jetblack/70',
            ]"
          >
            <Activity
              class="w-3.5 h-3.5"
              :class="tab === 'audit' ? 'text-gold' : 'text-jetblack/40'"
            />
            <span>Audit Trail</span>
            <span
              v-if="events.length > 0"
              class="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-jetblack/5 text-jetblack/60"
            >
              {{ events.length }}
            </span>
            <span v-if="tab === 'audit'" class="absolute left-0 right-0 -bottom-px h-0.5 bg-gold" />
          </button>
        </div>

        <!-- Integrated Segarkan Button -->
        <button
          type="button"
          @click="tab === 'seats' ? loadSeats() : loadEvents()"
          :disabled="tab === 'seats' ? loadingSeats : loadingEvents"
          class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-jetblack/5 hover:bg-jetblack/10 text-xs font-semibold text-jetblack transition cursor-pointer disabled:opacity-50"
          title="Segarkan data terbaru"
        >
          <RefreshCw
            class="w-3 h-3 text-jetblack/70"
            :class="{ 'animate-spin': tab === 'seats' ? loadingSeats : loadingEvents }"
          />
          <span class="text-[11px] hidden sm:inline">Segarkan</span>
        </button>
      </div>

      <!-- Body Content -->
      <div class="flex-1 overflow-y-auto p-5 space-y-4">
        <!-- Structured License Status Strip -->
        <div
          class="bg-jetblack/[0.02] border border-jetblack/10 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2.5 text-xs"
        >
          <div class="flex flex-wrap items-center gap-2">
            <!-- Status Badge -->
            <span
              class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold"
              :class="[
                license.status === 'ACTIVE'
                  ? 'bg-forest/10 text-forest'
                  : license.status === 'REVOKED'
                    ? 'bg-crimson/10 text-crimson'
                    : 'bg-jetblack/10 text-jetblack/60',
              ]"
            >
              <span
                class="w-1.5 h-1.5 rounded-full"
                :class="license.status === 'ACTIVE' ? 'bg-forest' : 'bg-crimson'"
              />
              {{ license.status }}
            </span>

            <!-- Seat Quota Badge -->
            <span
              class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white border border-jetblack/10 text-[11px] font-mono font-bold text-jetblack shadow-2xs"
            >
              <Monitor class="w-3 h-3 text-gold" />
              {{ seatsData?.seatsUsed ?? license.seatsUsed ?? 0 }} / {{ license.maxSeats }} Seat
            </span>

            <!-- Mode Badge -->
            <span
              v-if="seatsData?.floating"
              class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-gold/15 text-[#7a641a] text-[11px] font-bold"
            >
              <Wifi class="w-3 h-3 text-gold" /> Floating (TTL
              {{ seatsData.leaseTtlSeconds ?? "—" }}s)
            </span>
            <span
              v-else
              class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white border border-jetblack/10 text-jetblack/60 text-[11px] font-medium shadow-2xs"
            >
              <WifiOff class="w-3 h-3 text-jetblack/40" /> Fixed Hardware Lock
            </span>
          </div>

          <!-- Expiry Info -->
          <div class="flex items-center gap-1.5 text-[11px] text-jetblack/60 font-mono">
            <Calendar class="w-3.5 h-3.5 text-jetblack/40" />
            <span
              >Masa Aktif:
              <strong class="text-jetblack font-bold">{{ fmt(license.expiresAt) }}</strong></span
            >
          </div>
        </div>

        <!-- Error Feedback Banner -->
        <div
          v-if="errorMsg"
          class="p-3 rounded-xl bg-crimson/10 border border-crimson/20 text-crimson text-xs font-bold flex items-center gap-2 animate-fadeIn"
        >
          <AlertTriangle class="w-4 h-4 shrink-0" />
          <span>{{ errorMsg }}</span>
        </div>

        <!-- TAB 1: SEAT PERANGKAT -->
        <LicenseSeatsTab
          v-if="tab === 'seats'"
          :seats-data="seatsData"
          :loading="loadingSeats"
          @deactivate="handleDeactivate"
        />

        <!-- TAB 2: AUDIT TRAIL -->
        <LicenseAuditTab v-else-if="tab === 'audit'" :events="events" :loading="loadingEvents" />
      </div>

      <!-- Footer Bar -->
      <div
        class="px-5 py-3 border-t border-jetblack/10 bg-slate-50/70 flex items-center justify-between shrink-0"
      >
        <span class="text-[11px] text-jetblack/50 inline-flex items-center gap-1.5">
          <span class="w-2 h-2 rounded-full bg-forest animate-pulse"></span>
          <span>Refresh otomatis tiap 15 detik untuk data Seat.</span>
        </span>

        <button
          type="button"
          @click="emit('close')"
          class="px-4 py-1.5 rounded-lg bg-jetblack hover:bg-jetblack-hover text-white text-xs font-bold transition shadow-xs cursor-pointer active:scale-95"
        >
          Tutup
        </button>
      </div>
    </div>
  </div>
</template>
