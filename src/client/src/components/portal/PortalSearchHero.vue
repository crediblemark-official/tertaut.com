<script setup lang="ts">
import { Sparkles, Search } from 'lucide-vue-next'

const customerEmail = defineModel<string>('email', { default: '' })

defineProps<{
  loading: boolean
}>()

const emit = defineEmits<{
  (e: 'search'): void
  (e: 'prefillDemo'): void
}>()
</script>

<template>
  <section class="bg-white rounded-2xl border border-[#111111]/10 p-6 md:p-8 shadow-xs relative overflow-hidden">
    <div class="absolute -right-16 -top-16 w-56 h-56 rounded-full bg-[#D4AF37]/10 blur-3xl pointer-events-none"></div>
    <div class="absolute -left-16 -bottom-16 w-56 h-56 rounded-full bg-[#0F4C3A]/10 blur-3xl pointer-events-none"></div>

    <div class="max-w-2xl space-y-3 relative z-10">
      <div class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#111111]/5 text-[#111111]/80 text-xs font-semibold">
        <Sparkles class="w-3 h-3 text-[#D4AF37]" />
        Self-Service License &amp; Receipt Portal
      </div>
      <h1 class="text-2xl md:text-3xl font-extrabold tracking-tight text-[#111111]">
        Kelola Lisensi &amp; Pembelian Anda
      </h1>
      <p class="text-xs md:text-sm text-[#111111]/65 leading-relaxed">
        Masukkan email yang Anda gunakan saat checkout untuk melihat license key, melepas seat perangkat agar bisa dipindah ke laptop lain, dan mengunduh token lisensi offline.
      </p>

      <!-- Email Search Form -->
      <form @submit.prevent="emit('search')" class="pt-3 flex flex-col sm:flex-row items-stretch gap-2.5">
        <div class="relative flex-1">
          <Search class="w-4 h-4 text-[#111111]/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            v-model="customerEmail"
            type="email"
            required
            placeholder="nama@email.com"
            class="w-full pl-9 pr-4 py-2.5 text-xs md:text-sm rounded-xl border border-[#111111]/20 focus:border-[#111111] focus:ring-2 focus:ring-[#111111]/10 outline-none bg-white transition font-medium"
          />
        </div>
        <button
          type="submit"
          :disabled="loading"
          class="px-5 py-2.5 rounded-xl bg-[#111111] hover:bg-black text-white text-xs md:text-sm font-semibold transition flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 shrink-0 cursor-pointer"
        >
          <span v-if="loading" class="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
          <span v-else>Cari Lisensi</span>
        </button>
      </form>

      <!-- Quick Prefill Link -->
      <div class="flex items-center gap-2 text-xs text-[#111111]/50 pt-1">
        <span>Contoh email pengujian:</span>
        <button
          type="button"
          @click="emit('prefillDemo')"
          class="text-[#0F4C3A] font-semibold hover:underline flex items-center gap-1 cursor-pointer"
        >
          pembeli@tertaut.com
        </button>
      </div>
    </div>
  </section>
</template>
