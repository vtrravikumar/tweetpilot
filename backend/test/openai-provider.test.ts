import { describe, expect, it, vi } from "vitest";
import { GenerationError } from "../src/generation/errors";
import {
  DEFAULT_OPENAI_MODEL,
  OPENAI_RESPONSES_URL,
  OpenAIProvider,
  normalizeTweet,
  outputTokenBudget,
} from "../src/generation/openai";
import { INTERESTS } from "../src/generation/personalization";
import {
  DEFAULT_MAX_LENGTH,
  MIN_VICHAR_MAX_LENGTH,
  VICHAR_ATTRIBUTION,
  type TweetGenerator,
} from "../src/generation/types";
import { capture, openaiJson, openaiOk, queueFetch } from "./helpers";

const KEY = "sk-test-not-a-real-key-123456";
const PHOTO_URL = "https://example.test/photography-page";
const EMPTY_NEWS = `<rss><channel></channel></rss>`;
const newsEmpty = () => new Response(EMPTY_NEWS, { status: 200 });

function provider(
  fetchImpl: ReturnType<typeof queueFetch>,
  extra: Partial<ConstructorParameters<typeof OpenAIProvider>[0]> = {},
) {
  return new OpenAIProvider({ apiKey: KEY, fetchImpl, ...extra });
}

async function failureOf(promise: Promise<unknown>): Promise<GenerationError> {
  try {
    await promise;
  } catch (err) {
    expect(err).toBeInstanceOf(GenerationError);
    return err as GenerationError;
  }
  throw new Error("expected GenerationError, but the call succeeded");
}

describe("OpenAIProvider - interface and configuration", () => {
  it("implements TweetGenerator", async () => {
    const fetchMock = queueFetch(openaiOk("hello"));
    const generator: TweetGenerator = provider(fetchMock);
    expect(typeof generator.generate).toBe("function");
    expect(await generator.generate({ topic: "x" })).toEqual({ tweet: `hello\n${VICHAR_ATTRIBUTION}` });
  });

  it("refuses to be constructed without an API key", () => {
    expect(() => new OpenAIProvider({ apiKey: "" })).toThrow(GenerationError);
  });

  it("calls the Responses API with bearer auth and the default model", async () => {
    const fetchMock = queueFetch(openaiOk("hi"));
    await provider(fetchMock).generate({ topic: "Photography" });

    const call = capture(fetchMock);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(call.url).toBe(OPENAI_RESPONSES_URL);
    expect(call.headers.authorization).toBe(`Bearer ${KEY}`);
    expect(call.body.model).toBe(DEFAULT_OPENAI_MODEL);
    expect(call.body.store).toBe(false);
  });

  it("keeps the API key only in the authorization header, never in the request body", async () => {
    const fetchMock = queueFetch(openaiOk("hi"));
    await provider(fetchMock).generate({
      topic: "Photography",
      location: "Chennai",
      style: "thoughtful",
    });

    const call = capture(fetchMock);
    expect(call.headers.authorization).toBe(`Bearer ${KEY}`);
    expect(JSON.stringify(call.body)).not.toContain(KEY);
    expect(JSON.stringify(call.body)).not.toContain("sk-");
  });

  it("passes a configured model through unchanged", async () => {
    const fetchMock = queueFetch(openaiOk("hi"));
    await provider(fetchMock, { model: "some-other-model" }).generate({ topic: "x" });
    expect(capture(fetchMock).body.model).toBe("some-other-model");
  });

  it("sends reasoning effort none by default, a custom one when set, and omits it on null", async () => {
    const a = queueFetch(openaiOk("hi"));
    await provider(a).generate({ topic: "x" });
    expect(capture(a).body.reasoning).toEqual({ effort: "none" });

    const b = queueFetch(openaiOk("hi"));
    await provider(b, { reasoningEffort: "low" }).generate({ topic: "x" });
    expect(capture(b).body.reasoning).toEqual({ effort: "low" });

    const c = queueFetch(openaiOk("hi"));
    await provider(c, { reasoningEffort: null }).generate({ topic: "x" });
    expect(capture(c).body).not.toHaveProperty("reasoning");
  });
});

describe("OpenAIProvider - prompt", () => {
  it("labels the topic explicitly instead of relying on position", async () => {
    const fetchMock = queueFetch(openaiOk("hi"));
    await provider(fetchMock).generate({ topic: "Photography" });
    expect(capture(fetchMock).body.input).toContain("Topic: Photography");
  });

  it("includes topic, location and style", async () => {
    const fetchMock = queueFetch(openaiOk("hi"));
    await provider(fetchMock).generate({
      topic: "Photography",
      location: "Chennai",
      style: "thoughtful",
    });
    const { input } = capture(fetchMock).body;
    expect(input).toContain("Photography");
    expect(input).toContain("Chennai");
    expect(input).toContain("thoughtful");
  });

  it("omits optional location and style lines when they are not supplied", async () => {
    const fetchMock = queueFetch(openaiOk("hi"));
    await provider(fetchMock).generate({ topic: "Photography" });
    const { input } = capture(fetchMock).body;
    expect(input).not.toContain("Location");
    expect(input).not.toContain("Style:");
  });

  it("passes the supplied maxLength into the generation prompt", async () => {
    for (const maxLength of [140, 280, 500]) {
      const fetchMock = queueFetch(openaiOk("short"));
      await provider(fetchMock).generate({ topic: "x", maxLength });
      expect(capture(fetchMock).body.input).toContain(
        `at most ${maxLength} characters`,
      );
    }
  });

  it("uses the default length only when maxLength is omitted (140 is not a hard cap)", async () => {
    const omitted = queueFetch(openaiOk("short"));
    await provider(omitted).generate({ topic: "x" });
    expect(capture(omitted).body.input).toContain(
      `at most ${DEFAULT_MAX_LENGTH} characters`,
    );

    const long = queueFetch(openaiOk("a".repeat(250)));
    const result = await provider(long).generate({ topic: "x", maxLength: 280 });
    expect(result.tweet.length).toBe(266);
  });

  it("includes the personalization profile in the instructions", async () => {
    const fetchMock = queueFetch(openaiOk("hi"));
    await provider(fetchMock).generate({ topic: "x" });
    const { instructions } = capture(fetchMock).body;
    for (const interest of INTERESTS) expect(instructions).toContain(interest);
    expect(instructions).toMatch(/conversational/i);
    expect(instructions).toMatch(/thoughtful/i);
    expect(instructions).toMatch(/witty/i);
    expect(instructions).toMatch(/corporate/i);
    expect(instructions).toMatch(/cliches/i);
    expect(instructions).toMatch(/at most one hashtag/i);
    expect(instructions).toMatch(/never invent links/i);
  });

  it("keeps the instructions compact", async () => {
    const fetchMock = queueFetch(openaiOk("hi"));
    await provider(fetchMock).generate({ topic: "x" });
    // M2.4 raised this from 800 to make room for per-topic guidance. The
    // tighter, authoritative budget lives in test/personalization.test.ts.
    expect(capture(fetchMock).body.instructions.length).toBeLessThan(1800);
  });

  it("clips oversized fields so they cannot inflate token cost", async () => {
    const fetchMock = queueFetch(openaiOk("hi"));
    await provider(fetchMock).generate({
      topic: "t".repeat(50_000),
      location: "l".repeat(50_000),
      style: "s".repeat(50_000),
    });
    const { input } = capture(fetchMock).body;
    expect(input.length).toBeLessThan(900);
    expect(input).not.toContain("t".repeat(201));
    expect(input).not.toContain("l".repeat(201));
    expect(input).not.toContain("s".repeat(201));
  });
});

describe("OpenAIProvider - usage telemetry", () => {
  it("logs provider token counts without logging prompts or generated text", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const fetchMock = queueFetch(
      openaiJson({
        id: "resp_usage_test",
        model: "configured-model",
        status: "completed",
        usage: {
          input_tokens: 123,
          output_tokens: 45,
          total_tokens: 168,
          input_tokens_details: { cached_tokens: 20 },
          output_tokens_details: { reasoning_tokens: 7 },
        },
        output: [{
          type: "message",
          content: [{ type: "output_text", text: "private generated draft" }],
        }],
      }),
    );

    await provider(fetchMock, { model: "configured-model" }).generate({
      topic: "private user topic",
    });

    expect(log).toHaveBeenCalledWith("openai_usage", {
      model: "configured-model",
      inputTokens: 123,
      outputTokens: 45,
      totalTokens: 168,
      cachedInputTokens: 20,
      reasoningTokens: 7,
    });
    expect(JSON.stringify(log.mock.calls)).not.toContain("private user topic");
    expect(JSON.stringify(log.mock.calls)).not.toContain("private generated draft");
    log.mockRestore();
  });

  it("does not log usage when the provider response omits usage metadata", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const fetchMock = queueFetch(openaiOk("private generated draft"));
    await provider(fetchMock).generate({ topic: "private user topic" });
    expect(log).not.toHaveBeenCalled();
    log.mockRestore();
  });
});

describe("OpenAIProvider - output token budget (cost)", () => {
  it("scales with maxLength and stays small for 140", async () => {
    const fetchMock = queueFetch(openaiOk("hi"));
    await provider(fetchMock).generate({ topic: "x", maxLength: 140 });
    expect(capture(fetchMock).body.max_output_tokens).toBe(78);
  });

  it("never goes below the API minimum or above the ceiling", () => {
    expect(outputTokenBudget(1, 400)).toBe(16);
    expect(outputTokenBudget(280, 400)).toBe(148);
    expect(outputTokenBudget(100_000, 400)).toBe(400);
    expect(outputTokenBudget(100_000, 200)).toBe(200);
  });

  it("caps a huge maxLength at the ceiling instead of asking for a huge response", async () => {
    const fetchMock = queueFetch(openaiOk("hi"));
    await provider(fetchMock).generate({ topic: "x", maxLength: 1_000_000 });
    expect(capture(fetchMock).body.max_output_tokens).toBe(400);
  });
});

describe("OpenAIProvider - VTRRK links", () => {
  const links = { photography: PHOTO_URL };

  it("offers the configured link for a relevant topic", async () => {
    const fetchMock = queueFetch(openaiOk(`Light matters. ${PHOTO_URL}`));
    const result = await provider(fetchMock, { links }).generate({
      topic: "Photography",
      maxLength: 140,
    });
    expect(capture(fetchMock).body.input).toContain(PHOTO_URL);
    expect(result.tweet).toContain(PHOTO_URL);
  });

  it("offers no link for an irrelevant topic", async () => {
    const fetchMock = queueFetch(openaiOk("Cooking is chemistry."));
    await provider(fetchMock, { links }).generate({ topic: "Cooking" });
    const { input } = capture(fetchMock).body;
    expect(input).not.toContain(PHOTO_URL);
    expect(input).toContain("Do not include any links");
  });

  it("offers no link when none is configured (default config is empty)", async () => {
    const fetchMock = queueFetch(openaiOk("Light matters."));
    await provider(fetchMock).generate({ topic: "Photography" });
    const { input } = capture(fetchMock).body;
    expect(input).not.toMatch(/https?:\/\//);
    expect(input).toContain("Do not include any links");
  });

  it("skips the link when maxLength leaves too little room for text", async () => {
    const fetchMock = queueFetch(openaiOk("Light."));
    await provider(fetchMock, { links }).generate({
      topic: "Photography",
      maxLength: 50,
    });
    expect(capture(fetchMock).body.input).not.toContain(PHOTO_URL);
  });

  it("rejects an invented URL (retrying once) rather than returning it", async () => {
    const fetchMock = queueFetch(
      openaiOk("See https://vtrrk.in/made-up-page"),
      openaiOk("See https://vtrrk.in/another-guess"),
    );
    const err = await failureOf(
      provider(fetchMock, { links }).generate({ topic: "Photography" }),
    );
    expect(err.kind).toBe("invalid_output");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("rejects a scheme-less invented vtrrk path", async () => {
    const fetchMock = queueFetch(openaiOk("More at vtrrk.in/photos"), openaiOk("More at vtrrk.in/photos"));
    const err = await failureOf(
      provider(fetchMock, { links }).generate({ topic: "Photography" }),
    );
    expect(err.kind).toBe("invalid_output");
  });

  it("rejects any link when none was offered", async () => {
    const fetchMock = queueFetch(
      openaiOk("Read https://example.com/x"),
      openaiOk("Read https://example.com/x"),
    );
    const err = await failureOf(provider(fetchMock).generate({ topic: "Cooking" }));
    expect(err.kind).toBe("invalid_output");
  });

  it("recovers when the retry drops the invented link", async () => {
    const fetchMock = queueFetch(
      openaiOk("See https://vtrrk.in/made-up"),
      openaiOk(`Clean version ${PHOTO_URL}`),
    );
    const result = await provider(fetchMock, { links }).generate({ topic: "Photography" });
    expect(result.tweet).toBe(`Clean version ${PHOTO_URL}\n${VICHAR_ATTRIBUTION}`);
    expect(capture(fetchMock, 1).body.input).toContain("link that is not allowed");
  });

  it("does not treat a plain brand mention as a link", async () => {
    const fetchMock = queueFetch(openaiOk("Posting more on VTRRK soon."));
    const result = await provider(fetchMock).generate({ topic: "Cooking" });
    expect(result.tweet).toBe(`Posting more on VTRRK soon.\n${VICHAR_ATTRIBUTION}`);
  });
});

describe("OpenAIProvider - explicit news mode and fallback", () => {
  const rss = '<rss><channel><item><title>Global technology development</title><link>https://news.google.com/rss/articles/example</link><pubDate>Fri, 09 Oct 2026 07:00:00 GMT</pubDate><source>World News</source></item></channel></rss>';

  it("passes fresh news into OpenAI and returns source metadata", async () => {
    const fetchMock = queueFetch(new Response(rss, { status: 200 }), openaiOk("A current thought."));
    const result = await provider(fetchMock).generate({ topic: "technology", location: "Tokyo", style: "witty", useNews: true });
    expect(result.mode).toBe("news");
    expect(result.sources?.[0]).toMatchObject({ title: "Global technology development", publisher: "World News", url: "https://news.google.com/rss/articles/example" });
    expect(capture(fetchMock, 1).body.input).toContain("Current news context");
    expect(capture(fetchMock, 1).body.input).toContain("Style: witty");
  });

  it("does not retrieve news just because location is supplied", async () => {
    const fetchMock = queueFetch(openaiOk("A local thought."));
    const result = await provider(fetchMock).generate({ topic: "Chennai", location: "Chennai", style: "observational" });
    expect(result.mode).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("falls back to normal generation when no recent story is found", async () => {
    const fetchMock = queueFetch(newsEmpty(), openaiOk("A normal thought."));
    const result = await provider(fetchMock).generate({ topic: "rare topic", style: "thoughtful", useNews: true });
    expect(result).toMatchObject({ mode: "normal_fallback", fallbackReason: "no_recent_news" });
    expect(capture(fetchMock, 1).body.input).toContain("No qualifying recent news");
  });

  it("distinguishes a news provider outage from no recent news", async () => {
    const fetchMock = queueFetch(new Error("provider offline"), openaiOk("A normal thought."));
    const result = await provider(fetchMock).generate({ topic: "technology", useNews: true });
    expect(result).toMatchObject({ mode: "normal_fallback", fallbackReason: "news_unavailable" });
  });
});
describe("OpenAIProvider - response normalization", () => {
  it("trims whitespace", async () => {
    const fetchMock = queueFetch(openaiOk("  \n A tweet.  \n"));
    expect((await provider(fetchMock).generate({ topic: "x" })).tweet).toBe(`A tweet.\n${VICHAR_ATTRIBUTION}`);
  });

  it("removes one pair of wrapping double quotes", async () => {
    expect(normalizeTweet('"Quoted tweet."')).toBe("Quoted tweet.");
    expect(normalizeTweet("“Curly quoted.”")).toBe("Curly quoted.");
  });

  it("keeps quotes that are part of the content", async () => {
    expect(normalizeTweet('"A" and "B"')).toBe('"A" and "B"');
    expect(normalizeTweet('He said "hi"')).toBe('He said "hi"');
  });

  it("joins multiple output_text parts and ignores non-message items", async () => {
    const fetchMock = queueFetch(
      openaiJson({
        status: "completed",
        output: [
          { type: "reasoning", summary: [] },
          {
            type: "message",
            content: [
              { type: "output_text", text: "Part one. " },
              { type: "output_text", text: "Part two." },
            ],
          },
        ],
      }),
    );
    expect((await provider(fetchMock).generate({ topic: "x" })).tweet).toBe(`Part one. Part two.\n${VICHAR_ATTRIBUTION}`);
  });

  it("counts length by code point, so emoji are not over-counted", async () => {
    const fetchMock = queueFetch(openaiOk("😀".repeat(10)));
    const result = await provider(fetchMock).generate({ topic: "x", maxLength: 27 });
    expect(Array.from(result.tweet).length).toBe(26);
  });
});

describe("OpenAIProvider - malformed or empty responses", () => {
  const cases: Array<[string, () => Response]> = [
    ["a non-JSON body", () => new Response("not json at all", { status: 200 })],
    ["a JSON null", () => openaiJson(null)],
    ["a missing output array", () => openaiJson({ status: "completed" })],
    ["an empty output array", () => openaiJson({ status: "completed", output: [] })],
    ["whitespace-only text", () => openaiOk("   \n  ")],
    ["an empty string", () => openaiOk("")],
    [
      "a reasoning-only output (no message)",
      () => openaiJson({ status: "completed", output: [{ type: "reasoning", summary: [] }] }),
    ],
    [
      "a refusal",
      () =>
        openaiJson({
          status: "completed",
          output: [{ type: "message", content: [{ type: "refusal", refusal: "no" }] }],
        }),
    ],
    [
      "an incomplete response",
      () =>
        openaiJson({
          status: "incomplete",
          incomplete_details: { reason: "max_output_tokens" },
          output: [{ type: "message", content: [{ type: "output_text", text: "cut off mid" }] }],
        }),
    ],
    [
      "a message with non-array content",
      () => openaiJson({ status: "completed", output: [{ type: "message", content: "hello" }] }),
    ],
    [
      "a text part with a non-string text field",
      () =>
        openaiJson({
          status: "completed",
          output: [{ type: "message", content: [{ type: "output_text", text: 123 }] }],
        }),
    ],
    [
      "an unexpected provider shape",
      () => openaiJson({ status: "completed", output: [{ type: "tool_call", content: [] }] }),
    ],
  ];

  it.each(cases)("treats %s as invalid_output without retrying (no extra cost)", async (_name, make) => {
    const fetchMock = queueFetch(make());
    const err = await failureOf(provider(fetchMock).generate({ topic: "x" }));
    expect(err.kind).toBe("invalid_output");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("maps a failed response status to upstream_error", async () => {
    const fetchMock = queueFetch(openaiJson({ status: "failed", error: { message: "boom" } }));
    const err = await failureOf(provider(fetchMock).generate({ topic: "x" }));
    expect(err.kind).toBe("upstream_error");
  });
});

describe("OpenAIProvider - provider API failures", () => {
  it.each([400, 404, 418, 429, 451, 500, 502, 503, 504])(
    "maps HTTP %i to upstream_error without retrying",
    async (status) => {
    const fetchMock = queueFetch(openaiJson({ error: { message: "details" } }, status));
    const err = await failureOf(provider(fetchMock).generate({ topic: "x" }));
    expect(err.kind).toBe("upstream_error");
    expect(err.upstreamStatus).toBe(status);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    },
  );

  it.each([401, 403])("maps HTTP %i (bad credentials) to not_configured", async (status) => {
    const fetchMock = queueFetch(openaiJson({ error: { message: "bad key" } }, status));
    const err = await failureOf(provider(fetchMock).generate({ topic: "x" }));
    expect(err.kind).toBe("not_configured");
  });

  it("maps a network failure to upstream_error", async () => {
    const fetchMock = queueFetch(new TypeError("network down"));
    const err = await failureOf(provider(fetchMock).generate({ topic: "x" }));
    expect(err.kind).toBe("upstream_error");
  });

  it("maps a timeout to upstream_timeout", async () => {
    const timeout = new Error("timed out");
    timeout.name = "TimeoutError";
    const fetchMock = queueFetch(timeout);
    const err = await failureOf(provider(fetchMock).generate({ topic: "x" }));
    expect(err.kind).toBe("upstream_timeout");
  });

  it("passes an abort signal to fetch so requests cannot hang", async () => {
    const fetchMock = queueFetch(openaiOk("hi"));
    await provider(fetchMock, { timeoutMs: 123 }).generate({ topic: "x" });
    expect(fetchMock.mock.calls[0]?.[1]?.signal).toBeInstanceOf(AbortSignal);
  });

  it.each<[string, () => Response | Error]>([
    ["HTTP 401", () => openaiJson({ error: { message: `Incorrect API key provided: ${KEY}` } }, 401)],
    ["HTTP 500", () => openaiJson({ error: { message: `server said ${KEY}` } }, 500)],
    ["HTTP 429", () => openaiJson({ error: { message: `quota for ${KEY}` } }, 429)],
    ["a network error", () => new TypeError(`connect failed for ${KEY}`)],
    ["a failed status", () => openaiJson({ status: "failed", error: { message: KEY } })],
    ["an empty output", () => openaiOk("")],
  ])("never puts the API key or upstream payload in the error for %s", async (_name, make) => {
    const fetchMock = queueFetch(make());
    const err = await failureOf(provider(fetchMock).generate({ topic: "x" }));
    expect(err.message).not.toContain(KEY);
    expect(err.message).not.toContain("sk-");
    expect(err.message).not.toMatch(/Incorrect API key|server said|quota for|connect failed/);
    expect(JSON.stringify(err)).not.toContain(KEY);
  });
});

describe("OpenAIProvider - over-length output", () => {
  it("accepts output of exactly maxLength", async () => {
    const fetchMock = queueFetch(openaiOk("a".repeat(123)));
    const result = await provider(fetchMock).generate({ topic: "x", maxLength: 140 });
    expect(result.tweet.length).toBe(139);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries once with feedback when the first draft is too long, then succeeds", async () => {
    const fetchMock = queueFetch(openaiOk("a".repeat(150)), openaiOk("b".repeat(100)));
    const result = await provider(fetchMock).generate({ topic: "x", maxLength: 140 });
    expect(result.tweet).toBe(`b`.repeat(100) + `\n${VICHAR_ATTRIBUTION}`);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const retryInput = capture(fetchMock, 1).body.input;
    expect(retryInput).toContain("150 characters");
    expect(retryInput).toContain("shorter");
  });

  it("fails safely (no truncation) when the retry is also too long", async () => {
    const fetchMock = queueFetch(openaiOk("a".repeat(150)), openaiOk("b".repeat(160)));
    const err = await failureOf(provider(fetchMock).generate({ topic: "x", maxLength: 140 }));
    expect(err.kind).toBe("invalid_output");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not exceed a configured retry limit greater than the default", async () => {
    const fetchMock = queueFetch(
      openaiOk("a".repeat(150)),
      openaiOk("b".repeat(160)),
      openaiOk("c".repeat(170)),
    );
    const err = await failureOf(
      provider(fetchMock, { maxLengthRetries: 2 }).generate({ topic: "x", maxLength: 140 }),
    );
    expect(err.kind).toBe("invalid_output");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("makes exactly one call when retries are disabled", async () => {
    const fetchMock = queueFetch(openaiOk("a".repeat(150)));
    const err = await failureOf(
      provider(fetchMock, { maxLengthRetries: 0 }).generate({ topic: "x", maxLength: 140 }),
    );
    expect(err.kind).toBe("invalid_output");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("makes exactly one API call on the normal success path", async () => {
    const fetchMock = queueFetch(openaiOk("fine"));
    await provider(fetchMock).generate({ topic: "x" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});


describe("OpenAIProvider - Vichar attribution", () => {
  it("always appends the exact attribution as the final line", async () => {
    const fetchMock = queueFetch(openaiOk("A useful thought."));
    const result = await provider(fetchMock).generate({ topic: "x" });
    expect(result.tweet.endsWith(`\n${VICHAR_ATTRIBUTION}`)).toBe(true);
  });

  it("does not duplicate attribution when the model already includes it", async () => {
    const fetchMock = queueFetch(openaiOk(`A useful thought.\n${VICHAR_ATTRIBUTION}`));
    const result = await provider(fetchMock).generate({ topic: "x" });
    expect(result.tweet).toBe(`A useful thought.\n${VICHAR_ATTRIBUTION}`);
    expect(result.tweet.match(/Vichar by vtrrk/g)?.length).toBe(1);
  });

  it("normalizes punctuation the model adds to the attribution", async () => {
    const fetchMock = queueFetch(openaiOk(`A useful thought.\n${VICHAR_ATTRIBUTION}.`));
    const result = await provider(fetchMock).generate({ topic: "x" });
    expect(result.tweet).toBe(`A useful thought.\n${VICHAR_ATTRIBUTION}`);
    expect(result.tweet.match(/Vichar by vtrrk/g)?.length).toBe(1);
  });

  it("counts attribution within maxLength", async () => {
    const fetchMock = queueFetch(openaiOk("A"));
    const result = await provider(fetchMock).generate({ topic: "x", maxLength: MIN_VICHAR_MAX_LENGTH });
    expect(Array.from(result.tweet).length).toBe(MIN_VICHAR_MAX_LENGTH);
    expect(result.tweet).toBe(`A\n${VICHAR_ATTRIBUTION}`);
  });
});
