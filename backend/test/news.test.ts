import { describe, expect, it } from "vitest";
import {
  fetchNewsContext,
  formatNewsContext,
  parseNewsItems,
  shouldFetchNews,
} from "../src/generation/news";
import { queueFetch } from "./helpers";

const RSS = `<?xml version="1.0"?>
<rss><channel>
  <item>
    <title><![CDATA[Nana Patekar dies at 75 | Example News]]></title>
    <pubDate>Thu, 08 Oct 2026 07:00:00 GMT</pubDate>
    <source>Example News</source>
  </item>
  <item>
    <title>Second headline &amp; another detail</title>
    <pubDate>Thu, 08 Oct 2026 06:00:00 GMT</pubDate>
  </item>
</channel></rss>`;

describe("news context", () => {
  it("fetches news for the news style", async () => {
    const fetchMock = queueFetch(new Response(RSS, { status: 200 }));
    const result = await fetchNewsContext(
      { topic: "Nana Patekar", style: "news" },
      fetchMock,
    );

    expect(result?.query).toBe("Nana Patekar");
    expect(result?.items[0]?.title).toContain("Nana Patekar dies at 75");
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("q=Nana+Patekar");
  });

  it("includes location in the news search when supplied", async () => {
    const fetchMock = queueFetch(new Response(RSS, { status: 200 }));
    const result = await fetchNewsContext(
      { topic: "traffic", location: "Chennai", style: "observational" },
      fetchMock,
    );

    expect(result?.query).toBe("traffic Chennai");
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("traffic+Chennai");
  });

  it("does not fetch news for ordinary generation without a location", async () => {
    const fetchMock = queueFetch(new Response(RSS, { status: 200 }));
    expect(shouldFetchNews({ topic: "Photography", style: "thoughtful" })).toBe(false);
    expect(await fetchNewsContext({ topic: "Photography", style: "thoughtful" }, fetchMock)).toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fails open when the news source is unavailable", async () => {
    const fetchMock = queueFetch(new Error("news unavailable"));
    expect(await fetchNewsContext({ topic: "Nana Patekar", style: "news" }, fetchMock)).toBeUndefined();
  });

  it("parses titles, dates and sources while decoding RSS entities", () => {
    const items = parseNewsItems(RSS);
    expect(items).toHaveLength(2);
    expect(items[1]?.title).toBe("Second headline & another detail");
    expect(items[0]?.source).toBe("Example News");
    expect(formatNewsContext({ query: "x", items })).toContain("Nana Patekar dies at 75");
  });
});
