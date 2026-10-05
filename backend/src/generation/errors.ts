/**
 * Provider-agnostic generation failures.
 *
 * Providers throw GenerationError; the HTTP layer maps `kind` to a stable API
 * error. Messages here are internal and must never contain secrets or raw
 * upstream payloads - the route never sends them to the client.
 */
export type GenerationErrorKind =
  /** Missing/rejected credentials or other server-side misconfiguration. */
  | "not_configured"
  /** The upstream service failed or returned a non-success status. */
  | "upstream_error"
  /** The upstream service did not answer in time. */
  | "upstream_timeout"
  /** The upstream answered, but the output is unusable (empty, malformed, too long, disallowed link). */
  | "invalid_output";

export class GenerationError extends Error {
  readonly kind: GenerationErrorKind;
  /** Upstream HTTP status, when one exists. Safe to log. */
  readonly upstreamStatus: number | undefined;

  constructor(
    kind: GenerationErrorKind,
    message: string,
    upstreamStatus?: number,
  ) {
    super(message);
    this.name = "GenerationError";
    this.kind = kind;
    this.upstreamStatus = upstreamStatus;
  }
}
