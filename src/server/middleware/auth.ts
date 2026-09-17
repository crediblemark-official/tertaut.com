import { Elysia } from "elysia";
import { auth } from "../auth";
import { config } from "../config";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role?: string | null;
}

/**
 * Pengguna sintetis untuk development/sandbox ketika belum login.
 * Di production (config.isProd) TIDAK dipakai — request tanpa sesi ditolak.
 */
const DEV_USER: AuthUser = {
  id: "dev-user",
  email: "dev@tertaut.local",
  name: "Development User",
  role: "admin",
};

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
 */
export async function authenticate(headers: Headers, admin = false): Promise<AuthResult> {
  const session = await resolveSession(headers);
  const user = (session?.user as AuthUser | undefined) ?? (!config.isProd ? DEV_USER : null);
  if (!user) return { status: 401, error: "Unauthorized" };
  if (admin && user.role !== "admin") return { status: 403, error: "Forbidden" };
  return { user, session: session?.session ?? null };
}

export const authMiddleware = new Elysia({ name: "auth" })
  /**
   * Wajib login. Di production request tanpa sesi → 401.
   * Di dev/sandbox otomatis memakai DEV_USER agar alur dashboard tetap bisa dites.
   */
  .macro({
    requireAuth: {
      async resolve({ status, request: { headers } }) {
        const session = await resolveSession(headers);
        if (session) return { user: session.user, session: session.session };
        if (!config.isProd) return { user: DEV_USER, session: null };
        return status(401, { error: "Unauthorized" });
      },
    },
    /** Wajib login + role `admin`. */
    requireAdmin: {
      async resolve({ status, request: { headers } }) {
        const session = await resolveSession(headers);
        const user = session?.user ?? (!config.isProd ? DEV_USER : null);
        if (!user) return status(401, { error: "Unauthorized" });
        if ((user as AuthUser).role !== "admin") {
          return status(403, { error: "Forbidden" });
        }
        return { user, session: session?.session ?? null };
      },
    },
  });
