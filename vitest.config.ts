import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    environment: "node",
    coverage: {
      reporter: ["text", "lcov"],
    },
    include: ["lib/__tests__/**/*.spec.ts", "hooks/__tests__/**/*.spec.ts", "components/__tests__/**/*.spec.tsx"],
  },
});
