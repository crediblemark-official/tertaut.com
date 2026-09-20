<script setup lang="ts">
import { computed } from 'vue'
import {
  RefreshCw,
  Search,
  Zap,
  ExternalLink,
  Send,
  TicketPercent
} from 'lucide-vue-next'
import type { TransactionItem } from '../../types/transaction'
import { formatRupiah } from '../../lib/utils'

const props = defineProps<{
  transactions: TransactionItem[]
  loadingTxs: boolean
  simulatingTxId: string | null
  disburseLoading: string | null
  isSandbox: boolean
}>()

const searchQuery = defineModel<string>('searchQuery', { default: '' })
const statusFilter = defineModel<'ALL' | 'PAID' | 'PENDING'>('statusFilter', { default: 'ALL' })

const emit = defineEmits<{
  (e: 'refresh'): void
  (e: 'simulatePayment', tx: TransactionItem): void
  (e: 'disburse', tx: TransactionItem): void
}>()

const filteredTransactions = computed(() => {
  return props.transactions.filter(tx => {
    if (statusFilter.value !== 'ALL' && tx.paymentStatus !== statusFilter.value) {
      return false
    }
    if (searchQuery.value.trim()) {
      const q = searchQuery.value.toLowerCase().trim()
      const matchId = tx.id.toLowerCase().includes(q)
      const matchEmail = (tx.customerEmail || '').toLowerCase().includes(q)
      if (!matchId && !matchEmail) return false
    }
    return true
  })
})
</script>

<template>
  <div class="space-y-3">
    <!-- Compact Unified Header & Toolbar -->
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-2.5 pb-2 border-b border-jetblack/10">
      <div class="flex items-center gap-2">
        <h2 class="text-xs font-bold uppercase tracking-wider text-jetblack/80">Riwayat Transaksi</h2>
        <span class="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-jetblack/5 text-jetblack/70">
          {{ transactions.length }} total
        </span>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <!-- Search Input -->
        <div class="relative flex-1 sm:w-56">
          <Search class="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-jetblack/40" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Cari ID / email..."
            class="w-full pl-8 pr-2.5 py-1 rounded-lg bg-jetblack/5 border border-jetblack/10 text-xs text-jetblack placeholder:text-jetblack/40 focus:outline-none focus:bg-white focus:border-gold transition"
          />
        </div>

        <!-- Status Filter Pills (Single Row) -->
        <div class="flex items-center gap-1 text-xs overflow-x-auto no-scrollbar shrink-0 pb-0.5">
          <button
            @click="statusFilter = 'ALL'"
            :class="[
              'px-2 py-1 rounded-md font-semibold transition cursor-pointer text-[11px]',
              statusFilter === 'ALL' ? 'bg-jetblack text-white shadow-2xs' : 'bg-jetblack/5 text-jetblack/70 hover:bg-jetblack/10'
            ]"
          >
            Semua ({{ transactions.length }})
          </button>
          <button
            @click="statusFilter = 'PAID'"
            :class="[
              'px-2 py-1 rounded-md font-semibold transition cursor-pointer text-[11px]',
              statusFilter === 'PAID' ? 'bg-forest text-white shadow-2xs' : 'bg-forest/10 text-forest hover:bg-forest/20'
            ]"
          >
            Lunas ({{ transactions.filter(t => t.paymentStatus === 'PAID').length }})
          </button>
          <button
            @click="statusFilter = 'PENDING'"
            :class="[
              'px-2 py-1 rounded-md font-semibold transition cursor-pointer text-[11px]',
              statusFilter === 'PENDING' ? 'bg-gold text-jetblack font-bold shadow-2xs' : 'bg-gold/15 text-jetblack/80 hover:bg-gold/25'
            ]"
          >
            Pending ({{ transactions.filter(t => t.paymentStatus === 'PENDING').length }})
          </button>
        </div>

        <!-- Refresh Button -->
        <button
          @click="emit('refresh')"
          title="Segarkan data transaksi"
          class="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-jetblack/5 hover:bg-jetblack/10 text-xs font-bold text-jetblack cursor-pointer"
        >
          <RefreshCw class="w-3 h-3" :class="{ 'animate-spin': loadingTxs }" />
          <span class="hidden sm:inline text-[11px]">Segarkan</span>
        </button>
      </div>
    </div>

    <!-- Table (Scrollable on mobile) -->
    <div class="-mx-3.5 sm:-mx-4 md:-mx-6 overflow-x-auto top-scrollbar">
      <table class="w-full min-w-full text-left text-xs whitespace-nowrap border-b border-jetblack/15">
        <thead class="border-b border-jetblack/20 text-xs font-semibold text-jetblack/70 bg-white">
          <tr>
            <th class="py-2.5 pr-2.5 pl-3.5 sm:pl-4 md:pl-6">Waktu</th>
            <th class="py-2.5 px-2.5">TX ID</th>
            <th class="py-2.5 px-2.5">Pembeli</th>
            <th class="py-2.5 px-2.5">Gross</th>
            <th class="py-2.5 px-2.5">Fee (5%)</th>
            <th class="py-2.5 px-2.5">Net Builder (95%)</th>
            <th class="py-2.5 px-2.5">Status Bayar</th>
            <th class="py-2.5 px-2.5">Pencairan</th>
            <th class="py-2.5 pl-2.5 pr-3.5 sm:pr-4 md:pr-6 text-right">Aksi</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-jetblack/15">
          <tr v-if="filteredTransactions.length === 0">
            <td colspan="9" class="py-8 px-3.5 sm:px-4 md:px-6 text-center text-jetblack/40">
              <div class="space-y-0.5">
                <p class="font-semibold text-xs text-jetblack/60">Tidak ada transaksi ditemukan.</p>
                <p class="text-[11px] text-jetblack/40" v-if="searchQuery || statusFilter !== 'ALL'">
                  Coba sesuaikan kata kunci pencarian atau filter status Anda.
                </p>
              </div>
            </td>
          </tr>
          <tr v-for="tx in filteredTransactions" :key="tx.id" class="hover:bg-jetblack/[0.02]">
            <td class="py-2.5 pr-2.5 pl-3.5 sm:pl-4 md:pl-6 font-mono text-[11px] text-jetblack/70">
              {{ new Date(tx.createdAt).toLocaleString('id-ID') }}
            </td>
            <td class="py-2.5 px-2.5 font-mono text-[11px] font-bold text-jetblack">
              {{ tx.id }}
            </td>
            <td class="py-2.5 px-2.5 text-jetblack/80">
              <div class="inline-flex items-center gap-1.5">
                <span class="text-[11px]">{{ tx.customerEmail }}</span>
                <span
                  v-if="tx.couponCode"
                  class="inline-flex items-center gap-0.5 px-1 py-0.2 rounded bg-gold/15 border border-gold/30 text-[9px] font-bold text-jetblack font-mono"
                >
                  <TicketPercent class="w-2.5 h-2.5" />
                  {{ tx.couponCode }}
                </span>
              </div>
            </td>
            <td class="py-2.5 px-2.5 font-mono font-bold text-jetblack">{{ formatRupiah(tx.grossAmount) }}</td>
            <td class="py-2.5 px-2.5 font-mono text-crimson text-[11px]">-{{ formatRupiah(tx.platformFee) }}</td>
            <td class="py-2.5 px-2.5 font-mono font-bold text-forest">{{ formatRupiah(tx.netAmount) }}</td>
            <td class="py-2.5 px-2.5">
              <span
                class="px-2 py-0.5 rounded-full text-[10px] font-bold"
                :class="tx.paymentStatus === 'PAID' ? 'bg-forest/10 text-forest' : 'bg-gold/15 text-jetblack'"
              >
                {{ tx.paymentStatus }}
              </span>
            </td>
            <td class="py-2.5 px-2.5">
              <span
                class="px-2 py-0.5 rounded-full text-[10px] font-bold"
                :class="tx.disbursementStatus === 'COMPLETED' ? 'bg-forest/10 text-forest' : 'bg-jetblack/5 text-jetblack/70'"
              >
                {{ tx.disbursementStatus }}
              </span>
            </td>
            <td class="py-2.5 pl-2.5 pr-3.5 sm:pr-4 md:pr-6 text-right">
              <div class="flex items-center justify-end gap-1">
                <!-- Simulation for Pending -->
                <button
                  v-if="tx.paymentStatus === 'PENDING' && isSandbox"
                  @click="emit('simulatePayment', tx)"
                  :disabled="simulatingTxId === tx.id"
                  title="Simulasikan Pembayaran Sukses (Sandbox)"
                  class="px-2 py-0.5 rounded bg-gold hover:bg-gold/90 text-jetblack text-[10px] font-bold transition inline-flex items-center gap-1 shadow-2xs cursor-pointer active:scale-95 disabled:opacity-50"
                >
                  <Zap class="w-2.5 h-2.5 fill-current" />
                  <span>{{ simulatingTxId === tx.id ? 'Memproses...' : 'Simulasi Bayar' }}</span>
                </button>

                <a
                  v-if="tx.xenditInvoiceUrl && tx.paymentStatus === 'PENDING' && !isSandbox"
                  :href="tx.xenditInvoiceUrl"
                  target="_blank"
                  title="Buka Invoice Xendit Asli"
                  class="px-2 py-0.5 rounded bg-jetblack text-white hover:bg-jetblack-hover text-[10px] font-bold transition inline-flex items-center gap-1"
                >
                  <ExternalLink class="w-2.5 h-2.5" />
                  <span>Bayar</span>
                </a>

                <!-- Disburse for Paid -->
                <button
                  v-if="tx.paymentStatus === 'PAID' && tx.disbursementStatus !== 'COMPLETED'"
                  @click="emit('disburse', tx)"
                  :disabled="disburseLoading === tx.id"
                  class="px-2 py-0.5 rounded-md bg-forest text-white hover:bg-forest/90 text-[10px] font-bold transition inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  <Send class="w-2.5 h-2.5" />
                  <span>{{ disburseLoading === tx.id ? 'Memproses...' : 'Cairkan (95%)' }}</span>
                </button>

                <span v-else-if="tx.disbursementStatus === 'COMPLETED'" class="text-[10px] text-forest font-bold">
                  Sudah Ditransfer
                </span>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
