<script setup lang="ts">
import { Cpu, Activity } from 'lucide-vue-next'
import type { PanelStats } from '../../types'

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
  <section class="space-y-4">
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <!-- Runtime Details -->
      <div class="bg-white rounded-2xl border border-[#111111]/10 p-5 space-y-3">
        <div class="flex items-center gap-2 text-xs font-bold text-[#111111]">
          <Cpu class="w-4 h-4 text-[#D4AF37]" />
          <span>Bun &amp; V8 Engine Runtime</span>
        </div>
        <div class="space-y-2 text-xs divide-y divide-[#111111]/5">
          <div class="flex items-center justify-between pt-1">
            <span class="text-[#111111]/60">Environment</span>
            <span class="font-mono font-semibold">{{ stats?.system.nodeEnv }}</span>
          </div>
          <div class="flex items-center justify-between pt-2">
            <span class="text-[#111111]/60">Bun Runtime Version</span>
            <span class="font-mono font-bold text-[#0F4C3A]">Bun {{ stats?.system.bunVersion }}</span>
          </div>
          <div class="flex items-center justify-between pt-2">
            <span class="text-[#111111]/60">Process Uptime</span>
            <span class="font-mono">{{ formatUptime(stats?.system.uptimeSeconds || 0) }}</span>
          </div>
          <div class="flex items-center justify-between pt-2">
            <span class="text-[#111111]/60">Total Active Licenses</span>
            <span class="font-bold text-[#111111]">{{ stats?.totalLicensesIssued }} Lisensi</span>
          </div>
        </div>
      </div>

      <!-- Memory Profile -->
      <div class="bg-white rounded-2xl border border-[#111111]/10 p-5 space-y-3">
        <div class="flex items-center gap-2 text-xs font-bold text-[#111111]">
          <Activity class="w-4 h-4 text-[#0F4C3A]" />
          <span>Penggunaan Memori (RAM)</span>
        </div>
        <div class="space-y-2 text-xs divide-y divide-[#111111]/5">
          <div class="flex items-center justify-between pt-1">
            <span class="text-[#111111]/60">Resident Set Size (RSS)</span>
            <span class="font-mono font-bold">{{ stats?.system.memoryUsageMB.rss }} MB</span>
          </div>
          <div class="flex items-center justify-between pt-2">
            <span class="text-[#111111]/60">Heap Total</span>
            <span class="font-mono">{{ stats?.system.memoryUsageMB.heapTotal }} MB</span>
          </div>
          <div class="flex items-center justify-between pt-2">
            <span class="text-[#111111]/60">Heap Terpakai (Heap Used)</span>
            <span class="font-mono text-[#0F4C3A] font-bold">{{ stats?.system.memoryUsageMB.heapUsed }} MB</span>
          </div>
          <div class="flex items-center justify-between pt-2">
            <span class="text-[#111111]/60">Status Database PostgreSQL</span>
            <span class="font-bold text-[#0F4C3A] flex items-center gap-1">
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              Connected (Port 5432)
            </span>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
