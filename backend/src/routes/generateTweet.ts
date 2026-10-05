import { GenerationError } from "../generation/errors";
import type { TweetGenerator } from "../generation/types";
import { errorResponse, jsonResponse } from "../http/json";
import type { Route } from "../router";
import { allowAllUsageGuard, type UsageGuard } from "../usage/guard";
import { validateGenerateTweetRequest } from "../validation/generateTweet";

/** A fixed generator, or a factory that picks one per request from the env. */
export type GeneratorSource = TweetGenerator | ((env: Env) => TweetGenerator);

export interface GenerateTweetRouteOptions {
  /** Defaults to allow-all; M2.6 plugs a real limiter in here. */
  usageGuard?: UsageGuard;
}

/**
 * POST /v1/tweet/generate
 *
 * The route depends only on the TweetGenerator interface, so providers can be
 * swapped without touching this handler or the HTTP contract.
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

      const decision = await usageGuard.check(request);
      if (!decision.allowed) {
        return errorResponse(
          429,
          "rate_limited",
          "Too many generation requests. Please try again later.",
          decision.retryAfterSeconds === undefined
            ? {}
            : { "retry-after": String(decision.retryAfterSeconds) },
        );
      }

      try {
        const generator = typeof source === "function" ? source(env) : source;
        const { tweet } = await generator.generate(validation.value);
        return jsonResponse({ tweet });
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
