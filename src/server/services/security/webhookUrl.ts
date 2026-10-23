import { lookup } from "node:dns/promises";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { BlockList, isIP } from "node:net";

const blocked = new BlockList();
for (const [address, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const)
  blocked.addSubnet(address, prefix, "ipv4");
const globalV6 = new BlockList();
globalV6.addSubnet("2000::", 3, "ipv6");
blocked.addSubnet("2001::", 23, "ipv6");
blocked.addSubnet("2001:db8::", 32, "ipv6");
blocked.addSubnet("2002::", 16, "ipv6");

export function isPublicWebhookAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return !blocked.check(address, "ipv4");
  return family === 6 && globalV6.check(address, "ipv6") && !blocked.check(address, "ipv6");
}

export function parseWebhookUrl(value: string): URL {
  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
    throw new Error("Webhook harus berupa URL HTTP(S) publik tanpa kredensial");
  }
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(hostname) && !isPublicWebhookAddress(hostname)) {
    throw new Error("Alamat jaringan internal tidak diizinkan untuk webhook");
  }
  if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local")) {
    throw new Error("Alamat jaringan internal tidak diizinkan untuk webhook");
  }
  return url;
}

/** Resolve every time, then pin the validated address to the socket (no DNS rebinding). */
export async function resolveWebhookTarget(value: string, resolver = lookup) {
  const url = parseWebhookUrl(value);
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = isIP(hostname)
    ? [{ address: hostname, family: isIP(hostname) }]
    : await resolver(hostname, { all: true, verbatim: true });
  if (addresses.length === 0 || addresses.some((a) => !isPublicWebhookAddress(a.address))) {
    throw new Error("Webhook harus mengarah ke alamat IP publik");
  }
  return { url, address: addresses[0]! };
}

/** Redirects are deliberately not followed; no second destination can bypass validation. */
export async function sendWebhook(
  value: string,
  body: string,
  headers: Record<string, string>,
  timeoutMs: number
): Promise<number> {
  // Include DNS resolution in the overall delivery timeout.
  let timer: ReturnType<typeof setTimeout> | undefined;
  let timedOut = false;
  let activeRequest: ReturnType<typeof httpRequest> | undefined;
  try {
    return await Promise.race([
      (async () => {
        const { url, address } = await resolveWebhookTarget(value);
        if (timedOut) throw new Error("Webhook timeout");
        return await new Promise<number>((resolve, reject) => {
          const originalHost = url.hostname.replace(/^\[|\]$/g, "");
          // Connect to a numeric address even on runtimes whose custom DNS
          // lookup handling differs. Preserve the HTTP host and TLS identity.
          const options: import("node:https").RequestOptions = {
            method: "POST",
            hostname: address.address,
            servername: isIP(originalHost) ? undefined : originalHost,
            headers: {
              ...headers,
              Host: url.host,
              "Content-Length": String(Buffer.byteLength(body)),
            },
            agent: false,
            family: address.family,
            lookup: (_hostname, _options, callback) =>
              callback(null, address.address, address.family),
          };
          activeRequest = (url.protocol === "https:" ? httpsRequest : httpRequest)(
            url,
            options,
            (response) => {
              const status = response.statusCode || 0;
              response.destroy();
              resolve(status);
            }
          );
          activeRequest.on("error", reject);
          activeRequest.end(body);
        });
      })(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          timedOut = true;
          activeRequest?.destroy();
          reject(new Error("Webhook timeout"));
        }, timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
