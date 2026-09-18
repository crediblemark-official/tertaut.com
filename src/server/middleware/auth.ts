import { Elysia } from "elysia";
import { auth } from "../auth";
import { db } from "../db";
import { builders } from "../db/schema";
import { eq } from "drizzle-orm";
import type { Builder } from "../db/schema/builders";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role?: string | null;
}

export type SecretApiKeyResult =
  | { builder: Builder }
  | { status: 401; error: string };

async function resolveSession(headers: Headers) {
  try {
    return await auth.api.getSession({ headers });
  } catch {
    return null;
  }
}

export type AuthResult =
  | { user: AuthUser; session: unknown | null }
  | { status: 401 | 403; error: string };

/**
 * Helper guard untuk dipakai di `onBeforeHandle` router yang seluruh endpoint-nya privat.
 * Menegakkan sesi autentikasi Better Auth yang valid untuk semua lingkungan.
 */
export async function authenticate(headers: Headers, admin = false): Promise<AuthResult> {
  const session = await resolveSession(headers);
  const user = session?.user as AuthUser | undefined;
  if (!user) return { status: 401, error: "Unauthorized" };
  if (admin && user.role !== "admin") return { status: 403, error: "Forbidden" };
  return { user, session: session?.session ?? null };
}

/**
 * Server-to-server (S2S): autentikasi via `Authorization: Bearer tt_secret_...`.
 * Digunakan oleh backend milik builder untuk memanggil API tertaut tanpa sesi dashboard.
 */
export async function authenticateSecretApiKey(headers: Headers): Promise<SecretApiKeyResult> {
  const authorization = headers.get("authorization") || "";
  const key = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!/^tt_secret_/.test(key)) {
    return { status: 401, error: "Wajib menyertakan Authorization: Bearer tt_secret_..." };
  }
  const builder = await db.query.builders.findFirst({
    where: eq(builders.secretApiKey, key),
  });
  if (!builder) {
    return { status: 401, error: "Secret API key tidak valid" };
  }
  return { builder };
}

export const authMiddleware = new Elysia({ name: "auth" })
  /**
   * Wajib login. Request tanpa sesi valid → 401.
   */
  .macro({
    requireAuth: {
      async resolve({ status, request: { headers } }) {
        const session = await resolveSession(headers);
        if (session) return { user: session.user, session: session.session };
        return status(401, { error: "Unauthorized" });
      },
    },
    /** Wajib login + role `admin`. */
    requireAdmin: {
      async resolve({ status, request: { headers } }) {
        const session = await resolveSession(headers);
        const user = session?.user;
        if (!user) return status(401, { error: "Unauthorized" });
        if ((user as AuthUser).role !== "admin") {
          return status(403, { error: "Forbidden" });
        }
        return { user, session: session?.session ?? null };
      },
    },
  });
