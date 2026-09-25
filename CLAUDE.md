# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Workflow: spec-driven

`specs/brief.md` is the source of truth for product intent. Every feature starts as a numbered spec in `specs/` (copy `specs/_template.md`; process in `specs/README.md`). Don't write feature code without an approved spec, and update the spec's status and acceptance checkboxes as work lands. Documentation is part of every spec: update `README.md` and this file in the same PR, and list the changes in the spec's Documentation section.

## Git workflow

Never push directly to `main`. Work on a feature branch, push it, and open a pull request with `gh pr create`; the user merges. Branch names: `<type>/<short-name>`, e.g. `feat/003-households`, `fix/health-timeout`, `chore/...`. One spec per branch/PR where practical, with the spec status update included in the same PR. Commits end with the Co-Authored-By trailer.

## Commands

Stack: Next.js (App Router) + TypeScript + Tailwind, `src/` layout, npm.

- `npm run dev`: dev server on :3000
- `npm run build` / `npm run start`: production build (`output: "standalone"`) and serve
- `npm run lint`: ESLint
- `npm test`: Vitest integration tests against a separate `monies_test` DB on the Compose Postgres (`docker compose up -d db` first; `tests/global-setup.ts` creates and migrates it)
- `npm run test:e2e`: Playwright browser tests (real Chromium, axe accessibility scans) against a throwaway `monies_e2e` database on port 3100; one-time `npx playwright install chromium`; `E2E_PROD=1` runs the production build, `E2E_WEBKIT=1` adds WebKit. `npm run e2e:screenshots` writes light/dark, desktop/phone screenshots of every page to `e2e-screenshots/` (git-ignored)
- `docker compose up --build`: run the full stack (app + Postgres). Needs `.env` copied from `.env.example` with `POSTGRES_PASSWORD` and `BETTER_AUTH_SECRET` set; healthcheck hits `/api/health`
- `docker compose up -d db`: Postgres only, for native `npm run dev` (uses `DATABASE_URL` from `.env`)
- `npm run db:generate` / `npm run db:migrate`: generate migrations from `src/db/schema.ts` / apply them manually

## Architecture

Specs 001-023 are done. Business logic goes behind API route handlers (`src/app/api/`) so a future iOS app can reuse them. Per-feature rationale lives in the spec files under `specs/`; read the relevant spec before changing that area.

Invariants (these must always hold):

- Data access: Drizzle ORM over `postgres`. `src/db/schema.ts` holds the tables; `src/db/index.ts` exposes lazy `getDb()`/`getSql()` so builds work without a DB. Migrations are SQL files in `drizzle/`, committed, applied automatically at server start (`src/instrumentation.ts`).
- Auth: Better Auth (`src/lib/auth.ts`, lazy `getAuth()`), mounted at `/api/auth/[...all]`. Public sign-up is disabled; accounts are only created by `src/lib/accounts.ts` (`insertUserWithPassword`) from first-run setup and invite accept. One household per instance (unique constraint on `households.singleton`).
- Authorization: every household-scoped route handler calls `requireHousehold(request.headers, { role? })` from `src/lib/household.ts` first; wrap handlers in `route()` from `src/lib/http.ts` for JSON errors. `src/proxy.ts` only does an optimistic cookie check and redirect; it is not authorization.
- Money and months: money is integer minor units; the API field is `amountCents` for every currency (`src/lib/money.ts`). Months are `YYYY-MM` in the API and `YYYY-MM-01` `date` values in the DB (`src/lib/months.ts`); "current month" uses the server `TZ`.
- Time-versioning (budgets, goals, bills, fixed income): amounts are rows effective from a month onward, and a month's amount is the row with the latest `effective_month` on or before it. Never update or delete past rows — past months are read-only. Categories and goals archive via `archived_from`, never deleted.
- Unallocated = income − bills − expenses − checked-off goals, everywhere, sourced from `getBudget` (`Budget.unallocatedCents`) / `planSummaryFromBudget` (`src/lib/plan.ts`); never recompute it client-side. A category's budgeted amount and an unchecked goal's target are *plans* and reserve nothing — only a Bill, a logged Expense, or a checked-off Goal claims real income (spec 022). The display label is "Unallocated Income"; the `unallocated` task code and `unallocatedCents` fields are unchanged (spec 015).
- Goals (`src/lib/goals.ts`): `saving` | `debt payoff`, separate tables `goals`/`goal_amounts`/`goal_checkins`. `goal_amounts` is time-versioned like `budget_allocations`; `goal_checkins` is a presence record — any month can be checked, including past ones. `goals.note` is optional free text (trimmed, capped at 200 chars via `parseLabel`, spec 040) editable only from `GoalManager` on the Goals page — not surfaced on the Hub's `GoalsCard` or in `GoalEditor`'s month-by-month view. `GOAL_TYPES`/`TYPE_LABELS`/`groupByType` live in `src/lib/goalTypes.ts` (no DB import, for client components). `GoalEditor` calls `router.refresh()` after a successful check-off toggle or amount save so the server-rendered Plan summary stays current (spec 024).
- Expenses (`src/lib/expenses.ts`, spec 019): a logged fact — money spent on a category on a date, in an `expenses` table (`category_id` cascade, `spent_on` date, `amount_cents > 0`, optional `description` text trimmed/capped at 200 chars via `parseNote`, `added_by` set-null). Not time-versioned and not read-only for past months: any date up to today is accepted, a future date is rejected. A category's `remainingCents` is `budgeted − bills − expenses`, and `Budget.expensesTotalCents` sums the month's spend (a term in `unallocatedCents` since spec 022). `BudgetEditor` (`/budget`) shows Bills and Expenses columns and computes "Remaining" the same way, matching the Hub's `CategoryTable`, which also renamed its "Left" column to "Remaining" (spec 038). Routes: `POST /api/expenses`, `DELETE /api/expenses/[id]`, `GET /api/expenses/month/[month]`.
- Bills (`src/lib/bills.ts`): amount, period (`interval_months` 1/3/6/12) and category versioned together in `bill_versions` (same latest-effective-month, read-only-past rules). The monthly equivalent is computed, never stored, in `monthlyEquivalent` and in the SQL of `activeBills` — keep the two in sync (`tests/bills.test.ts` compares them). `updateCategory` refuses to archive a category while bills use it or will move into it.
- Income (`src/lib/income.ts`): fixed sources keep a time-versioned amount in `income_amounts`; variable sources record actual `income_deposits` counted in the month of `received_on`. `assertCanEdit` allows an owner, or the source's own member; removed members' sources have `member_id` null and are owner-only. Shared validators in `src/lib/validate.ts`.
- Provisional income (spec 010): `getIncomeMonth` sets `provisional` for the current or a later month when a variable source is active. It changes wording/tone/severity only, never amounts; `category_over_budget` is never softened.
- Assign unallocated (`assignUnallocated` in `src/lib/budgets.ts`, `POST /api/budgets/[month]/assign-unallocated`): adds leftover income to goals only (spec 020 — a category's budget is never touched by Assign, only by a manual edit on Budget), as normal allocations from that month onward, all-or-nothing, under a `pg_advisory_xact_lock` keyed on household and month. A `categoryId` anywhere in the body returns a named 400 pointing at Expenses. Assign is a one-month top-up, not a permanent raise (spec 017). The panel is `src/components/AssignUnallocated.tsx` at `#assign`, near the top of `/goals` (moved from `/income` in spec 032); it confirms a successful assign in its footnote and resets its rows to empty (so a repeat click can't double up the same goal) — the confirmation no longer links to Goals since the panel already lives there (spec 026, reworded in spec 032).
- Navigation (`HeaderNav`): four top-level destinations — Overview (`/`), Plan (opens `/income`; active on `/budget`, `/bills`, `/income`, `/goals`), Expenses (`/expenses`, spec 019), Members. The active destination gets a `border-accent` underline, matching `PlanTabs`' own active-tab treatment, and "Plan" carries a static `▾` hint since it opens onto four sub-sections (spec 037). Income | Budget | Bills | Goals are `PlanTabs` under `PlanHeader` (title, `PlanTabs`, `MonthNav`, `PlanSummary`), in that order to match the Overview set-up checklist (spec 029). `PlanSummary` shows the three headline stats plus this month's open tasks as compact link chips (spec 033) — Assign among them, not a separate button; `PlanSummaryData.tasks` comes from `planSummaryFromBudget`/`getPlanSummary` (`src/lib/plan.ts`). On Budget, where `BudgetEditor` renders its own live summary from local state, `tasks` is still server-given and static like `unallocatedCents` — editing an amount doesn't recompute it. `PlanHeader` is a component, not a layout, because Next.js layouts cannot read `searchParams`.
- Tasks (`src/lib/tasks.ts`, `TaskCode`/`Task`/`buildTasks`, spec 032 — renamed from `AttentionCode`/`AttentionItem`/`attention`): this month's to-do list, built purely from a `Budget` so it never needs its own query. Warnings (`over_allocated`, `bills_exceed_income`, `category_over_budget`), `unallocated` (Assign, linking to `/goals...#assign`) and `goal_not_checked` keep their conditions; `log_expenses`/`update_income`/`update_bills` are permanent, showing every current month regardless of what's already done, replacing the old conditional `no_income`/`no_bills`. `getOverview` (`src/lib/overview.ts`) calls it for Overview's full list; `planSummaryFromBudget` (`src/lib/plan.ts`) calls it for the Plan summary's compact one, collapsing multiple `category_over_budget` items into one via `collapseCategoryOverBudget` (the only place Plan shows less than Overview, spec 033) — the two can never drift apart since both read the same function.
- Overview (`/`, `src/lib/overview.ts`, `GET /api/overview/[month]`): read-only results for a month. `getOverview` is the single source for both page and API and composes `getBudget`, `getIncomeMonth`, `getBillsMonth`, `getExpensesMonth`; never recompute those numbers in a component. `OverviewCategory` carries `expensesCents` alongside bills/budgeted; the over-budget code is `category_over_budget` (fires on `leftCents < 0`, so bills or expenses alone can flag it). The cash-flow bar draws spec 022's four real terms (Bills, checked Saving, checked Debt payoff, Expenses, Unallocated remainder) — `cashFlow` in the same file — so the bar and `Budget.unallocatedCents` never disagree. The page's sections (spec 023, the Expenses ledger in spec 034): the Budget table (`CategoryTable.tsx`, internal names unchanged), a full-width `ExpensesList` section, then a 3-column grid of cards — Income, Bills, Goals — each linking out with the verb for its own interaction ("Edit budget", "Add income", "Add bill", "Check off") rather than a generic "Manage". `Overview.expenses` is `{ recent: ExpenseLine[]; count: number }` — `recent` is `getExpensesMonth`'s rows capped at 10 (newest first, already that order), `count` is the real number logged so `ExpensesList` knows whether to show "View all in Expenses"; the section groups `recent` by `spentOn` into day headings and shows a Total row from `cashFlow.expensesCents`, never resummed from the (possibly capped) rows.
- Tasks' inline actions (spec 035): `TaskList.tsx` is a client component (props beyond `items`: `month`, `currency`, `editable`, `categories`, `goals` — all already on `Overview`, no new query) that gives four task codes a toggle button expanding a panel in place instead of a `<Link>`: `goal_not_checked` acts immediately (one `PUT` checkin call, no form); `unallocated` embeds the existing `AssignUnallocated` (`bare` prop skips its own card chrome), gated on `editable` though `buildTasks` already only produces this task when editable; `log_expenses` renders `TaskQuickExpense.tsx` (a compact `POST /api/expenses` form, no month-clamping since this task is always the current month); `category_over_budget` renders `TaskQuickBudgetAdjust.tsx` (one amount field, `PUT` to the allocation route), also gated on `editable`. Every other task code is unchanged (`<Link>` to its page). On success each calls `router.refresh()` and lets a resolved task drop out of the next `buildTasks` render — except Assign, which only plans a goal's amount (spec 021/026: a goal claims against Unallocated only once checked off), so the `unallocated` task persists through a successful Assign by design. `page.tsx` gives `TaskList` a `key` on `[month, o.tasks.length]` so expand state never carries into a different month's tasks.
- Removing a member deletes their user row (cascades to sessions and membership). Later tables referencing users must use `ON DELETE SET NULL` or soft-delete to keep history.
- Keep `README.md` (notably its tech stack and config tables) current when the stack or env vars change.

## UI rules

- Visual identity (owner-approved): purple / cream / green. Dark is Dracula, light is Alucard. Green is the brand accent (`--accent`, focus rings). Use the tokens only, never hardcoded colors or translucent overlays. Icons live in `src/app/` (the M from `Logo.tsx`).
- Surface layers (spec 011): `--page` → `--background` (cards) → `--surface-subtle` (table headers) → `--surface` (totals). A card is `cardCls` from `src/components/ui.ts`; add `overflow-hidden` for lists/tables so fills follow the corners. Never put `text-danger` on `--surface`/`--surface-subtle` (below 4.5:1 in dark), so no row hover fills.
- Theming: colors come from the tokens in `src/app/globals.css` (`text-muted`, `text-danger`, `text-accent`, `bg-background`, `bg-surface`, `border-border`, `border-border-strong`). `tests/theme.test.ts` enforces WCAG AA contrast and fails on hardcoded colors. `dark:` follows the `dark` class on `<html>`, set before paint by the inline script in `layout.tsx`. Check new UI in both themes. Theme choice is per device (`localStorage`).
- Charts are hand-built and server-rendered (no chart library): stacked/bullet bars in CSS using `--chart-1..4`, always with a text equivalent, never color alone.
- Styling gotcha: `inputCls` includes `w-full`, so a width override on an input must use the important suffix (`w-32!`, `w-auto!`).
- Session changes need a full page load: after sign-in, setup, join, sign-out or leaving the household, use `navigateTo(path)` from `src/lib/client.ts` (`window.location.assign`), never `router.push()` + `router.refresh()` (they race; the header is server-rendered from the session). `router.refresh()` alone is only for data changes that keep the same user.
- Error pages: `src/app/error.tsx` and `src/app/global-error.tsx` replace Next's defaults. They show a digest reference matching Next's server log line, never the error text. Sign-in, setup and join screens use `AuthCard`.

## Testing

- Vitest is primary (`tests/`; shared helpers in `tests/helpers.ts`). Tests that depend on "today" mock `currentMonth` from `@/lib/months`. UI tests without a browser render with `renderToStaticMarkup` and mock `usePathname` (see `tests/plan-ui.test.tsx`). Run `npx next typegen` if `RouteContext` types are missing.
- During iteration, run the targeted file (`npx vitest run tests/<name>.test.ts`) instead of the full `npm test` — the suite is one shared DB and takes ~35s; the full run is the pre-commit gate. Same for builds: don't run `npm run build` for a docs-only change.
- e2e (`e2e/`, `playwright.config.ts`): seeds one deterministic household through the app's API, signs in via `signIn(page, OWNER)`, waits for hydration with `waitHydrated`. Everything destructive goes through `assertScratch` (database name must end in `_e2e`); never point it at the real database or the Docker instance. `E2E=1` (set only by Playwright) disables the sign-in rate limiter and the Next dev badge. `npm run test:e2e:docker` runs `e2e/signin.spec.ts` against the built Docker image with a scratch database; run it after any change to auth or navigation.

## Product constraints from `specs/brief.md`

- Household is the root scope; every budget, account, and transaction belongs to a household, not an individual.
- Budgets are monthly and category-driven; allocations are time-versioned so history is preserved.
- Income is per member: fixed monthly and variable (freelance, bonuses, irregular deposits); owners edit everyone's, members edit their own.
- Receipt capture: photograph a receipt, parse merchant/date/total/line items, show a review step before saving.
- Dashboards: budget vs. actual, category trends, income vs. spend, household-level and per-member views.
- API-first; self-hosted, open-source (simple Docker Compose deploy and backup, also works as a Portainer stack).

## Working on the specs

- Research must be completed before the specs are written. Cite sources for anything factual.
- Keep spec files under `specs/`.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
