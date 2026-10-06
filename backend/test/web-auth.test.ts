import { describe, expect, it } from "vitest";
import {
  issueVicharWebToken,
  isValidVicharWebToken,
} from "../src/webAuth";

const SECRET = "test-web-secret";
const NOW = Date.UTC(2026, 9, 6, 9, 0, 0);

describe("Vichar web authentication", () => {
  it("issues a token that validates with the same secret", async () => {
    const token = await issueVicharWebToken(SECRET, NOW);
    const request = new Request("https://tweetpilot-api.vtrravikumar.workers.dev/v1/tweet/generate", {
      method: "POST",
      headers: {
        Origin: "https://vtrrk.in",
        Authorization: `Bearer ${token}`,
      },
    });

    await expect(isValidVicharWebToken(request, SECRET, NOW)).resolves.toBe(true);
  });

  it("rejects a token signed with a different secret", async () => {
    const token = await issueVicharWebToken(SECRET, NOW);
    const request = new Request("https://tweetpilot-api.vtrravikumar.workers.dev/v1/tweet/generate", {
      method: "POST",
      headers: {
        Origin: "https://vtrrk.in",
        Authorization: `Bearer ${token}`,
      },
    });

    await expect(isValidVicharWebToken(request, "wrong-secret", NOW)).resolves.toBe(false);
  });

  it("rejects a token from a different origin", async () => {
    const token = await issueVicharWebToken(SECRET, NOW);
    const request = new Request("https://tweetpilot-api.vtrravikumar.workers.dev/v1/tweet/generate", {
      method: "POST",
      headers: {
        Origin: "https://evil.example",
        Authorization: `Bearer ${token}`,
      },
    });

    await expect(isValidVicharWebToken(request, SECRET, NOW)).resolves.toBe(false);
  });

  it("rejects an expired token", async () => {
    const token = await issueVicharWebToken(SECRET, NOW);
    const request = new Request("https://tweetpilot-api.vtrravikumar.workers.dev/v1/tweet/generate", {
      method: "POST",
      headers: {
        Origin: "https://vtrrk.in",
        Authorization: `Bearer ${token}`,
      },
    });

    await expect(
      isValidVicharWebToken(request, SECRET, NOW + 10 * 60 * 1000),
    ).resolves.toBe(false);
  });
});
