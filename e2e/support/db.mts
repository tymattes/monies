// The browser tests run against a throwaway database on the same Postgres
// server as DATABASE_URL (start it with `docker compose up -d db`). Nothing
// here may ever touch a real database, so every destructive step goes through
// assertScratch().
export const DEFAULT_E2E_DB = "monies_e2e";

export function e2eDb() {
  try {
    process.loadEnvFile(".env");
  } catch {}
  const adminUrl =
    process.env.DATABASE_URL ??
    "postgres://monies:change-me@localhost:5432/monies";
  const dbName = process.env.E2E_DB_NAME ?? DEFAULT_E2E_DB;
  assertScratch(dbName);
  const url = new URL(adminUrl);
  url.pathname = `/${dbName}`;
  return { adminUrl, e2eUrl: url.toString(), dbName };
}

// Only databases whose name ends in "_e2e" are ever created, migrated or
// truncated by the browser tests.
export function assertScratch(dbName: string) {
  if (!/^[a-z0-9_]+_e2e$/.test(dbName)) {
    throw new Error(
      `Refusing to run browser tests against database "${dbName}": the name must end in "_e2e" (default "${DEFAULT_E2E_DB}").`,
    );
  }
}

export const E2E_PORT = Number(process.env.E2E_PORT ?? 3100);
export const E2E_ORIGIN = `http://localhost:${E2E_PORT}`;
export const E2E_SECRET = "e2e-secret-that-is-long-enough-for-better-auth";
