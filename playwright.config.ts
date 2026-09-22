import { defineConfig, devices } from "@playwright/test";
import { E2E_ORIGIN, E2E_PORT, E2E_SECRET, e2eDb } from "./e2e/support/db.mts";

const { e2eUrl } = e2eDb();
const prod = !!process.env.E2E_PROD;
const shots = !!process.env.SCREENSHOTS;
// Screenshots only run on request (`npm run e2e:screenshots`).
const shotSpec = "**/screenshots.spec.ts";

// Phone size only: iPhone 13 dimensions on Chromium (the eventual iOS app's
// companion size), not WebKit.
const { defaultBrowserType: _ignored, ...iphone } = devices["iPhone 13"];
void _ignored;

export default defineConfig({
  testDir: "e2e",
  // One household in one database, so tests run one at a time.
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: E2E_ORIGIN,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"] },
      testIgnore: ["**/layout.spec.ts", ...(shots ? [] : [shotSpec])],
    },
    {
      name: "phone",
      use: { ...iphone, browserName: "chromium" },
      testMatch: ["**/layout.spec.ts", "**/a11y.spec.ts", "**/signin.spec.ts", ...(shots ? [shotSpec] : [])],
    },
    // Firefox (also the engine behind Zen and similar browsers):
    // `E2E_FIREFOX=1` and `npx playwright install firefox`.
    ...(process.env.E2E_FIREFOX
      ? [
          {
            name: "firefox",
            use: { ...devices["Desktop Firefox"] },
            testMatch: ["**/theme.spec.ts", "**/a11y.spec.ts", "**/signin.spec.ts"],
          },
        ]
      : []),
    // Rough Safari stand-in: `E2E_WEBKIT=1` and `npx playwright install webkit`.
    ...(process.env.E2E_WEBKIT
      ? [
          {
            name: "webkit",
            use: { ...devices["Desktop Safari"] },
            testMatch: ["**/theme.spec.ts", "**/a11y.spec.ts", "**/signin.spec.ts"],
          },
        ]
      : []),
  ],
  // `E2E_EXTERNAL=1` (used by scripts/e2e-docker.sh) tests a server that is
  // already running, such as the Docker container, instead of starting one.
  webServer: process.env.E2E_EXTERNAL ? undefined : {
    // The dev server starts fastest; E2E_PROD=1 runs the production build
    // (the standalone server, as in Docker) and is the run to trust before
    // merging visual work.
    command: prod
      ? "npm run build && cp -R .next/static .next/standalone/.next/static && node .next/standalone/server.js"
      : `npx next dev -p ${E2E_PORT}`,
    url: `${E2E_ORIGIN}/api/health`,
    // Never reuse a server that might be pointed at a different database.
    reuseExistingServer: false,
    timeout: prod ? 300_000 : 120_000,
    env: {
      DATABASE_URL: e2eUrl,
      BETTER_AUTH_SECRET: E2E_SECRET,
      BETTER_AUTH_URL: E2E_ORIGIN,
      PORT: String(E2E_PORT),
      HOSTNAME: "127.0.0.1",
      NEXT_TELEMETRY_DISABLED: "1",
      E2E: "1",
    },
  },
});
