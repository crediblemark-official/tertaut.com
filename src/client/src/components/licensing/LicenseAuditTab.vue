<script setup lang="ts">
import { Activity, KeyRound, Globe } from "lucide-vue-next";
import type { LicenseEventItem } from "../../types/licensing";

defineProps<{
  events: LicenseEventItem[];
  loading: boolean;
}>();

const EVENT_LABELS: Record<string, string> = {
  "license.issued": "Lisensi diterbitkan",
  "license.activated": "Perangkat diaktifkan",
  "license.deactivated": "Seat perangkat dilepas",
  "license.seat_full": "Seat penuh (aktivasi ditolak)",
  "license.revoked": "Lisensi dicabut",
  "license.reactivated": "Lisensi diaktifkan kembali",
  "license.expired": "Lisensi kadaluarsa",
  "license.renewed": "Lisensi diperpanjang",
  "license.transferred": "Lisensi dipindahkan",
};

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

function actorLabel(ev: LicenseEventItem): string {
  return ev.actorType === "CLIENT"
    ? "Perangkat Klien"
    : ev.actorType === "ADMIN"
      ? "Super Admin"
      : ev.actorType === "BUILDER"
        ? "Builder"
        : ev.actorType || "Sistem";
}

function formatPayload(payload: any): string | null {
  if (!payload) return null;
  if (typeof payload === "string") {
    try {
      const obj = JSON.parse(payload);
      const entries = Object.entries(obj);
      if (entries.length === 0) return null;
      return entries.map(([k, v]) => `${k}: ${v}`).join(" · ");
    } catch {
      return payload.length > 60 ? `${payload.substring(0, 60)}…` : payload;
    }
  }
  if (typeof payload === "object") {
    const entries = Object.entries(payload);
    if (entries.length === 0) return null;
    return entries.map(([k, v]) => `${k}: ${v}`).join(" · ");
  }
  return String(payload);
}
</script>

<template>
  <div class="space-y-3">
    <!-- Loading Skeletons -->
    <div v-if="loading && events.length === 0" class="space-y-3 py-2">
      <div v-for="i in 3" :key="i" class="flex gap-3 animate-pulse">
        <div class="w-3 h-3 rounded-full bg-jetblack/10 mt-1 shrink-0"></div>
        <div class="flex-1 space-y-1.5">
          <div class="h-4 w-36 bg-jetblack/10 rounded"></div>
          <div class="h-3 w-64 bg-jetblack/5 rounded"></div>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div
      v-else-if="events.length === 0"
      class="text-center py-10 px-4 rounded-xl border border-dashed border-jetblack/15 bg-jetblack/[0.01]"
    >
      <div
        class="w-10 h-10 rounded-full bg-jetblack/5 flex items-center justify-center mx-auto text-jetblack/40 mb-2"
      >
        <Activity class="w-5 h-5" />
      </div>
      <p class="text-xs font-bold text-jetblack">Belum ada riwayat aktivitas</p>
      <p class="text-[11px] text-jetblack/50 mt-1">
        Setiap penerbitan, aktivasi seat, heartbeat, maupun pemutusan seat akan tercatat otomatis di
        sini.
      </p>
    </div>

    <!-- Timeline Events List -->
    <div v-else class="relative border-l border-jetblack/15 ml-3 space-y-4 py-1">
      <div v-for="ev in events" :key="ev.id" class="pl-4 relative group">
        <!-- Timeline Bullet Point -->
        <span
          class="absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full border-2 border-white transition shadow-2xs"
          :class="[
            ev.event === 'license.issued'
              ? 'bg-gold ring-2 ring-gold/20'
              : ev.event === 'license.activated' || ev.event === 'license.reactivated'
                ? 'bg-forest ring-2 ring-forest/20'
                : ev.event === 'license.revoked' || ev.event === 'license.deactivated'
                  ? 'bg-crimson ring-2 ring-crimson/20'
                  : 'bg-jetblack/40',
          ]"
        />

        <!-- Event Details Card -->
        <div
          class="bg-white border border-jetblack/10 rounded-xl p-3 shadow-2xs space-y-1.5 hover:border-jetblack/20 transition"
        >
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div class="flex items-center gap-2">
              <span
                class="px-2 py-0.5 rounded-md bg-jetblack/5 text-jetblack font-mono text-[10.5px] font-bold"
              >
                {{ ev.event }}
              </span>
              <span class="text-xs font-bold text-jetblack">
                {{ EVENT_LABELS[ev.event] || ev.event }}
              </span>
            </div>
            <span class="text-[10px] text-jetblack/40 font-mono">
              {{ timeAgo(ev.createdAt) }} ({{ fmt(ev.createdAt) }})
            </span>
          </div>

          <!-- Event Meta Pills -->
          <div
            class="flex flex-wrap items-center gap-2 text-[10.5px] font-mono text-jetblack/60 pt-1"
          >
            <span class="inline-flex items-center gap-1 bg-jetblack/[0.03] px-2 py-0.5 rounded">
              <KeyRound class="w-3 h-3 text-jetblack/40" />
              {{ actorLabel(ev) }}
            </span>

            <span
              v-if="ev.ipAddress"
              class="inline-flex items-center gap-1 bg-jetblack/[0.03] px-2 py-0.5 rounded"
            >
              <Globe class="w-3 h-3 text-jetblack/40" />
              {{ ev.ipAddress }}
            </span>

            <span
              v-if="formatPayload(ev.payload)"
              class="inline-flex items-center gap-1 bg-gold/10 text-[#7a641a] px-2 py-0.5 rounded font-mono font-medium"
            >
              {{ formatPayload(ev.payload) }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
