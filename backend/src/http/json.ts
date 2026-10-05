/**
 * Shared JSON response helpers.
 *
 * All error responses use one stable shape so clients (and the M2.5 tests)
 * can rely on it:
 *
 *   { "error": { "code": "<machine_readable_code>", "message": "<human readable>" } }
 */

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
  };
}

export function jsonResponse(
  body: unknown,
  status = 200,
  headers: HeadersInit = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...headers,
    },
  });
}

export function errorResponse(
  status: number,
  code: string,
  message: string,
  headers: HeadersInit = {},
): Response {
  const body: ApiErrorBody = { error: { code, message } };
  return jsonResponse(body, status, headers);
}
