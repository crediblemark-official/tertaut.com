/**
 * Utilitas terpusat untuk membaca alamat IP klien dari request headers
 * (memeriksa x-forwarded-for, x-real-ip, dan cf-connecting-ip).
 */
function isValidIp(ip: string): boolean {
  return /^[\d.]+$/.test(ip) || ip.includes(":");
}

export function getClientIp(request?: { headers?: any } | Request | any): string | null {
  if (!request) return null;
  const headers = request instanceof Request ? request.headers : request.headers;
  if (!headers) return null;

  const getHeader = (key: string): string | null | undefined => {
    if (typeof headers.get === "function") {
      return headers.get(key);
    }
    return headers[key] || headers[key.toLowerCase()];
  };

  const cfIp = getHeader("cf-connecting-ip")?.trim();
  if (cfIp && isValidIp(cfIp)) return cfIp;

  const realIp = getHeader("x-real-ip")?.trim();
  if (realIp && isValidIp(realIp)) return realIp;

  const forwarded = getHeader("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first && isValidIp(first)) return first;
  }

  return null;
}
