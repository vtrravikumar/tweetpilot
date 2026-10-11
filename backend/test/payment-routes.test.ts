import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { createPaymentLinkRoute, razorpayWebhookRoute } from "../src/routes/payment";
import { hashLicenseKey } from "../src/usage/licenseKeys";
import { VicharUsage } from "../src/usage/durableObject";

const ctx = {} as ExecutionContext;

describe("Vichar Razorpay credit purchases", () => {
  it("does not enable checkout before Razorpay credentials are configured", async () => {
    const response = await createPaymentLinkRoute.handler(new Request("https://api.example/v1/payment/link", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ licenseKey: "vichar_" + "A".repeat(43), packId: "starter" }),
    }), env, ctx);
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ error: { code: "payments_not_configured" } });
  });

  it("rejects webhook requests with an invalid Razorpay signature", async () => {
    const response = await razorpayWebhookRoute.handler(new Request("https://api.example/v1/payment/webhook", {
      method: "POST",
      headers: { "content-type": "application/json", "x-razorpay-signature": "invalid" },
      body: JSON.stringify({ event: "payment_link.paid" }),
    }), { ...env, RAZORPAY_KEY_ID: "test_key", RAZORPAY_KEY_SECRET: "test_secret", RAZORPAY_WEBHOOK_SECRET: "webhook_secret" } as Env, ctx);
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ error: { code: "invalid_webhook_signature" } });
  });

  it("credits a registered payment once, even when verification and webhook race or retry", async () => {
    const key = "vichar_" + btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replace(/\\+/g, "-").replace(/\\//g, "_").replace(/=+$/g, "");
    const hash = await hashLicenseKey(key);
    if (!hash) throw new Error("Failed to create test license hash.");
    const namespace = (env as unknown as { VICHAR_USAGE: DurableObjectNamespace<VicharUsage> }).VICHAR_USAGE;
    const stub = namespace.get(namespace.idFromName("license:payment-test:" + hash));
    await stub.createLicense(5, Date.now(), true);
    expect(await stub.registerPaymentLink("plink_test_once", 1_000, 1_900)).toBe(true);
    const first = await stub.fulfilPaymentLink("plink_test_once", 1_900);
    const duplicate = await stub.fulfilPaymentLink("plink_test_once", 1_900);
    expect(first).toEqual({ fulfilled: true, balance: 1_005 });
    expect(duplicate).toEqual({ fulfilled: false, balance: 1_005 });
    expect((await stub.getLicense())?.balance).toBe(1_005);
  });
});
