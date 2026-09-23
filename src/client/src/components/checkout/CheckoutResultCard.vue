<script setup lang="ts">
import {
  CreditCard,
  CheckCircle2,
  ExternalLink,
  Copy,
  Check,
  QrCode,
  Building,
} from "lucide-vue-next";
import { formatRupiah } from "../../lib/utils";
import { useClipboard } from "../../composables/useClipboard";

defineProps<{
  checkoutResult: {
    success: boolean;
    checkoutUrl?: string;
    hostedPayUrl?: string;
    transactionId?: string;
    scenario?: string;
    paymentRail?: string;
    paymentCode?: string;
    qrDataUrl?: string;
    vaBank?: string;
    amount?: number;
    platformFee?: number;
    netDisbursementAmount?: number;
  } | null;
}>();

const { copied, copy } = useClipboard();
const { copied: copiedCode, copy: copyCode } = useClipboard();
</script>

<template>
  <div class="space-y-3 flex flex-col h-full">
    <div class="flex items-center justify-between">
      <h2 class="text-xs font-bold uppercase tracking-wider text-jetblack/80">
        Hasil Sesi Transaksi
      </h2>
    </div>

    <!-- Active Result Card -->
    <div v-if="checkoutResult" class="space-y-2.5 text-xs flex-1 flex flex-col justify-between">
      <div class="p-3.5 rounded-xl bg-jetblack text-white space-y-2">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-1.5 text-xs font-bold text-gold">
            <CheckCircle2 class="w-3.5 h-3.5" />
            <span>Sesi Checkout Siap</span>
          </div>
          <span class="font-mono text-[10px] text-white/50 truncate max-w-[140px]">
            {{ checkoutResult.transactionId }}
          </span>
        </div>

        <div class="grid grid-cols-2 gap-2 text-[11px] font-mono bg-white/5 p-2 rounded-lg">
          <div>
            <span class="text-white/40 block text-[10px]">Total Tagihan:</span>
            <span class="font-bold text-white">{{ formatRupiah(checkoutResult.amount || 0) }}</span>
          </div>
          <div>
            <span class="text-white/40 block text-[10px]">Net Payout (95%):</span>
            <span class="font-bold text-gold">{{
              formatRupiah(checkoutResult.netDisbursementAmount || 0)
            }}</span>
          </div>
        </div>

        <!-- Custom Checkout Details (QRIS / VA) -->
        <div
          v-if="checkoutResult.paymentRail === 'qris' && checkoutResult.qrDataUrl"
          class="p-2.5 bg-white/5 rounded-lg flex items-center gap-3"
        >
          <img
            :src="checkoutResult.qrDataUrl"
            alt="QRIS"
            class="w-16 h-16 rounded bg-white p-1 shrink-0"
          />
          <div class="space-y-0.5 overflow-hidden">
            <span class="text-[10px] font-bold text-emerald-400 flex items-center gap-1">
              <QrCode class="w-3 h-3" /> QRIS DANA Siap
            </span>
            <p class="text-[10px] text-white/70">Pembeli dapat scan langsung di halaman /pay.</p>
          </div>
        </div>

        <div
          v-else-if="checkoutResult.paymentRail === 'va' && checkoutResult.paymentCode"
          class="p-2 bg-white/5 rounded-lg space-y-1"
        >
          <div class="flex items-center justify-between text-[10px]">
            <span class="text-white/60 flex items-center gap-1">
              <Building class="w-3 h-3 text-cyan-400" /> VA {{ checkoutResult.vaBank || "Bank" }}
            </span>
            <button
              @click="copyCode(checkoutResult.paymentCode || '')"
              type="button"
              class="text-gold hover:text-gold-light flex items-center gap-1 font-semibold cursor-pointer"
            >
              <component :is="copiedCode ? Check : Copy" class="w-3 h-3" />
              <span>{{ copiedCode ? "Tersalin" : "Salin VA" }}</span>
            </button>
          </div>
          <div class="font-mono font-bold text-xs text-white tracking-wider">
            {{ checkoutResult.paymentCode }}
          </div>
        </div>

        <div class="pt-1 flex items-center gap-2">
          <a
            :href="checkoutResult.hostedPayUrl || checkoutResult.checkoutUrl"
            target="_blank"
            class="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-gold text-jetblack font-bold text-xs hover:bg-gold/90 transition shadow-xs"
          >
            <span>Buka Halaman Checkout</span>
            <ExternalLink class="w-3 h-3" />
          </a>

          <button
            v-if="checkoutResult.hostedPayUrl || checkoutResult.checkoutUrl"
            type="button"
            @click="copy(checkoutResult.hostedPayUrl || checkoutResult.checkoutUrl || '')"
            class="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-medium text-xs transition inline-flex items-center gap-1 cursor-pointer"
            title="Salin URL Checkout"
          >
            <component
              :is="copied ? Check : Copy"
              class="w-3.5 h-3.5"
              :class="copied ? 'text-emerald-400' : ''"
            />
            <span class="hidden sm:inline">{{ copied ? "Tersalin" : "Salin" }}</span>
          </button>
        </div>
      </div>

      <p class="text-[10px] text-jetblack/55 leading-relaxed">
        DANA Gapura Custom Checkout siap memproses transaksi. Webhook otomatis menerbitkan lisensi
        &amp; mencatat saldo siap cair.
      </p>
    </div>

    <!-- Minimal Compact Placeholder -->
    <div
      v-else
      class="flex-1 min-h-[140px] flex flex-col items-center justify-center text-center text-jetblack/40 p-3 border border-dashed border-jetblack/15 rounded-xl bg-jetblack/[0.01]"
    >
      <CreditCard class="w-6 h-6 mb-1 opacity-25" />
      <p class="text-[11px] font-medium text-jetblack/50">
        Invoice URL &amp; ringkasan transaksi akan muncul di sini.
      </p>
    </div>
  </div>
</template>
