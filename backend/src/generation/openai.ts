import { GenerationError } from "./errors";
import {
  findDisallowedLinks,
  selectVtrrkLink,
  type VtrrkLinks,
} from "./links";
import { PERSONALIZATION_INSTRUCTIONS } from "./personalization";
import {
  DEFAULT_MAX_LENGTH,
  VICHAR_ATTRIBUTION,
  VICHAR_ATTRIBUTION_SEPARATOR,
  type GenerateTweetInput,
  type GenerateTweetResult,
  type TweetGenerator,
} from "./types";

/**
 * OpenAI-backed TweetGenerator (M2.3).
 *
 * Uses the Responses API over plain fetch - no SDK, no extra dependency.
 *
 * Cost controls:
 *  - cheap default model, overridable without a code change;
 *  - reasoning effort "none" by default so output tokens are not spent on
 *    hidden reasoning (a reasoning model with a small output cap can
 *    otherwise return nothing);
 *  - compact instructions, one call per tweet, and an output-token cap
 *    derived from maxLength (never "generate big, then truncate");
 *  - at most `maxLengthRetries` extra call(s), and only when the output
 *    breaks the length or link rules. Upstream failures are never retried.
 */

/** Budget tier OpenAI recommends for cost-sensitive work (checked Oct 2026). */
export const DEFAULT_OPENAI_MODEL = "gpt-5.6-luna";
export const DEFAULT_REASONING_EFFORT = "none";
export const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_OUTPUT_TOKENS_CEILING = 400;
const DEFAULT_MAX_LENGTH_RETRIES = 1;
/** The Responses API rejects max_output_tokens below 16. */
const MIN_OUTPUT_TOKENS = 16;
/** Skip the link when the URL would leave too little room for the tweet. */
const MIN_ROOM_FOR_TEXT = 40;
/** Cap per-field prompt input so an oversized field cannot inflate cost. */
const MAX_FIELD_CHARS = 200;

export interface OpenAIProviderOptions {
  /** Server-side secret. Never logged, never returned, never put in errors. */
  apiKey: string;
  model?: string;
  /** Sent as reasoning.effort. null omits the field (for non-reasoning models). */
  reasoningEffort?: string | null;
  timeoutMs?: number;
  /** Hard ceiling on max_output_tokens regardless of maxLength. */
  maxOutputTokensCeiling?: number;
  /** Extra attempts allowed when output is too long / has a disallowed link. */
  maxLengthRetries?: number;
  /** Configured VTRRK links; empty/omitted means no links are ever offered. */
  links?: VtrrkLinks;
  /** Injected in tests so the real API is never called. */
  fetchImpl?: typeof fetch;
}

export class OpenAIProvider implements TweetGenerator {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly reasoningEffort: string | null;
  private readonly timeoutMs: number;
  private readonly maxOutputTokensCeiling: number;
  private readonly maxLengthRetries: number;
  private readonly links: VtrrkLinks;
  private readonly fetchImpl: typeof fetch | undefined;

  constructor(options: OpenAIProviderOptions) {
    if (!options.apiKey) {
      throw new GenerationError("not_configured", "OpenAI API key is missing.");
    }
    this.apiKey = options.apiKey;
    this.model = options.model || DEFAULT_OPENAI_MODEL;
    this.reasoningEffort =
      options.reasoningEffort === undefined
        ? DEFAULT_REASONING_EFFORT
        : options.reasoningEffort;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.maxOutputTokensCeiling =
      options.maxOutputTokensCeiling ?? DEFAULT_MAX_OUTPUT_TOKENS_CEILING;
    this.maxLengthRetries = Math.max(
      0,
      options.maxLengthRetries ?? DEFAULT_MAX_LENGTH_RETRIES,
    );
    this.links = options.links ?? {};
    this.fetchImpl = options.fetchImpl;
  }

  async generate(input: GenerateTweetInput): Promise<GenerateTweetResult> {
    const maxLength = input.maxLength ?? DEFAULT_MAX_LENGTH;
    const link = this.pickLink(input.topic, maxLength);
    const maxOutputTokens = outputTokenBudget(
      maxLength,
      this.maxOutputTokensCeiling,
    );

    let feedback: string | undefined;
    for (let attempt = 0; attempt <= this.maxLengthRetries; attempt++) {
      const prompt = buildPrompt({ input, maxLength, link, feedback });
      const raw = await this.callOpenAI(prompt, maxOutputTokens);
      const normalized = normalizeTweet(raw);
      if (normalized === "") {
        throw new GenerationError("invalid_output", "Model returned empty text.");
      }

      const tweet = withVicharAttribution(normalized, maxLength);

      if (tweet === undefined) {
        const length = Array.from(normalized).length;
        feedback = `Previous draft (${length} characters) was too long after required Vichar attribution. Rewrite the thought shorter while leaving room for the exact final line: ${VICHAR_ATTRIBUTION}`;
        continue;
      }

      const length = Array.from(tweet).length;
      if (length > maxLength) {
        feedback = `Previous draft (${length} characters, over the limit): ${tweet}\nRewrite it to be shorter.`;
        continue;
      }
      if (findDisallowedLinks(tweet, link).length > 0) {
        feedback = `Previous draft contained a link that is not allowed: ${tweet}\nRewrite it without any link other than the one provided.`;
        continue;
      }
      return { tweet };
    }

    throw new GenerationError(
      "invalid_output",
      "Model output violated length or link rules after retries.",
    );
  }

  private pickLink(topic: string, maxLength: number): string | undefined {
    const selected = selectVtrrkLink(topic, this.links);
    if (!selected) return undefined;
    const room = maxLength - Array.from(selected.url).length;
    return room >= MIN_ROOM_FOR_TEXT ? selected.url : undefined;
  }

  private async callOpenAI(
    input: string,
    maxOutputTokens: number,
  ): Promise<string> {
    const body: Record<string, unknown> = {
      model: this.model,
      instructions: PERSONALIZATION_INSTRUCTIONS,
      input,
      max_output_tokens: maxOutputTokens,
      store: false,
    };
    if (this.reasoningEffort !== null) {
      body.reasoning = { effort: this.reasoningEffort };
    }

    const doFetch = this.fetchImpl ?? fetch;
    let response: Response;
    try {
      response = await doFetch(OPENAI_RESPONSES_URL, {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (err) {
      const name = err instanceof Error ? err.name : "";
      if (name === "TimeoutError" || name === "AbortError") {
        throw new GenerationError("upstream_timeout", "OpenAI request timed out.");
      }
      throw new GenerationError("upstream_error", "OpenAI request failed.");
    }

    if (!response.ok) {
      // Credential problems are a server configuration issue, not an upstream
      // outage. The response body is deliberately never read or logged.
      if (response.status === 401 || response.status === 403) {
        throw new GenerationError(
          "not_configured",
          "OpenAI rejected the credentials.",
          response.status,
        );
      }
      throw new GenerationError(
        "upstream_error",
        "OpenAI returned an error status.",
        response.status,
      );
    }

    let json: unknown;
    try {
      json = await response.json();
    } catch {
      throw new GenerationError("invalid_output", "OpenAI response was not JSON.");
    }
    return extractText(json);
  }
}

/**
 * Output-token budget: about one token per two characters plus headroom, so
 * the cap tracks the requested length, with a hard ceiling for cost safety.
 */
export function outputTokenBudget(maxLength: number, ceiling: number): number {
  const wanted = Math.ceil(maxLength / 2) + 8;
  return Math.min(Math.max(wanted, MIN_OUTPUT_TOKENS), Math.max(ceiling, MIN_OUTPUT_TOKENS));
}

interface PromptParts {
  input: GenerateTweetInput;
  maxLength: number;
  link: string | undefined;
  feedback: string | undefined;
}

function buildPrompt({ input, maxLength, link, feedback }: PromptParts): string {
  const lines = [`Topic: ${clip(input.topic)}`];
  if (input.location) lines.push(`Location (optional context): ${clip(input.location)}`);
  if (input.style) lines.push(`Style: ${clip(input.style)}`);
  lines.push(
    `Limit: at most ${maxLength} characters in total${link ? ", including the link" : ""}.`,
  );
  lines.push(`End with the exact final line: ${VICHAR_ATTRIBUTION}. It is mandatory and counts toward the character limit.`);
  lines.push(
    link
      ? `Link: ${link}\nInclude the link exactly as written only if it fits naturally. Never add any other link.`
      : "Do not include any links.",
  );
  if (feedback) lines.push(feedback);
  return lines.join("\n");
}

function clip(value: string): string {
  const flat = value.replace(/\s+/g, " ").trim();
  const chars = Array.from(flat);
  return chars.length > MAX_FIELD_CHARS
    ? chars.slice(0, MAX_FIELD_CHARS).join("")
    : flat;
}

/** Trims whitespace and removes one pair of wrapping double quotes. */
export function withVicharAttribution(text: string, maxLength: number): string | undefined {
  const attribution = VICHAR_ATTRIBUTION;
  let body = text.trim();

  // Models occasionally follow the instruction but add punctuation to the
  // attribution. Strip that variant before applying the canonical final line.
  const attributionAtEnd = /(?:\s*\n\s*)?Vichar by vtrrk[.!?…]*\s*$/;
  body = body.replace(attributionAtEnd, "").trimEnd();

  if (!body) return undefined;
  const result = `${body}${VICHAR_ATTRIBUTION_SEPARATOR}${attribution}`;
  return Array.from(result).length <= maxLength ? result : undefined;
}

export function normalizeTweet(raw: string): string {
  const text = raw.trim();
  const pairs: Array<[string, string]> = [
    ['"', '"'],
    ["“", "”"],
  ];
  for (const [open, close] of pairs) {
    if (text.length >= 2 && text.startsWith(open) && text.endsWith(close)) {
      const inner = text.slice(open.length, text.length - close.length);
      if (!inner.includes(open) && !inner.includes(close)) return inner.trim();
    }
  }
  return text;
}

/** Reads the REST Responses payload; anything unexpected is invalid_output. */
function extractText(json: unknown): string {
  if (typeof json !== "object" || json === null) {
    throw new GenerationError("invalid_output", "OpenAI response was malformed.");
  }
  const payload = json as {
    status?: unknown;
    output?: unknown;
  };

  if (payload.status === "failed") {
    throw new GenerationError("upstream_error", "OpenAI reported a failed response.");
  }
  if (payload.status === "incomplete") {
    throw new GenerationError("invalid_output", "OpenAI response was incomplete.");
  }
  if (!Array.isArray(payload.output)) {
    throw new GenerationError("invalid_output", "OpenAI response had no output.");
  }

  const texts: string[] = [];
  for (const item of payload.output as unknown[]) {
    if (typeof item !== "object" || item === null) continue;
    const message = item as { type?: unknown; content?: unknown };
    if (message.type !== "message" || !Array.isArray(message.content)) continue;
    for (const part of message.content as unknown[]) {
      if (typeof part !== "object" || part === null) continue;
      const p = part as { type?: unknown; text?: unknown };
      if (p.type === "refusal") {
        throw new GenerationError("invalid_output", "Model refused the request.");
      }
      if (p.type === "output_text" && typeof p.text === "string") {
        texts.push(p.text);
      }
    }
  }

  if (texts.length === 0) {
    throw new GenerationError("invalid_output", "OpenAI response had no text.");
  }
  return texts.join("");
}
