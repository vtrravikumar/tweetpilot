import { errorResponse } from "./http/json";
import { handleRequest } from "./router";
import { VicharUsage } from "./usage/durableObject";

export { VicharUsage };

export default {
  async fetch(request, env, ctx): Promise<Response> {
    try {
      return await handleRequest(request, env, ctx);
    } catch (err) {
      console.error("Unhandled error", err);
      return errorResponse(500, "internal_error", "Internal server error.");
    }
  },
} satisfies ExportedHandler<Env>;
