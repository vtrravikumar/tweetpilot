export type CartoonImageErrorKind =
  | "not_configured"
  | "upstream_timeout"
  | "upstream_error"
  | "invalid_response"
  | "invalid_input";

export type CartoonImageOutcome = "definitive_failure" | "unknown";

export class CartoonImageError extends Error {
  readonly kind: CartoonImageErrorKind;
  readonly upstreamStatus?: number;
  readonly outcome: CartoonImageOutcome;

  constructor(
    kind: CartoonImageErrorKind,
    message: string,
    upstreamStatus?: number,
    outcome: CartoonImageOutcome = kind === "not_configured" || kind === "invalid_input"
      ? "definitive_failure"
      : "unknown",
  ) {
    super(message);
    this.name = "CartoonImageError";
    this.kind = kind;
    this.upstreamStatus = upstreamStatus;
    this.outcome = outcome;
  }
}
