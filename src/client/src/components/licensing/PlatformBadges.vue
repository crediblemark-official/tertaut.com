<script setup lang="ts">
import { Laptop, Chrome, Smartphone } from 'lucide-vue-next'
</script>

<template>
  <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
    <div class="luxury-card p-3 rounded-xl flex items-center gap-2.5">
      <div class="p-2 rounded-lg bg-[#D4AF37]/15 text-[#111111]">
        <Laptop class="w-4 h-4" />
      </div>
      <div>
        <div class="text-xs font-bold text-[#111111]">Desktop (Tauri/Electron)</div>
        <div class="text-[10px] text-[#111111]/60">HWID Device Seats &amp; 30D Offline JWT</div>
      </div>
    </div>

    <div class="luxury-card p-3 rounded-xl flex items-center gap-2.5">
      <div class="p-2 rounded-lg bg-[#111111]/5 text-[#111111]">
        <Chrome class="w-4 h-4" />
      </div>
      <div>
        <div class="text-xs font-bold text-[#111111]">Chrome Extensions</div>
        <div class="text-[10px] text-[#111111]/60">Device Seat &amp; HWID Binding</div>
      </div>
    </div>

    <div class="luxury-card p-3 rounded-xl flex items-center gap-2.5">
      <div class="p-2 rounded-lg bg-[#0F4C3A]/10 text-[#0F4C3A]">
        <Smartphone class="w-4 h-4" />
      </div>
      <div>
        <div class="text-xs font-bold text-[#111111]">Android APK</div>
        <div class="text-[10px] text-[#111111]/60">Deep-link URL scheme activation</div>
      </div>
    </div>
  </div>
</template>
