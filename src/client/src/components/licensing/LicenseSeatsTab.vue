<script setup lang="ts">
import { Monitor, Laptop, Wifi, Box, Globe, LogOut } from "lucide-vue-next";
import type { SeatsResponse, LicenseSeatItem } from "../../types/licensing";
import CopyButton from "../common/CopyButton.vue";
import EmptyState from "../common/EmptyState.vue";
import StatusBadge from "../common/StatusBadge.vue";

defineProps<{
  seatsData: SeatsResponse | null;
  loading: boolean;
}>();

const emit = defineEmits<{
  (e: "deactivate", seat: LicenseSeatItem): void;
}>();

function fmt(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "—";
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}d lalu`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m lalu`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}j lalu`;
  const d = Math.floor(h / 24);
  return `${d}h lalu`;
}
</script>

<template>
  <div class="space-y-3">
    <!-- Loading Skeletons -->
    <div v-if="loading && (!seatsData || seatsData.seats.length === 0)" class="space-y-2.5 py-2">
      <div
        v-for="i in 2"
        :key="i"
        class="h-24 rounded-xl border border-jetblack/10 p-3 space-y-2 animate-pulse bg-jetblack/[0.02]"
      >
        <div class="flex justify-between items-center">
          <div class="h-4 w-44 bg-jetblack/10 rounded"></div>
          <div class="h-4 w-16 bg-jetblack/10 rounded-full"></div>
        </div>
        <div class="h-3 w-72 bg-jetblack/5 rounded"></div>
        <div class="h-3 w-56 bg-jetblack/5 rounded"></div>
      </div>
    </div>

    <!-- Empty State -->
    <EmptyState
      v-else-if="(seatsData?.seats?.length ?? 0) === 0"
      :icon="Monitor"
      title="Belum ada perangkat terikat"
      description="Perangkat akan otomatis terdaftar saat software klien melakukan aktivasi lisensi (hardware bind)."
      container-class="border-dashed py-8"
    />

    <!-- Seat Cards List -->
    <div v-else class="space-y-2.5">
      <div
        v-for="seat in seatsData?.seats ?? []"
        :key="seat.hwidHash"
        class="rounded-xl border border-jetblack/12 bg-white p-3.5 shadow-2xs hover:border-jetblack/25 transition space-y-3"
      >
        <!-- Card Top Row: Device Name, HWID, Lease Status, Deactivate Button -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div class="flex items-center gap-2.5 min-w-0">
            <div
              class="w-8 h-8 rounded-lg bg-jetblack/5 flex items-center justify-center text-jetblack shrink-0"
            >
              <Laptop class="w-4 h-4" />
            </div>
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <span
                  class="w-2 h-2 rounded-full shrink-0"
                  :class="seat.leaseActive ? 'bg-forest animate-pulse' : 'bg-slate-300'"
                />
                <h4 class="text-xs font-bold text-jetblack truncate">
                  {{ seat.deviceName || "Perangkat tanpa nama" }}
                </h4>
              </div>
              <div class="flex items-center gap-1.5 mt-0.5">
                <span class="text-[10px] text-jetblack/40 font-mono">HWID:</span>
                <code
                  class="text-[10px] text-jetblack/70 font-mono bg-jetblack/[0.04] px-1 py-0.2 rounded"
                >
                  {{ seat.hwidHash.substring(0, 14) }}…
                </code>
                <CopyButton
                  :text="seat.hwidHash"
                  title="Salin HWID Lengkap"
                  button-class="text-jetblack/40 hover:text-jetblack cursor-pointer p-0.5 transition"
                  icon-class="w-3 h-3"
                />
              </div>
            </div>
          </div>

          <div class="flex items-center gap-2 shrink-0 self-end sm:self-center">
            <StatusBadge
              :status="seat.leaseActive ? 'ACTIVE' : 'INACTIVE'"
              :label="seat.leaseActive ? 'LEASE AKTIF' : 'IDLE'"
            />

            <button
              type="button"
              @click="emit('deactivate', seat)"
              title="Lepas Seat Perangkat"
              class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-semibold transition cursor-pointer active:scale-95 shadow-2xs"
            >
              <LogOut class="w-3 h-3" />
              <span>Lepas Seat</span>
            </button>
          </div>
        </div>

        <!-- Card Bottom Row: Metadata Pills -->
        <div
          class="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2.5 border-t border-jetblack/8 text-[11px] font-mono text-jetblack/60 bg-jetblack/[0.015] -mx-3.5 -mb-3.5 px-3.5 py-2 rounded-b-xl"
        >
          <div class="flex items-center gap-1.5 truncate">
            <Wifi class="w-3 h-3 text-jetblack/40 shrink-0" />
            <span class="truncate"
              >Heartbeat:
              <strong class="text-jetblack font-medium">{{
                timeAgo(seat.lastHeartbeatAt)
              }}</strong></span
            >
          </div>
          <div class="flex items-center gap-1.5 truncate">
            <Box class="w-3 h-3 text-jetblack/40 shrink-0" />
            <span class="truncate"
              >Terikat:
              <strong class="text-jetblack font-medium">{{ timeAgo(seat.createdAt) }}</strong></span
            >
          </div>
          <div class="flex items-center gap-1.5 truncate">
            <Globe class="w-3 h-3 text-jetblack/40 shrink-0" />
            <span class="truncate"
              >IP:
              <strong class="text-jetblack font-medium">{{ seat.ipAddress || "—" }}</strong></span
            >
          </div>
        </div>

        <!-- Active Lease Expiry Info -->
        <div
          v-if="seat.leaseActive"
          class="text-[10px] font-mono text-[#7a641a] bg-gold/10 px-2 py-1 rounded-md"
        >
          Lease diperbarui {{ fmt(seat.lastValidatedAt) }} • berakhir {{ fmt(seat.leaseExpiresAt) }}
        </div>
      </div>
    </div>
  </div>
</template>
