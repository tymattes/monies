import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { getDb } from "@/db";
import * as schema from "@/db/schema";

function createAuth() {
  return betterAuth({
    database: drizzleAdapter(getDb(), { provider: "pg", schema }),
    secret: process.env.BETTER_AUTH_SECRET,
    baseURL: process.env.BETTER_AUTH_URL,
    emailAndPassword: {
      enabled: true,
      // Public sign-up stays closed. Accounts are only created by our own
      // setup and invite-accept routes (see src/lib/accounts.ts).
      disableSignUp: true,
    },
    // Better Auth rate-limits sign-in in production, which is what we want for
    // real deployments. The Playwright browser tests sign in dozens of times a
    // minute, so only they (E2E=1, set by playwright.config.ts) turn it off.
    ...(process.env.E2E ? { rateLimit: { enabled: false } } : {}),
  });
}

const globalForAuth = globalThis as unknown as {
  auth?: ReturnType<typeof createAuth>;
};

// Lazy so `next build` works without a database or secret.
export function getAuth() {
  if (!globalForAuth.auth) globalForAuth.auth = createAuth();
  return globalForAuth.auth;
}
