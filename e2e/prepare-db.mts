// Creates and migrates the scratch database before Playwright starts the app
// (the app runs migrations at startup and needs the database to exist).
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import path from "node:path";
import postgres from "postgres";
import { e2eDb } from "./support/db.mts";

const { adminUrl, e2eUrl, dbName } = e2eDb(); // throws unless the name ends in _e2e

const admin = postgres(adminUrl, { max: 1, onnotice: () => {} });
try {
  const found = await admin`select 1 from pg_database where datname = ${dbName}`;
  if (found.length === 0) await admin.unsafe(`create database "${dbName}"`);
} finally {
  await admin.end();
}

const sql = postgres(e2eUrl, { max: 1, onnotice: () => {} });
try {
  await migrate(drizzle(sql), {
    migrationsFolder: path.join(process.cwd(), "drizzle"),
  });
  console.log(`[e2e] database "${dbName}" is ready`);
} finally {
  await sql.end();
}
