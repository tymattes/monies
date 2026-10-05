---
name: redeploy
description: Rebuild and restart the local Docker Compose stack from the current checkout, then confirm it is healthy.
disable-model-invocation: true
---

Redeploy the Compose stack in this checkout. It holds real household data in the `monies-db` volume.

1. **Check the source.** `git status -sb`. Deploy from an up-to-date `main` unless the user asked for a branch; if it's anything else, say what is about to be deployed before building.
2. **Build and restart the app only:** `docker compose up -d --build app`. The database container keeps running. Migrations in `drizzle/` apply at server start.
3. **Wait for health**, up to 90 seconds:
   ```sh
   for i in $(seq 1 30); do
     s=$(docker compose ps app --format '{{.Health}}'); [ "$s" = healthy ] && break; sleep 3
   done; echo "app: $s"
   ```
4. **Confirm from outside the container:** `docker compose port app 3000` gives the published address; `curl -fsS http://<that address>/api/health`.
5. **If it isn't healthy:** `docker compose logs --tail 80 app`. A failed migration makes the server exit on start. Report the error and stop; don't retry in a loop.

Never run `docker compose down -v`, remove the `monies-db` volume, or drop the `monies` database. Scratch databases (`monies_test`, `monies_e2e`) are the only ones tests may reset.

This covers the stack on this machine. Instances deployed elsewhere (Portainer, a published image) upgrade as described under Upgrading in `README.md`.
