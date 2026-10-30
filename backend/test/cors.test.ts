import { describe, expect, it } from "vitest";
import { parseCorsAllowedOrigins } from "../src/http/cors";
import { handleRequest } from "../src/router";

const ctx = {} as ExecutionContext;
const EXTENSION_ORIGIN = "chrome-extension://abcdefghijklmnopabcdefghijklmnop";
const X_ORIGIN = "https://x.com";
const PREVIEW_ALLOWLIST = "https://*.vtrrk-in.pages.dev";
const PREVIEW_ORIGIN = "https://a2d436ef.vtrrk-in.pages.dev";

function env(values: Record<string, string> = {}): Env {
  return values as unknown as Env;
}

function request(
  path: string,
  init: RequestInit = {},
): Request {
  return new Request(`https://example.com${path}`, init);
}

describe("CORS", () => {
  it("does not emit CORS headers when no origins are configured", async () => {
    const response = await handleRequest(
      request("/health", { headers: { origin: X_ORIGIN } }),
      env(),
      ctx,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBeNull();
    expect(response.headers.get("vary")).toBeNull();
  });

  it("allows an exact configured HTTPS origin on normal responses", async () => {
    const response = await handleRequest(
      request("/health", { headers: { origin: X_ORIGIN } }),
      env({ CORS_ALLOWED_ORIGINS: X_ORIGIN }),
      ctx,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBe(X_ORIGIN);
    expect(response.headers.get("vary")).toBe("Origin");
  });

  it("allows an exact configured Chrome extension origin", async () => {
    const response = await handleRequest(
      request("/health", { headers: { origin: EXTENSION_ORIGIN } }),
      env({ CORS_ALLOWED_ORIGINS: EXTENSION_ORIGIN }),
      ctx,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBe(EXTENSION_ORIGIN);
  });

  it("allows Cloudflare Pages preview and feature-branch origins", async () => {
    for (const origin of [
      PREVIEW_ORIGIN,
      "https://feature-branch.vtrrk-in.pages.dev",
    ]) {
      const response = await handleRequest(
        request("/health", { headers: { origin } }),
        env({ CORS_ALLOWED_ORIGINS: `https://vtrrk.in,${PREVIEW_ALLOWLIST}` }),
        ctx,
      );

      expect(response.status).toBe(200);
      expect(response.headers.get("access-control-allow-origin")).toBe(origin);
      expect(response.headers.get("vary")).toBe("Origin");
    }
  });

  it("rejects unrelated, deceptive, nested, and non-HTTPS preview origins", async () => {
    for (const origin of [
      "https://vtrrk-in.pages.dev",
      "https://vtrrk-in.pages.dev.attacker.com",
      "https://feature.vtrrk-in.pages.dev.attacker.com",
      "https://nested.feature.vtrrk-in.pages.dev",
      "http://feature-branch.vtrrk-in.pages.dev",
      "https://feature-branch.vtrrk-in.pages.dev:8443",
    ]) {
      const response = await handleRequest(
        request("/health", { headers: { origin } }),
        env({ CORS_ALLOWED_ORIGINS: PREVIEW_ALLOWLIST }),
        ctx,
      );

      expect(response.headers.get("access-control-allow-origin")).toBeNull();
    }
  });

  it("answers valid preview preflight requests and reflects the exact origin", async () => {
    const response = await handleRequest(
      request("/v1/tweet/generate", {
        method: "OPTIONS",
        headers: {
          origin: PREVIEW_ORIGIN,
          "access-control-request-method": "POST",
          "access-control-request-headers": "content-type, authorization",
        },
      }),
      env({ CORS_ALLOWED_ORIGINS: PREVIEW_ALLOWLIST }),
      ctx,
    );

    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe(PREVIEW_ORIGIN);
    expect(response.headers.get("access-control-allow-methods")).toBe("POST, OPTIONS");
    expect(response.headers.get("access-control-allow-headers")).toBe("content-type, authorization");
  });

  it("rejects preflight requests from unconfigured origins", async () => {
    const response = await handleRequest(
      request("/v1/tweet/generate", {
        method: "OPTIONS",
        headers: {
          origin: "https://evil.example",
          "access-control-request-method": "POST",
        },
      }),
      env({ CORS_ALLOWED_ORIGINS: EXTENSION_ORIGIN }),
      ctx,
    );

    expect(response.status).toBe(403);
    expect(response.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("rejects preflight requests for unsupported methods or headers", async () => {
    const unsupportedMethod = await handleRequest(
      request("/v1/tweet/generate", {
        method: "OPTIONS",
        headers: {
          origin: EXTENSION_ORIGIN,
          "access-control-request-method": "DELETE",
        },
      }),
      env({ CORS_ALLOWED_ORIGINS: EXTENSION_ORIGIN }),
      ctx,
    );
    expect(unsupportedMethod.status).toBe(403);

    const unsupportedHeader = await handleRequest(
      request("/v1/tweet/generate", {
        method: "OPTIONS",
        headers: {
          origin: EXTENSION_ORIGIN,
          "access-control-request-method": "POST",
          "access-control-request-headers": "x-not-allowed",
        },
      }),
      env({ CORS_ALLOWED_ORIGINS: EXTENSION_ORIGIN }),
      ctx,
    );
    expect(unsupportedHeader.status).toBe(403);

    const supportedHeader = await handleRequest(
      request("/v1/tweet/generate", {
        method: "OPTIONS",
        headers: {
          origin: EXTENSION_ORIGIN,
          "access-control-request-method": "POST",
          "access-control-request-headers": "content-type, authorization",
        },
      }),
      env({ CORS_ALLOWED_ORIGINS: EXTENSION_ORIGIN }),
      ctx,
    );
    expect(supportedHeader.status).toBe(204);
  });

  it("normalizes only safe exact origins and ignores wildcards or paths", () => {
    expect(
      parseCorsAllowedOrigins(
        [
          X_ORIGIN,
          `${EXTENSION_ORIGIN}/`,
          "*",
          PREVIEW_ALLOWLIST,
          "https://x.com/path",
          "javascript:alert(1)",
          "chrome-extension://short",
        ].join(","),
      ),
    ).toEqual(new Set([X_ORIGIN, EXTENSION_ORIGIN]));
  });
});
