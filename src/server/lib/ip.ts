import { isIP } from "node:net";
import { config } from "../config";

/**
 * Utilitas terpusat untuk membaca alamat IP klien dari request headers.
 *
 * Keamanan (P0-AUTH): header x-forwarded-for / x-real-ip / cf-connecting-ip
 * TIDAK boleh dipercaya begitu saja — nilainya bisa dipalsukan oleh klien untuk
 * me-reset bucket rate limiter (rotasi IP). Aturan yang diterapkan:
 *
 * 1. Seluruh header hanya dipakai jika `config.trustProxy` aktif (deploy di
 *    belakang reverse-proxy tepercaya seperti Dokploy/Traefik). Jika false,
 *    header diabaikan total (rate limiter memakai satu bucket per scope).
 * 2. Dari `x-forwarded-for`, hanya entry PALING KANAN yang dipakai — entry itu
 *    ditambahkan oleh proxy terakhir yang menangani request. Entry kiri-tengah
 *    bisa diisi klien dan tidak boleh dipertanggungjawabkan.
 */
function isValidIp(ip: string): boolean {
  return isIP(ip.trim()) !== 0;
}

export function getClientIp(request?: { headers?: any } | Request | any): string | null {
  if (!request) return null;

  // Tanpa proxy tepercaya, header IP tidak dipercaya sama sekali.
  if (!config.trustProxy) return null;

  const headers = request instanceof Request ? request.headers : request.headers;
  if (!headers) return null;

  const getHeader = (key: string): string | null | undefined => {
    if (typeof headers.get === "function") {
      return headers.get(key);
    }
    return headers[key] || headers[key.toLowerCase()];
  };

  // Cloudflare / nginx: header yang diatur oleh proxy tepercaya itu sendiri.
  const cfIp = getHeader("cf-connecting-ip")?.trim();
  if (cfIp && isValidIp(cfIp)) return cfIp;

  const realIp = getHeader("x-real-ip")?.trim();
  if (realIp && isValidIp(realIp)) return realIp;

  // x-forwarded-for: daftar hop dipisah koma, kiri = paling dekat klien (bisa
  // dipalsukan), kanan = ditambahkan proxy terakhir yang tepercaya.
  const forwarded = getHeader("x-forwarded-for");
  if (forwarded) {
    const hops = forwarded
      .split(",")
      .map((h) => h.trim())
      .filter(Boolean);
    for (let i = hops.length - 1; i >= 0; i--) {
      const hop = hops[i];
      if (isValidIp(hop)) return hop;
    }
  }

  return null;
}
