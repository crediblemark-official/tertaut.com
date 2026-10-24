import { Elysia } from "elysia";
import { existsSync, statSync } from "fs";
import { resolve } from "path";
import { config } from "../config";
import { isCrawler, resolveMetadataForPath, injectDynamicSeo } from "../services/seo/seoPrerender";

const clientDistPath = resolve(import.meta.dir, "../../../dist");
const docsDistPath = resolve(clientDistPath, "docs");
const isProduction = process.env.NODE_ENV === "production";
export const hasBuiltClient = isProduction && existsSync(clientDistPath);

/** Kirim file dari dalam folder dist (docs) dengan sanitasi path traversal */
export function serveFromDir(
  dir: string,
  pathname: string,
  set: { status?: number | string; [key: string]: any }
): any | { error: string } {
  const safePath = decodeURIComponent(pathname).replace(/\.\.+[/\\]/g, "");
  let targetFile = resolve(dir, "." + safePath);

  if (targetFile.startsWith(dir) && existsSync(targetFile) && !statSync(targetFile).isDirectory()) {
    if (targetFile.endsWith(".txt")) {
      set.headers["content-type"] = "text/plain; charset=utf-8";
    }
    return Bun.file(targetFile);
  }

  // Fallback halaman tanpa ekstensi (misal /docs/sdk):
  if (!safePath.split("/").pop()?.includes(".")) {
    targetFile = resolve(dir, "." + safePath + ".html");
    if (
      targetFile.startsWith(dir) &&
      existsSync(targetFile) &&
      !statSync(targetFile).isDirectory()
    ) {
      return Bun.file(targetFile);
    }
  }

  set.status = 404;
  return { error: "Not Found" };
}

const plugin = new Elysia();

if (hasBuiltClient) {
  const serveDocsIndex = () => {
    const indexPath = resolve(docsDistPath, "index.html");
    if (existsSync(indexPath)) {
      return Bun.file(indexPath);
    }
    return { error: "Docs belum di-build (jalankan: bun run build:docs)" };
  };

  plugin
    // VitePress /docs (base: /docs/)
    .get("/docs", ({ request, set }) => {
      const url = new URL(request.url);
      if (url.pathname === "/docs") {
        set.status = 301;
        set.headers["location"] = "/docs/";
        return {};
      }
      return serveDocsIndex();
    })
    .get("/docs/", serveDocsIndex)
    .get("/docs/llms.txt", ({ set }) => {
      const fileInDist = resolve(docsDistPath, "llms.txt");
      if (existsSync(fileInDist)) {
        set.headers["content-type"] = "text/plain; charset=utf-8";
        return Bun.file(fileInDist);
      }
      const srcFile = resolve(import.meta.dir, "../../../docs/public/llms.txt");
      if (existsSync(srcFile)) {
        set.headers["content-type"] = "text/plain; charset=utf-8";
        return Bun.file(srcFile);
      }
      set.status = 404;
      return { error: "llms.txt not found" };
    })
    .get("/docs/llms-full.txt", ({ set }) => {
      const fileInDist = resolve(docsDistPath, "llms-full.txt");
      if (existsSync(fileInDist)) {
        set.headers["content-type"] = "text/plain; charset=utf-8";
        return Bun.file(fileInDist);
      }
      const srcFile = resolve(import.meta.dir, "../../../docs/public/llms-full.txt");
      if (existsSync(srcFile)) {
        set.headers["content-type"] = "text/plain; charset=utf-8";
        return Bun.file(srcFile);
      }
      set.status = 404;
      return { error: "llms-full.txt not found" };
    })
    .get("/docs/*", ({ request, set }) =>
      serveFromDir(docsDistPath, new URL(request.url).pathname.slice("/docs".length), set)
    )
    // SPA fallback
    .get("*", async ({ request, set }) => {
      const url = new URL(request.url);
      if (url.pathname.startsWith("/api/")) {
        set.status = 404;
        return { error: `Endpoint API ${url.pathname} tidak ditemukan` };
      }
      const decodedPath = decodeURIComponent(url.pathname);
      // Sanitize path traversal attempts
      const safePath = decodedPath.replace(/\.\.+[/\\]/g, "");

      // Sajikan robots.txt, llms.txt, & llms-full.txt dengan header text/plain
      if (
        url.pathname === "/robots.txt" ||
        url.pathname === "/llms.txt" ||
        url.pathname === "/llms-full.txt"
      ) {
        const fileName = url.pathname.slice(1);
        const txtFile = resolve(clientDistPath, fileName);
        if (existsSync(txtFile)) {
          set.headers["content-type"] = "text/plain; charset=utf-8";
          return Bun.file(txtFile);
        }
      }

      // Sajikan favicon dengan Content-Type & cache-control eksplisit
      if (url.pathname === "/favicon.ico") {
        const file = resolve(clientDistPath, "favicon.ico");
        if (existsSync(file)) {
          set.headers["content-type"] = "image/x-icon";
          set.headers["cache-control"] = "public, max-age=86400";
          return Bun.file(file);
        }
      }
      if (url.pathname === "/favicon.svg") {
        const file = resolve(clientDistPath, "favicon.svg");
        if (existsSync(file)) {
          set.headers["content-type"] = "image/svg+xml";
          set.headers["cache-control"] = "public, max-age=86400";
          return Bun.file(file);
        }
      }
      if (url.pathname === "/favicon.png") {
        const file = resolve(clientDistPath, "favicon.png");
        if (existsSync(file)) {
          set.headers["content-type"] = "image/png";
          set.headers["cache-control"] = "public, max-age=86400";
          return Bun.file(file);
        }
      }

      // Sajikan .well-known/ai-catalog.json dengan header application/json
      if (url.pathname === "/.well-known/ai-catalog.json") {
        const catalogFile = resolve(clientDistPath, ".well-known/ai-catalog.json");
        if (existsSync(catalogFile)) {
          set.headers["content-type"] = "application/json; charset=utf-8";
          return Bun.file(catalogFile);
        }
      }

      const targetFile = resolve(clientDistPath, "." + safePath);

      // Ensure resolved path is strictly within clientDistPath
      if (
        targetFile.startsWith(clientDistPath) &&
        existsSync(targetFile) &&
        !statSync(targetFile).isDirectory()
      ) {
        return Bun.file(targetFile);
      }

      const indexPath = resolve(clientDistPath, "index.html");
      if (existsSync(indexPath)) {
        set.headers["content-type"] = "text/html; charset=utf-8";
        try {
          const rawHtml = await Bun.file(indexPath).text();
          const userAgent = request.headers.get("user-agent");
          const meta = await resolveMetadataForPath(url.pathname);
          return injectDynamicSeo(rawHtml, meta, { isCrawler: isCrawler(userAgent) });
        } catch {
          return Bun.file(indexPath);
        }
      }
      set.status = 404;
      return { error: "Not Found" };
    });
} else {
  // Development: Port 8081 is strictly Backend API & Swagger
  plugin.get("*", ({ request, set }) => {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      set.status = 404;
      return { error: `Endpoint API ${url.pathname} tidak ditemukan` };
    }
    if (url.pathname === "/") {
      return {
        service: "tertaut.com Engine Backend API",
        port: config.port,
        mode: "development",
        endpoints: {
          swagger: `http://localhost:${config.port}/swagger`,
          docs: "http://localhost:5173/docs",
          health: `http://localhost:${config.port}/api/v1/health`,
        },
        notice: "Frontend UI is running on Vite Dev Server: http://localhost:5173",
      };
    }
    // Redirect accidental frontend route visits to Vite dev server
    return Response.redirect(`http://localhost:5173${url.pathname}${url.search}`, 302);
  });
}

export const staticSpaRoutes = plugin;
