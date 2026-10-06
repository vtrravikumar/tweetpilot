import type { UsageDecision } from "./guard";

/**
 * Vichar's public web client is intentionally unlimited for V1.
 *
 * The web session/origin checks remain in place before this function is called.
 * Extension installations continue to use the Durable Object usage guard.
 * If public web traffic becomes excessive, add a separate web abuse-control
 * strategy rather than coupling the web client to extension quotas again.
 */
export async function checkWebUsage(
  _request: Request,
  _env: Env,
  _webSecret: string,
): Promise<UsageDecision> {
  return { allowed: true };
}
