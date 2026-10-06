import { checkUsageIdentifier, type UsageDecision } from "./guard";

const CLIENT_IP_HEADER = "CF-Connecting-IP";
const WEB_USAGE_PREFIX = "vichar-web:";

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function deriveWebUsageIdentifier(clientIp: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(clientIp),
  );
  return WEB_USAGE_PREFIX + base64UrlEncode(new Uint8Array(mac));
}

/**
 * Applies the normal Vichar quota to anonymous web users.
 *
 * Cloudflare supplies CF-Connecting-IP at the Worker edge. The raw IP is
 * never used as the Durable Object name; it is HMAC'd with the web secret
 * first, producing a stable pseudonymous usage identifier.
 */
export async function checkWebUsage(
  request: Request,
  env: Env,
  webSecret: string,
): Promise<UsageDecision> {
  const clientIp = request.headers.get(CLIENT_IP_HEADER)?.trim();
  if (!clientIp || !webSecret) {
    return {
      allowed: false,
      remaining: 0,
      dailyLimit: 0,
      reason: "unauthorized",
    };
  }

  const identifier = await deriveWebUsageIdentifier(clientIp, webSecret);
  return checkUsageIdentifier(identifier, env);
}
