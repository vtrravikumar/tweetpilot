import { exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

describe("router", () => {
  it("returns a stable JSON 404 for unknown routes", async () => {
    const response = await exports.default.fetch("https://example.com/nope");

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: { code: "not_found", message: "Route not found." },
    });
  });

  it("returns a stable JSON 405 with an Allow header for wrong methods", async () => {
    const response = await exports.default.fetch("https://example.com/health", {
      method: "POST",
    });

    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("GET");
    expect(await response.json()).toEqual({
      error: { code: "method_not_allowed", message: "Method not allowed." },
    });
  });
});
