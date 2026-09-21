# 002: Database foundation and README

**Status:** implemented

## Goal
Add the persistence layer every later feature needs (Postgres, migrations, a typed data-access setup) and give the project a README so a new visitor can understand, run and deploy it. Supports `brief.md`: self-hosted, simple to deploy and back up, open-source intent.

## Requirements

### Database
- Postgres service in `docker-compose.yml` with a named volume, healthcheck, and credentials from `.env` (documented in `.env.example`).
- The `app` service waits for a healthy `db` (`depends_on: condition: service_healthy`) and receives `DATABASE_URL`.
- Migrations tool and typed query layer chosen in Technical notes (proposal: Drizzle ORM + drizzle-kit, SQL migrations checked into the repo).
- Migrations run automatically on app start in the container, and can be run manually for local dev.
- `GET /api/health` also reports database connectivity, e.g. `{"status":"ok","db":"ok"}`, and returns 503 when the database is unreachable. The container healthcheck keeps using it.
- Local dev: Postgres runs via Compose while the app runs natively with `npm run dev` (published port, `DATABASE_URL` in `.env`).
- Initial schema is intentionally minimal (migration bookkeeping only). Household and budget tables belong to later specs.

### README
- What Monies is and its guiding principles (from `brief.md`), and current status.
- Quick start: `cp .env.example .env`, `docker compose up --build`, open the app.
- Local development: Compose for Postgres, `npm run dev`, lint, build, migrations.
- Configuration: table of every environment variable.
- Deploying with Docker Compose and as a Portainer stack.
- Backup and restore of the Postgres volume (`pg_dump` / restore commands).
- Link to `specs/` and a short explanation of the spec-driven workflow.
- MIT license, with a `LICENSE` file in the repo root.
- Tech stack table, kept up to date as the stack changes.

## Out of scope
Households, auth, budgets, income, receipts, dashboards. No seed data.

## Acceptance criteria
- [x] `docker compose up --build` starts `db` and `app`, both healthy.
- [x] Migrations apply automatically on first start and are idempotent on restart.
- [x] `/api/health` reports `db: ok`, and returns 503 with the DB stopped.
- [x] Data survives `docker compose down` and `up` (volume persists).
- [x] Local dev flow works: Compose Postgres plus `npm run dev` plus manual migration command.
- [x] `.env.example` documents all new variables; no secrets committed.
- [x] README exists with every section above, and its commands work as written.
- [x] `CLAUDE.md` updated with database and migration commands and the architecture note.
- [x] `npm run lint` and `npm run build` pass.

## Technical notes
- Drizzle ORM with `postgres` (postgres-js) driver; schema in `src/db/schema.ts`, migrations in `drizzle/`. A plain-SQL migration tool is an alternative if we want less ORM coupling for the future iOS API.
- Migration on start: see Decisions (instrumentation hook, `drizzle/` copied into the image).
- Postgres version pinned (proposal: 17) in Compose.
- Portainer: Compose file must not depend on host-relative paths or a local `.env` file existing. Use `${VAR:-default}` for non-secrets and require secrets explicitly.

## Decisions
- Drizzle ORM with the `postgres` driver.
- MIT license; `LICENSE` added in this spec.
- No README screenshot until there is UI worth showing.
- Migrations run from Next.js `instrumentation.ts` at server start (rather than a separate script), so the standalone image needs only the `drizzle/` folder copied in.

## Verification
Fresh clone: follow the README quick start verbatim and confirm both services healthy. Stop `db` and confirm `/api/health` returns 503. `docker compose down && up` and confirm the migration bookkeeping table persists. Run lint and build.

Not verified: deployment as a Portainer stack (Compose file avoids host-relative paths, but it has not been run in Portainer).
