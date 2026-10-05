import { describe, expect, it } from "vitest";
import { GenerationError } from "../src/generation/errors";
import {
  DEFAULT_OPENAI_MODEL,
  OPENAI_RESPONSES_URL,
  OpenAIProvider,
  normalizeTweet,
  outputTokenBudget,
} from "../src/generation/openai";
import { INTERESTS } from "../src/generation/personalization";
import { DEFAULT_MAX_LENGTH, type TweetGenerator } from "../src/generation/types";
import { capture, openaiJson, openaiOk, queueFetch } from "./helpers";

const KEY = "sk-test-not-a-real-key-123456";
const PHOTO_URL = "https://example.test/photography-page";

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
    expect(await generator.generate({ topic: "x" })).toEqual({ tweet: "hello" });
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
    expect(result.tweet.length).toBe(250);
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
    expect(capture(fetchMock).body.instructions.length).toBeLessThan(800);
  });

  it("clips oversized fields so they cannot inflate token cost", async () => {
    const fetchMock = queueFetch(openaiOk("hi"));
    await provider(fetchMock).generate({ topic: "t".repeat(50_000) });
    expect(capture(fetchMock).body.input.length).toBeLessThan(600);
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
    expect(result.tweet).toBe(`Clean version ${PHOTO_URL}`);
    expect(capture(fetchMock, 1).body.input).toContain("link that is not allowed");
  });

  it("does not treat a plain brand mention as a link", async () => {
    const fetchMock = queueFetch(openaiOk("Posting more on VTRRK soon."));
    const result = await provider(fetchMock).generate({ topic: "Cooking" });
    expect(result.tweet).toBe("Posting more on VTRRK soon.");
  });
});

describe("OpenAIProvider - response normalization", () => {
  it("trims whitespace", async () => {
    const fetchMock = queueFetch(openaiOk("  \n A tweet.  \n"));
    expect((await provider(fetchMock).generate({ topic: "x" })).tweet).toBe("A tweet.");
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
    expect((await provider(fetchMock).generate({ topic: "x" })).tweet).toBe("Part one. Part two.");
  });

  it("counts length by code point, so emoji are not over-counted", async () => {
    const fetchMock = queueFetch(openaiOk("😀".repeat(10)));
    const result = await provider(fetchMock).generate({ topic: "x", maxLength: 10 });
    expect(Array.from(result.tweet).length).toBe(10);
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
  it.each([400, 404, 429, 500, 502, 503])("maps HTTP %i to upstream_error without retrying", async (status) => {
    const fetchMock = queueFetch(openaiJson({ error: { message: "details" } }, status));
    const err = await failureOf(provider(fetchMock).generate({ topic: "x" }));
    expect(err.kind).toBe("upstream_error");
    expect(err.upstreamStatus).toBe(status);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

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
    await provider(fetchMock).generate({ topic: "x" });
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
    const fetchMock = queueFetch(openaiOk("a".repeat(140)));
    const result = await provider(fetchMock).generate({ topic: "x", maxLength: 140 });
    expect(result.tweet.length).toBe(140);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries once with feedback when the first draft is too long, then succeeds", async () => {
    const fetchMock = queueFetch(openaiOk("a".repeat(150)), openaiOk("b".repeat(100)));
    const result = await provider(fetchMock).generate({ topic: "x", maxLength: 140 });
    expect(result.tweet).toBe("b".repeat(100));
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
