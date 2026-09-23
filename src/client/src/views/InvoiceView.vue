<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { api } from "../lib/api";
import {
  Printer,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  ShieldCheck,
  Building2,
  Calendar,
  Receipt,
  Download,
} from "lucide-vue-next";
import { useClipboard } from "../composables/useClipboard";

const route = useRoute();
const router = useRouter();
const txId = computed(() => (route.params.txId as string) || "");
const ticket = computed(() => (route.query.ticket as string) || "");

const loading = ref(true);
const error = ref<string | null>(null);
const invoice = ref<any>(null);

const { copy, copied } = useClipboard();

async function loadInvoice() {
  if (!txId.value) {
    error.value = "ID Transaksi tidak ditemukan.";
    loading.value = false;
    return;
  }

  loading.value = true;
  error.value = null;

  try {
    const res = await api.getInvoiceData(txId.value, ticket.value);
    if (res.success && res.invoice) {
      invoice.value = res.invoice;
    } else {
      error.value = res.error || "Gagal mengambil data faktur transaksi.";
    }
  } catch (err: any) {
    error.value = err.message || "Terjadi kesalahan saat memuat faktur.";
  } finally {
    loading.value = false;
  }
}

function handlePrint() {
  window.print();
}

function formatDate(isoString?: string | null) {
  if (!isoString) return "-";
  return new Date(isoString).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatIdr(amount?: number) {
  return (amount || 0).toLocaleString("id-ID");
}

onMounted(() => {
  loadInvoice();
});
</script>

<template>
  <div
    class="min-h-screen bg-[#0A0B0D] text-slate-100 flex flex-col items-center py-6 px-4 sm:px-6"
  >
    <!-- Top Action Bar (Hidden on Print) -->
    <div class="w-full max-w-3xl mb-6 flex items-center justify-between no-print">
      <button
        @click="router.back()"
        class="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition cursor-pointer"
      >
        <ArrowLeft class="w-4 h-4" />
        <span>Kembali</span>
      </button>

      <div class="flex items-center gap-3">
        <button
          @click="handlePrint"
          class="h-9 px-4 rounded-lg bg-white text-black text-xs font-bold inline-flex items-center gap-2 hover:bg-slate-200 transition shadow-sm cursor-pointer"
        >
          <Printer class="w-4 h-4" />
          <span>Cetak / Unduh PDF</span>
        </button>
      </div>
    </div>

    <!-- Loading State -->
    <div
      v-if="loading"
      class="w-full max-w-3xl py-24 flex flex-col items-center justify-center gap-3"
    >
      <div class="w-8 h-8 border-2 border-gold/20 border-t-gold rounded-full animate-spin"></div>
      <p class="text-xs text-slate-400">Memuat faktur resmi...</p>
    </div>

    <!-- Error State -->
    <div
      v-else-if="error"
      class="w-full max-w-md p-6 rounded-2xl bg-white/5 border border-red-500/20 text-center space-y-4"
    >
      <AlertCircle class="w-10 h-10 text-red-400 mx-auto" />
      <h2 class="text-sm font-bold text-white">Gagal Membuka Faktur</h2>
      <p class="text-xs text-slate-400">{{ error }}</p>
      <button
        @click="router.push('/')"
        class="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold transition"
      >
        Ke Beranda
      </button>
    </div>

    <!-- Invoice Sheet (Print Optimized A4 Container) -->
    <div
      v-else-if="invoice"
      id="printable-invoice"
      class="w-full max-w-3xl bg-white text-[#111215] rounded-2xl shadow-2xl p-8 sm:p-12 space-y-8 relative overflow-hidden border border-slate-200"
    >
      <!-- Background MoR Watermark Stamp -->
      <div
        class="absolute right-8 top-12 opacity-5 pointer-events-none select-none text-[120px] font-black tracking-tighter leading-none"
      >
        PAID
      </div>

      <!-- Header Section -->
      <div
        class="flex flex-col sm:flex-row sm:items-start justify-between gap-6 pb-6 border-b border-slate-200"
      >
        <div class="space-y-1.5">
          <div class="flex items-center gap-2">
            <div
              class="w-8 h-8 rounded-lg bg-black text-white flex items-center justify-center font-bold text-sm"
            >
              T
            </div>
            <span class="font-mono text-base font-extrabold tracking-tight"
              >tertaut<span class="text-[#D4AF37]">.com</span></span
            >
          </div>
          <p class="text-[11px] text-slate-500 font-medium">
            Merchant of Record untuk Software &amp; AI Tools
          </p>
          <p class="text-[10px] text-slate-400">
            PT Tertaut Digital Infrastruktur • support@tertaut.com
          </p>
        </div>

        <div class="sm:text-right space-y-1">
          <div class="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Bukti Pembayaran / Invoice
          </div>
          <div class="font-mono font-black text-lg text-black">{{ invoice.invoiceNumber }}</div>
          <div class="text-[11px] text-slate-500 flex items-center sm:justify-end gap-1.5">
            <Calendar class="w-3.5 h-3.5 text-slate-400" />
            <span>{{ formatDate(invoice.payment.paidAt || invoice.payment.createdAt) }}</span>
          </div>
          <!-- Paid Badge -->
          <div class="pt-1 flex sm:justify-end">
            <span
              v-if="invoice.payment.status === 'PAID'"
              class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 font-bold text-xs border border-emerald-200"
            >
              <CheckCircle2 class="w-3.5 h-3.5" />
              LUNAS (PAID)
            </span>
            <span
              v-else-if="invoice.payment.status === 'REFUNDED'"
              class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-50 text-red-700 font-bold text-xs border border-red-200"
            >
              <AlertCircle class="w-3.5 h-3.5" />
              DI-REFUND (REVOKED)
            </span>
            <span
              v-else
              class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-700 font-bold text-xs border border-amber-200"
            >
              {{ invoice.payment.status }}
            </span>
          </div>
        </div>
      </div>

      <!-- Parties Metadata (2 Column) -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs pb-6 border-b border-slate-200">
        <div class="space-y-1">
          <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400"
            >Ditagihkan Kepada (Pembeli)</span
          >
          <div class="font-bold text-black text-sm">{{ invoice.buyer.email }}</div>
          <div class="text-[11px] text-slate-500">
            Kanal Pembayaran: {{ invoice.payment.channel }}
          </div>
          <div class="text-[10px] font-mono text-slate-400">
            TX Ref: {{ invoice.transactionId }}
          </div>
        </div>

        <div class="space-y-1 sm:text-right">
          <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400"
            >Pembangun / Kreator Software</span
          >
          <div class="font-bold text-black text-sm">{{ invoice.seller.name }}</div>
          <div class="text-[11px] text-slate-500">{{ invoice.seller.email }}</div>
          <div class="text-[10px] text-slate-400 flex items-center sm:justify-end gap-1">
            <ShieldCheck class="w-3 h-3 text-emerald-600" />
            <span>Terverifikasi via tertaut.com Engine</span>
          </div>
        </div>
      </div>

      <!-- Itemized Table -->
      <div class="space-y-4">
        <div class="text-xs font-bold text-slate-900 uppercase tracking-wider">
          Rincian Pembelian
        </div>
        <table class="w-full text-xs">
          <thead>
            <tr class="border-b border-slate-300 text-slate-500 font-semibold text-left">
              <th class="py-2 pr-4">Deskripsi Produk</th>
              <th class="py-2 px-3 text-center">Durasi</th>
              <th class="py-2 pl-4 text-right">Jumlah</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr>
              <td class="py-4 pr-4">
                <div class="font-bold text-black text-sm">{{ invoice.item.name }}</div>
                <div class="text-[11px] text-slate-500 mt-0.5">{{ invoice.item.description }}</div>
              </td>
              <td class="py-4 px-3 text-center font-mono text-slate-600">
                {{ invoice.item.grantDays }} Hari
              </td>
              <td class="py-4 pl-4 text-right font-mono font-bold text-black text-sm">
                Rp
                {{
                  formatIdr(
                    invoice.financials.grossAmount + (invoice.financials.discountAmount || 0)
                  )
                }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Financial Calculation Summary -->
      <div
        class="flex flex-col sm:flex-row justify-between items-start gap-6 pt-4 border-t border-slate-200"
      >
        <!-- License Key Highlight Card -->
        <div
          v-if="invoice.licenseKey"
          class="w-full sm:max-w-xs p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5"
        >
          <div
            class="flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase tracking-wider"
          >
            <span>Kunci Lisensi Anda</span>
            <button
              @click="copy(invoice.licenseKey)"
              class="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-800 transition cursor-pointer"
            >
              <Check v-if="copied" class="w-3 h-3" />
              <Copy v-else class="w-3 h-3" />
              <span>{{ copied ? "Tersalin!" : "Salin" }}</span>
            </button>
          </div>
          <div
            class="font-mono text-xs font-bold text-black bg-white px-2 py-1 rounded border border-slate-200 select-all break-all"
          >
            {{ invoice.licenseKey }}
          </div>
        </div>

        <!-- Calculations -->
        <div class="w-full sm:w-64 space-y-2 text-xs text-slate-600 ml-auto">
          <div class="flex justify-between">
            <span>Dasar Pengenaan Pajak (DPP)</span>
            <span class="font-mono">Rp {{ formatIdr(invoice.financials.dpp) }}</span>
          </div>
          <div class="flex justify-between">
            <span>PPN 11% (Termasuk)</span>
            <span class="font-mono">Rp {{ formatIdr(invoice.financials.ppn11) }}</span>
          </div>
          <div
            v-if="invoice.financials.discountAmount > 0"
            class="flex justify-between text-emerald-700"
          >
            <span>Diskon Kupon ({{ invoice.financials.couponCode }})</span>
            <span class="font-mono">-Rp {{ formatIdr(invoice.financials.discountAmount) }}</span>
          </div>
          <div
            class="flex justify-between pt-2 border-t border-slate-300 font-bold text-black text-base"
          >
            <span>Total Pembayaran</span>
            <span class="font-mono text-black"
              >Rp {{ formatIdr(invoice.financials.grossAmount) }}</span
            >
          </div>
        </div>
      </div>

      <!-- Legal Footer -->
      <div class="pt-6 border-t border-slate-200 text-[10px] text-slate-400 space-y-1 text-center">
        <p>
          Faktur ini adalah bukti transaksi yang sah dan diterbitkan secara elektronik oleh platform
          tertaut.com sebagai Merchant of Record.
        </p>
        <p>
          Untuk pertanyaan atau dukungan teknis terkait lisensi, silakan hubungi tim dukungan
          melalui support@tertaut.com.
        </p>
      </div>
    </div>
  </div>
</template>

<style>
@media print {
  body {
    background: white !important;
    color: black !important;
  }
  .no-print {
    display: none !important;
  }
  #printable-invoice {
    border: none !important;
    box-shadow: none !important;
    padding: 0 !important;
    width: 100% !important;
    max-width: 100% !important;
  }
}
</style>
