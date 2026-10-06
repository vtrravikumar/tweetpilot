import { GenerationError } from "../generation/errors";
import type { TweetGenerator } from "../generation/types";
import { errorResponse, jsonResponse } from "../http/json";
import type { Route } from "../router";
import { allowAllUsageGuard, type UsageGuard } from "../usage/guard";
import { validateGenerateTweetRequest } from "../validation/generateTweet";

/** A fixed generator, or a factory that picks one per request from the env. */
export type GeneratorSource = TweetGenerator | ((env: Env) => TweetGenerator);

export interface GenerateTweetRouteOptions {
  usageGuard?: UsageGuard;
}

/**
 * POST /v1/tweet/generate
 *
 * Every accepted generation is charged against the Vichar installation usage
 * key before OpenAI is called. The usage guard is deliberately server-side so
 * changing extension code cannot reset the counter.
 */
export function createGenerateTweetRoute(
  source: GeneratorSource,
  options: GenerateTweetRouteOptions = {},
): Route {
  const usageGuard = options.usageGuard ?? allowAllUsageGuard;

  return {
    method: "POST",
    path: "/v1/tweet/generate",
    handler: async (request, env) => {
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return errorResponse(
          400,
          "invalid_json",
          "Request body must be valid JSON.",
        );
      }

      const validation = validateGenerateTweetRequest(body);
      if (!validation.ok) {
        return errorResponse(400, "invalid_request", validation.message);
      }

      const decision = await usageGuard.check(request, env);
      if (!decision.allowed) {
        if (decision.reason === "unauthorized") {
          return errorResponse(
            401,
            "missing_usage_key",
            "Vichar usage key is required.",
          );
        }

        return errorResponse(
          429,
          "rate_limited",
          decision.reason === "daily"
            ? "Daily Vichar generation limit reached."
            : "Too many Vichar generation requests. Please try again shortly.",
          decision.retryAfterSeconds === undefined
            ? {}
            : { "retry-after": String(decision.retryAfterSeconds) },
        );
      }

      try {
        const generator = typeof source === "function" ? source(env) : source;
        const { tweet } = await generator.generate(validation.value);
        const headers: Record<string, string> = {};
        if (decision.remaining !== undefined) {
          headers["x-vichar-remaining"] = String(decision.remaining);
        }
        if (decision.dailyLimit !== undefined) {
          headers["x-vichar-daily-limit"] = String(decision.dailyLimit);
        }
        return jsonResponse({ tweet }, 200, headers);
      } catch (err) {
        if (err instanceof GenerationError) return generationErrorResponse(err);
        throw err;
      }
    },
  };
}

/**
 * Maps provider failures to stable API errors. Only the kind and upstream
 * status are logged; provider payloads, credentials and internal messages are
 * never logged or sent to the client.
 */
function generationErrorResponse(err: GenerationError): Response {
  console.error("generation_failed", {
    kind: err.kind,
    upstreamStatus: err.upstreamStatus,
  });

  switch (err.kind) {
    case "not_configured":
      return errorResponse(
        503,
        "generation_unavailable",
        "Tweet generation is currently unavailable.",
      );
    case "upstream_timeout":
      return errorResponse(
        504,
        "upstream_timeout",
        "The generation service timed out. Please try again.",
      );
    case "invalid_output":
      return errorResponse(
        502,
        "invalid_provider_response",
        "The generation service returned an unusable response. Please try again.",
      );
    case "upstream_error":
      return errorResponse(
        502,
        "upstream_error",
        "The generation service failed. Please try again.",
      );
  }
}
