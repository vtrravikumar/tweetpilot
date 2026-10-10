import { env } from "cloudflare:workers";
import { describe, expect, it, vi } from "vitest";
import { createGenerateTweetRoute } from "../src/routes/generateTweet";
import { issueVicharWebToken } from "../src/webAuth";

const WEB_SECRET = "test-web-secret";
const OWNER_KEY = "vichar_" + "A".repeat(43);
const URL_ = "https://tweetpilot-api.vtrravikumar.workers.dev/v1/tweet/generate";
const ctx = {} as ExecutionContext;

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

function routeEnv(values: Record<string, string> = {}): Env {
  return {
    ...env,
    VICHAR_WEB_SECRET: WEB_SECRET,
    VICHAR_OWNER_LICENSE_KEY: OWNER_KEY,
    VICHAR_BURST_PER_MINUTE: "3",
    ...values,
  } as unknown as Env;
}

describe("Vichar website owner entitlement", () => {
  it("uses owner access for website sessions and suppresses attribution", async () => {
    const generate = vi.fn(async (input: { includeAttribution?: boolean }) => ({
      tweet: input.includeAttribution === false ? "owner tweet" : "owner tweet\\nVichar by vtrrk",
    }));
    const route = createGenerateTweetRoute({ generate });
    const token = await issueVicharWebToken(WEB_SECRET);

    const response = await route.handler(
      await webRequest("203.0.113.10", token),
      routeEnv(),
      ctx,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("x-vichar-access")).toBe("owner");
    expect(response.headers.get("x-vichar-remaining")).toBe("unlimited");
    expect(await response.json()).toEqual({ tweet: "owner tweet" });
    expect(generate).toHaveBeenCalledWith(expect.objectContaining({
      topic: "Photography",
      includeAttribution: false,
    }));
  });

  it("uses the shared owner burst guard across website requests", async () => {
    const route = createGenerateTweetRoute({ generate: async () => ({ tweet: "owner tweet" }) });
    const token = await issueVicharWebToken(WEB_SECRET);
    const settings = routeEnv({
      VICHAR_OWNER_LICENSE_KEY: "vichar_" + "B".repeat(43),
      VICHAR_BURST_PER_MINUTE: "1",
    });

    const first = await route.handler(await webRequest("203.0.113.20", token), settings, ctx);
    const second = await route.handler(await webRequest("203.0.113.21", token), settings, ctx);

    expect(first.status).toBe(200);
    expect(second.status).toBe(429);
  });

  it("fails closed when owner entitlement is not configured", async () => {
    const route = createGenerateTweetRoute({ generate: async () => ({ tweet: "should not run" }) });
    const token = await issueVicharWebToken(WEB_SECRET);

    const response = await route.handler(
      await webRequest("203.0.113.30", token),
      routeEnv({ VICHAR_OWNER_LICENSE_KEY: "" }),
      ctx,
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      error: { code: "owner_entitlement_unavailable" },
    });
  });
});
