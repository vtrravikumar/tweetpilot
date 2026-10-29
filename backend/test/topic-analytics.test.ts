import { describe, expect, it, vi } from "vitest";
import { createGenerateTweetRoute } from "../src/routes/generateTweet";
import { customTopicAnalyticsRoute } from "../src/routes/customTopicAnalytics";
import { issueVicharWebToken } from "../src/webAuth";

const OWNER_KEY = "vichar_" + "a".repeat(43);
const WEB_SECRET = "test-web-secret-for-topic-analytics";

function setup(overrides: Record<string, unknown> = {}) {
  const calls: Array<{ name: string; args: unknown[] }> = [];
  const stub = {
    checkBurst: vi.fn(async () => ({ allowed: true })),
    recordGlobalGeneration: vi.fn(async () => 501),
    recordCustomTopicEvent: vi.fn(async (event: unknown) => { calls.push({ name: "recordCustomTopicEvent", args: [event] }); }),
    getCustomTopicAnalytics: vi.fn(async () => ({
      windowDays: 90,
      totalEvents: 1,
      topics: [{ topic: "photography", count: 1, languages: ["en"], sourceApps: ["vichar-web"] }],
      languages: [{ language: "en", count: 1 }],
      sourceApps: [{ sourceApp: "vichar-web", count: 1 }],
      weekly: [{ week: "2026-W43", count: 1 }],
    })),
  };
  const env = {
    VICHAR_WEB_SECRET: WEB_SECRET,
    VICHAR_OWNER_LICENSE_KEY: OWNER_KEY,
    VICHAR_USAGE: {
      idFromName: (id: string) => id,
      get: (_id: string) => stub,
    },
    ...overrides,
  } as unknown as Env;
  return { env, stub, calls };
}

function executionContext() {
  const promises: Promise<unknown>[] = [];
  return {
    promises,
    ctx: { waitUntil: (promise: Promise<unknown>) => promises.push(promise) } as unknown as ExecutionContext,
  };
}

describe("generic custom-topic analytics", () => {
  it("queues a versioned topic event asynchronously only for authenticated website custom topics", async () => {
    const { env, stub, calls } = setup();
    const { ctx, promises } = executionContext();
    const token = await issueVicharWebToken(WEB_SECRET);
    const route = createGenerateTweetRoute(
      { generate: async () => ({ tweet: "A short draft." }) },
      { path: "/v2/tweet/generate", includeStyle: true, topicAnalyticsSourceApp: "vichar-web" },
    );
    const response = await route.handler(new Request("https://example.com/v2/tweet/generate", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://vtrrk.in",
        authorization: "Bearer " + token,
      },
      body: JSON.stringify({ topic: "  Photography   Ideas ", topicSource: "custom", language: "en" }),
    }), env, ctx);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ tweet: "A short draft.", style: null });
    expect(stub.recordGlobalGeneration).toHaveBeenCalledTimes(1);
    expect(promises).toHaveLength(1);
    await Promise.all(promises);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.args[0]).toEqual({
      schemaVersion: 1,
      topic: "photography ideas",
      language: "en",
      sourceApp: "vichar-web",
    });
  });

  it("does not collect preset topics or requests without the signed website session", async () => {
    const { env, stub, calls } = setup();
    const { ctx, promises } = executionContext();
    const route = createGenerateTweetRoute(
      { generate: async () => ({ tweet: "A short draft." }) },
      { path: "/v2/tweet/generate", includeStyle: true },
    );
    const preset = await route.handler(new Request("https://example.com/v2/tweet/generate", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://vtrrk.in", authorization: "Bearer invalid-token" },
      body: JSON.stringify({ topic: "Photography", topicSource: "preset" }),
    }), env, ctx);
    expect(preset.status).toBe(200);
    expect(promises).toHaveLength(0);
    expect(calls).toHaveLength(0);
    expect(stub.recordCustomTopicEvent).not.toHaveBeenCalled();

    const extensionStyle = await route.handler(new Request("https://example.com/v2/tweet/generate", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer test-extension-usage-key-1234567890" },
      body: JSON.stringify({ topic: "Photography", topicSource: "custom" }),
    }), env, ctx);
    expect(extensionStyle.status).toBe(200);
    expect(promises).toHaveLength(0);
    expect(stub.recordCustomTopicEvent).not.toHaveBeenCalled();
  });

  it("does not fail generation when the asynchronous analytics write fails", async () => {
    const { env, stub } = setup();
    stub.recordCustomTopicEvent.mockRejectedValueOnce(new Error("analytics storage unavailable"));
    const { ctx, promises } = executionContext();
    const token = await issueVicharWebToken(WEB_SECRET);
    const route = createGenerateTweetRoute(
      { generate: async () => ({ tweet: "Still generated." }) },
      { path: "/v2/tweet/generate", includeStyle: true },
    );
    const response = await route.handler(new Request("https://example.com/v2/tweet/generate", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://vtrrk.in", authorization: "Bearer " + token },
      body: JSON.stringify({ topic: "Photography", topicSource: "custom" }),
    }), env, ctx);
    expect(response.status).toBe(200);
    expect((await response.json() as { tweet: string }).tweet).toBe("Still generated.");
    await Promise.all(promises);
  });

  it("protects aggregate analytics with the owner key and never exposes raw event rows", async () => {
    const { env, stub } = setup();
    const unauthorized = await customTopicAnalyticsRoute.handler(
      new Request("https://example.com/v1/admin/topic-analytics"),
      env,
      {} as ExecutionContext,
    );
    expect(unauthorized.status).toBe(401);

    const response = await customTopicAnalyticsRoute.handler(
      new Request("https://example.com/v1/admin/topic-analytics", {
        headers: { authorization: "Bearer " + OWNER_KEY },
      }),
      env,
      {} as ExecutionContext,
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(await stub.getCustomTopicAnalytics.mock.results[0]?.value);
  });
});
