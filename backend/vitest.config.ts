import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: "./wrangler.jsonc" },
      // Test-only variable (not a Cloudflare resource): the HTTP-contract
      // tests run against the offline placeholder, never the real OpenAI API.
      miniflare: { bindings: { TWEETPILOT_GENERATOR: "placeholder" } },
    }),
  ],
  test: {
    include: ["test/**/*.test.ts"],
    // Blocks real network calls in every test (see test/setup.ts).
    setupFiles: ["./test/setup.ts"],
  },
});
