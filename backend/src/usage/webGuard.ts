import { readConfig } from "../env";
import { VicharUsage } from "./durableObject";

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Atomically reserve a web generation against both IP and global daily budgets. */
export async function checkWebUsage(request: Request, env: Env): Promise<{
  allowed: boolean;
  reason?: "daily" | "burst" | "unavailable";
  retryAfterSeconds?: number;
}> {
  const ip = request.headers.get("CF-Connecting-IP");
  if (!ip) return { allowed: false, reason: "unavailable" };
  const namespace = (env as unknown as { VICHAR_USAGE?: DurableObjectNamespace<VicharUsage> }).VICHAR_USAGE;
  if (!namespace) return { allowed: false, reason: "unavailable" };
  const config = readConfig(env);
  const bag = env as unknown as Record<string, unknown>;
  const positive = (key: string, fallback: number): number => {
    const value = Number.parseInt(String(bag[key] ?? fallback), 10);
    return Number.isSafeInteger(value) && value > 0 ? value : fallback;
  };
  const globalLimit = positive("VICHAR_WEB_GLOBAL_DAILY_LIMIT", config.webGlobalDailyLimit);
  const ipDailyLimit = positive("VICHAR_WEB_IP_DAILY_LIMIT", config.webIpDailyLimit);
  const ipBurstLimit = positive("VICHAR_WEB_IP_BURST_PER_MINUTE", config.webIpBurstPerMinute);
  const stub = namespace.get(namespace.idFromName("global-vichar-stats"));
  const result = await stub.consumeWebGeneration(await sha256(ip), Date.now(), ipDailyLimit, ipBurstLimit, globalLimit);
  return result;
}
