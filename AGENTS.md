# AGENTS.md

Guidance for AI coding agents working in this repository. `CLAUDE.md` imports this file, so Claude Code reads it too.

Keep this file short: it is loaded into every session. It holds only what applies everywhere. Detail about one area of the app lives in `.claude/rules/` (see Area rules), and the reasoning behind a feature lives in its spec.

## Workflow: spec-driven

`specs/brief.md` is the source of truth for product intent. Every feature starts as a numbered spec in `specs/` (copy `specs/_template.md`; process in `specs/README.md`). Don't write feature code without an approved spec, and tick the spec's acceptance checkboxes as work lands. Bug fixes, docs, tests and small polish need no spec. Finish the research before writing a spec, and cite a source for anything factual in it.

Spec status is the owner's call. Never move a spec to `approved` yourself; wait for the owner to say so. Set `implemented` (in the spec file and the `specs/README.md` index) only as the last commit before a merge the owner has asked for.

Documentation is part of every spec: update `README.md` in the same PR, and list the changes in the spec's Documentation section. Touch this file only when a rule that applies everywhere changes; put area detail in the matching `.claude/rules/` file, and leave history and rationale in the spec.

## Git workflow

Never push directly to `main`. Work on a feature branch, push it, and open a pull request with `gh pr create`; the owner merges, or asks for the merge. Branch names: `<type>/<short-name>`, e.g. `feat/003-households`, `fix/health-timeout`, `chore/...`. One spec per branch/PR where practical. PRs are squash-merged, so the PR title becomes the commit on `main`. Commits end with the Co-Authored-By trailer.

## Commands

Stack: Next.js (App Router) + TypeScript + Tailwind, `src/` layout, npm.

- `npm run dev`: dev server on :3000
- `npm run build` / `npm run start`: production build (`output: "standalone"`) and serve
- `npm run lint`: ESLint
- `npm test`: Vitest integration tests against a separate `monies_test` DB on the Compose Postgres (`docker compose up -d db` first; `tests/global-setup.ts` creates and migrates it)
- `npm run test:e2e`: Playwright browser tests against a throwaway `monies_e2e` database on port 3100 (one-time `npx playwright install chromium`). A local gate, not in CI; details in `.claude/rules/testing.md`
- During iteration, run the targeted file (`npx vitest run tests/<name>.test.ts`) instead of the full `npm test` — the suite is one shared DB and takes ~35s; the full run is the pre-commit gate. Same for builds: don't run `npm run build` for a docs-only change.
- `docker compose up --build`: run the full stack (app + Postgres). Needs `.env` copied from `.env.example` with `POSTGRES_PASSWORD` and `BETTER_AUTH_SECRET` set; healthcheck hits `/api/health`
- `docker compose up -d db`: Postgres only, for native `npm run dev` (uses `DATABASE_URL` from `.env`)
- `npm run db:generate` / `npm run db:migrate`: generate migrations from `src/db/schema.ts` / apply them manually. `package.json`'s `overrides` pins the esbuild under drizzle-kit's unused, deprecated `@esbuild-kit/core-utils` to a patched version (GHSA-67mh-4wv8-2f99); drop it once drizzle-kit 1.0 is stable and removes that dependency

## Architecture

Specs are listed with their status in `specs/README.md`. Business logic goes behind API route handlers (`src/app/api/`) so a future iOS app can reuse them. Per-feature rationale lives in the spec files under `specs/`; read the relevant spec before changing that area.

Invariants (these must always hold):

- Data access: Drizzle ORM over `postgres`. `src/db/schema.ts` holds the tables; `src/db/index.ts` exposes lazy `getDb()`/`getSql()` so builds work without a DB. Migrations are SQL files in `drizzle/`, committed, applied automatically at server start (`src/instrumentation.ts`).
- Authorization: every household-scoped route handler calls `requireHousehold(request.headers, { role? })` from `src/lib/household.ts` first; wrap handlers in `route()` from `src/lib/http.ts` for JSON errors. `src/proxy.ts` only does an optimistic cookie check and redirect; it is not authorization.
- Money and months: money is integer minor units; the API field is `amountCents` for every currency (`src/lib/money.ts`). Months are `YYYY-MM` in the API and `YYYY-MM-01` `date` values in the DB (`src/lib/months.ts`); "current month" uses the server `TZ`.
- Time-versioning (budgets, goals, bills, fixed income): amounts are rows effective from a month onward, and a month's amount is the row with the latest `effective_month` on or before it. Never update or delete past rows — past months are read-only. Categories and goals archive via `archived_from`, never deleted.
- Unallocated = income − bills − expenses − checked-off goals, everywhere, sourced from `getBudget` (`Budget.unallocatedCents`) / `planSummaryFromBudget` (`src/lib/plan.ts`); never recompute it client-side. A category's budgeted amount and an unchecked goal's target are *plans* and reserve nothing — only a Bill, a logged Expense, or a checked-off Goal claims real income (spec 022). The display label is "Unallocated Income"; the `unallocated` task code and `unallocatedCents` fields are unchanged (spec 015).
- Removing a member deletes their user row (cascades to sessions and membership). Later tables referencing users must use `ON DELETE SET NULL` or soft-delete to keep history.
- Keep `README.md` (notably its tech stack and config tables) current when the stack or env vars change.
- Derived numbers have one source: `getBudget` (`src/lib/budgets.ts`) and `getOverview` (`src/lib/overview.ts`) compute them for both pages and API. Never recompute a total in a component.

## Area rules

Each file below holds the invariants for one area. Claude Code loads a file automatically when it reads or edits a path listed in that file's `paths:` frontmatter. Other agents: read the matching file before changing that area.

| File | Covers |
| --- | --- |
| `.claude/rules/budget.md` | Goals, expenses, bills, income and Assign unallocated |
| `.claude/rules/hub.md` | Hub (Overview), Tasks, the Plan summary and navigation |
| `.claude/rules/auth.md` | Auth, membership and roles |
| `.claude/rules/backup.md` | Backup and restore |
| `.claude/rules/ui.md` | UI rules |
| `.claude/rules/testing.md` | Testing and CI |

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
