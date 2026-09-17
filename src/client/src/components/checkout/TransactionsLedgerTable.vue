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
  <div class="luxury-card p-4 md:p-5 rounded-xl space-y-4">
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div>
        <h2 class="text-sm font-bold text-[#111111]">Riwayat Transaksi MoR &amp; Pencairan Saldo (Xendit)</h2>
        <p class="text-xs text-[#111111]/60">Daftar transaksi real-time dari database dengan rincian fee MoR 5% dan payout 95%.</p>
      </div>
      <div class="flex items-center gap-2">
        <button
          @click="emit('refresh')"
          class="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#111111]/5 hover:bg-[#111111]/10 text-xs font-bold text-[#111111] cursor-pointer"
        >
          <RefreshCw class="w-3 h-3" :class="{ 'animate-spin': loadingTxs }" />
          <span>Segarkan</span>
        </button>
      </div>
    </div>

    <!-- Search & Filter Controls -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 border-t border-[#111111]/10">
      <!-- Search Input -->
      <div class="relative flex-1 max-w-sm">
        <Search class="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#111111]/40" />
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Cari TX ID atau Email Pembeli..."
          class="w-full pl-8 pr-3 py-1.5 rounded-lg bg-white border border-[#111111]/15 text-xs text-[#111111] placeholder:text-[#111111]/40 focus:outline-none focus:border-[#D4AF37]"
        />
      </div>

      <!-- Status Filter Pills -->
      <div class="flex items-center gap-1 text-xs">
        <button
          @click="statusFilter = 'ALL'"
          :class="[
            'px-2.5 py-1 rounded-md font-semibold transition cursor-pointer text-[11px]',
            statusFilter === 'ALL' ? 'bg-[#111111] text-white shadow-xs' : 'bg-[#111111]/5 text-[#111111]/70 hover:bg-[#111111]/10'
          ]"
        >
          Semua ({{ transactions.length }})
        </button>
        <button
          @click="statusFilter = 'PAID'"
          :class="[
            'px-2.5 py-1 rounded-md font-semibold transition cursor-pointer text-[11px]',
            statusFilter === 'PAID' ? 'bg-[#0F4C3A] text-white shadow-xs' : 'bg-[#0F4C3A]/10 text-[#0F4C3A] hover:bg-[#0F4C3A]/20'
          ]"
        >
          Lunas ({{ transactions.filter(t => t.paymentStatus === 'PAID').length }})
        </button>
        <button
          @click="statusFilter = 'PENDING'"
          :class="[
            'px-2.5 py-1 rounded-md font-semibold transition cursor-pointer text-[11px]',
            statusFilter === 'PENDING' ? 'bg-[#D4AF37] text-[#111111] font-bold shadow-xs' : 'bg-[#D4AF37]/15 text-[#111111]/80 hover:bg-[#D4AF37]/25'
          ]"
        >
          Pending ({{ transactions.filter(t => t.paymentStatus === 'PENDING').length }})
        </button>
      </div>
    </div>

    <div class="overflow-x-auto">
      <table class="w-full text-left text-xs">
        <thead>
          <tr class="border-b border-[#111111]/10 text-[#111111]/60 font-bold uppercase text-[10px]">
            <th class="pb-2">Waktu &amp; TX ID</th>
            <th class="pb-2">Pembeli</th>
            <th class="pb-2">Gross</th>
            <th class="pb-2">Fee (5%)</th>
            <th class="pb-2">Net Builder (95%)</th>
            <th class="pb-2">Status Bayar</th>
            <th class="pb-2">Pencairan (Disbursement)</th>
            <th class="pb-2 text-right">Aksi</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-[#111111]/5">
          <tr v-if="filteredTransactions.length === 0">
            <td colspan="8" class="py-8 text-center text-[#111111]/40">
              <div class="space-y-1">
                <p class="font-semibold text-xs text-[#111111]/60">Tidak ada transaksi ditemukan.</p>
                <p class="text-[11px] text-[#111111]/40" v-if="searchQuery || statusFilter !== 'ALL'">
                  Coba sesuaikan kata kunci pencarian atau filter status Anda.
                </p>
              </div>
            </td>
          </tr>
          <tr v-for="tx in filteredTransactions" :key="tx.id" class="hover:bg-[#111111]/[0.02]">
            <td class="py-2.5 font-mono text-[11px]">
              <div class="font-bold text-[#111111]">{{ tx.id }}</div>
              <div class="text-[10px] text-[#111111]/50">{{ new Date(tx.createdAt).toLocaleString('id-ID') }}</div>
            </td>
            <td class="py-2.5 text-[#111111]/80">
              <div>{{ tx.customerEmail }}</div>
              <div
                v-if="tx.couponCode"
                class="inline-flex items-center gap-1 mt-0.5 px-1.5 py-0.5 rounded bg-[#D4AF37]/15 border border-[#D4AF37]/30 text-[9px] font-bold text-[#111111] font-mono"
              >
                <TicketPercent class="w-2.5 h-2.5" />
                {{ tx.couponCode }}
              </div>
            </td>
            <td class="py-2.5 font-mono font-bold text-[#111111]">{{ formatRupiah(tx.grossAmount) }}</td>
            <td class="py-2.5 font-mono text-[#8B0000]">-{{ formatRupiah(tx.platformFee) }}</td>
            <td class="py-2.5 font-mono font-bold text-[#0F4C3A]">{{ formatRupiah(tx.netAmount) }}</td>
            <td class="py-2.5">
              <span
                class="px-2 py-0.5 rounded-full text-[10px] font-bold"
                :class="tx.paymentStatus === 'PAID' ? 'bg-[#0F4C3A]/10 text-[#0F4C3A]' : 'bg-[#D4AF37]/15 text-[#111111]'"
              >
                {{ tx.paymentStatus }}
              </span>
            </td>
            <td class="py-2.5">
              <span
                class="px-2 py-0.5 rounded-full text-[10px] font-bold"
                :class="tx.disbursementStatus === 'COMPLETED' ? 'bg-[#0F4C3A]/10 text-[#0F4C3A]' : 'bg-[#111111]/5 text-[#111111]/70'"
              >
                {{ tx.disbursementStatus }}
              </span>
            </td>
            <td class="py-2.5 text-right">
              <div class="flex items-center justify-end gap-1.5">
                <!-- Simulation for Pending — hanya tersedia di environment Sandbox -->
                <button
                  v-if="tx.paymentStatus === 'PENDING' && isSandbox"
                  @click="emit('simulatePayment', tx)"
                  :disabled="simulatingTxId === tx.id"
                  title="Simulasikan Pembayaran Sukses (Sandbox)"
                  class="px-2 py-1 rounded bg-[#D4AF37] hover:bg-[#D4AF37]/90 text-[#111111] text-[10px] font-bold transition inline-flex items-center gap-1 shadow-xs cursor-pointer active:scale-95 disabled:opacity-50"
                >
                  <Zap class="w-2.5 h-2.5 fill-current" />
                  <span>{{ simulatingTxId === tx.id ? 'Memproses...' : 'Simulasi Bayar' }}</span>
                </button>

                <a
                  v-if="tx.xenditInvoiceUrl && tx.paymentStatus === 'PENDING' && !isSandbox"
                  :href="tx.xenditInvoiceUrl"
                  target="_blank"
                  title="Buka Invoice Xendit Asli"
                  class="px-2 py-1 rounded bg-[#111111] text-white hover:bg-[#222222] text-[10px] font-bold transition inline-flex items-center gap-1"
                >
                  <ExternalLink class="w-2.5 h-2.5" />
                  <span>Bayar</span>
                </a>

                <!-- Disburse for Paid -->
                <button
                  v-if="tx.paymentStatus === 'PAID' && tx.disbursementStatus !== 'COMPLETED'"
                  @click="emit('disburse', tx)"
                  :disabled="disburseLoading === tx.id"
                  class="px-2.5 py-1 rounded-lg bg-[#0F4C3A] text-white hover:bg-[#0F4C3A]/90 text-[11px] font-bold transition inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
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
