<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { api } from "../lib/api";
import logoUrl from "@/assets/logo.svg";
import { Printer, ArrowLeft, ShieldCheck, Calendar, AlertCircle } from "lucide-vue-next";
import TableContainer from "../components/common/TableContainer.vue";
import StatusBadge from "../components/common/StatusBadge.vue";
import CopyButton from "../components/common/CopyButton.vue";

const route = useRoute();
const router = useRouter();
const txId = computed(
  () =>
    (route.params.txId as string) ||
    (route.query.externalId as string) ||
    (route.query.txId as string) ||
    ""
);
const ticket = computed(() => (route.query.ticket as string) || "");

const loading = ref(true);
const error = ref<string | null>(null);
const invoice = ref<any>(null);

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
  if (typeof amount !== "number" || isNaN(amount)) return "0";
  return amount.toLocaleString("id-ID");
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
      <div class="flex items-center justify-center gap-3 pt-2">
        <button
          @click="router.push('/login?redirect=' + encodeURIComponent($route.fullPath))"
          class="px-4 py-2 rounded-lg bg-white text-black text-xs font-bold hover:bg-slate-200 transition cursor-pointer"
        >
          Login
        </button>
        <button
          @click="router.push('/')"
          class="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold transition cursor-pointer"
        >
          Ke Beranda
        </button>
      </div>
    </div>

    <!-- Invoice Sheet (Print Optimized A4 Container) -->
    <div
      v-else-if="invoice"
      id="printable-invoice"
      class="w-full max-w-3xl bg-white text-[#111215] rounded-2xl shadow-2xl p-8 sm:p-12 space-y-8 relative overflow-hidden border border-slate-200"
    >
      <!-- Background Watermark Stamp -->
      <div
        class="absolute right-8 top-12 opacity-5 pointer-events-none select-none text-[120px] font-black tracking-tighter leading-none"
      >
        {{ invoice.payment?.status === "PAID" ? "PAID" : invoice.payment?.status || "INVOICE" }}
      </div>

      <!-- Header Section -->
      <div
        class="flex flex-col sm:flex-row sm:items-start justify-between gap-6 pb-6 border-b border-slate-200"
      >
        <div class="space-y-1.5">
          <div class="flex items-center gap-2">
            <img :src="logoUrl" alt="tertaut.com" class="w-8 h-8 rounded-lg shadow-xs" />
            <span class="font-mono text-base font-extrabold tracking-tight"
              >tertaut<span class="text-[#D4AF37]">.com</span></span
            >
          </div>
          <p class="text-[11px] text-slate-500 font-medium">
            Platform Pembayaran &amp; Lisensi Digital
          </p>
          <p class="text-[10px] text-slate-400">PT RETAS LINTAS BATAS • support@tertaut.com</p>
        </div>

        <div class="sm:text-right space-y-1">
          <div class="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Bukti Pembayaran / Invoice
          </div>
          <div class="font-mono font-black text-lg text-black">{{ invoice.invoiceNumber }}</div>
          <div class="text-[11px] text-slate-500 flex items-center sm:justify-end gap-1.5">
            <Calendar class="w-3.5 h-3.5 text-slate-400" />
            <span>{{ formatDate(invoice.payment?.paidAt || invoice.payment?.createdAt) }}</span>
          </div>
          <!-- Paid Badge -->
          <div class="pt-1 flex sm:justify-end">
            <StatusBadge :status="invoice.payment?.status" />
          </div>
        </div>
      </div>

      <!-- Parties Metadata (2 Column) -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs pb-6 border-b border-slate-200">
        <div class="space-y-1">
          <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400"
            >Ditagihkan Kepada (Pembeli)</span
          >
          <div v-if="invoice.buyer?.name" class="font-bold text-black text-sm">
            {{ invoice.buyer.name }}
          </div>
          <div
            :class="
              invoice.buyer?.name
                ? 'text-[11px] font-medium text-slate-600'
                : 'font-bold text-black text-sm'
            "
          >
            {{ invoice.buyer?.email }}
          </div>
          <div class="text-[11px] text-slate-500">
            Kanal Pembayaran: {{ invoice.payment?.channel || invoice.payment?.provider || "-" }}
          </div>
          <div class="text-[10px] font-mono text-slate-400">
            TX Ref: {{ invoice.transactionId }}
          </div>
        </div>

        <div class="space-y-1 sm:text-right">
          <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400"
            >Pembangun / Kreator Software</span
          >
          <div class="font-bold text-black text-sm">{{ invoice.seller?.name }}</div>
          <div v-if="invoice.seller?.email" class="text-[11px] text-slate-500">
            {{ invoice.seller.email }}
          </div>
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
        <TableContainer
          :negative-margin="false"
          wrapper-class="border-0"
          table-class="border-b-0 w-full text-xs"
          thead-class="border-b border-slate-300 text-slate-500 font-semibold text-left bg-transparent"
          tbody-class="divide-y divide-slate-100"
        >
          <template #head>
            <tr>
              <th class="py-2 pr-4">Deskripsi Produk</th>
              <th class="py-2 px-3 text-center">Durasi</th>
              <th class="py-2 pl-4 text-right">Jumlah</th>
            </tr>
          </template>
          <tr>
            <td class="py-4 pr-4">
              <div class="font-bold text-black text-sm">{{ invoice.item?.name }}</div>
              <div class="text-[11px] text-slate-500 mt-0.5">{{ invoice.item?.description }}</div>
            </td>
            <td class="py-4 px-3 text-center font-mono text-slate-600">
              {{
                !invoice.item?.grantDays || invoice.item.grantDays >= 36500
                  ? "Permanen (Lifetime)"
                  : `${invoice.item.grantDays} Hari`
              }}
            </td>
            <td class="py-4 pl-4 text-right font-mono font-bold text-black text-sm">
              Rp
              {{
                formatIdr(
                  (invoice.financials?.grossAmount || 0) + (invoice.financials?.discountAmount || 0)
                )
              }}
            </td>
          </tr>
        </TableContainer>
      </div>

      <!-- Financial Calculation Summary -->
      <div
        class="flex flex-col sm:flex-row justify-between items-start gap-6 pt-4 border-t border-slate-200"
      >
        <!-- Left Column: License Key & Metadata Cards -->
        <div class="w-full sm:max-w-xs space-y-3">
          <!-- License Key Highlight Card -->
          <div
            v-if="invoice.licenseKey"
            class="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5"
          >
            <div
              class="flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase tracking-wider"
            >
              <span>Kunci Lisensi Anda</span>
              <CopyButton
                :text="invoice.licenseKey"
                :show-label="true"
                button-class="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-800 transition cursor-pointer"
                icon-class="w-3 h-3"
              />
            </div>
            <div
              class="font-mono text-xs font-bold text-black bg-white px-2 py-1 rounded border border-slate-200 select-all break-all"
            >
              {{ invoice.licenseKey }}
            </div>
          </div>

          <!-- Metadata / Subscription Detail Card -->
          <div
            v-if="invoice.metadata && Object.keys(invoice.metadata).length > 0"
            class="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs"
          >
            <div class="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              Metadata / Info Langganan
            </div>
            <div class="space-y-1 font-mono text-[11px]">
              <div
                v-for="(val, key) in invoice.metadata"
                :key="key"
                class="flex items-start justify-between gap-2 border-b border-slate-200/60 last:border-none pb-1 last:pb-0"
              >
                <span class="text-slate-500 font-medium">{{ key }}:</span>
                <span class="font-bold text-slate-800 break-all text-right">{{
                  typeof val === "object" ? JSON.stringify(val) : val
                }}</span>
              </div>
            </div>
          </div>

          <!-- Fulfillment note card if no license key and no metadata -->
          <div
            v-else-if="!invoice.licenseKey"
            class="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1 text-xs"
          >
            <div class="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              Status Pemenuhan
            </div>
            <p class="text-[11px] text-slate-600">
              Transaksi tercatat &amp; terverifikasi sah dalam sistem tertaut.com.
            </p>
          </div>
        </div>

        <!-- Calculations -->
        <div class="w-full sm:w-64 space-y-2 text-xs text-slate-600 ml-auto">
          <div class="flex justify-between">
            <span>Dasar Pengenaan Pajak (DPP)</span>
            <span class="font-mono">Rp {{ formatIdr(invoice.financials?.dpp) }}</span>
          </div>
          <div class="flex justify-between">
            <span>PPN 11% (Termasuk)</span>
            <span class="font-mono">Rp {{ formatIdr(invoice.financials?.ppn11) }}</span>
          </div>
          <div
            v-if="invoice.financials?.discountAmount > 0"
            class="flex justify-between text-emerald-700"
          >
            <span>Diskon Kupon ({{ invoice.financials?.couponCode }})</span>
            <span class="font-mono">-Rp {{ formatIdr(invoice.financials?.discountAmount) }}</span>
          </div>
          <div
            class="flex justify-between pt-2 border-t border-slate-300 font-bold text-black text-base"
          >
            <span>Total Pembayaran</span>
            <span class="font-mono text-black"
              >Rp {{ formatIdr(invoice.financials?.grossAmount) }}</span
            >
          </div>
        </div>
      </div>

      <!-- Legal Footer -->
      <div
        class="pt-6 border-t border-slate-200 text-[10px] text-slate-500 space-y-1.5 text-center"
      >
        <p class="font-bold text-slate-700">
          Faktur ini adalah bukti transaksi resmi yang sah dan diterbitkan secara elektronik oleh
          platform tertaut.com di bawah naungan <strong>PT RETAS LINTAS BATAS</strong> sebagai
          penyedia infrastruktur pembayaran &amp; lisensi resmi.
        </p>
        <p>
          Alamat: Jl. Raya Batang-Batang, Kab. Sumenep, Jawa Timur • WhatsApp Dukungan: +62
          851-8313-1249 • Email: support@tertaut.com
        </p>
      </div>
    </div>
  </div>
</template>

<style>
@media print {
  body,
  .min-h-screen {
    background: white !important;
    color: black !important;
    padding: 0 !important;
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
