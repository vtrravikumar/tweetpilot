import { afterEach, beforeEach, vi } from "vitest";

/**
 * Safety net: any test that reaches the network without explicitly stubbing
 * fetch fails loudly. This guarantees the real OpenAI API is never called.
 * Tests that need fetch install their own mock with vi.stubGlobal / fetchImpl.
 */
beforeEach(() => {
  vi.stubGlobal("fetch", () =>
    Promise.reject(new Error("Real network calls are blocked in tests.")),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});
