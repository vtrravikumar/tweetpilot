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

/** Read at most `maxBytes`; cancel the stream as soon as it exceeds the limit. */
export async function readBoundedRequestText(request: Request, maxBytes: number): Promise<string | null> {
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
}
