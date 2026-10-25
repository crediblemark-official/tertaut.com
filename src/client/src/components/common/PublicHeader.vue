<script setup lang="ts">
import { ref, computed } from "vue";
import { useRouter } from "vue-router";
import { authClient } from "../../lib/auth";
import logoUrl from "@/assets/logo.svg";
import { ArrowRight, Menu, X, ShoppingBag, PhoneCall, FileText } from "lucide-vue-next";

const isMobileMenuOpen = ref(false);
const authSession = authClient.useSession();
const isLoggedIn = computed(() => !!authSession.value?.data?.user);
</script>

<template>
  <header class="border-b border-jetblack/10 sticky top-0 bg-white/95 backdrop-blur-md z-50">
    <div class="max-w-7xl mx-auto px-3.5 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
      <!-- Logo -->
      <router-link to="/" class="flex items-center gap-2 sm:gap-2.5 group shrink-0">
        <img
          :src="logoUrl"
          alt="tertaut.com"
          class="w-7 h-7 sm:w-8 sm:h-8 rounded-lg shadow-xs group-hover:scale-105 transition"
        />
        <div>
          <div
            class="font-extrabold text-sm sm:text-base tracking-tight text-jetblack flex items-center gap-0.5 font-mono"
          >
            tertaut<span class="text-gold">.com</span>
          </div>
        </div>
      </router-link>

      <!-- Navigation Links (Desktop) -->
      <nav
        class="hidden md:flex items-center gap-5 lg:gap-6 text-xs font-semibold text-jetblack/75"
      >
        <a href="/#biaya" class="hover:text-forest transition font-bold text-forest">
          Biaya &amp; Layanan
        </a>
        <router-link to="/demo/checkout" class="hover:text-jetblack transition">
          Demo Checkout
        </router-link>
        <a href="/#solusi" class="hover:text-jetblack transition">Solusi</a>
        <a href="/#cara-kerja" class="hover:text-jetblack transition">Cara Kerja</a>
        <a href="/#kalkulator" class="hover:text-jetblack transition">Kalkulator Biaya</a>
        <a href="/#faq" class="hover:text-jetblack transition">FAQ</a>
        <router-link to="/contact" class="hover:text-jetblack transition flex items-center gap-1">
          <PhoneCall class="w-3 h-3 text-gold" />
          <span>Kontak</span>
        </router-link>
      </nav>

      <!-- Action CTAs -->
      <div class="flex items-center gap-1.5 sm:gap-3">
        <router-link
          to="/demo/checkout"
          class="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-forest/30 bg-forest/5 text-forest text-xs font-bold hover:bg-forest/10 transition"
        >
          <span>Demo Checkout</span>
        </router-link>

        <router-link
          v-if="!isLoggedIn"
          to="/login"
          class="inline-flex items-center gap-1 sm:gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg bg-jetblack text-white text-xs font-bold shadow-xs hover:bg-jetblack-hover transition active:scale-95"
        >
          <span>Mulai Gratis</span>
          <ArrowRight class="w-3 h-3 sm:w-3.5 sm:h-3.5 text-gold shrink-0" />
        </router-link>

        <template v-else>
          <router-link
            to="/dashboard"
            class="inline-flex items-center gap-1 sm:gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg bg-jetblack text-white text-xs font-bold shadow-xs hover:bg-jetblack-hover transition active:scale-95"
          >
            <span>Dashboard</span>
            <ArrowRight class="w-3 h-3 sm:w-3.5 sm:h-3.5 text-gold shrink-0" />
          </router-link>
        </template>

        <!-- Mobile Hamburger Toggle (Touch-friendly 40px tap target) -->
        <button
          @click="isMobileMenuOpen = !isMobileMenuOpen"
          class="md:hidden min-w-[38px] min-h-[38px] p-2 rounded-lg border border-jetblack/15 text-jetblack hover:bg-jetblack/5 active:bg-jetblack/10 flex items-center justify-center cursor-pointer transition"
          aria-label="Toggle Menu"
        >
          <X v-if="isMobileMenuOpen" class="w-4 h-4" />
          <Menu v-else class="w-4 h-4" />
        </button>
      </div>
    </div>

    <!-- Mobile Navigation Drawer (Scrollable & Touch-optimized) -->
    <div
      v-if="isMobileMenuOpen"
      class="md:hidden border-t border-jetblack/10 bg-white/98 backdrop-blur-lg px-4 py-3 space-y-1 text-xs font-semibold animate-fadeIn shadow-xl max-h-[calc(100vh-3.5rem)] overflow-y-auto overscroll-contain"
    >
      <a
        href="/#biaya"
        @click="isMobileMenuOpen = false"
        class="block py-2.5 px-3 rounded-lg text-forest font-bold bg-forest/5 hover:bg-forest/10 transition active:scale-98"
      >
        💳 Biaya &amp; Layanan Platform
      </a>
      <router-link
        to="/demo/checkout"
        @click="isMobileMenuOpen = false"
        class="block py-2.5 px-3 rounded-lg text-forest font-bold hover:bg-forest/5 transition active:scale-98"
      >
        ⚡ Simulasi Demo Checkout
      </router-link>
      <a
        href="/#solusi"
        @click="isMobileMenuOpen = false"
        class="block py-2.5 px-3 rounded-lg text-jetblack/80 hover:bg-slate-50 hover:text-jetblack transition active:scale-98"
      >
        Solusi Produk
      </a>
      <a
        href="/#cara-kerja"
        @click="isMobileMenuOpen = false"
        class="block py-2.5 px-3 rounded-lg text-jetblack/80 hover:bg-slate-50 hover:text-jetblack transition active:scale-98"
      >
        Cara Kerja
      </a>
      <a
        href="/#integrasi-sdk"
        @click="isMobileMenuOpen = false"
        class="block py-2.5 px-3 rounded-lg text-jetblack/80 hover:bg-slate-50 hover:text-jetblack transition active:scale-98"
      >
        Integrasi SDK
      </a>
      <a
        href="/#kalkulator"
        @click="isMobileMenuOpen = false"
        class="block py-2.5 px-3 rounded-lg text-jetblack/80 hover:bg-slate-50 hover:text-jetblack transition active:scale-98"
      >
        Kalkulator Biaya
      </a>
      <a
        href="/#faq"
        @click="isMobileMenuOpen = false"
        class="block py-2.5 px-3 rounded-lg text-jetblack/80 hover:bg-slate-50 hover:text-jetblack transition active:scale-98"
      >
        FAQ
      </a>
      <router-link
        to="/dashboard/docs"
        @click="isMobileMenuOpen = false"
        class="block py-2.5 px-3 rounded-lg text-jetblack/80 hover:bg-slate-50 hover:text-jetblack transition active:scale-98"
      >
        Dokumentasi SDK
      </router-link>
      <router-link
        to="/contact"
        @click="isMobileMenuOpen = false"
        class="block py-2.5 px-3 rounded-lg text-gold font-bold hover:bg-gold/10 transition active:scale-98"
      >
        📞 Kontak &amp; Alamat Resmi
      </router-link>

      <div class="pt-3 pb-2 border-t border-jetblack/10 space-y-2">
        <router-link
          to="/products"
          @click="isMobileMenuOpen = false"
          class="block py-2.5 text-center rounded-xl border border-forest bg-forest/5 text-forest font-bold active:scale-98 transition"
        >
          Lihat Produk &amp; Beli
        </router-link>

        <router-link
          v-if="!isLoggedIn"
          to="/login"
          @click="isMobileMenuOpen = false"
          class="block py-3 text-center rounded-xl bg-jetblack text-white font-bold shadow-sm active:scale-98 transition"
        >
          Mulai Gratis Sekarang
        </router-link>
        <router-link
          v-else
          to="/dashboard"
          @click="isMobileMenuOpen = false"
          class="block py-3 text-center rounded-xl bg-jetblack text-white font-bold shadow-sm active:scale-98 transition"
        >
          Buka Dashboard
        </router-link>
      </div>
    </div>
  </header>
</template>
