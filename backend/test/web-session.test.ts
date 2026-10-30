import { env } from "cloudflare:workers";
import { afterEach, describe, expect, it, vi } from "vitest";
import { webSessionRoute } from "../src/routes/webSession";
import { isValidVicharWebToken } from "../src/webAuth";

const SECRET = "test-web-session-secret";
const TURNSTILE_SECRET = "test-turnstile-secret";
const ctx = {} as ExecutionContext;

function request(turnstileToken?: string, ip = `203.0.113.${Math.floor(Math.random() * 200) + 1}`): Request {
  return new Request("https://api.example/vichar/v1/web/session", {
    method: "POST",
    headers: {
      Origin: "https://vtrrk.in",
      "CF-Connecting-IP": ip,
      "content-type": "application/json",
    },
    body: JSON.stringify(turnstileToken === undefined ? {} : { turnstileToken }),
  });
}

function testEnv(values: Record<string, string> = {}): Env {
  return {
    ...env,
    VICHAR_WEB_SECRET: SECRET,
    TURNSTILE_SECRET_KEY: TURNSTILE_SECRET,
    VICHAR_WEB_SESSION_PER_MINUTE: "10",
    ...values,
  } as unknown as Env;
}

function siteverify(success: boolean, hostname = "vtrrk.in", action = "vichar_web_session") {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ success, hostname, action }), {
    status: 200,
    headers: { "content-type": "application/json" },
  })));
}

afterEach(() => vi.unstubAllGlobals());

describe("Vichar web session Turnstile gate", () => {
  it("does not mint a session from a forged allowed Origin without successful server verification", async () => {
    siteverify(false);
    const response = await webSessionRoute.handler(request("forged-token"), testEnv(), ctx);
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ error: { code: "verification_failed" } });
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = vi.mocked(fetch).mock.calls[0]!;
    expect(String(url)).toContain("challenges.cloudflare.com/turnstile/v0/siteverify");
    expect(String(init?.body)).toContain("test-turnstile-secret");
  });

  it("rejects a missing token without calling Siteverify", async () => {
    siteverify(true);
    const response = await webSessionRoute.handler(request(), testEnv(), ctx);
    expect(response.status).toBe(400);
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });

  it("issues a session only after Siteverify accepts the hostname and action", async () => {
    siteverify(true);
    const response = await webSessionRoute.handler(request(`valid-${crypto.randomUUID()}`), testEnv(), ctx);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const payload = await response.json() as { token: string; expiresIn: number };
    expect(payload.expiresIn).toBe(600);
    await expect(isValidVicharWebToken(new Request("https://api.example", {
      headers: { Origin: "https://vtrrk.in", Authorization: `Bearer ${payload.token}` },
    }), SECRET)).resolves.toBe(true);
  });

  it.each([
    ["expired", false, "vtrrk.in", "vichar_web_session"],
    ["wrong host", true, "evil.example", "vichar_web_session"],
    ["wrong action", true, "vtrrk.in", "other_action"],
  ])("rejects %s Turnstile verification", async (_label, success, hostname, action) => {
    siteverify(Boolean(success), String(hostname), String(action));
    const response = await webSessionRoute.handler(request(`invalid-${crypto.randomUUID()}`), testEnv(), ctx);
    expect(response.status).toBe(403);
  });

  it("rejects reuse of a Turnstile response token", async () => {
    siteverify(true);
    const token = `single-use-${crypto.randomUUID()}`;
    const first = await webSessionRoute.handler(request(token), testEnv(), ctx);
    const second = await webSessionRoute.handler(request(token), testEnv(), ctx);
    expect(first.status).toBe(200);
    expect(second.status).toBe(403);
  });

  it("rate limits session issuance per IP", async () => {
    siteverify(true);
    const ip = `198.51.100.${Math.floor(Math.random() * 200) + 1}`;
    const settings = testEnv({ VICHAR_WEB_SESSION_PER_MINUTE: "1" });
    const first = await webSessionRoute.handler(request(`rate-a-${crypto.randomUUID()}`, ip), settings, ctx);
    const second = await webSessionRoute.handler(request(`rate-b-${crypto.randomUUID()}`, ip), settings, ctx);
    expect(first.status).toBe(200);
    expect(second.status).toBe(429);
  });

  it("fails closed if Turnstile or Durable Objects are unavailable", async () => {
    const missingSecret = await webSessionRoute.handler(request("token"), testEnv({ TURNSTILE_SECRET_KEY: "" }), ctx);
    expect(missingSecret.status).toBe(503);
    const noNamespace = await webSessionRoute.handler(request("token"), {
      VICHAR_WEB_SECRET: SECRET,
      TURNSTILE_SECRET_KEY: TURNSTILE_SECRET,
    } as unknown as Env, ctx);
    expect(noNamespace.status).toBe(503);
  });
});
