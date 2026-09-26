# Contributing

Thanks for your interest in contributing to Monies. It's a small, spec-driven
project — here's how it works.

## Before you start

- **Bug reports and feature requests:** use the issue templates in
  [`.github/ISSUE_TEMPLATE/`](.github/ISSUE_TEMPLATE/). They ask for the
  details needed to reproduce or evaluate.
- **Larger features:** open an issue to discuss first, so scope is agreed
  before you invest time.

## Development setup

See the [README](README.md) "Local development" section. In short:

```sh
cp .env.example .env          # set a password, keep DATABASE_URL pointing at localhost
docker compose up -d db       # Postgres on 127.0.0.1
npm install
npm run dev
```

Tests: `npm test` (Vitest, needs the `db` container), `npm run test:e2e`
(Playwright), `npm run lint`.

## How the project is organized

Monies is built spec-first. `specs/brief.md` is the source of truth for
product intent; every feature is a numbered spec in [`specs/`](specs/) that is
approved before code is written. The process is documented in
[`specs/README.md`](specs/README.md).

Business logic lives behind API route handlers under `src/app/api/` so a
future iOS app can reuse them. Data access is Drizzle over PostgreSQL
(`src/db/schema.ts`), auth is Better Auth (`src/lib/auth.ts`), and migrations
are committed SQL files in `drizzle/`.

## Pull requests

- One concern per branch and PR, named `<type>/<short-name>` (e.g.
  `feat/004-categories`, `fix/health-timeout`).
- Don't push directly to `main`; open a PR instead.
- Include documentation updates (`README.md` and `specs/` status) in the same
  PR — docs are part of the definition of done.
- Keep commits small and descriptive.

## Style

TypeScript throughout. `npm run lint` (ESLint) and `npm test` should pass;
the linter and tests are the gate. Match the existing code style.
