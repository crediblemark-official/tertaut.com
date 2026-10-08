import { db } from "../../db";
import { apps } from "../../db/schema";
import { eq } from "drizzle-orm";

const BOT_USER_AGENTS = [
  "googlebot",
  "bingbot",
  "yandex",
  "baiduspider",
  "facebookexternalhit",
  "twitterbot",
  "rogerbot",
  "linkedinbot",
  "embedly",
  "quora link preview",
  "showyoubot",
  "outbrain",
  "pinterest/0.",
  "developers.google.com/+/web/snippet",
  "slackbot",
  "vkshare",
  "w3c_validator",
  "redditbot",
  "applebot",
  "whatsapp",
  "flipboard",
  "tumblr",
  "bitlybot",
  "skypeuripreview",
  "nuzzel",
  "discordbot",
  "google page speed",
  "qwantify",
  "pinterestbot",
  "bitrix link preview",
  "xing-content",
  "telegrambot",
  "claudebot",
  "gptbot",
  "chatgpt-user",
  "perplexitybot",
  "bytespider",
  "ia_archiver",
];

export function isCrawler(userAgent: string | null | undefined): boolean {
  if (!userAgent) return false;
  const ua = userAgent.toLowerCase();
  return BOT_USER_AGENTS.some((bot) => ua.includes(bot));
}

interface PageMeta {
  title: string;
  description: string;
  canonical: string;
  badge: string;
  ogType?: string;
  fallbackContent?: string;
}

const STATIC_ROUTE_META: Record<string, PageMeta> = {
  "/": {
    title: "Tertaut — Merchant of Record & Monetisasi Software Indonesia",
    description:
      "Jual aplikasi desktop, SaaS, dan tools AI di Indonesia tanpa ribet PT/CV, pajak PPN 11%, atau pembajakan. Terima pembayaran QRIS & Virtual Account instan, lisensi offline Ed25519, dan AI proxy shield.",
    canonical: "https://tertaut.com/",
    badge: "Merchant of Record & Universal Licensing",
  },
  "/pricing": {
    title: "Biaya Transaksi & Skema Monetisasi — Tertaut",
    description:
      "Biaya transparan flat 5% Merchant of Record tanpa langganan bulanan. Terima pembayaran QRIS & Virtual Account instan dengan settlement otomatis.",
    canonical: "https://tertaut.com/pricing",
    badge: "Transparansi Biaya Flat 5%",
  },
  "/products": {
    title: "Katalog Solusi & Lisensi Software — Tertaut",
    description:
      "Infrastruktur lengkap untuk software builder Indonesia: Universal Licensing Ed25519, AI Proxy Shield, dan Merchant of Record checkout.",
    canonical: "https://tertaut.com/products",
    badge: "Developer Infrastructure",
  },
  "/privacy": {
    title: "Kebijakan Privasi (Privacy Policy) — Tertaut",
    description:
      "Kebijakan privasi resmi tertaut.com sesuai UU No. 27/2022 (UU PDP) dan Google API Services User Data Policy (Limited Use Requirements).",
    canonical: "https://tertaut.com/privacy",
    badge: "Kepatuhan UU PDP & Google API Policy",
    fallbackContent: `<h1>Kebijakan Privasi Tertaut</h1><p>Komitmen privasi resmi tertaut.com sesuai UU Perlindungan Data Pribadi (UU PDP No. 27/2022) dan Google API Services User Data Policy. Kami tidak menjual data pengguna dan melindungi token lisensi secara kriptografis.</p>`,
  },
  "/terms": {
    title: "Syarat & Ketentuan Layanan (Terms of Service) — Tertaut",
    description:
      "Syarat dan ketentuan resmi platform Merchant of Record tertaut.com, penerbitan lisensi kriptografis Ed25519, dan kepatuhan transaksi digital.",
    canonical: "https://tertaut.com/terms",
    badge: "Syarat & Ketentuan Layanan Resmi",
    fallbackContent: `<h1>Syarat dan Ketentuan Layanan Tertaut</h1><p>Syarat dan ketentuan resmi platform Merchant of Record tertaut.com, penerbitan lisensi software digital, dan perlindungan pembeli serta software creator di Indonesia.</p>`,
  },
  "/refund": {
    title: "Kebijakan Pengembalian Dana (Refund Policy) — Tertaut",
    description:
      "Ketentuan resmi garansi transaksi, penyelesaian perselisihan, dan pengembalian dana lisensi perangkat lunak digital di tertaut.com.",
    canonical: "https://tertaut.com/refund",
    badge: "Kebijakan Pengembalian Dana Transparan",
  },
  "/contact": {
    title: "Kontak Resmi & Legalitas Perusahaan — Tertaut",
    description:
      "Hubungi PT RETAS LINTAS BATAS. Informasi kantor operasional di Sumenep Jawa Timur, jam kerja, nomor WhatsApp resmi, dan saluran dukungan teknis.",
    canonical: "https://tertaut.com/contact",
    badge: "PT RETAS LINTAS BATAS • Sumenep ID",
  },
};

export async function resolveMetadataForPath(pathname: string): Promise<PageMeta> {
  // Normalisasi path
  let clean = pathname.split("?")[0].replace(/\/+$/, "") || "/";
  if (clean === "/privacy.html" || clean === "/kebijakan-privasi") clean = "/privacy";
  if (clean === "/terms.html" || clean === "/syarat-ketentuan") clean = "/terms";
  if (clean === "/kebijakan-pengembalian") clean = "/refund";
  if (clean === "/kontak") clean = "/contact";
  if (clean === "/biaya" || clean === "/katalog") clean = "/pricing";

  if (STATIC_ROUTE_META[clean]) {
    return STATIC_ROUTE_META[clean];
  }

  // Cek dynamic route /pay/:slug
  if (clean.startsWith("/pay/")) {
    const slug = clean.slice("/pay/".length).trim();
    if (slug) {
      try {
        const app = await db.query.apps.findFirst({
          where: eq(apps.slug, slug),
          columns: { name: true, headline: true, description: true, targetPrice: true },
        });

        if (app) {
          const priceFormatted = app.targetPrice
            ? `Rp ${app.targetPrice.toLocaleString("id-ID")}`
            : "";
          return {
            title: `Beli Lisensi ${app.name} — Tertaut Checkout Resmi`,
            description:
              app.headline ||
              app.description ||
              `Checkout instan lisensi resmi ${app.name} dengan QRIS & Virtual Account di tertaut.com.`,
            canonical: `https://tertaut.com/pay/${slug}`,
            badge: `Lisensi Resmi • ${app.name}`,
            fallbackContent: `<h1>${app.name}</h1><p>${app.headline || ""}</p><p>${app.description || ""}</p><p>Harga: ${priceFormatted}</p>`,
          };
        }
      } catch {
        // Abaikan dan gunakan default
      }
    }
  }

  // Default fallback
  return STATIC_ROUTE_META["/"];
}

function escapeHtml(str: string): string {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function injectDynamicSeo(
  html: string,
  meta: PageMeta,
  options: { isCrawler?: boolean } = {}
): string {
  const dynamicOgUrl = `https://tertaut.com/api/v1/og?title=${encodeURIComponent(
    meta.title
  )}&desc=${encodeURIComponent(meta.description)}&badge=${encodeURIComponent(meta.badge)}`;

  const safeTitle = escapeHtml(meta.title);
  const safeDescription = escapeHtml(meta.description);
  const safeCanonical = escapeHtml(meta.canonical);
  const safeOgUrl = escapeHtml(dynamicOgUrl);

  let result = html;

  // Replace Title
  result = result.replace(/<title>.*?<\/title>/i, `<title>${safeTitle}</title>`);

  // Replace Description
  result = result.replace(
    /<meta\s+name=["']description["']\s+content=["'][^"']*["']\s*\/?>/i,
    `<meta name="description" content="${safeDescription}" />`
  );

  // Replace Canonical Link
  result = result.replace(
    /<link\s+rel=["']canonical["']\s+href=["'][^"']*["']\s*\/?>/i,
    `<link rel="canonical" href="${safeCanonical}" />`
  );

  // Replace Open Graph Title & Description & Image & URL
  result = result.replace(
    /<meta\s+property=["']og:title["']\s+content=["'][^"']*["']\s*\/?>/i,
    `<meta property="og:title" content="${safeTitle}" />`
  );
  result = result.replace(
    /<meta\s+property=["']og:description["']\s+content=["'][^"']*["']\s*\/?>/i,
    `<meta property="og:description" content="${safeDescription}" />`
  );
  result = result.replace(
    /<meta\s+property=["']og:url["']\s+content=["'][^"']*["']\s*\/?>/i,
    `<meta property="og:url" content="${safeCanonical}" />`
  );
  result = result.replace(
    /<meta\s+property=["']og:image["']\s+content=["'][^"']*["']\s*\/?>/i,
    `<meta property="og:image" content="${safeOgUrl}" />`
  );

  // Replace Twitter Title & Description & Image
  result = result.replace(
    /<meta\s+name=["']twitter:title["']\s+content=["'][^"']*["']\s*\/?>/i,
    `<meta name="twitter:title" content="${safeTitle}" />`
  );
  result = result.replace(
    /<meta\s+name=["']twitter:description["']\s+content=["'][^"']*["']\s*\/?>/i,
    `<meta name="twitter:description" content="${safeDescription}" />`
  );
  result = result.replace(
    /<meta\s+name=["']twitter:image["']\s+content=["'][^"']*["']\s*\/?>/i,
    `<meta name="twitter:image" content="${safeOgUrl}" />`
  );

  // Jika crawler terdeteksi dan halaman memiliki textual fallback (misal /privacy atau /terms),
  // sisipkan konten tersebut ke dalam <div id="app"> agar bot non-JS dapat mengindeks teks penuh.
  if (options.isCrawler && meta.fallbackContent) {
    result = result.replace(
      /<div id=["']app["'][^>]*>[\s\S]*?<\/div>/i,
      `<div id="app"><main class="crawler-fallback-content">${meta.fallbackContent}</main></div>`
    );
  }

  return result;
}
