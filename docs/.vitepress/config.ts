import { defineConfig } from "vitepress";

export default defineConfig({
  title: "tertaut.com Docs",
  description:
    "Developer documentation untuk tertaut.com Engine — Monetization & Universal Licensing",
  lang: "id-ID",
  base: "/docs/",
  lastUpdated: false,
  themeConfig: {
    logo: "/docs/brand.svg",
    nav: [
      { text: "Home", link: "/" },
      { text: "Getting Started", link: "/guide/getting-started" },
      { text: "SDK", link: "/api/sdk" },
      { text: "S2S API", link: "/api/server-to-server" },
      { text: "Swagger", link: "https://tertaut.com/swagger", target: "_blank" },
    ],
    sidebar: [
      {
        text: "Memulai",
        items: [
          { text: "Overview", link: "/" },
          { text: "Getting Started", link: "/guide/getting-started" },
          { text: "Environment Client", link: "/guide/environment" },
        ],
      },
      {
        text: "Integrasi & API",
        items: [
          { text: "SDK @tertaut/sdk", link: "/api/sdk" },
          { text: "Server-to-Server API", link: "/api/server-to-server" },
        ],
      },
      {
        text: "Referensi",
        items: [{ text: "Demo Checkout", link: "/reference/demo-checkout" }],
      },
    ],
    footer: {
      message: "Headless Developer Infrastructure Engine",
      copyright: `© ${new Date().getFullYear()} tertaut.com`,
    },
  },
});
