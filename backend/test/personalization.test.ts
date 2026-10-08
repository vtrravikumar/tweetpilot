import { describe, expect, it } from "vitest";
import {
  DEFAULT_VTRRK_LINKS,
  selectVtrrkLink,
} from "../src/generation/links";
import {
  DEFAULT_OPENAI_MODEL,
  OpenAIProvider,
} from "../src/generation/openai";
import {
  INTERESTS,
  PERSONALIZATION_INSTRUCTIONS,
  TOPIC_GUIDANCE,
  type Interest,
} from "../src/generation/personalization";
import { selectInterest } from "../src/generation/topics";
import { DEFAULT_MAX_LENGTH } from "../src/generation/types";
import { capture, openaiOk, queueFetch } from "./helpers";

/** Authoritative size budget for the stable prefix sent on every request. */
const MAX_INSTRUCTION_CHARS = 1800;
const KEY = "sk-test-not-a-real-key-m24";
const EMPTY_NEWS = `<rss><channel></channel></rss>`;
const newsEmpty = () => new Response(EMPTY_NEWS, { status: 200 });

function provider(
  fetchImpl: ReturnType<typeof queueFetch>,
  extra: Partial<ConstructorParameters<typeof OpenAIProvider>[0]> = {},
) {
  return new OpenAIProvider({ apiKey: KEY, fetchImpl, ...extra });
}

const lines = PERSONALIZATION_INSTRUCTIONS.split("\n");
const guideLine = (interest: Interest) =>
  lines.find((line) => line.startsWith(`- ${interest}:`));

describe("personalization instructions - interests and topic guidance", () => {
  it("contains all five interests", () => {
    expect(INTERESTS).toHaveLength(5);
    for (const interest of INTERESTS) {
      expect(PERSONALIZATION_INSTRUCTIONS).toContain(interest);
    }
  });

  it("has a guidance line for every interest, and only for the interests", () => {
    for (const interest of INTERESTS) {
      expect(guideLine(interest), interest).toBeDefined();
      expect(TOPIC_GUIDANCE[interest].length).toBeGreaterThan(30);
    }
    expect(Object.keys(TOPIC_GUIDANCE).sort()).toEqual([...INTERESTS].sort());
    expect(lines.filter((l) => l.startsWith("- "))).toHaveLength(INTERESTS.length);
  });

  it("gives each topic a distinct character (no shared or copied guidance)", () => {
    const texts = INTERESTS.map((i) => TOPIC_GUIDANCE[i]);
    expect(new Set(texts).size).toBe(INTERESTS.length);
  });

  it("technology & AI: observation/trade-off focus, and avoids hype and press-release tone", () => {
    const g = TOPIC_GUIDANCE["technology & AI"];
    expect(g).toMatch(/observations/i);
    expect(g).toMatch(/trade-offs/i);
    expect(g).toMatch(/human/i);
    expect(g).toMatch(/AI is changing everything/);
    expect(g).toMatch(/press-release/i);
  });

  it("photography: seeing, light and composition, and avoids generic tips and 'capture the moment'", () => {
    const g = TOPIC_GUIDANCE.photography;
    expect(g).toMatch(/seeing/i);
    expect(g).toMatch(/light/i);
    expect(g).toMatch(/composition/i);
    expect(g).toMatch(/perspective/i);
    expect(g).toMatch(/generic tips/i);
    expect(g).toMatch(/capture the moment/i);
  });

  it("Royal Enfield & riding: roads, machines, patience, dry wit; no slogans; 'thump' restrained", () => {
    const g = TOPIC_GUIDANCE["Royal Enfield & riding"];
    expect(g).toMatch(/roads/i);
    expect(g).toMatch(/machines/i);
    expect(g).toMatch(/patience/i);
    expect(g).toMatch(/wit/i);
    expect(g).toMatch(/slogans/i);
    expect(g).toMatch(/go easy on 'thump'/i);
  });

  it("travel & exploration: discovery and odd details; no wanderlust, quotes or destination ads", () => {
    const g = TOPIC_GUIDANCE["travel & exploration"];
    expect(g).toMatch(/discovery/i);
    expect(g).toMatch(/odd details/i);
    expect(g).toMatch(/wanderlust/i);
    expect(g).toMatch(/quotes/i);
    expect(g).toMatch(/destination ad/i);
  });

  it("life & observations: everyday and reflective, but never motivational or quote-like", () => {
    const g = TOPIC_GUIDANCE["life & observations"];
    expect(g).toMatch(/everyday/i);
    expect(g).toMatch(/human behaviour/i);
    expect(g).toMatch(/reflective/i);
    expect(g).toMatch(/never motivational/i);
    expect(g).toMatch(/quote-like/i);
  });
});

describe("personalization instructions - voice, angle and variety", () => {
  it("keeps the voice and avoidance rules", () => {
    for (const re of [
      /conversational/i,
      /thoughtful/i,
      /occasionally witty/i,
      /natural and human/i,
      /corporate-sounding/i,
      /cliches/i,
      /motivational or influencer filler/i,
    ]) {
      expect(PERSONALIZATION_INSTRUCTIONS).toMatch(re);
    }
  });

  it("asks for a fresh angle without forcing every tweet to be profound", () => {
    for (const re of [
      /observation/i,
      /unexpected angle/i,
      /small contradiction/i,
      /practical insight/i,
      /human reaction/i,
      /dry joke/i,
      /rather than explaining the topic/i,
      /not every tweet must be profound/i,
    ]) {
      expect(PERSONALIZATION_INSTRUCTIONS).toMatch(re);
    }
  });

  it("explicitly discourages repetitive rhetorical patterns", () => {
    const variety = lines.find((l) => l.startsWith("Variety:")) ?? "";
    expect(variety).toMatch(/vary openings, sentence length and structure/i);
    expect(variety).toContain("X can..., but Y...");
    expect(variety).toContain("Sometimes...");
    expect(variety).toContain("The best...");
    expect(variety).toContain("It's not about...");
    expect(variety).toMatch(/em-dash/i);
  });

  it("does not itself use em/en dashes (the prompt should not model the habit)", () => {
    expect(PERSONALIZATION_INSTRUCTIONS).not.toMatch(/[\u2014\u2013]/);
  });
});

describe("personalization instructions - location, hashtags, links", () => {
  it("treats location as optional context, never mandatory or an opening", () => {
    const location = lines.find((l) => l.startsWith("Location")) ?? "";
    expect(location).toMatch(/optional context/i);
    expect(location).toMatch(/only when it clearly improves/i);
    expect(location).toMatch(/usually omit/i);
    expect(location).toMatch(/never as the opening/i);
    expect(location).not.toMatch(/\b(always|must|include the location)\b/i);
  });

  it("does not hard-code any specific place name", () => {
    expect(PERSONALIZATION_INSTRUCTIONS).not.toMatch(/chennai/i);
  });

  it("keeps hashtags restrained: normally none, at most one", () => {
    const hashtags = lines.find((l) => l.startsWith("Hashtags")) ?? "";
    expect(hashtags).toMatch(/normally none/i);
    expect(hashtags).toMatch(/at most one hashtag/i);
    expect(hashtags).toMatch(/never as filler/i);
  });

  it("keeps the no-invented-links rule and contains no URL or vtrrk path itself", () => {
    expect(PERSONALIZATION_INSTRUCTIONS).toMatch(/never invent links/i);
    expect(PERSONALIZATION_INSTRUCTIONS).toMatch(/only use a link if one is provided/i);
    expect(PERSONALIZATION_INSTRUCTIONS).not.toMatch(/https?:\/\//i);
    expect(PERSONALIZATION_INSTRUCTIONS).not.toMatch(/vtrrk/i);
  });

  it("stays within the size budget (it is sent on every request)", () => {
    expect(PERSONALIZATION_INSTRUCTIONS.length).toBeLessThan(MAX_INSTRUCTION_CHARS);
  });
});

describe("provider request construction after M2.4", () => {
  it("sends the same stable instructions on every call, whatever the request", async () => {
    const seen = new Set<string>();
    for (const input of [
      { topic: "Photography" },
      { topic: "Cooking", location: "Chennai", style: "witty", maxLength: 280 },
      { topic: "x", maxLength: 500 },
    ]) {
      const fetchMock = input.location
        ? queueFetch(newsEmpty(), openaiOk("hi"))
        : queueFetch(openaiOk("hi"));
      await provider(fetchMock).generate(input);
      seen.add(capture(fetchMock, input.location ? 1 : 0).body.instructions);
    }
    expect(seen.size).toBe(1);
    expect([...seen][0]).toBe(PERSONALIZATION_INSTRUCTIONS);
  });

  it("does not duplicate the personality profile in the per-request input", async () => {
    const fetchMock = queueFetch(newsEmpty(), openaiOk("hi"));
    await provider(fetchMock).generate({
      topic: "Photography",
      location: "Chennai",
      style: "thoughtful",
      maxLength: 140,
    });
    const { input } = capture(fetchMock, 1).body;
    expect(input).not.toMatch(/Voice:|Angle:|Variety:|Hashtags:|Interest guide/);
    for (const interest of INTERESTS) {
      expect(input).not.toContain(TOPIC_GUIDANCE[interest]);
    }
    expect(input.length).toBeLessThan(500);
  });

  it("labels location as current context in the per-request input", async () => {
    const fetchMock = queueFetch(newsEmpty(), openaiOk("hi"));
    await provider(fetchMock).generate({ topic: "Photography", location: "Chennai" });
    expect(capture(fetchMock, 1).body.input).toContain("Location: Chennai");
  });

  it("omits the location line entirely when none is given", async () => {
    const fetchMock = queueFetch(openaiOk("hi"));
    await provider(fetchMock).generate({ topic: "Photography" });
    expect(capture(fetchMock).body.input).not.toMatch(/Location/);
  });

  it("still uses the configured model and keeps gpt-5.6-luna as the default", async () => {
    expect(DEFAULT_OPENAI_MODEL).toBe("gpt-5.6-luna");
    const def = queueFetch(openaiOk("hi"));
    await provider(def).generate({ topic: "x" });
    expect(capture(def).body.model).toBe("gpt-5.6-luna");

    const custom = queueFetch(openaiOk("hi"));
    await provider(custom, { model: "configured-model" }).generate({ topic: "x" });
    expect(capture(custom).body.model).toBe("configured-model");
  });

  it("keeps the 140 default and honours larger maxLength values without hard-coding", async () => {
    expect(DEFAULT_MAX_LENGTH).toBe(140);
    const def = queueFetch(openaiOk("hi"));
    await provider(def).generate({ topic: "x" });
    expect(capture(def).body.input).toContain("at most 140 characters");

    for (const maxLength of [280, 500]) {
      const fetchMock = queueFetch(openaiOk("hi"));
      await provider(fetchMock).generate({ topic: "x", maxLength });
      expect(capture(fetchMock).body.input).toContain(`at most ${maxLength} characters`);
    }
  });

  it("does not raise the output-token budget or change call count (cost unchanged)", async () => {
    const fetchMock = queueFetch(openaiOk("hi"));
    await provider(fetchMock).generate({ topic: "x", maxLength: 140 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(capture(fetchMock).body.max_output_tokens).toBe(78);

    const huge = queueFetch(openaiOk("hi"));
    await provider(huge).generate({ topic: "x", maxLength: 1_000_000 });
    expect(capture(huge).body.max_output_tokens).toBe(400);
  });
});

describe("link safety after M2.4", () => {
  it("still ships with an empty default link map", () => {
    expect(DEFAULT_VTRRK_LINKS).toEqual({});
  });

  it("every interest label is a valid topic that maps to exactly one VTRRK category", () => {
    const links = {
      technology: "https://example.test/tech",
      photography: "https://example.test/photo",
      riding: "https://example.test/ride",
      travel: "https://example.test/travel",
      personal: "https://example.test/life",
    };
    const categories = INTERESTS.map((i) => selectVtrrkLink(i, links)?.category);
    expect(categories).toEqual(["technology", "photography", "riding", "travel", "personal"]);
  });

  it("offers the deterministic link only when configured, and still rejects invented ones", async () => {
    const url = "https://example.test/photo";

    const withLink = queueFetch(openaiOk(`Good light. ${url}`));
    const ok = await provider(withLink, { links: { photography: url } }).generate({
      topic: "photography",
      maxLength: 140,
    });
    expect(capture(withLink).body.input).toContain(url);
    expect(ok.tweet).toContain(url);

    const none = queueFetch(openaiOk("Good light."));
    await provider(none).generate({ topic: "photography" });
    expect(capture(none).body.input).toContain("Do not include any links");

    const invented = queueFetch(
      openaiOk("More at https://vtrrk.in/guess"),
      openaiOk("More at https://vtrrk.in/guess"),
    );
    await expect(
      provider(invented, { links: { photography: url } }).generate({ topic: "photography" }),
    ).rejects.toMatchObject({ kind: "invalid_output" });
  });
});

describe("selectInterest (deterministic Surprise-me foundation)", () => {
  it("is deterministic for numbers and strings", () => {
    for (const seed of [0, 1, 42, -7, "2026-10-05", "abc"]) {
      expect(selectInterest(seed)).toBe(selectInterest(seed));
    }
  });

  it("always returns one of the five interests", () => {
    for (let seed = -50; seed < 50; seed++) {
      expect(INTERESTS).toContain(selectInterest(seed));
    }
    for (const seed of ["", "a", "Photography", "日本", "x".repeat(1000)]) {
      expect(INTERESTS).toContain(selectInterest(seed));
    }
  });

  it("rotates through all five interests on consecutive integer seeds, never repeating back-to-back", () => {
    const run = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(selectInterest);
    expect(new Set(run.slice(0, 5)).size).toBe(5);
    for (let i = 1; i < run.length; i++) expect(run[i]).not.toBe(run[i - 1]);
    expect(run.slice(5)).toEqual(run.slice(0, 5));
  });

  it("maps seeds to the interests in INTERESTS order", () => {
    INTERESTS.forEach((interest, i) => expect(selectInterest(i)).toBe(interest));
  });

  it("handles negative, fractional and non-finite numbers without throwing", () => {
    expect(selectInterest(-1)).toBe(INTERESTS[4]);
    expect(selectInterest(2.9)).toBe(selectInterest(2));
    expect(selectInterest(Number.NaN)).toBe(INTERESTS[0]);
    expect(selectInterest(Infinity)).toBe(INTERESTS[0]);
  });

  it("spreads string seeds across more than one interest", () => {
    const picks = new Set(
      Array.from({ length: 30 }, (_, i) => selectInterest(`2026-10-${i + 1}`)),
    );
    expect(picks.size).toBeGreaterThan(2);
  });
});
