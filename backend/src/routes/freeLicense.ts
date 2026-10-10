import { errorResponse, jsonResponse } from "../http/json";
import type { Route } from "../router";
import { generateLicenseKey, hashLicenseKey } from "../usage/licenseKeys";
import { VicharUsage } from "../usage/durableObject";

const FREE_CREDITS = 5;

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
    const claimStub = namespace.get(namespace.idFromName("trial:" + ipHash));
    const now = new Date();
    const allowed = await claimStub.claimFreeTrial(now.toISOString().slice(0, 10));
    if (!allowed) return errorResponse(429, "free_trial_already_claimed", "A free Vichar trial has already been issued for this network today. Please try again tomorrow.");

    const key = generateLicenseKey();
    const keyHash = await hashLicenseKey(key);
    if (!keyHash) return errorResponse(500, "license_creation_failed", "Unable to create a license right now.");
    const licenseStub = namespace.get(namespace.idFromName("license:" + keyHash));
    const created = await licenseStub.createLicense(FREE_CREDITS, Date.now(), true);
    if (!created.created) return errorResponse(500, "license_creation_failed", "Unable to create a license right now.");

    return jsonResponse({ licenseKey: key, balance: created.balance, freeCredits: FREE_CREDITS }, 201);
  },
};
