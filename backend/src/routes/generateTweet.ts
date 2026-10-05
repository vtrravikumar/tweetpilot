import type { TweetGenerator } from "../generation/types";
import { errorResponse, jsonResponse } from "../http/json";
import type { Route } from "../router";
import { validateGenerateTweetRequest } from "../validation/generateTweet";

/**
 * POST /v1/tweet/generate
 *
 * The generator is injected so M2.3 can swap the placeholder for the OpenAI
 * provider without touching this handler or the HTTP contract.
 */
export function createGenerateTweetRoute(generator: TweetGenerator): Route {
  return {
    method: "POST",
    path: "/v1/tweet/generate",
    handler: async (request) => {
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

      const { tweet } = await generator.generate(validation.value);
      return jsonResponse({ tweet });
    },
  };
}
