import { jsonResponse, errorResponse } from "../http/json";
import type { Route } from "../router";
import { VicharUsage } from "../usage/durableObject";

export const statsRoute: Route = {
  method: "GET",
  path: "/v1/stats",
  handler: async (_request, env) => {
    const namespace = (env as unknown as { VICHAR_USAGE?: DurableObjectNamespace<VicharUsage> }).VICHAR_USAGE;
    if (!namespace) return errorResponse(503, "stats_unavailable", "Vichar statistics are temporarily unavailable.");
    try {
      const globalStats = namespace.get(namespace.idFromName("global-vichar-stats"));
      const generations = await globalStats.getGlobalGenerationCount();
      return jsonResponse({ generations });
    } catch {
      return errorResponse(503, "stats_unavailable", "Vichar statistics are temporarily unavailable.");
    }
  },
};
