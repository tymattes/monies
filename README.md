# Monies

A self-hosted, household-centric budgeting app. Web first, with a companion iOS app planned.

**Status:** early development. The app shell, database, and household sign-in and invites exist so far; features are being added one spec at a time (see [`specs/`](specs/)).

## Principles

- **Household first.** Every budget, account and transaction belongs to a household, not an individual.
- **Low-friction entry.** Capturing spend, especially by photographing receipts, should take seconds.
- **Modern, rich UX.** Dashboards should be genuinely useful, not decorative.
- **Self-hosted and private.** Simple to deploy and back up, with Docker Compose and Portainer support.

The full product brief is in [`specs/brief.md`](specs/brief.md).

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
| Tests | [Vitest](https://vitest.dev/) |
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
| `DATABASE_URL` | none | Connection string for local development. In Compose it is set automatically to the `db` service. |

## Deploying

### Docker Compose

On your server: clone the repo, create `.env` as above with a strong password, then `docker compose up -d --build`. Put a reverse proxy with TLS in front of the app port for anything beyond your LAN. The DB port is bound to localhost only.

### Portainer

Create a stack from this Git repository (Repository build method) using `docker-compose.yml`, and set the variables from the table above in the stack's environment section. `POSTGRES_PASSWORD` and `BETTER_AUTH_SECRET` are required; the stack will not start without them. Set `BETTER_AUTH_URL` to the address you will browse to.

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

## License

[MIT](LICENSE)
