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
 *   VICHAR_OWNER_LICENSE_KEY  secret; permanent owner entitlement key, never commit it.
 *   VICHAR_WEB_IP_DAILY_LIMIT, VICHAR_WEB_IP_BURST_PER_MINUTE and
 *   VICHAR_WEB_GLOBAL_DAILY_LIMIT bound public website generation.
 *   VICHAR_WEB_SESSION_PER_MINUTE limits session challenges per IP.
 *   VICHAR_WEB_SESSION_GLOBAL_PER_MINUTE caps verification calls across IPs.
 *   VICHAR_FREE_TRIAL_GLOBAL_DAILY_LIMIT and
 *   VICHAR_FREE_TRIAL_GLOBAL_BURST_PER_MINUTE bound free trial issuance.
 *   TURNSTILE_SECRET_KEY is a Cloudflare Turnstile secret (Worker secret).
 *
 * VICHAR_WEB_SECRET is a secret used to sign web-session tokens; it is
 * intentionally not part of TweetPilotConfig.

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
  webIpDailyLimit: number;
  webIpBurstPerMinute: number;
  webGlobalDailyLimit: number;
  webSessionPerMinute: number;
  webSessionGlobalPerMinute: number;
  freeTrialGlobalDailyLimit: number;
  freeTrialGlobalBurstPerMinute: number;
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
    webIpDailyLimit: positiveInt(str("VICHAR_WEB_IP_DAILY_LIMIT"), 20),
    webIpBurstPerMinute: positiveInt(str("VICHAR_WEB_IP_BURST_PER_MINUTE"), 3),
    webGlobalDailyLimit: positiveInt(str("VICHAR_WEB_GLOBAL_DAILY_LIMIT"), 1000),
    webSessionPerMinute: positiveInt(str("VICHAR_WEB_SESSION_PER_MINUTE"), 10),
    webSessionGlobalPerMinute: positiveInt(str("VICHAR_WEB_SESSION_GLOBAL_PER_MINUTE"), 1000),
    freeTrialGlobalDailyLimit: positiveInt(str("VICHAR_FREE_TRIAL_GLOBAL_DAILY_LIMIT"), 500),
    freeTrialGlobalBurstPerMinute: positiveInt(str("VICHAR_FREE_TRIAL_GLOBAL_BURST_PER_MINUTE"), 30),
  };
}
