import { describe, expect, it } from "vitest";
import {
  DEFAULT_MAX_LENGTH,
  PLACEHOLDER_PREFIX,
  PlaceholderTweetGenerator,
} from "../src/generation/placeholder";
import { VICHAR_ATTRIBUTION } from "../src/generation/types";
import type { TweetGenerator } from "../src/generation/types";
import { createGenerateTweetRoute } from "../src/routes/generateTweet";
import { validateGenerateTweetRequest } from "../src/validation/generateTweet";

describe("PlaceholderTweetGenerator", () => {
  const generator = new PlaceholderTweetGenerator();

  it("is deterministic and labelled as a placeholder", async () => {
    const input = { topic: "Photography", location: "Chennai" };
    const a = await generator.generate(input);
    const b = await generator.generate(input);
    expect(a).toEqual(b);
    expect(a.tweet.startsWith(PLACEHOLDER_PREFIX)).toBe(true);
  });

  it("applies the default max length when none is given", async () => {
    const { tweet } = await generator.generate({ topic: "x".repeat(1000) });
    expect(Array.from(tweet).length).toBe(DEFAULT_MAX_LENGTH);
    expect(tweet.endsWith(`\n${VICHAR_ATTRIBUTION}`)).toBe(true);
  });

  it("does not split surrogate pairs when truncating", async () => {
    const { tweet } = await generator.generate({
      topic: "😀".repeat(100),
      maxLength: 60,
    });
    expect(Array.from(tweet).length).toBe(60);
    expect(tweet.endsWith(`\n${VICHAR_ATTRIBUTION}`)).toBe(true);
    expect(tweet).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/);
  });
});

describe("validateGenerateTweetRequest", () => {
  it("normalises a valid request", () => {
    expect(
      validateGenerateTweetRequest({
        topic: " Photography ",
        location: " Chennai ",
        style: "thoughtful",
        maxLength: 140,
      }),
    ).toEqual({
      ok: true,
      value: {
        topic: "Photography",
        location: "Chennai",
        style: "thoughtful",
        maxLength: 140,
      },
    });
  });

  it("treats blank optional strings as not supplied", () => {
    expect(
      validateGenerateTweetRequest({ topic: "A", location: "  ", style: "" }),
    ).toEqual({ ok: true, value: { topic: "A" } });
  });
});

describe("generation service boundary", () => {
  it("route depends only on the TweetGenerator interface", async () => {
    const calls: unknown[] = [];
    const stub: TweetGenerator = {
      async generate(input) {
        calls.push(input);
        return { tweet: "from stub" };
      },
    };
    const route = createGenerateTweetRoute(stub);

    const response = await route.handler(
      new Request("https://example.com/v1/tweet/generate", {
        method: "POST",
        body: JSON.stringify({ topic: " Travel ", maxLength: 50 }),
      }),
      {} as Env,
      {} as ExecutionContext,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ tweet: "from stub" });
    expect(calls).toEqual([{ topic: "Travel", maxLength: 50 }]);
  });
});
