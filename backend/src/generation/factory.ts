import { readConfig } from "../env";
import { GenerationError } from "./errors";
import { resolveVtrrkLinks } from "./links";
import { OpenAIProvider } from "./openai";
import { PlaceholderTweetGenerator } from "./placeholder";
import type { TweetGenerator } from "./types";

/**
 * Chooses the TweetGenerator for a request from the Worker environment.
 *
 * Default is OpenAI. If the API key is missing this throws a
 * GenerationError("not_configured") - it never silently falls back to the
 * placeholder, so production cannot serve fake tweets by accident. The
 * placeholder is used only when TWEETPILOT_GENERATOR=placeholder is set
 * explicitly (the test suite does this).
 */
export function createTweetGenerator(
  env: Env,
  fetchImpl?: typeof fetch,
): TweetGenerator {
  const config = readConfig(env);

  if (config.generatorMode === "placeholder") {
    return new PlaceholderTweetGenerator();
  }

  if (!config.openaiApiKey) {
    throw new GenerationError("not_configured", "OPENAI_API_KEY is not set.");
  }

  const effort = config.openaiReasoningEffort;
  return new OpenAIProvider({
    apiKey: config.openaiApiKey,
    ...(config.openaiModel ? { model: config.openaiModel } : {}),
    ...(effort ? { reasoningEffort: effort === "omit" ? null : effort } : {}),
    links: resolveVtrrkLinks(config.vtrrkLinks),
    ...(fetchImpl ? { fetchImpl } : {}),
  });
}
