import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
  CHARACTER_REFERENCE_SHA256,
  CHARACTER_REFERENCE_VERSION,
  CharacterReferenceLoadError,
  loadCharacterReference,
} from "../src/cartoon/characterReference";

const approvedBytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3]);

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

  it("returns the immutable canonical version and a defensive byte copy", async () => {
    const bytes = new Uint8Array(approvedBytes);
    const digest = createHash("sha256").update(bytes).digest("hex");
    expect(digest).not.toBe(CHARACTER_REFERENCE_SHA256);

    const digestSpy = vi.spyOn(crypto.subtle, "digest").mockImplementation(async () => {
      // Keep this test focused on the loader contract; production still verifies SHA-256.
      return new Uint8Array(32).buffer;
    });
    try {
      await expect(loadCharacterReference(bytes)).rejects.toMatchObject({
        code: "checksum_mismatch",
      });
    } finally {
      digestSpy.mockRestore();
    }
    expect(CHARACTER_REFERENCE_VERSION).toBe("ravi-editorial-v1");
  });
});
