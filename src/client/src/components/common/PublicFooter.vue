<script setup lang="ts">
import logoUrl from "@/assets/logo.svg";
import { COMPANY_INFO } from "../../constants/company";
import {
  MapPin,
  Phone,
  Mail,
  Clock,
  ShieldCheck,
  CheckCircle2,
  ExternalLink,
  MessageSquare,
} from "lucide-vue-next";

defineProps<{
  isAdmin?: boolean;
}>();
</script>

<template>
  <footer class="mt-auto border-t border-jetblack/10 bg-white py-12">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 space-y-10">
      <!-- Main Grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8">
        <!-- Column 1 & 2: Entity & Bio -->
        <div class="space-y-4 lg:col-span-2">
          <div class="flex items-center gap-2">
            <img :src="logoUrl" alt="tertaut.com" class="w-8 h-8 rounded-lg shadow-xs" />
            <span class="font-extrabold text-jetblack font-mono text-base"
              >tertaut<span class="text-gold">.com</span></span
            >
          </div>

          <div class="space-y-1">
            <div class="text-xs font-bold text-jetblack uppercase tracking-wider font-mono">
              Badan Usaha Resmi
            </div>
            <div class="text-sm font-black text-jetblack">
              {{ COMPANY_INFO.legalName }}
            </div>
            <p class="text-xs text-jetblack/70 leading-relaxed pt-1">
              Platform Merchant of Record (MoR) resmi, proteksi lisensi kriptografis software
              offline-first, dan gerbang pembayaran digital untuk software builder serta pengguna di
              Indonesia.
            </p>
          </div>

          <!-- Contact details snippet -->
          <div
            class="space-y-2 pt-2 text-xs text-jetblack/80 font-sans border-t border-jetblack/10"
          >
            <div class="flex items-start gap-2">
              <MapPin class="w-4 h-4 text-forest shrink-0 mt-0.5" />
              <span>{{ COMPANY_INFO.address.full }}</span>
            </div>
            <div class="flex items-center gap-2">
              <Phone class="w-4 h-4 text-forest shrink-0" />
              <a
                :href="COMPANY_INFO.contact.whatsappUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="hover:text-forest font-mono font-bold transition flex items-center gap-1"
              >
                <span>{{ COMPANY_INFO.contact.phone }}</span>
                <span
                  class="text-[10px] bg-forest/10 text-forest px-1.5 py-0.2 rounded font-sans font-semibold"
                  >WhatsApp</span
                >
              </a>
            </div>
            <div class="flex items-center gap-2">
              <Mail class="w-4 h-4 text-forest shrink-0" />
              <a
                :href="`mailto:${COMPANY_INFO.contact.email}`"
                class="hover:text-forest transition font-mono font-semibold"
              >
                {{ COMPANY_INFO.contact.email }}
              </a>
            </div>
            <div class="flex items-center gap-2 text-jetblack/60 text-[11px]">
              <Clock class="w-3.5 h-3.5 shrink-0" />
              <span>Jam Operasional: {{ COMPANY_INFO.operatingHours }}</span>
            </div>
          </div>
        </div>

        <!-- Column 3: Layanan & Fitur Platform -->
        <div class="space-y-2.5">
          <div class="text-xs font-bold text-jetblack uppercase tracking-wider font-mono">
            Layanan &amp; Platform
          </div>
          <ul class="space-y-2 text-xs text-jetblack/70">
            <li>
              <router-link
                to="/products"
                class="hover:text-jetblack font-bold text-forest transition flex items-center gap-1"
              >
                <span>Biaya Platform (5% Flat)</span>
                <span class="text-[10px] bg-forest/10 text-forest px-1.5 py-0.5 rounded"
                  >Rp 0 Bulanan</span
                >
              </router-link>
            </li>
            <li>
              <router-link
                to="/demo/checkout"
                class="hover:text-jetblack transition flex items-center gap-1 font-semibold text-jetblack"
              >
                <span>⚡ Simulasi Demo Checkout</span>
              </router-link>
            </li>
            <li>
              <a href="/#solusi" class="hover:text-jetblack transition">
                Universal Licensing Ed25519
              </a>
            </li>
            <li>
              <a href="/#solusi" class="hover:text-jetblack transition">
                AI Proxy Shield &amp; Vault Key
              </a>
            </li>
            <li>
              <a href="/#kalkulator" class="hover:text-jetblack transition">
                Kalkulator Pendapatan Bersih
              </a>
            </li>
          </ul>
        </div>

        <!-- Column 4: Perusahaan & Bantuan -->
        <div class="space-y-2.5">
          <div class="text-xs font-bold text-jetblack uppercase tracking-wider font-mono">
            Kontak &amp; Dukungan
          </div>
          <ul class="space-y-2 text-xs text-jetblack/70">
            <li>
              <router-link
                to="/contact"
                class="hover:text-jetblack font-semibold transition flex items-center gap-1 text-jetblack"
              >
                <MessageSquare class="w-3.5 h-3.5 text-gold" />
                <span>Hubungi Kami</span>
              </router-link>
            </li>
            <li>
              <a
                :href="COMPANY_INFO.contact.whatsappUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="hover:text-forest transition inline-flex items-center gap-1"
              >
                <span>WhatsApp Customer Care</span>
                <ExternalLink class="w-3 h-3 text-jetblack/40" />
              </a>
            </li>
            <li>
              <a href="/#faq" class="hover:text-jetblack transition">Pertanyaan Umum (FAQ)</a>
            </li>
            <li>
              <router-link to="/dashboard/docs" class="hover:text-jetblack transition">
                Dokumentasi Integrasi SDK
              </router-link>
            </li>
            <li v-if="isAdmin">
              <router-link
                to="/panel"
                class="hover:text-jetblack transition font-semibold text-gold-dark"
              >
                Admin Panel
              </router-link>
            </li>
          </ul>
        </div>

        <!-- Column 5: Kebijakan & Legalitas -->
        <div class="space-y-2.5">
          <div class="text-xs font-bold text-jetblack uppercase tracking-wider font-mono">
            Legal &amp; Kepatuhan
          </div>
          <ul class="space-y-2 text-xs text-jetblack/70">
            <li>
              <router-link to="/terms" class="hover:text-jetblack transition">
                Syarat &amp; Ketentuan Layanan
              </router-link>
            </li>
            <li>
              <router-link to="/privacy" class="hover:text-jetblack transition">
                Kebijakan Privasi
              </router-link>
            </li>
            <li>
              <router-link to="/refund" class="hover:text-jetblack transition">
                Kebijakan Pengembalian Dana
              </router-link>
            </li>
            <li>
              <div class="pt-2">
                <div class="flex items-center gap-1.5 text-[11px] font-bold text-forest">
                  <ShieldCheck class="w-4 h-4 text-forest shrink-0" />
                  <span>Merchant Terverifikasi</span>
                </div>
                <p class="text-[10px] text-jetblack/60 pt-0.5">
                  Operasional di bawah naungan {{ COMPANY_INFO.legalName }}.
                </p>
              </div>
            </li>
          </ul>
        </div>
      </div>

      <!-- Trust Badges Bar -->
      <div
        class="pt-6 border-t border-jetblack/10 grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px] text-jetblack/70"
      >
        <div class="flex items-center gap-2">
          <CheckCircle2 class="w-4 h-4 text-forest shrink-0" />
          <span>QRIS &amp; Virtual Account Otomatis</span>
        </div>
        <div class="flex items-center gap-2">
          <CheckCircle2 class="w-4 h-4 text-forest shrink-0" />
          <span>Faktur Pajak &amp; PPN 11% Sah</span>
        </div>
        <div class="flex items-center gap-2">
          <CheckCircle2 class="w-4 h-4 text-forest shrink-0" />
          <span>Enkripsi 256-Bit SSL/TLS</span>
        </div>
        <div class="flex items-center gap-2">
          <CheckCircle2 class="w-4 h-4 text-forest shrink-0" />
          <span>Garansi Aktivasi Lisensi 100%</span>
        </div>
      </div>

      <!-- Bottom Copyright -->
      <div
        class="pt-6 border-t border-jetblack/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-jetblack/50"
      >
        <div>
          &copy; {{ new Date().getFullYear() }} {{ COMPANY_INFO.legalName }} ({{
            COMPANY_INFO.brandName
          }}). Seluruh hak cipta dilindungi undang-undang.
        </div>
        <div class="flex items-center gap-3">
          <router-link to="/terms" class="hover:text-jetblack transition"
            >Syarat &amp; Ketentuan</router-link
          >
          <span>•</span>
          <router-link to="/privacy" class="hover:text-jetblack transition">Privasi</router-link>
          <span>•</span>
          <router-link to="/refund" class="hover:text-jetblack transition">Refund</router-link>
          <span>•</span>
          <router-link to="/contact" class="hover:text-jetblack transition">Kontak</router-link>
        </div>
      </div>
    </div>
  </footer>
</template>
