import { jsonResponse } from "../http/json";
import type { Route } from "../router";

export const healthRoute: Route = {
  method: "GET",
  path: "/health",
  handler: () => jsonResponse({ status: "ok" }),
};
