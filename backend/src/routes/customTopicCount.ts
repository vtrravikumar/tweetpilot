import { jsonResponse, errorResponse } from "../http/json";
import type { Route } from "../router";
import { VicharUsage } from "../usage/durableObject";

/**
 * Public, count-only endpoint for the Vichar custom-topic counter.
 * Never returns topic names, language breakdowns, or event records.
 */
export const customTopicCountRoute: Route = {
  method: "GET",
  path: "/v1/stats/custom-topics",
  handler: async (_request, env) => {
    const namespace = (env as unknown as { VICHAR_USAGE?: DurableObjectNamespace<VicharUsage> }).VICHAR_USAGE;
    if (!namespace) return errorResponse(503, "custom_topic_count_unavailable", "Custom-topic count is temporarily unavailable.");
    try {
      const globalStats = namespace.get(namespace.idFromName("global-vichar-stats"));
      const analytics = await globalStats.getCustomTopicAnalytics(Date.now());
      return jsonResponse(
        { totalEvents: analytics.totalEvents, periodDays: 90 },
        200,
        { "cache-control": "public, max-age=30, s-maxage=60, stale-while-revalidate=300" },
      );
    } catch {
      return errorResponse(503, "custom_topic_count_unavailable", "Custom-topic count is temporarily unavailable.");
    }
  },
};
