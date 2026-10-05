import { errorResponse } from "./http/json";
import { createTweetGenerator } from "./generation/factory";
import { createGenerateTweetRoute } from "./routes/generateTweet";
import { healthRoute } from "./routes/health";

export type Handler = (
  request: Request,
  env: Env,
  ctx: ExecutionContext,
) => Response | Promise<Response>;

export interface Route {
  method: string;
  path: string;
  handler: Handler;
}

/**
 * Route table. Add new endpoints here.
 */
export const routes: readonly Route[] = [
  healthRoute,
  createGenerateTweetRoute((env) => createTweetGenerator(env)),
];

export async function handleRequest(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
): Promise<Response> {
  const { pathname } = new URL(request.url);

  const pathMatches = routes.filter((route) => route.path === pathname);
  if (pathMatches.length === 0) {
    return errorResponse(404, "not_found", "Route not found.");
  }

  const route = pathMatches.find((r) => r.method === request.method);
  if (!route) {
    const allow = pathMatches.map((r) => r.method).join(", ");
    return errorResponse(405, "method_not_allowed", "Method not allowed.", {
      allow,
    });
  }

  return route.handler(request, env, ctx);
}
