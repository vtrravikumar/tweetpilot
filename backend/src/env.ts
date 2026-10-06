/**
 * Server-side configuration read from the Worker environment.
 *
 * Nothing here is a Cloudflare resource binding. All values are plain
 * secrets/variables supplied outside source control:
 *
 *   OPENAI_API_KEY            secret. Local dev: backend/.dev.vars (git-ignored).
 *                             Production: configured as a Wrangler secret.
 *   OPENAI_MODEL              optional. Overrides the default model.
 *   OPENAI_REASONING_EFFORT   optional. Overrides the default ("none"); the value
 *                             "omit" drops the field for non-reasoning models.
 *   VTRRK_LINKS               optional JSON, e.g. {"photography":"https://..."}.
 *   CORS_ALLOWED_ORIGINS      optional comma-separated browser origins allowed
 *                             to call the API, e.g. chrome-extension://<id>.
 *   TWEETPILOT_GENERATOR      optional. "placeholder" selects the offline stub
 *                             (used by the test suite); anything else = OpenAI.
 *   VICHAR_DAILY_LIMIT        optional positive integer; default 10.
 *   VICHAR_BURST_PER_MINUTE   optional positive integer; default 3.
 *
 * VICHAR_WEB_SECRET is a secret used by the web-session token and the
 * anonymous web usage guard; it is intentionally not part of TweetPilotConfig.

 *
 * Values are read defensively (strings only) because Wrangler's generated Env
 * type only lists keys it can see, and secrets are not always visible to it.
 */
export interface TweetPilotConfig {
  openaiApiKey: string | undefined;
  openaiModel: string | undefined;
  openaiReasoningEffort: string | undefined;
  vtrrkLinks: string | undefined;
  corsAllowedOrigins: string | undefined;
  generatorMode: string | undefined;
  vicharDailyLimit: number;
  vicharBurstPerMinute: number;
}

function positiveInt(value: string | undefined, fallback: number): number {
  const parsed = value ? Number.parseInt(value, 10) : Number.NaN;
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
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
    corsAllowedOrigins: str("CORS_ALLOWED_ORIGINS"),
    generatorMode: str("TWEETPILOT_GENERATOR"),
    vicharDailyLimit: positiveInt(str("VICHAR_DAILY_LIMIT"), 10),
    vicharBurstPerMinute: positiveInt(str("VICHAR_BURST_PER_MINUTE"), 3),
  };
}
