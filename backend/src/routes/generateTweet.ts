import { GenerationError } from "../generation/errors";
import type { TweetGenerator } from "../generation/types";
import { errorResponse, jsonResponse } from "../http/json";
import type { Route } from "../router";
import { allowAllUsageGuard, type UsageGuard } from "../usage/guard";
import { checkWebUsage } from "../usage/webGuard";
import { validateGenerateTweetRequest } from "../validation/generateTweet";
import { isValidVicharWebToken } from "../webAuth";
import { hashLicenseKey } from "../usage/licenseKeys";
import { VicharUsage } from "../usage/durableObject";

export type GeneratorSource = TweetGenerator | ((env: Env) => TweetGenerator);

const MAX_REQUEST_BODY_BYTES = 8 * 1024;

export interface GenerateTweetRouteOptions {
  usageGuard?: UsageGuard;
  /** Public API path. Defaults to the stable V1 extension contract. */
  path?: string;
  /** Include the selected style in the response for V2 web clients. */
  includeStyle?: boolean;
}

export function createGenerateTweetRoute(
  source: GeneratorSource,
  options: GenerateTweetRouteOptions = {},
): Route {
  const usageGuard = options.usageGuard ?? allowAllUsageGuard;

  return {
    method: "POST",
    path: options.path ?? "/v1/tweet/generate",
    handler: async (request, env) => {
      const contentLength = request.headers.get("content-length");
      if (contentLength !== null) {
        const declaredLength = Number.parseInt(contentLength, 10);
        if (Number.isSafeInteger(declaredLength) && declaredLength > MAX_REQUEST_BODY_BYTES) {
          return errorResponse(413, "request_too_large", "Request body is too large.");
        }
      }

      let body: unknown;
      try {
        const rawBody = await request.text();
        if (new TextEncoder().encode(rawBody).byteLength > MAX_REQUEST_BODY_BYTES) {
          return errorResponse(413, "request_too_large", "Request body is too large.");
        }
        body = JSON.parse(rawBody);
      } catch {
        return errorResponse(400, "invalid_json", "Request body must be valid JSON.");
      }

      const validation = validateGenerateTweetRequest(body);
      if (!validation.ok) {
        return errorResponse(400, "invalid_request", validation.message);
      }

      const bag = env as unknown as Record<string, unknown>;
      const webSecret = typeof bag.VICHAR_WEB_SECRET === "string" ? bag.VICHAR_WEB_SECRET.trim() : "";
      const webAccess = await isValidVicharWebToken(request, webSecret);

      // A license key is distinct from the legacy per-installation usage identifier.
      const authorization = request.headers.get("authorization")?.trim() ?? "";
      const licenseMatch = !webAccess ? /^Bearer\s+(vichar_[A-Za-z0-9_-]{43})$/.exec(authorization) : null;
      if (licenseMatch) {
        const licenseKey = licenseMatch[1];
        if (!licenseKey) return errorResponse(401, "invalid_license_key", "This Vichar license key is invalid.");
        const keyHash = await hashLicenseKey(licenseKey);
        const namespace = (env as unknown as { VICHAR_USAGE?: DurableObjectNamespace<VicharUsage> }).VICHAR_USAGE;
        if (!keyHash) return errorResponse(401, "invalid_license_key", "This Vichar license key is invalid.");
        if (!namespace) return errorResponse(503, "license_service_unavailable", "License service is temporarily unavailable.");
        const licenseStub = namespace.get(namespace.idFromName("license:" + keyHash));
        const license = await licenseStub.getLicense();
        if (!license) return errorResponse(401, "invalid_license_key", "This Vichar license key is invalid.");
        const burstRaw = Number.parseInt(String(bag.VICHAR_BURST_PER_MINUTE ?? "3"), 10);
        const burstLimit = Number.isSafeInteger(burstRaw) && burstRaw > 0 ? burstRaw : 3;
        const burstStub = namespace.get(namespace.idFromName("license-burst:" + keyHash));
        const burst = await burstStub.checkBurst(Date.now(), burstLimit);
        if (!burst.allowed) return errorResponse(429, "rate_limited", "Too many Vichar generation requests. Please try again shortly.", { "retry-after": String(burst.retryAfterSeconds ?? 60) });
        const reservation = await licenseStub.consumeCredit();
        if (!reservation.consumed) return errorResponse(402, "credits_exhausted", "Your Vichar generation balance is empty. Add credits to continue.", { "x-vichar-remaining": String(reservation.balance ?? 0) });
        try {
          const generator = typeof source === "function" ? source(env) : source;
          const result = await generator.generate({ ...validation.value, includeAttribution: license.attributionRequired });
          const headers = { "x-vichar-remaining": String(reservation.balance ?? 0) };
          const newsMetadata = validation.value.useNews
            ? { mode: result.mode ?? "normal_fallback", ...(result.mode === "normal_fallback" ? { fallbackReason: result.fallbackReason ?? "news_unavailable" } : {}), ...(result.mode === "news" && result.sources ? { sources: result.sources } : {}) }
            : {};
          const payload = options.includeStyle ? { tweet: result.tweet, style: validation.value.style ?? null, ...newsMetadata } : { tweet: result.tweet, ...newsMetadata };
          return jsonResponse(payload, 200, headers);
        } catch (err) {
          await licenseStub.addCredits(1);
          if (err instanceof GenerationError) return generationErrorResponse(err);
          throw err;
        }
      }
      const decision = webAccess
        ? await checkWebUsage(request, env, webSecret)
        : await usageGuard.check(request, env);

      if (!decision.allowed) {
        if (decision.reason === "unauthorized") {
          if (webAccess) {
            return errorResponse(
              503,
              "web_usage_unavailable",
              "Vichar web usage protection is currently unavailable.",
            );
          }
          return errorResponse(401, "missing_usage_key", "Vichar usage key is required.");
        }

        return errorResponse(
          429,
          "rate_limited",
          decision.reason === "daily"
            ? "Daily Vichar generation limit reached."
            : "Too many Vichar generation requests. Please try again shortly.",
          decision.retryAfterSeconds === undefined ? {} : { "retry-after": String(decision.retryAfterSeconds) },
        );
      }

      try {
        const generator = typeof source === "function" ? source(env) : source;
        const result = await generator.generate(validation.value);
        const headers: Record<string, string> = {};
        if (decision.remaining !== undefined) headers["x-vichar-remaining"] = String(decision.remaining);
        if (decision.dailyLimit !== undefined) headers["x-vichar-daily-limit"] = String(decision.dailyLimit);
        if (webAccess) headers["x-vichar-access"] = "web";
        const newsMetadata = validation.value.useNews
          ? {
              mode: result.mode ?? "normal_fallback",
              ...(result.mode === "normal_fallback"
                ? { fallbackReason: result.fallbackReason ?? "news_unavailable" }
                : {}),
              ...(result.mode === "news" && result.sources ? { sources: result.sources } : {}),
            }
          : {};
        const payload = options.includeStyle
          ? { tweet: result.tweet, style: validation.value.style ?? null, ...newsMetadata }
          : { tweet: result.tweet, ...newsMetadata };
        return jsonResponse(payload, 200, headers);
      } catch (err) {
        if (err instanceof GenerationError) return generationErrorResponse(err);
        throw err;
      }
    },
  };
}

function generationErrorResponse(err: GenerationError): Response {
  console.error("generation_failed", { kind: err.kind, upstreamStatus: err.upstreamStatus });

  switch (err.kind) {
    case "not_configured":
      return errorResponse(503, "generation_unavailable", "Tweet generation is currently unavailable.");
    case "upstream_timeout":
      return errorResponse(504, "upstream_timeout", "The generation service timed out. Please try again.");
    case "invalid_output":
      return errorResponse(502, "invalid_provider_response", "The generation service returned an unusable response. Please try again.");
    case "upstream_error":
      return errorResponse(502, "upstream_error", "The generation service failed. Please try again.");
  }
}
