/**
 * Rate limiter sederhana berbasis in-memory sliding window.
 * Cukup untuk single-container (arsitektur tertaut.com) tanpa dependensi Redis.
 */
type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

// Bersihkan bucket kadaluwarsa secara berkala agar tidak tumbuh tanpa batas.
const CLEANUP_INTERVAL_MS = 60_000;
let lastCleanup = Date.now();

function cleanup(now: number) {
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

function clientIp(request: Request | undefined): string {
  const headers = request?.headers;
  if (!headers) return "unknown";

  // Prioritaskan header proxy tepercaya jika tersedia (Cloudflare / Nginx / Reverse Proxy)
  const cfIp = headers.get?.("cf-connecting-ip")?.trim();
  if (cfIp && (/^[\d.]+$/.test(cfIp) || cfIp.includes(":"))) {
    return cfIp;
  }

  const realIp = headers.get?.("x-real-ip")?.trim();
  if (realIp && (/^[\d.]+$/.test(realIp) || realIp.includes(":"))) {
    return realIp;
  }

  const xff = headers.get?.("x-forwarded-for");
  if (xff) {
    const candidate = xff.split(",")[0]?.trim();
    if (candidate && (/^[\d.]+$/.test(candidate) || candidate.includes(":"))) {
      return candidate;
    }
  }

  return "unknown";
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfter: number;
}

/**
 * Batasi permintaan per (scope + IP) dalam window tertentu.
 */
export function enforceRateLimit(
  request: Request | undefined,
  scope: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  cleanup(now);

  const key = `${scope}:${clientIp(request)}`;
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfter: 0 };
  }

  if (bucket.count >= limit) {
    return { allowed: false, retryAfter: Math.ceil((bucket.resetAt - now) / 1000) };
  }

  bucket.count += 1;
  return { allowed: true, retryAfter: 0 };
}

/** Hanya untuk pengujian. */
export function resetRateLimits() {
  buckets.clear();
}
