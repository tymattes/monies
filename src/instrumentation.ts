// Runs once when the Next.js server starts: apply pending DB migrations.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (!process.env.DATABASE_URL) {
    console.warn("[db] DATABASE_URL not set; skipping migrations");
    return;
  }
  const { runMigrations } = await import("./db/migrate");
  await runMigrations();
  console.log("[db] migrations applied");
}
