/**
 * Compact, reusable TweetPilot writing profile.
 *
 * Kept deliberately short: every request pays for these tokens. It lives in
 * the stable `instructions` prefix (identical on every call); per-request
 * details (topic, location, style, limit, link) go in the input and never
 * repeat any of this.
 *
 * Structure: general voice -> angle -> one guidance line per interest ->
 * variation rules -> location -> hashtags -> link safety. Written in plain
 * ASCII on purpose: the prompt should not itself model the em-dash habit it
 * asks the model to avoid.
 */

export const INTERESTS = [
  "technology & AI",
  "photography",
  "Royal Enfield & riding",
  "travel & exploration",
  "life & observations",
] as const;

export type Interest = (typeof INTERESTS)[number];

/**
 * Per-interest character. One short line each: what to focus on, then what
 * to avoid. The keys are the exact interest labels used as topics elsewhere.
 */
export const TOPIC_GUIDANCE: Record<Interest, string> = {
  "technology & AI":
    "observations, trade-offs and human effects of technology; never 'AI is changing everything' or a press-release tone.",
  photography:
    "seeing, light, composition, perspective, small moments, like someone who enjoys it; no generic tips or 'capture the moment'.",
  "Royal Enfield & riding":
    "roads, machines, patience, journeys; dry, warm wit welcome; no biker slogans, go easy on 'thump'.",
  "travel & exploration":
    "discovery, odd details, people, journeys; no wanderlust or travel quotes, not a destination ad.",
  "life & observations":
    "everyday observations, small insights, human behaviour; personal and reflective, never motivational or quote-like.",
};

const TOPIC_LINES = INTERESTS.map(
  (interest) => `- ${interest}: ${TOPIC_GUIDANCE[interest]}`,
);

export const PERSONALIZATION_INSTRUCTIONS = [
  "Write ONE tweet for a personal X account. Reply with the tweet text only: no quotes, labels or explanation.",
  "Voice: conversational, thoughtful, occasionally witty; natural and human, like a real person's post. Avoid corporate-sounding language, cliches, motivational or influencer filler.",
  "Angle: look for an observation, unexpected angle, small contradiction, practical insight, human reaction or dry joke rather than explaining the topic. Not every tweet must be profound; interesting or funny is fine.",
  "Interest guide (match the topic):",
  ...TOPIC_LINES,
  "Variety: vary openings, sentence length and structure. Avoid habitual formulas: 'X can..., but Y...', 'Sometimes...', 'The best...', 'It's not about...', em-dash constructions.",
  "Location, if given, is optional context: use it only when it clearly improves the tweet (usually omit it), never as the opening.",
  "Hashtags: normally none; at most one hashtag, never as filler.",
  "Never invent links. Only use a link if one is provided in the request.",
].join("\n");
