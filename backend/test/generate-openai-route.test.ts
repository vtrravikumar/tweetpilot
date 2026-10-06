import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import gitignore from "../.gitignore?raw";
import { createTweetGenerator } from "../src/generation/factory";
import { OpenAIProvider } from "../src/generation/openai";
import { PlaceholderTweetGenerator } from "../src/generation/placeholder";
import { GenerationError } from "../src/generation/errors";
import type { TweetGenerator } from "../src/generation/types";
import { handleRequest } from "../src/router";
import { createGenerateTweetRoute } from "../src/routes/generateTweet";
import type { UsageGuard } from "../src/usage/guard";
import { capture, openaiJson, openaiOk, queueFetch } from "./helpers";

const KEY = "sk-test-not-a-real-key-987654";
const ctx = {} as ExecutionContext;

function env(values: Record<string, string> = {}): Env {
  return {
    VICHAR_TEST_MODE: "1",
    ...values,
  } as unknown as Env;
}

function request(body: unknown = { topic: "Photography" }, method = "POST"): Request {
  return new Request("https://example.com/v1/tweet/generate", {
    method,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer test-route-usage-key-${crypto.randomUUID()}`,
    },
    body: method === "POST" ? JSON.stringify(body) : null,
  });
}

/** Installs a fetch mock as the global; tests never reach the network. */
function stubFetch(...responses: Array<Response | Error>) {
  const mock = queueFetch(...responses);
  vi.stubGlobal("fetch", mock);
  return mock;
}

async function expectApiError(response: Response, status: number, code: string) {
  expect(response.status).toBe(status);
  expect(response.headers.get("content-type")).toContain("application/json");
  const json = (await response.json()) as { error: { code: string; message: string } };
  expect(Object.keys(json)).toEqual(["error"]);
  expect(json.error.code).toBe(code);
  expect(typeof json.error.message).toBe("string");
  return json;
}

let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("createTweetGenerator (factory)", () => {
  it("returns an OpenAIProvider when a key is configured", () => {
    expect(createTweetGenerator(env({ OPENAI_API_KEY: KEY }))).toBeInstanceOf(OpenAIProvider);
  });

  it("selects the OpenAI provider when explicitly requested", () => {
    expect(
      createTweetGenerator(env({ TWEETPILOT_GENERATOR: "openai", OPENAI_API_KEY: KEY })),
    ).toBeInstanceOf(OpenAIProvider);
  });

  it("throws not_configured when the key is missing - it never falls back to the placeholder", () => {
    expect(() => createTweetGenerator(env())).toThrow(GenerationError);
    expect(() => createTweetGenerator(env({ OPENAI_API_KEY: "   " }))).toThrow(GenerationError);
    expect(() => createTweetGenerator(env({ TWEETPILOT_GENERATOR: "openai" }))).toThrow(
      GenerationError,
    );
    expect(() => createTweetGenerator(env({ TWEETPILOT_GENERATOR: "definitely-unsupported" }))).toThrow(
      GenerationError,
    );
  });

  it("uses the placeholder only when explicitly requested", () => {
    expect(createTweetGenerator(env({ TWEETPILOT_GENERATOR: "placeholder" }))).toBeInstanceOf(
      PlaceholderTweetGenerator,
    );
  });

  it("reads model, reasoning effort and VTRRK links from the environment", async () => {
    const fetchMock = queueFetch(openaiOk("hi"));
    const generator = createTweetGenerator(
      env({
        OPENAI_API_KEY: KEY,
        OPENAI_MODEL: "configured-model",
        OPENAI_REASONING_EFFORT: "low",
        VTRRK_LINKS: JSON.stringify({ photography: "https://example.test/p" }),
      }),
      fetchMock,
    );
    await generator.generate({ topic: "Photography", maxLength: 140 });
    const call = capture(fetchMock);
    expect(call.body.model).toBe("configured-model");
    expect(call.body.reasoning).toEqual({ effort: "low" });
    expect(call.body.input).toContain("https://example.test/p");
  });

  it("does not pass through non-HTTPS configured VTRRK links", async () => {
    const fetchMock = queueFetch(openaiOk("hi"));
    await createTweetGenerator(
      env({
        OPENAI_API_KEY: KEY,
        VTRRK_LINKS: JSON.stringify({ photography: "http://example.test/p" }),
      }),
      fetchMock,
    ).generate({ topic: "Photography", maxLength: 140 });

    const { input } = capture(fetchMock).body;
    expect(input).not.toContain("http://example.test/p");
    expect(input).toContain("Do not include any links");
  });

  it('OPENAI_REASONING_EFFORT="omit" drops the reasoning field', async () => {
    const fetchMock = queueFetch(openaiOk("hi"));
    await createTweetGenerator(
      env({ OPENAI_API_KEY: KEY, OPENAI_REASONING_EFFORT: "omit" }),
      fetchMock,
    ).generate({ topic: "x" });
    expect(capture(fetchMock).body).not.toHaveProperty("reasoning");
  });
});

describe("POST /v1/tweet/generate with the OpenAI provider (mocked fetch)", () => {
  it("returns 200 { tweet } and keeps the HTTP contract unchanged", async () => {
    const fetchMock = stubFetch(openaiOk("Golden hour never gets old."));
    const response = await handleRequest(
      request({ topic: "Photography", location: "Chennai", style: "thoughtful", maxLength: 140 }),
      env({ OPENAI_API_KEY: KEY }),
      ctx,
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ tweet: "Golden hour never gets old." });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(capture(fetchMock).body.input).toContain("at most 140 characters");
  });

  it("does not call OpenAI at all for an invalid request", async () => {
    const fetchMock = stubFetch(openaiOk("unused"));
    const response = await handleRequest(request({ topic: "" }), env({ OPENAI_API_KEY: KEY }), ctx);
    await expectApiError(response, 400, "invalid_request");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns a stable 503 when the API key is not configured, without calling OpenAI", async () => {
    const fetchMock = stubFetch(openaiOk("unused"));
    const json = await expectApiError(await handleRequest(request(), env(), ctx), 503, "generation_unavailable");
    expect(json.error.message).not.toMatch(/OPENAI|key/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns 502 upstream_error for a provider failure without leaking details", async () => {
    stubFetch(openaiJson({ error: { message: `internal detail with ${KEY}`, type: "server_error" } }, 500));
    const response = await handleRequest(request(), env({ OPENAI_API_KEY: KEY }), ctx);
    const text = await response.clone().text();
    await expectApiError(response, 502, "upstream_error");
    expect(text).not.toContain(KEY);
    expect(text).not.toContain("internal detail");
    expect(text).not.toContain("server_error");
  });

  it("returns 503 (not a client error) when OpenAI rejects the credentials, without leaking them", async () => {
    stubFetch(openaiJson({ error: { message: `Incorrect API key: ${KEY}` } }, 401));
    const response = await handleRequest(request(), env({ OPENAI_API_KEY: KEY }), ctx);
    const text = await response.clone().text();
    await expectApiError(response, 503, "generation_unavailable");
    expect(text).not.toContain(KEY);
    expect(text).not.toContain("Incorrect API key");
  });

  it("also maps HTTP 403 credential failures to generation_unavailable", async () => {
    stubFetch(openaiJson({ error: { message: `Forbidden for ${KEY}` } }, 403));
    const response = await handleRequest(request(), env({ OPENAI_API_KEY: KEY }), ctx);
    const text = await response.clone().text();
    await expectApiError(response, 503, "generation_unavailable");
    expect(text).not.toContain(KEY);
    expect(text).not.toContain("Forbidden");
  });

  it("returns 504 upstream_timeout on a timeout", async () => {
    const timeout = new Error("slow");
    timeout.name = "TimeoutError";
    stubFetch(timeout);
    await expectApiError(
      await handleRequest(request(), env({ OPENAI_API_KEY: KEY }), ctx),
      504,
      "upstream_timeout",
    );
  });

  it("returns 502 invalid_provider_response for empty or malformed model output", async () => {
    stubFetch(openaiOk("   "));
    await expectApiError(
      await handleRequest(request(), env({ OPENAI_API_KEY: KEY }), ctx),
      502,
      "invalid_provider_response",
    );

    stubFetch(new Response("<html>gateway</html>", { status: 200 }));
    await expectApiError(
      await handleRequest(request(), env({ OPENAI_API_KEY: KEY }), ctx),
      502,
      "invalid_provider_response",
    );
  });

  it("returns 502 invalid_provider_response when output stays over maxLength, never a truncated tweet", async () => {
    const fetchMock = stubFetch(openaiOk("a".repeat(200)), openaiOk("b".repeat(200)));
    const response = await handleRequest(request({ topic: "x", maxLength: 140 }), env({ OPENAI_API_KEY: KEY }), ctx);
    await expectApiError(response, 502, "invalid_provider_response");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("never puts the API key in any response body or log call", async () => {
    stubFetch(openaiOk("   "));
    const response = await handleRequest(request(), env({ OPENAI_API_KEY: KEY }), ctx);
    expect(await response.text()).not.toContain(KEY);
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain(KEY);
  });

  it("logs only the failure kind and upstream status", async () => {
    stubFetch(openaiJson({ error: { message: "secret detail" } }, 429));
    await handleRequest(request(), env({ OPENAI_API_KEY: KEY }), ctx);
    expect(errorSpy.mock.calls).toEqual([["generation_failed", { kind: "upstream_error", upstreamStatus: 429 }]]);
  });

  it("keeps wrong-method handling unchanged", async () => {
    const response = await handleRequest(request(undefined, "GET"), env({ OPENAI_API_KEY: KEY }), ctx);
    await expectApiError(response, 405, "method_not_allowed");
  });
});

describe("real network is blocked in tests", () => {
  it("fails loudly if a test forgets to mock fetch", async () => {
    await expect(fetch("https://api.openai.com/v1/responses")).rejects.toThrow(/blocked/i);
  });
});

describe("secret file hygiene", () => {
  it("keeps local Worker secret files ignored", () => {
    expect(gitignore).toMatch(/^\.dev\.vars$/m);
    expect(gitignore).toMatch(/^\.dev\.vars\.\*$/m);
    expect(gitignore).toMatch(/^\.env$/m);
    expect(gitignore).toMatch(/^\.env\.\*$/m);
  });
});

describe("usage guard hook", () => {
  const stub: TweetGenerator = { generate: async () => ({ tweet: "ok" }) };
  const call = (route: ReturnType<typeof createGenerateTweetRoute>) =>
    route.handler(request(), env(), ctx);

  it("allows requests by default", async () => {
    expect((await call(createGenerateTweetRoute(stub))).status).toBe(200);
  });

  it("returns 429 rate_limited with Retry-After and skips generation when the guard denies", async () => {
    const generate = vi.fn(stub.generate);
    const guard: UsageGuard = { check: async () => ({ allowed: false, retryAfterSeconds: 30 }) };
    const response = await call(createGenerateTweetRoute({ generate }, { usageGuard: guard }));
    await expectApiError(response, 429, "rate_limited");
    expect(response.headers.get("retry-after")).toBe("30");
    expect(generate).not.toHaveBeenCalled();
  });

  it("omits Retry-After when the guard gives none", async () => {
    const guard: UsageGuard = { check: async () => ({ allowed: false }) };
    const response = await call(createGenerateTweetRoute(stub, { usageGuard: guard }));
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBeNull();
  });

  it("does not consume the guard for invalid requests", async () => {
    const check = vi.fn(async () => ({ allowed: true as const }));
    const route = createGenerateTweetRoute(stub, { usageGuard: { check } });
    const response = await route.handler(request({ topic: "" }), env(), ctx);
    expect(response.status).toBe(400);
    expect(check).not.toHaveBeenCalled();
  });
});

describe("route error handling", () => {
  it("rethrows non-GenerationError failures to the global 500 handler", async () => {
    const boom: TweetGenerator = { generate: async () => { throw new Error("unexpected"); } };
    const route = createGenerateTweetRoute(boom);
    await expect(route.handler(request(), env(), ctx)).rejects.toThrow("unexpected");
  });
});
