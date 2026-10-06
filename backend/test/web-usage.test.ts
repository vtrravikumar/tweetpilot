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

describe("Vichar web usage policy", () => {
  it("allows repeated web generations without the extension quota", async () => {
    const route = createGenerateTweetRoute(generator);
    const routeEnv = {
      ...env,
      VICHAR_WEB_SECRET: WEB_SECRET,
      VICHAR_DAILY_LIMIT: "10",
      VICHAR_BURST_PER_MINUTE: "3",
    } as unknown as Env;
    const token = await issueVicharWebToken(WEB_SECRET);

    for (let index = 0; index < 12; index += 1) {
      const response = await route.handler(
        await webRequest("203.0.113.10", token),
        routeEnv,
        ctx,
      );
      expect(response.status).toBe(200);
    }
  });

  it("does not couple web usage to client IP", async () => {
    const route = createGenerateTweetRoute(generator);
    const routeEnv = {
      ...env,
      VICHAR_WEB_SECRET: WEB_SECRET,
      VICHAR_DAILY_LIMIT: "1",
      VICHAR_BURST_PER_MINUTE: "1",
    } as unknown as Env;
    const token = await issueVicharWebToken(WEB_SECRET);

    expect((await route.handler(await webRequest("203.0.113.20", token), routeEnv, ctx)).status).toBe(200);
    expect((await route.handler(await webRequest("203.0.113.21", token), routeEnv, ctx)).status).toBe(200);
  });

  it("still requires a valid web session before generation", async () => {
    const route = createGenerateTweetRoute(generator);
    const routeEnv = {
      ...env,
      VICHAR_WEB_SECRET: WEB_SECRET,
    } as unknown as Env;
    const request = new Request(URL_, {
      method: "POST",
      headers: {
        Origin: "https://vtrrk.in",
        "content-type": "application/json",
      },
      body: JSON.stringify({ topic: "Photography" }),
    });

    const response = await route.handler(request, routeEnv, ctx);
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: {
        code: "missing_usage_key",
        message: "Vichar usage key is required.",
      },
    });
  });
});
