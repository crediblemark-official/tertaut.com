<script setup lang="ts">
import { computed } from 'vue'
import { Search } from 'lucide-vue-next'
import type { PanelTransactionItem } from '../../types/panel'

const props = defineProps<{
  transactions: PanelTransactionItem[]
}>()

const statusFilter = defineModel<string>('statusFilter', { default: '' })
const searchQuery = defineModel<string>('searchQuery', { default: '' })

const emit = defineEmits<{
  (e: 'filterChange'): void
}>()

const filteredTransactions = computed(() => {
  return props.transactions.filter(tx => {
    if (statusFilter.value && tx.paymentStatus !== statusFilter.value) {
      return false
    }
    if (searchQuery.value.trim()) {
      const q = searchQuery.value.toLowerCase().trim()
      const matchApp = (tx.appName || '').toLowerCase().includes(q)
      const matchCust = (tx.customerEmail || '').toLowerCase().includes(q)
      const matchBuilder = (tx.builderEmail || '').toLowerCase().includes(q)
      const matchId = (tx.id || '').toLowerCase().includes(q)
      if (!matchApp && !matchCust && !matchBuilder && !matchId) return false
    }
    return true
  })
})
</script>

<template>
  <section class="space-y-4">
    <!-- Filter and Search Bar -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-[#111111]/10">
      <div class="relative flex-1 max-w-sm">
        <Search class="w-3.5 h-3.5 text-[#111111]/40 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Cari transaksi, app, pembeli, builder..."
          class="w-full h-9 pl-8 pr-3 text-xs rounded-lg bg-white border border-slate-300/80 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/20 focus:border-[#D4AF37] shadow-2xs transition"
        />
      </div>

      <div class="flex items-center gap-2">
        <select
          v-model="statusFilter"
          @change="emit('filterChange')"
          class="h-9 px-3 text-xs rounded-lg border border-slate-300/80 hover:border-slate-400 bg-white font-medium text-[#111111] focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/20 focus:border-[#D4AF37] shadow-2xs transition"
        >
          <option value="">Semua Status</option>
          <option value="PAID">PAID</option>
          <option value="PENDING">PENDING</option>
          <option value="FAILED">FAILED</option>
        </select>
      </div>
    </div>

    <!-- Table View (Responsive Table with Horizontal Scroll on Mobile) -->
    <div class="-mx-3.5 sm:-mx-4 md:-mx-6 overflow-x-auto top-scrollbar">
      <table class="w-full min-w-full text-left text-xs whitespace-nowrap border-b border-[#111111]/15">
        <thead class="border-b border-[#111111]/20 text-xs font-semibold text-[#111111]/70 bg-white">
          <tr>
            <th class="py-2.5 pr-3 pl-3.5 sm:pl-4 md:pl-6">Tanggal</th>
            <th class="py-2.5 px-3">TX ID</th>
            <th class="py-2.5 px-3">Aplikasi</th>
            <th class="py-2.5 px-3">Builder</th>
            <th class="py-2.5 px-3">Pelanggan</th>
            <th class="py-2.5 px-3">Gross (GMV)</th>
            <th class="py-2.5 px-3">MoR 5%</th>
            <th class="py-2.5 px-3">Net 95%</th>
            <th class="py-2.5 px-3">Status</th>
            <th class="py-2.5 pl-3 pr-3.5 sm:pr-4 md:pr-6 text-right">Disbursement</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-[#111111]/15">
          <tr v-if="filteredTransactions.length === 0">
            <td colspan="10" class="py-8 px-3.5 sm:px-4 md:px-6 text-center text-[#111111]/40">
              Tidak ada transaksi ditemukan.
            </td>
          </tr>
          <tr
            v-for="tx in filteredTransactions"
            :key="tx.id"
            class="hover:bg-[#111111]/[0.02] transition"
          >
            <td class="py-2.5 pr-3 pl-3.5 sm:pl-4 md:pl-6 text-[11px] text-[#111111]/70 font-mono">
              {{ new Date(tx.createdAt).toLocaleDateString('id-ID') }}
            </td>
            <td class="py-2.5 px-3 font-mono font-bold text-[11px] text-[#111111]">
              {{ tx.id.slice(0, 10) }}...
            </td>
            <td class="py-2.5 px-3 font-semibold text-[#111111]">{{ tx.appName }}</td>
            <td class="py-2.5 px-3 text-[#111111]/70 font-mono text-[11px]">{{ tx.builderEmail }}</td>
            <td class="py-2.5 px-3 text-[#111111]/70 font-mono text-[11px]">{{ tx.customerEmail }}</td>
            <td class="py-2.5 px-3 font-mono font-bold text-[#111111]">Rp {{ tx.grossAmount.toLocaleString('id-ID') }}</td>
            <td class="py-2.5 px-3 font-mono font-bold text-[#996515]">Rp {{ tx.platformFee.toLocaleString('id-ID') }}</td>
            <td class="py-2.5 px-3 font-mono font-bold text-[#0F4C3A]">Rp {{ tx.netAmount.toLocaleString('id-ID') }}</td>
            <td class="py-2.5 px-3">
              <span
                :class="[
                  'px-2 py-0.5 rounded-full text-[10px] font-bold',
                  tx.paymentStatus === 'PAID'
                    ? 'bg-[#0F4C3A]/10 text-[#0F4C3A]'
                    : tx.paymentStatus === 'PENDING'
                    ? 'bg-[#D4AF37]/20 text-[#996515]'
                    : 'bg-[#B91C1C]/10 text-[#B91C1C]'
                ]"
              >
                {{ tx.paymentStatus }}
              </span>
            </td>
            <td class="py-2.5 pl-3 pr-3.5 sm:pr-4 md:pr-6 text-right">
              <span
                :class="[
                  'px-2 py-0.5 rounded-full text-[10px] font-bold uppercase',
                  tx.disbursementStatus === 'COMPLETED'
                    ? 'bg-[#0F4C3A]/10 text-[#0F4C3A]'
                    : 'bg-[#111111]/10 text-[#111111]/70'
                ]"
              >
                {{ tx.disbursementStatus }}
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
