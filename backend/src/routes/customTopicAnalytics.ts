import { errorResponse, jsonResponse } from "../http/json";
import type { Route } from "../router";
import { hashLicenseKey } from "../usage/licenseKeys";
import { VicharUsage } from "../usage/durableObject";

/**
 * Private, aggregate-only analytics endpoint. The existing owner license secret
 * is reused; no new Cloudflare secret or public analytics surface is introduced.
 */
export const customTopicAnalyticsRoute: Route = {
  method: "GET",
  path: "/v1/admin/topic-analytics",
  handler: async (request, env) => {
    const bag = env as unknown as Record<string, unknown>;
    const ownerKey = typeof bag.VICHAR_OWNER_LICENSE_KEY === "string" ? bag.VICHAR_OWNER_LICENSE_KEY.trim() : "";
    const ownerHash = ownerKey ? await hashLicenseKey(ownerKey) : null;
    if (!ownerHash) {
      return errorResponse(503, "analytics_unavailable", "Private topic analytics are not configured.");
    }

    const authorization = request.headers.get("authorization")?.trim() ?? "";
    const match = /^Bearer\s+(vichar_[A-Za-z0-9_-]{43})$/.exec(authorization);
    const presentedHash = match?.[1] ? await hashLicenseKey(match[1]) : null;
    if (!presentedHash || presentedHash !== ownerHash) {
      return errorResponse(401, "unauthorized", "Owner authorization is required.");
    }

    const namespace = (env as unknown as { VICHAR_USAGE?: DurableObjectNamespace<VicharUsage> }).VICHAR_USAGE;
    if (!namespace) return errorResponse(503, "analytics_unavailable", "Topic analytics are temporarily unavailable.");
    try {
      const globalStats = namespace.get(namespace.idFromName("global-vichar-stats"));
      const analytics = await globalStats.getCustomTopicAnalytics(Date.now());
      return jsonResponse(analytics, 200, { "cache-control": "no-store" });
    } catch {
      return errorResponse(503, "analytics_unavailable", "Topic analytics are temporarily unavailable.");
    }
  },
};
