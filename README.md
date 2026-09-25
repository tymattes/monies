# Monies

A self-hosted, household-centric budgeting app. Web first, with a companion iOS app planned.

**Status:** early development. Specs 001–023 are implemented — households, sign-in and invites, categories and monthly budgets, income, bills, saving and debt-payoff goals, expenses, and the Overview hub are all working; the remaining roadmap (receipt capture, trends, iOS app) lands one spec at a time (see [`specs/`](specs/)).

## Philosophy

Monies is organised around a monthly rhythm: plan the month, record what happens, then check in and act.

- **Plan.** Set up the month ahead of time. Enter income, your recurring bills, your goals (savings and debt payoff to complete this month), and a budget for each spending category. Plans are forward-looking: change one and it applies from that month on, leaving past months untouched.
- **Expenses.** Record what actually happened, with as little friction as possible (receipt capture is planned). An expense is a fact, not a plan — log it and it counts against a category immediately, for any date up to today.
- **Overview.** The hub you return to: how the month is going, and what still needs doing. It's where the plan meets reality. It points you at the three recurring tasks — assigning leftover income to savings, logging expenses, and checking off goals — and shows the detail (category status, warnings, per-domain summaries) behind each.

Underneath all three is one distinction: **a plan is not a commitment.** A category budget and an unchecked goal reserve nothing; only a bill, a logged expense, or a checked-off goal actually claims income. That is why Unallocated Income means income minus those real commitments — until you check a goal off or log the spend, the money is still yours to place.

Monies is deliberately disconnected from your bank accounts, and it doesn't try to be exact. You log spending by hand, so the picture is only as complete as what you record — the goal is an honest sense of how your real expenses map to your income and budget, not a reconciled ledger.

## Principles

- **Household first.** Every budget, account and transaction belongs to a household, not an individual.
- **Low-friction entry.** Capturing spend, especially by photographing receipts, should take seconds.
- **Modern, rich UX.** Dashboards should be genuinely useful, not decorative.
- **Self-hosted and private.** Simple to deploy and back up, with Docker Compose and Portainer support.

The full product brief is in [`specs/brief.md`](specs/brief.md).

## Features

Implemented so far (each maps to a spec in [`specs/`](specs/)):

- **Households and sign-in** (spec 003): first-run setup creates your household and owner account. Email and password sign-in, invite-only sign-up (no email service needed), one household per instance.
- **Members and invites** (spec 003): owners create single-use invite links (7-day expiry, revocable), remove members and rename the household. Members can leave.

- **Categories and monthly budgets** (spec 004): a Budget page with previous/next month navigation. New households start with Housing, Groceries, Dining out, Transport, Utilities, Health, Entertainment and Other, and any member can add, rename, reorder or archive categories. Set an amount per category and it applies **from that month onward**; later months inherit it until you change them, and past months are read-only so history stays accurate. Archiving hides a category from this month on but past months keep it. Amounts use one currency per household, chosen at setup.
- **Saving and Debt payoff goals** (spec 014, moved into the Plan tabs in spec 015): a **Goals** tab for money that leaves this app entirely — a transfer to savings, an extra payment toward debt — which the app can never verify the way it eventually will an Expense. Each goal has a name, a type (Saving or Debt payoff), a monthly target amount you can still change like any budget figure, and a checkmark for "did I do this" that (unlike the amount) can be set for any month, including past ones. A new household starts with one starter Savings goal. Goal amounts count toward Unallocated everywhere, the same as an Expense category's budget, and the Assign panel (near the top of the Goals page, spec 032) can send leftover income to a goal in one click, still defaulting to the first Saving goal when one exists. If a goal has a nonzero amount for the current month and hasn't been checked off yet, Overview's Tasks reminds you.
- **Expenses** (spec 019): an **Expenses** page (its own top-level destination, next to Plan) where you log money actually spent — pick a category, type an amount, a date, and an optional description, and it counts against that category's budget the same way a bill does, so a category's "left" becomes budget minus bills minus expenses. Logging more than a category has left is allowed and shows the over-budget red rather than being refused, since a real purchase already happened. Expenses are facts, not plans: you can log them for any date up to today (past months included), and a future date is rejected. Delete and re-add covers a mistake; there's no edit.
- **Light and dark theme** (spec 005): follows your system setting by default, with a System / Light / Dark switch in the header. The choice is remembered per device, not per account. Dark is the [Dracula](https://draculatheme.com/) palette and light is its official variant, Alucard.

- **Overview** (spec 008, budget vs. actual in spec 021, sections and actions in spec 023, the Expenses ledger in spec 034): the home page shows how the month is going, read-only. A **Tasks** list (spec 032, renamed from Needs attention) is this month's to-do list, not just what's wrong: warnings (money not yet committed, a category whose bills and expenses are over its budget, commitments or bills above your income), money to assign, a funded goal you haven't checked off yet, and — every month, whether or not anything's actually missing — permanent reminders to log expenses and keep income and bills up to date. A **cash-flow** card splits your income in one bar into what's actually claimed by something real — Bills, checked-off Saving and Debt payoff contributions, logged Expenses, and the Unallocated remainder — so the bar and the Unallocated figure above it always agree; an unchecked goal's target contributes nothing to the bar (spec 021/022). When you have money in a Saving or Debt payoff goal, the card also shows those full planned totals as headline stats. A **Budget** table shows each Expense category's budget, bills, expenses and what is left, with a small bar comparing actual spend (bills plus expenses) to the budget, and an "Edit budget" link. Three cards — **Income**, **Bills** and **Goals** — summarise each (income by member; your largest bills; each goal funded this month with its amount and whether it's been checked off — spec 015) and link out with the action for that section: "Add income", "Add bill", "Check off". Below them, a full-width **Expenses** section (spec 034) is a ledger of the month's actual logged expenses — newest first, grouped by day — capped at the 10 most recent with a link to the full log on the Expenses page when there are more, and a running total. A brand-new household also sees a set-up checklist — Add your income, Set your category budgets, Add your recurring bills, Review your goals — above everything else, each step checked off as its own numbers show it's done, until all four are and it disappears (spec 031). Everything is per month with the same month switcher, and past months are read-only.
- **Variable income and warnings** (spec 010): if you have a variable income source (freelance, sales, bonuses), this month's income is only what you've recorded so far and a future month has none of it yet. So being over budget in those months reads "Over recorded income by" in the normal text color, with a note that variable income counts once you record it, and appears in Tasks as a plain note instead of a red warning. If your income is all fixed, over-allocation stays a red "Over-allocated by" warning, because your income is complete.
- **Plan area** (spec 008, Goals folded in by spec 015, Unallocated redefined in spec 022, tab order in spec 029, tasks in spec 033): Income, Budget, Bills and Goals are four tabs of one monthly plan, under a single **Plan** item in the header (next to Overview and Members). They share a month switcher and a summary bar showing Income, Budgeted (Expenses and goals together, with how much of it is bills) and Unallocated Income, or "Over-allocated by" in red when your real commitments exceed your income. Unallocated Income is income minus Bills, logged Expenses and checked-off Goals — a category's budgeted amount and an unchecked goal's target are plans, not money that's spoken for, so they don't reduce it (spec 022). Below the numbers, the same bar shows this month's open tasks as small link chips — the same ones Overview's Tasks list shows (spec 032), built from the same shared logic so the two can't disagree, except several over-budget categories collapse into a single "N categories over budget" chip here rather than one each. Assign is one of these chips, taking you to its panel on the Goals page, no longer a button styled apart from the rest. The Budget table now ends with a totals row for its Bills, Left and Budgeted columns.
- **Bills** (spec 007): a Bills page for recurring costs like rent, subscriptions, phone and insurance. Add a bill once with its amount, how often it is charged (monthly, every 3 months, every 6 months, or yearly) and a category you choose. It counts against that category every month with nothing to log, and yearly or 6-month bills are spread evenly across the months (a $120 yearly bill counts $10 a month; amounts are rounded to the nearest cent, so a yearly total can differ from the real bill by a few cents). Each bill shows who added it, and any member can edit or end any bill. Amount, period and category changes apply from the month you're viewing onward; past months stay read-only. A category with active bills can't be archived until they're moved or ended. The Budget page shows each category's bills and what's left of its budget, plus Monthly bills and Left after bills (income minus bills). Bills only ever attach to Expense categories, never to a goal.
- **Assign unallocated** (spec 007, moved to the Income page in spec 015, informed splits in spec 016, a one-month top-up in spec 017, goals-only in spec 020, confirms and explains the claim point in spec 026, moved to the Goals page in spec 032): when income is left over after budgeting, the Goals page offers an Assign panel near the top, reached from a Tasks entry or the Plan summary bar's Assign button on any Plan page. Each goal option shows its current amount right in the dropdown, so you're splitting against what's really there rather than from memory, and a summary line near the top keeps the running total and what's left in view as you type. Pick one or more goals and an amount for each (the first row starts on your first Saving goal, if you have one — see spec 014), use "Fill remaining" on a row to absorb whatever's left in one click, or "Split evenly" across every row, and apply it all in one click. Assign only targets goals, never a category — a category's budget is set by hand on Budget, or reflects what it actually costs (bills and logged expenses, spec 019); to put money against a category, log an Expense. Unlike editing a goal amount by hand, an assignment is a one-time top-up by default: the goal's amount goes up this month, then goes back to what it was the month after, unless you'd already planned something different for that month (in which case your plan is left alone) — because the leftover being assigned is tied to this month's income, not a decision to permanently raise the goal. Anything you don't assign stays unallocated, and nothing is ever assigned automatically. The panel makes clear this money doesn't count against Unallocated Income until the goal is checked off; after a successful assign it confirms what was added and to what, ready to check off right below.
- **Income** (spec 006): an Income page with previous/next month navigation. Each member has income sources, either **fixed monthly** (a take-home amount that applies from a month onward and carries forward, with past months read-only) or **variable** (you record each deposit with its date, and it counts in that month). A fixed source's starting amount can be set right in the form that creates it, so it's a one-step add (spec 030); left blank, it starts at $0.00 and can be filled in afterward, same as before. Everyone in the household can see everyone's income; members edit their own and owners can edit anyone's. If a member is removed, their income history stays as "Former member". The Budget page shows household income and how much is still unallocated (or over-allocated). Enter take-home (net) income after taxes; if you're paid more often than monthly, enter your average monthly amount.

Planned: receipt capture (photographing a receipt to auto-fill the expense form), multi-month trends, a native iOS app. See [`specs/brief.md`](specs/brief.md).

## Tech stack

| Layer | Choice |
| --- | --- |
| Framework | [Next.js](https://nextjs.org/) (App Router) with React, TypeScript |
| Styling | [Tailwind CSS](https://tailwindcss.com/) v4 |
| API | Next.js route handlers under `src/app/api/`, so a future iOS app can reuse them |
| Database | [PostgreSQL](https://www.postgresql.org/) 17 |
| Data access | [Drizzle ORM](https://orm.drizzle.team/) with the `postgres` driver; SQL migrations via `drizzle-kit` |
| Runtime | Node.js 24 |
| Auth | [Better Auth](https://www.better-auth.com/) (email and password, cookie sessions); sign-up is invite-only |
| Tests | [Vitest](https://vitest.dev/) for the API and logic; [Playwright](https://playwright.dev/) with axe for browser and accessibility tests |
| Packaging | Docker (multi-stage build, Next.js `standalone` output) and Docker Compose |

## Quick start (Docker Compose)

Requires Docker with Compose.

```sh
cp .env.example .env
# Edit .env: set POSTGRES_PASSWORD (and the same password inside DATABASE_URL, used for local dev)
# and BETTER_AUTH_SECRET (generate one with: openssl rand -base64 32)
docker compose up --build
```

Open http://localhost:3000. The database schema is migrated automatically when the app starts. On first visit you are taken to a setup page that creates your household and the first (owner) account. Add others from **Members** by creating an invite link and sharing it; there is no open sign-up and no email is sent.

Check health: `curl localhost:3000/api/health` returns `{"status":"ok","db":"ok"}`, or HTTP 503 if the database is unreachable.

## Local development

Run Postgres in Compose and the app natively for fast hot reload:

```sh
cp .env.example .env          # set a password, keep DATABASE_URL pointing at localhost
docker compose up -d db       # Postgres on 127.0.0.1:${DB_PORT:-5432}
npm install
npm run dev                   # http://localhost:3000 (applies pending migrations on start)
```

| Command | Purpose |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` / `npm run start` | Production build and serve |
| `npm run lint` | ESLint |
| `npm test` | Vitest integration tests (needs `docker compose up -d db`; uses a separate `monies_test` database) |
| `npm run db:generate` | Generate a migration after editing `src/db/schema.ts` |
| `npm run db:migrate` | Apply migrations manually |

### Tests

- `npm test` runs the fast Vitest suite (API, business logic, server-rendered markup). It needs Postgres (`docker compose up -d db`) and uses a separate `monies_test` database.
- `npm run test:e2e` runs the browser tests in real Chromium with Playwright: themes (follows the OS, live change, no flash, keyboard), the Plan pages and Assign panel, Bills, phone layout, and accessibility scans (axe) of every page in both themes at desktop and phone size. It uses a throwaway `monies_e2e` database and its own port (3100), never your real data, and refuses to run against any database whose name does not end in `_e2e`. One-time setup: `npx playwright install chromium`.
- `E2E_PROD=1 npm run test:e2e` runs them against the production build (the standalone server, as in Docker) instead of the dev server. It also runs the error-page checks, which only apply to production builds. `E2E_WEBKIT=1` adds a rough Safari stand-in (`npx playwright install webkit` first).
- `npm run test:e2e:docker` builds the Docker image, runs it as a container against its own throwaway database on port 3200, and runs the sign-in and sign-out browser tests against it. It catches problems that only appear in the container (needs Docker and `docker compose up -d db`).
- `npm run e2e:screenshots` writes a screenshot of every page in light and dark, at desktop and phone size, to `e2e-screenshots/` (git-ignored, with an `INDEX.md`) for visual review.

Migrations live in `drizzle/` and are committed. The app applies pending migrations at startup (`src/instrumentation.ts`), both in dev and in the container.

## Configuration

| Variable | Default | Description |
| --- | --- | --- |
| `POSTGRES_PASSWORD` | none (required) | Database password. Avoid URL-special characters (`@ : / ? #`). |
| `POSTGRES_USER` | `monies` | Database user. |
| `POSTGRES_DB` | `monies` | Database name. |
| `APP_PORT` | `3000` | Host port the app is published on. |
| `DB_PORT` | `5432` | Host port for Postgres, bound to `127.0.0.1` only. |
| `BETTER_AUTH_SECRET` | none (required) | Secret used to sign sessions. Generate with `openssl rand -base64 32` and keep it stable; changing it signs everyone out. |
| `BETTER_AUTH_URL` | `http://localhost:${APP_PORT}` | The public URL people open the app at (scheme, host, port). Set it when serving behind a domain or reverse proxy, or sign-in requests are rejected. |
| `TZ` | `UTC` | Server timezone (IANA name, e.g. `America/Chicago`). Decides which calendar month is "this month" for budgets, so set it to where you live. |
| `DATABASE_URL` | none | Connection string for local development. In Compose it is set automatically to the `db` service. |

## Deploying

### Docker Compose

On your server: clone the repo, create `.env` as above with a strong password, then `docker compose up -d --build`. Put a reverse proxy with TLS in front of the app port for anything beyond your LAN. The DB port is bound to localhost only.

### Portainer

Create a stack from this Git repository (Repository build method) using `docker-compose.yml`, and set the variables from the table above in the stack's environment section. `POSTGRES_PASSWORD` and `BETTER_AUTH_SECRET` are required; the stack will not start without them. Set `BETTER_AUTH_URL` to the address you will browse to, and `TZ` to your timezone.

## Backup and restore

Data lives in the `monies-db` Docker volume. Back up with a logical dump:

```sh
docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > monies-$(date +%F).dump
```

Restore into a running stack:

```sh
docker compose exec -T db sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists' < monies-2026-01-01.dump
```

Keep dumps somewhere other than the server, and test a restore occasionally.

## Development workflow

Monies is built spec-first: every feature starts as a numbered spec in [`specs/`](specs/) that is approved before implementation. See [`specs/README.md`](specs/README.md) for the process and the list of specs and their status.

## Credits

The theme colors are from the [Dracula](https://draculatheme.com/) palette (dark) and its official light variant, Alucard (light).

## License

[MIT](LICENSE)
