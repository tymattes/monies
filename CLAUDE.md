# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Workflow: spec-driven

`specs/brief.md` is the source of truth for product intent. Every feature starts as a numbered spec in `specs/` (copy `specs/_template.md`; process in `specs/README.md`). Don't write feature code without an approved spec, and update the spec's status and acceptance checkboxes as work lands.

## Commands

Stack: Next.js (App Router) + TypeScript + Tailwind, `src/` layout, npm.

- `npm run dev`: dev server on :3000
- `npm run build` / `npm run start`: production build (`output: "standalone"`) and serve
- `npm run lint`: ESLint
- `docker compose up --build`: run the containerized app (port from `APP_PORT` in `.env`, see `.env.example`); healthcheck hits `/api/health`

No test runner is configured yet.

## Architecture

Only the shell exists so far (spec 001): `src/components/Header.tsx` and `Logo.tsx` rendered from `src/app/layout.tsx`, a placeholder page, and `GET /api/health`. Business logic should go behind API route handlers (`src/app/api/`) so a future iOS app can reuse them. Postgres is planned but not yet added.

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
