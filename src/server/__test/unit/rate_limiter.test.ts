import { describe, it, expect, beforeEach } from "bun:test";
import {
  enforceRateLimit,
  enforceRateLimitAsync,
  resetRateLimits,
} from "../../services/security/rateLimiter";

describe("Unit Tests - RateLimiter Service", () => {
  beforeEach(() => {
    resetRateLimits();
  });

  it("should extract client IP from various headers and handle fallback", () => {
    // 1. cf-connecting-ip
    const reqCf = new Request("http://localhost/test", {
      headers: { "cf-connecting-ip": "198.51.100.1" },
    });
    const resCf = enforceRateLimit(reqCf, "test-scope", 5, 60_000);
    expect(resCf.allowed).toBe(true);

    // 2. x-real-ip
    const reqReal = new Request("http://localhost/test", {
      headers: { "x-real-ip": "198.51.100.2" },
    });
    const resReal = enforceRateLimit(reqReal, "test-scope", 5, 60_000);
    expect(resReal.allowed).toBe(true);

    // 3. x-forwarded-for with multiple IPs
    const reqXff = new Request("http://localhost/test", {
      headers: { "x-forwarded-for": "198.51.100.3, 10.0.0.1" },
    });
    const resXff = enforceRateLimit(reqXff, "test-scope", 5, 60_000);
    expect(resXff.allowed).toBe(true);

    // 4. IPv6 support
    const reqIpv6 = new Request("http://localhost/test", {
      headers: { "cf-connecting-ip": "2001:db8::1" },
    });
    const resIpv6 = enforceRateLimit(reqIpv6, "test-scope", 5, 60_000);
    expect(resIpv6.allowed).toBe(true);

    // 5. Undefined request / missing headers fallback
    const resUndefined = enforceRateLimit(undefined, "test-scope", 5, 60_000);
    expect(resUndefined.allowed).toBe(true);

    const reqEmpty = new Request("http://localhost/test");
    const resEmpty = enforceRateLimit(reqEmpty, "test-scope", 5, 60_000);
    expect(resEmpty.allowed).toBe(true);
  });

  it("should enforce limit and return retryAfter when exceeded", () => {
    const req = new Request("http://localhost/test", {
      headers: { "x-real-ip": "203.0.113.50" },
    });

    const limit = 3;
    const windowMs = 5000;

    // 1st request
    const r1 = enforceRateLimit(req, "auth", limit, windowMs);
    expect(r1.allowed).toBe(true);
    expect(r1.retryAfter).toBe(0);

    // 2nd request
    const r2 = enforceRateLimit(req, "auth", limit, windowMs);
    expect(r2.allowed).toBe(true);

    // 3rd request
    const r3 = enforceRateLimit(req, "auth", limit, windowMs);
    expect(r3.allowed).toBe(true);

    // 4th request (exceeded limit)
    const r4 = enforceRateLimit(req, "auth", limit, windowMs);
    expect(r4.allowed).toBe(false);
    expect(r4.retryAfter).toBeGreaterThan(0);
    expect(r4.retryAfter).toBeLessThanOrEqual(5);
  });

  it("should support enforceRateLimitAsync and RedisRateLimiterAdapter fallback", async () => {
    const req = new Request("http://localhost/test", {
      headers: { "x-real-ip": "192.0.2.1" },
    });

    // Test async path with memory fallback
    const res1 = await enforceRateLimitAsync(req, "async-scope", 2, 5000);
    expect(res1.allowed).toBe(true);

    const res2 = await enforceRateLimitAsync(req, "async-scope", 2, 5000);
    expect(res2.allowed).toBe(true);

    const res3 = await enforceRateLimitAsync(req, "async-scope", 2, 5000);
    expect(res3.allowed).toBe(false);
    expect(res3.retryAfter).toBeGreaterThan(0);
  });
});
