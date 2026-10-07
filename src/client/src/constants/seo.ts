/**
 * Metadata SEO Terpadu & Generator Schema.org JSON-LD
 * tertaut.com — Developer Infrastructure & Merchant of Record
 */

import { COMPANY_INFO } from "./company";

export interface SeoMetaData {
  title: string;
  description: string;
  keywords?: string[];
  canonicalUrl?: string;
  ogType?: "website" | "article" | "product";
  ogImage?: string;
  noindex?: boolean;
}

export const SITE_SEO_DEFAULTS = {
  name: "Tertaut",
  legalName: COMPANY_INFO.legalName,
  defaultOrigin: COMPANY_INFO.websiteUrl,
  defaultTitle: "Tertaut — Merchant of Record, Lisensi Software Ed25519 & AI Proxy Indonesia",
  defaultDescription:
    "Platform Merchant of Record (MoR) resmi, sistem lisensi kriptografis offline-first Ed25519, dan AI proxy shield untuk software builder, desktop app, SaaS, dan developer AI di Indonesia.",
  defaultKeywords: [
    "merchant of record indonesia",
    "mor software indonesia",
    "lisensi software offline",
    "ed25519 software license",
    "monetisasi software desktop",
    "qris software payment",
    "virtual account software billing",
    "ai proxy shield",
    "token metering llm",
    "tauri license manager",
    "electron license manager",
    "flutter desktop monetization",
    "anti pembajakan software",
    "software licensing sdk",
    "tertaut",
    "tertaut.com",
  ],
  image: "/logo.png",
  twitter: "@tertaut_com",
};

export const STATIC_PAGES_META: Record<string, SeoMetaData> = {
  home: {
    title: "Tertaut — Merchant of Record & Monetisasi Software Indonesia",
    description:
      "Jual aplikasi desktop, SaaS, dan tools AI di Indonesia tanpa ribet PT/CV, pajak PPN 11%, atau pembajakan. Terima pembayaran QRIS & Virtual Account instan, lisensi offline Ed25519, dan AI proxy shield.",
    keywords: SITE_SEO_DEFAULTS.defaultKeywords,
    canonicalUrl: "/",
  },
  docs: {
    title: "Dokumentasi SDK & Integrasi API — Tertaut",
    description:
      "Panduan integrasi resmi @tertaut/sdk untuk lisensi kriptografis Ed25519 offline 30 hari, penguncian hardware ID seat, server-to-server API, dan AI proxy shield.",
    canonicalUrl: "/dashboard/docs",
  },
  privacy: {
    title: "Kebijakan Privasi (Privacy Policy) & Kepatuhan Data — Tertaut",
    description:
      "Dokumen resmi Kebijakan Privasi tertaut.com sesuai UU No. 27/2022 (UU PDP) dan Google API Services User Data Policy (Limited Use Requirements).",
    canonicalUrl: "/privacy.html",
  },
  terms: {
    title: "Syarat & Ketentuan Layanan (Terms of Service) — Tertaut",
    description:
      "Syarat dan ketentuan resmi penggunaan platform Merchant of Record, penerbitan lisensi perangkat lunak, dan aturan kepatuhan transaksi di tertaut.com.",
    canonicalUrl: "/terms.html",
  },
  refund: {
    title: "Kebijakan Pengembalian Dana (Refund Policy) — Tertaut",
    description:
      "Ketentuan resmi garansi, pengembalian dana transaksi lisensi software digital, dan penyelesaian perselisihan konsumen di tertaut.com.",
    canonicalUrl: "/refund",
  },
  contact: {
    title: "Kontak Resmi & Legalitas Perusahaan — Tertaut",
    description:
      "Hubungi PT RETAS LINTAS BATAS. Informasi kantor operasional, jam kerja, nomor WhatsApp resmi, dan saluran konsultasi teknis tertaut.com.",
    canonicalUrl: "/contact",
  },
  login: {
    title: "Masuk ke Dashboard Builder — Tertaut",
    description:
      "Akses dashboard pengembang Tertaut untuk mengelola lisensi software, aplikasi, transaksi pembayaran QRIS, kupon diskon, dan saldo pencairan.",
    canonicalUrl: "/login",
    noindex: true,
  },
};

export type SchemaType =
  "organization" | "website" | "software" | "localbusiness" | "faq" | "breadcrumb";

export function createJsonLd(
  type: SchemaType,
  data?: any,
  baseUrl: string = SITE_SEO_DEFAULTS.defaultOrigin
): Record<string, any> {
  const cleanBaseUrl = baseUrl.replace(/\/+$/, "");

  switch (type) {
    case "organization":
      return {
        "@context": "https://schema.org",
        "@type": "Organization",
        name: SITE_SEO_DEFAULTS.name,
        legalName: COMPANY_INFO.legalName,
        url: cleanBaseUrl,
        logo: `${cleanBaseUrl}/logo.png`,
        description: SITE_SEO_DEFAULTS.defaultDescription,
        address: {
          "@type": "PostalAddress",
          streetAddress: COMPANY_INFO.address.street,
          addressLocality: COMPANY_INFO.address.regency,
          addressRegion: COMPANY_INFO.address.province,
          addressCountry: "ID",
        },
        contactPoint: {
          "@type": "ContactPoint",
          telephone: COMPANY_INFO.contact.phone,
          contactType: "customer service",
          availableLanguage: ["id", "en"],
          email: COMPANY_INFO.contact.email,
        },
      };

    case "website":
      return {
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: SITE_SEO_DEFAULTS.name,
        alternateName: ["Tertaut.com", "PT RETAS LINTAS BATAS"],
        url: cleanBaseUrl,
        description: SITE_SEO_DEFAULTS.defaultDescription,
      };

    case "software":
      return {
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        name: "Tertaut Developer Infrastructure",
        operatingSystem: "Windows, macOS, Linux, Web",
        applicationCategory: "DeveloperApplication, BusinessApplication",
        description:
          "Universal Licensing Engine Ed25519, Merchant of Record (MoR) Payment Gateway, dan AI Proxy Shield untuk software builder di Indonesia.",
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "IDR",
          description: "Flat 5% per transaksi sukses. Tanpa biaya bulanan atau biaya registrasi.",
        },
        provider: {
          "@type": "Organization",
          name: COMPANY_INFO.legalName,
          url: cleanBaseUrl,
        },
      };

    case "localbusiness":
      return {
        "@context": "https://schema.org",
        "@type": "LocalBusiness",
        name: `${SITE_SEO_DEFAULTS.name} - ${COMPANY_INFO.legalName}`,
        legalName: COMPANY_INFO.legalName,
        url: cleanBaseUrl,
        logo: `${cleanBaseUrl}/logo.png`,
        image: `${cleanBaseUrl}/logo.png`,
        description: COMPANY_INFO.businessType,
        telephone: COMPANY_INFO.contact.phone,
        email: COMPANY_INFO.contact.email,
        priceRange: "IDR",
        address: {
          "@type": "PostalAddress",
          streetAddress: COMPANY_INFO.address.street,
          addressLocality: COMPANY_INFO.address.regency,
          addressRegion: COMPANY_INFO.address.province,
          addressCountry: "ID",
        },
        openingHoursSpecification: [
          {
            "@type": "OpeningHoursSpecification",
            dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
            opens: "08:30",
            closes: "17:00",
          },
        ],
      };

    case "faq": {
      const defaultFaqs = [
        {
          q: "Apa itu Tertaut?",
          a: "Tertaut adalah platform Merchant of Record (MoR) dan infrastruktur pengembang untuk kreator software di Indonesia. Kami menangani pembayaran lokal (QRIS, VA), faktur pajak resmi (PPN 11%), sistem lisensi kriptografis offline-first Ed25519, dan AI proxy shield.",
        },
        {
          q: "Apa perbedaan Merchant of Record (MoR) dengan Payment Gateway biasa?",
          a: "Payment gateway biasa hanya memproses aliran uang dan mewajibkan Anda mendirikan badan hukum PT/CV serta mengurus faktur pajak PPN sendiri. Sebagai MoR, Tertaut bertindak sebagai penjual resmi atas nama Anda, menerbitkan faktur pajak otomatis, dan langsung mencairkan 95% hasil penjualan bersih ke rekening Anda.",
        },
        {
          q: "Bagaimana cara kerja lisensi offline-first Ed25519?",
          a: "Aplikasi desktop (Tauri, Electron, Flutter) yang menggunakan @tertaut/sdk dapat memverifikasi token lisensi secara instan di sisi klien tanpa perlu selalu terhubung ke internet. Pengguna dapat menggunakan software secara offline hingga 30 hari.",
        },
        {
          q: "Berapa biaya layanan di Tertaut?",
          a: "Tertaut 100% gratis untuk memulai tanpa biaya bulanan atau biaya instalasi. Biaya platform adalah flat 5% per transaksi penjualan sukses.",
        },
        {
          q: "Metode pembayaran apa saja yang didukung?",
          a: "Pelanggan Anda dapat membayar secara instan menggunakan QRIS (GoPay, OVO, DANA, ShopeePay, LinkAja, dan seluruh aplikasi Mobile Banking) serta Virtual Account bank terkemuka di Indonesia.",
        },
        {
          q: "Bagaimana cara kerja fitur AI Proxy Shield?",
          a: "Master API key OpenAI/Claude Anda disimpan aman di server vault terenkripsi AES-256. Pengguna software Anda tidak pernah melihat API key asli, dan Anda dapat membatasi kuota token harian atau rate-limit untuk mencegah pembobolan biaya AI.",
        },
      ];

      return {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: defaultFaqs.map((faq) => ({
          "@type": "Question",
          name: faq.q,
          acceptedAnswer: {
            "@type": "Answer",
            text: faq.a,
          },
        })),
      };
    }

    case "breadcrumb": {
      const items = (data?.items || []).map((item: { name: string; url: string }, idx: number) => ({
        "@type": "ListItem",
        position: idx + 1,
        name: item.name,
        item: item.url.startsWith("http") ? item.url : `${cleanBaseUrl}${item.url}`,
      }));

      return {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: items,
      };
    }

    default:
      return {};
  }
}
