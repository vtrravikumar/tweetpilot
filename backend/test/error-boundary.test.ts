import { describe, expect, it, vi } from "vitest";
import worker from "../src/index";
import { issueVicharWebToken } from "../src/webAuth";

const WEB_SECRET = "test-error-boundary-secret";

describe("Worker error boundary", () => {
  it("returns a sanitized JSON error and logs no exception message or stack", async () => {
    const sensitiveMessage = "secret value and prompt content must not be logged";
    const error = new Error(sensitiveMessage);
    const namespace = {
      idFromName: (id: string) => id,
      get: () => ({
        consumeWebGeneration: async () => ({ allowed: true }),
        checkBurst: async () => { throw error; },
      }),
    };
    const env = {
      VICHAR_WEB_SECRET: WEB_SECRET,
      VICHAR_OWNER_LICENSE_KEY: "vichar_" + "A".repeat(43),
      VICHAR_USAGE: namespace,
      CORS_ALLOWED_ORIGINS: "https://vtrrk.in",
    } as unknown as Env;
    const token = await issueVicharWebToken(WEB_SECRET);
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const response = await worker.fetch(new Request("https://api.example/vichar/v1/tweet/generate", {
        method: "POST",
        headers: {
          Origin: "https://vtrrk.in",
          Authorization: `Bearer ${token}`,
          "CF-Connecting-IP": "203.0.113.55",
          "content-type": "application/json",
        },
        body: JSON.stringify({ topic: "safe test" }),
      }), env, {} as ExecutionContext);
      expect(response.status).toBe(500);
      expect(response.headers.get("access-control-allow-origin")).toBe("https://vtrrk.in");
      expect(await response.json()).toEqual({ error: { code: "internal_error", message: "Internal server error." } });
      expect(log).toHaveBeenCalledWith("request_failed", { name: "Error" });
      expect(JSON.stringify(log.mock.calls)).not.toContain(sensitiveMessage);
    } finally {
      log.mockRestore();
    }
  });
});
