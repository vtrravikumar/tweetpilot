import { describe, expect, it } from "vitest";
import {
  issueVicharWebToken,
  isValidVicharWebToken,
  isVicharWebOrigin,
} from "../src/webAuth";

const SECRET = "test-web-secret";
const NOW = Date.UTC(2026, 9, 6, 9, 0, 0);

function webRequest(origin: string, token?: string): Request {
  return new Request("https://tweetpilot-api.vtrravikumar.workers.dev/v1/tweet/generate", {
    method: "POST",
    headers: {
      Origin: origin,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}

async function signedToken(payload: Record<string, unknown>): Promise<string> {
  const encoded = btoa(JSON.stringify(payload)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(encoded));
  const bytes = String.fromCharCode(...new Uint8Array(signature));
  return `${encoded}.${btoa(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")}`;
}

describe("Vichar web origin validation", () => {
  it("allows the production website origin", () => {
    expect(isVicharWebOrigin(webRequest("https://vtrrk.in"))).toBe(true);
  });

  it.each([
    "https://a2d436ef.vtrrk-in.pages.dev",
    "https://feature-branch-123.vtrrk-in.pages.dev",
  ])("allows a trusted Cloudflare Pages preview origin: %s", (origin) => {
    expect(isVicharWebOrigin(webRequest(origin))).toBe(true);
  });

  it.each([
    "https://vtrrk-in.pages.dev",
    "https://a2d436ef.vtrrk-in.pages.dev.evil.example",
    "https://nested.a2d436ef.vtrrk-in.pages.dev",
    "http://a2d436ef.vtrrk-in.pages.dev",
    "https://a2d436ef.vtrrk-in.pages.dev:8443",
    "https://evil.example",
  ])("rejects an untrusted or malformed origin: %s", (origin) => {
    expect(isVicharWebOrigin(webRequest(origin))).toBe(false);
  });
});

describe("Vichar web authentication", () => {
  it("issues a token that validates for the production website", async () => {
    const token = await issueVicharWebToken(SECRET, NOW);
    await expect(isValidVicharWebToken(webRequest("https://vtrrk.in", token), SECRET, NOW))
      .resolves.toBe(true);
  });

  it("issues a token that validates for a trusted Cloudflare Pages preview", async () => {
    const token = await issueVicharWebToken(SECRET, NOW);
    await expect(isValidVicharWebToken(
      webRequest("https://a2d436ef.vtrrk-in.pages.dev", token),
      SECRET,
      NOW,
    )).resolves.toBe(true);
  });

  it("rejects a token signed with a different secret", async () => {
    const token = await issueVicharWebToken(SECRET, NOW);
    await expect(isValidVicharWebToken(
      webRequest("https://vtrrk.in", token),
      "wrong-secret",
      NOW,
    )).resolves.toBe(false);
  });

  it("rejects a token from a different origin", async () => {
    const token = await issueVicharWebToken(SECRET, NOW);
    await expect(isValidVicharWebToken(
      webRequest("https://evil.example", token),
      SECRET,
      NOW,
    )).resolves.toBe(false);
  });

  it("rejects an expired token", async () => {
    const token = await issueVicharWebToken(SECRET, NOW);
    await expect(isValidVicharWebToken(
      webRequest("https://vtrrk.in", token),
      SECRET,
      NOW + 10 * 60 * 1000,
    )).resolves.toBe(false);
  });

  it("rejects a token issued in the future", async () => {
    const token = await issueVicharWebToken(SECRET, NOW + 1_000);
    await expect(isValidVicharWebToken(webRequest("https://vtrrk.in", token), SECRET, NOW)).resolves.toBe(false);
  });

  it("rejects a signed token whose lifetime exceeds the maximum", async () => {
    const iat = Math.floor(NOW / 1000);
    const token = await signedToken({ aud: "vichar-web", iat, exp: iat + 601 });
    await expect(isValidVicharWebToken(webRequest("https://vtrrk.in", token), SECRET, NOW)).resolves.toBe(false);
  });
});
