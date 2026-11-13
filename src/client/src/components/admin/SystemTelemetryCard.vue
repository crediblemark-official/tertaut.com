<script setup lang="ts">
import { Cpu, Activity } from "lucide-vue-next";
import type { PanelStats } from "../../types/panel";

defineProps<{
  stats: PanelStats | null;
}>();

function formatUptime(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${h}j ${m}m ${s}d`;
}
</script>

<template>
  <section class="-mx-3.5 sm:-mx-4 md:-mx-6">
    <!-- Obsidian Toolbar -->
    <div
      class="px-3.5 sm:px-4 md:px-6 min-h-[44px] py-1.5 sm:py-0 bg-jetblack text-white border-b border-jetblack flex items-center justify-between gap-3"
    >
      <div class="flex items-center gap-2 shrink-0">
        <Cpu class="w-3.5 h-3.5 text-gold" />
        <span class="text-xs font-bold text-white uppercase tracking-wider">
          Telemetri &amp; Runtime Sistem
        </span>
      </div>
      <div
        class="flex items-center gap-1.5 text-[11px] font-mono text-emerald-300 font-bold shrink-0"
      >
        <span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
        <span>PostgreSQL Connected</span>
      </div>
    </div>

    <div
      class="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-jetblack/10 border-b border-jetblack/10"
    >
      <!-- Runtime Details -->
      <div class="px-3.5 sm:px-4 md:px-6 py-4 space-y-3">
        <div
          class="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-jetblack"
        >
          <Cpu class="w-3.5 h-3.5 text-gold" />
          <span>Bun &amp; V8 Engine Runtime</span>
        </div>
        <div class="text-xs divide-y divide-jetblack/10">
          <div class="flex items-center justify-between py-2.5">
            <span class="text-jetblack/60">Environment</span>
            <span class="font-mono font-semibold">{{ stats?.system.nodeEnv }}</span>
          </div>
          <div class="flex items-center justify-between py-2.5">
            <span class="text-jetblack/60">Bun Runtime Version</span>
            <span class="font-mono font-bold text-forest">Bun {{ stats?.system.bunVersion }}</span>
          </div>
          <div class="flex items-center justify-between py-2.5">
            <span class="text-jetblack/60">Process Uptime</span>
            <span class="font-mono">{{ formatUptime(stats?.system.uptimeSeconds || 0) }}</span>
          </div>
          <div class="flex items-center justify-between py-2.5">
            <span class="text-jetblack/60">Total Active Licenses</span>
            <span class="font-bold text-jetblack">{{ stats?.totalLicensesIssued }} Lisensi</span>
          </div>
        </div>
      </div>

      <!-- Memory Profile -->
      <div class="px-3.5 sm:px-4 md:px-6 py-4 space-y-3">
        <div
          class="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-jetblack"
        >
          <Activity class="w-3.5 h-3.5 text-forest" />
          <span>Penggunaan Memori (RAM)</span>
        </div>
        <div class="text-xs divide-y divide-jetblack/10">
          <div class="flex items-center justify-between py-2.5">
            <span class="text-jetblack/60">Resident Set Size (RSS)</span>
            <span class="font-mono font-bold">{{ stats?.system.memoryUsageMB.rss }} MB</span>
          </div>
          <div class="flex items-center justify-between py-2.5">
            <span class="text-jetblack/60">Heap Total</span>
            <span class="font-mono">{{ stats?.system.memoryUsageMB.heapTotal }} MB</span>
          </div>
          <div class="flex items-center justify-between py-2.5">
            <span class="text-jetblack/60">Heap Terpakai (Heap Used)</span>
            <span class="font-mono text-forest font-bold"
              >{{ stats?.system.memoryUsageMB.heapUsed }} MB</span
            >
          </div>
          <div class="flex items-center justify-between py-2.5">
            <span class="text-jetblack/60">Status Database PostgreSQL</span>
            <span class="font-bold text-forest flex items-center gap-1.5">
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              Connected (Port 5432)
            </span>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
