import { describe, expect, it } from "vitest";
import { isValidVicharWebToken, isVicharWebOrigin, issueVicharWebToken } from "../src/webAuth";

const SECRET = "local-web-auth-test-secret";
const LOCAL_ORIGIN = "http://localhost:4321";

function request(origin: string, token?: string): Request {
  return new Request("http://localhost:8787/vichar/v1/web/session", {
    method: "POST",
    headers: {
      origin,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  });
}

describe("Vichar web origin policy", () => {
  it("always accepts the exact production origin", () => {
    expect(isVicharWebOrigin(request("https://vtrrk.in"))).toBe(true);
  });

  it("rejects local origins unless the explicit development flag is enabled", () => {
    expect(isVicharWebOrigin(request(LOCAL_ORIGIN))).toBe(false);
    expect(isVicharWebOrigin(request(LOCAL_ORIGIN, undefined), {
      VICHAR_ALLOW_LOCAL_WEB_ORIGIN: "false",
    } as { VICHAR_ALLOW_LOCAL_WEB_ORIGIN: string })).toBe(false);
    expect(isVicharWebOrigin(request(LOCAL_ORIGIN), {
      VICHAR_ALLOW_LOCAL_WEB_ORIGIN: "true",
    } as { VICHAR_ALLOW_LOCAL_WEB_ORIGIN: string })).toBe(true);
  });

  it("does not allow arbitrary origins even when local testing is enabled", () => {
    expect(isVicharWebOrigin(request("https://evil.example"), {
      VICHAR_ALLOW_LOCAL_WEB_ORIGIN: "true",
    } as { VICHAR_ALLOW_LOCAL_WEB_ORIGIN: string })).toBe(false);
  });

  it("validates local web tokens only when local testing is explicitly enabled", async () => {
    const token = await issueVicharWebToken(SECRET);
    const localRequest = request(LOCAL_ORIGIN, token);

    expect(await isValidVicharWebToken(localRequest, SECRET)).toBe(false);
    expect(await isValidVicharWebToken(localRequest, SECRET, Date.now(), {
      VICHAR_ALLOW_LOCAL_WEB_ORIGIN: "true",
    } as { VICHAR_ALLOW_LOCAL_WEB_ORIGIN: string })).toBe(true);
    expect(await isValidVicharWebToken(request("https://evil.example", token), SECRET, Date.now(), {
      VICHAR_ALLOW_LOCAL_WEB_ORIGIN: "true",
    } as { VICHAR_ALLOW_LOCAL_WEB_ORIGIN: string })).toBe(false);
  });
});
