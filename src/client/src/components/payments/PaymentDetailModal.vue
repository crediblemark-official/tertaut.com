<script setup lang="ts">
import { Wallet, ArrowUpRight, Zap, ExternalLink } from "lucide-vue-next";
import type { AppItem } from "../../types/app";
import type { TransactionItem } from "../../types/transaction";
import { envPath, type DashboardEnv } from "../../lib/environment";
import { formatRupiah, formatDate as formatUtilsDate } from "../../lib/utils";
import BaseModal from "../common/BaseModal.vue";
import StatusBadge from "../common/StatusBadge.vue";
import CopyButton from "../common/CopyButton.vue";

const props = withDefaults(
  defineProps<{
    isOpen: boolean;
    transaction: TransactionItem | null;
    appsList?: AppItem[];
    env?: DashboardEnv;
  }>(),
  {
    appsList: () => [],
    env: "live",
  }
);

const emit = defineEmits<{
  (e: "close"): void;
}>();

function getAppName(appId: string): string {
  const app = props.appsList.find((a) => a.id === appId);
  return app ? app.name : appId;
}

function formatDate(dateStr?: string | null): string {
  return formatUtilsDate(dateStr, { includeTime: true });
}
</script>

<template>
  <BaseModal
    :show="isOpen && !!transaction"
    title="Rincian Transaksi Builder & MoR"
    max-width="max-w-md"
    @close="emit('close')"
  >
    <template #title-icon>
      <div class="w-2 h-2 rounded-full bg-gold"></div>
    </template>

    <div v-if="transaction" class="text-xs divide-y divide-jetblack/10">
      <!-- Top Amount Strip -->
      <div class="px-5 py-3.5 bg-jetblack/[0.02] space-y-2">
        <div class="flex items-center justify-between">
          <span class="text-[11px] text-jetblack/60 font-semibold">Total Pembayaran</span>
          <StatusBadge :status="transaction.paymentStatus" />
        </div>
        <div class="text-2xl font-mono tracking-wider font-bold text-jetblack">
          {{ formatRupiah(transaction.grossAmount) }}
        </div>
        <div
          class="pt-2 border-t border-jetblack/10 grid grid-cols-2 divide-x divide-jetblack/10 text-[11px]"
        >
          <div class="pr-2">
            <span class="text-jetblack/50 block">Biaya MoR (5%)</span>
            <span class="font-mono tracking-wider font-bold text-crimson"
              >- {{ formatRupiah(transaction.platformFee) }}</span
            >
          </div>
          <div class="pl-3">
            <span class="text-jetblack/50 block">Net Builder (95%)</span>
            <span class="font-mono tracking-wider font-bold text-forest">{{
              formatRupiah(transaction.netAmount)
            }}</span>
          </div>
        </div>
      </div>

      <!-- Transaction Fields Details (Hairline Rows) -->
      <div class="px-5 divide-y divide-jetblack/10">
        <div class="flex justify-between items-center py-2">
          <span class="text-jetblack/60">ID Transaksi</span>
          <div class="flex items-center gap-1.5">
            <span class="font-mono tracking-wider font-semibold text-jetblack">{{
              transaction.id
            }}</span>
            <CopyButton :text="transaction.id" title="Salin ID Transaksi" />
          </div>
        </div>
        <div class="flex justify-between py-2">
          <span class="text-jetblack/60">Email Pembeli</span>
          <span class="font-semibold text-jetblack">{{ transaction.customerEmail || "-" }}</span>
        </div>
        <div v-if="transaction.customerName" class="flex justify-between py-2">
          <span class="text-jetblack/60">Nama Pelanggan</span>
          <span class="font-semibold text-jetblack">{{ transaction.customerName }}</span>
        </div>
        <div v-if="transaction.couponCode" class="flex justify-between py-2">
          <span class="text-jetblack/60">Kupon Diskon</span>
          <span
            class="font-mono tracking-wider font-bold text-jetblack bg-gold/15 px-1.5 py-0.2 rounded border border-gold/30"
          >
            {{ transaction.couponCode }}
          </span>
        </div>
        <div class="flex justify-between py-2">
          <span class="text-jetblack/60">Produk Software</span>
          <span class="font-semibold text-jetblack">{{ getAppName(transaction.appId) }}</span>
        </div>
        <div class="flex justify-between py-2">
          <span class="text-jetblack/60">Kanal Bayar</span>
          <span class="font-semibold text-jetblack uppercase">{{
            transaction.paymentChannel || "-"
          }}</span>
        </div>
        <div class="flex justify-between py-2">
          <span class="text-jetblack/60">Provider</span>
          <span class="font-semibold text-jetblack uppercase">{{
            transaction.paymentProvider || "XENDIT"
          }}</span>
        </div>
        <div class="flex justify-between py-2">
          <span class="text-jetblack/60">Status Pencairan</span>
          <StatusBadge :status="transaction.disbursementStatus" />
        </div>
        <div class="flex justify-between py-2">
          <span class="text-jetblack/60">Waktu Dibuat</span>
          <span class="text-jetblack font-mono">{{ formatDate(transaction.createdAt) }}</span>
        </div>
        <div class="flex justify-between py-2">
          <span class="text-jetblack/60">Waktu Lunas</span>
          <span class="text-jetblack font-mono">{{
            transaction.paidAt ? formatDate(transaction.paidAt) : "-"
          }}</span>
        </div>
      </div>

      <div
        v-if="transaction.metadata && Object.keys(transaction.metadata).length > 0"
        class="px-5 py-3 space-y-1.5"
      >
        <span class="text-[10px] font-bold text-jetblack/50 uppercase tracking-wider block">
          Metadata Kustom SaaS
        </span>
        <div
          class="p-2.5 rounded-lg bg-jetblack/5 font-mono text-[11px] text-jetblack overflow-x-auto max-h-36 border border-jetblack/10"
        >
          <pre class="whitespace-pre-wrap leading-relaxed">{{
            JSON.stringify(transaction.metadata, null, 2)
          }}</pre>
        </div>
      </div>

      <!-- Saldo info: mengarahkan ke /balances untuk tarik dana agregat -->
      <div
        v-if="
          transaction.paymentStatus === 'PAID' && transaction.disbursementStatus !== 'COMPLETED'
        "
        class="px-5 py-3 bg-jetblack/[0.02] flex items-start gap-2.5"
      >
        <Wallet class="w-4 h-4 text-gold shrink-0 mt-0.5" />
        <div class="space-y-1">
          <div class="text-xs font-bold text-jetblack">Saldo Menunggu Penarikan</div>
          <p class="text-[11px] text-jetblack/60">
            Net builder
            <span class="font-mono font-bold text-forest">{{
              formatRupiah(transaction.netAmount)
            }}</span>
            masuk ke akumulasi saldo di menu Saldo &amp; Payout.
          </p>
          <router-link
            :to="envPath(env, '/balances')"
            class="inline-flex items-center gap-1 mt-0.5 text-[11px] font-bold text-jetblack hover:text-gold transition"
          >
            <ArrowUpRight class="w-3.5 h-3.5" />
            <span>Buka Saldo &amp; Payout</span>
          </router-link>
        </div>
      </div>

      <!-- Public Invoice & Delivery Links (Flush 2-col Grid) -->
      <div class="grid grid-cols-2 divide-x divide-jetblack/10">
        <router-link
          :to="`/invoice/${transaction.id}`"
          target="_blank"
          class="px-5 py-3 hover:bg-jetblack/[0.03] transition flex items-center justify-between text-xs font-semibold text-jetblack group"
        >
          <span>Invoice</span>
          <ExternalLink class="w-3.5 h-3.5 text-jetblack/40 group-hover:text-jetblack" />
        </router-link>

        <router-link
          :to="`/pay/${transaction.id}`"
          target="_blank"
          class="px-5 py-3 hover:bg-jetblack/[0.03] transition flex items-center justify-between text-xs font-semibold text-jetblack group"
        >
          <span>Halaman Bayar</span>
          <ExternalLink class="w-3.5 h-3.5 text-jetblack/40 group-hover:text-jetblack" />
        </router-link>
      </div>

      <!-- Simulator Notice for Sandbox -->
      <div
        v-if="env === 'sandbox' && transaction.paymentStatus !== 'PAID'"
        class="px-5 py-3.5 bg-amber-50/70 space-y-2 text-xs"
      >
        <div class="flex items-center gap-1.5 font-bold text-amber-900">
          <Zap class="w-4 h-4 text-amber-600" />
          <span>Simulasi Pembayaran Sandbox</span>
        </div>
        <p class="text-[11px] text-amber-800/80">
          Buka kasir sandbox untuk menyelesaikan simulasi pembayaran gateway.
        </p>
        <a
          v-if="transaction.xenditInvoiceUrl"
          :href="transaction.xenditInvoiceUrl"
          target="_blank"
          class="w-full py-2 btn-gold rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <ExternalLink class="w-3.5 h-3.5" />
          <span>Bayar Sandbox</span>
        </a>
      </div>
    </div>

    <!-- Footer -->
    <template #footer>
      <div class="flex items-center justify-end">
        <button
          type="button"
          @click="emit('close')"
          class="h-8 px-4 rounded-lg border border-slate-300 hover:bg-slate-100 text-xs font-bold text-jetblack transition cursor-pointer"
        >
          Tutup
        </button>
      </div>
    </template>
  </BaseModal>
</template>
