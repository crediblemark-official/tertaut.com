<script setup lang="ts">
import { Lock, Activity, ShieldCheck } from 'lucide-vue-next'
</script>

<template>
  <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
    <div class="luxury-card p-3 rounded-xl flex items-start gap-2.5">
      <div class="p-2 rounded-lg bg-[#111111]/5 text-[#111111] shrink-0">
        <Lock class="w-4 h-4" />
      </div>
      <div>
        <div class="text-xs font-bold text-[#111111]">AES-256-GCM Vault</div>
        <p class="text-[10px] text-[#111111]/60 mt-0.5">Kredensial penyedia AI terenkripsi. Bebas risiko reverse-engineer.</p>
      </div>
    </div>

    <div class="luxury-card p-3 rounded-xl flex items-start gap-2.5">
      <div class="p-2 rounded-lg bg-[#0F4C3A]/10 text-[#0F4C3A] shrink-0">
        <Activity class="w-4 h-4" />
      </div>
      <div>
        <div class="text-xs font-bold text-[#111111]">SSE Streaming Relay (&lt; 50ms)</div>
        <p class="text-[10px] text-[#111111]/60 mt-0.5">Didukung Server-Sent Events real-time dengan Bun Runtime.</p>
      </div>
    </div>

    <div class="luxury-card p-3 rounded-xl flex items-start gap-2.5">
      <div class="p-2 rounded-lg bg-[#8B0000]/10 text-[#8B0000] shrink-0">
        <ShieldCheck class="w-4 h-4" />
      </div>
      <div>
        <div class="text-xs font-bold text-[#111111]">Kill Switch &amp; JWT Binding</div>
        <p class="text-[10px] text-[#111111]/60 mt-0.5">Memutus akses otomatis jika lisensi REVOKED atau budget tercapai.</p>
      </div>
    </div>
  </div>
</template>
