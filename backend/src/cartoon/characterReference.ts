import type { CharacterReference } from "./types";

export const CHARACTER_REFERENCE_VERSION = "ravi-editorial-v1" as const;
export const CHARACTER_REFERENCE_MIME_TYPE = "image/png" as const;
export const CHARACTER_REFERENCE_SHA256 =
  "b94c5555c1322351cce23c7ce73e2004efd7ecb54b5d07b2956d13c2392aa7bc" as const;

const PNG_SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

export type CharacterReferenceLoadErrorCode =
  | "missing_asset"
  | "invalid_png"
  | "checksum_mismatch";

export class CharacterReferenceLoadError extends Error {
  constructor(readonly code: CharacterReferenceLoadErrorCode, message: string) {
    super(message);
    this.name = "CharacterReferenceLoadError";
  }
}

/**
 * Validates bytes supplied by the server's bundling layer and returns the
 * canonical reference. This function deliberately accepts bytes, not a path or
 * URL, so request data cannot select or replace the reference asset.
 */
export async function loadCharacterReference(
  assetBytes: Uint8Array | ArrayBuffer | null | undefined,
): Promise<CharacterReference> {
  if (!assetBytes || (assetBytes instanceof Uint8Array && assetBytes.byteLength === 0) ||
      (assetBytes instanceof ArrayBuffer && assetBytes.byteLength === 0)) {
    throw new CharacterReferenceLoadError("missing_asset", "Character reference asset is missing.");
  }

  const bytes = assetBytes instanceof Uint8Array
    ? new Uint8Array(assetBytes)
    : new Uint8Array(assetBytes);

  if (bytes.byteLength < PNG_SIGNATURE.byteLength ||
      !PNG_SIGNATURE.every((byte, index) => bytes[index] === byte)) {
    throw new CharacterReferenceLoadError("invalid_png", "Character reference is not a valid PNG asset.");
  }

  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const actualHash = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");

  if (actualHash !== CHARACTER_REFERENCE_SHA256) {
    throw new CharacterReferenceLoadError(
      "checksum_mismatch",
      "Character reference checksum does not match the approved version.",
    );
  }

  return {
    version: CHARACTER_REFERENCE_VERSION,
    bytes,
    mimeType: CHARACTER_REFERENCE_MIME_TYPE,
  };
}
