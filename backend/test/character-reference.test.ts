import { describe, expect, it, vi } from "vitest";
import {
  CHARACTER_REFERENCE_SHA256,
  CHARACTER_REFERENCE_VERSION,
  CharacterReferenceLoadError,
  loadCharacterReference,
} from "../src/cartoon/characterReference";

const approvedBytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3]);

function hashBytes(hex: string): ArrayBuffer {
  const bytes = new Uint8Array(hex.match(/.{2}/g)!.map((part) => Number.parseInt(part, 16)));
  return bytes.buffer;
}

describe("loadCharacterReference", () => {
  it("fails closed when the server-side asset is absent", async () => {
    await expect(loadCharacterReference(undefined)).rejects.toMatchObject({
      code: "missing_asset",
    });
  });

  it("rejects bytes that are not a PNG", async () => {
    await expect(loadCharacterReference(new Uint8Array([1, 2, 3]))).rejects.toMatchObject({
      code: "invalid_png",
    });
  });

  it("rejects an asset whose checksum differs from the approved version", async () => {
    await expect(loadCharacterReference(approvedBytes)).rejects.toMatchObject({
      code: "checksum_mismatch",
    });
  });

  it("returns the canonical version and a defensive copy for the approved checksum", async () => {
    const digestSpy = vi.spyOn(crypto.subtle, "digest").mockResolvedValue(hashBytes(CHARACTER_REFERENCE_SHA256));
    try {
      const source = new Uint8Array(approvedBytes);
      const result = await loadCharacterReference(source);
      source[8] = 99;
      expect(result.version).toBe(CHARACTER_REFERENCE_VERSION);
      expect(result.mimeType).toBe("image/png");
      expect(result.bytes[8]).toBe(1);
      expect(result.bytes).not.toBe(source);
    } finally {
      digestSpy.mockRestore();
    }
  });
});
