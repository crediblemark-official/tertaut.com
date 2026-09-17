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
import type { TransactionItem } from '../../types'
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
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-2.5 pb-2 border-b border-[#111111]/10">
      <div class="flex items-center gap-2">
        <h2 class="text-xs font-bold uppercase tracking-wider text-[#111111]/80">Riwayat Transaksi</h2>
        <span class="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#111111]/5 text-[#111111]/70">
          {{ transactions.length }} total
        </span>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <!-- Search Input -->
        <div class="relative flex-1 sm:w-56">
          <Search class="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#111111]/40" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Cari ID / email..."
            class="w-full pl-8 pr-2.5 py-1 rounded-lg bg-[#111111]/5 border border-[#111111]/10 text-xs text-[#111111] placeholder:text-[#111111]/40 focus:outline-none focus:bg-white focus:border-[#D4AF37] transition"
          />
        </div>

        <!-- Status Filter Pills (Single Row) -->
        <div class="flex items-center gap-1 text-xs overflow-x-auto no-scrollbar shrink-0 pb-0.5">
          <button
            @click="statusFilter = 'ALL'"
            :class="[
              'px-2 py-1 rounded-md font-semibold transition cursor-pointer text-[11px]',
              statusFilter === 'ALL' ? 'bg-[#111111] text-white shadow-2xs' : 'bg-[#111111]/5 text-[#111111]/70 hover:bg-[#111111]/10'
            ]"
          >
            Semua ({{ transactions.length }})
          </button>
          <button
            @click="statusFilter = 'PAID'"
            :class="[
              'px-2 py-1 rounded-md font-semibold transition cursor-pointer text-[11px]',
              statusFilter === 'PAID' ? 'bg-[#0F4C3A] text-white shadow-2xs' : 'bg-[#0F4C3A]/10 text-[#0F4C3A] hover:bg-[#0F4C3A]/20'
            ]"
          >
            Lunas ({{ transactions.filter(t => t.paymentStatus === 'PAID').length }})
          </button>
          <button
            @click="statusFilter = 'PENDING'"
            :class="[
              'px-2 py-1 rounded-md font-semibold transition cursor-pointer text-[11px]',
              statusFilter === 'PENDING' ? 'bg-[#D4AF37] text-[#111111] font-bold shadow-2xs' : 'bg-[#D4AF37]/15 text-[#111111]/80 hover:bg-[#D4AF37]/25'
            ]"
          >
            Pending ({{ transactions.filter(t => t.paymentStatus === 'PENDING').length }})
          </button>
        </div>

        <!-- Refresh Button -->
        <button
          @click="emit('refresh')"
          title="Segarkan data transaksi"
          class="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-[#111111]/5 hover:bg-[#111111]/10 text-xs font-bold text-[#111111] cursor-pointer"
        >
          <RefreshCw class="w-3 h-3" :class="{ 'animate-spin': loadingTxs }" />
          <span class="hidden sm:inline text-[11px]">Segarkan</span>
        </button>
      </div>
    </div>

    <!-- Table (Scrollable on mobile) -->
    <div class="overflow-x-auto w-full top-scrollbar">
      <table class="w-full text-left text-xs whitespace-nowrap">
        <thead class="border-b border-[#111111]/10 text-[#111111]/60 font-bold uppercase text-[10px]">
          <tr>
            <th class="py-2 pr-2.5 pl-0">Waktu &amp; TX ID</th>
            <th class="py-2 px-2.5">Pembeli</th>
            <th class="py-2 px-2.5">Gross</th>
            <th class="py-2 px-2.5">Fee (5%)</th>
            <th class="py-2 px-2.5">Net Builder (95%)</th>
            <th class="py-2 px-2.5">Status Bayar</th>
            <th class="py-2 px-2.5">Pencairan</th>
            <th class="py-2 pl-2.5 pr-0 text-right">Aksi</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-[#111111]/5">
          <tr v-if="filteredTransactions.length === 0">
            <td colspan="8" class="py-6 text-center text-[#111111]/40">
              <div class="space-y-0.5">
                <p class="font-semibold text-xs text-[#111111]/60">Tidak ada transaksi ditemukan.</p>
                <p class="text-[11px] text-[#111111]/40" v-if="searchQuery || statusFilter !== 'ALL'">
                  Coba sesuaikan kata kunci pencarian atau filter status Anda.
                </p>
              </div>
            </td>
          </tr>
          <tr v-for="tx in filteredTransactions" :key="tx.id" class="hover:bg-[#111111]/[0.02]">
            <td class="py-2 pr-2.5 pl-0 font-mono text-[11px]">
              <div class="font-bold text-[#111111] leading-tight">{{ tx.id }}</div>
              <div class="text-[9.5px] text-[#111111]/50">{{ new Date(tx.createdAt).toLocaleString('id-ID') }}</div>
            </td>
            <td class="py-2 px-2.5 text-[#111111]/80">
              <div class="text-[11px]">{{ tx.customerEmail }}</div>
              <div
                v-if="tx.couponCode"
                class="inline-flex items-center gap-0.5 mt-0.5 px-1 py-0.2 rounded bg-[#D4AF37]/15 border border-[#D4AF37]/30 text-[9px] font-bold text-[#111111] font-mono"
              >
                <TicketPercent class="w-2.5 h-2.5" />
                {{ tx.couponCode }}
              </div>
            </td>
            <td class="py-2 px-2.5 font-mono font-bold text-[#111111]">{{ formatRupiah(tx.grossAmount) }}</td>
            <td class="py-2 px-2.5 font-mono text-[#8B0000] text-[11px]">-{{ formatRupiah(tx.platformFee) }}</td>
            <td class="py-2 px-2.5 font-mono font-bold text-[#0F4C3A]">{{ formatRupiah(tx.netAmount) }}</td>
            <td class="py-2 px-2.5">
              <span
                class="px-2 py-0.5 rounded-full text-[10px] font-bold"
                :class="tx.paymentStatus === 'PAID' ? 'bg-[#0F4C3A]/10 text-[#0F4C3A]' : 'bg-[#D4AF37]/15 text-[#111111]'"
              >
                {{ tx.paymentStatus }}
              </span>
            </td>
            <td class="py-2 px-2.5">
              <span
                class="px-2 py-0.5 rounded-full text-[10px] font-bold"
                :class="tx.disbursementStatus === 'COMPLETED' ? 'bg-[#0F4C3A]/10 text-[#0F4C3A]' : 'bg-[#111111]/5 text-[#111111]/70'"
              >
                {{ tx.disbursementStatus }}
              </span>
            </td>
            <td class="py-2 pl-2.5 pr-0 text-right">
              <div class="flex items-center justify-end gap-1">
                <!-- Simulation for Pending -->
                <button
                  v-if="tx.paymentStatus === 'PENDING' && isSandbox"
                  @click="emit('simulatePayment', tx)"
                  :disabled="simulatingTxId === tx.id"
                  title="Simulasikan Pembayaran Sukses (Sandbox)"
                  class="px-2 py-0.5 rounded bg-[#D4AF37] hover:bg-[#D4AF37]/90 text-[#111111] text-[10px] font-bold transition inline-flex items-center gap-1 shadow-2xs cursor-pointer active:scale-95 disabled:opacity-50"
                >
                  <Zap class="w-2.5 h-2.5 fill-current" />
                  <span>{{ simulatingTxId === tx.id ? 'Memproses...' : 'Simulasi Bayar' }}</span>
                </button>

                <a
                  v-if="tx.xenditInvoiceUrl && tx.paymentStatus === 'PENDING' && !isSandbox"
                  :href="tx.xenditInvoiceUrl"
                  target="_blank"
                  title="Buka Invoice Xendit Asli"
                  class="px-2 py-0.5 rounded bg-[#111111] text-white hover:bg-[#222222] text-[10px] font-bold transition inline-flex items-center gap-1"
                >
                  <ExternalLink class="w-2.5 h-2.5" />
                  <span>Bayar</span>
                </a>

                <!-- Disburse for Paid -->
                <button
                  v-if="tx.paymentStatus === 'PAID' && tx.disbursementStatus !== 'COMPLETED'"
                  @click="emit('disburse', tx)"
                  :disabled="disburseLoading === tx.id"
                  class="px-2 py-0.5 rounded-md bg-[#0F4C3A] text-white hover:bg-[#0F4C3A]/90 text-[10px] font-bold transition inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  <Send class="w-2.5 h-2.5" />
                  <span>{{ disburseLoading === tx.id ? 'Memproses...' : 'Cairkan (95%)' }}</span>
                </button>

                <span v-else-if="tx.disbursementStatus === 'COMPLETED'" class="text-[10px] text-[#0F4C3A] font-bold">
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
