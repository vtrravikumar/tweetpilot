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
});
