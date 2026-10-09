import type { GenerateTweetInput, NewsSource } from "./types";

export interface NewsItem extends NewsSource {}

export interface NewsContext {
  query: string;
  items: NewsItem[];
}

export type NewsRetrievalResult =
  | { status: "found"; context: NewsContext }
  | { status: "no_recent_news" }
  | { status: "unavailable" };

const GOOGLE_NEWS_RSS = "https://news.google.com/rss/search";
const NEWS_TIMEOUT_MS = 5_000;
export const NEWS_MAX_AGE_MS = 48 * 60 * 60 * 1000;
const MAX_ITEMS = 4;
const MAX_TITLE_CHARS = 180;
const MAX_CONTEXT_CHARS = 900;

/**
 * Retrieves global English-language Google News search results independently
 * from OpenAI. Location is part of the query, not a publisher-country filter.
 * Only stories with a valid publication timestamp in the previous 48 hours
 * qualify. Provider failures are distinct from a successful search with no
 * qualifying stories so callers can explain the correct fallback.
 */
export async function fetchNewsContext(
  input: GenerateTweetInput,
  fetchImpl: typeof fetch = fetch,
  now = Date.now(),
): Promise<NewsRetrievalResult> {
  if (!shouldFetchNews(input)) return { status: "no_recent_news" };

  const query = [input.topic, input.location].filter(Boolean).join(" ").trim();
  if (!query) return { status: "no_recent_news" };

  const url = new URL(GOOGLE_NEWS_RSS);
  url.searchParams.set("q", query);
  // Do not set gl/ceid: those parameters pin the feed to a single country.
  // hl chooses the feed language without restricting publisher geography.
  url.searchParams.set("hl", "en-US");

  let response: Response;
  try {
    response = await fetchImpl(url.toString(), {
      method: "GET",
      headers: { accept: "application/rss+xml, application/xml, text/xml" },
      cache: "no-store",
      signal: AbortSignal.timeout(NEWS_TIMEOUT_MS),
    });
  } catch {
    return { status: "unavailable" };
  }

  if (!response.ok) return { status: "unavailable" };

  let xml: string;
  try {
    xml = await response.text();
  } catch {
    return { status: "unavailable" };
  }
  if (!/<rss\b/i.test(xml) || !/<\/rss\s*>/i.test(xml)) {
    return { status: "unavailable" };
  }

  try {
    const items = parseNewsItems(xml, now);
    return items.length > 0
      ? { status: "found", context: { query, items } }
      : { status: "no_recent_news" };
  } catch {
    return { status: "unavailable" };
  }
}

export function shouldFetchNews(input: GenerateTweetInput): boolean {
  return input.useNews === true;
}

export function parseNewsItems(xml: string, now = Date.now()): NewsItem[] {
  const items: NewsItem[] = [];
  const matches = xml.match(/<item[\s\S]*?<\/item>/gi) ?? [];

  for (const block of matches) {
    const title = cleanXmlText(readTag(block, "title"));
    const url = cleanXmlText(readTag(block, "link"));
    const published = cleanXmlText(readTag(block, "pubDate") || readTag(block, "published"));
    const publisher = cleanXmlText(readTag(block, "source"));
    if (!title || !publisher || !isSafeArticleUrl(url) || !published) continue;

    const publishedMs = Date.parse(published);
    if (!Number.isFinite(publishedMs) || publishedMs > now || now - publishedMs > NEWS_MAX_AGE_MS) continue;

    items.push({
      title: clip(title, MAX_TITLE_CHARS),
      publisher: clip(publisher, 80),
      url,
      publishedAt: new Date(publishedMs).toISOString(),
    });
    if (items.length >= MAX_ITEMS) break;
  }
  return items;
}

export function formatNewsContext(context: NewsContext): string {
  const lines = context.items.map((item) =>
    `- ${item.title} | ${item.publishedAt} | ${item.publisher} | ${item.url}`,
  );
  return clip(lines.join("\n"), MAX_CONTEXT_CHARS);
}

function isSafeArticleUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname.length > 0;
  } catch {
    return false;
  }
}

function readTag(block: string, tag: string): string {
  const match = block.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match?.[1] ?? "";
}

function cleanXmlText(value: string): string {
  return decodeEntities(
    value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
      .replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
  );
}

function decodeEntities(value: string): string {
  return value.replace(/&amp;/g, "&").replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'").replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}

function clip(value: string, max: number): string {
  const chars = Array.from(value);
  return chars.length > max ? chars.slice(0, max).join("") : value;
}
