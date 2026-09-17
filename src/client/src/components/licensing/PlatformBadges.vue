<script setup lang="ts">
import { Laptop, Chrome, Smartphone } from 'lucide-vue-next'
</script>

<template>
  <div class="w-full grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-[#111111]/10 border-b border-[#111111]/10 pb-4 pt-1">
    <div class="py-2 pr-0 sm:pr-4 pl-0 flex items-center gap-2.5">
      <div class="p-2 rounded-lg bg-[#D4AF37]/15 text-[#111111]">
        <Laptop class="w-4 h-4" />
      </div>
      <div>
        <div class="text-xs font-bold text-[#111111]">Desktop (Tauri/Electron)</div>
        <div class="text-[10px] text-[#111111]/60">HWID Device Seats &amp; 30D Offline JWT</div>
      </div>
    </div>

    <div class="py-2 px-0 sm:px-4 flex items-center gap-2.5">
      <div class="p-2 rounded-lg bg-[#111111]/5 text-[#111111]">
        <Chrome class="w-4 h-4" />
      </div>
      <div>
        <div class="text-xs font-bold text-[#111111]">Chrome Extensions</div>
        <div class="text-[10px] text-[#111111]/60">Device Seat &amp; HWID Binding</div>
      </div>
    </div>

    <div class="py-2 pl-0 sm:pl-4 pr-0 flex items-center gap-2.5">
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
