import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const rootDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  const isContent = mode === "content";
  const inputName = isContent ? "content" : "background";

  return {
    publicDir: "public",
    build: {
      outDir: "dist",
      emptyOutDir: isContent,
      sourcemap: false,
      rollupOptions: {
        input: resolve(rootDir, `src/${inputName}.ts`),
        output: {
          format: isContent ? "iife" : "es",
          entryFileNames: `${inputName}.js`,
          chunkFileNames: "chunks/[name].js",
          assetFileNames: "assets/[name][extname]"
        }
      }
    }
  };
});
