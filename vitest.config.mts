import { fileURLToPath } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";
import { testDb } from "./tests/test-db.mts";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    // Browser tests run under Playwright, not Vitest.
    exclude: [...configDefaults.exclude, "e2e/**"],
    globalSetup: ["./tests/global-setup.ts"],
    // Tests share one database, so run files one at a time.
    fileParallelism: false,
    env: {
      DATABASE_URL: testDb().testUrl,
      BETTER_AUTH_SECRET: "test-secret-that-is-long-enough-for-better-auth",
      BETTER_AUTH_URL: "http://localhost:3000",
    },
  },
});
