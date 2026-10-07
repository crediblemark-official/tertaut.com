/**
 * Composable useSeo untuk Manajemen Metadata & Schema.org JSON-LD Dinamis
 * tertaut.com
 */

import { watchEffect, onUnmounted } from "vue";
import { SITE_SEO_DEFAULTS, type SeoMetaData } from "../constants/seo";

export function useSeo(
  meta: SeoMetaData | (() => SeoMetaData),
  jsonLdSchemas?: Record<string, any> | Record<string, any>[]
) {
  function updateTag(
    selector: string,
    attribute: "content" | "href",
    value: string,
    createTag: () => HTMLElement
  ) {
    if (typeof document === "undefined") return;
    let el = document.querySelector(selector);
    if (!el && value) {
      el = createTag();
      document.head.appendChild(el);
    }
    if (el) {
      el.setAttribute(attribute, value);
    }
  }

  function setMetaName(name: string, content: string) {
    updateTag(`meta[name="${name}"]`, "content", content, () => {
      const el = document.createElement("meta");
      el.setAttribute("name", name);
      return el;
    });
  }

  function setMetaProperty(property: string, content: string) {
    updateTag(`meta[property="${property}"]`, "content", content, () => {
      const el = document.createElement("meta");
      el.setAttribute("property", property);
      return el;
    });
  }

  function setLink(rel: string, href: string) {
    updateTag(`link[rel="${rel}"]`, "href", href, () => {
      const el = document.createElement("link");
      el.setAttribute("rel", rel);
      return el;
    });
  }

  function applySeo() {
    if (typeof document === "undefined") return;
    const data = typeof meta === "function" ? meta() : meta;
    if (!data) return;

    const baseOrigin = SITE_SEO_DEFAULTS.defaultOrigin.replace(/\/+$/, "");
    const title = data.title || SITE_SEO_DEFAULTS.defaultTitle;
    const description = data.description || SITE_SEO_DEFAULTS.defaultDescription;
    const canonical = data.canonicalUrl
      ? data.canonicalUrl.startsWith("http")
        ? data.canonicalUrl
        : `${baseOrigin}${data.canonicalUrl}`
      : `${baseOrigin}${window.location.pathname}`;
    const image = data.ogImage
      ? data.ogImage.startsWith("http")
        ? data.ogImage
        : `${baseOrigin}${data.ogImage}`
      : `${baseOrigin}${SITE_SEO_DEFAULTS.image}`;
    const keywords = (data.keywords || SITE_SEO_DEFAULTS.defaultKeywords).join(", ");

    // Document Title
    document.title = title;

    // Standard Meta Tags
    setMetaName("description", description);
    setMetaName("keywords", keywords);
    setMetaName(
      "robots",
      data.noindex ? "noindex, nofollow" : "index, follow, max-image-preview:large"
    );

    // Canonical Link
    setLink("canonical", canonical);

    // Open Graph
    setMetaProperty("og:title", title);
    setMetaProperty("og:description", description);
    setMetaProperty("og:url", canonical);
    setMetaProperty("og:image", image);
    setMetaProperty("og:site_name", SITE_SEO_DEFAULTS.name);
    setMetaProperty("og:type", data.ogType || "website");

    // Twitter Cards
    setMetaName("twitter:card", "summary_large_image");
    setMetaName("twitter:title", title);
    setMetaName("twitter:description", description);
    setMetaName("twitter:image", image);
    setMetaName("twitter:site", SITE_SEO_DEFAULTS.twitter);

    // Schema.org JSON-LD Script Tag
    if (jsonLdSchemas) {
      let scriptEl = document.getElementById("tertaut-jsonld") as HTMLScriptElement | null;
      if (!scriptEl) {
        scriptEl = document.createElement("script");
        scriptEl.id = "tertaut-jsonld";
        scriptEl.type = "application/ld+json";
        document.head.appendChild(scriptEl);
      }
      const schemaData = Array.isArray(jsonLdSchemas)
        ? {
            "@context": "https://schema.org",
            "@graph": jsonLdSchemas,
          }
        : jsonLdSchemas;
      scriptEl.textContent = JSON.stringify(schemaData);
    }
  }

  const stop = watchEffect(applySeo);

  onUnmounted(() => {
    stop();
    // Bersihkan script JSON-LD dinamis saat berpindah rute jika ada
    if (typeof document !== "undefined") {
      const scriptEl = document.getElementById("tertaut-jsonld");
      if (scriptEl) scriptEl.remove();
    }
  });
}
