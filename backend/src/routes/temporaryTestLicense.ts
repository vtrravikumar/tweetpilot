import { errorResponse, jsonResponse } from "../http/json";
import type { Route } from "../router";
import { generateLicenseKey, hashLicenseKey } from "../usage/licenseKeys";
import { VicharUsage } from "../usage/durableObject";

/**
 * Temporary operator-only endpoint for the Razorpay Live smoke test.
 * Remove this route and its secret immediately after the test.
 */
export const temporaryTestLicenseRoute: Route = {
  method: "POST",
  path: "/v1/internal/test-license",
  handler: async (request, env) => {
    const bag = env as unknown as Record<string, unknown>;
    const configuredSecret = typeof bag.VICHAR_TEST_LICENSE_SECRET === "string"
      ? bag.VICHAR_TEST_LICENSE_SECRET.trim()
      : "";
    if (!configuredSecret) {
      return errorResponse(404, "not_found", "Route not found.");
    }

    const authorization = request.headers.get("authorization") ?? "";
    if (authorization !== "Bearer " + configuredSecret) {
      return errorResponse(401, "unauthorized", "Unauthorized.");
    }

    let body: unknown;
    try {
      const raw = await request.text();
      if (new TextEncoder().encode(raw).byteLength > 1_024) {
        return errorResponse(413, "request_too_large", "Request body is too large.");
      }
      body = JSON.parse(raw);
    } catch {
      return errorResponse(400, "invalid_json", "Request body must be valid JSON.");
    }
    const credits = body && typeof body === "object" && "credits" in body
      ? (body as { credits?: unknown }).credits
      : 5;
    if (credits !== 5) {
      return errorResponse(400, "invalid_credits", "Temporary test licenses must start with exactly 5 credits.");
    }

    const namespace = (env as unknown as { VICHAR_USAGE?: DurableObjectNamespace<VicharUsage> }).VICHAR_USAGE;
    if (!namespace) return errorResponse(503, "license_service_unavailable", "License service is temporarily unavailable.");

    const key = generateLicenseKey();
    const hash = await hashLicenseKey(key);
    if (!hash) return errorResponse(500, "license_creation_failed", "Unable to create a test license.");
    const stub = namespace.get(namespace.idFromName("license:" + hash));
    const created = await stub.createLicense(5, Date.now(), true);
    if (!created.created) return errorResponse(500, "license_creation_failed", "Unable to create a test license.");

    return jsonResponse({ licenseKey: key, balance: created.balance, temporary: true }, 201, { "cache-control": "no-store" });
  },
};
