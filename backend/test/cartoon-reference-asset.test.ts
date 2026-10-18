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
});
