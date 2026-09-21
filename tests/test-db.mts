// Tests run against a separate `monies_test` database on the same Postgres
// server as DATABASE_URL (start it with `docker compose up -d db`).
export function testDb() {
  try {
    process.loadEnvFile(".env");
  } catch {}
  const adminUrl =
    process.env.DATABASE_URL ??
    "postgres://monies:change-me@localhost:5432/monies";
  const dbName = "monies_test";
  const url = new URL(adminUrl);
  url.pathname = `/${dbName}`;
  return { adminUrl, testUrl: url.toString(), dbName };
}
