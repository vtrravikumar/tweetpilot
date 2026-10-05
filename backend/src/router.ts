import { errorResponse } from "./http/json";
import { createTweetGenerator } from "./generation/factory";
import { corsPreflightResponse, withCors } from "./http/cors";
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
    return withCors(
      errorResponse(404, "not_found", "Route not found."),
      request,
      env,
    );
  }

  const allowedMethods = pathMatches.map((route) => route.method);
  const preflight = corsPreflightResponse(request, env, allowedMethods);
  if (preflight) return preflight;

  const route = pathMatches.find((r) => r.method === request.method);
  if (!route) {
    const allow = allowedMethods.join(", ");
    return withCors(
      errorResponse(405, "method_not_allowed", "Method not allowed.", {
        allow,
      }),
      request,
      env,
    );
  }

  return withCors(await route.handler(request, env, ctx), request, env);
}
