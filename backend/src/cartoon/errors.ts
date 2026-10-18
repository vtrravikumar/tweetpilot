export type CartoonImageErrorKind =
  | "not_configured"
  | "upstream_timeout"
  | "upstream_error"
  | "invalid_response"
  | "invalid_input";

export class CartoonImageError extends Error {
  readonly kind: CartoonImageErrorKind;
  readonly upstreamStatus?: number;

  constructor(kind: CartoonImageErrorKind, message: string, upstreamStatus?: number) {
    super(message);
    this.name = "CartoonImageError";
    this.kind = kind;
    this.upstreamStatus = upstreamStatus;
  }
}
