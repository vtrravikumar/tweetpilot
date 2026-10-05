import {
  DEFAULT_MAX_LENGTH,
  type GenerateTweetInput,
  type GenerateTweetResult,
  type TweetGenerator,
} from "./types";

/**
 * TEMPORARY (M2.2 only): deterministic stand-in so the endpoint can be tested.
 *
 * This is NOT AI generation. It performs no model call and uses no randomness:
 * the same input always produces the same output. The output is explicitly
 * labelled so it can never be mistaken for a real generated tweet.
 *
 * Replace with the OpenAI provider in M2.3 (see ./types.ts).
 */

export { DEFAULT_MAX_LENGTH };

export const PLACEHOLDER_PREFIX = "[PLACEHOLDER - not AI generated]";

export class PlaceholderTweetGenerator implements TweetGenerator {
  async generate(input: GenerateTweetInput): Promise<GenerateTweetResult> {
    const parts = [`${PLACEHOLDER_PREFIX} Topic: ${input.topic}.`];
    if (input.location) parts.push(`Location: ${input.location}.`);
    if (input.style) parts.push(`Style: ${input.style}.`);

    return {
      tweet: truncate(parts.join(" "), input.maxLength ?? DEFAULT_MAX_LENGTH),
    };
  }
}

/** Truncates by Unicode code point so surrogate pairs are never split. */
function truncate(text: string, maxLength: number): string {
  const chars = Array.from(text);
  if (chars.length <= maxLength) return text;
  if (maxLength <= 1) return chars.slice(0, maxLength).join("");
  return `${chars.slice(0, maxLength - 1).join("")}…`;
}
