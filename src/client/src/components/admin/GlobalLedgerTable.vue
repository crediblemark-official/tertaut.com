<script setup lang="ts">
import { computed } from 'vue'
import { Search } from 'lucide-vue-next'
import type { PanelTransactionItem } from '../../types'

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
    <div class="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-[#111111]/10">
      <div class="relative flex-1 w-full">
        <Search class="w-3.5 h-3.5 text-[#111111]/40 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Cari transaksi, app, pembeli, atau builder..."
          class="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-[#111111]/15 focus:border-[#111111] outline-none"
        />
      </div>

      <div class="flex items-center gap-2 w-full sm:w-auto">
        <select
          v-model="statusFilter"
          @change="emit('filterChange')"
          class="px-3 py-1.5 text-xs rounded-xl border border-[#111111]/15 bg-white font-medium text-[#111111]"
        >
          <option value="">Semua Status</option>
          <option value="PAID">PAID</option>
          <option value="PENDING">PENDING</option>
          <option value="FAILED">FAILED</option>
        </select>
      </div>
    </div>

    <div class="bg-white rounded-2xl border border-[#111111]/10 overflow-hidden shadow-xs">
      <div class="overflow-x-auto top-scrollbar">
        <table class="w-full text-left text-xs border-collapse whitespace-nowrap">
          <thead>
            <tr class="bg-[#FAFAFA] border-b border-[#111111]/10 text-[#111111]/60 uppercase tracking-wider text-[10px]">
              <th class="py-3 px-4 font-bold">ID / Tanggal</th>
              <th class="py-3 px-4 font-bold">Aplikasi</th>
              <th class="py-3 px-4 font-bold">Builder</th>
              <th class="py-3 px-4 font-bold">Pelanggan</th>
              <th class="py-3 px-4 font-bold">Gross (GMV)</th>
              <th class="py-3 px-4 font-bold">MoR 5%</th>
              <th class="py-3 px-4 font-bold">Net 95%</th>
              <th class="py-3 px-4 font-bold">Status Bayar</th>
              <th class="py-3 px-4 font-bold text-right">Disbursement</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-[#111111]/5">
            <tr
              v-for="tx in filteredTransactions"
              :key="tx.id"
              class="hover:bg-[#111111]/2 transition"
            >
              <td class="py-3 px-4">
                <div class="font-mono font-bold text-[11px] text-[#111111]">{{ tx.id.slice(0, 8) }}...</div>
                <div class="text-[10px] text-[#111111]/50">{{ new Date(tx.createdAt).toLocaleDateString('id-ID') }}</div>
              </td>
              <td class="py-3 px-4 font-semibold text-[#111111]">
                {{ tx.appName }}
              </td>
              <td class="py-3 px-4 text-[#111111]/70 font-mono text-[11px]">
                {{ tx.builderEmail }}
              </td>
              <td class="py-3 px-4 text-[#111111]/70 font-mono text-[11px]">
                {{ tx.customerEmail }}
              </td>
              <td class="py-3 px-4 font-mono font-bold text-[#111111]">
                Rp {{ tx.grossAmount.toLocaleString('id-ID') }}
              </td>
              <td class="py-3 px-4 font-mono font-bold text-[#996515]">
                Rp {{ tx.platformFee.toLocaleString('id-ID') }}
              </td>
              <td class="py-3 px-4 font-mono font-bold text-[#0F4C3A]">
                Rp {{ tx.netAmount.toLocaleString('id-ID') }}
              </td>
              <td class="py-3 px-4">
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
              <td class="py-3 px-4 text-right">
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
    </div>
  </section>
</template>
