import bundledReference from "./assets/ravi-editorial-v1.png";
import { loadCharacterReference } from "./characterReference";
import type { CharacterReference } from "./types";

let validatedReference: Promise<CharacterReference> | undefined;

/**
 * Load the canonical PNG bundled into the Worker as binary data. The asset
 * path/version is fixed in source; callers cannot choose an arbitrary file or URL.
 * Cache validation, but return fresh bytes so a caller cannot mutate the cache.
 */
export async function getCharacterReference(): Promise<CharacterReference> {
  validatedReference ??= loadCharacterReference(bundledReference);
  const reference = await validatedReference;
  return { ...reference, bytes: new Uint8Array(reference.bytes) };
}
