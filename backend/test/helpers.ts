import { vi } from "vitest";

/** Shape of a successful Responses API payload carrying `text`. */
export function openaiOk(text: string): Response {
  return new Response(
    JSON.stringify({
      id: "resp_test",
      status: "completed",
      output: [
        {
          type: "message",
          role: "assistant",
          content: [{ type: "output_text", text }],
        },
      ],
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

export function openaiJson(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/** A fetch mock that returns the queued responses in order. */
export function queueFetch(...responses: Array<Response | Error>) {
  const queue = [...responses];
  return vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => {
    const next = queue.shift();
    if (!next) throw new Error("fetch mock: no more queued responses");
    if (next instanceof Error) throw next;
    return next;
  });
}

export interface CapturedCall {
  url: string;
  headers: Record<string, string>;
  body: {
    model: string;
    instructions: string;
    input: string;
    max_output_tokens: number;
    store: boolean;
    reasoning?: { effort: string };
  };
}

export function capture(
  mock: ReturnType<typeof queueFetch>,
  index = 0,
): CapturedCall {
  const call = mock.mock.calls[index];
  if (!call) throw new Error(`no fetch call at index ${index}`);
  const [url, init] = call;
  return {
    url: String(url),
    headers: init?.headers as Record<string, string>,
    body: JSON.parse(String(init?.body)),
  };
}
