import { errorResponse } from "./http/json";
import { handleRequest } from "./router";
import { VicharUsage } from "./usage/durableObject";
import { withCors } from "./http/cors";

export { VicharUsage };

export default {
  async fetch(request, env, ctx): Promise<Response> {
    try {
      return await handleRequest(request, env, ctx);
    } catch (err) {
      const name = err instanceof Error ? err.name : "unknown";
      console.error("request_failed", { name });
      return withCors(errorResponse(500, "internal_error", "Internal server error."), request, env);
    }
  },
} satisfies ExportedHandler<Env>;
