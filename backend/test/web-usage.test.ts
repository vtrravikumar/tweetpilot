import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { createGenerateTweetRoute } from "../src/routes/generateTweet";
import { issueVicharWebToken } from "../src/webAuth";

const WEB_SECRET = "test-web-secret";
const URL_ = "https://tweetpilot-api.vtrravikumar.workers.dev/v1/tweet/generate";
const ctx = {} as ExecutionContext;

const generator = {
  generate: async () => ({ tweet: "web test tweet" }),
};

async function webRequest(ip: string, token: string): Promise<Request> {
  return new Request(URL_, {
    method: "POST",
    headers: {
      Origin: "https://vtrrk.in",
      Authorization: `Bearer ${token}`,
      "CF-Connecting-IP": ip,
      "content-type": "application/json",
    },
    body: JSON.stringify({ topic: "Photography" }),
  });
}

describe("Vichar web usage protection", () => {
  it("applies the normal burst quota to a web session", async () => {
    const route = createGenerateTweetRoute(generator);
    const routeEnv = {
      ...env,
      VICHAR_WEB_SECRET: WEB_SECRET,
      VICHAR_DAILY_LIMIT: "10",
      VICHAR_BURST_PER_MINUTE: "3",
    } as unknown as Env;
    const token = await issueVicharWebToken(WEB_SECRET);

    expect((await route.handler(await webRequest("203.0.113.10", token), routeEnv, ctx)).status).toBe(200);
    expect((await route.handler(await webRequest("203.0.113.10", token), routeEnv, ctx)).status).toBe(200);
    expect((await route.handler(await webRequest("203.0.113.10", token), routeEnv, ctx)).status).toBe(200);

    const blocked = await route.handler(await webRequest("203.0.113.10", token), routeEnv, ctx);
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("retry-after")).not.toBeNull();
  });

  it("isolates web usage counters by client IP", async () => {
    const route = createGenerateTweetRoute(generator);
    const routeEnv = {
      ...env,
      VICHAR_WEB_SECRET: WEB_SECRET,
      VICHAR_DAILY_LIMIT: "10",
      VICHAR_BURST_PER_MINUTE: "3",
    } as unknown as Env;
    const token = await issueVicharWebToken(WEB_SECRET);

    expect((await route.handler(await webRequest("203.0.113.20", token), routeEnv, ctx)).status).toBe(200);
    expect((await route.handler(await webRequest("203.0.113.20", token), routeEnv, ctx)).status).toBe(200);
    expect((await route.handler(await webRequest("203.0.113.20", token), routeEnv, ctx)).status).toBe(200);
    expect((await route.handler(await webRequest("203.0.113.21", token), routeEnv, ctx)).status).toBe(200);
  });

  it("fails closed when Cloudflare does not provide a client IP", async () => {
    const route = createGenerateTweetRoute(generator);
    const routeEnv = {
      ...env,
      VICHAR_WEB_SECRET: WEB_SECRET,
    } as unknown as Env;
    const token = await issueVicharWebToken(WEB_SECRET);
    const request = new Request(URL_, {
      method: "POST",
      headers: {
        Origin: "https://vtrrk.in",
        Authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ topic: "Photography" }),
    });

    const response = await route.handler(request, routeEnv, ctx);
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: {
        code: "web_usage_unavailable",
        message: "Vichar web usage protection is currently unavailable.",
      },
    });
  });
});
