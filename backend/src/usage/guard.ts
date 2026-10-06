import { readConfig } from "../env";
import { VicharUsage } from "./durableObject";

export type UsageDecision =
  | {
      allowed: true;
      remaining?: number;
      dailyLimit?: number;
    }
  | {
      allowed: false;
      retryAfterSeconds?: number;
      remaining?: number;
      dailyLimit?: number;
      reason?: "daily" | "burst" | "unauthorized";
    };

export interface UsageGuard {
  /** Called after request validation, immediately before a generation call. */
  check(request: Request, env: Env): Promise<UsageDecision>;
}

export function createUsageGuard(): UsageGuard {
  return {
    async check(request, env) {
      const apiKey = readVicharApiKey(request);
      if (!apiKey) {
        return {
          allowed: false,
          remaining: 0,
          dailyLimit: 0,
          reason: "unauthorized",
        };
      }

      const config = readConfig(env);
      const namespace = (
        env as unknown as {
          VICHAR_USAGE: DurableObjectNamespace<VicharUsage>;
        }
      ).VICHAR_USAGE;

      const id = namespace.idFromName(apiKey);
      const stub = namespace.get(id);

      return stub.check(
        Date.now(),
        config.vicharDailyLimit,
        config.vicharBurstPerMinute,
      );
    },
  };
}

export function readVicharApiKey(request: Request): string | undefined {
  const authorization = request.headers.get("authorization");
  if (!authorization) return undefined;

  const match = /^Bearer\s+([A-Za-z0-9-]{20,128})$/.exec(authorization.trim());
  return match?.[1];
}
