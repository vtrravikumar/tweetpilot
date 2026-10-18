/**
 * Server-side configuration read from the Worker environment.
 *
 * Secrets are supplied outside source control:
 *   OPENAI_TEXT_API_KEY        preferred text-generation key; falls back to
 *                              OPENAI_API_KEY during the migration.
 *   OPENAI_API_KEY             legacy text-generation key (keep working until
 *                              the secret is deliberately migrated).
 *   OPENAI_IMAGE_API_KEY       image-generation key; no fallback to text key.
 *   OPENAI_MODEL               optional text model override.
 *   OPENAI_REASONING_EFFORT    optional reasoning-effort override.
 *   VTRRK_LINKS                optional JSON link configuration.
 *   CORS_ALLOWED_ORIGINS       optional comma-separated allowed browser origins.
 *   TWEETPILOT_GENERATOR       optional; "placeholder" selects the offline stub.
 *   VICHAR_DAILY_LIMIT         optional positive integer; default 10.
 *   VICHAR_BURST_PER_MINUTE    optional positive integer; default 3.
 *   VICHAR_OWNER_LICENSE_KEY   secret; permanent owner entitlement key.
 *
 * VICHAR_WEB_SECRET is used by the web-session token and anonymous web usage
 * guard; it is intentionally not part of TweetPilotConfig.
 *
 * Values are read defensively because Worker secrets may not appear in the
 * generated Env type. This module never logs or exposes secret values.
 */
export interface TweetPilotConfig {
  openaiApiKey: string | undefined;
  openaiImageApiKey: string | undefined;
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
    // New name takes precedence, while the legacy key preserves existing deployments.
    openaiApiKey: str("OPENAI_TEXT_API_KEY") ?? str("OPENAI_API_KEY"),
    // Deliberately no fallback to either text key.
    openaiImageApiKey: str("OPENAI_IMAGE_API_KEY"),
    openaiModel: str("OPENAI_MODEL"),
    openaiReasoningEffort: str("OPENAI_REASONING_EFFORT"),
    vtrrkLinks: str("VTRRK_LINKS"),
    corsAllowedOrigins: str("CORS_ALLOWED_ORIGINS"),
    generatorMode: str("TWEETPILOT_GENERATOR"),
    vicharDailyLimit: positiveInt(str("VICHAR_DAILY_LIMIT"), 10),
    vicharBurstPerMinute: positiveInt(str("VICHAR_BURST_PER_MINUTE"), 3),
  };
}
