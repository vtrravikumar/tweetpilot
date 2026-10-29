import { describe, expect, it, vi } from "vitest";
import { customTopicCountRoute } from "../src/routes/customTopicCount";

describe("public custom-topic count route", () => {
  it("returns only the 90-day aggregate count with cache headers", async () => {
    const getCustomTopicAnalytics = vi.fn(() => ({
      windowDays: 90,
      totalEvents: 12,
      uniqueTopicCount: 9,
      topTopics: [{ topic: "hidden topic", count: 3, languages: ["en"], sourceApps: ["vichar-web"] }],
      topics: [],
      languages: [],
      sourceApps: [],
      weekly: [],
    }));
    const env = {
      VICHAR_USAGE: {
        idFromName: (name: string) => name,
        get: (id: string) => {
          expect(id).toBe("global-vichar-stats");
          return { getCustomTopicAnalytics };
        },
      },
    } as unknown as Env;

    const response = await customTopicCountRoute.handler(new Request("https://example.com/v1/stats/custom-topics"), env, {} as ExecutionContext);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ totalEvents: 12, periodDays: 90 });
    expect(response.headers.get("cache-control")).toContain("s-maxage=60");
    expect(getCustomTopicAnalytics).toHaveBeenCalledOnce();
  });

  it("returns a service-unavailable response if the counter binding is absent", async () => {
    const response = await customTopicCountRoute.handler(new Request("https://example.com/v1/stats/custom-topics"), {} as Env, {} as ExecutionContext);
    expect(response.status).toBe(503);
  });
});
