import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin } from "better-auth/plugins";
import { db } from "./db";
import { config } from "./config";
import { user, session, account, verification } from "./db/schema";
import { EmailService } from "./services/email";

const trustedOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:8081",
  "http://127.0.0.1:8081",
  "https://tertaut.com",
  "https://*.tertaut.com",
  config.publicAppUrl,
  config.publicStoreUrl,
].filter(Boolean);

/**
 * Verifikasi email wajib (anti-registrasi email orang lain / akun palsu).
 * Diaktifkan hanya bila:
 *  - mail provider (Resend) terkonfigurasi DAN pengiriman aktif (production —
 *    di dev/test/sandbox pengiriman email dilewati otomatis), sehingga tautan
 *    verifikasi benar-benar terkirim ke inbox user,
 *  - bukan environment test (suite tes memakai user seed tanpa alur verifikasi),
 *  - tidak dimatikan eksplisit via REQUIRE_EMAIL_VERIFICATION=false.
 */
const verifyEmailEnabled =
  EmailService.isConfigured() &&
  EmailService.isDeliveryEnabled() &&
  config.nodeEnv !== "test" &&
  process.env.REQUIRE_EMAIL_VERIFICATION !== "false";

export const auth = betterAuth({
  appName: "tertaut.com",
  secret: config.security.betterAuthSecret,
  baseURL: config.publicAppUrl,
  basePath: "/api/auth",
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: { user, session, account, verification },
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    requireEmailVerification: verifyEmailEnabled,
  },
  rateLimit: {
    window: 60,
    max: 100,
  },
  trustedOrigins,
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 hari
    updateAge: 60 * 60 * 24, // refresh harian
  },
  advanced: {
    // trustedProxyHeaders otomatis mengikuti konfigurasi TRUST_PROXY — jangan
    // percaya header client (x-forwarded-for) bila tidak ada proxy tepercaya.
    trustedProxyHeaders: config.trustProxy,
    // Cookie Secure default production; bisa di-override via USE_SECURE_COOKIES
    // untuk staging HTTPS (NODE_ENV != production).
    useSecureCookies: config.useSecureCookies,
    defaultCookieAttributes: {
      sameSite: "lax",
      secure: config.useSecureCookies,
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (userRecord) => {
          // Hanya email platform (platformtertaut@gmail.com atau ADMIN_EMAIL) yang berhak menjadi admin.
          // Akun pertama TIDAK otomatis menjadi admin.
          const adminEmail = (process.env.ADMIN_EMAIL || "platformtertaut@gmail.com").toLowerCase();
          const isPlatformAdmin = userRecord.email?.toLowerCase() === adminEmail;
          return {
            data: {
              ...userRecord,
              role: isPlatformAdmin ? "admin" : "user",
              ...(isPlatformAdmin ? { emailVerified: true } : {}),
            },
          };
        },
      },
    },
  },
  plugins: [admin()],
  ...(verifyEmailEnabled
    ? {
        emailVerification: {
          sendOnSignUp: true,
          expiresIn: 60 * 60, // tautan verifikasi berlaku 1 jam
          sendVerificationEmail: async ({ user, url }) => {
            const name = (user as { name?: string }).name;
            await EmailService.send({
              to: user.email,
              subject: "Verifikasi email Tertaut",
              html: `<p>Halo${name ? ` ${name}` : ""},</p>
<p>Terima kasih telah mendaftar di Tertaut. Klik tautan berikut untuk memverifikasi email Anda:</p>
<p><a href="${url}">Verifikasi Email</a></p>
<p>Tautan berlaku 1 jam. Jika Anda tidak mendaftar, abaikan email ini.</p>`,
              text: `Verifikasi email Anda: ${url}`,
            });
          },
        },
      }
    : {}),
});

export type Auth = typeof auth;
