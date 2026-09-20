<script setup lang="ts">
import { Cpu, Activity } from 'lucide-vue-next'
import type { PanelStats } from '../../types/panel'

defineProps<{
  stats: PanelStats | null
}>()

function formatUptime(seconds: number) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  return `${h}j ${m}m ${s}d`
}
</script>

<template>
  <section class="pt-2">
    <div class="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-jetblack/10 border-b border-jetblack/10 pb-6">
      <!-- Runtime Details -->
      <div class="md:pr-8 space-y-3 pb-6 md:pb-0">
        <div class="flex items-center gap-2 text-xs font-bold text-jetblack">
          <Cpu class="w-4 h-4 text-gold" />
          <span>Bun &amp; V8 Engine Runtime</span>
        </div>
        <div class="space-y-2 text-xs divide-y divide-jetblack/10">
          <div class="flex items-center justify-between pt-1">
            <span class="text-jetblack/60">Environment</span>
            <span class="font-mono font-semibold">{{ stats?.system.nodeEnv }}</span>
          </div>
          <div class="flex items-center justify-between pt-2">
            <span class="text-jetblack/60">Bun Runtime Version</span>
            <span class="font-mono font-bold text-forest">Bun {{ stats?.system.bunVersion }}</span>
          </div>
          <div class="flex items-center justify-between pt-2">
            <span class="text-jetblack/60">Process Uptime</span>
            <span class="font-mono">{{ formatUptime(stats?.system.uptimeSeconds || 0) }}</span>
          </div>
          <div class="flex items-center justify-between pt-2">
            <span class="text-jetblack/60">Total Active Licenses</span>
            <span class="font-bold text-jetblack">{{ stats?.totalLicensesIssued }} Lisensi</span>
          </div>
        </div>
      </div>

      <!-- Memory Profile -->
      <div class="md:pl-8 space-y-3 pt-6 md:pt-0">
        <div class="flex items-center gap-2 text-xs font-bold text-jetblack">
          <Activity class="w-4 h-4 text-forest" />
          <span>Penggunaan Memori (RAM)</span>
        </div>
        <div class="space-y-2 text-xs divide-y divide-jetblack/10">
          <div class="flex items-center justify-between pt-1">
            <span class="text-jetblack/60">Resident Set Size (RSS)</span>
            <span class="font-mono font-bold">{{ stats?.system.memoryUsageMB.rss }} MB</span>
          </div>
          <div class="flex items-center justify-between pt-2">
            <span class="text-jetblack/60">Heap Total</span>
            <span class="font-mono">{{ stats?.system.memoryUsageMB.heapTotal }} MB</span>
          </div>
          <div class="flex items-center justify-between pt-2">
            <span class="text-jetblack/60">Heap Terpakai (Heap Used)</span>
            <span class="font-mono text-forest font-bold">{{ stats?.system.memoryUsageMB.heapUsed }} MB</span>
          </div>
          <div class="flex items-center justify-between pt-2">
            <span class="text-jetblack/60">Status Database PostgreSQL</span>
            <span class="font-bold text-forest flex items-center gap-1">
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              Connected (Port 5432)
            </span>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
