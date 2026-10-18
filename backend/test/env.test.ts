import { describe, expect, it } from "vitest";
import { readConfig } from "../src/env";

const read = (values: Record<string, unknown>) => readConfig(values as unknown as Env);

describe("readConfig OpenAI credentials", () => {
  it("keeps the legacy text key working when the new text key is absent", () => {
    expect(read({ OPENAI_API_KEY: " legacy-text " }).openaiApiKey).toBe("legacy-text");
  });

  it("prefers the explicit text key over the legacy key", () => {
    expect(read({
      OPENAI_TEXT_API_KEY: " text-key ",
      OPENAI_API_KEY: "legacy-key",
    }).openaiApiKey).toBe("text-key");
  });

  it("does not use a text key as the image key", () => {
    const config = read({ OPENAI_API_KEY: "legacy-text" });
    expect(config.openaiApiKey).toBe("legacy-text");
    expect(config.openaiImageApiKey).toBeUndefined();
  });

  it("reads the image key independently and trims whitespace", () => {
    expect(read({ OPENAI_IMAGE_API_KEY: " image-key " }).openaiImageApiKey).toBe("image-key");
  });

  it("treats blank credentials as missing", () => {
    const config = read({
      OPENAI_TEXT_API_KEY: "  ",
      OPENAI_API_KEY: " ",
      OPENAI_IMAGE_API_KEY: "\n ",
    });
    expect(config.openaiApiKey).toBeUndefined();
    expect(config.openaiImageApiKey).toBeUndefined();
  });
});
