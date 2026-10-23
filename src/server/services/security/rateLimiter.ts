import { getClientIp } from "../../lib/ip";

export interface RateLimitResult {
  allowed: boolean;
  retryAfter: number;
}

export interface RateLimiterAdapter {
  consume(key: string, limit: number, windowMs: number): Promise<RateLimitResult> | RateLimitResult;
  reset(): Promise<void> | void;
}

type Bucket = { count: number; resetAt: number };

/**
 * Adapter In-Memory sliding-window default.
 * Cocok untuk local dev, test runner, atau single-container self-hosted.
 */
export class MemoryRateLimiterAdapter implements RateLimiterAdapter {
  private buckets = new Map<string, Bucket>();
  private lastCleanup = Date.now();
  private readonly CLEANUP_INTERVAL_MS = 60_000;
  private readonly MAX_BUCKETS = 10_000;

  private cleanup(now: number) {
    if (now - this.lastCleanup < this.CLEANUP_INTERVAL_MS && this.buckets.size < this.MAX_BUCKETS) {
      return;
    }
    this.lastCleanup = now;
    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= now) this.buckets.delete(key);
    }

    // Proteksi memory leak: jika masih melebihi kapasitas saat flooding, hapus entri tertua
    if (this.buckets.size >= this.MAX_BUCKETS) {
      const toDeleteCount = Math.floor(this.MAX_BUCKETS * 0.2);
      let deleted = 0;
      for (const key of this.buckets.keys()) {
        this.buckets.delete(key);
        deleted++;
        if (deleted >= toDeleteCount) break;
      }
    }
  }

  consume(key: string, limit: number, windowMs: number): RateLimitResult {
    const now = Date.now();
    this.cleanup(now);

    const bucket = this.buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + windowMs });
      return { allowed: true, retryAfter: 0 };
    }

    if (bucket.count >= limit) {
      return { allowed: false, retryAfter: Math.ceil((bucket.resetAt - now) / 1000) };
    }

    bucket.count += 1;
    return { allowed: true, retryAfter: 0 };
  }

  reset(): void {
    this.buckets.clear();
  }

  size(): number {
    return this.buckets.size;
  }
}

/**
 * Adapter Distributed Redis / Upstash untuk deployment multi-instance
 * (misal Docker Swarm, Kubernetes, atau multiple Dokploy containers).
 * Mendukung Redis REST API (Upstash) atau fallback atomik.
 */
export class RedisRateLimiterAdapter implements RateLimiterAdapter {
  private fallbackMemory = new MemoryRateLimiterAdapter();
  private restUrl?: string;
  private restToken?: string;

  constructor(options?: { restUrl?: string; restToken?: string }) {
    this.restUrl = options?.restUrl || process.env.UPSTASH_REDIS_REST_URL;
    this.restToken = options?.restToken || process.env.UPSTASH_REDIS_REST_TOKEN;
  }

  async consume(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
    if (!this.restUrl || !this.restToken) {
      // Jika kredensial Redis belum diisi, fallback transparan ke memory adapter
      return this.fallbackMemory.consume(key, limit, windowMs);
    }

    try {
      const redisKey = `rl:${key}`;
      const expireSeconds = Math.max(1, Math.ceil(windowMs / 1000));

      // Upstash REST atomic pipeline INCR + EXPIRE
      const response = await fetch(`${this.restUrl}/pipeline`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.restToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify([
          ["INCR", redisKey],
          ["EXPIRE", redisKey, expireSeconds],
          ["TTL", redisKey],
        ]),
      });

      if (!response.ok) {
        throw new Error(`Redis HTTP status ${response.status}`);
      }

      const results = (await response.json()) as Array<{ result?: any }>;
      const currentCount = Number(results?.[0]?.result ?? 1);
      const ttl = Number(results?.[2]?.result ?? expireSeconds);

      if (currentCount > limit) {
        return { allowed: false, retryAfter: Math.max(1, ttl) };
      }

      return { allowed: true, retryAfter: 0 };
    } catch (err: any) {
      // Graceful degradation: bila Redis down / timeout, izinkan request lewat memory fallback
      return this.fallbackMemory.consume(key, limit, windowMs);
    }
  }

  async reset(): Promise<void> {
    this.fallbackMemory.reset();
  }
}

const memoryAdapter = new MemoryRateLimiterAdapter();
let activeAdapter: RateLimiterAdapter;

// Di production, wajib ada Redis; di development/testing boleh fallback ke memory
if (process.env.NODE_ENV === "production") {
  const hasRedisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const hasRedisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (hasRedisUrl && hasRedisToken) {
    activeAdapter = new RedisRateLimiterAdapter();
  } else {
    throw new Error(
      "[rateLimiter] Di production, UPSTASH_REDIS_REST_URL dan UPSTASH_REDIS_REST_TOKEN wajib disetel. " +
        "Rate limiter multi-instance tidak bisa bekerja tanpa Redis."
    );
  }
} else {
  // Development/testing: gunakan memory adapter dengan peringatan
  console.warn(
    "[rateLimiter] NODE_ENV !== production, menggunakan in-memory rate limiter. " +
      "Untuk production, set UPSTASH_REDIS_REST_URL dan UPSTASH_REDIS_REST_TOKEN."
  );
  activeAdapter = memoryAdapter;
}

export function setRateLimiterAdapter(adapter: RateLimiterAdapter) {
  activeAdapter = adapter;
}

export function getRateLimiterAdapter(): RateLimiterAdapter {
  return activeAdapter;
}

function clientIp(request: Request | undefined): string {
  return getClientIp(request) || "unknown";
}

/**
 * Batasi permintaan per (scope + IP) dalam window tertentu.
 * Fast synchronous path (menggunakan Memory sliding-window default).
 */
export function enforceRateLimit(
  request: Request | undefined,
  scope: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const key = `${scope}:${clientIp(request)}`;
  const res = memoryAdapter.consume(key, limit, windowMs);
  return res;
}

/**
 * Batasi permintaan per (scope + IP) dalam window tertentu secara terdistribusi.
 * Mendukung Redis Upstash / adapter multi-instance dengan graceful fallback.
 */
export async function enforceRateLimitAsync(
  request: Request | undefined,
  scope: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult> {
  const key = `${scope}:${clientIp(request)}`;
  return await activeAdapter.consume(key, limit, windowMs);
}

/** Hanya untuk pengujian. */
export function resetRateLimits() {
  memoryAdapter.reset();
  if (activeAdapter !== memoryAdapter) {
    activeAdapter.reset();
  }
}
