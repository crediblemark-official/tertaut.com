<script setup lang="ts">
import { ref, computed } from 'vue'
import { Search, Building2 } from 'lucide-vue-next'
import type { PanelBuilderItem } from '../../types'

const props = defineProps<{
  builders: PanelBuilderItem[]
}>()

const searchQuery = ref('')

const filteredBuilders = computed(() => {
  if (!searchQuery.value.trim()) return props.builders
  const q = searchQuery.value.toLowerCase().trim()
  return props.builders.filter(b => {
    const matchName = (b.name || '').toLowerCase().includes(q)
    const matchEmail = (b.email || '').toLowerCase().includes(q)
    const matchBank = (b.bankAccount?.bankName || b.disbursementAccount?.bankCode || '').toLowerCase().includes(q)
    return matchName || matchEmail || matchBank
  })
})
</script>

<template>
  <section class="space-y-4">
    <!-- Search & Info Bar -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-[#111111]/10">
      <div class="relative flex-1 max-w-sm">
        <Search class="w-3.5 h-3.5 text-[#111111]/40 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Cari nama builder, email, atau rekening..."
          class="w-full h-9 pl-8 pr-3 text-xs rounded-lg bg-white border border-slate-300/80 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/20 focus:border-[#D4AF37] shadow-2xs transition"
        />
      </div>
      <div class="text-xs text-[#111111]/60 font-medium">
        Total <strong>{{ filteredBuilders.length }}</strong> dari <strong>{{ builders.length }}</strong> builder
      </div>
    </div>

    <!-- Desktop Table (Flush left/right) -->
    <div class="overflow-x-auto w-full top-scrollbar">
      <table class="w-full text-left text-xs whitespace-nowrap">
        <thead class="border-b border-[#111111]/10 text-[#111111]/60 uppercase tracking-wider text-[10px] font-bold">
          <tr>
            <th class="py-2 pr-3 pl-0">Builder / Akun</th>
            <th class="py-2 px-3">Rekening Pencairan</th>
            <th class="py-2 px-3">Aplikasi</th>
            <th class="py-2 px-3">Total GMV</th>
            <th class="py-2 px-3">Net 95%</th>
            <th class="py-2 pl-3 pr-0 text-right">Terdaftar</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-[#111111]/5">
          <tr v-if="filteredBuilders.length === 0">
            <td colspan="6" class="py-8 text-center text-[#111111]/40">
              Tidak ada data builder ditemukan.
            </td>
          </tr>
          <tr
            v-for="b in filteredBuilders"
            :key="b.id"
            class="hover:bg-[#111111]/[0.02] transition"
          >
            <td class="py-2 pr-3 pl-0">
              <div class="font-bold text-[#111111]">{{ b.name || 'Builder' }}</div>
              <div class="text-[10px] text-[#111111]/50 font-mono">{{ b.email }}</div>
            </td>
            <td class="py-2 px-3 text-[#111111]/80">
              <div v-if="b.bankAccount || b.disbursementAccount" class="space-y-0.5">
                <div class="font-semibold text-[#111111]">
                  {{ b.bankAccount?.bankName || b.disbursementAccount?.bankCode || 'BCA' }} • {{ b.bankAccount?.accountNumber || b.disbursementAccount?.accountNumber }}
                </div>
                <div class="text-[10px] text-[#111111]/50">
                  a.n. {{ b.bankAccount?.accountHolder || b.disbursementAccount?.accountHolderName || b.name }}
                </div>
              </div>
              <span v-else class="text-[#111111]/40 italic">Belum dikonfigurasi</span>
            </td>
            <td class="py-2 px-3">
              <div class="font-bold text-[#111111]">
                {{ b.appCount ?? b.totalApps ?? (b.apps?.length || 0) }} Software
              </div>
              <div v-if="b.apps && b.apps.length > 0" class="flex flex-wrap gap-1 mt-1 max-w-xs">
                <span
                  v-for="app in b.apps"
                  :key="app.id"
                  class="inline-flex items-center px-1.5 py-0.2 rounded text-[9.5px] font-medium bg-[#111111]/5 text-[#111111]/75"
                >
                  {{ app.name }}
                </span>
              </div>
            </td>
            <td class="py-2 px-3 font-mono font-bold text-[#111111]">
              Rp {{ (b.totalSales ?? b.totalGMV ?? 0).toLocaleString('id-ID') }}
            </td>
            <td class="py-2 px-3 font-mono font-bold text-[#0F4C3A]">
              Rp {{ (b.builderNetRevenue ?? b.totalNetEarnings ?? 0).toLocaleString('id-ID') }}
            </td>
            <td class="py-2 pl-3 pr-0 text-right text-[#111111]/50 text-[11px]">
              {{ b.createdAt ? new Date(b.createdAt).toLocaleDateString('id-ID') : '-' }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
