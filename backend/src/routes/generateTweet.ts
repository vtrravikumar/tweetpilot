import { GenerationError } from "../generation/errors";
import type { TweetGenerator } from "../generation/types";
import { errorResponse, jsonResponse } from "../http/json";
import type { Route } from "../router";
import { allowAllUsageGuard, type UsageGuard } from "../usage/guard";
import { checkWebUsage } from "../usage/webGuard";
import { validateGenerateTweetRequest } from "../validation/generateTweet";
import { isValidVicharWebToken } from "../webAuth";

export type GeneratorSource = TweetGenerator | ((env: Env) => TweetGenerator);

const MAX_REQUEST_BODY_BYTES = 8 * 1024;

export interface GenerateTweetRouteOptions {
  usageGuard?: UsageGuard;
}

export function createGenerateTweetRoute(
  source: GeneratorSource,
  options: GenerateTweetRouteOptions = {},
): Route {
  const usageGuard = options.usageGuard ?? allowAllUsageGuard;

  return {
    method: "POST",
    path: "/v1/tweet/generate",
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
        const { tweet } = await generator.generate(validation.value);
        const headers: Record<string, string> = {};
        if (decision.remaining !== undefined) headers["x-vichar-remaining"] = String(decision.remaining);
        if (decision.dailyLimit !== undefined) headers["x-vichar-daily-limit"] = String(decision.dailyLimit);
        if (webAccess) headers["x-vichar-access"] = "web";
        return jsonResponse({ tweet }, 200, headers);
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
