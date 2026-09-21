# 009: Browser testing with Playwright

**Status:** implemented

## Goal
Verify UI behavior, layout, accessibility and appearance in a real browser, repeatably, by the developer and by Claude. Today the test suite (Vitest) covers the API and server-rendered markup, but every spec from 005 to 008 ends with a "Not verified" note for things only a browser can show: theme flash and persistence, live updates while typing, scroll and focus, the phone layout, and how the themes actually look. This spec adds Playwright to close those gaps, leaves regression tests behind, and produces screenshots that can be reviewed for visual polish.

It is sequenced **before the Overview page (spec 008, PR 2)** so the most visual piece of the app is verified in a browser as it is built. This spec defines the setup and patterns; the Overview's own end-to-end checks land with the Overview PR (listed below so they are not forgotten).

Supports `brief.md`: modern, mobile-first UX and a project that is simple to develop against and open-source friendly.

## Research
- `@playwright/test` (currently 1.63) is Playwright's test runner. Its `webServer` option starts the app before the tests, with `command`, `url`, `env`, `timeout` and `reuseExistingServer`, and pairs with `baseURL` for relative navigation ([Web server](https://playwright.dev/docs/test-webserver)).
- Color scheme and devices can be emulated per project, per test or at runtime: `use: { colorScheme: 'dark' }`, `page.emulateMedia({ colorScheme })`, `setViewportSize`, and a `devices` registry such as `devices['iPhone 13']` ([Emulation](https://playwright.dev/docs/emulation)). This is what allows testing "follows the OS" and live OS changes without touching the machine's settings.
- `@axe-core/playwright` (currently 4.13) runs axe accessibility rules against a page (`new AxeBuilder({ page }).analyze()`, `.withTags([...])`). Playwright's own guidance is that automated scans catch only some problems and manual testing is still needed ([Accessibility testing](https://playwright.dev/docs/accessibility-testing)). So a clean scan is a floor, not a certificate.
- The repository has no CI configuration, so nothing here depends on one.

## Requirements

### Setup
- Add `@playwright/test` and `@axe-core/playwright` as dev dependencies, a `playwright.config.ts`, and an `e2e/` folder. Browsers are installed with `npx playwright install chromium` (documented; the browser download lives in the user's cache, not in the repo).
- Commands: `npm run test:e2e` (run the browser tests) and `npm run e2e:screenshots` (write screenshots, below). Vitest must not pick up the e2e files.
- **Isolation.** Tests run against a throwaway database (`monies_e2e`) and their own port (default 3100), never the developer's or the real household's database. Global setup creates and migrates the scratch database on the Compose Postgres (`docker compose up -d db`), the same approach as the Vitest setup, and refuses to run if the target database name is not the scratch one.
- **Server.** Playwright's `webServer` starts the app with the scratch `DATABASE_URL`, a fixed `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` set to the test origin, and `reuseExistingServer: false` (see Implementation notes). Whether it runs the dev server or a production build is decided during implementation (see Open questions).
- **Seeding.** A helper uses the app's own API to build a deterministic household: an owner and a second member, income (a fixed salary and a variable source with a deposit), category budgets, and several bills including a yearly one, leaving some money unallocated and one category over budget by its bills. Sessions are saved as Playwright `storageState` for the owner and the member so tests skip the sign-in form, plus one test that does use the sign-in form.
- Tests run serially (one worker) because they share one household and database; each spec file resets and reseeds the database when it mutates data.
- Dates are relative to the running server's "today" (the current month is computed, never hardcoded), since the app uses the real clock.

### Projects and viewports
- Default projects: **desktop Chromium** and **phone Chromium** (a mobile device preset), each run in both color schemes where the test cares about theme. A **WebKit** project exists behind an environment flag as a rough Safari stand-in and is off by default.

### Initial tests (each closes a "Not verified" item from earlier specs)
1. **Theme** (specs 005, 007): with no saved choice the page follows the emulated OS scheme in both directions and follows a live change while on System; choosing Light or Dark persists across reloads and overrides the OS; System clears the override; the `dark` class is present by `DOMContentLoaded` (before hydration) and the body's computed background equals the token for that theme (Dracula `#282A36`, Alucard `#FFFBEB`), which is the practical check for "no flash"; the theme control works by keyboard and reflects `aria-pressed`; input focus uses the accent color.
2. **Plan area** (spec 008 PR 1): the header shows Overview, Plan and Members with the right one current; Plan tabs mark the current page and keep the selected month; the summary bar's Income, Budgeted, bills-within-budget and Unallocated match the seeded data; typing a new budget amount updates Unallocated live without a reload; Assign in the bar scrolls to and focuses the Assign panel on Budget, and from Bills it navigates to `/budget#assign` and focuses it; Assign is absent for a past month and when nothing is unallocated; over-allocation shows "Over-allocated by" in the error color.
3. **Assign panel** (spec 007): the multi-row split flow (add a category, Split evenly, remove a row), the live "stays unallocated" line, disabled state for invalid input, applying everything in one click, and Unallocated dropping accordingly.
4. **Bills** (spec 007): the category field starts empty and the form will not submit without one, the live "= X / month" preview for a yearly bill, ending a bill, and the message when archiving a category that has bills.
5. **Phone layout**: on every main page at phone width the document does not scroll horizontally (`scrollWidth <= clientWidth`), the header items and controls are reachable, and key controls are not clipped.
6. **Accessibility**: an axe scan (WCAG 2 A and AA tags, which include color contrast) of every main page in light and dark, on desktop and phone, failing on serious or critical violations. Any rule that must be waived is listed in one place with the reason.

### Overview coverage (deferred to the Overview PR, listed here so it is not forgotten)
When spec 008 PR 2 lands, its PR adds e2e checks using this setup: the cash-flow bar's segments add up to the month's income and its Unallocated equals the Plan bar's; the category table matches the Budget page; each attention item appears in the seeded state and links to the right place; Assign from the Overview reaches the Budget panel; empty-household states; past-month behavior; phone layout; axe in both themes; and screenshots for review.

### Screenshots for review
- `npm run e2e:screenshots` writes PNGs to `e2e-screenshots/` (git-ignored) for each main page, in light and dark, at desktop and phone size, using the seeded household. These are for people (and Claude) to look at when judging polish; they are not pixel-compared. A short index file lists what was captured.

### Documentation
- `README.md`: how to run the browser tests and screenshots (`docker compose up -d db`, one-time `npx playwright install chromium`, then the commands), and what they cover.
- `CLAUDE.md`: the commands, the scratch database and port, the rule that UI work should run the e2e suite and review the screenshots before being reported as done, and how to add a test (seed helpers, `storageState`, serial workers).

## Out of scope
Pixel-diff visual regression baselines, a browser matrix beyond the optional WebKit project, a CI pipeline (there is none today), performance or load testing, running against the Docker instance or the real household, browser autofill emulation, screen-reader testing, and real-device testing (iOS Safari and similar remain manual).

## Acceptance criteria
- [x] `npm run test:e2e` starts the app on the scratch database and port, seeds the household through the API, runs the tests, and shuts down, leaving the real database untouched.
- [x] The e2e run refuses to start against a database that is not the scratch one.
- [x] Vitest does not run the e2e files and `npm test` still passes.
- [x] The theme tests pass, including the no-flash check, persistence, live OS change, and the keyboard toggle.
- [x] The Plan area tests pass, including the live Unallocated update and both Assign paths.
- [x] The Assign panel and Bills tests pass.
- [x] The phone-layout test passes on every main page with no horizontal overflow.
- [x] The axe scan passes on every main page in both themes and both viewports, or the exceptions are listed with reasons.
- [x] `npm run e2e:screenshots` produces the screenshot set and an index, git-ignored.
- [x] Any real problems the browser tests uncover in existing pages are fixed in this PR or logged as follow-ups in the spec.
- [x] Documentation updated (see Documentation).
- [x] `npm run lint`, `npm test`, `npm run build` and `npm run test:e2e` pass.

## Technical notes
- Config outline: `testDir: "e2e"`, `workers: 1`, `fullyParallel: false`, `webServer` as above, `use: { baseURL }`, projects for desktop and phone Chromium, optional WebKit. Add `test-results/`, `playwright-report/` and `e2e-screenshots/` to `.gitignore`. Add `exclude: ["e2e/**"]` to `vitest.config.mts` (Vitest's default include would otherwise match `*.spec.ts`).
- Database guard and creation: reuse the pattern in `tests/test-db.mts` and `tests/global-setup.ts` with a different database name and a check on the parsed name before any destructive step.
- Seeding through the API mirrors the helpers in `tests/helpers.ts` but over HTTP with Playwright's `request` fixture; save cookies with `context.storageState()`. Better Auth checks the request origin on cookie-carrying calls; browser requests send the right one, and API-context seeding works without one, as the curl runs already showed.
- Theme checks: set `colorScheme` per project or per test with `emulateMedia`; read `document.documentElement.classList` in `page.addInitScript` or right after `waitUntil: "domcontentloaded"` for the no-flash check; read `getComputedStyle(document.body).backgroundColor` for the palette check; clear `localStorage` between tests.
- Live-update and focus checks use ordinary Playwright locators and `expect(...).toBeFocused()`; avoid fixed sleeps.
- Dev server versus production build: `next dev` starts fastest but compiles routes on first request (add generous timeouts for the first hit); a production build is closer to what runs in Docker. With `output: "standalone"`, `next start` may warn, so if a production run is chosen it should use the standalone server; verify during implementation.
- Screenshot script: a Playwright spec (or a small script using the same fixtures) that visits each page for each project and color scheme, waits for the page to settle, and writes `e2e-screenshots/<page>-<scheme>-<viewport>.png`.
- Extend as pages change: each future UI spec should add or update its e2e checks in its own PR; the Overview is the first.
- Read `node_modules/next/dist/docs/` for anything Next-specific about starting the server.

## Decisions
- Playwright in the repository is the primary way to verify UI. The Claude in Chrome extension remains an optional aid for looking at the real instance, since it cannot sign in for the user and is less repeatable.
- Sequence: this spec is implemented before the Overview page (spec 008 PR 2), which then adds its own e2e checks.

- The e2e run uses the dev server by default for speed, with an `E2E_PROD` flag to run the production build (the run to trust before merging visual work).
- A WebKit project is included as a rough Safari stand-in, off by default (`E2E_WEBKIT=1`, needs its own browser download).
- Axe fails the run on serious and critical violations only; lesser findings are reviewed in the report.
- The screenshot set is every main page in light and dark at desktop and phone size.
- The phone preset uses iPhone 13 dimensions (on Chromium), since the iOS app is the eventual companion.

## Verification
On a clean checkout with Postgres running (`docker compose up -d db`) and Chromium installed, run `npm run test:e2e` and confirm all tests pass and the real database is unchanged (compare row counts before and after). Run it once with the database name pointed at the real one and confirm it refuses. Run `npm run e2e:screenshots`, open the images in both themes at both sizes, and confirm they show the seeded household. Break something on purpose (for example remove the pre-paint theme script) and confirm the theme test fails, then restore it. Run `npm test`, lint and build.

## Implementation notes
- **What runs:** 60 browser tests across two Chromium projects (desktop: theme, Plan area, Assign panel, Bills, accessibility; phone: layout and accessibility), plus a screenshot spec that only runs on request. Vitest gains `tests/e2e-guard.test.ts` for the scratch-database guard (181 Vitest tests in total).
- **Scratch database guard.** `assertScratch` (`e2e/support/db.mts`) requires a name ending in `_e2e`; `prepare-db.mts` and every truncate go through it. Verified by running with `E2E_DB_NAME` set to `monies`, `postgres`, `monies_test` and `prod`, which all refuse, and by confirming the real database's rows were only changed by the user during the test runs (newest rows were created by the real user, not the seeded test users).
- **Database creation happens before Playwright starts** (`node e2e/prepare-db.mts && playwright test`), because the app runs its migrations at startup and needs the database to exist; seeding runs through the API afterwards, once per spec file or per test where data changes.
- **`reuseExistingServer` is false**, not true as first proposed: a server already on port 3100 might point at a different database, so the run fails instead of reusing it.
- **No axe waivers.** Every page passes in both themes at both sizes with zero serious or critical violations, so the waiver list is empty.
- **Production mode works.** `E2E_PROD=1` builds, copies `.next/static` into the standalone output and runs `.next/standalone/server.js`; a 23-test subset passed. It exposed that Better Auth rate-limits sign-in in production (dev does not), so `E2E=1` (set only by Playwright's `webServer`) disables the rate limiter in `src/lib/auth.ts`. The flag also turns off the Next dev badge (`next.config.ts`) because it floated over the page and covered controls in screenshots.
- **Layout tests compare with the configured viewport width, not `window.innerWidth`.** In mobile emulation Chromium widens the layout viewport to fit overflowing content, which made an early version of the test pass on a broken header. Verified by temporarily restoring the old header: 6 tests failed; with the fix all pass.

### Problems the browser tests found and fixed in this PR
1. **Phone header overflowed** (iPhone width): "Sign out" wrapped to two lines and the theme switch was clipped off the right edge, unreachable. The header now wraps: logo and controls on the first row, Overview / Plan / Members on a second row on phones, one line from `sm` up (`Header`, `HeaderNav`, `SignOutButton`).
2. **Input width overrides were ignored.** `inputCls` includes `w-full`, which beat `w-32`, `w-28` and `w-auto`, so the Budget amount inputs were about 270px wide instead of 128px, the Bills and Left columns did not line up between rows, and the Assign panel's fields stretched full width. The 12 overrides now use the important suffix (`w-32!`), and a test asserts the Budget inputs are 128px wide with one shared right edge.
3. **The Next dev badge** covered content in screenshots and could intercept clicks (see above).

### Addendum: tests against the Docker container
A Docker-only sign-in failure (a race between `router.push()` and `router.refresh()` that left a blank page in the container but never in local servers) showed that local runs do not prove the container works. `npm run test:e2e:docker` (`scripts/e2e-docker.sh`) builds the image, starts it as a container on port 3200 with its own `monies_docker_e2e` database (and `E2E=1`, so the sign-in rate limiter does not block the tests), and runs `e2e/signin.spec.ts` against it via `E2E_EXTERNAL=1`, which makes Playwright test a running server instead of starting one. The spec covers clicking Sign in, pressing Enter in either field, wrong details, no password in the address bar, and signing out. Verified by restoring the old code: 5 of 6 tests fail against the image, all 6 pass with the fix. An optional `firefox` project (`E2E_FIREFOX=1`) also exists; it could not be launched in the environment this was built in, so it is untested.

## Not verified
- The optional WebKit project was written but not run (it needs `npx playwright install webkit`); real Safari and iOS behavior remains manual.
- Screenshots were reviewed by Claude for the Budget and Bills pages in light and dark and the phone Budget page; the others were generated and pass the automated checks but were not all inspected individually.
