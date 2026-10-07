import { db } from "../../db";
import { apps } from "../../db/schema";
import { eq, and } from "drizzle-orm";

export interface SitemapRoute {
  path: string;
  priority: string;
  changefreq: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
}

export const STATIC_SITEMAP_ROUTES: SitemapRoute[] = [
  { path: "", priority: "1.0", changefreq: "daily" },
  { path: "pricing", priority: "0.9", changefreq: "weekly" },
  { path: "products", priority: "0.9", changefreq: "weekly" },
  { path: "privacy", priority: "0.7", changefreq: "monthly" },
  { path: "terms", priority: "0.7", changefreq: "monthly" },
  { path: "contact", priority: "0.7", changefreq: "monthly" },
  { path: "refund", priority: "0.7", changefreq: "monthly" },
  { path: "demo/checkout", priority: "0.8", changefreq: "weekly" },
  { path: "docs/", priority: "0.9", changefreq: "weekly" },
];

/**
 * Menghasilkan sitemap.xml dinamis:
 * 1. Halaman statis utama platform
 * 2. Halaman checkout publik /pay/:slug dari seluruh aplikasi builder yang aktif
 */
export async function generateDynamicSitemap(): Promise<string> {
  const today = new Date().toISOString().split("T")[0];
  let appEntries: { slug: string; lastmod: string }[] = [];

  try {
    const liveApps = await db.query.apps.findMany({
      where: and(eq(apps.isSuspended, false), eq(apps.mode, "live")),
      columns: { slug: true, updatedAt: true, createdAt: true },
    });

    appEntries = liveApps
      .filter((a) => typeof a.slug === "string" && a.slug.trim().length > 0)
      .map((a) => {
        const dateObj = a.updatedAt || a.createdAt || new Date();
        const dateStr =
          dateObj instanceof Date && !isNaN(dateObj.getTime())
            ? dateObj.toISOString().split("T")[0]
            : today;
        return {
          slug: a.slug.trim(),
          lastmod: dateStr,
        };
      });
  } catch {
    // Graceful fallback jika DB belum siap atau sedang dalam proses migrasi
  }

  const xmlUrls = [
    ...STATIC_SITEMAP_ROUTES.map(
      (r) => `  <url>
    <loc>https://tertaut.com/${r.path}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${r.changefreq}</changefreq>
    <priority>${r.priority}</priority>
  </url>`
    ),
    ...appEntries.map(
      (a) => `  <url>
    <loc>https://tertaut.com/pay/${encodeURIComponent(a.slug)}</loc>
    <lastmod>${a.lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`
    ),
  ].join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${xmlUrls}
</urlset>`;
}
