import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { freeLicenseRoute } from "../src/routes/freeLicense";
import { activateLicenseRoute } from "../src/routes/activateLicense";

const ctx = {} as ExecutionContext;

describe("Vichar license issuance and activation", () => {
  it("issues 50 credits and allows activation to read the balance", async () => {
    const request = new Request("https://api.example/v1/license/free", {
      method: "POST",
      headers: { "CF-Connecting-IP": "198.51.100.81" },
    });
    const issued = await freeLicenseRoute.handler(request, env, ctx);
    expect(issued.status).toBe(201);
    const data = await issued.json() as { licenseKey: string; balance: number; freeCredits: number };
    expect(data.licenseKey).toMatch(/^vichar_[A-Za-z0-9_-]{43}$/);
    expect(data.balance).toBe(50);
    expect(data.freeCredits).toBe(50);

    const activated = await activateLicenseRoute.handler(new Request("https://api.example/v1/license/activate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ licenseKey: data.licenseKey }),
    }), env, ctx);
    expect(activated.status).toBe(200);
    expect(await activated.json()).toEqual({ active: true, balance: 50 });
  });

  it("rejects a second free trial claim for the same network on the same day", async () => {
    const makeRequest = () => new Request("https://api.example/v1/license/free", {
      method: "POST",
      headers: { "CF-Connecting-IP": "198.51.100.82" },
    });
    expect((await freeLicenseRoute.handler(await makeRequest(), env, ctx)).status).toBe(201);
    const second = await freeLicenseRoute.handler(await makeRequest(), env, ctx);
    expect(second.status).toBe(429);
    expect((await second.json() as { error: { code: string } }).error.code).toBe("free_trial_already_claimed");
  });

  it("rejects malformed and unknown license keys", async () => {
    const response = await activateLicenseRoute.handler(new Request("https://api.example/v1/license/activate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ licenseKey: "not-a-key" }),
    }), env, ctx);
    expect(response.status).toBe(401);
  });
});
