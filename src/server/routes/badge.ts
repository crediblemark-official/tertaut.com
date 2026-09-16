import { Elysia, t } from "elysia";
import { db } from "../db";
import { apps, licenses } from "../db/schema";
import { eq } from "drizzle-orm";
import { LaunchService } from "../services/launchService";

export const badgeRoutes = new Elysia({ prefix: "/badge" })
  /**
   * Embeddable Launch Badge (SVG dinamis untuk situsbisnis.com atau landing page eksternal)
   */
  .get(
    "/:slug",
    async ({ params: { slug }, set }) => {
      const cleanSlug = slug.replace(/\.svg$/i, "");
      const app = await db.query.apps.findFirst({
        where: eq(apps.slug, cleanSlug),
      });

      const label = "tertaut.com";
      const statusText = !app
        ? "unverified"
        : app.mode === "live"
        ? "Verified • MoR Protected"
        : "Early Access • Validating";

      const statusBg = !app
        ? "#666666"
        : app.mode === "live"
        ? "#0F4C3A" // Forest Green
        : "#D4AF37"; // Classic Gold

      const statusTextColor = app?.mode === "live" ? "#ffffff" : "#111111";

      const labelWidth = 84;
      const statusWidth = statusText.length * 7 + 16;
      const totalWidth = labelWidth + statusWidth;

      const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="24" viewBox="0 0 ${totalWidth} 24" role="img" aria-label="${label}: ${statusText}">
  <linearGradient id="g" x2="0" y2="100%">
    <stop offset="0" stop-color="#fff" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <clipPath id="r">
    <rect width="${totalWidth}" height="24" rx="6" fill="#fff"/>
  </clipPath>
  <g clip-path="url(#r)">
    <rect width="${labelWidth}" height="24" fill="#18181b"/>
    <rect x="${labelWidth}" width="${statusWidth}" height="24" fill="${statusBg}"/>
    <rect width="${totalWidth}" height="24" fill="url(#g)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="system-ui,-apple-system,sans-serif" font-size="11" font-weight="600">
    <text x="${labelWidth / 2}" y="16" fill="#a1a1aa">${label}</text>
    <text x="${labelWidth + statusWidth / 2}" y="16" fill="${statusTextColor}">${statusText}</text>
  </g>
</svg>
      `.trim();

      set.headers["content-type"] = "image/svg+xml; charset=utf-8";
      set.headers["cache-control"] = "no-cache, no-store, must-revalidate";
      return svg;
    },
    {
      params: t.Object({ slug: t.String() }),
      detail: {
        tags: ["Launch Kit"],
        summary: "Embeddable Launch Badge (SVG)",
        description: "Generates dynamic SVG trust and launch status badges for external landing pages",
      },
    }
  );

export const widgetRoutes = new Elysia({ prefix: "/widgets" })
  /**
   * Fetch Embeddable Widget Data (JSON) (PRD Modul 5: Section 7.1.B)
   */
  .get(
    "/badge/:app_slug",
    async ({ params: { app_slug }, set }) => {
      const data = await LaunchService.getWidgetData(app_slug);

      if (!data) {
        set.status = 404;
        return {
          success: false,
          error: "APP_NOT_FOUND",
          message: `Aplikasi dengan slug '${app_slug}' tidak ditemukan.`,
        };
      }

      return {
        success: true,
        data,
      };
    },
    {
      params: t.Object({ app_slug: t.String() }),
      detail: {
        tags: ["Launch Kit"],
        summary: "Fetch Embeddable Widget Data",
        description: "Returns JSON metadata for embeddable badges and social proof widgets.",
      },
    }
  )

  /**
   * Embeddable Web Component Script (FR-2.1 & NFR: Shadow DOM CSS Encapsulation)
   */
  .get(
    "/embed.js",
    ({ set }) => {
      const script = `
(function() {
  if (customElements.get('tertaut-badge')) return;

  class TertautBadge extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
    }

    async connectedCallback() {
      const app = this.getAttribute('app') || '';
      const type = this.getAttribute('type') || 'verified';
      const host = window.location.origin;

      if (!app) {
        this.shadowRoot.innerHTML = '<span style="color:#888;font-size:11px;">[tertaut-badge: missing app attr]</span>';
        return;
      }

      try {
        const res = await fetch(\`\${host}/api/v1/widgets/badge/\${app}\`);
        const json = await res.json();
        if (!json.success || !json.data) return;

        const d = json.data;
        const isLive = d.status === 'LIVE';

        let badgeContent = '';
        if (type === 'sales_counter') {
          badgeContent = \`
            <span class="dot live"></span>
            <span>\${d.totalCustomers} Lisensi Terjual</span>
            <span class="sep">•</span>
            <span class="brand">tertaut</span>
          \`;
        } else if (type === 'status') {
          badgeContent = \`
            <span class="dot \${isLive ? 'live' : 'validating'}"></span>
            <span>\${isLive ? 'Just Launched' : 'Early Access'}</span>
            <span class="sep">•</span>
            <span class="brand">tertaut</span>
          \`;
        } else {
          // verified trust badge (default)
          badgeContent = \`
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            <span>Verified by tertaut.com</span>
          \`;
        }

        this.shadowRoot.innerHTML = \`
          <style>
            :host { display: inline-block; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
            .badge {
              display: inline-flex;
              align-items: center;
              gap: 6px;
              padding: 4px 10px;
              background: #111111;
              color: #FFFFFF;
              border-radius: 9999px;
              font-size: 11px;
              font-weight: 700;
              text-decoration: none;
              border: 1px solid rgba(212, 175, 55, 0.35);
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
              transition: transform 0.15s ease;
            }
            .badge:hover { transform: translateY(-1px); border-color: #D4AF37; }
            .icon { width: 12px; height: 12px; color: #D4AF37; }
            .dot { width: 6px; height: 6px; border-radius: 50%; display: inline-block; }
            .dot.live { background: #0F4C3A; box-shadow: 0 0 6px #0F4C3A; }
            .dot.validating { background: #D4AF37; box-shadow: 0 0 6px #D4AF37; }
            .sep { opacity: 0.3; }
            .brand { color: #D4AF37; }
          </style>
          <a class="badge" href="\${d.checkoutUrl || '#'}" target="_blank" rel="noopener noreferrer">
            \${badgeContent}
          </a>
        \`;
      } catch (e) {
        console.warn('[tertaut-badge] Failed to render badge:', e);
      }
    }
  }

  customElements.define('tertaut-badge', TertautBadge);
})();
      `.trim();

      set.headers["content-type"] = "application/javascript; charset=utf-8";
      set.headers["cache-control"] = "public, max-age=3600";
      return script;
    },
    {
      detail: {
        tags: ["Launch Kit"],
        summary: "Embeddable Web Component Script",
        description: "Delivers <tertaut-badge> Web Component script with Shadow DOM encapsulation.",
      },
    }
  );
