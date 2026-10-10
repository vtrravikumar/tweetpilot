import { describe, expect, it } from "vitest";
import {
  fetchNewsContext,
  formatNewsContext,
  parseNewsItems,
  shouldFetchNews,
  NEWS_MAX_AGE_MS,
} from "../src/generation/news";
import { queueFetch } from "./helpers";

const RSS = `<?xml version="1.0"?>
<rss><channel>
  <item>
    <title><![CDATA[Nana Patekar dies at 75 | Example News]]></title>
    <link>https://news.google.com/rss/articles/example-one</link>
    <pubDate>Fri, 09 Oct 2026 07:00:00 GMT</pubDate>
    <source>Example News</source>
  </item>
  <item>
    <title>Second headline &amp; another detail</title>
    <link>https://publisher.example/story-two</link>
    <pubDate>Thu, 08 Oct 2026 06:00:00 GMT</pubDate>
    <source>Example Journal</source>
  </item>
</channel></rss>`;

describe("news context", () => {
  it("fetches news for the news style", async () => {
    const fetchMock = queueFetch(new Response(RSS, { status: 200 }));
    const result = await fetchNewsContext(
      { topic: "Nana Patekar", useNews: true },
      fetchMock,
    );

    expect(result.status).toBe("found");
    if (result.status !== "found") return;
    expect(result.context.query).toBe("Nana Patekar");
    expect(result.context.items[0]?.title).toContain("Nana Patekar dies at 75");
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("q=Nana+Patekar");
  });

  it("includes location in the news search when supplied", async () => {
    const fetchMock = queueFetch(new Response(RSS, { status: 200 }));
    const result = await fetchNewsContext(
      { topic: "traffic", location: "Chennai", style: "observational", useNews: true },
      fetchMock,
    );

    expect(result.status).toBe("found");
    if (result.status !== "found") return;
    expect(result.context.query).toBe("traffic Chennai");
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("traffic+Chennai");
  });

  it("does not fetch news for ordinary generation without a location", async () => {
    const fetchMock = queueFetch(new Response(RSS, { status: 200 }));
    expect(shouldFetchNews({ topic: "Photography", style: "thoughtful" })).toBe(false);
    expect(await fetchNewsContext({ topic: "Photography", style: "thoughtful" }, fetchMock)).toEqual({ status: "no_recent_news" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fails open when the news source is unavailable", async () => {
    const fetchMock = queueFetch(new Error("news unavailable"));
    expect(await fetchNewsContext({ topic: "Nana Patekar", useNews: true }, fetchMock)).toEqual({ status: "unavailable" });
  });

  it("enforces the 48-hour window and excludes missing or future timestamps", () => {
    const now = Date.parse("2026-10-09T12:00:00.000Z");
    const boundary = new Date(now - NEWS_MAX_AGE_MS).toUTCString();
    const future = new Date(now + 1000).toUTCString();
    const xml = "<rss><channel>" +
      "<item><title>Boundary</title><link>https://publisher.example/boundary</link><pubDate>" + boundary + "</pubDate><source>Publisher</source></item>" +
      "<item><title>Too old</title><link>https://publisher.example/old</link><pubDate>Thu, 01 Oct 2026 06:00:00 GMT</pubDate><source>Publisher</source></item>" +
      "<item><title>Missing date</title><link>https://publisher.example/missing</link><source>Publisher</source></item>" +
      "<item><title>Future date</title><link>https://publisher.example/future</link><pubDate>" + future + "</pubDate><source>Publisher</source></item>" +
      "</channel></rss>";
    expect(parseNewsItems(xml, now).map((item) => item.title)).toEqual(["Boundary"]);
  });

  it("parses titles, dates and sources while decoding RSS entities", () => {
    const items = parseNewsItems(RSS, Date.parse("2026-10-09T12:00:00.000Z"));
    expect(items).toHaveLength(2);
    expect(items[1]?.title).toBe("Second headline & another detail");
    expect(items[0]?.publisher).toBe("Example News");
    expect(items[0]?.url).toContain("news.google.com");
    expect(formatNewsContext({ query: "x", items })).toContain("Nana Patekar dies at 75");
  });
});
