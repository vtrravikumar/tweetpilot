/**
 * VTRRK content map: topic category -> VTRRK page URL.
 *
 * URLs are chosen here, deterministically and outside the model. The model is
 * only ever handed an already-selected URL and told to copy it exactly; any
 * other link in its output is rejected (see findDisallowedLinks).
 *
 * The real vtrrk.in page paths have NOT been verified, so DEFAULT_VTRRK_LINKS
 * is intentionally empty. Supply verified URLs without a code change through
 * the optional VTRRK_LINKS environment variable (a JSON object), e.g.
 *
 *   VTRRK_LINKS={"photography":"https://<verified-url>"}
 *
 * Default behaviour is "relevant topics only": no match, no link.
 */

export const VTRRK_CATEGORIES = [
  "photography",
  "riding",
  "travel",
  "books",
  "technology",
  "personal",
] as const;

export type VtrrkCategory = (typeof VTRRK_CATEGORIES)[number];
export type VtrrkLinks = Partial<Record<VtrrkCategory, string>>;

/** Intentionally empty until real site paths are verified. */
export const DEFAULT_VTRRK_LINKS: VtrrkLinks = {};

/**
 * Topic keywords per category. Matching is whole-word and case-insensitive.
 * Category order above is the tie-break priority.
 */
export const VTRRK_TOPIC_KEYWORDS: Record<VtrrkCategory, readonly string[]> = {
  photography: ["photo", "photos", "photography", "photograph", "camera", "lens"],
  riding: ["riding", "ride", "rides", "royal enfield", "motorcycle", "motorcycles", "bike", "biking"],
  travel: ["travel", "travelling", "traveling", "trip", "trips", "journey", "exploring", "exploration"],
  books: ["book", "books", "reading", "novel", "novels", "author"],
  technology: ["technology", "tech", "ai", "software", "coding", "programming", "machine learning"],
  personal: ["life", "observation", "observations", "reflection", "reflections"],
};

export interface SelectedLink {
  category: VtrrkCategory;
  url: string;
}

/**
 * Returns the first configured link whose category matches the topic, or
 * undefined. A category with no configured URL is skipped.
 */
export function selectVtrrkLink(
  topic: string,
  links: VtrrkLinks,
): SelectedLink | undefined {
  const haystack = topic.toLowerCase();
  for (const category of VTRRK_CATEGORIES) {
    const url = links[category];
    if (!url) continue;
    const matches = VTRRK_TOPIC_KEYWORDS[category].some((keyword) =>
      new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(keyword)}(?![\\p{L}\\p{N}])`, "u").test(
        haystack,
      ),
    );
    if (matches) return { category, url };
  }
  return undefined;
}

/**
 * Parses the VTRRK_LINKS env value. Anything that is not a JSON object is
 * ignored, as is any entry with an unknown category or a non-https URL.
 */
export function parseVtrrkLinks(raw: string | undefined): VtrrkLinks {
  if (!raw) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return {};
  }

  const links: VtrrkLinks = {};
  for (const category of VTRRK_CATEGORIES) {
    const value = (parsed as Record<string, unknown>)[category];
    if (typeof value === "string" && isHttpsUrl(value.trim())) {
      links[category] = value.trim();
    }
  }
  return links;
}

export function resolveVtrrkLinks(envValue: string | undefined): VtrrkLinks {
  return { ...DEFAULT_VTRRK_LINKS, ...parseVtrrkLinks(envValue) };
}

/**
 * Returns every link-like string in `text` that is not exactly `allowedUrl`.
 * Covers scheme URLs, www. hosts and bare vtrrk.<tld> mentions, so a model
 * cannot slip in an invented VTRRK path.
 */
export function findDisallowedLinks(
  text: string,
  allowedUrl: string | undefined,
): string[] {
  const matches = text.match(LINK_PATTERN) ?? [];
  return matches
    .map((m) => m.replace(TRAILING_PUNCTUATION, ""))
    .filter((m) => m !== allowedUrl);
}

const LINK_PATTERN = /(?:https?:\/\/|www\.)\S+|\bvtrrk\.[a-z]{2,}\S*/gi;
const TRAILING_PUNCTUATION = /[.,;:!?)\]}"'”’]+$/;

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
