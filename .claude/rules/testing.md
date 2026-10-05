---
paths:
  - "tests/**"
  - "e2e/**"
  - "playwright.config.ts"
  - "vitest.config.mts"
  - "scripts/**"
  - ".github/workflows/**"
---

# Testing and CI

- Vitest is primary (`tests/`; shared helpers in `tests/helpers.ts`). Tests that depend on "today" mock `currentMonth` from `@/lib/months`. UI tests without a browser render with `renderToStaticMarkup` and mock `usePathname` (see `tests/plan-ui.test.tsx`). Run `npx next typegen` if `RouteContext` types are missing.
- e2e (`e2e/`, `playwright.config.ts`, `npm run test:e2e`): real Chromium with axe accessibility scans, against a throwaway `monies_e2e` database on port 3100. `E2E_PROD=1` runs the production build, `E2E_WEBKIT=1` adds WebKit. It seeds one deterministic household through the app's API, signs in via `signIn(page, OWNER)`, waits for hydration with `waitHydrated`. Everything destructive goes through `assertScratch` (database name must end in `_e2e`); never point it at the real database or the Docker instance. `E2E=1` (set only by Playwright) disables the sign-in rate limiter and the Next dev badge. `npm run test:e2e:docker` runs `e2e/signin.spec.ts` against the built Docker image with a scratch database; run it after any change to auth or navigation.
- CI (`.github/workflows/ci.yml`) runs lint, build and the Vitest suite on every push to `main` and every PR, against a Postgres 17 service container. The build step deliberately gets no `DATABASE_URL`, holding the invariant that a build works without a database. Playwright is not in CI — it stays a local gate. `.github/workflows/publish-image.yml` builds the multi-arch (amd64/arm64) image and pushes it to GHCR on a `v*` tag.
- `npm run e2e:screenshots` writes light/dark, desktop/phone screenshots of every page to `e2e-screenshots/` (git-ignored). Its last block logs a month of expenses first and shoots the Hub, Expenses and Budget from that state (`*-spend-*`), plus a viewport-only phone Hub — the shared seed has no expenses on purpose (`SEED.unallocatedCents` depends on it), so without this the README's images would read $0.00 spent everywhere. The committed `docs/screenshots/` set is copied from those files by hand.
