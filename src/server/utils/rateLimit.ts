import { enforceRateLimit } from "../services/rateLimiter";

export function checkRateLimit(
  request: Request,
  scope: string,
  limit: number,
  windowMs: number
) {
  const result = enforceRateLimit(request, scope, limit, windowMs);
  if (!result.allowed) {
    return {
      allowed: false,
      retryAfter: result.retryAfter,
      error: `Terlalu banyak permintaan. Coba lagi dalam ${result.retryAfter} detik.`,
    };
  }
  return { allowed: true };
}
