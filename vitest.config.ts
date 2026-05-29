import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    exclude: ["node_modules", "lib"],
    globals: true,
    testTimeout: 30000,
  },
});
