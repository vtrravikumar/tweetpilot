import { errorResponse, jsonResponse, readBoundedRequestText } from "../http/json";
import { issueVicharWebToken, isVicharWebOrigin } from "../webAuth";
import { readConfig } from "../env";
import { VicharUsage } from "../usage/durableObject";
import type { Route } from "../router";

const MAX_BODY_BYTES = 2_048;
const TURNSTILE_ACTION = "vichar_web_session";

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export const webSessionRoute: Route = {
  method: "POST",
  path: "/v1/web/session",
  handler: async (request, env) => {
    if (!isVicharWebOrigin(request)) {
      return errorResponse(403, "forbidden_origin", "Vichar web access is restricted to vtrrk.in.");
    }

    const rawIp = request.headers.get("CF-Connecting-IP");
    if (!rawIp) return errorResponse(403, "verification_failed", "Website verification could not be completed.");
    const bag = env as unknown as Record<string, unknown>;
    const secret = typeof bag.VICHAR_WEB_SECRET === "string" ? bag.VICHAR_WEB_SECRET.trim() : "";
    const turnstileSecret = typeof bag.TURNSTILE_SECRET_KEY === "string" ? bag.TURNSTILE_SECRET_KEY.trim() : "";
    const namespace = (env as unknown as { VICHAR_USAGE?: DurableObjectNamespace<VicharUsage> }).VICHAR_USAGE;
    if (!secret || !turnstileSecret || !namespace) {
      return errorResponse(503, "web_session_unavailable", "Vichar web access is temporarily unavailable.");
    }

    let rawBody: string | null;
    try {
      rawBody = await readBoundedRequestText(request, MAX_BODY_BYTES);
    } catch {
      return errorResponse(400, "invalid_request", "A valid Turnstile response is required.");
    }
    if (rawBody === null) return errorResponse(413, "request_too_large", "Request body is too large.");
    let token: unknown;
    try {
      token = (JSON.parse(rawBody) as { turnstileToken?: unknown }).turnstileToken;
    } catch {
      return errorResponse(400, "invalid_request", "A valid Turnstile response is required.");
    }
    if (typeof token !== "string" || token.length < 1 || token.length > 2_048) {
      return errorResponse(400, "invalid_request", "A valid Turnstile response is required.");
    }

    const config = readConfig(env);
    const rateLimitRaw = Number.parseInt(String(bag.VICHAR_WEB_SESSION_PER_MINUTE ?? config.webSessionPerMinute), 10);
    const rateLimit = Number.isSafeInteger(rateLimitRaw) && rateLimitRaw > 0 ? rateLimitRaw : config.webSessionPerMinute;
    const globalRateLimitRaw = Number.parseInt(String(bag.VICHAR_WEB_SESSION_GLOBAL_PER_MINUTE ?? config.webSessionGlobalPerMinute), 10);
    const globalRateLimit = Number.isSafeInteger(globalRateLimitRaw) && globalRateLimitRaw > 0 ? globalRateLimitRaw : config.webSessionGlobalPerMinute;
    const namespaceStub = namespace.get(namespace.idFromName("global-vichar-stats"));
    let allowed: boolean;
    try {
      allowed = await namespaceStub.checkWebSessionRate(await sha256(rawIp), Date.now(), rateLimit, globalRateLimit);
    } catch {
      return errorResponse(503, "web_session_unavailable", "Vichar web access is temporarily unavailable.");
    }
    if (!allowed) return errorResponse(429, "rate_limited", "Too many website session requests. Please try again shortly.", { "retry-after": "60" });

    const origin = new URL(request.headers.get("origin")!);
    const siteverify = new URLSearchParams({ secret: turnstileSecret, response: token });
    let verification: { success?: boolean; hostname?: string; action?: string };
    try {
      const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: siteverify.toString(),
        signal: AbortSignal.timeout(4_000),
      });
      if (!response.ok) return errorResponse(503, "verification_unavailable", "Website verification is temporarily unavailable.");
      const result: unknown = await response.json();
      if (!result || typeof result !== "object" || Array.isArray(result)) {
        return errorResponse(503, "verification_unavailable", "Website verification is temporarily unavailable.");
      }
      verification = result as typeof verification;
    } catch {
      return errorResponse(503, "verification_unavailable", "Website verification is temporarily unavailable.");
    }
    if (verification.success !== true || verification.hostname !== origin.hostname || verification.action !== TURNSTILE_ACTION) {
      return errorResponse(403, "verification_failed", "Website verification could not be completed.");
    }

    let tokenUnused: boolean;
    try {
      tokenUnused = await namespaceStub.useTurnstileToken(await sha256(token), Date.now() + 5 * 60_000);
    } catch {
      return errorResponse(503, "web_session_unavailable", "Vichar web access is temporarily unavailable.");
    }
    if (!tokenUnused) return errorResponse(403, "verification_failed", "Website verification could not be completed.");

    const session = await issueVicharWebToken(secret);
    return jsonResponse({ token: session, expiresIn: 600 }, 200, { "cache-control": "no-store" });
  },
};
