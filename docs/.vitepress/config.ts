import { defineConfig } from "vitepress";

export default defineConfig({
  title: "tertaut.com Docs",
  description:
    "Panduan resmi tertaut.com — Solusi Monetisasi & Universal Licensing untuk Developer",
  lang: "id-ID",
  base: "/docs/",
  lastUpdated: false,
  themeConfig: {
    logo: "/docs/brand.svg",
    nav: [
      { text: "Beranda", link: "/" },
      { text: "Mulai Cepat", link: "/guide/getting-started" },
      { text: "SDK Klien", link: "/api/sdk" },
      { text: "API Backend (S2S)", link: "/api/server-to-server" },
      { text: "API Playground (Swagger)", link: "https://tertaut.com/swagger", target: "_blank" },
      { text: "llms.txt", link: "/docs/llms.txt", target: "_blank" },
    ],
    sidebar: [
      {
        text: "Langkah Awal",
        items: [
          { text: "Pengenalan", link: "/" },
          { text: "Panduan Mulai Cepat", link: "/guide/getting-started" },
          { text: "Konfigurasi .env Klien", link: "/guide/environment" },
        ],
      },
      {
        text: "Panduan Integrasi",
        items: [
          { text: "SDK Frontend (@tertaut/sdk)", link: "/api/sdk" },
          { text: "API Server-ke-Server (S2S)", link: "/api/server-to-server" },
        ],
      },
      {
        text: "Contoh & Referensi",
        items: [{ text: "Simulasi Demo Checkout", link: "/reference/demo-checkout" }],
      },
      {
        text: "Spesifikasi AI & LLM",
        items: [
          { text: "llms.txt (Docs Index)", link: "/docs/llms.txt", target: "_blank" },
          {
            text: "llms-full.txt (Full Engine Spec)",
            link: "/docs/llms-full.txt",
            target: "_blank",
          },
        ],
      },
    ],
    outline: {
      label: "Di Halaman Ini",
    },
    docFooter: {
      prev: "Halaman Sebelumnya",
      next: "Halaman Selanjutnya",
    },
    darkModeSwitchLabel: "Tampilan",
    lightModeSwitchTitle: "Ganti ke mode terang",
    darkModeSwitchTitle: "Ganti ke mode gelap",
    sidebarMenuLabel: "Menu Dokumentasi",
    returnToTopLabel: "Kembali ke Atas",
    footer: {
      message: "Dibuat untuk memudahkan developer membangun bisnis software.",
      copyright: `© ${new Date().getFullYear()} tertaut.com`,
    },
  },
});
