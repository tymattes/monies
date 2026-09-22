# Monies

A self-hosted, household-centric budgeting app. Web first, with a companion iOS app planned.

**Status:** early development. The app shell, database, household sign-in and invites, and monthly category budgets, and income exist so far; features are being added one spec at a time (see [`specs/`](specs/)).

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

- **Categories and monthly budgets** (spec 004): a Budget page with previous/next month navigation. New households start with Housing, Groceries, Dining out, Transport, Utilities, Health, Entertainment, Savings and Other, and any member can add, rename, reorder or archive categories. Set an amount per category and it applies **from that month onward**; later months inherit it until you change them, and past months are read-only so history stays accurate. Archiving hides a category from this month on but past months keep it. Amounts use one currency per household, chosen at setup.
- **Category types** (spec 012): every category is Spending, Saving, or Debt payoff (Savings starts as Saving; everything else starts as Spending). Set or change it any time from the Categories list. The Budget page and the Overview's categories table group rows into a section per type, each with its own subtotal, and the grand total is unchanged. The Assign panel now preselects the first Saving category by type, not by matching the name "Savings".
- **Light and dark theme** (spec 005): follows your system setting by default, with a System / Light / Dark switch in the header. The choice is remembered per device, not per account. Dark is the [Dracula](https://draculatheme.com/) palette and light is its official variant, Alucard.

- **Overview** (spec 008): the home page shows how the month is going, read-only. A **Needs attention** list flags anything worth a look with a link to fix it (money not yet assigned, a category whose bills are over its budget, budgets or bills above your income, or missing income and bills). A **cash-flow** card splits your income into bills, the rest of your budget and unallocated money in one bar, with Left after bills alongside; when you have money budgeted into a Saving or Debt payoff category, the card also shows that total (spec 013), hidden when zero. A **categories** table shows each category's budget, bills and what is left, with a small bar comparing bills to the budget. **Income** and **Bills** cards summarise each (income by member; your largest bills). A brand-new household gets a short set-up guide instead. Everything is per month with the same month switcher, and past months are read-only.
- **Variable income and warnings** (spec 010): if you have a variable income source (freelance, sales, bonuses), this month's income is only what you've recorded so far and a future month has none of it yet. So being over budget in those months reads "Over recorded income by" in the normal text color, with a note that variable income counts once you record it, and appears in Needs attention as a plain note instead of a red warning. If your income is all fixed, over-allocation stays a red "Over-allocated by" warning, because your income is complete.
- **Plan area** (spec 008): Budget, Bills and Income are three tabs of one monthly plan, under a single **Plan** item in the header (next to Overview and Members). They share a month switcher and a summary bar showing Income, Budgeted (with how much of it is bills) and Unallocated, or "Over-allocated by" in red when you have budgeted more than you earn. When money is unallocated, an **Assign** button in the bar takes you to the Assign panel on the Budget page. The Budget table now ends with a totals row for its Bills, Left and Budgeted columns.
- **Bills** (spec 007): a Bills page for recurring costs like rent, subscriptions, phone and insurance. Add a bill once with its amount, how often it is charged (monthly, every 3 months, every 6 months, or yearly) and a category you choose. It counts against that category every month with nothing to log, and yearly or 6-month bills are spread evenly across the months (a $120 yearly bill counts $10 a month; amounts are rounded to the nearest cent, so a yearly total can differ from the real bill by a few cents). Each bill shows who added it, and any member can edit or end any bill. Amount, period and category changes apply from the month you're viewing onward; past months stay read-only. A category with active bills can't be archived until they're moved or ended. The Budget page shows each category's bills and what's left of its budget, plus Monthly bills and Left after bills (income minus bills).
- **Assign unallocated** (spec 007): when income is left over after budgeting, the Budget page offers an Assign panel. Pick one or more categories and an amount for each (the first row starts on your first Saving-type category, if you have one — see spec 012), optionally use "Split evenly", and apply it all in one click. Each amount is added to its category from this month onward as a normal amount you can edit afterwards, and anything you don't assign stays unallocated. Nothing is ever assigned automatically.
- **Income** (spec 006): an Income page with previous/next month navigation. Each member has income sources, either **fixed monthly** (a take-home amount that applies from a month onward and carries forward, with past months read-only) or **variable** (you record each deposit with its date, and it counts in that month). Everyone in the household can see everyone's income; members edit their own and owners can edit anyone's. If a member is removed, their income history stays as "Former member". The Budget page shows household income and how much is still unallocated (or over-allocated). Enter take-home (net) income after taxes; if you're paid more often than monthly, enter your average monthly amount.

Planned: receipt capture and transactions, multi-month trends, a native iOS app. See [`specs/brief.md`](specs/brief.md).

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
