import { errorResponse, jsonResponse } from "../http/json";
import type { Route } from "../router";
import { hashLicenseKey } from "../usage/licenseKeys";
import { VicharUsage } from "../usage/durableObject";

export const activateLicenseRoute: Route = {
  method: "POST",
  path: "/v1/license/activate",
  handler: async (request, env) => {
    let body: unknown;
    try {
      const raw = await request.text();
      if (new TextEncoder().encode(raw).byteLength > 2_048) {
        return errorResponse(413, "request_too_large", "Request body is too large.");
      }
      body = JSON.parse(raw);
    } catch {
      return errorResponse(400, "invalid_json", "Request body must be valid JSON.");
    }
    if (!body || typeof body !== "object" || typeof (body as { licenseKey?: unknown }).licenseKey !== "string") {
      return errorResponse(400, "invalid_request", "A licenseKey is required.");
    }

    const submittedKey = (body as { licenseKey: string }).licenseKey;
    const hash = await hashLicenseKey(submittedKey);
    if (!hash) return errorResponse(401, "invalid_license_key", "This Vichar license key is invalid.");
    const bag = env as unknown as Record<string, unknown>;
    const ownerKey = typeof bag.VICHAR_OWNER_LICENSE_KEY === "string" ? bag.VICHAR_OWNER_LICENSE_KEY.trim() : "";
    const ownerHash = ownerKey ? await hashLicenseKey(ownerKey) : null;
    if (ownerHash && hash === ownerHash) return jsonResponse({ active: true, owner: true, unlimited: true, balance: null }, 200);

    const namespace = (env as unknown as { VICHAR_USAGE?: DurableObjectNamespace<VicharUsage> }).VICHAR_USAGE;
    if (!namespace) return errorResponse(503, "license_service_unavailable", "License service is temporarily unavailable.");
    const stub = namespace.get(namespace.idFromName("license:" + hash));
    const license = await stub.getLicense();
    if (!license) return errorResponse(401, "invalid_license_key", "This Vichar license key is invalid.");

    return jsonResponse({ active: true, owner: false, unlimited: false, balance: license.balance }, 200);
  },
};
