import { errorResponse, jsonResponse } from "../http/json";
import type { Route } from "../router";
import { generateCartoonWithCredits } from "../cartoon/generateCartoon";
import { getCharacterReference } from "../cartoon/characterReferenceAsset";
import { OpenAIImageProvider } from "../cartoon/openaiImageProvider";
import { readConfig } from "../env";
import { hashLicenseKey } from "../usage/licenseKeys";
import { VicharUsage } from "../usage/durableObject";

const MAX_BODY_BYTES = 8 * 1024;
const MAX_THOUGHT_CHARS = 4_000;
const LICENSE_PATTERN = /^Bearer\s+(vichar_[A-Za-z0-9_-]{43})$/;

export const cartoonGenerateRoute: Route = {
  method: "POST",
  path: "/v1/cartoon/generate",
  handler: async (request, env) => {
    const bag = env as unknown as Record<string, unknown>;
    // Closed unless explicitly enabled by a non-production/staging environment.
    if (bag.VICHAR_CARTOON_ENABLED !== "true") {
      return errorResponse(404, "not_found", "Route not found.");
    }

    const configuredCost = Number(bag.VICHAR_CARTOON_CREDIT_COST);
    if (!Number.isSafeInteger(configuredCost) || configuredCost <= 0) {
      return errorResponse(503, "cartoon_unavailable", "Cartoon generation is not configured.");
    }

    const authorization = request.headers.get("authorization")?.trim() ?? "";
    const match = LICENSE_PATTERN.exec(authorization);
    const licenseKey = match?.[1];
    const keyHash = licenseKey ? await hashLicenseKey(licenseKey) : null;
    if (!keyHash) return errorResponse(401, "invalid_license_key", "A valid Vichar license key is required.");

    const operationId = request.headers.get("idempotency-key")?.trim() ?? "";
    if (!operationId || operationId.length > 200 || !/^[A-Za-z0-9._:-]+$/.test(operationId)) {
      return errorResponse(400, "invalid_idempotency_key", "A valid Idempotency-Key header is required.");
    }

    const contentLength = request.headers.get("content-length");
    if (contentLength !== null) {
      const declaredLength = Number.parseInt(contentLength, 10);
      if (Number.isSafeInteger(declaredLength) && declaredLength > MAX_BODY_BYTES) {
        return errorResponse(413, "request_too_large", "Request body is too large.");
      }
    }

    let body: unknown;
    try {
      const raw = await request.text();
      if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
        return errorResponse(413, "request_too_large", "Request body is too large.");
      }
      body = JSON.parse(raw);
    } catch {
      return errorResponse(400, "invalid_json", "Request body must be valid JSON.");
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return errorResponse(400, "invalid_request", "A JSON object is required.");
    }
    const thoughtText = (body as { thoughtText?: unknown }).thoughtText;
    if (typeof thoughtText !== "string" || thoughtText.trim().length === 0 || thoughtText.length > MAX_THOUGHT_CHARS) {
      return errorResponse(400, "invalid_request", "thoughtText must contain 1–4000 characters.");
    }

    const namespace = (env as unknown as { VICHAR_USAGE?: DurableObjectNamespace<VicharUsage> }).VICHAR_USAGE;
    if (!namespace) return errorResponse(503, "license_service_unavailable", "License service is temporarily unavailable.");
    const licenseStub = namespace.get(namespace.idFromName("license:" + keyHash));
    const license = await licenseStub.getLicense();
    if (!license) return errorResponse(401, "invalid_license_key", "This Vichar license key is invalid.");

    const burstRaw = Number.parseInt(String(bag.VICHAR_CARTOON_BURST_PER_MINUTE ?? "2"), 10);
    const burstLimit = Number.isSafeInteger(burstRaw) && burstRaw > 0 ? burstRaw : 2;
    const burstStub = namespace.get(namespace.idFromName("cartoon-burst:" + keyHash));
    const burst = await burstStub.checkBurst(Date.now(), burstLimit);
    if (!burst.allowed) {
      return errorResponse(429, "rate_limited", "Too many cartoon requests. Please try again shortly.", {
        "retry-after": String(burst.retryAfterSeconds ?? 60),
      });
    }

    const imageBalance = await licenseStub.getImageCreditBalance();
    if (imageBalance === null) return errorResponse(401, "invalid_license_key", "This Vichar license key is invalid.");
    if (imageBalance < configuredCost) {
      return errorResponse(402, "image_credits_exhausted", "Your image-credit balance is insufficient.", {
        "x-vichar-image-remaining": String(imageBalance),
      });
    }

    let reference;
    try {
      reference = await getCharacterReference();
    } catch {
      return errorResponse(503, "cartoon_unavailable", "The approved character reference is unavailable.");
    }

    const config = readConfig(env);
    const provider = new OpenAIImageProvider({ apiKey: config.openaiImageApiKey });
    const result = await generateCartoonWithCredits({
      operationId: keyHash + ":" + operationId,
      credits: configuredCost,
      thought: thoughtText.trim(),
      safetyIdentifier: "sha256:" + keyHash,
      characterReference: reference,
      provider,
      ledger: licenseStub,
    });

    switch (result.status) {
      case "generated": {
        const remainingImageCredits = await licenseStub.getImageCreditBalance();
        return new Response(result.image.bytes, {
          status: 200,
          headers: {
            "content-type": "image/png",
            "cache-control": "no-store",
            "x-vichar-character-version": result.image.characterReferenceVersion,
            "x-vichar-image-model": result.image.model,
            "x-vichar-image-duration-ms": String(result.image.durationMs),
            "x-vichar-image-remaining": String(remainingImageCredits ?? 0),
          },
        });
      }
      case "credits_unavailable":
        return errorResponse(402, "image_credits_unavailable", "Image credits could not be reserved.", {
          "x-vichar-image-remaining": String(result.balance ?? 0),
        });
      case "already_in_progress":
        return errorResponse(409, "operation_already_used", "This idempotency key has already been used or is still processing.");
      case "failed":
        if (result.creditsReleased) {
          return errorResponse(502, "cartoon_generation_failed", "Cartoon generation failed; image credits were released.");
        }
        return errorResponse(502, "cartoon_generation_failed", "Cartoon generation failed; image-credit settlement needs review.");
      case "outcome_unknown":
        return errorResponse(503, "cartoon_outcome_unknown", "The image outcome is uncertain; credits remain reserved pending reconciliation.");
    }
  },
};
