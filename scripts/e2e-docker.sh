#!/usr/bin/env bash
# Runs the sign-in and sign-out browser tests against the real Docker image, the
# way you run it (a container, not a local dev or production server), with its own
# throwaway database. Catches problems that only appear in the container.
#
#   npm run test:e2e:docker
#
# Needs Docker and the Compose database (`docker compose up -d db`).
set -euo pipefail
cd "$(dirname "$0")/.."

set -a; . ./.env; set +a
PORT="${E2E_PORT:-3200}"
DB="monies_docker_e2e"                      # must end in _e2e (see e2e/support/db.mts)
NAME="monies-e2e-docker"
HOST_DB_PORT="${DB_PORT:-5432}"

cleanup() { docker rm -f "$NAME" >/dev/null 2>&1 || true; }
trap cleanup EXIT

echo "[e2e-docker] building the image"
docker compose build app >/dev/null

echo "[e2e-docker] preparing the scratch database $DB"
E2E_DB_NAME="$DB" node e2e/prepare-db.mts

cleanup
echo "[e2e-docker] starting the container on port $PORT"
# E2E=1 turns off the sign-in rate limiter (the tests sign in many times a minute).
docker run -d --name "$NAME" -p "$PORT:3000" \
  --add-host=host.docker.internal:host-gateway \
  -e DATABASE_URL="postgres://${POSTGRES_USER:-monies}:${POSTGRES_PASSWORD}@host.docker.internal:${HOST_DB_PORT}/${DB}" \
  -e BETTER_AUTH_SECRET="e2e-docker-secret-that-is-long-enough" \
  -e BETTER_AUTH_URL="http://localhost:${PORT}" \
  -e E2E=1 \
  monies:latest >/dev/null

for _ in $(seq 1 60); do
  curl -s "localhost:${PORT}/api/health" | grep -q '"ok"' && break
  sleep 1
done
curl -s "localhost:${PORT}/api/health" | grep -q '"ok"' || { docker logs "$NAME" | tail -20; exit 1; }

echo "[e2e-docker] running the browser tests against the container"
E2E_EXTERNAL=1 E2E_PORT="$PORT" E2E_DB_NAME="$DB" npx playwright test signin.spec.ts --project=desktop "$@"
