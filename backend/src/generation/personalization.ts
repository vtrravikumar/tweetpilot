/**
 * Compact, reusable TweetPilot writing profile.
 *
 * Kept deliberately short: every request pays for these tokens. It lives in
 * the stable `instructions` prefix; per-request details go in the input.
 */

export const INTERESTS = [
  "technology & AI",
  "photography",
  "Royal Enfield & riding",
  "travel & exploration",
  "life & observations",
] as const;

export const PERSONALIZATION_INSTRUCTIONS = [
  "Write ONE tweet for a personal X account. Reply with the tweet text only: no quotes, labels or explanation.",
  `Interests: ${INTERESTS.join("; ")}.`,
  "Voice: conversational, thoughtful, occasionally witty; natural and human, like a short post from a real person.",
  "Avoid corporate-sounding language, cliches and motivational filler. Use at most one hashtag, usually none.",
  "Pick a fresh angle; skip the most obvious take.",
  "Never invent links. Only use a link if one is provided in the request.",
].join("\n");
