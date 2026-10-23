<script setup lang="ts">
import { X, Check, Copy, Wallet, ArrowUpRight, Zap, ExternalLink } from "lucide-vue-next";
import type { AppItem } from "../../types/app";
import type { TransactionItem } from "../../types/transaction";
import { envPath, type DashboardEnv } from "../../lib/environment";
import { formatRupiah, formatDate as formatUtilsDate } from "../../lib/utils";
import { useClipboard } from "../../composables/useClipboard";

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

const { copied: txIdCopied, copy: copyTxId } = useClipboard();

function getAppName(appId: string): string {
  const app = props.appsList.find((a) => a.id === appId);
  return app ? app.name : appId;
}

function formatDate(dateStr?: string | null): string {
  return formatUtilsDate(dateStr, { includeTime: true });
}
</script>

<template>
  <div
    v-if="isOpen && transaction"
    class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-fadeIn"
    @click.self="emit('close')"
  >
    <div
      class="bg-white border border-jetblack/15 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-scaleIn flex flex-col max-h-[90vh]"
    >
      <!-- Header -->
      <div
        class="px-5 py-3.5 border-b border-jetblack/10 flex items-center justify-between bg-white shrink-0"
      >
        <div class="flex items-center gap-2">
          <div class="w-2 h-2 rounded-full bg-gold"></div>
          <h3 class="text-xs font-bold uppercase tracking-wider text-jetblack">
            Rincian Transaksi Builder & MoR
          </h3>
        </div>
        <button
          type="button"
          @click="emit('close')"
          class="text-jetblack/40 hover:text-jetblack p-1 rounded-md hover:bg-jetblack/5 transition cursor-pointer"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Body -->
      <div class="px-5 py-4 overflow-y-auto space-y-4 text-xs">
        <!-- Top Amount Card -->
        <div class="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
          <div class="flex items-center justify-between">
            <span class="text-[11px] text-jetblack/60 font-semibold">Total Nilai Pembayaran</span>
            <span
              :class="
                transaction.paymentStatus === 'PAID'
                  ? 'bg-forest/10 text-forest border-forest/20'
                  : 'bg-amber-500/10 text-amber-700 border-amber-500/20'
              "
              class="text-[10px] font-bold px-2 py-0.5 rounded-full border"
            >
              {{ transaction.paymentStatus === "PAID" ? "LUNAS (PAID)" : "MENUNGGU PEMBAYARAN" }}
            </span>
          </div>
          <div class="text-2xl font-mono font-bold text-jetblack">
            {{ formatRupiah(transaction.grossAmount) }}
          </div>
          <div class="pt-2 border-t border-slate-200 grid grid-cols-2 gap-2 text-[11px]">
            <div>
              <span class="text-jetblack/50 block">Biaya MoR Tertaut (5%):</span>
              <span class="font-mono font-bold text-red-600"
                >- {{ formatRupiah(transaction.platformFee) }}</span
              >
            </div>
            <div>
              <span class="text-jetblack/50 block">Net Builder (95%):</span>
              <span class="font-mono font-bold text-forest">{{
                formatRupiah(transaction.netAmount)
              }}</span>
            </div>
          </div>
        </div>

        <!-- Transaction Fields Details -->
        <div class="space-y-2.5">
          <div class="flex justify-between items-center py-1 border-b border-slate-100">
            <span class="text-jetblack/60">ID Transaksi</span>
            <div class="flex items-center gap-1.5">
              <span class="font-mono font-semibold text-jetblack">{{ transaction.id }}</span>
              <button
                type="button"
                @click="copyTxId(transaction.id)"
                class="p-1 rounded text-slate-400 hover:text-slate-700 transition"
                title="Salin ID Transaksi"
              >
                <component :is="txIdCopied ? Check : Copy" class="w-3 h-3 text-gold" />
              </button>
            </div>
          </div>
          <div class="flex justify-between py-1 border-b border-slate-100">
            <span class="text-jetblack/60">Email Klien / Pembeli</span>
            <span class="font-semibold text-jetblack">{{ transaction.customerEmail || "-" }}</span>
          </div>
          <div
            v-if="transaction.customerName"
            class="flex justify-between py-1 border-b border-slate-100"
          >
            <span class="text-jetblack/60">Nama Pelanggan</span>
            <span class="font-semibold text-jetblack">{{ transaction.customerName }}</span>
          </div>
          <div
            v-if="transaction.couponCode"
            class="flex justify-between py-1 border-b border-slate-100"
          >
            <span class="text-jetblack/60">Kupon Diskon</span>
            <span
              class="font-mono font-bold text-jetblack bg-gold/15 px-1.5 py-0.2 rounded border border-gold/30"
            >
              {{ transaction.couponCode }}
            </span>
          </div>
          <div class="flex justify-between py-1 border-b border-slate-100">
            <span class="text-jetblack/60">Aplikasi / Software</span>
            <span class="font-semibold text-jetblack">{{ getAppName(transaction.appId) }}</span>
          </div>
          <div class="flex justify-between py-1 border-b border-slate-100">
            <span class="text-jetblack/60">Kanal Pembayaran</span>
            <span class="font-mono font-semibold text-jetblack uppercase">{{
              transaction.paymentChannel || "QRIS"
            }}</span>
          </div>
          <div class="flex justify-between py-1 border-b border-slate-100">
            <span class="text-jetblack/60">Gateway / MoR Provider</span>
            <span class="font-semibold text-jetblack uppercase">{{
              transaction.paymentProvider || "XENDIT"
            }}</span>
          </div>
          <div class="flex justify-between py-1 border-b border-slate-100">
            <span class="text-jetblack/60">Status Pencairan</span>
            <span
              class="font-semibold"
              :class="
                transaction.disbursementStatus === 'COMPLETED' ? 'text-forest' : 'text-slate-600'
              "
            >
              {{
                transaction.disbursementStatus === "COMPLETED"
                  ? "Sudah Ditransfer"
                  : "Menunggu Pencairan"
              }}
            </span>
          </div>
          <div class="flex justify-between py-1 border-b border-slate-100">
            <span class="text-jetblack/60">Waktu Pembayaran</span>
            <span class="text-jetblack">{{
              formatDate(transaction.paidAt || transaction.createdAt)
            }}</span>
          </div>
          <div
            v-if="transaction.metadata && Object.keys(transaction.metadata).length > 0"
            class="pt-2 border-t border-slate-100 space-y-1.5"
          >
            <span class="text-[10px] font-bold text-jetblack/50 uppercase tracking-wider block">
              Metadata Kustom SaaS
            </span>
            <div
              class="p-2.5 rounded-xl bg-jetblack/5 font-mono text-[11px] text-jetblack overflow-x-auto max-h-36 border border-jetblack/10"
            >
              <pre class="whitespace-pre-wrap leading-relaxed">{{
                JSON.stringify(transaction.metadata, null, 2)
              }}</pre>
            </div>
          </div>
        </div>

        <!-- Saldo info: mengarahkan ke /balances untuk tarik dana agregat -->
        <div
          v-if="
            transaction.paymentStatus === 'PAID' && transaction.disbursementStatus !== 'COMPLETED'
          "
          class="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-start gap-2.5"
        >
          <Wallet class="w-4 h-4 text-gold shrink-0 mt-0.5" />
          <div class="space-y-1">
            <div class="text-xs font-bold text-jetblack">Saldo Menunggu Penarikan</div>
            <p class="text-[11px] text-jetblack/60">
              Net builder
              <span class="font-mono font-bold text-forest">{{
                formatRupiah(transaction.netAmount)
              }}</span>
              dari transaksi ini masuk ke akumulasi saldo Anda. Penarikan dana dilakukan secara
              agregat dari seluruh software di halaman Balances.
            </p>
            <router-link
              :to="envPath(env, '/balances')"
              class="inline-flex items-center gap-1.5 mt-1 text-[11px] font-bold text-jetblack hover:text-gold transition"
            >
              <ArrowUpRight class="w-3.5 h-3.5" />
              Tarik Dana di Halaman Balances
            </router-link>
          </div>
        </div>

        <!-- Sandbox Real Gateway Testing box -->
        <div
          v-if="env === 'sandbox' && transaction.paymentStatus === 'PENDING'"
          class="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-2"
        >
          <div class="flex items-center gap-1.5 text-xs font-bold text-amber-900">
            <Zap class="w-3.5 h-3.5 text-amber-600" />
            <span>Sandbox Gateway Testing</span>
          </div>
          <p class="text-[11px] text-amber-800/80">
            Transaksi ini berada di mode Sandbox. Buka tautan kasir / invoice gateway resmi untuk
            menyelesaikan simulasi pembayaran langsung melalui simulator resmi Payment Gateway.
          </p>
          <a
            v-if="transaction.xenditInvoiceUrl"
            :href="transaction.xenditInvoiceUrl"
            target="_blank"
            class="w-full py-2 btn-gold rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer text-center block"
          >
            <ExternalLink class="w-3.5 h-3.5" />
            <span>Buka Halaman Kasir Sandbox</span>
          </a>
        </div>
      </div>

      <!-- Footer -->
      <div
        class="px-5 py-3 border-t border-jetblack/10 bg-slate-50/70 shrink-0 flex items-center justify-end"
      >
        <button
          type="button"
          @click="emit('close')"
          class="h-8 px-4 rounded-lg border border-slate-300 hover:bg-slate-100 text-xs font-bold text-jetblack transition cursor-pointer"
        >
          Tutup
        </button>
      </div>
    </div>
  </div>
</template>
