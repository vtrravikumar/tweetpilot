/**
 * Usage guard: the single hook where generation-call limiting plugs in.
 *
 * M2.3 ships only the allow-all default. A real limit needs shared state
 * (a Worker isolate is ephemeral and many can run at once, so an in-memory
 * counter would not be a reliable limit), which means persistence or a
 * Cloudflare rate-limiting mechanism. That is deliberately deferred to M2.6;
 * it can be added by implementing this interface and passing it to
 * createGenerateTweetRoute - no route or provider change needed.
 */

export type UsageDecision =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds?: number };

export interface UsageGuard {
  /** Called after request validation, immediately before a generation call. */
  check(request: Request): Promise<UsageDecision>;
}

export const allowAllUsageGuard: UsageGuard = {
  async check() {
    return { allowed: true };
  },
};
