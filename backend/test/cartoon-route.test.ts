import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { cartoonGenerateRoute } from "../src/routes/generateCartoon";
import { hashLicenseKey } from "../src/usage/licenseKeys";
import { VicharUsage } from "../src/usage/durableObject";
import { issueVicharWebToken } from "../src/webAuth";

const licenseKey = "vichar_" + crypto.randomUUID().replace(/-/g, "").padEnd(43, "a").slice(0, 43);

describe("cartoon generation route", () => {
  it("is unavailable by default without revealing whether the route exists", async () => {
    const response = await cartoonGenerateRoute.handler(
      new Request("https://example.com/v1/cartoon/generate", {
        method: "POST",
        headers: { authorization: "Bearer " + licenseKey, "content-type": "application/json" },
        body: JSON.stringify({ thoughtText: "A thought." }),
      }),
      { ...env, VICHAR_CARTOON_ENABLED: "false" } as Env,
      {} as ExecutionContext,
    );
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: { code: "not_found", message: "Route not found." },
    });
  });

  it("loads and verifies the canonical PNG in the Worker runtime before provider use", async () => {
    const keyHash = await hashLicenseKey(licenseKey);
    if (!keyHash) throw new Error("Test license key must be valid.");
    const namespace = (env as unknown as { VICHAR_USAGE: DurableObjectNamespace<VicharUsage> }).VICHAR_USAGE;
    const licenseStub = namespace.get(namespace.idFromName("license:" + keyHash));
    await licenseStub.createLicense(17, 1_000);

    const testEnv = {
      ...env,
      VICHAR_CARTOON_ENABLED: "true",
      VICHAR_CARTOON_CREDIT_COST: "1",
      OPENAI_IMAGE_API_KEY: "",
      // Blank the image key so this test cannot make a provider request.
    } as Env;

    const response = await cartoonGenerateRoute.handler(
      new Request("https://example.com/v1/cartoon/generate", {
        method: "POST",
        headers: {
          authorization: "Bearer " + licenseKey,
          "content-type": "application/json",
          "idempotency-key": "worker-runtime-asset-test",
        },
        body: JSON.stringify({ thoughtText: "A thought about bureaucracy." }),
      }),
      testEnv,
      {} as ExecutionContext,
    );

    // The route reaches the provider workflow only if the bundled PNG loads and
    // passes its approved SHA-256 check. With no image key, the fake-safe path
    // fails before networking and returns a definitive failure response.
    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({
      error: { code: "cartoon_generation_failed" },
    });
    // A definitive provider failure refunds the reservation to the shared wallet.
    expect((await licenseStub.getLicense())?.balance).toBe(17);
  });

  it("supports a first-party owner web session with a separate daily test allowance", async () => {
    const secret = "local-test-web-secret";
    const token = await issueVicharWebToken(secret);
    const testEnv = {
      ...env,
      VICHAR_CARTOON_ENABLED: "true",
      VICHAR_CARTOON_OWNER_DAILY_LIMIT: "2",
      VICHAR_CARTOON_BURST_PER_MINUTE: "2",
      VICHAR_WEB_SECRET: secret,
      VICHAR_OWNER_LICENSE_KEY: licenseKey,
      OPENAI_IMAGE_API_KEY: "",
    } as Env;

    const response = await cartoonGenerateRoute.handler(
      new Request("https://api.example/v1/cartoon/generate", {
        method: "POST",
        headers: {
          origin: "https://vtrrk.in",
          authorization: "Bearer " + token,
          "content-type": "application/json",
          "idempotency-key": "owner-web-test-1",
        },
        body: JSON.stringify({ thoughtText: "A thought about bureaucracy." }),
      }),
      testEnv,
      {} as ExecutionContext,
    );

    // Empty image credentials force a local, non-networking failure after auth,
    // allowance enforcement, and canonical-reference verification.
    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({ error: { code: "cartoon_generation_failed" } });
  });
});
