/** Provider-neutral contract for Vichar cartoon generation. Not wired to an HTTP route. */

export type CartoonImageSize = "1024x1024" | "1536x1024" | "1024x1536";
export type CartoonImageQuality = "low" | "medium" | "high";

export interface CharacterReference {
  /** Immutable server-selected reference version, never supplied as a URL by the client. */
  version: string;
  bytes: Uint8Array;
  mimeType: "image/png" | "image/jpeg" | "image/webp";
}

export interface GenerateCartoonInput {
  thought: string;
  characterReference: CharacterReference;
  operationId: string;
  /** Stable, privacy-preserving user identifier; do not pass raw email or username. */
  safetyIdentifier: string;
  size?: CartoonImageSize;
  quality?: CartoonImageQuality;
}

export interface GenerateCartoonResult {
  bytes: Uint8Array;
  mimeType: "image/png";
  model: string;
  characterReferenceVersion: string;
  durationMs: number;
}

export interface CartoonImageProvider {
  generate(input: GenerateCartoonInput): Promise<GenerateCartoonResult>;
}
