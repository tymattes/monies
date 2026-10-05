# Contributing

Thanks for your interest in contributing to Monies. It's a small, spec-driven
project — here's how it works.

## Before you start

- **Questions, feedback and early ideas:** start a thread in
  [Discussions](https://github.com/tymattes/monies/discussions). How you use
  Monies, what's confusing about the monthly flow, and self-hosting rough
  edges are all especially welcome.
- **Bug reports and feature requests:** use the issue templates in
  [`.github/ISSUE_TEMPLATE/`](.github/ISSUE_TEMPLATE/). They ask for the
  details needed to reproduce or evaluate.
- **Security issues:** report them privately, as described in
  [`SECURITY.md`](SECURITY.md), not as a public issue.

## Contributing code

What you need depends on the size of the change:

- **Bug fixes, docs, tests, small polish:** no spec needed. Open a PR
  directly and describe the problem it fixes.
- **New features or behavior changes:** open a feature request first so
  scope is agreed before you invest time. Once it's agreed, the change gets a
  numbered spec in [`specs/`](specs/) (copy `specs/_template.md`, Status
  `draft`). You can draft it yourself as the first commit of your PR, or ask
  the maintainer to write it. Code lands after the spec is approved.

Every PR needs a passing CI run and a maintainer review before it's merged.
CI on PRs from first-time contributors starts once a maintainer approves the
run, so a short wait before checks appear is normal.

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

If you work with an AI coding agent, `AGENTS.md` holds the rules that apply
everywhere and `.claude/rules/` holds the per-area ones (`CLAUDE.md` imports
`AGENTS.md`). `.claude/skills/` has the project's Claude Code skills.

## Pull requests

- One concern per branch and PR, named `<type>/<short-name>` (e.g.
  `feat/004-categories`, `fix/health-timeout`).
- Don't push directly to `main`; open a PR instead.
- Include documentation updates (`README.md` and `specs/` status) in the same
  PR — docs are part of the definition of done.
- Keep commits small and descriptive. PRs are squash-merged, so the PR title
  becomes the commit on `main`; write it like a commit subject.

## Style

TypeScript throughout. `npm run lint` (ESLint) and `npm test` should pass;
the linter and tests are the gate. Match the existing code style.
