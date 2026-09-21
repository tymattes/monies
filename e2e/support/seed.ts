import { request, type APIRequestContext } from "@playwright/test";
import postgres from "postgres";
import { E2E_ORIGIN, assertScratch, e2eDb } from "./db.mts";

export const OWNER = { name: "Olive Owner", email: "o@e2e.test", password: "password123" };
export const MEMBER = { name: "Mia Member", email: "m@e2e.test", password: "password123" };

// "YYYY-MM" for the current month plus an offset. The app uses the real clock,
// so tests compute months instead of hardcoding them.
export function monthKey(offset = 0) {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// Everything is in cents. The numbers are chosen so each interesting state
// exists: money left unallocated, one category over budget from its bills, and
// a yearly bill spread across the months.
export const SEED = {
  household: "The Seeds",
  salaryCents: 500000,
  freelanceCents: 100000,
  incomeCents: 600000,
  budgets: {
    Housing: 180000,
    Groceries: 70000,
    "Dining out": 30000,
    Transport: 50000,
    Utilities: 35000, // bills below add up to 42000: over budget by 7000
    Health: 20000,
    Entertainment: 15000,
    Savings: 100000,
    Other: 10000,
  } as Record<string, number>,
  budgetedCents: 510000,
  unallocatedCents: 90000,
  bills: [
    { name: "Rent", amountCents: 150000, category: "Housing", paidWith: "Checking" },
    { name: "Phone", amountCents: 8000, category: "Utilities" },
    { name: "Electric", amountCents: 19000, category: "Utilities" },
    { name: "Water", amountCents: 6000, category: "Utilities" },
    { name: "Internet", amountCents: 9000, category: "Utilities" },
    { name: "Streaming", amountCents: 1599, category: "Entertainment" },
    { name: "Cloud storage", amountCents: 12000, intervalMonths: 12, category: "Other", note: "Yearly plan" },
  ],
  billsCents: 194599, // 1500 + 420 + 15.99 + 10 (the yearly bill spread)
};

async function ok(res: Awaited<ReturnType<APIRequestContext["get"]>>, what: string) {
  if (!res.ok()) {
    throw new Error(`Seeding failed at ${what}: ${res.status()} ${await res.text()}`);
  }
  return res;
}

// Empties the scratch database and rebuilds the same household through the
// app's own API. Refuses to touch anything that is not a scratch database.
export async function resetAndSeed() {
  const { e2eUrl, dbName } = e2eDb();
  assertScratch(dbName);
  const sql = postgres(e2eUrl, { max: 1, onnotice: () => {} });
  try {
    await sql`truncate "user", households, invites, verification cascade`;
  } finally {
    await sql.end();
  }

  const opts = { baseURL: E2E_ORIGIN, extraHTTPHeaders: { origin: E2E_ORIGIN } };
  const owner = await request.newContext(opts);
  const member = await request.newContext(opts);
  try {
    await ok(
      await owner.post("/api/setup", {
        data: { householdName: SEED.household, currency: "USD", ...OWNER },
      }),
      "setup",
    );
    const invite = (await (await ok(await owner.post("/api/invites", { data: {} }), "invite")).json()) as { token: string };
    await ok(await member.post(`/api/join/${invite.token}`, { data: MEMBER }), "join");

    const M = monthKey();
    const budget = (await (await ok(await owner.get(`/api/budgets/${M}`), "budget")).json()) as { categories: { id: string; name: string }[] };
    const category = (name: string): string => {
      const found = budget.categories.find((c) => c.name === name);
      if (!found) throw new Error(`Seeding: no category "${name}"`);
      return found.id;
    };

    const salary = (await (await ok(await owner.post("/api/income/sources", { data: { name: "Salary", kind: "fixed" } }), "salary")).json()) as { source: { id: string } };
    await ok(await owner.put(`/api/income/${M}/sources/${salary.source.id}`, { data: { amountCents: SEED.salaryCents } }), "salary amount");
    const freelance = (await (await ok(await member.post("/api/income/sources", { data: { name: "Freelance", kind: "variable" } }), "freelance")).json()) as { source: { id: string } };
    await ok(
      await member.post(`/api/income/sources/${freelance.source.id}/deposits`, {
        data: { receivedOn: `${M}-01`, amountCents: SEED.freelanceCents, note: "Logo job" },
      }),
      "deposit",
    );

    for (const [name, amountCents] of Object.entries(SEED.budgets)) {
      await ok(await owner.put(`/api/budgets/${M}/allocations/${category(name)}`, { data: { amountCents } }), `budget ${name}`);
    }
    for (const b of SEED.bills) {
      await ok(
        await owner.post("/api/bills", {
          data: { ...b, categoryId: category(b.category), category: undefined },
        }),
        `bill ${b.name}`,
      );
    }
  } finally {
    await owner.dispose();
    await member.dispose();
  }
}
