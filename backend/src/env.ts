/**
 * Server-side configuration read from the Worker environment.
 *
 * Nothing here is a Cloudflare resource binding. All values are plain
 * secrets/variables supplied outside source control:
 *
 *   OPENAI_API_KEY            secret. Local dev: backend/.dev.vars (git-ignored).
 *                             Production: set later via Wrangler/dashboard (not in M2.3).
 *   OPENAI_MODEL              optional. Overrides the default model.
 *   OPENAI_REASONING_EFFORT   optional. Overrides the default ("none"); the value
 *                             "omit" drops the field for non-reasoning models.
 *   VTRRK_LINKS               optional JSON, e.g. {"photography":"https://..."}.
 *   TWEETPILOT_GENERATOR      optional. "placeholder" selects the offline stub
 *                             (used by the test suite); anything else = OpenAI.
 *
 * Values are read defensively (strings only) because Wrangler's generated Env
 * type only lists keys it can see, and secrets are not always visible to it.
 */
export interface TweetPilotConfig {
  openaiApiKey: string | undefined;
  openaiModel: string | undefined;
  openaiReasoningEffort: string | undefined;
  vtrrkLinks: string | undefined;
  generatorMode: string | undefined;
}

export function readConfig(env: Env): TweetPilotConfig {
  const bag = env as unknown as Record<string, unknown>;
  const str = (key: string): string | undefined => {
    const value = bag[key];
    return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
  };
  return {
    openaiApiKey: str("OPENAI_API_KEY"),
    openaiModel: str("OPENAI_MODEL"),
    openaiReasoningEffort: str("OPENAI_REASONING_EFFORT"),
    vtrrkLinks: str("VTRRK_LINKS"),
    generatorMode: str("TWEETPILOT_GENERATOR"),
  };
}
