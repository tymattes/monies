# 001: App shell

**Status:** implemented

## Goal
Stand up the smallest deployable Monies app: a header with a logo and a placeholder page, runnable locally and via Docker Compose. It establishes the stack and the API-first pattern that later specs build on (see `brief.md`: self-hosted, Docker Compose/Portainer, API usable by a future iOS app).

## Requirements
- Next.js (App Router), TypeScript, Tailwind CSS, `src/` layout.
- Sticky header: logo (inline SVG glyph plus "Monies" wordmark) on the left, an empty right-hand slot reserved for future navigation or a household switcher.
- Light and dark themes via `prefers-color-scheme`; the logo inherits color from theme tokens.
- Mobile-first layout with no horizontal scroll at phone width.
- Placeholder main content: "Welcome to Monies".
- `GET /api/health` returns `{"status":"ok"}`.
- Multi-stage `Dockerfile` using Next.js `output: "standalone"`.
- `docker-compose.yml` with a single `app` service: env from `.env` (`.env.example` provided), healthcheck on `/api/health`, and Portainer-stack compatible (uses no host-relative paths beyond the build context).

## Out of scope
Authentication, households, database (Postgres arrives in a later spec), budgets, income, receipts, dashboards.

## Acceptance criteria
- [x] `npm run lint` and `npm run build` pass.
- [x] Header shows logo and wordmark, and stays visible on scroll.
- [x] Correct in light and dark mode and at ~375px width.
- [x] `GET /api/health` returns `{"status":"ok"}`.
- [x] `docker compose up --build` yields a healthy container serving the page.
- [x] `CLAUDE.md` lists the real dev, build, lint and Docker commands.

## Technical notes
- Scaffold with `create-next-app`, then remove boilerplate.
- Components: `src/components/Header.tsx`, `src/components/Logo.tsx`.
- Logo is a placeholder and will be replaced later.

## Verification
Run lint and build, start `npm run dev`, curl the health endpoint, inspect in a browser at desktop and phone widths in both themes, then `docker compose up --build` and confirm the healthcheck passes.
