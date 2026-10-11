import { errorResponse } from "./http/json";
import { createTweetGenerator } from "./generation/factory";
import { corsPreflightResponse, withCors } from "./http/cors";
import { createUsageGuard } from "./usage/guard";
import { createGenerateTweetRoute } from "./routes/generateTweet";
import { healthRoute } from "./routes/health";
import { webSessionRoute } from "./routes/webSession";
import { freeLicenseRoute } from "./routes/freeLicense";
import { activateLicenseRoute } from "./routes/activateLicense";
import { createPaymentLinkRoute, razorpayWebhookRoute, verifyPaymentRoute } from "./routes/payment";

export type Handler = (request: Request, env: Env, ctx: ExecutionContext) => Response | Promise<Response>;
export interface Route { method: string; path: string; handler: Handler }

export const routes: readonly Route[] = [
  healthRoute,
  webSessionRoute,
  freeLicenseRoute,
  activateLicenseRoute,
  createPaymentLinkRoute,
  verifyPaymentRoute,
  razorpayWebhookRoute,
  createGenerateTweetRoute((env) => createTweetGenerator(env), { usageGuard: createUsageGuard() }),
  createGenerateTweetRoute((env) => createTweetGenerator(env), { usageGuard: createUsageGuard(), path: "/v2/tweet/generate", includeStyle: true }),
];

export async function handleRequest(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const { pathname } = new URL(request.url);
  const routePath = pathname.startsWith("/vichar/")
    ? pathname.slice("/vichar".length)
    : pathname === "/vichar" ? "/" : pathname;
  const pathMatches = routes.filter((route) => route.path === routePath);
  if (pathMatches.length === 0) return withCors(errorResponse(404, "not_found", "Route not found."), request, env);
  const allowedMethods = pathMatches.map((route) => route.method);
  const preflight = corsPreflightResponse(request, env, allowedMethods);
  if (preflight) return preflight;
  const route = pathMatches.find((r) => r.method === request.method);
  if (!route) {
    return withCors(errorResponse(405, "method_not_allowed", "Method not allowed.", { allow: allowedMethods.join(", ") }), request, env);
  }
  return withCors(await route.handler(request, env, ctx), request, env);
}
