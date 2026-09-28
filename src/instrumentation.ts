// Runs once when the Next.js server starts: apply pending DB migrations.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (!process.env.DATABASE_URL) {
    console.warn("[db] DATABASE_URL not set; skipping migrations");
    return;
  }
  const { runMigrations } = await import("./db/migrate");
  try {
    await runMigrations();
  } catch (err) {
    // Next's production server memoizes this call and never retries a failed
    // attempt (e.g. the DB not accepting connections yet on first boot) — every
    // later request, including the healthcheck's, would replay this same
    // rejection forever. Exit instead, so `restart: unless-stopped` retries
    // against a (by then likely ready) database.
    console.error("[db] migration failed; exiting so the container restarts", err);
    process.exit(1);
  }
  console.log("[db] migrations applied");
}
