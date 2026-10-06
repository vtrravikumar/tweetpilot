import {
  MIN_VICHAR_MAX_LENGTH,
  type GenerateTweetInput,
} from "../generation/types";

export type ValidationResult =
  | { ok: true; value: GenerateTweetInput }
  | { ok: false; message: string };

/**
 * Validates the parsed JSON body of POST /v1/tweet/generate.
 *
 * - topic: required, non-empty string (surrounding whitespace is trimmed).
 * - location, style: optional; when present they must be strings. A string
 *   that is empty after trimming is treated as not supplied.
 * - maxLength: optional; when present it must be a positive safe integer.
 * - Unknown fields are ignored so the contract can grow without breaking
 *   existing clients.
 */
export function validateGenerateTweetRequest(body: unknown): ValidationResult {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return fail("Request body must be a JSON object.");
  }
  const input = body as Record<string, unknown>;

  const topic = input.topic;
  if (typeof topic !== "string" || topic.trim() === "") {
    return fail("topic is required and must be a non-empty string.");
  }

  const location = optionalString(input, "location");
  if (!location.ok) return location;

  const style = optionalString(input, "style");
  if (!style.ok) return style;

  const maxLength = input.maxLength;
  if (
    maxLength !== undefined &&
    (typeof maxLength !== "number" ||
      !Number.isSafeInteger(maxLength) ||
      maxLength < MIN_VICHAR_MAX_LENGTH)
  ) {
    return fail(`maxLength must be an integer of at least ${MIN_VICHAR_MAX_LENGTH} characters when supplied.`);
  }

  const value: GenerateTweetInput = { topic: topic.trim() };
  if (location.value !== undefined) value.location = location.value;
  if (style.value !== undefined) value.style = style.value;
  if (maxLength !== undefined) value.maxLength = maxLength;
  return { ok: true, value };
}

function optionalString(
  input: Record<string, unknown>,
  field: "location" | "style",
): { ok: true; value: string | undefined } | { ok: false; message: string } {
  const raw = input[field];
  if (raw === undefined) return { ok: true, value: undefined };
  if (typeof raw !== "string") {
    return fail(`${field} must be a string when supplied.`);
  }
  const trimmed = raw.trim();
  return { ok: true, value: trimmed === "" ? undefined : trimmed };
}

function fail(message: string): { ok: false; message: string } {
  return { ok: false, message };
}
