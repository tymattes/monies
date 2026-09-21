import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import path from "node:path";
import { getSql } from "./index";

export async function runMigrations() {
  await migrate(drizzle(getSql()), {
    migrationsFolder: path.join(process.cwd(), "drizzle"),
  });
}
