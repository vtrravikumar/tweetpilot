import { describe, expect, it, vi } from "vitest";
import { statsRoute } from "../src/routes/stats";

describe("Vichar public stats route", () => {
  it("returns the shared global generation count", async () => {
    const getGlobalGenerationCount = vi.fn(() => 527);
    const env = {
      VICHAR_USAGE: {
        idFromName: (name: string) => name,
        get: (id: string) => {
          expect(id).toBe("global-vichar-stats");
          return { getGlobalGenerationCount };
        },
      },
    } as unknown as Env;

    const response = await statsRoute.handler(new Request("https://example.com/v1/stats"), env, {} as ExecutionContext);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ generations: 527 });
    expect(getGlobalGenerationCount).toHaveBeenCalledOnce();
  });

  it("returns a service-unavailable response if the counter binding is absent", async () => {
    const response = await statsRoute.handler(new Request("https://example.com/v1/stats"), {} as Env, {} as ExecutionContext);
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: { code: "stats_unavailable", message: "Vichar statistics are temporarily unavailable." },
    });
  });
});
