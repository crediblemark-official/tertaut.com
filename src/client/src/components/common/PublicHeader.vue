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
    <div class="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
      <!-- Logo -->
      <router-link to="/" class="flex items-center gap-2.5 group">
        <img
          :src="logoUrl"
          alt="tertaut.com"
          class="w-8 h-8 rounded-lg shadow-md group-hover:scale-105 transition"
        />
        <div>
          <div
            class="font-extrabold text-base tracking-tight text-jetblack flex items-center gap-0.5 font-mono"
          >
            tertaut<span class="text-gold">.com</span>
          </div>
        </div>
      </router-link>

      <!-- Navigation Links -->
      <nav class="hidden lg:flex items-center gap-6 text-xs font-semibold text-jetblack/75">
        <router-link to="/" class="hover:text-jetblack transition">Beranda</router-link>
        <router-link
          to="/products"
          class="hover:text-jetblack transition flex items-center gap-1 font-bold text-forest"
        >
          <span>Biaya &amp; Layanan</span>
        </router-link>
        <a href="/#cara-kerja" class="hover:text-jetblack transition">Cara Kerja</a>
        <a href="/#solusi" class="hover:text-jetblack transition">Solusi MoR</a>
        <router-link
          to="/demo/checkout"
          class="hover:text-jetblack transition flex items-center gap-1"
        >
          <span>Demo Checkout</span>
        </router-link>
        <router-link to="/dashboard/docs" class="hover:text-jetblack transition"
          >Dokumentasi</router-link
        >
        <router-link to="/contact" class="hover:text-jetblack transition flex items-center gap-1">
          <PhoneCall class="w-3 h-3 text-gold" />
          <span>Hubungi Kami</span>
        </router-link>
      </nav>

      <!-- Action CTAs -->
      <div class="flex items-center gap-2 sm:gap-3">
        <router-link
          to="/demo/checkout"
          class="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-forest/30 bg-forest/5 text-forest text-xs font-bold hover:bg-forest/10 transition"
        >
          <span>Demo Checkout</span>
        </router-link>

        <router-link
          v-if="!isLoggedIn"
          to="/login"
          class="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-jetblack text-white text-xs font-bold shadow-sm hover:bg-jetblack-hover transition active:scale-95"
        >
          <span>Mulai Gratis</span>
          <ArrowRight class="w-3.5 h-3.5 text-gold" />
        </router-link>

        <template v-else>
          <router-link
            to="/dashboard"
            class="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-jetblack text-white text-xs font-bold shadow-sm hover:bg-jetblack-hover transition active:scale-95"
          >
            <span>Buka Dashboard</span>
            <ArrowRight class="w-3.5 h-3.5 text-gold" />
          </router-link>
        </template>

        <!-- Mobile Hamburger Toggle -->
        <button
          @click="isMobileMenuOpen = !isMobileMenuOpen"
          class="lg:hidden p-1.5 rounded-lg border border-jetblack/15 text-jetblack hover:bg-jetblack/5 cursor-pointer"
          aria-label="Toggle Menu"
        >
          <X v-if="isMobileMenuOpen" class="w-4 h-4" />
          <Menu v-else class="w-4 h-4" />
        </button>
      </div>
    </div>

    <!-- Mobile Navigation Drawer -->
    <div
      v-if="isMobileMenuOpen"
      class="lg:hidden border-t border-jetblack/10 bg-white px-4 py-4 space-y-3 text-xs font-semibold animate-fadeIn shadow-lg"
    >
      <router-link
        to="/"
        @click="isMobileMenuOpen = false"
        class="block py-1.5 text-jetblack/80 hover:text-jetblack"
      >
        Beranda
      </router-link>
      <router-link
        to="/products"
        @click="isMobileMenuOpen = false"
        class="block py-1.5 text-forest font-bold hover:text-forest-dark"
      >
        💳 Biaya &amp; Layanan Platform
      </router-link>
      <router-link
        to="/demo/checkout"
        @click="isMobileMenuOpen = false"
        class="block py-1.5 text-forest font-bold hover:text-forest-dark"
      >
        ⚡ Simulasi Demo Checkout
      </router-link>
      <a
        href="/#solusi"
        @click="isMobileMenuOpen = false"
        class="block py-1.5 text-jetblack/80 hover:text-jetblack"
      >
        Solusi Produk
      </a>
      <a
        href="/#cara-kerja"
        @click="isMobileMenuOpen = false"
        class="block py-1.5 text-jetblack/80 hover:text-jetblack"
      >
        Cara Kerja
      </a>
      <a
        href="/#kalkulator"
        @click="isMobileMenuOpen = false"
        class="block py-1.5 text-jetblack/80 hover:text-jetblack"
      >
        Kalkulator Biaya
      </a>
      <router-link
        to="/dashboard/docs"
        @click="isMobileMenuOpen = false"
        class="block py-1.5 text-jetblack/80 hover:text-jetblack"
      >
        Dokumentasi SDK
      </router-link>
      <router-link
        to="/contact"
        @click="isMobileMenuOpen = false"
        class="block py-1.5 text-gold-dark font-bold hover:text-jetblack"
      >
        📞 Hubungi Kami &amp; Kontak Resmi
      </router-link>

      <div class="pt-3 border-t border-jetblack/10 space-y-2">
        <router-link
          to="/products"
          @click="isMobileMenuOpen = false"
          class="block py-2 text-center rounded-lg border border-forest bg-forest/5 text-forest font-bold"
        >
          Lihat Produk &amp; Beli
        </router-link>

        <router-link
          v-if="!isLoggedIn"
          to="/login"
          @click="isMobileMenuOpen = false"
          class="block py-2.5 text-center rounded-lg bg-jetblack text-white font-bold"
        >
          Mulai Gratis Sekarang
        </router-link>
        <router-link
          v-else
          to="/dashboard"
          @click="isMobileMenuOpen = false"
          class="block py-2.5 text-center rounded-lg bg-jetblack text-white font-bold"
        >
          Buka Dashboard
        </router-link>
      </div>
    </div>
  </header>
</template>
