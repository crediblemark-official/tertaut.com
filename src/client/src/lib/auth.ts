import { createAuthClient } from "better-auth/vue";

/**
 * Better Auth client. Base URL default = origin saat ini sehingga request
 * melewati Vite proxy (/api/auth) di dev dan same-origin di production.
 */
export const authClient = createAuthClient();

export const { useSession, signIn, signUp, signOut } = authClient;
