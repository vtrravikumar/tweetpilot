import { errorResponse, jsonResponse } from "../http/json";
import { issueVicharWebToken, isVicharWebOrigin } from "../webAuth";
import type { Route } from "../router";

export const webSessionRoute: Route = {
  method: "POST",
  path: "/v1/web/session",
  handler: async (request, env) => {
    if (!isVicharWebOrigin(request)) {
      return errorResponse(403, "forbidden_origin", "Vichar web access is restricted to vtrrk.in.");
    }

    const secret = (env as unknown as Record<string, unknown>).VICHAR_WEB_SECRET;
    if (typeof secret !== "string" || secret.trim() === "") {
      return errorResponse(503, "web_session_unavailable", "Vichar web access is not configured.");
    }

    const token = await issueVicharWebToken(secret.trim());
    return jsonResponse({ token, expiresIn: 600 }, 200, { "cache-control": "no-store" });
  },
};
