import { readConfig } from "../env";

const ALLOWED_REQUEST_HEADERS = ["content-type", "authorization"] as const;
const PREFLIGHT_MAX_AGE_SECONDS = "86400";

export function withCors(
  response: Response,
  request: Request,
  env: Env,
): Response {
  const origin = allowedOrigin(request, env);
  if (!origin) return response;

  const headers = new Headers(response.headers);
  applyCorsHeaders(headers, origin);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export function corsPreflightResponse(
  request: Request,
  env: Env,
  allowedMethods: readonly string[],
): Response | undefined {
  if (request.method !== "OPTIONS") return undefined;
  const requestedMethod = request.headers.get("access-control-request-method");
  if (!requestedMethod) return undefined;

  const origin = allowedOrigin(request, env);
  if (!origin) return new Response(null, { status: 403 });

  const methodAllowed = allowedMethods.includes(requestedMethod.toUpperCase());
  const headersAllowed = requestedHeadersAllowed(request);
  if (!methodAllowed || !headersAllowed) return new Response(null, { status: 403 });

  const headers = new Headers();
  applyCorsHeaders(headers, origin);
  headers.set("access-control-allow-methods", [...allowedMethods, "OPTIONS"].join(", "));
  headers.set("access-control-allow-headers", ALLOWED_REQUEST_HEADERS.join(", "));
  headers.set("access-control-max-age", PREFLIGHT_MAX_AGE_SECONDS);
  return new Response(null, { status: 204, headers });
}

export function parseCorsAllowedOrigins(raw: string | undefined): Set<string> {
  const origins = new Set<string>();
  if (!raw) return origins;

  for (const item of raw.split(",")) {
    const origin = normalizeOrigin(item);
    if (origin) origins.add(origin);
  }
  return origins;
}

function allowedOrigin(request: Request, env: Env): string | undefined {
  const origin = request.headers.get("origin");
  if (!origin) return undefined;
  return parseCorsAllowedOrigins(readConfig(env).corsAllowedOrigins).has(origin)
    ? origin
    : undefined;
}

function requestedHeadersAllowed(request: Request): boolean {
  const requested = request.headers.get("access-control-request-headers");
  if (!requested) return true;

  const allowed = new Set(ALLOWED_REQUEST_HEADERS);
  return requested
    .split(",")
    .map((header) => header.trim().toLowerCase())
    .filter(Boolean)
    .every((header) => allowed.has(header as (typeof ALLOWED_REQUEST_HEADERS)[number]));
}

function applyCorsHeaders(headers: Headers, origin: string): void {
  headers.set("access-control-allow-origin", origin);
  headers.set("vary", appendVary(headers.get("vary"), "Origin"));
}

function appendVary(current: string | null, value: string): string {
  if (!current) return value;
  const values = current.split(",").map((entry) => entry.trim().toLowerCase());
  return values.includes(value.toLowerCase()) ? current : `${current}, ${value}`;
}

function normalizeOrigin(value: string): string | undefined {
  const trimmed = value.trim().replace(/\/+$/, "");
  if (!trimmed || trimmed === "*") return undefined;

  if (trimmed.startsWith("chrome-extension://")) {
    return /^chrome-extension:\/\/[a-z]{32}$/i.test(trimmed) ? trimmed : undefined;
  }

  try {
    const url = new URL(trimmed);
    if (url.pathname !== "/" || url.search || url.hash) return undefined;
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.origin
      : undefined;
  } catch {
    return undefined;
  }
}
