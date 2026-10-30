import { errorResponse, jsonResponse } from "../http/json";
import type { Route } from "../router";
import { generateLicenseKey, hashLicenseKey } from "../usage/licenseKeys";
import { VicharUsage } from "../usage/durableObject";
import { readConfig } from "../env";

const FREE_CREDITS = 10;

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export const freeLicenseRoute: Route = {
  method: "POST",
  path: "/v1/license/free",
  handler: async (request, env) => {
    const ip = request.headers.get("CF-Connecting-IP");
    if (!ip) return errorResponse(400, "client_identity_unavailable", "Unable to issue a free trial for this request.");

    const namespace = (env as unknown as { VICHAR_USAGE?: DurableObjectNamespace<VicharUsage> }).VICHAR_USAGE;
    if (!namespace) return errorResponse(503, "license_service_unavailable", "License service is temporarily unavailable.");

    const ipHash = await sha256(ip);
    const bag = env as unknown as Record<string, unknown>;
    const config = readConfig(env);
    const positive = (key: string, fallback: number): number => {
      const value = Number.parseInt(String(bag[key] ?? fallback), 10);
      return Number.isSafeInteger(value) && value > 0 ? value : fallback;
    };
    const nowMs = Date.now();
    const claimStub = namespace.get(namespace.idFromName("global-vichar-stats"));
    const allowed = await claimStub.claimFreeTrial(
      ipHash,
      nowMs,
      positive("VICHAR_FREE_TRIAL_GLOBAL_DAILY_LIMIT", config.freeTrialGlobalDailyLimit),
      positive("VICHAR_FREE_TRIAL_GLOBAL_BURST_PER_MINUTE", config.freeTrialGlobalBurstPerMinute),
    );
    if (!allowed) return errorResponse(429, "free_trial_already_claimed", "Free Vichar trial issuance is temporarily limited. Please try again later.");

    const key = generateLicenseKey();
    const keyHash = await hashLicenseKey(key);
    if (!keyHash) {
      await claimStub.releaseFreeTrial(ipHash, nowMs);
      return errorResponse(500, "license_creation_failed", "Unable to create a license right now.");
    }
    const licenseStub = namespace.get(namespace.idFromName("license:" + keyHash));
    try {
      const created = await licenseStub.createLicense(FREE_CREDITS, Date.now(), true);
      if (!created.created) {
        await claimStub.releaseFreeTrial(ipHash, nowMs);
        return errorResponse(500, "license_creation_failed", "Unable to create a license right now.");
      }
      return jsonResponse({ licenseKey: key, balance: created.balance, freeCredits: FREE_CREDITS }, 201);
    } catch {
      await claimStub.releaseFreeTrial(ipHash, nowMs);
      return errorResponse(503, "license_service_unavailable", "License service is temporarily unavailable.");
    }
  },
};
