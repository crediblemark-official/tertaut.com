import { Elysia } from "elysia";
import { queryClient } from "../db";
import { config } from "../config";

export const healthRoutes = new Elysia({ prefix: "/health" })
  .get(
    "/",
    async () => {
      let dbStatus = "unknown";
      let tables: string[] = [];
      try {
        const rows = await queryClient`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
      `;
        dbStatus = "connected";
        tables = rows.map((r: any) => r.table_name);
      } catch (err: any) {
        dbStatus = `error: ${err?.message || err}`;
      }

      return {
        status: "ok",
        version: "2.2.3",
        timestamp: new Date().toISOString(),
        db: {
          status: dbStatus,
          tableCount: tables.length,
          hasUserTable: tables.includes("user"),
          hasAppsTable: tables.includes("apps"),
          tables,
        },
      };
    },
    {
      detail: {
        tags: ["System"],
        summary: "Health Check",
        description: "Returns the health and operational status of tertaut.com engine",
      },
    }
  )

  .get(
    "/dana",
    async () => {
      const { cleanPemKey } = await import("../config");
      const crypto = await import("crypto");

      const dana = config.dana;
      const hasClientId = !!dana.clientId;
      const hasClientSecret = !!dana.clientSecret;
      const hasMerchantId = !!dana.merchantId;

      // Validate private key can be parsed by Node crypto
      let privateKeyValid = false;
      let privateKeyBits: number | null = null;
      if (dana.privateKey) {
        try {
          const privPem = cleanPemKey(dana.privateKey);
          const key = crypto.createPrivateKey({ key: privPem, format: "pem" });
          privateKeyValid = true;
          privateKeyBits = (key as any).asymmetricKeyDetails?.modulusLength ?? null;
        } catch {
          /* invalid */
        }
      }

      // Validate public key (DANA's key for webhook verification)
      let webhookPublicKeyValid = false;
      if (dana.publicKey) {
        try {
          const pubPem = dana.publicKey.includes("-----BEGIN")
            ? dana.publicKey
            : `-----BEGIN PUBLIC KEY-----\n${dana.publicKey.match(/.{1,64}/g)?.join("\n")}\n-----END PUBLIC KEY-----`;
          crypto.createPublicKey({ key: pubPem, format: "pem" });
          webhookPublicKeyValid = true;
        } catch {
          /* invalid */
        }
      }

      // Test connectivity to DANA API (non-destructive)
      let apiReachable: boolean | null = null;
      try {
        const controller = new AbortController();
        const t = setTimeout(() => controller.abort(), 5000);
        const res = await fetch(dana.baseUrl + "/v1.0/utilities/get-date", {
          method: "GET",
          signal: controller.signal,
        }).finally(() => clearTimeout(t));
        apiReachable = res.status < 500;
      } catch {
        apiReachable = false;
      }

      const ready =
        hasClientId && hasClientSecret && hasMerchantId && privateKeyValid && webhookPublicKeyValid;

      return {
        status: ready ? "ok" : "incomplete",
        env: dana.env,
        baseUrl: dana.baseUrl,
        credentials: {
          clientId: hasClientId ? dana.clientId!.slice(0, 8) + "..." : null,
          hasClientSecret,
          hasMerchantId,
        },
        keys: {
          hasPrivateKey: !!dana.privateKey,
          privateKeyValid,
          privateKeyBits,
          hasWebhookPublicKey: !!dana.publicKey,
          webhookPublicKeyValid,
        },
        connectivity: {
          apiReachable,
          testedUrl: dana.baseUrl,
        },
        readyForLive: ready,
        missingItems: [
          !hasClientId && "DANA_CLIENT_ID",
          !hasClientSecret && "DANA_CLIENT_SECRET",
          !hasMerchantId && "DANA_MERCHANT_ID",
          !privateKeyValid && "DANA_PRIVATE_KEY_BASE64 (invalid or missing)",
          !webhookPublicKeyValid &&
            "DANA_PUBLIC_KEY_BASE64 (public key DANA untuk webhook — ambil dari DANA dashboard)",
        ].filter(Boolean),
      };
    },
    {
      detail: {
        tags: ["System"],
        summary: "DANA Payment Gateway Health",
        description:
          "Validates DANA credentials, RSA key integrity, and API connectivity. Safe to call — no payment initiated.",
      },
    }
  );
