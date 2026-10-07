import { describe, it, expect } from "bun:test";
import { app } from "../../index";
import { generateDynamicSitemap, STATIC_SITEMAP_ROUTES } from "../../routes/seo/sitemap";
import { generateOgSvg } from "../../routes/seo/og";
import {
  isCrawler,
  resolveMetadataForPath,
  injectDynamicSeo,
} from "../../services/seo/seoPrerender";

describe("Advanced SEO & GEO Engine", () => {
  it("should generate a valid XML sitemap with static platform routes and DB app entries", async () => {
    const xml = await generateDynamicSitemap();

    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(xml).toContain("<loc>https://tertaut.com/</loc>");
    expect(xml).toContain("<loc>https://tertaut.com/privacy</loc>");
    expect(xml).toContain("<loc>https://tertaut.com/terms</loc>");
    expect(xml).toContain("<loc>https://tertaut.com/pricing</loc>");
    expect(xml).toContain("<loc>https://tertaut.com/products</loc>");
    expect(xml).toContain("<loc>https://tertaut.com/contact</loc>");
    expect(xml).toContain("<loc>https://tertaut.com/refund</loc>");
    expect(xml).toContain("</urlset>");
  });

  it("should serve GET /sitemap.xml via HTTP with application/xml content-type", async () => {
    const res = await app.handle(new Request("http://localhost/sitemap.xml"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/xml");

    const text = await res.text();
    expect(text).toContain("<loc>https://tertaut.com/</loc>");
    expect(text).toContain("<loc>https://tertaut.com/privacy</loc>");
  });

  it("should generate valid high-res SVG for Open Graph cards (GET /api/v1/og)", async () => {
    const res = await app.handle(
      new Request(
        "http://localhost/api/v1/og?title=Uji+Coba+Aplikasi&desc=Deskripsi+singkat&badge=Test+Badge"
      )
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("image/svg+xml");

    const svg = await res.text();
    expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"');
    expect(svg).toContain("Uji Coba Aplikasi");
    expect(svg).toContain("TEST BADGE");
    expect(svg).toContain("tertaut");
  });

  it("should detect web crawlers and social media bots reliably", () => {
    expect(
      isCrawler("Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)")
    ).toBe(true);
    expect(
      isCrawler("facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)")
    ).toBe(true);
    expect(isCrawler("Twitterbot/1.0")).toBe(true);
    expect(isCrawler("WhatsApp/2.21.12.21 i")).toBe(true);
    expect(isCrawler("TelegramBot (like TwitterBot)")).toBe(true);
    expect(isCrawler("Mozilla/5.0 (compatible; ClaudeBot/1.0; +claudebot@anthropic.com)")).toBe(
      true
    );
    expect(
      isCrawler(
        "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)"
      )
    ).toBe(true);
    expect(
      isCrawler(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      )
    ).toBe(false);
    expect(isCrawler(null)).toBe(false);
  });

  it("should resolve correct metadata for static and alias paths", async () => {
    const privacyMeta = await resolveMetadataForPath("/privacy");
    expect(privacyMeta.title).toContain("Kebijakan Privasi");
    expect(privacyMeta.canonical).toBe("https://tertaut.com/privacy");

    const privacyAlias = await resolveMetadataForPath("/privacy.html");
    expect(privacyAlias.canonical).toBe("https://tertaut.com/privacy");

    const termsMeta = await resolveMetadataForPath("/terms");
    expect(termsMeta.title).toContain("Syarat & Ketentuan Layanan");
    expect(termsMeta.canonical).toBe("https://tertaut.com/terms");

    const pricingMeta = await resolveMetadataForPath("/pricing");
    expect(pricingMeta.title).toContain("Biaya Transaksi");
    expect(pricingMeta.canonical).toBe("https://tertaut.com/pricing");
  });

  it("should inject dynamic SEO tags into raw HTML for crawlers and social media cards", () => {
    const rawHtml = `<!doctype html><html><head>
      <title>Default Title</title>
      <meta name="description" content="Default Desc" />
      <link rel="canonical" href="https://tertaut.com/" />
      <meta property="og:title" content="Default OG" />
      <meta property="og:description" content="Default Desc" />
      <meta property="og:url" content="https://tertaut.com/" />
      <meta property="og:image" content="https://tertaut.com/logo.png" />
      <meta name="twitter:title" content="Default Twitter" />
      <meta name="twitter:description" content="Default Twitter Desc" />
      <meta name="twitter:image" content="https://tertaut.com/logo.png" />
    </head><body><div id="app">Loading...</div></body></html>`;

    const meta = {
      title: "Kebijakan Privasi | Tertaut",
      description: "Penjelasan privasi resmi",
      canonical: "https://tertaut.com/privacy",
      badge: "Privasi",
      fallbackContent: "<h1>Kebijakan Privasi</h1><p>Konten crawler</p>",
    };

    const injected = injectDynamicSeo(rawHtml, meta, { isCrawler: true });

    expect(injected).toContain("<title>Kebijakan Privasi | Tertaut</title>");
    expect(injected).toContain('<meta name="description" content="Penjelasan privasi resmi" />');
    expect(injected).toContain('<link rel="canonical" href="https://tertaut.com/privacy" />');
    expect(injected).toContain(
      '<meta property="og:title" content="Kebijakan Privasi | Tertaut" />'
    );
    expect(injected).toContain('<meta property="og:url" content="https://tertaut.com/privacy" />');
    expect(injected).toContain("/api/v1/og?title=Kebijakan%20Privasi");
    expect(injected).toContain(
      '<main class="crawler-fallback-content"><h1>Kebijakan Privasi</h1><p>Konten crawler</p></main>'
    );
  });
});
