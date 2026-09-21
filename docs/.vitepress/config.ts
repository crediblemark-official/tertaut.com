import { defineConfig } from "vitepress";

export default defineConfig({
  title: "tertaut.com Docs",
  description: "Developer documentation untuk tertaut.com Engine — Monetization, Licensing, AI Protection & Validation",
  lang: "id-ID",
  base: "/docs/",
  lastUpdated: false,
  themeConfig: {
    logo: "/docs/brand.svg",
    nav: [
      { text: "Home", link: "/" },
      { text: "Getting Started", link: "/getting-started" },
      { text: "SDK", link: "/sdk" },
      { text: "S2S API", link: "/server-to-server" },
      { text: "Swagger", link: "https://tertaut.com/swagger", target: "_blank" },
    ],
    sidebar: [
      {
        text: "Memulai",
        items: [
          { text: "Overview", link: "/" },
          { text: "Getting Started", link: "/getting-started" },
          { text: "Environment Client", link: "/environment" },
        ],
      },
      {
        text: "Integrasi & API",
        items: [
          { text: "SDK @tertaut/sdk", link: "/sdk" },
          { text: "Server-to-Server API", link: "/server-to-server" },
        ],
      },
    ],
    footer: {
      message: "Headless Developer Infrastructure Engine",
      copyright: `© ${new Date().getFullYear()} tertaut.com`,
    },
  },
});