/**
 * Service boundary for tweet generation.
 *
 * The HTTP layer (routes + validation) depends only on this interface.
 * M2.3 replaces the temporary placeholder with an OpenAI-backed provider
 * that implements the same interface, without changing the HTTP contract.
 */

export interface GenerateTweetInput {
  /** Required, non-empty (already trimmed by validation). */
  topic: string;
  /** Optional free-text context, not precise location tracking. */
  location?: string;
  /** Optional style hint, e.g. "thoughtful". */
  style?: string;
  /** Optional maximum tweet length; a positive integer when present. */
  maxLength?: number;
}

export interface GenerateTweetResult {
  tweet: string;
}

export interface TweetGenerator {
  generate(input: GenerateTweetInput): Promise<GenerateTweetResult>;
}
