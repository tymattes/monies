import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import path from "node:path";
import postgres from "postgres";
import { testDb } from "./test-db.mts";

export default async function setup() {
  const { adminUrl, testUrl, dbName } = testDb();

  const admin = postgres(adminUrl, { max: 1 });
  try {
    const found = await admin`select 1 from pg_database where datname = ${dbName}`;
    if (found.length === 0) await admin.unsafe(`create database "${dbName}"`);
  } finally {
    await admin.end();
  }

  const sql = postgres(testUrl, { max: 1 });
  try {
    await migrate(drizzle(sql), {
      migrationsFolder: path.join(process.cwd(), "drizzle"),
    });
  } finally {
    await sql.end();
  }
}
