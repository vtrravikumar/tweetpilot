import { describe, expect, it, vi } from "vitest";
import { CartoonImageError } from "../src/cartoon/errors";
import { generateCartoonWithCredits } from "../src/cartoon/generateCartoon";
import type { CartoonCreditLedger } from "../src/cartoon/generateCartoon";
import type { CartoonImageProvider, GenerateCartoonResult } from "../src/cartoon/types";

const image: GenerateCartoonResult = {
  bytes: new Uint8Array([1, 2, 3]),
  mimeType: "image/png",
  model: "test-model",
  characterReferenceVersion: "ravi-editorial-v1",
  durationMs: 10,
};

function setup(overrides: Partial<CartoonCreditLedger> = {}, providerGenerate = vi.fn(async () => image)) {
  const ledger: CartoonCreditLedger = {
    reserveImageCredits: vi.fn(async () => ({ reserved: true, status: "reserved", balance: 4, created: true })),
    startImageGeneration: vi.fn(async () => ({ started: true, status: "processing" })),
    commitImageCredits: vi.fn(async () => true),
    markImageGenerationUnknown: vi.fn(async () => true),
    failImageGeneration: vi.fn(async () => ({ released: true, balance: 5 })),
    releaseImageCredits: vi.fn(async () => ({ released: true, balance: 5 })),
    ...overrides,
  };
  const provider: CartoonImageProvider = { generate: providerGenerate };
  const run = () => generateCartoonWithCredits({
    operationId: "operation-1",
    credits: 2,
    thought: "A dry-witted thought.",
    safetyIdentifier: "sha256:test",
    characterReference: {
      version: "ravi-editorial-v1",
      bytes: new Uint8Array([1]),
      mimeType: "image/png",
    },
    provider,
    ledger,
  });
  return { ledger, providerGenerate, run };
}

describe("generateCartoonWithCredits", () => {
  it("reserves, claims once, generates, and commits", async () => {
    const { ledger, providerGenerate, run } = setup();
    const result = await run();
    expect(result).toEqual({ status: "generated", image });
    expect(ledger.reserveImageCredits).toHaveBeenCalledWith("operation-1", 2);
    expect(ledger.startImageGeneration).toHaveBeenCalledWith("operation-1");
    expect(providerGenerate).toHaveBeenCalledTimes(1);
    expect(ledger.commitImageCredits).toHaveBeenCalledWith("operation-1");
  });

  it("does not call provider when credits cannot be reserved", async () => {
    const { ledger, providerGenerate, run } = setup({
      reserveImageCredits: vi.fn(async () => ({
        reserved: false, status: "insufficient", balance: 1, created: false,
      })),
    });
    expect(await run()).toEqual({ status: "credits_unavailable", reason: "insufficient", balance: 1 });
    expect(providerGenerate).not.toHaveBeenCalled();
    expect(ledger.startImageGeneration).not.toHaveBeenCalled();
  });

  it("does not retry a reservation already marked processing", async () => {
    const { ledger, providerGenerate, run } = setup({
      reserveImageCredits: vi.fn(async () => ({
        reserved: false, status: "processing", balance: 3, created: false,
      })),
    });
    expect(await run()).toEqual({ status: "already_in_progress", reason: "processing" });
    expect(providerGenerate).not.toHaveBeenCalled();
    expect(ledger.startImageGeneration).not.toHaveBeenCalled();
  });

  it("does not call provider when the operation was already claimed", async () => {
    const { ledger, providerGenerate, run } = setup({
      startImageGeneration: vi.fn(async () => ({ started: false, status: "processing" })),
    });
    expect(await run()).toEqual({ status: "already_in_progress", reason: "processing" });
    expect(providerGenerate).not.toHaveBeenCalled();
    expect(ledger.failImageGeneration).not.toHaveBeenCalled();
    expect(ledger.releaseImageCredits).not.toHaveBeenCalled();
  });

  it("releases credits after a definite provider failure", async () => {
    const providerGenerate = vi.fn(async () => {
      throw new CartoonImageError("not_configured", "Image generation is not configured.");
    });
    const { ledger, run } = setup({}, providerGenerate);
    expect(await run()).toEqual({ status: "failed", reason: "not_configured", creditsReleased: true });
    expect(ledger.failImageGeneration).toHaveBeenCalledWith("operation-1");
    expect(ledger.markImageGenerationUnknown).not.toHaveBeenCalled();
  });

  it("keeps credits reserved when the provider outcome is uncertain", async () => {
    const providerGenerate = vi.fn(async () => {
      throw new CartoonImageError("upstream_timeout", "Timed out.");
    });
    const { ledger, run } = setup({}, providerGenerate);
    expect(await run()).toEqual({ status: "outcome_unknown", reason: "upstream_timeout" });
    expect(ledger.markImageGenerationUnknown).toHaveBeenCalledWith("operation-1");
    expect(ledger.failImageGeneration).not.toHaveBeenCalled();
  });

  it("does not refund if generation succeeds but credit commit cannot be confirmed", async () => {
    const { ledger, run } = setup({
      commitImageCredits: vi.fn(async () => false),
    });
    expect(await run()).toEqual({
      status: "outcome_unknown",
      reason: "image_created_accounting_unconfirmed",
    });
    expect(ledger.markImageGenerationUnknown).toHaveBeenCalledWith("operation-1");
    expect(ledger.failImageGeneration).not.toHaveBeenCalled();
  });
});
