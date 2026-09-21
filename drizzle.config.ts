import { defineConfig } from "drizzle-kit";

// Local dev: load DATABASE_URL from .env (Node 24 built-in; no-op if absent).
try {
  process.loadEnvFile(".env");
} catch {}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
});
