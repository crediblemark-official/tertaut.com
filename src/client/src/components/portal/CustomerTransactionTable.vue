<script setup lang="ts">
import { Receipt, ExternalLink } from 'lucide-vue-next'
import type { PortalTransactionItem } from '../../types'

defineProps<{
  transactions: PortalTransactionItem[]
}>()
</script>

<template>
  <div class="space-y-4">
    <div
      v-if="transactions.length === 0"
      class="p-12 text-center bg-white rounded-2xl border border-[#111111]/10 space-y-3"
    >
      <div class="w-12 h-12 rounded-full bg-[#111111]/5 mx-auto flex items-center justify-center text-[#111111]/40">
        <Receipt class="w-6 h-6" />
      </div>
      <h3 class="text-sm font-bold text-[#111111]">Belum Ada Riwayat Transaksi</h3>
      <p class="text-xs text-[#111111]/60">
        Belum ada transaksi pembayaran yang tercatat untuk akun ini.
      </p>
    </div>

    <div v-else class="bg-white rounded-2xl border border-[#111111]/10 overflow-hidden shadow-xs">
      <div class="overflow-x-auto top-scrollbar">
        <table class="w-full text-left text-xs border-collapse whitespace-nowrap">
          <thead>
            <tr class="bg-[#FAFAFA] border-b border-[#111111]/10 text-[#111111]/60 uppercase tracking-wider text-[10px]">
              <th class="py-3 px-4 font-bold">Produk / Aplikasi</th>
              <th class="py-3 px-4 font-bold">Tanggal</th>
              <th class="py-3 px-4 font-bold">Nominal</th>
              <th class="py-3 px-4 font-bold">Status Pembayaran</th>
              <th class="py-3 px-4 font-bold text-right">Invoice Resmi</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-[#111111]/5">
            <tr
              v-for="tx in transactions"
              :key="tx.id"
              class="hover:bg-[#111111]/2 transition"
            >
              <td class="py-3.5 px-4 font-bold text-[#111111]">
                {{ tx.appName }}
              </td>
              <td class="py-3.5 px-4 text-[#111111]/70">
                {{ new Date(tx.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) }}
              </td>
              <td class="py-3.5 px-4 font-mono font-bold text-[#111111]">
                Rp {{ tx.grossAmount.toLocaleString('id-ID') }}
              </td>
              <td class="py-3.5 px-4">
                <span
                  :class="[
                    'px-2 py-0.5 rounded-full text-[10px] font-bold uppercase',
                    tx.paymentStatus === 'PAID'
                      ? 'bg-[#0F4C3A]/10 text-[#0F4C3A]'
                      : tx.paymentStatus === 'PENDING'
                      ? 'bg-[#D4AF37]/15 text-[#996515]'
                      : 'bg-[#B91C1C]/10 text-[#B91C1C]'
                  ]"
                >
                  {{ tx.paymentStatus }}
                </span>
              </td>
              <td class="py-3.5 px-4 text-right">
                <a
                  v-if="tx.xenditInvoiceUrl"
                  :href="tx.xenditInvoiceUrl"
                  target="_blank"
                  class="inline-flex items-center gap-1 text-xs font-semibold text-[#0F4C3A] hover:underline"
                >
                  <span>Lihat Invoice</span>
                  <ExternalLink class="w-3 h-3" />
                </a>
                <span v-else class="text-[#111111]/40">-</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
