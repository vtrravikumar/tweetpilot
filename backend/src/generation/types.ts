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
  /** Optional style hint, e.g. "thoughtful". News is a separate content-source option. */
  style?: string;
  /** Explicitly request recent-news-grounded generation. Omitted/false preserves normal generation. */
  useNews?: boolean;
  /** Optional maximum tweet length; a positive integer when present. */
  maxLength?: number;
  /** Set by the server after license verification; never accepted from request JSON. */
  includeAttribution?: boolean;
}

export interface NewsSource {
  title: string;
  publisher: string;
  url: string;
  publishedAt: string;
}

export type GenerationMode = "news" | "normal_fallback";
export type NewsFallbackReason = "no_recent_news" | "news_unavailable";

export interface GenerateTweetResult {
  tweet: string;
  /** Present only when the caller explicitly requested News mode. */
  mode?: GenerationMode;
  /** Present when News mode falls back to ordinary generation. */
  fallbackReason?: NewsFallbackReason;
  /** Traceable article metadata for successful News mode. */
  sources?: NewsSource[];
}

export interface TweetGenerator {
  generate(input: GenerateTweetInput): Promise<GenerateTweetResult>;
}

/**
 * Used only when a request omits maxLength. This is a default, not a limit:
 * providers must honour whatever maxLength the caller supplies.
 */
export const DEFAULT_MAX_LENGTH = 140;

/** V1 product attribution appended to every generated draft. */
export const VICHAR_ATTRIBUTION = "Vichar by vtrrk";
export const VICHAR_ATTRIBUTION_SEPARATOR = "\n";
export const MIN_VICHAR_MAX_LENGTH =
  Array.from("x" + VICHAR_ATTRIBUTION_SEPARATOR + VICHAR_ATTRIBUTION).length;
