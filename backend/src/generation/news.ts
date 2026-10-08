import type { GenerateTweetInput } from "./types";

export interface NewsItem {
  title: string;
  publishedAt?: string;
  source?: string;
}

export interface NewsContext {
  query: string;
  items: NewsItem[];
}

const GOOGLE_NEWS_RSS = "https://news.google.com/rss/search";
const NEWS_TIMEOUT_MS = 5_000;
const MAX_ITEMS = 4;
const MAX_TITLE_CHARS = 180;
const MAX_CONTEXT_CHARS = 900;

/**
 * Fetches a small, recent news context for the generation prompt.
 *
 * News is deliberately treated as optional enrichment. A news outage, an
 * empty result, or malformed RSS must never make ordinary Vichar generation
 * fail.
 *
 * We use Google News' public RSS search feed rather than a paid news API so
 * the first news-aware Vichar iteration has no additional API credential or
 * per-request vendor cost.
 */
export async function fetchNewsContext(
  input: GenerateTweetInput,
  fetchImpl: typeof fetch = fetch,
): Promise<NewsContext | undefined> {
  if (!shouldFetchNews(input)) return undefined;

  const query = [input.topic, input.location].filter(Boolean).join(" ").trim();
  if (!query) return undefined;

  const url = new URL(GOOGLE_NEWS_RSS);
  url.searchParams.set("q", query);
  url.searchParams.set("hl", "en-IN");
  url.searchParams.set("gl", "IN");
  url.searchParams.set("ceid", "IN:en");

  let response: Response;
  try {
    response = await fetchImpl(url.toString(), {
      method: "GET",
      headers: { accept: "application/rss+xml, application/xml, text/xml" },
      cache: "no-store",
      signal: AbortSignal.timeout(NEWS_TIMEOUT_MS),
    });
  } catch {
    return undefined;
  }

  if (!response.ok) return undefined;

  try {
    const xml = await response.text();
    const items = parseNewsItems(xml);
    return items.length > 0 ? { query, items } : undefined;
  } catch {
    return undefined;
  }
}

export function shouldFetchNews(input: GenerateTweetInput): boolean {
  return (
    input.style?.trim().toLowerCase() === "news" ||
    Boolean(input.location?.trim())
  );
}

export function parseNewsItems(xml: string): NewsItem[] {
  const items: NewsItem[] = [];
  const matches = xml.match(/<item[\\s\\S]*?<\\/item>/gi) ?? [];

  for (const block of matches) {
    const title = cleanXmlText(readTag(block, "title"));
    if (!title) continue;

    const published = cleanXmlText(
      readTag(block, "pubDate") || readTag(block, "published"),
    );
    const source = cleanXmlText(readTag(block, "source"));

    items.push({
      title: clip(title, MAX_TITLE_CHARS),
      ...(published ? { publishedAt: published } : {}),
      ...(source ? { source: clip(source, 80) } : {}),
    });

    if (items.length >= MAX_ITEMS) break;
  }

  return items;
}

export function formatNewsContext(context: NewsContext): string {
  const lines = context.items.map((item) => {
    const date = item.publishedAt ? ` | ${item.publishedAt}` : "";
    const source = item.source ? ` | ${item.source}` : "";
    return `- ${item.title}${date}${source}`;
  });
  return clip(lines.join("\n"), MAX_CONTEXT_CHARS);
}

function readTag(block: string, tag: string): string {
  const match = block.match(
    new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i"),
  );
  return match?.[1] ?? "";
}

function cleanXmlText(value: string): string {
  return decodeEntities(
    value
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function clip(value: string, max: number): string {
  const chars = Array.from(value);
  return chars.length > max ? chars.slice(0, max).join("") : value;
}
