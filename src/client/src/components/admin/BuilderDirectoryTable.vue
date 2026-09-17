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
    <div class="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-[#111111]/10">
      <div class="relative flex-1 w-full">
        <Search class="w-3.5 h-3.5 text-[#111111]/40 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Cari builder berdasarkan nama, email, atau rekening bank..."
          class="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-[#111111]/15 focus:border-[#111111] outline-none"
        />
      </div>
      <div class="text-xs text-[#111111]/60 font-medium">
        Menampilkan <strong>{{ filteredBuilders.length }}</strong> dari <strong>{{ builders.length }}</strong> builder
      </div>
    </div>

    <div
      v-if="filteredBuilders.length === 0"
      class="p-8 text-center bg-white rounded-2xl border border-[#111111]/10 text-xs text-[#111111]/60 space-y-2"
    >
      <div class="w-10 h-10 rounded-full bg-[#111111]/5 mx-auto flex items-center justify-center text-[#111111]/40">
        <Building2 class="w-5 h-5" />
      </div>
      <div class="font-bold text-[#111111]">Tidak Ada Data Builder Ditemukan</div>
      <p>Coba kata kunci pencarian yang lain.</p>
    </div>

    <div v-else class="bg-white rounded-2xl border border-[#111111]/10 overflow-hidden shadow-xs">
      <div class="overflow-x-auto top-scrollbar">
        <table class="w-full text-left text-xs border-collapse whitespace-nowrap">
          <thead>
            <tr class="bg-[#FAFAFA] border-b border-[#111111]/10 text-[#111111]/60 uppercase tracking-wider text-[10px]">
              <th class="py-3 px-4 font-bold">Builder / Akun</th>
              <th class="py-3 px-4 font-bold">Rekening Pencairan (Xendit)</th>
              <th class="py-3 px-4 font-bold">Portfolio Software</th>
              <th class="py-3 px-4 font-bold">Total GMV Penjualan</th>
              <th class="py-3 px-4 font-bold">Net Earnings (95%)</th>
              <th class="py-3 px-4 font-bold text-right">Terdaftar</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-[#111111]/5">
            <tr
              v-for="b in filteredBuilders"
              :key="b.id"
              class="hover:bg-[#111111]/2 transition"
            >
              <td class="py-3.5 px-4 font-medium">
                <div class="font-bold text-[#111111]">{{ b.name || 'Builder' }}</div>
                <div class="text-[11px] text-[#111111]/50 font-mono">{{ b.email }}</div>
              </td>
              <td class="py-3.5 px-4 text-[#111111]/80">
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
              <td class="py-3.5 px-4">
                <div class="font-bold text-[#111111]">
                  {{ b.appCount ?? b.totalApps ?? (b.apps?.length || 0) }} Software
                </div>
                <div v-if="b.apps && b.apps.length > 0" class="flex flex-wrap gap-1 mt-1.5 max-w-xs">
                  <span
                    v-for="app in b.apps"
                    :key="app.id"
                    class="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium bg-[#111111]/5 text-[#111111]/75 border border-[#111111]/10"
                  >
                    {{ app.name }}
                  </span>
                </div>
              </td>
              <td class="py-3.5 px-4 font-mono font-bold text-[#111111]">
                Rp {{ (b.totalSales ?? b.totalGMV ?? 0).toLocaleString('id-ID') }}
              </td>
              <td class="py-3.5 px-4 font-mono font-bold text-[#0F4C3A]">
                Rp {{ (b.builderNetRevenue ?? b.totalNetEarnings ?? 0).toLocaleString('id-ID') }}
              </td>
              <td class="py-3.5 px-4 text-right text-[#111111]/50 text-[11px]">
                {{ b.createdAt ? new Date(b.createdAt).toLocaleDateString('id-ID') : '-' }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </section>
</template>
