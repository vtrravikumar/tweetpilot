import { describe, expect, it } from "vitest";
import { CHARACTER_REFERENCE_SHA256, CHARACTER_REFERENCE_VERSION } from "../src/cartoon/characterReference";
import { getCharacterReference } from "../src/cartoon/characterReferenceAsset";

describe("bundled character reference asset", () => {
  it("loads the committed reference and verifies its approved checksum", async () => {
    const reference = await getCharacterReference();
    expect(reference.version).toBe(CHARACTER_REFERENCE_VERSION);
    expect(reference.mimeType).toBe("image/png");
    expect(reference.bytes.byteLength).toBeGreaterThan(1_000_000);
    const digest = await crypto.subtle.digest("SHA-256", reference.bytes);
    const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
    expect(hash).toBe(CHARACTER_REFERENCE_SHA256);
  });

  it("returns independent byte buffers to callers", async () => {
    const first = await getCharacterReference();
    const second = await getCharacterReference();
    expect(first.bytes).not.toBe(second.bytes);
    expect(first.bytes.byteLength).toBe(second.bytes.byteLength);
  });
});
