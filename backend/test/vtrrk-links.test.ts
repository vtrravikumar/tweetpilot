import { describe, expect, it } from "vitest";
import {
  DEFAULT_VTRRK_LINKS,
  findDisallowedLinks,
  parseVtrrkLinks,
  resolveVtrrkLinks,
  selectVtrrkLink,
} from "../src/generation/links";

const URL_A = "https://example.test/a";
const URL_B = "https://example.test/b";

describe("VTRRK default link config", () => {
  it("ships empty: no guessed vtrrk.in paths are hard-coded", () => {
    expect(DEFAULT_VTRRK_LINKS).toEqual({});
    expect(JSON.stringify(DEFAULT_VTRRK_LINKS)).not.toContain("vtrrk");
  });

  it("selects nothing with the default config, whatever the topic", () => {
    for (const topic of ["Photography", "Royal Enfield", "Travel", "Books", "AI"]) {
      expect(selectVtrrkLink(topic, DEFAULT_VTRRK_LINKS)).toBeUndefined();
    }
  });
});

describe("selectVtrrkLink", () => {
  const links = {
    photography: URL_A,
    riding: URL_B,
  };

  it("matches relevant topics case-insensitively", () => {
    expect(selectVtrrkLink("PHOTOGRAPHY walk", links)).toEqual({ category: "photography", url: URL_A });
    expect(selectVtrrkLink("Royal Enfield trip", links)).toEqual({ category: "riding", url: URL_B });
  });

  it("returns nothing for unrelated topics (relevant topics only)", () => {
    expect(selectVtrrkLink("Cooking pasta", links)).toBeUndefined();
  });

  it("skips categories that have no configured URL", () => {
    expect(selectVtrrkLink("Travel diary", links)).toBeUndefined();
  });

  it("matches whole words only", () => {
    expect(selectVtrrkLink("Said the ripple", { technology: URL_A })).toBeUndefined();
    expect(selectVtrrkLink("AI tools", { technology: URL_A })?.url).toBe(URL_A);
  });

  it("is deterministic and uses category priority for ties", () => {
    const both = { photography: URL_A, riding: URL_B };
    const a = selectVtrrkLink("riding photography", both);
    const b = selectVtrrkLink("riding photography", both);
    expect(a).toEqual(b);
    expect(a?.category).toBe("photography");
  });
});

describe("parseVtrrkLinks / resolveVtrrkLinks", () => {
  it("parses valid https entries", () => {
    expect(parseVtrrkLinks(JSON.stringify({ photography: ` ${URL_A} `, books: URL_B }))).toEqual({
      photography: URL_A,
      books: URL_B,
    });
  });

  it("ignores unknown categories, non-https and malformed URLs", () => {
    const raw = JSON.stringify({
      photography: "http://insecure.test/x",
      riding: "javascript:alert(1)",
      travel: "not a url",
      books: 42,
      unknown: URL_A,
      technology: URL_B,
    });
    expect(parseVtrrkLinks(raw)).toEqual({ technology: URL_B });
  });

  it.each([undefined, "", "not json", "[]", "null", '"str"', "42"])(
    "returns no links for %j",
    (raw) => {
      expect(parseVtrrkLinks(raw)).toEqual({});
    },
  );

  it("resolveVtrrkLinks layers env values over the (empty) defaults", () => {
    expect(resolveVtrrkLinks(undefined)).toEqual({});
    expect(resolveVtrrkLinks(JSON.stringify({ travel: URL_A }))).toEqual({ travel: URL_A });
  });
});

describe("findDisallowedLinks", () => {
  it("allows exactly the selected URL, including trailing punctuation", () => {
    expect(findDisallowedLinks(`Look ${URL_A}.`, URL_A)).toEqual([]);
    expect(findDisallowedLinks(`(${URL_A})`, URL_A)).toEqual([]);
  });

  it("flags any other URL, www host, or bare vtrrk path", () => {
    expect(findDisallowedLinks("See https://other.test/x", URL_A)).toEqual(["https://other.test/x"]);
    expect(findDisallowedLinks("See www.other.test", URL_A)).toEqual(["www.other.test"]);
    expect(findDisallowedLinks("See vtrrk.in/books", URL_A)).toEqual(["vtrrk.in/books"]);
  });

  it("flags a near-miss of the allowed URL", () => {
    expect(findDisallowedLinks(`${URL_A}/extra`, URL_A)).toEqual([`${URL_A}/extra`]);
  });

  it("flags every link when none is allowed", () => {
    expect(findDisallowedLinks(`Go ${URL_A}`, undefined)).toEqual([URL_A]);
  });

  it("does not flag brand mentions or ordinary text", () => {
    expect(findDisallowedLinks("More from VTRRK soon, e.g. photos.", undefined)).toEqual([]);
  });
});
