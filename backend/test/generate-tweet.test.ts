import { exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { PLACEHOLDER_PREFIX } from "../src/generation/placeholder";
import { validateGenerateTweetRequest } from "../src/validation/generateTweet";

const URL_ = "https://example.com/v1/tweet/generate";

function post(body: unknown, init: RequestInit = {}): Promise<Response> {
  return exports.default.fetch(URL_, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
    ...init,
  });
}

async function expectError(
  response: Response,
  status: number,
  code: string,
  messageContains?: string,
) {
  expect(response.status).toBe(status);
  expect(response.headers.get("content-type")).toContain("application/json");
  const json = (await response.json()) as {
    error: { code: string; message: string };
  };
  expect(Object.keys(json)).toEqual(["error"]);
  expect(json.error.code).toBe(code);
  expect(typeof json.error.message).toBe("string");
  if (messageContains) expect(json.error.message).toContain(messageContains);
}

describe("POST /v1/tweet/generate - success", () => {
  it("accepts a valid full request", async () => {
    const response = await post({
      topic: "Photography",
      location: "Chennai",
      style: "thoughtful",
      maxLength: 140,
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
  });

  it("returns exactly { tweet: string } and a non-empty tweet", async () => {
    const response = await post({ topic: "Photography" });
    const json = (await response.json()) as Record<string, unknown>;
    expect(Object.keys(json)).toEqual(["tweet"]);
    expect(typeof json.tweet).toBe("string");
    expect((json.tweet as string).length).toBeGreaterThan(0);
  });

  it("accepts a request with only the required topic", async () => {
    const response = await post({ topic: "Travel" });
    expect(response.status).toBe(200);
  });

  it("is clearly labelled as a placeholder, not AI output", async () => {
    const json = (await (await post({ topic: "Photography" })).json()) as {
      tweet: string;
    };
    expect(json.tweet.startsWith(PLACEHOLDER_PREFIX)).toBe(true);
  });

  it("is deterministic for identical input", async () => {
    const body = { topic: "Photography", location: "Chennai", style: "witty" };
    const a = (await (await post(body)).json()) as { tweet: string };
    const b = (await (await post(body)).json()) as { tweet: string };
    expect(a.tweet).toBe(b.tweet);
  });

  it("reflects topic, location and style in the placeholder text", async () => {
    const json = (await (
      await post({
        topic: "Photography",
        location: "Chennai",
        style: "thoughtful",
        maxLength: 280,
      })
    ).json()) as { tweet: string };
    expect(json.tweet).toContain("Photography");
    expect(json.tweet).toContain("Chennai");
    expect(json.tweet).toContain("thoughtful");
  });

  it("never exceeds maxLength", async () => {
    for (const maxLength of [1, 2, 10, 50, 140]) {
      const json = (await (
        await post({ topic: "Photography", location: "Chennai", maxLength })
      ).json()) as { tweet: string };
      expect(Array.from(json.tweet).length).toBeLessThanOrEqual(maxLength);
    }
  });

  it("trims whitespace around topic", async () => {
    const json = (await (await post({ topic: "  Photography  " })).json()) as {
      tweet: string;
    };
    expect(json.tweet).toContain("Topic: Photography.");
  });

  it("ignores unknown fields", async () => {
    const response = await post({ topic: "Photography", extra: true });
    expect(response.status).toBe(200);
  });

  it("does not reject oversized fields at request validation time", async () => {
    const response = await post({
      topic: "Photography ".repeat(5_000),
      location: "Chennai ".repeat(1_000),
      style: "thoughtful ".repeat(1_000),
    });
    expect(response.status).toBe(200);
  });
});

describe("POST /v1/tweet/generate - topic validation", () => {
  it("rejects a missing topic", async () => {
    await expectError(
      await post({ location: "Chennai" }),
      400,
      "invalid_request",
      "topic",
    );
  });

  it("rejects an empty topic", async () => {
    await expectError(await post({ topic: "" }), 400, "invalid_request", "topic");
  });

  it("rejects a whitespace-only topic", async () => {
    await expectError(
      await post({ topic: "   " }),
      400,
      "invalid_request",
      "topic",
    );
  });

  it.each([123, null, true, ["Photography"], { a: 1 }])(
    "rejects a non-string topic: %j",
    async (topic) => {
      await expectError(await post({ topic }), 400, "invalid_request", "topic");
    },
  );
});

describe("POST /v1/tweet/generate - location validation", () => {
  it.each([123, null, true, ["Chennai"], { a: 1 }])(
    "rejects a non-string location: %j",
    async (location) => {
      await expectError(
        await post({ topic: "Photography", location }),
        400,
        "invalid_request",
        "location",
      );
    },
  );

  it("treats an empty optional location as omitted", async () => {
    const response = await post({ topic: "Photography", location: "   " });
    expect(response.status).toBe(200);
    expect(await response.text()).not.toContain("Location:");
  });
});

describe("POST /v1/tweet/generate - style validation", () => {
  it.each([123, null, false, ["thoughtful"], { a: 1 }])(
    "rejects a non-string style: %j",
    async (style) => {
      await expectError(
        await post({ topic: "Photography", style }),
        400,
        "invalid_request",
        "style",
      );
    },
  );

  it("treats an empty optional style as omitted", async () => {
    const response = await post({ topic: "Photography", style: "   " });
    expect(response.status).toBe(200);
    expect(await response.text()).not.toContain("Style:");
  });
});

describe("POST /v1/tweet/generate - maxLength validation", () => {
  it.each([0, -1, -140, 1.5, "140", null, true, [140], { a: 1 }])(
    "rejects an invalid maxLength: %j",
    async (maxLength) => {
      await expectError(
        await post({ topic: "Photography", maxLength }),
        400,
        "invalid_request",
        "maxLength",
      );
    },
  );

  it("rejects a non-safe integer maxLength", async () => {
    await expectError(
      await post('{"topic":"Photography","maxLength":1e400}'),
      400,
      "invalid_request",
      "maxLength",
    );
  });

  it("accepts the smallest valid maxLength", async () => {
    const response = await post({ topic: "Photography", maxLength: 1 });
    expect(response.status).toBe(200);
  });

  it.each([2, 140, Number.MAX_SAFE_INTEGER])(
    "accepts maxLength boundary value %i",
    async (maxLength) => {
      const result = validateGenerateTweetRequest({ topic: "Photography", maxLength });
      expect(result).toEqual({ ok: true, value: { topic: "Photography", maxLength } });
    },
  );
});

describe("POST /v1/tweet/generate - malformed bodies", () => {
  it("rejects malformed JSON with 400 invalid_json", async () => {
    await expectError(await post("{ not json"), 400, "invalid_json");
  });

  it("rejects an empty body with 400 invalid_json", async () => {
    await expectError(await post(""), 400, "invalid_json");
  });

  it("rejects a missing body with 400 invalid_json", async () => {
    await expectError(await post(undefined), 400, "invalid_json");
  });

  it.each(["null", "[]", '"Photography"', "42", "true"])(
    "rejects a non-object JSON body: %s",
    async (raw) => {
      await expectError(await post(raw), 400, "invalid_request", "JSON object");
    },
  );
});

describe("validateGenerateTweetRequest", () => {
  it("trims supplied strings and ignores unexpected fields", () => {
    expect(
      validateGenerateTweetRequest({
        topic: "  Photography  ",
        location: "  Chennai  ",
        style: "  thoughtful  ",
        maxLength: 280,
        unexpected: "ignored",
      }),
    ).toEqual({
      ok: true,
      value: {
        topic: "Photography",
        location: "Chennai",
        style: "thoughtful",
        maxLength: 280,
      },
    });
  });
});

describe("POST /v1/tweet/generate - wrong HTTP method", () => {
  it.each(["GET", "PUT", "PATCH", "DELETE"])(
    "returns 405 with Allow: POST for %s",
    async (method) => {
      const response = await exports.default.fetch(URL_, { method });
      await expectError(response, 405, "method_not_allowed");
      expect(response.headers.get("allow")).toBe("POST");
    },
  );
});
