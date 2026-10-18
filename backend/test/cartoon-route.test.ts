import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { cartoonGenerateRoute } from "../src/routes/generateCartoon";
import { hashLicenseKey } from "../src/usage/licenseKeys";
import { VicharUsage } from "../src/usage/durableObject";

const licenseKey = "vichar_" + "a".repeat(43);

describe("cartoon generation route", () => {
  it("is unavailable by default without revealing whether the route exists", async () => {
    const response = await cartoonGenerateRoute.handler(
      new Request("https://example.com/v1/cartoon/generate", {
        method: "POST",
        headers: { authorization: "Bearer " + licenseKey, "content-type": "application/json" },
        body: JSON.stringify({ thoughtText: "A thought." }),
      }),
      env,
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
    await licenseStub.addImageCredits(3, 1_500);

    const testEnv = {
      ...env,
      VICHAR_CARTOON_ENABLED: "true",
      VICHAR_CARTOON_CREDIT_COST: "1",
      // Intentionally omit OPENAI_IMAGE_API_KEY: this test must never call the provider.
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
    expect(await licenseStub.getImageCreditBalance()).toBe(3);
    expect((await licenseStub.getLicense())?.balance).toBe(17);
  });
});
