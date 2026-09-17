import { db } from "../../db";
import { licenses, revokedTokens } from "../../db/schema";
import { eq } from "drizzle-orm";
import { LicenseTokenService } from "../../services/licenseToken";
import { enforceRateLimit } from "../../services/rateLimiter";

export async function handleVerifyOfflineToken({ body, set, request }: any) {
  const { token } = body;

  const rl = enforceRateLimit(request, "licensing:verify-offline", 120, 60_000);
  if (!rl.allowed) {
    set.status = 429;
    return { valid: false, reason: "RATE_LIMITED" };
  }

  const decoded = LicenseTokenService.verify(token);
  if (!decoded.valid || !decoded.claims) {
    set.status = 401;
    return { valid: false, reason: decoded.reason || "INVALID_OR_EXPIRED_TOKEN" };
  }

  const claims = decoded.claims;

  // Denylist: token yang di-revoke tidak boleh dianggap valid.
  const revoked = await db.query.revokedTokens.findFirst({
    where: eq(revokedTokens.jti, claims.jti),
  });
  if (revoked) {
    set.status = 401;
    return { valid: false, reason: "TOKEN_REVOKED" };
  }

  // Cek status lisensi di server (revoked/expired menang atas token).
  const lic = await db.query.licenses.findFirst({
    where: eq(licenses.licenseKey, claims.lic),
  });
  if (!lic || lic.status !== "ACTIVE") {
    set.status = 401;
    return { valid: false, reason: lic ? `LICENSE_${lic.status}` : "LICENSE_NOT_FOUND" };
  }

  return {
    valid: true,
    licenseKey: claims.lic,
    appId: claims.app,
    hardwareHash: claims.hw,
    seats: claims.seats || 3,
    expiresAt: claims.exp ? new Date(claims.exp * 1000).toISOString() : null,
    mode: "OFFLINE_GRACE_ACTIVE",
  };
}
