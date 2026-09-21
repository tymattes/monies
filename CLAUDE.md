# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Workflow: spec-driven

`specs/brief.md` is the source of truth for product intent. Every feature starts as a numbered spec in `specs/` (copy `specs/_template.md`; process in `specs/README.md`). Don't write feature code without an approved spec, and update the spec's status and acceptance checkboxes as work lands.

## Commands

Stack: Next.js (App Router) + TypeScript + Tailwind, `src/` layout, npm.

- `npm run dev`: dev server on :3000
- `npm run build` / `npm run start`: production build (`output: "standalone"`) and serve
- `npm run lint`: ESLint
- `docker compose up --build`: run the full stack (app + Postgres). Needs `.env` copied from `.env.example` with `POSTGRES_PASSWORD` set; healthcheck hits `/api/health`
- `docker compose up -d db`: Postgres only, for native `npm run dev` (uses `DATABASE_URL` from `.env`)
- `npm run db:generate` / `npm run db:migrate`: generate migrations from `src/db/schema.ts` / apply them manually

No test runner is configured yet.

## Architecture

Specs 001-002 are done: header/logo shell, `GET /api/health` (reports DB connectivity, 503 when down), and the database foundation. Business logic should go behind API route handlers (`src/app/api/`) so a future iOS app can reuse them.

- Data access: Drizzle ORM over `postgres`. `src/db/schema.ts` holds tables (empty until later specs), `src/db/index.ts` exposes lazy `getDb()`/`getSql()` so builds work without a DB. Migrations are SQL files in `drizzle/`, committed.
- Migrations run automatically at server start via `src/instrumentation.ts` (dev and container). The Dockerfile copies `drizzle/` into the standalone image.
- Keep `README.md` (notably its tech stack table and config table) current when the stack or env vars change.

## Product constraints from `specs/brief.md`

Specs and any later implementation must respect these:

- **Household is the root scope.** Every budget, account, and transaction belongs to a household, not an individual. Households have multiple members, and setup includes creating a household and inviting members.
- **Budgets** are monthly and category-driven. Category allocations change over time, and history must be preserved so past months stay accurate. Model allocations as time-versioned, not as a single mutable value.
- **Income** is set per household member and supports both fixed monthly (salary) and variable (freelance, bonuses, irregular deposits).
- **Receipt capture**: photograph a receipt, parse merchant, date, total and ideally line items, then show a review step before saving. Entry should take seconds.
- **Dashboards**: budget vs. actual, category trends, income vs. spend, with household-level and per-member views.
- **API-first architecture**: the web app is first, but the API must let a native iOS app be added later without a rewrite.
- **Self-hosted, open-source intent**: must be simple to deploy and back up, with a documented Docker Compose setup that also works as a Portainer stack.

## Working on the specs

- Research must be completed before the specs are written. Cite sources for anything factual.
- The brief lists research tasks. Only task 1 (current fintech/budgeting UX trends: navigation, data visualization, dark mode, motion, mobile-first; note what to adopt and what to avoid) is defined so far, and the brief appears truncated after it.
- Keep spec files under `specs/`.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
